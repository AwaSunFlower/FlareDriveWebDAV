import {
  authenticateRequest,
  DriveEnv,
  getEffectivePrivateDirs,
  isAuthConfigured,
  isGuestFileLockEnabled,
  isPublicReadEnabled,
  jsonResponse,
  resolveBucket,
} from "../../../utils/auth";

export const onRequestGet: PagesFunction<DriveEnv> = async ({
  request,
  env,
}) => {
  const auth = await authenticateRequest(request, env);
  const publicRead = isPublicReadEnabled(env);
  const authConfigured = isAuthConfigured(env);
  const guestFileLocked = isGuestFileLockEnabled(env);

  let privateDirs: string[] = [];
  if (auth.authenticated) {
    const bucket = resolveBucket(request, env);
    if (bucket) {
      privateDirs = await getEffectivePrivateDirs(bucket, env);
    }
  }

  return jsonResponse({
    authenticated: auth.authenticated,
    username: auth.username,
    publicRead,
    authConfigured,
    guestFileLocked,
    privateDirs,
  });
};
