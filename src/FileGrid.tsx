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
import BlurOnRoundedIcon from "@mui/icons-material/BlurOnRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import MimeIcon, {
  getFileBadgeLabel,
  isEditableTextFile,
  isImageFile,
  isPreviewableMedia,
} from "./MimeIcon";
import { buildThumbnailUrl, buildWebdavUrl } from "./app/api";
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

export function isPathInPrivateDirs(key: string, privateDirs: string[]) {
  const normalized = key.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!normalized || !privateDirs.length) return false;
  return privateDirs.some(
    (dir) => normalized === dir || normalized.startsWith(`${dir}/`)
  );
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

const BLUR_PALETTES = [
  "radial-gradient(circle at 22% 30%, #FDE68A 0%, transparent 55%), radial-gradient(circle at 78% 72%, #6EE7B7 0%, transparent 55%), linear-gradient(135deg, #FEF3C7 0%, #D1FAE5 55%, #FDE68A 100%)",
  "radial-gradient(circle at 28% 70%, #FDBA74 0%, transparent 52%), radial-gradient(circle at 76% 24%, #93C5FD 0%, transparent 52%), linear-gradient(135deg, #FFEDD5 0%, #DBEAFE 55%, #FEF08A 100%)",
  "radial-gradient(circle at 30% 25%, #C4B5FD 0%, transparent 55%), radial-gradient(circle at 72% 76%, #FCD34D 0%, transparent 55%), linear-gradient(135deg, #EDE9FE 0%, #FEF3C7 55%, #FCE7F3 100%)",
  "radial-gradient(circle at 24% 65%, #86EFAC 0%, transparent 54%), radial-gradient(circle at 78% 30%, #FCA5A5 0%, transparent 54%), linear-gradient(135deg, #DCFCE7 0%, #FEE2E2 55%, #FEF3C7 100%)",
];

function pickBlurPalette(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return BLUR_PALETTES[hash % BLUR_PALETTES.length];
}

function BlurredImageBanner({
  seed,
  compact = false,
}: {
  seed: string;
  compact?: boolean;
}) {
  const palette = pickBlurPalette(seed);

  if (compact) {
    return (
      <Box
        sx={{
          position: "relative",
          width: 38,
          height: 38,
          borderRadius: "10px",
          overflow: "hidden",
          flexShrink: 0,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: -6,
            background: palette,
            filter: "blur(7px)",
            transform: "scale(1.2)",
          }}
        />
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(28, 25, 23, 0.28)",
            color: "#FFFFFF",
          }}
        >
          <LockRoundedIcon sx={{ fontSize: 16 }} />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      data-testid="blurred-image-mask"
      sx={{
        position: "relative",
        width: "100%",
        height: 82,
        borderRadius: "13px",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      {/* Abstract blurred bokeh background (zero raw image pixels leaked) */}
      <Box
        sx={{
          position: "absolute",
          inset: -14,
          background: palette,
          filter: "blur(14px)",
          transform: "scale(1.25)",
        }}
      />
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.5,
          backgroundColor: "rgba(24, 21, 18, 0.26)",
          backdropFilter: "blur(6px)",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.6}
          sx={{
            px: 1.25,
            py: 0.4,
            borderRadius: "999px",
            backgroundColor: "rgba(24, 21, 18, 0.56)",
            color: "#FEF3C7",
            backdropFilter: "blur(8px)",
          }}
        >
          <BlurOnRoundedIcon sx={{ fontSize: 15 }} />
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, fontSize: "0.7rem", color: "#FEF3C7" }}
          >
            图片已模糊加密
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

interface FileGridProps {
  files: FileItem[];
  viewMode: ViewMode;
  authenticated: boolean;
  guestLocked: boolean;
  shareToken?: string;
  privateDirs: string[];
  onCwdChange: (newCwd: string) => void;
  multiSelected: string[] | null;
  onMultiSelect: (key: string) => void;
  onPreviewMedia: (file: FileItem) => void;
  onEditTextFile: (file: FileItem) => void;
  onOpenShare: (file: FileItem) => void;
  onTogglePrivacy: (folderPath: string, nextPrivate: boolean) => void;
  onLockedFileClick: (file: FileItem) => void;
  emptyMessage?: React.ReactNode;
}

