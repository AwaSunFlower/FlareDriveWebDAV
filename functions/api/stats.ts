import {
  authenticateRequest,
  DriveEnv,
  getEffectivePrivateDirs,
  INTERNAL_PREFIX,
  isPrivatePath,
  isPublicReadEnabled,
  jsonResponse,
  resolveBucket,
  THUMBNAILS_PREFIX,
} from "../../utils/auth";

const FREE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB R2 free tier
const RECENT_GRACE_MS = 5 * 60 * 1000; // Protect thumbnails uploaded in the last 5 minutes
const DELETE_BATCH_SIZE = 1000;

type CategoryKey =
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "document"
  | "code"
  | "other";

const ARCHIVE_EXTS = new Set(["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "tgz"]);
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"]);
const VIDEO_EXTS = new Set(["mp4", "mkv", "mov", "webm", "avi", "flv", "m4v"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "flac", "ogg", "m4a", "aac", "opus"]);
const CODE_EXTS = new Set([
  "js", "ts", "tsx", "jsx", "json", "html", "htm", "css", "scss", "py", "sh",
  "yml", "yaml", "toml", "xml", "sql", "go", "rs", "java", "c", "cpp", "ini", "conf",
]);
const DOC_EXTS = new Set([
  "pdf", "txt", "md", "markdown", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv",
]);

function classifyObject(key: string, contentType?: string): CategoryKey {
  const dot = key.lastIndexOf(".");
  const ext = dot > 0 ? key.slice(dot + 1).toLowerCase() : "";
  const mime = (contentType || "").toLowerCase();

  if (mime.startsWith("image/") || IMAGE_EXTS.has(ext)) return "image";
  if (mime.startsWith("video/") || VIDEO_EXTS.has(ext)) return "video";
  if (mime.startsWith("audio/") || AUDIO_EXTS.has(ext)) return "audio";
  if (ARCHIVE_EXTS.has(ext) || mime.includes("zip") || mime.includes("rar")) {
    return "archive";
  }
  if (CODE_EXTS.has(ext) || mime === "application/json") return "code";
  if (DOC_EXTS.has(ext) || mime === "application/pdf" || mime.startsWith("text/")) {
    return "document";
  }
  return "other";
}

interface ThumbnailRecord {
  key: string;
  name: string;
  size: number;
  uploadedMs: number;
}

async function scanR2Stats(
  bucket: R2Bucket,
  hiddenDirs: string[],
  includeAdminOrphans: boolean
) {
  let totalFiles = 0;
  let totalFolders = 0;
  let totalSize = 0;
  let thumbnailCount = 0;
  let thumbnailSize = 0;

  const categories: Record<CategoryKey, { count: number; size: number }> = {
    image: { count: 0, size: 0 },
    video: { count: 0, size: 0 },
    audio: { count: 0, size: 0 },
    archive: { count: 0, size: 0 },
    document: { count: 0, size: 0 },
    code: { count: 0, size: 0 },
    other: { count: 0, size: 0 },
  };

  const thumbnails: ThumbnailRecord[] = [];
  const referencedThumbNames = new Set<string>();
  const largestFiles: Array<{
    key: string;
    name: string;
    size: number;
    uploaded: string;
  }> = [];

  let cursor: string | undefined = undefined;
  let truncated = false;

  do {
    const page = await bucket.list({
      cursor,
      // @ts-ignore
      include: ["httpMetadata", "customMetadata"],
    });

    for (const obj of page.objects) {
      if (obj.key.startsWith(THUMBNAILS_PREFIX)) {
        const name = obj.key.slice(THUMBNAILS_PREFIX.length);
        thumbnailCount += 1;
        thumbnailSize += obj.size;
        if (includeAdminOrphans) {
          thumbnails.push({
            key: obj.key,
            name,
            size: obj.size,
            uploadedMs: obj.uploaded.getTime(),
          });
        }
        continue;
      }

      if (obj.key.startsWith(INTERNAL_PREFIX)) {
        continue;
      }

      // Always track ALL file thumbnail references across the bucket so private folder thumbnails are NEVER treated as orphans!
      const thumbRef = obj.customMetadata?.thumbnail;
      if (thumbRef) {
        referencedThumbNames.add(thumbRef);
        referencedThumbNames.add(
          thumbRef.includes(".") ? thumbRef : `${thumbRef}.png`
        );
      }

      if (hiddenDirs.length > 0 && isPrivatePath(obj.key, hiddenDirs)) {
        continue;
      }

      if (obj.httpMetadata?.contentType === "application/x-directory") {
        totalFolders += 1;
      } else {
        totalFiles += 1;
        totalSize += obj.size;
        const cat = classifyObject(obj.key, obj.httpMetadata?.contentType);
        categories[cat].count += 1;
        categories[cat].size += obj.size;

        if (
          includeAdminOrphans &&
          (largestFiles.length < 5 ||
            obj.size > largestFiles[largestFiles.length - 1].size)
        ) {
          largestFiles.push({
            key: obj.key,
            name: obj.key.split("/").pop() || obj.key,
            size: obj.size,
            uploaded: obj.uploaded.toISOString(),
          });
          largestFiles.sort((a, b) => b.size - a.size);
          if (largestFiles.length > 5) largestFiles.length = 5;
        }
      }
    }

    if (page.truncated) {
      cursor = page.cursor;
      truncated = true;
    } else {
      truncated = false;
    }
  } while (truncated);

  const orphanToDelete: Array<{ key: string; size: number }> = [];
  const orphanSamples: Array<{ name: string; size: number; uploaded: string }> = [];
  let orphanSize = 0;
  let protectedRecentCount = 0;

  if (includeAdminOrphans) {
    const now = Date.now();
    for (const thumb of thumbnails) {
      if (referencedThumbNames.has(thumb.name)) continue;
      if (now - thumb.uploadedMs < RECENT_GRACE_MS) {
        protectedRecentCount += 1;
        continue;
      }
      orphanToDelete.push({ key: thumb.key, size: thumb.size });
      orphanSize += thumb.size;
      if (orphanSamples.length < 20) {
        orphanSamples.push({
          name: thumb.name,
          size: thumb.size,
          uploaded: new Date(thumb.uploadedMs).toISOString(),
        });
      }
    }
  }

  return {
    stats: {
      totalFiles,
      totalFolders,
      totalSize: totalSize + (includeAdminOrphans ? thumbnailSize : 0),
      userFilesSize: totalSize,
      thumbnailCount: includeAdminOrphans ? thumbnailCount : 0,
      thumbnailSize: includeAdminOrphans ? thumbnailSize : 0,
      orphanThumbnails: includeAdminOrphans
        ? {
            count: orphanToDelete.length,
            size: orphanSize,
            protectedRecentCount,
            samples: orphanSamples,
          }
        : null,
      largestFiles: includeAdminOrphans ? largestFiles : [],
      quotaBytes: FREE_QUOTA_BYTES,
      categories,
      includesPrivate: includeAdminOrphans,
    },
    orphanToDelete,
  };
}

export const onRequestGet: PagesFunction<DriveEnv> = async ({
  request,
  env,
}) => {
  const auth = await authenticateRequest(request, env);
  if (!auth.authenticated && !isPublicReadEnabled(env)) {
    return jsonResponse({ error: "未登录" }, 401);
  }

  const bucket = resolveBucket(request, env);
  if (!bucket) {
    return jsonResponse({ error: "未绑定 R2 存储桶" }, 500);
  }

  const hiddenDirs = auth.authenticated
    ? []
    : await getEffectivePrivateDirs(bucket, env);

  const { stats } = await scanR2Stats(bucket, hiddenDirs, auth.authenticated);
  return jsonResponse(stats);
};

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

  const { orphanToDelete } = await scanR2Stats(bucket, [], true);
  let deletedCount = 0;
  let freedBytes = 0;

  for (let i = 0; i < orphanToDelete.length; i += DELETE_BATCH_SIZE) {
    const batch = orphanToDelete.slice(i, i + DELETE_BATCH_SIZE);
    await bucket.delete(batch.map((item) => item.key));
    deletedCount += batch.length;
    for (const item of batch) freedBytes += item.size;
  }

  const { stats } = await scanR2Stats(bucket, [], true);
  return jsonResponse({ deletedCount, freedBytes, stats });
};
