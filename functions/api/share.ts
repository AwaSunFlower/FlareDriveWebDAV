import {
  authenticateRequest,
  createShareToken,
  DriveEnv,
  hasPathTraversal,
  INTERNAL_PREFIX,
  jsonResponse,
  normalizeDrivePath,
  resolveBucket,
  ShareScope,
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
    return jsonResponse({ error: "无效的文件或目录路径" }, 400);
  }

  const head = await bucket.head(key);
  if (!head) {
    return jsonResponse({ error: "文件或文件夹不存在" }, 404);
  }

  const isDir = head.httpMetadata?.contentType === "application/x-directory";
  const scope: ShareScope = isDir ? "dir" : "file";

  const ttl =
    typeof body.expiresInSeconds === "number" && Number.isFinite(body.expiresInSeconds)
      ? body.expiresInSeconds
      : 24 * 60 * 60;

  const { token, expiresAt } = await createShareToken(env, key, ttl, scope);

  const pageUrl = new URL("/", request.url);
  pageUrl.searchParams.set("share", token);
  pageUrl.searchParams.set(isDir ? "dir" : "file", key);

  let directUrl: string | null = null;
  if (!isDir) {
    const rawUrl = new URL(`/webdav/${encodeKeyPath(key)}`, request.url);
    rawUrl.searchParams.set("share", token);
    if (body.download) {
      rawUrl.searchParams.set("download", "1");
    }
    directUrl = rawUrl.toString();
  }

  return jsonResponse({
    url: directUrl ?? pageUrl.toString(),
    pageUrl: pageUrl.toString(),
    directUrl,
    scope,
    expiresAt,
    key,
  });
};
