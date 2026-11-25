import {
  authenticateRequest,
  DriveEnv,
  getEffectivePrivateDirs,
  hasPathTraversal,
  INTERNAL_PREFIX,
  jsonResponse,
  normalizeDrivePath,
  parseEnvPrivateDirs,
  readDriveConfig,
  resolveBucket,
  writeDriveConfig,
} from "../../utils/auth";

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

  let body: { path?: string; isPrivate?: boolean };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "请求参数错误" }, 400);
  }

  const folderPath = normalizeDrivePath(
    typeof body.path === "string" ? body.path : ""
  );
  if (
    !folderPath ||
    folderPath.startsWith(INTERNAL_PREFIX) ||
    hasPathTraversal(folderPath)
  ) {
    return jsonResponse({ error: "无效的目录路径" }, 400);
  }

  const wantPrivate = Boolean(body.isPrivate);
  const envLockedDirs = parseEnvPrivateDirs(env);
  if (!wantPrivate && envLockedDirs.includes(folderPath)) {
    return jsonResponse(
      {
        error:
          "该目录已通过 Cloudflare 环境变量 PRIVATE_DIRS 锁定，请在 Cloudflare 后台移除后再取消私密",
      },
      400
    );
  }

  const config = await readDriveConfig(bucket);
  const nextSet = new Set(config.privateDirs);
  if (wantPrivate) {
    nextSet.add(folderPath);
  } else {
    nextSet.delete(folderPath);
  }

  await writeDriveConfig(bucket, { privateDirs: Array.from(nextSet) });
  const effectiveDirs = await getEffectivePrivateDirs(bucket, env);

  return jsonResponse({
    ok: true,
    path: folderPath,
    isPrivate: effectiveDirs.includes(folderPath),
    privateDirs: effectiveDirs,
  });
};
