import React from "react";
import { Box, useTheme } from "@mui/material";
import AudioFileRoundedIcon from "@mui/icons-material/AudioFileRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import FolderZipRoundedIcon from "@mui/icons-material/FolderZipRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import VideoFileRoundedIcon from "@mui/icons-material/VideoFileRounded";

export type FileCategory =
  | "folder"
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "archive"
  | "code"
  | "document"
  | "other";

const ARCHIVE_EXTS = new Set([
  "zip",
  "rar",
  "7z",
  "tar",
  "gz",
  "bz2",
  "xz",
  "tgz",
]);

const IMAGE_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
  "avif",
]);

const VIDEO_EXTS = new Set(["mp4", "mkv", "mov", "webm", "avi", "flv", "m4v"]);

const AUDIO_EXTS = new Set(["mp3", "wav", "flac", "ogg", "m4a", "aac", "opus"]);

const CODE_EXTS = new Set([
  "js",
  "ts",
  "tsx",
  "jsx",
  "json",
  "html",
  "htm",
  "css",
  "scss",
  "py",
  "sh",
  "bash",
  "yml",
  "yaml",
  "toml",
  "xml",
  "sql",
  "go",
  "rs",
  "java",
  "c",
  "cpp",
  "h",
  "ini",
  "conf",
]);

const DOC_EXTS = new Set([
  "txt",
  "md",
  "markdown",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "csv",
  "rtf",
]);

export function getFileExtension(filename?: string): string {
  if (!filename) return "";
  const clean = filename.replace(/\/$/, "");
  const dotIndex = clean.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === clean.length - 1) return "";
  return clean.slice(dotIndex + 1).toLowerCase();
}

export function getFileCategory(
  contentType?: string,
  filename?: string
): FileCategory {
  if (contentType === "application/x-directory") return "folder";

  const ext = getFileExtension(filename);
  const mime = typeof contentType === "string" ? contentType.toLowerCase() : "";

  if (mime.startsWith("image/") || IMAGE_EXTS.has(ext)) return "image";
  if (mime.startsWith("video/") || VIDEO_EXTS.has(ext)) return "video";
  if (mime.startsWith("audio/") || AUDIO_EXTS.has(ext)) return "audio";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (
    ARCHIVE_EXTS.has(ext) ||
    [
      "application/zip",
      "application/gzip",
      "application/x-rar-compressed",
      "application/vnd.rar",
      "application/x-7z-compressed",
      "application/x-tar",
    ].includes(mime)
  ) {
    return "archive";
  }
  if (CODE_EXTS.has(ext) || mime === "application/json") return "code";
  if (DOC_EXTS.has(ext) || mime.startsWith("text/")) return "document";
  return "other";
}

export function isImageFile(contentType?: string, filename?: string): boolean {
  return getFileCategory(contentType, filename) === "image";
}

export function isPreviewableMedia(
  contentType?: string,
  filename?: string
): boolean {
  const category = getFileCategory(contentType, filename);
  return (
    category === "image" ||
    category === "video" ||
    category === "audio" ||
    category === "pdf"
  );
}

const EDITABLE_TEXT_EXTS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "js",
  "ts",
  "tsx",
  "jsx",
  "css",
  "scss",
  "html",
  "htm",
  "xml",
  "yml",
  "yaml",
  "toml",
  "ini",
  "conf",
  "cfg",
  "env",
  "sh",
  "bash",
  "py",
  "sql",
  "csv",
  "log",
  "go",
  "rs",
  "java",
  "c",
  "cpp",
  "h",
]);

export function isEditableTextFile(
  contentType?: string,
  filename?: string
): boolean {
  if (contentType === "application/x-directory") return false;
  const ext = getFileExtension(filename);
  if (EDITABLE_TEXT_EXTS.has(ext)) return true;
  const mime = typeof contentType === "string" ? contentType.toLowerCase() : "";
  return (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/javascript" ||
    mime === "application/xml"
  );
}

export function getMimeTypeForFilename(filename: string): string {
  const ext = getFileExtension(filename);
  switch (ext) {
    case "md":
    case "markdown":
      return "text/markdown; charset=utf-8";
    case "json":
      return "application/json; charset=utf-8";
    case "js":
    case "jsx":
      return "application/javascript; charset=utf-8";
    case "ts":
    case "tsx":
      return "text/typescript; charset=utf-8";
    case "html":
    case "htm":
      return "text/html; charset=utf-8";
    case "css":
      return "text/css; charset=utf-8";
    case "xml":
      return "application/xml; charset=utf-8";
    case "csv":
      return "text/csv; charset=utf-8";
    default:
      return "text/plain; charset=utf-8";
  }
}

