import React, { useEffect } from "react";
import {
  Box,
  Dialog,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { encodeKey, extractFilename, FileItem } from "./FileGrid";
import { humanReadableSize } from "./app/utils";

interface ImagePreviewDialogProps {
  file: FileItem | null;
  images: FileItem[];
  onClose: () => void;
  onSelectFile: (file: FileItem) => void;
  onCopyLink: (file: FileItem) => void;
}

const ImagePreviewDialog: React.FC<ImagePreviewDialogProps> = ({
  file,
  images,
  onClose,
  onSelectFile,
  onCopyLink,
}) => {
  const currentIndex = file
    ? images.findIndex((img) => img.key === file.key)
    : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < images.length - 1;

  useEffect(() => {
    if (!file) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && hasPrev) {
        onSelectFile(images[currentIndex - 1]);
      } else if (e.key === "ArrowRight" && hasNext) {
        onSelectFile(images[currentIndex + 1]);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, file, hasNext, hasPrev, images, onSelectFile]);

  if (!file) return null;

  const filename = extractFilename(file.key);
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
          <Typography variant="caption" sx={{ color: "rgba(245, 240, 232, 0.65)" }}>
            {humanReadableSize(file.size)}
            {images.length > 1 && currentIndex >= 0
              ? ` · ${currentIndex + 1} / ${images.length}`
              : ""}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
          <Tooltip title="复制直链">
            <IconButton
              size="small"
              onClick={() => onCopyLink(file)}
              sx={{ color: "#F5F0E8" }}
            >
              <LinkRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="下载原图">
            <IconButton
              size="small"
              component="a"
              href={fileUrl}
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

      {/* Image Canvas */}
      <Box
        sx={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: { xs: 280, sm: 440 },
          maxHeight: "74vh",
          p: { xs: 1.5, sm: 3 },
          backgroundColor: "rgba(10, 9, 8, 0.55)",
        }}
      >
        {hasPrev && (
          <IconButton
            aria-label="上一张"
            onClick={() => onSelectFile(images[currentIndex - 1])}
            sx={{
              position: "absolute",
              left: 12,
              zIndex: 2,
              color: "#FFFFFF",
              backgroundColor: "rgba(0, 0, 0, 0.48)",
              "&:hover": { backgroundColor: "rgba(245, 158, 11, 0.75)" },
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
            maxHeight: "68vh",
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
              backgroundColor: "rgba(0, 0, 0, 0.48)",
              "&:hover": { backgroundColor: "rgba(245, 158, 11, 0.75)" },
            }}
          >
            <ChevronRightRoundedIcon />
          </IconButton>
        )}
      </Box>
    </Dialog>
  );
};

export default ImagePreviewDialog;
