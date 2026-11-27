export const SPA_REQUEST_HEADERS: Record<string, string> = {
  "X-Requested-With": "SunflowerDrive",
};

export interface AuthStatus {
  authenticated: boolean;
  username: string | null;
  publicRead: boolean;
  authConfigured: boolean;
  guestFileLocked: boolean;
  privateDirs: string[];
}

export interface ShareInfo {
  valid: boolean;
  lockedByPasscode?: boolean;
  requiresPasscode?: boolean;
  key: string;
  rootKey: string;
  name: string;
  scope: "file" | "dir";
  isDirectory: boolean;
  size: number;
  contentType: string;
  uploaded: string;
  expiresAt: number;
}

export interface ActiveDirShare {
  token: string;
  rootDir: string; // normalized without leading/trailing slash
  expiresAt: number;
}

export interface StorageStats {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  userFilesSize?: number;
  thumbnailCount?: number;
  thumbnailSize?: number;
  orphanThumbnails?: {
    count: number;
    size: number;
    protectedRecentCount: number;
    samples: Array<{ name: string; size: number; uploaded: string }>;
  } | null;
  largestFiles?: Array<{
    key: string;
    name: string;
    size: number;
    uploaded: string;
  }>;
  quotaBytes: number;
  includesPrivate: boolean;
  categories: {
    image: { count: number; size: number };
    video: { count: number; size: number };
    audio: { count: number; size: number };
    archive: { count: number; size: number };
    document: { count: number; size: number };
    code: { count: number; size: number };
    other: { count: number; size: number };
  };
}

export class AuthRequiredError extends Error {
  status = 401;
  constructor(message = "需要管理员登录认证") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export function encodeWebdavKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export function buildWebdavUrl(
  key: string,
  options?: { shareToken?: string; download?: boolean }
): string {
  const base = `/webdav/${encodeWebdavKey(key)}`;
  const params = new URLSearchParams();
  if (options?.shareToken) params.set("share", options.shareToken);
  if (options?.download) params.set("download", "1");
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function buildThumbnailUrl(
  thumbnailHash: string,
  fileKey: string,
  shareToken?: string
): string {
  const base = `/webdav/_$flaredrive$/thumbnails/${thumbnailHash}.png`;
  if (!shareToken) return base;
  const params = new URLSearchParams({
    share: shareToken,
    for: fileKey,
  });
  return `${base}?${params.toString()}`;
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const res = await fetch("/api/auth/status", {
    headers: SPA_REQUEST_HEADERS,
    cache: "no-store",
  });
  if (!res.ok) {
    return {
      authenticated: false,
      username: null,
      publicRead: true,
      authConfigured: true,
      guestFileLocked: true,
      privateDirs: [],
    };
  }
  const data = (await res.json()) as Partial<AuthStatus>;
  return {
    authenticated: Boolean(data.authenticated),
    username: data.username ?? null,
    publicRead: data.publicRead !== false,
    authConfigured: data.authConfigured !== false,
    guestFileLocked: data.guestFileLocked !== false,
    privateDirs: Array.isArray(data.privateDirs) ? data.privateDirs : [],
  };
}

export async function loginAdmin(
  username: string,
  password: string,
  remember: boolean
): Promise<{
  ok: true;
  username: string;
  expiresAt: number;
  privateDirs: string[];
}> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...SPA_REQUEST_HEADERS,
    },
    body: JSON.stringify({ username, password, remember }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    username?: string;
    expiresAt?: number;
    privateDirs?: string[];
    error?: string;
  };

  if (!res.ok || !data.ok) {
    throw new Error(data.error || `登录失败 (${res.status})`);
  }

  return {
    ok: true,
    username: data.username || username,
    expiresAt: data.expiresAt || Date.now(),
    privateDirs: Array.isArray(data.privateDirs) ? data.privateDirs : [],
  };
}

export async function logoutAdmin(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    headers: SPA_REQUEST_HEADERS,
  });
}

export async function createSignedShare(
  key: string,
  expiresInSeconds: number,
  download: boolean,
  passcode?: string
): Promise<{
  url: string;
  pageUrl: string;
  directUrl: string | null;
  scope: "file" | "dir";
  expiresAt: number;
  hasPasscode: boolean;
  key: string;
}> {
  const res = await fetch("/api/share", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...SPA_REQUEST_HEADERS,
    },
    body: JSON.stringify({ key, expiresInSeconds, download, passcode }),
  });

  if (res.status === 401) throw new AuthRequiredError();
  const data = (await res.json().catch(() => ({}))) as {
    url?: string;
    pageUrl?: string;
    directUrl?: string | null;
    scope?: "file" | "dir";
    expiresAt?: number;
    hasPasscode?: boolean;
    key?: string;
    error?: string;
  };
  if (!res.ok || (!data.pageUrl && !data.url)) {
    throw new Error(data.error || `生成分享链接失败 (${res.status})`);
  }
  return {
    url: data.url || data.pageUrl!,
    pageUrl: data.pageUrl || data.url!,
    directUrl: data.directUrl ?? null,
    scope: data.scope === "dir" ? "dir" : "file",
    expiresAt: data.expiresAt || Date.now() + expiresInSeconds * 1000,
    hasPasscode: Boolean(data.hasPasscode),
    key: data.key || key,
  };
}

export async function unlockSharePasscode(
  shareToken: string,
  passcode: string
): Promise<void> {
  const res = await fetch("/api/share-info", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...SPA_REQUEST_HEADERS,
    },
    body: JSON.stringify({ share: shareToken, passcode }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "提取码验证失败");
  }
}

export async function fetchShareInfo(
  shareToken: string,
  key?: string
): Promise<ShareInfo> {
  const params = new URLSearchParams({ share: shareToken });
  if (key) params.set("key", key);
  const res = await fetch(`/api/share-info?${params.toString()}`, {
    headers: SPA_REQUEST_HEADERS,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as Partial<ShareInfo> & {
    error?: string;
  };
  if (!res.ok || !data.valid) {
    throw new Error(data.error || "该分享链接无效或已过期");
  }
  return data as ShareInfo;
}

export async function setFolderPrivacy(
  path: string,
  isPrivate: boolean
): Promise<{ ok: true; isPrivate: boolean; privateDirs: string[] }> {
  const res = await fetch("/api/privacy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...SPA_REQUEST_HEADERS,
    },
    body: JSON.stringify({ path, isPrivate }),
  });

  if (res.status === 401) throw new AuthRequiredError();
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    isPrivate?: boolean;
    privateDirs?: string[];
    error?: string;
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `更新私密状态失败 (${res.status})`);
  }
  return {
    ok: true,
    isPrivate: Boolean(data.isPrivate),
    privateDirs: Array.isArray(data.privateDirs) ? data.privateDirs : [],
  };
}

export async function fetchStorageStats(): Promise<StorageStats> {
  const res = await fetch("/api/stats", {
    headers: SPA_REQUEST_HEADERS,
    cache: "no-store",
  });
  if (res.status === 401) throw new AuthRequiredError();
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `获取存储统计失败 (${res.status})`);
  }
  return (await res.json()) as StorageStats;
}

export async function cleanupOrphanThumbnails(): Promise<{
  deletedCount: number;
  freedBytes: number;
  stats: StorageStats;
}> {
  const res = await fetch("/api/stats", {
    method: "POST",
    headers: SPA_REQUEST_HEADERS,
  });
  if (res.status === 401) throw new AuthRequiredError();
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `清理孤儿缩略图失败 (${res.status})`);
  }
  return (await res.json()) as {
    deletedCount: number;
    freedBytes: number;
    stats: StorageStats;
  };
}