const CATEGORY_STYLE: Record<
  FileCategory,
  {
    colorLight: string;
    bgLight: string;
    colorDark: string;
    bgDark: string;
    label: string;
  }
> = {
  folder: {
    colorLight: "#D97706",
    bgLight: "rgba(251, 191, 36, 0.22)",
    colorDark: "#FBBF24",
    bgDark: "rgba(251, 191, 36, 0.16)",
    label: "文件夹",
  },
  image: {
    colorLight: "#059669",
    bgLight: "rgba(16, 185, 129, 0.14)",
    colorDark: "#34D399",
    bgDark: "rgba(16, 185, 129, 0.16)",
    label: "图片",
  },
  video: {
    colorLight: "#E11D48",
    bgLight: "rgba(244, 63, 94, 0.13)",
    colorDark: "#FB7185",
    bgDark: "rgba(244, 63, 94, 0.16)",
    label: "视频",
  },
  audio: {
    colorLight: "#7C3AED",
    bgLight: "rgba(139, 92, 246, 0.13)",
    colorDark: "#A78BFA",
    bgDark: "rgba(139, 92, 246, 0.16)",
    label: "音频",
  },
  pdf: {
    colorLight: "#DC2626",
    bgLight: "rgba(239, 68, 68, 0.13)",
    colorDark: "#F87171",
    bgDark: "rgba(239, 68, 68, 0.16)",
    label: "PDF",
  },
  archive: {
    colorLight: "#EA580C",
    bgLight: "rgba(249, 115, 22, 0.15)",
    colorDark: "#FB923C",
    bgDark: "rgba(249, 115, 22, 0.17)",
    label: "压缩包",
  },
  code: {
    colorLight: "#0284C7",
    bgLight: "rgba(14, 165, 233, 0.13)",
    colorDark: "#38BDF8",
    bgDark: "rgba(14, 165, 233, 0.16)",
    label: "代码",
  },
  document: {
    colorLight: "#4F46E5",
    bgLight: "rgba(99, 102, 241, 0.13)",
    colorDark: "#818CF8",
    bgDark: "rgba(99, 102, 241, 0.16)",
    label: "文档",
  },
  other: {
    colorLight: "#78716C",
    bgLight: "rgba(120, 113, 108, 0.12)",
    colorDark: "#A8A29E",
    bgDark: "rgba(168, 162, 158, 0.15)",
    label: "文件",
  },
};

export function getFileBadgeLabel(
  contentType?: string,
  filename?: string
): string {
  const category = getFileCategory(contentType, filename);
  if (category === "folder") return "文件夹";
  const ext = getFileExtension(filename);
  if (ext && ext.length <= 6) return ext.toUpperCase();
  return CATEGORY_STYLE[category].label;
}

function MimeIcon({
  contentType,
  filename,
  size = "medium",
}: {
  contentType: string;
  filename?: string;
  size?: "small" | "medium";
}) {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";
  const category = getFileCategory(contentType, filename);
  const style = CATEGORY_STYLE[category];

  const iconColor = isLight ? style.colorLight : style.colorDark;
  const bgColor = isLight ? style.bgLight : style.bgDark;
  const boxSize = size === "small" ? 38 : 46;
  const iconSize = size === "small" ? 21 : 25;

  const iconProps = { sx: { fontSize: iconSize, color: iconColor } };

  let IconElement: React.ReactNode;
  switch (category) {
    case "folder":
      IconElement = <FolderRoundedIcon {...iconProps} />;
      break;
    case "image":
      IconElement = <ImageRoundedIcon {...iconProps} />;
      break;
    case "video":
      IconElement = <VideoFileRoundedIcon {...iconProps} />;
      break;
    case "audio":
      IconElement = <AudioFileRoundedIcon {...iconProps} />;
      break;
    case "pdf":
      IconElement = <PictureAsPdfRoundedIcon {...iconProps} />;
      break;
    case "archive":
      IconElement = <FolderZipRoundedIcon {...iconProps} />;
      break;
    case "code":
      IconElement = <CodeRoundedIcon {...iconProps} />;
      break;
    case "document":
      IconElement = <DescriptionRoundedIcon {...iconProps} />;
      break;
    default:
      IconElement = <InsertDriveFileRoundedIcon {...iconProps} />;
      break;
  }

  return (
    <Box
      sx={{
        width: boxSize,
        height: boxSize,
        borderRadius: size === "small" ? "11px" : "14px",
        backgroundColor: bgColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: "transform 0.2s ease",
      }}
    >
      {IconElement}
    </Box>
  );
}

export default MimeIcon;