function FileGrid({
  files,
  viewMode,
  authenticated,
  guestLocked,
  shareToken,
  privateDirs,
  onCwdChange,
  multiSelected,
  onMultiSelect,
  onPreviewMedia,
  onEditTextFile,
  onOpenShare,
  onTogglePrivacy,
  onLockedFileClick,
  emptyMessage,
}: FileGridProps) {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";

  if (files.length === 0) {
    return <>{emptyMessage ?? null}</>;
  }

  const handleOpenItem = (file: FileItem) => {
    const filename = extractFilename(file.key);
    const dir = isDirectory(file);

    if (!dir && guestLocked) {
      onLockedFileClick(file);
      return;
    }

    if (multiSelected !== null) {
      onMultiSelect(file.key);
    } else if (dir) {
      onCwdChange(file.key.replace(/\/$/, "") + "/");
    } else if (isPreviewableMedia(file.httpMetadata?.contentType, filename)) {
      onPreviewMedia(file);
    } else {
      window.open(
        buildWebdavUrl(file.key, { shareToken }),
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  const renderIcon = (
    file: FileItem,
    size: "small" | "medium",
    lockedFile: boolean
  ) => {
    const filename = extractFilename(file.key);
    const boxSize = size === "small" ? 38 : 46;
    const isImg = isImageFile(file.httpMetadata?.contentType, filename);

    if (lockedFile && isImg) {
      return <BlurredImageBanner seed={file.key} compact />;
    }

    const baseIcon =
      !lockedFile && file.customMetadata?.thumbnail ? (
        <Box
          component="img"
          src={buildThumbnailUrl(
            file.customMetadata.thumbnail,
            file.key,
            shareToken
          )}
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
      ) : (
        <MimeIcon
          contentType={file.httpMetadata?.contentType ?? ""}
          filename={filename}
          size={size}
        />
      );

    if (!lockedFile) return baseIcon;

    return (
      <Box sx={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
        <Box sx={{ opacity: 0.7 }}>{baseIcon}</Box>
        <Box
          sx={{
            position: "absolute",
            right: -4,
            bottom: -4,
            width: 20,
            height: 20,
            borderRadius: "50%",
            backgroundColor: isLight ? "#292018" : "#F59E0B",
            color: isLight ? "#FEF3C7" : "#1C1917",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid",
            borderColor: "background.paper",
          }}
        >
          <LockRoundedIcon sx={{ fontSize: 11 }} />
        </Box>
      </Box>
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
            gridTemplateColumns: "minmax(0, 1fr) 92px 150px 92px 136px",
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
          const lockedFile = !dir && guestLocked;
          const isImg = !dir && isImageFile(file.httpMetadata?.contentType, filename);
          const cleanKey = file.key.replace(/^\/+/, "").replace(/\/+$/, "");
          const isExactPrivateDir = dir && privateDirs.includes(cleanKey);
          const editableText =
            !dir &&
            !lockedFile &&
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
                if (!lockedFile) onMultiSelect(file.key);
              }}
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr) auto",
                  sm: "minmax(0, 1fr) 92px 150px 92px 136px",
                },
                alignItems: "center",
                gap: { xs: 1.25, sm: 2 },
                px: { xs: 1.75, sm: 2.5 },
                py: 1.35,
                cursor: lockedFile ? "not-allowed" : "pointer",
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
                {renderIcon(file, "small", lockedFile)}
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Tooltip title={filename} enterDelay={500}>
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{
                          fontWeight: 600,
                          color: lockedFile ? "text.secondary" : "text.primary",
                        }}
                      >
                        {filename}
                      </Typography>
                    </Tooltip>
                    {isExactPrivateDir && (
                      <Chip
                        icon={
                          <LockRoundedIcon
                            sx={{ fontSize: "12px !important" }}
                          />
                        }
                        label="私密"
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{
                          height: 19,
                          fontSize: "0.66rem",
                          fontWeight: 700,
                          "& .MuiChip-label": { px: 0.7 },
                        }}
                      />
                    )}
                    {lockedFile && (
                      <Chip
                        icon={
                          isImg ? (
                            <BlurOnRoundedIcon
                              sx={{ fontSize: "12px !important" }}
                            />
                          ) : (
                            <LockRoundedIcon
                              sx={{ fontSize: "11px !important" }}
                            />
                          )
                        }
                        label={isImg ? "模糊加密" : "已加密"}
                        size="small"
                        sx={{
                          height: 19,
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          backgroundColor: isLight
                            ? "rgba(120, 113, 108, 0.12)"
                            : "rgba(255, 255, 255, 0.08)",
                          color: "text.secondary",
                          "& .MuiChip-label": { px: 0.7 },
                        }}
                      />
                    )}
                  </Stack>
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
                {lockedFile ? (
                  <Tooltip title="文件已加密，请登录管理员或使用分享链接">
                    <LockRoundedIcon
                      sx={{ fontSize: 17, color: "text.disabled", mr: 0.75 }}
                    />
                  </Tooltip>
                ) : (
                  <>
                    {dir && authenticated && (
                      <>
                        <Tooltip title="加密分享文件夹">
                          <IconButton
                            size="small"
                            aria-label="分享文件夹"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenShare(file);
                            }}
                            sx={{
                              color: "text.secondary",
                              "&:hover": { color: "primary.main" },
                            }}
                          >
                            <ShareRoundedIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip
                          title={
                            isExactPrivateDir
                              ? "取消私密（对访客恢复可见）"
                              : "设为私密目录（对未登录访客隐藏）"
                          }
                        >
                          <IconButton
                            size="small"
                            aria-label={isExactPrivateDir ? "取消私密" : "设为私密"}
                            onClick={(e) => {
                              e.stopPropagation();
                              onTogglePrivacy(cleanKey, !isExactPrivateDir);
                            }}
                            sx={{
                              color: isExactPrivateDir
                                ? "primary.main"
                                : "text.secondary",
                            }}
                          >
                            {isExactPrivateDir ? (
                              <LockRoundedIcon sx={{ fontSize: 17 }} />
                            ) : (
                              <LockOpenRoundedIcon sx={{ fontSize: 17 }} />
                            )}
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    {editableText && (
                      <Tooltip
                        title={
                          authenticated ? "在 TextPad 中编辑" : "在 TextPad 中查看"
                        }
                      >
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
                        {authenticated && (
                          <Tooltip title="分享 / 加密链接">
                            <IconButton
                              size="small"
                              aria-label="分享文件"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenShare(file);
                              }}
                              sx={{
                                color: "text.secondary",
                                "&:hover": { color: "primary.main" },
                              }}
                            >
                              <ShareRoundedIcon sx={{ fontSize: 17 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="下载">
                          <IconButton
                            size="small"
                            aria-label="下载"
                            component="a"
                            href={buildWebdavUrl(file.key, {
                              shareToken,
                              download: true,
                            })}
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
                    {(authenticated || Boolean(shareToken)) && (
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
                            <RadioButtonUncheckedRoundedIcon
                              sx={{ fontSize: 18 }}
                            />
                          )}
                        </IconButton>
                      </Tooltip>
                    )}
                  </>
                )}
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
        const lockedFile = !dir && guestLocked;
        const isImg =
          !dir && isImageFile(file.httpMetadata?.contentType, filename);
        const cleanKey = file.key.replace(/^\/+/, "").replace(/\/+$/, "");
        const isExactPrivateDir = dir && privateDirs.includes(cleanKey);
        const editableText =
          !dir &&
          !lockedFile &&
          isEditableTextFile(file.httpMetadata?.contentType, filename);
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
                if (!lockedFile) onMultiSelect(file.key);
              }}
              sx={{
                position: "relative",
                p: 2,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 1.5,
                borderRadius: "18px",
                cursor: lockedFile ? "not-allowed" : "pointer",
                userSelect: "none",
                backgroundColor: selected
                  ? isLight
                    ? "#FFFBEB"
                    : "rgba(251, 191, 36, 0.11)"
                  : lockedFile
                  ? isLight
                    ? "rgba(255, 255, 255, 0.78)"
                    : "rgba(30, 27, 24, 0.78)"
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
                "&:hover": lockedFile
                  ? {
                      borderColor: isLight
                        ? "rgba(180, 83, 9, 0.25)"
                        : "rgba(251, 191, 36, 0.24)",
                    }
                  : {
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
              {/* Top Visual Row: Blurred Image Banner for locked images OR Icon + Actions */}
              {lockedFile && isImg ? (
                <BlurredImageBanner seed={file.key} />
              ) : (
                <Stack
                  direction="row"
                  alignItems="flex-start"
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    {renderIcon(file, "medium", lockedFile)}
                    {isExactPrivateDir && (
                      <Chip
                        icon={
                          <LockRoundedIcon
                            sx={{ fontSize: "13px !important" }}
                          />
                        }
                        label="私密"
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{
                          height: 22,
                          fontSize: "0.7rem",
                          fontWeight: 700,
                        }}
                      />
                    )}
                    {lockedFile && (
                      <Chip
                        icon={
                          <LockRoundedIcon
                            sx={{ fontSize: "12px !important" }}
                          />
                        }
                        label="已加密"
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: "0.69rem",
                          fontWeight: 700,
                          backgroundColor: isLight
                            ? "rgba(120, 113, 108, 0.12)"
                            : "rgba(255, 255, 255, 0.08)",
                          color: "text.secondary",
                        }}
                      />
                    )}
                  </Stack>

                  {!lockedFile && (
                    <Stack
                      direction="row"
                      spacing={0.25}
                      className="sf-card-actions"
                      sx={{
                        opacity:
                          selected || multiSelected !== null
                            ? 1
                            : { xs: 0.78, sm: 0 },
                        transition: "opacity 0.18s ease",
                      }}
                    >
                      {dir && authenticated && (
                        <>
                          <Tooltip title="加密分享文件夹">
                            <IconButton
                              size="small"
                              aria-label="分享文件夹"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenShare(file);
                              }}
                              sx={{
                                p: 0.5,
                                color: "text.secondary",
                                "&:hover": { color: "primary.main" },
                              }}
                            >
                              <ShareRoundedIcon sx={{ fontSize: 17 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip
                            title={
                              isExactPrivateDir
                                ? "取消私密"
                                : "设为私密（对访客隐藏）"
                            }
                          >
                            <IconButton
                              size="small"
                              aria-label={
                                isExactPrivateDir ? "取消私密" : "设为私密"
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                onTogglePrivacy(cleanKey, !isExactPrivateDir);
                              }}
                              sx={{
                                p: 0.5,
                                color: isExactPrivateDir
                                  ? "primary.main"
                                  : "text.secondary",
                                "&:hover": { color: "primary.main" },
                              }}
                            >
                              {isExactPrivateDir ? (
                                <LockRoundedIcon sx={{ fontSize: 17 }} />
                              ) : (
                                <LockOpenRoundedIcon sx={{ fontSize: 17 }} />
                              )}
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      {editableText && (
                        <Tooltip
                          title={
                            authenticated
                              ? "在 TextPad 中编辑"
                              : "在 TextPad 中查看"
                          }
                        >
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
                      {!dir && authenticated && (
                        <Tooltip title="分享 / 加密链接">
                          <IconButton
                            size="small"
                            aria-label="分享文件"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenShare(file);
                            }}
                            sx={{
                              p: 0.5,
                              color: "text.secondary",
                              "&:hover": { color: "primary.main" },
                            }}
                          >
                            <ShareRoundedIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(authenticated || Boolean(shareToken)) && (
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
                              color: selected
                                ? "primary.main"
                                : "text.secondary",
                              "&:hover": { color: "primary.main" },
                            }}
                          >
                            {selected ? (
                              <CheckCircleRoundedIcon sx={{ fontSize: 19 }} />
                            ) : (
                              <RadioButtonUncheckedRoundedIcon
                                sx={{ fontSize: 19 }}
                              />
                            )}
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  )}
                </Stack>
              )}

              {/* Middle: Filename */}
              <Box sx={{ minWidth: 0 }}>
                <Tooltip title={filename} enterDelay={500}>
                  <Typography
                    variant="subtitle2"
                    noWrap
                    sx={{
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color: lockedFile ? "text.secondary" : "text.primary",
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
