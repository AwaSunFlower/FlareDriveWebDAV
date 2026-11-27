import {
  buildShareUnlockCookie,
  checkLoginRateLimit,
  DriveEnv,
  getClientIp,
  isPathAllowedByShare,
  isShareUnlockedByRequest,
  jsonResponse,
  normalizeDrivePath,
  parseVerifiedShareToken,
  recordLoginFailure,
  resetLoginFailures,
  resolveBucket,
  verifySharePasscode,
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

  const unlocked = await isShareUnlockedByRequest(
    request,
    env,
    shareToken,
    share
  );

  const isDirectory =
    head.httpMetadata?.contentType === "application/x-directory";

  return jsonResponse({
    valid: true,
    lockedByPasscode: !unlocked,
    requiresPasscode: share.requiresPasscode,
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

export const onRequestPost: PagesFunction<DriveEnv> = async ({
  request,
  env,
}) => {
  const ip = getClientIp(request);
  const rate = checkLoginRateLimit(`share:${ip}`);
  if (!rate.allowed) {
    return jsonResponse(
      {
        error: `尝试次数过多，请 ${rate.retryAfterSeconds} 秒后再试`,
      },
      429
    );
  }

  let body: { share?: string; passcode?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "请求参数错误" }, 400);
  }

  const shareToken = typeof body.share === "string" ? body.share.trim() : "";
  const passcode = typeof body.passcode === "string" ? body.passcode : "";
  if (!shareToken || !passcode.trim()) {
    return jsonResponse({ error: "请输入提取码" }, 400);
  }

  const share = await parseVerifiedShareToken(env, shareToken);
  if (!share) {
    return jsonResponse({ error: "该分享链接无效或已过期" }, 403);
  }

  const ok = await verifySharePasscode(env, share, passcode);
  if (!ok) {
    const fail = recordLoginFailure(`share:${ip}`);
    return jsonResponse(
      {
        error: fail.locked
          ? `提取码错误次数过多，已锁定 ${fail.retryAfterSeconds} 秒`
          : `提取码不正确（剩余 ${fail.remainingAttempts} 次机会）`,
      },
      403
    );
  }

  resetLoginFailures(`share:${ip}`);
  const cookie = await buildShareUnlockCookie(
    request,
    env,
    shareToken,
    share.expiresAt
  );
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": cookie });
};
