export interface DriveEnv {
  WEBDAV_USERNAME?: string;
  WEBDAV_PASSWORD?: string;
  WEBDAV_PUBLIC_READ?: string;
  GUEST_ALLOW_FILE_READ?: string;
  AUTH_SECRET?: string;
  PRIVATE_DIRS?: string;
  SESSION_TTL_DAYS?: string;
  BUCKET?: R2Bucket;
  [key: string]: unknown;
}

export type ShareScope = "file" | "dir";

export interface VerifiedSharePayload {
  key: string;
  scope: ShareScope;
  expiresAt: number;
}

export interface AuthResult {
  authenticated: boolean;
  username: string | null;
  method: "cookie" | "basic" | null;
}

export interface DriveConfig {
  privateDirs: string[];
}

export const SESSION_COOKIE_NAME = "sf_session";
export const INTERNAL_PREFIX = "_$flaredrive$/";
export const THUMBNAILS_PREFIX = "_$flaredrive$/thumbnails/";
export const CONFIG_OBJECT_KEY = "_$flaredrive$/config.json";

const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const SHORT_SESSION_TTL_SECONDS = 24 * 60 * 60; // 1 day
const MAX_SHARE_TTL_SECONDS = 3650 * 24 * 60 * 60; // 10 years for long-term share links

// In-memory per-isolate login rate limiter
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const MAX_TRACKED_IPS = 1000;

interface RateLimitEntry {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();

function pruneRateLimitMap(now: number) {
  if (loginAttempts.size <= MAX_TRACKED_IPS) return;
  for (const [ip, entry] of loginAttempts.entries()) {
    if (
      now - entry.firstFailureAt > RATE_LIMIT_WINDOW_MS &&
      now > entry.lockedUntil
    ) {
      loginAttempts.delete(ip);
    }
  }
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function checkLoginRateLimit(ip: string): {
  allowed: boolean;
  retryAfterSeconds: number;
  remainingAttempts: number;
} {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
    };
  }

  if (entry.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
      remainingAttempts: 0,
    };
  }

  if (now - entry.firstFailureAt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.delete(ip);
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - entry.failures),
  };
}

export function recordLoginFailure(ip: string): {
  locked: boolean;
  retryAfterSeconds: number;
  remainingAttempts: number;
} {
  const now = Date.now();
  pruneRateLimitMap(now);

  const existing = loginAttempts.get(ip);
  let entry: RateLimitEntry;

  if (!existing || now - existing.firstFailureAt > RATE_LIMIT_WINDOW_MS) {
    entry = { failures: 1, firstFailureAt: now, lockedUntil: 0 };
  } else {
    entry = {
      ...existing,
      failures: existing.failures + 1,
    };
  }

  if (entry.failures >= MAX_FAILED_ATTEMPTS) {
    const over = entry.failures - MAX_FAILED_ATTEMPTS;
    const cooldownSeconds = Math.min(900, 60 * Math.pow(3, Math.min(over, 3)));
    entry.lockedUntil = now + cooldownSeconds * 1000;
    loginAttempts.set(ip, entry);
    return {
      locked: true,
      retryAfterSeconds: cooldownSeconds,
      remainingAttempts: 0,
    };
  }

  loginAttempts.set(ip, entry);
  return {
    locked: false,
    retryAfterSeconds: 0,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - entry.failures),
  };
}

export function resetLoginFailures(ip: string) {
  loginAttempts.delete(ip);
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(str: string): Uint8Array | null {
  try {
    const normalized = str.replace(/-/g, "+").replace(/_/g, "/");
    const padded =
      normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", textEncoder.encode(a)),
    crypto.subtle.digest("SHA-256", textEncoder.encode(b)),
  ]);
  const bytesA = new Uint8Array(hashA);
  const bytesB = new Uint8Array(hashB);
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
}

function getSigningSecret(env: DriveEnv, purpose: "session" | "share"): string {
  const baseSecret =
    env.AUTH_SECRET ||
    `sunflower-drive-v1:${env.WEBDAV_USERNAME ?? ""}:${env.WEBDAV_PASSWORD ?? ""}`;
  return `${purpose}:${baseSecret}`;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signPayload(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const payloadBytes = textEncoder.encode(JSON.stringify(payload));
  const encodedPayload = bytesToBase64Url(payloadBytes);
  const key = await importHmacKey(secret);
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(encodedPayload)
  );
  const encodedSig = bytesToBase64Url(new Uint8Array(sigBuffer));
  return `${encodedPayload}.${encodedSig}`;
}

