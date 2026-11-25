import React, { useEffect } from "react";
import {
  Box,
  Dialog,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AudioFileRoundedIcon from "@mui/icons-material/AudioFileRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import { encodeKey, extractFilename, FileItem } from "./FileGrid";
import { getFileCategory } from "./MimeIcon";
import { humanReadableSize } from "./app/utils";

interface MediaPreviewDialogProps {
  file: FileItem | null;
  images: FileItem[];
  onClose: () => void;
  onSelectFile: (file: FileItem) => void;
  onCopyLink: (file: FileItem) => void;
  onOpenShare: (file: FileItem) => void;
}

const MediaPreviewDialog: React.FC<MediaPreviewDialogProps> = ({
  file,
  images,
  onClose,
  onSelectFile,
  onCopyLink,
  onOpenShare,
}) => {
  const filename = file ? extractFilename(file.key) : "";
  const category = file
    ? getFileCategory(file.httpMetadata?.contentType, filename)
    : "other";
  const isImage = category === "image";

  const currentIndex =
    file && isImage ? images.findIndex((img) => img.key === file.key) : -1;
  const hasPrev = isImage && currentIndex > 0;
  const hasNext = isImage && currentIndex >= 0 && currentIndex < images.length - 1;

  useEffect(() => {
    if (!file || !isImage) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && hasPrev) {
        onSelectFile(images[currentIndex - 1]);
      } else if (e.key === "ArrowRight" && hasNext) {
        onSelectFile(images[currentIndex + 1]);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, file, hasNext, hasPrev, images, isImage, onSelectFile]);

  if (!file) return null;

  const fileUrl = `/webdav/${encodeKey(file.key)}`;

  return (
    <Dialog
      open={Boolean(file)}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: "#181512",
          color: "#F5F0E8",
          borderRadius: 4,
          overflow: "hidden",
          border: "1px solid rgba(251, 191, 36, 0.22)",
        },
      }}
    >
      {/* Top Bar */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        sx={{
          px: 2.5,
          py: 1.5,
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            noWrap
            sx={{ fontWeight: 600, color: "#FAF6F0" }}
          >
            {filename}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "rgba(245, 240, 232, 0.65)" }}
          >
            {humanReadableSize(file.size)}
            {isImage && images.length > 1 && currentIndex >= 0
              ? ` · ${currentIndex + 1} / ${images.length}`
              : ""}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
          <Tooltip title="限时加密分享">
            <IconButton
              size="small"
              onClick={() => onOpenShare(file)}
              sx={{ color: "#FBBF24" }}
            >
              <ShareRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="复制直链">
            <IconButton
              size="small"
              onClick={() => onCopyLink(file)}
              sx={{ color: "#F5F0E8" }}
            >
              <LinkRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="下载文件">
            <IconButton
              size="small"
              component="a"
              href={`${fileUrl}?download=1`}
              download={filename}
              sx={{ color: "#F5F0E8" }}
            >
              <DownloadRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="新标签页打开">
            <IconButton
              size="small"
              component="a"
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: "#F5F0E8" }}
            >
              <OpenInNewRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="关闭">
            <IconButton size="small" onClick={onClose} sx={{ color: "#F5F0E8" }}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Media Content Body */}
      <Box
        sx={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: category === "audio" ? 260 : { xs: 300, sm: 480 },
          maxHeight: "78vh",
          p: category === "pdf" ? 0 : { xs: 1.5, sm: 3 },
          backgroundColor: "rgba(10, 9, 8, 0.55)",
        }}
      >
        {isImage && (
          <>
            {hasPrev && (
              <IconButton
                aria-label="上一张"
                onClick={() => onSelectFile(images[currentIndex - 1])}
                sx={{
                  position: "absolute",
                  left: 12,
                  zIndex: 2,
                  color: "#FFFFFF",
                  backgroundColor: "rgba(0, 0, 0, 0.55)",
                  "&:hover": { backgroundColor: "rgba(245, 158, 11, 0.8)" },
                }}
              >
                <ChevronLeftRoundedIcon />
              </IconButton>
            )}

            <Box
              component="img"
              src={fileUrl}
              alt={filename}
              sx={{
                maxWidth: "100%",
                maxHeight: "70vh",
                objectFit: "contain",
                borderRadius: 2,
                boxShadow: "0 18px 42px rgba(0, 0, 0, 0.45)",
              }}
            />

            {hasNext && (
              <IconButton
                aria-label="下一张"
                onClick={() => onSelectFile(images[currentIndex + 1])}
                sx={{
                  position: "absolute",
                  right: 12,
                  zIndex: 2,
                  color: "#FFFFFF",
                  backgroundColor: "rgba(0, 0, 0, 0.55)",
                  "&:hover": { backgroundColor: "rgba(245, 158, 11, 0.8)" },
                }}
              >
                <ChevronRightRoundedIcon />
              </IconButton>
            )}
          </>
        )}

        {category === "video" && (
          <Box
            component="video"
            key={file.key}
            src={fileUrl}
            controls
            playsInline
            preload="metadata"
            sx={{
              width: "100%",
              maxHeight: "70vh",
              borderRadius: 2,
              backgroundColor: "#000000",
              outline: "none",
            }}
          />
        )}

        {category === "audio" && (
          <Stack
            alignItems="center"
            spacing={2.5}
            sx={{ width: "100%", maxWidth: 460, py: 3, px: 2 }}
          >
            <Box
              sx={{
                width: 84,
                height: 84,
                borderRadius: "24px",
                background:
                  "linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(139, 92, 246, 0.28) 100%)",
                border: "1px solid rgba(251, 191, 36, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FBBF24",
              }}
            >
              <AudioFileRoundedIcon sx={{ fontSize: 44 }} />
            </Box>
            <Typography
              variant="subtitle1"
              fontWeight={700}
              textAlign="center"
              sx={{ color: "#FAF6F0", wordBreak: "break-all" }}
            >
              {filename}
            </Typography>
            <Box
              component="audio"
              key={file.key}
              src={fileUrl}
              controls
              preload="metadata"
              sx={{ width: "100%" }}
            />
          </Stack>
        )}

        {category === "pdf" && (
          <Box
            component="iframe"
            key={file.key}
            title={filename}
            src={fileUrl}
            sx={{
              width: "100%",
              height: "74vh",
              border: "none",
              backgroundColor: "#FFFFFF",
            }}
          />
        )}
      </Box>
    </Dialog>
  );
};

export default MediaPreviewDialog;
