import {
  authenticateRequest,
  DriveEnv,
  getEffectivePrivateDirs,
  hasPathTraversal,
  INTERNAL_PREFIX,
  isAuthConfigured,
  isPrivatePath,
  isPublicReadEnabled,
  THUMBNAILS_PREFIX,
  verifyShareToken,
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

function unauthorizedResponse(request: Request): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
  });
  // Suppress native browser Basic Auth prompt for our SPA fetch calls,
  // while keeping RFC-compliant Basic Auth challenge for WebDAV clients.
  if (request.headers.get("X-Requested-With") !== "SunflowerDrive") {
    headers.set("WWW-Authenticate", 'Basic realm="WebDAV"');
  }
  return new Response("Unauthorized", { status: 401, headers });
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
  const shareToken = url.searchParams.get("share");

  let hiddenPrivateDirs: string[] = [];
  let isSharedAccess = false;

  if (!auth.authenticated) {
    // 1. Allow valid signed temporary share link for single-file GET/HEAD
    if (
      shareToken &&
      (method === "GET" || method === "HEAD") &&
      (await verifyShareToken(env, shareToken, path))
    ) {
      isSharedAccess = true;
    } else if (
      isPublicReadEnabled(env) &&
      ["GET", "HEAD", "PROPFIND"].includes(method)
    ) {
      // 2. Public read mode — hide private directories & files from unauthenticated visitors
      hiddenPrivateDirs = await getEffectivePrivateDirs(bucket, env);
      if (path !== "" && isPrivatePath(path, hiddenPrivateDirs)) {
        return notFound();
      }
    } else {
      if (!isAuthConfigured(env)) {
        return new Response("WebDAV protocol is not enabled", { status: 403 });
      }
      return unauthorizedResponse(request);
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