async function verifyPayload<T>(
  token: string,
  secret: string
): Promise<T | null> {
  const dotIndex = token.indexOf(".");
  if (dotIndex <= 0 || dotIndex !== token.lastIndexOf(".")) return null;

  const encodedPayload = token.slice(0, dotIndex);
  const encodedSig = token.slice(dotIndex + 1);
  const sigBytes = base64UrlToBytes(encodedSig);
  if (!sigBytes) return null;

  const key = await importHmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    textEncoder.encode(encodedPayload)
  );
  if (!valid) return null;

  const payloadBytes = base64UrlToBytes(encodedPayload);
  if (!payloadBytes) return null;

  try {
    return JSON.parse(textDecoder.decode(payloadBytes)) as T;
  } catch {
    return null;
  }
}

export function isAuthConfigured(env: DriveEnv): boolean {
  return Boolean(env.WEBDAV_USERNAME && env.WEBDAV_PASSWORD);
}

export function isPublicReadEnabled(env: DriveEnv): boolean {
  return env.WEBDAV_PUBLIC_READ === "1";
}

export function isGuestFileLockEnabled(env: DriveEnv): boolean {
  return env.GUEST_ALLOW_FILE_READ !== "1";
}

export async function verifyCredentials(
  env: DriveEnv,
  username: string,
  password: string
): Promise<boolean> {
  if (!isAuthConfigured(env)) return false;
  const [userOk, passOk] = await Promise.all([
    timingSafeEqual(username, env.WEBDAV_USERNAME!),
    timingSafeEqual(password, env.WEBDAV_PASSWORD!),
  ]);
  return userOk && passOk;
}

export async function createSessionToken(
  env: DriveEnv,
  username: string,
  remember: boolean
): Promise<{ token: string; maxAge: number; expiresAt: number }> {
  const customDays = Number(env.SESSION_TTL_DAYS);
  const longTtl =
    Number.isFinite(customDays) && customDays > 0 && customDays <= 30
      ? Math.floor(customDays * 24 * 60 * 60)
      : DEFAULT_SESSION_TTL_SECONDS;
  const maxAge = remember ? longTtl : SHORT_SESSION_TTL_SECONDS;
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + maxAge;

  const token = await signPayload(
    { u: username, iat: nowSec, exp, v: 1 },
    getSigningSecret(env, "session")
  );
  return { token, maxAge, expiresAt: exp * 1000 };
}

export function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get("Cookie");
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const value = part.slice(eqIdx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

export function buildSessionCookie(
  request: Request,
  token: string,
  maxAge: number
): string {
  const isHttps = new URL(request.url).protocol === "https:";
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (isHttps) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearSessionCookie(request: Request): string {
  return buildSessionCookie(request, "", 0);
}

export async function authenticateRequest(
  request: Request,
  env: DriveEnv
): Promise<AuthResult> {
  if (!isAuthConfigured(env)) {
    return { authenticated: false, username: null, method: null };
  }

  // 1. Check signed HttpOnly session cookie
  const cookies = parseCookies(request);
  const sessionToken = cookies[SESSION_COOKIE_NAME];
  if (sessionToken) {
    const payload = await verifyPayload<{ u?: string; exp?: number }>(
      sessionToken,
      getSigningSecret(env, "session")
    );
    const nowSec = Math.floor(Date.now() / 1000);
    if (
      payload &&
      typeof payload.u === "string" &&
      typeof payload.exp === "number" &&
      payload.exp > nowSec &&
      (await timingSafeEqual(payload.u, env.WEBDAV_USERNAME!))
    ) {
      return { authenticated: true, username: payload.u, method: "cookie" };
    }
  }

  // 2. Check standard HTTP Basic Auth (for third-party WebDAV clients)
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Basic ")) {
    try {
      const decoded = atob(authHeader.slice(6).trim());
      const colonIdx = decoded.indexOf(":");
      if (colonIdx > 0) {
        const username = decoded.slice(0, colonIdx);
        const password = decoded.slice(colonIdx + 1);
        if (await verifyCredentials(env, username, password)) {
          return { authenticated: true, username, method: "basic" };
        }
      }
    } catch {
      // invalid base64
    }
  }

  return { authenticated: false, username: null, method: null };
}

export async function createShareToken(
  env: DriveEnv,
  key: string,
  expiresInSeconds: number,
  scope: ShareScope = "file"
): Promise<{ token: string; expiresAt: number }> {
  const clampedTtl = Math.max(
    60,
    Math.min(Math.floor(expiresInSeconds), MAX_SHARE_TTL_SECONDS)
  );
  const exp = Math.floor(Date.now() / 1000) + clampedTtl;
  const normalizedKey = normalizeDrivePath(key);
  const token = await signPayload(
    { k: normalizedKey, t: scope, exp, v: 2 },
    getSigningSecret(env, "share")
  );
  return { token, expiresAt: exp * 1000 };
}

export async function parseVerifiedShareToken(
  env: DriveEnv,
  token: string
): Promise<VerifiedSharePayload | null> {
  if (!isAuthConfigured(env) || !token) return null;
  const payload = await verifyPayload<{
    k?: string;
    t?: string;
    exp?: number;
  }>(token, getSigningSecret(env, "share"));
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    !payload ||
    typeof payload.k !== "string" ||
    typeof payload.exp !== "number" ||
    payload.exp <= nowSec
  ) {
    return null;
  }
  const scope: ShareScope = payload.t === "dir" ? "dir" : "file";
  const normalizedKey = normalizeDrivePath(payload.k);
  if (!normalizedKey || hasPathTraversal(normalizedKey)) return null;
  return {
    key: normalizedKey,
    scope,
    expiresAt: payload.exp * 1000,
  };
}

