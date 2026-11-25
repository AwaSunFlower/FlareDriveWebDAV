import {
  buildClearSessionCookie,
  DriveEnv,
  jsonResponse,
} from "../../../utils/auth";

export const onRequestPost: PagesFunction<DriveEnv> = async ({ request }) => {
  return jsonResponse(
    { ok: true },
    200,
    { "Set-Cookie": buildClearSessionCookie(request) }
  );
};
