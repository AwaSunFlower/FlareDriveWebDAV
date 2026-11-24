import React from "react";
import {
  Box,
  Chip,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import MimeIcon, {
  getFileBadgeLabel,
  isEditableTextFile,
  isImageFile,
} from "./MimeIcon";
import { humanReadableSize } from "./app/utils";

export type ViewMode = "grid" | "list";

export interface FileItem {
  key: string;
  size: number;
  uploaded: string;
  httpMetadata: { contentType: string };
  customMetadata?: { thumbnail?: string };
}

export function extractFilename(key: string) {
  return key.replace(/\/$/, "").split("/").pop() ?? key;
}

export function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

export function isDirectory(file: FileItem) {
  return file.httpMetadata?.contentType === "application/x-directory";
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

interface FileGridProps {
  files: FileItem[];
  viewMode: ViewMode;
  onCwdChange: (newCwd: string) => void;
  multiSelected: string[] | null;
  onMultiSelect: (key: string) => void;
  onPreviewImage: (file: FileItem) => void;
  onEditTextFile: (file: FileItem) => void;
  onCopyLink: (file: FileItem) => void;
  emptyMessage?: React.ReactNode;
}

function FileGrid({
  files,
  viewMode,
  onCwdChange,
  multiSelected,
  onMultiSelect,
  onPreviewImage,
  onEditTextFile,
  onCopyLink,
  emptyMessage,
}: FileGridProps) {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";

  if (files.length === 0) {
    return <>{emptyMessage ?? null}</>;
  }

  const handleOpenItem = (file: FileItem) => {
    const filename = extractFilename(file.key);
    if (multiSelected !== null) {
      onMultiSelect(file.key);
    } else if (isDirectory(file)) {
      onCwdChange(file.key.replace(/\/$/, "") + "/");
    } else if (isImageFile(file.httpMetadata?.contentType, filename)) {
      onPreviewImage(file);
    } else {
      window.open(
        `/webdav/${encodeKey(file.key)}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  const renderIcon = (file: FileItem, size: "small" | "medium") => {
    const filename = extractFilename(file.key);
    const boxSize = size === "small" ? 38 : 46;
    if (file.customMetadata?.thumbnail) {
      return (
        <Box
          component="img"
          src={`/webdav/_$flaredrive$/thumbnails/${file.customMetadata.thumbnail}.png`}
          alt={filename}
          sx={{
            width: boxSize,
            height: boxSize,
            borderRadius: size === "small" ? "10px" : "13px",
            objectFit: "cover",
            flexShrink: 0,
            border: "1px solid",
            borderColor: "divider",
          }}
        />
      );
    }
    return (
      <MimeIcon
        contentType={file.httpMetadata?.contentType ?? ""}
        filename={filename}
        size={size}
      />
    );
  };

  if (viewMode === "list") {
    return (
      <Paper
        elevation={0}
        sx={{
          borderRadius: "18px",
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
          backgroundColor: "background.paper",
          boxShadow: isLight
            ? "0 4px 20px rgba(120, 53, 15, 0.04)"
            : "0 4px 20px rgba(0, 0, 0, 0.25)",
          mb: 4,
        }}
      >
        {/* List Header */}
        <Box
          sx={{
            display: { xs: "none", sm: "grid" },
            gridTemplateColumns: "minmax(0, 1fr) 92px 156px 96px 118px",
            alignItems: "center",
            gap: 2,
            px: 2.5,
            py: 1.25,
            borderBottom: "1px solid",
            borderColor: "divider",
            backgroundColor: isLight
              ? "rgba(251, 191, 36, 0.06)"
              : "rgba(251, 191, 36, 0.04)",
          }}
        >
          <Typography variant="caption" fontWeight={700} color="text.secondary">
            名称
          </Typography>
          <Typography variant="caption" fontWeight={700} color="text.secondary">
            类型
          </Typography>
          <Typography variant="caption" fontWeight={700} color="text.secondary">
            修改时间
          </Typography>
          <Typography
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            textAlign="right"
          >
            大小
          </Typography>
          <Typography
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            textAlign="right"
          >
            操作
          </Typography>
        </Box>

        {/* Rows */}
        {files.map((file, idx) => {
          const filename = extractFilename(file.key);
          const dir = isDirectory(file);
          const editableText =
            !dir &&
            isEditableTextFile(file.httpMetadata?.contentType, filename);
          const selected = Boolean(multiSelected?.includes(file.key));
          const badgeLabel = getFileBadgeLabel(
            file.httpMetadata?.contentType,
            filename
          );

          return (
            <Box
              key={file.key}
              onClick={() => handleOpenItem(file)}
              onContextMenu={(e) => {
                e.preventDefault();
                onMultiSelect(file.key);
              }}
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr) auto",
                  sm: "minmax(0, 1fr) 92px 156px 96px 118px",
                },
                alignItems: "center",
                gap: { xs: 1.25, sm: 2 },
                px: { xs: 1.75, sm: 2.5 },
                py: 1.35,
                cursor: "pointer",
                userSelect: "none",
                borderBottom: idx === files.length - 1 ? "none" : "1px solid",
                borderColor: "divider",
                backgroundColor: selected
                  ? isLight
                    ? "rgba(251, 191, 36, 0.14)"
                    : "rgba(251, 191, 36, 0.12)"
                  : "transparent",
                transition: "background-color 0.16s ease",
                "&:hover": {
                  backgroundColor: selected
                    ? isLight
                      ? "rgba(251, 191, 36, 0.18)"
                      : "rgba(251, 191, 36, 0.16)"
                    : isLight
                    ? "rgba(251, 191, 36, 0.06)"
                    : "rgba(255, 255, 255, 0.03)",
                },
              }}
            >
              {/* Name */}
              <Stack
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{ minWidth: 0 }}
              >
                {renderIcon(file, "small")}
                <Box sx={{ minWidth: 0 }}>
                  <Tooltip title={filename} enterDelay={500}>
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ fontWeight: 600, color: "text.primary" }}
                    >
                      {filename}
                    </Typography>
                  </Tooltip>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: { xs: "block", sm: "none" } }}
                  >
                    {formatDateTime(file.uploaded)}
                    {!dir ? ` · ${humanReadableSize(file.size)}` : ""}
                  </Typography>
                </Box>
              </Stack>

              {/* Type */}
              <Box sx={{ display: { xs: "none", sm: "block" } }}>
                <Chip
                  label={badgeLabel}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    backgroundColor: isLight
                      ? "rgba(180, 83, 9, 0.07)"
                      : "rgba(251, 191, 36, 0.09)",
                    color: "text.secondary",
                    "& .MuiChip-label": { px: 1 },
                  }}
                />
              </Box>

              {/* Date */}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: { xs: "none", sm: "block" },
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatDateTime(file.uploaded)}
              </Typography>

              {/* Size */}
              <Typography
                variant="caption"
                color="text.secondary"
                textAlign="right"
                sx={{
                  display: { xs: "none", sm: "block" },
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 500,
                }}
              >
                {dir ? "—" : humanReadableSize(file.size)}
              </Typography>

              {/* Quick Actions */}
              <Stack
                direction="row"
                justifyContent="flex-end"
                alignItems="center"
                spacing={0.25}
              >
                {editableText && (
                  <Tooltip title="在 TextPad 中编辑">
                    <IconButton
                      size="small"
                      aria-label="在线编辑"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTextFile(file);
                      }}
                      sx={{
                        color: "text.secondary",
                        "&:hover": { color: "primary.main" },
                      }}
                    >
                      <EditNoteRoundedIcon sx={{ fontSize: 19 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {!dir && (
                  <>
                    <Tooltip title="复制直链">
                      <IconButton
                        size="small"
                        aria-label="复制直链"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopyLink(file);
                        }}
                        sx={{ color: "text.secondary" }}
                      >
                        <LinkRoundedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="下载">
                      <IconButton
                        size="small"
                        aria-label="下载"
                        component="a"
                        href={`/webdav/${encodeKey(file.key)}`}
                        download={filename}
                        onClick={(e) => e.stopPropagation()}
                        sx={{
                          display: { xs: "none", sm: "inline-flex" },
                          color: "text.secondary",
                        }}
                      >
                        <DownloadRoundedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
                <Tooltip title={selected ? "取消选择" : "选择"}>
                  <IconButton
                    size="small"
                    aria-label={selected ? "取消选择" : "选择"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMultiSelect(file.key);
                    }}
                    sx={{
                      color: selected ? "primary.main" : "text.secondary",
                    }}
                  >
                    {selected ? (
                      <CheckCircleRoundedIcon sx={{ fontSize: 18 }} />
                    ) : (
                      <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          );
        })}
      </Paper>
    );
  }

  // Grid Card View
  return (
    <Grid container spacing={2} sx={{ pb: 5 }}>
      {files.map((file) => {
        const filename = extractFilename(file.key);
        const dir = isDirectory(file);
        const editableText =
          !dir && isEditableTextFile(file.httpMetadata?.contentType, filename);
        const selected = Boolean(multiSelected?.includes(file.key));
        const badgeLabel = getFileBadgeLabel(
          file.httpMetadata?.contentType,
          filename
        );

        return (
          <Grid item key={file.key} xs={12} sm={6} md={4} lg={3}>
            <Paper
              elevation={0}
              onClick={() => handleOpenItem(file)}
              onContextMenu={(e) => {
                e.preventDefault();
                onMultiSelect(file.key);
              }}
              sx={{
                position: "relative",
                p: 2,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 1.75,
                borderRadius: "18px",
                cursor: "pointer",
                userSelect: "none",
                backgroundColor: selected
                  ? isLight
                    ? "#FFFBEB"
                    : "rgba(251, 191, 36, 0.11)"
                  : "background.paper",
                border: selected ? "1.5px solid" : "1px solid",
                borderColor: selected
                  ? "primary.main"
                  : isLight
                  ? "rgba(180, 83, 9, 0.11)"
                  : "rgba(251, 191, 36, 0.10)",
                boxShadow: selected
                  ? isLight
                    ? "0 8px 22px -6px rgba(217, 119, 6, 0.24)"
                    : "0 8px 24px -6px rgba(251, 191, 36, 0.18)"
                  : isLight
                  ? "0 2px 10px rgba(120, 53, 15, 0.04)"
                  : "0 2px 12px rgba(0, 0, 0, 0.25)",
                transition:
                  "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease",
                "&:hover": {
                  transform: "translateY(-3px)",
                  borderColor: isLight
                    ? "rgba(217, 119, 6, 0.42)"
                    : "rgba(251, 191, 36, 0.4)",
                  boxShadow: isLight
                    ? "0 14px 28px -10px rgba(180, 83, 9, 0.18)"
                    : "0 14px 30px -8px rgba(0, 0, 0, 0.48)",
                  "& .sf-card-actions": {
                    opacity: 1,
                  },
                },
              }}
            >
              {/* Top Row: Icon + Hover Actions */}
              <Stack
                direction="row"
                alignItems="flex-start"
                justifyContent="space-between"
                spacing={1}
              >
                {renderIcon(file, "medium")}

                <Stack
                  direction="row"
                  spacing={0.25}
                  className="sf-card-actions"
                  sx={{
                    opacity: selected || multiSelected !== null ? 1 : { xs: 0.72, sm: 0 },
                    transition: "opacity 0.18s ease",
                  }}
                >
                  {editableText && (
                    <Tooltip title="在 TextPad 中编辑">
                      <IconButton
                        size="small"
                        aria-label="在线编辑"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditTextFile(file);
                        }}
                        sx={{
                          p: 0.5,
                          color: "text.secondary",
                          "&:hover": { color: "primary.main" },
                        }}
                      >
                        <EditNoteRoundedIcon sx={{ fontSize: 19 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {!dir && (
                    <Tooltip title="复制直链">
                      <IconButton
                        size="small"
                        aria-label="复制直链"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopyLink(file);
                        }}
                        sx={{
                          p: 0.5,
                          color: "text.secondary",
                          "&:hover": { color: "primary.main" },
                        }}
                      >
                        <LinkRoundedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title={selected ? "取消选择" : "选择"}>
                    <IconButton
                      size="small"
                      aria-label={selected ? "取消选择" : "选择"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMultiSelect(file.key);
                      }}
                      sx={{
                        p: 0.5,
                        color: selected ? "primary.main" : "text.secondary",
                        "&:hover": { color: "primary.main" },
                      }}
                    >
                      {selected ? (
                        <CheckCircleRoundedIcon sx={{ fontSize: 19 }} />
                      ) : (
                        <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 19 }} />
                      )}
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>

              {/* Middle: Filename */}
              <Box sx={{ minWidth: 0 }}>
                <Tooltip title={filename} enterDelay={500}>
                  <Typography
                    variant="subtitle2"
                    noWrap
                    sx={{
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color: "text.primary",
                      lineHeight: 1.4,
                    }}
                  >
                    {filename}
                  </Typography>
                </Tooltip>
              </Box>

              {/* Bottom Meta Row */}
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
                sx={{
                  pt: 1.15,
                  borderTop: "1px dashed",
                  borderColor: "divider",
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.85}
                  sx={{ minWidth: 0 }}
                >
                  <Chip
                    label={badgeLabel}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: "0.67rem",
                      fontWeight: 700,
                      borderRadius: "7px",
                      backgroundColor: dir
                        ? isLight
                          ? "rgba(251, 191, 36, 0.18)"
                          : "rgba(251, 191, 36, 0.14)"
                        : isLight
                        ? "rgba(120, 113, 108, 0.09)"
                        : "rgba(255, 255, 255, 0.08)",
                      color: dir
                        ? isLight
                          ? "#B45309"
                          : "#FCD34D"
                        : "text.secondary",
                      "& .MuiChip-label": { px: 0.8 },
                    }}
                  />
                  <Typography
                    variant="caption"
                    noWrap
                    color="text.secondary"
                    sx={{
                      fontSize: "0.73rem",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatDateTime(file.uploaded)}
                  </Typography>
                </Stack>

                {!dir && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      flexShrink: 0,
                      fontSize: "0.73rem",
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {humanReadableSize(file.size)}
                  </Typography>
                )}
              </Stack>
            </Paper>
          </Grid>
        );
      })}
    </Grid>
  );
}

export default FileGrid;
