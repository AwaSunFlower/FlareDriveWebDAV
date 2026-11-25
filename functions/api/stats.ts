import {
  authenticateRequest,
  DriveEnv,
  getEffectivePrivateDirs,
  isPrivatePath,
  isPublicReadEnabled,
  jsonResponse,
  resolveBucket,
} from "../../utils/auth";
import { listAll } from "../webdav/utils";

const FREE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB R2 free tier

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

  let totalFiles = 0;
  let totalFolders = 0;
  let totalSize = 0;
  const categories: Record<CategoryKey, { count: number; size: number }> = {
    image: { count: 0, size: 0 },
    video: { count: 0, size: 0 },
    audio: { count: 0, size: 0 },
    archive: { count: 0, size: 0 },
    document: { count: 0, size: 0 },
    code: { count: 0, size: 0 },
    other: { count: 0, size: 0 },
  };

  for await (const obj of listAll(bucket, undefined, true)) {
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
    }
  }

  return jsonResponse({
    totalFiles,
    totalFolders,
    totalSize,
    quotaBytes: FREE_QUOTA_BYTES,
    categories,
    includesPrivate: auth.authenticated,
  });
};
