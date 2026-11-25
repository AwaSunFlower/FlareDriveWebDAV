import {
  DriveEnv,
  isPathAllowedByShare,
  jsonResponse,
  normalizeDrivePath,
  parseVerifiedShareToken,
  resolveBucket,
} from "../../utils/auth";

export const onRequestGet: PagesFunction<DriveEnv> = async ({
  request,
  env,
}) => {
  const url = new URL(request.url);
  const shareToken = url.searchParams.get("share") || "";
  const requestedKey = normalizeDrivePath(
    url.searchParams.get("file") ||
      url.searchParams.get("dir") ||
      url.searchParams.get("key") ||
      ""
  );

  if (!shareToken) {
    return jsonResponse({ error: "缺少分享凭证" }, 400);
  }

  const share = await parseVerifiedShareToken(env, shareToken);
  if (!share) {
    return jsonResponse({ error: "该分享链接无效或已过期" }, 403);
  }

  const targetKey = requestedKey || share.key;
  const allowed = await isPathAllowedByShare(share, targetKey);
  if (!allowed) {
    return jsonResponse({ error: "分享链接与目标路径不匹配" }, 403);
  }

  const bucket = resolveBucket(request, env);
  if (!bucket) {
    return jsonResponse({ error: "未绑定 R2 存储桶" }, 500);
  }

  const head = await bucket.head(targetKey);
  if (!head) {
    return jsonResponse({ error: "分享的文件或目录已不存在" }, 404);
  }

  const isDirectory =
    head.httpMetadata?.contentType === "application/x-directory";

  return jsonResponse({
    valid: true,
    key: targetKey,
    rootKey: share.key,
    name: targetKey.split("/").pop() || targetKey,
    scope: share.scope,
    isDirectory,
    size: head.size,
    contentType: head.httpMetadata?.contentType || "application/octet-stream",
    uploaded: head.uploaded.toUTCString(),
    expiresAt: share.expiresAt,
  });
};
