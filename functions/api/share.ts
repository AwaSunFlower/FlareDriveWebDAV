import {
  authenticateRequest,
  createShareToken,
  DriveEnv,
  hasPathTraversal,
  INTERNAL_PREFIX,
  jsonResponse,
  normalizeDrivePath,
  resolveBucket,
} from "../../utils/auth";

function encodeKeyPath(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export const onRequestPost: PagesFunction<DriveEnv> = async ({
  request,
  env,
}) => {
  const auth = await authenticateRequest(request, env);
  if (!auth.authenticated) {
    return jsonResponse({ error: "请先登录管理员账号" }, 401);
  }

  const bucket = resolveBucket(request, env);
  if (!bucket) {
    return jsonResponse({ error: "未绑定 R2 存储桶" }, 500);
  }

  let body: { key?: string; expiresInSeconds?: number; download?: boolean };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "请求参数错误" }, 400);
  }

  const key = normalizeDrivePath(typeof body.key === "string" ? body.key : "");
  if (!key || key.startsWith(INTERNAL_PREFIX) || hasPathTraversal(key)) {
    return jsonResponse({ error: "无效的文件路径" }, 400);
  }

  const head = await bucket.head(key);
  if (!head) {
    return jsonResponse({ error: "文件不存在" }, 404);
  }
  if (head.httpMetadata?.contentType === "application/x-directory") {
    return jsonResponse({ error: "暂不支持对文件夹生成直链，请选择具体文件" }, 400);
  }

  const ttl =
    typeof body.expiresInSeconds === "number" && Number.isFinite(body.expiresInSeconds)
      ? body.expiresInSeconds
      : 24 * 60 * 60;

  const { token, expiresAt } = await createShareToken(env, key, ttl);
  const shareUrl = new URL(`/webdav/${encodeKeyPath(key)}`, request.url);
  shareUrl.searchParams.set("share", token);
  if (body.download) {
    shareUrl.searchParams.set("download", "1");
  }

  return jsonResponse({
    url: shareUrl.toString(),
    expiresAt,
    key,
  });
};