export async function isPathAllowedByShare(
  share: VerifiedSharePayload,
  requestedPath: string
): Promise<boolean> {
  const normalizedTarget = normalizeDrivePath(requestedPath);
  if (!normalizedTarget || hasPathTraversal(normalizedTarget)) return false;
  if (share.scope === "file") {
    return timingSafeEqual(share.key, normalizedTarget);
  }
  return (
    normalizedTarget === share.key ||
    normalizedTarget.startsWith(`${share.key}/`)
  );
}

export async function verifyShareToken(
  env: DriveEnv,
  token: string,
  requestedPath: string
): Promise<boolean> {
  const share = await parseVerifiedShareToken(env, token);
  if (!share) return false;
  return isPathAllowedByShare(share, requestedPath);
}

export function normalizeDrivePath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+$/, "").trim();
}

export function hasPathTraversal(path: string): boolean {
  return path
    .split("/")
    .some((segment) => segment === ".." || segment === ".");
}

export function resolveBucket(request: Request, env: DriveEnv): R2Bucket | null {
  const url = new URL(request.url);
  const driveId = url.hostname.replace(/\..*/, "");
  const candidate = (env[driveId] || env.BUCKET) as R2Bucket | undefined;
  return candidate ?? null;
}

export function parseEnvPrivateDirs(env: DriveEnv): string[] {
  if (!env.PRIVATE_DIRS) return [];
  return env.PRIVATE_DIRS.split(/[,\n]/)
    .map((p) => normalizeDrivePath(p))
    .filter((p) => p.length > 0 && !hasPathTraversal(p));
}

export async function readDriveConfig(bucket: R2Bucket): Promise<DriveConfig> {
  try {
    const obj = await bucket.get(CONFIG_OBJECT_KEY);
    if (!obj) return { privateDirs: [] };
    const data = (await obj.json()) as Partial<DriveConfig>;
    const dirs = Array.isArray(data?.privateDirs)
      ? data.privateDirs
          .filter((item): item is string => typeof item === "string")
          .map(normalizeDrivePath)
          .filter((item) => item.length > 0 && !hasPathTraversal(item))
      : [];
    return { privateDirs: Array.from(new Set(dirs)) };
  } catch {
    return { privateDirs: [] };
  }
}

export async function writeDriveConfig(
  bucket: R2Bucket,
  config: DriveConfig
): Promise<void> {
  const cleanDirs = Array.from(
    new Set(
      config.privateDirs
        .map(normalizeDrivePath)
        .filter((item) => item.length > 0 && !hasPathTraversal(item))
    )
  ).sort();
  await bucket.put(
    CONFIG_OBJECT_KEY,
    JSON.stringify({ privateDirs: cleanDirs }, null, 2),
    {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    }
  );
}

export async function getEffectivePrivateDirs(
  bucket: R2Bucket,
  env: DriveEnv
): Promise<string[]> {
  const [config, envDirs] = await Promise.all([
    readDriveConfig(bucket),
    Promise.resolve(parseEnvPrivateDirs(env)),
  ]);
  return Array.from(new Set([...envDirs, ...config.privateDirs])).sort();
}

export function isPrivatePath(path: string, privateDirs: string[]): boolean {
  const normalized = normalizeDrivePath(path);
  if (!normalized || privateDirs.length === 0) return false;
  return privateDirs.some(
    (dir) => normalized === dir || normalized.startsWith(`${dir}/`)
  );
}

export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  return new Response(JSON.stringify(data), { status, headers });
}
