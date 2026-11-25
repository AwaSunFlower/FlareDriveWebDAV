import {
  authenticateRequest,
  DriveEnv,
  getEffectivePrivateDirs,
  hasPathTraversal,
  INTERNAL_PREFIX,
  isAuthConfigured,
  isGuestFileLockEnabled,
  isPathAllowedByShare,
  isPrivatePath,
  isPublicReadEnabled,
  normalizeDrivePath,
  parseVerifiedShareToken,
  THUMBNAILS_PREFIX,
} from "../../utils/auth";
import { notFound, parseBucketPath, RequestHandlerParams } from "./utils";
import { handleRequestCopy } from "./copy";
import { handleRequestDelete } from "./delete";
import { handleRequestGet } from "./get";
import { handleRequestHead } from "./head";
import { handleRequestMkcol } from "./mkcol";
import { handleRequestMove } from "./move";
import { handleRequestPost } from "./post";
import { handleRequestPropfind } from "./propfind";
import { handleRequestPut } from "./put";

async function handleRequestOptions() {
  return new Response(null, {
    headers: {
      Allow: Object.keys(HANDLERS).join(", "),
      DAV: "1",
    },
  });
}

async function handleMethodNotAllowed() {
  return new Response(null, { status: 405 });
}

const HANDLERS: Record<
  string,
  (context: RequestHandlerParams) => Promise<Response>
> = {
  PROPFIND: handleRequestPropfind,
  MKCOL: handleRequestMkcol,
  HEAD: handleRequestHead,
  GET: handleRequestGet,
  POST: handleRequestPost,
  PUT: handleRequestPut,
  COPY: handleRequestCopy,
  MOVE: handleRequestMove,
  DELETE: handleRequestDelete,
};

function unauthorizedResponse(request: Request, message = "Unauthorized"): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
  });
  // Suppress native browser Basic Auth prompt for our SPA fetch calls,
  // while keeping RFC-compliant Basic Auth challenge for WebDAV clients.
  if (request.headers.get("X-Requested-With") !== "SunflowerDrive") {
    headers.set("WWW-Authenticate", 'Basic realm="WebDAV"');
  }
  return new Response(message, { status: 401, headers });
}

export const onRequest: PagesFunction<DriveEnv> = async function (context) {
  const { env } = context;
  const request: Request = context.request;
  const method = request.method;

  if (method === "OPTIONS") return handleRequestOptions();

  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();

  if (hasPathTraversal(path)) {
    return new Response("Bad Request", { status: 400 });
  }

  // Never expose internal configuration objects over WebDAV
  if (path.startsWith(INTERNAL_PREFIX) && !path.startsWith(THUMBNAILS_PREFIX)) {
    return new Response("Forbidden", { status: 403 });
  }

  const auth = await authenticateRequest(request, env);
  const url = new URL(request.url);
  const shareToken = url.searchParams.get("share") || "";

  let hiddenPrivateDirs: string[] = [];
  let isSharedAccess = false;

  if (!auth.authenticated) {
    // 1. Check valid signed share link (file share OR folder share) FIRST
    // so visitors arriving from share links are NEVER isolated or blocked.
    const verifiedShare = shareToken
      ? await parseVerifiedShareToken(env, shareToken)
      : null;

    if (verifiedShare) {
      if (path.startsWith(THUMBNAILS_PREFIX) && (method === "GET" || method === "HEAD")) {
        // Allow loading thumbnails ONLY for files authorized by the share token
        const forKey = normalizeDrivePath(url.searchParams.get("for") || "");
        if (forKey && (await isPathAllowedByShare(verifiedShare, forKey))) {
          const targetObj = await bucket.head(forKey);
          const thumbHash = path
            .slice(THUMBNAILS_PREFIX.length)
            .replace(/\.png$/i, "");
          if (targetObj?.customMetadata?.thumbnail === thumbHash) {
            isSharedAccess = true;
          }
        }
      } else if (
        verifiedShare.scope === "file" &&
        (method === "GET" || method === "HEAD") &&
        (await isPathAllowedByShare(verifiedShare, path))
      ) {
        isSharedAccess = true;
      } else if (
        verifiedShare.scope === "dir" &&
        ["GET", "HEAD", "PROPFIND"].includes(method) &&
        (await isPathAllowedByShare(verifiedShare, path))
      ) {
        isSharedAccess = true;
      }
    }

    if (!isSharedAccess) {
      if (isPublicReadEnabled(env)) {
        hiddenPrivateDirs = await getEffectivePrivateDirs(bucket, env);

        if (method === "PROPFIND") {
          // Guests can browse public folders and see directory listings
          if (path !== "" && isPrivatePath(path, hiddenPrivateDirs)) {
            return notFound();
          }
        } else if (
          (method === "GET" || method === "HEAD") &&
          !isGuestFileLockEnabled(env)
        ) {
          // Optional escape hatch only if GUEST_ALLOW_FILE_READ=1 is explicitly set
          if (path !== "" && isPrivatePath(path, hiddenPrivateDirs)) {
            return notFound();
          }
        } else {
          // Guest file encryption lock: block direct file/thumbnail reads without auth or share token
          if (!isAuthConfigured(env)) {
            return new Response("WebDAV protocol is not enabled", {
              status: 403,
            });
          }
          return unauthorizedResponse(
            request,
            "文件已加密保护，请登录管理员或使用有效分享链接访问"
          );
        }
      } else {
        if (!isAuthConfigured(env)) {
          return new Response("WebDAV protocol is not enabled", { status: 403 });
        }
        return unauthorizedResponse(request);
      }
    }
  }

  const handler = HANDLERS[method] ?? handleMethodNotAllowed;
  return handler({
    bucket,
    path,
    request,
    hiddenPrivateDirs,
    isSharedAccess,
  });
};
