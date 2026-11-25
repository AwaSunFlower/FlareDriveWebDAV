import {
  buildSessionCookie,
  checkLoginRateLimit,
  createSessionToken,
  DriveEnv,
  getClientIp,
  getEffectivePrivateDirs,
  isAuthConfigured,
  jsonResponse,
  recordLoginFailure,
  resetLoginFailures,
  resolveBucket,
  verifyCredentials,
} from "../../../utils/auth";

export const onRequestPost: PagesFunction<DriveEnv> = async ({
  request,
  env,
}) => {
  if (!isAuthConfigured(env)) {
    return jsonResponse(
      { error: "服务端未配置 WEBDAV_USERNAME / WEBDAV_PASSWORD" },
      503
    );
  }

  const clientIp = getClientIp(request);
  const rateCheck = checkLoginRateLimit(clientIp);
  if (!rateCheck.allowed) {
    return jsonResponse(
      {
        error: `登录尝试过于频繁，请 ${rateCheck.retryAfterSeconds} 秒后再试`,
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      },
      429,
      { "Retry-After": String(rateCheck.retryAfterSeconds) }
    );
  }

  let body: { username?: string; password?: string; remember?: boolean };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "请求格式错误" }, 400);
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const remember = body.remember !== false;

  if (!username || !password) {
    return jsonResponse({ error: "请输入用户名和密码" }, 400);
  }

  const ok = await verifyCredentials(env, username, password);
  if (!ok) {
    const failInfo = recordLoginFailure(clientIp);
    if (failInfo.locked) {
      return jsonResponse(
        {
          error: `连续输错次数过多，已暂时锁定 ${failInfo.retryAfterSeconds} 秒`,
          retryAfterSeconds: failInfo.retryAfterSeconds,
        },
        429,
        { "Retry-After": String(failInfo.retryAfterSeconds) }
      );
    }
    return jsonResponse(
      {
        error: `用户名或密码错误（剩余 ${failInfo.remainingAttempts} 次尝试机会）`,
        remainingAttempts: failInfo.remainingAttempts,
      },
      401
    );
  }

  resetLoginFailures(clientIp);
  const { token, maxAge, expiresAt } = await createSessionToken(
    env,
    username,
    remember
  );

  let privateDirs: string[] = [];
  const bucket = resolveBucket(request, env);
  if (bucket) {
    privateDirs = await getEffectivePrivateDirs(bucket, env);
  }

  return jsonResponse(
    {
      ok: true,
      username,
      expiresAt,
      privateDirs,
    },
    200,
    { "Set-Cookie": buildSessionCookie(request, token, maxAge) }
  );
};
