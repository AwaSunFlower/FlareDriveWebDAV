import React, { forwardRef, useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Drawer,
  Fab,
  Grid,
  IconButton,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import CreateNewFolderRoundedIcon from "@mui/icons-material/CreateNewFolderRounded";
import DriveFolderUploadRoundedIcon from "@mui/icons-material/DriveFolderUploadRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import UploadRoundedIcon from "@mui/icons-material/UploadRounded";
import { AuthRequiredError } from "./app/api";
import { ensureFoldersExist } from "./app/transfer";
import { useUploadEnqueue } from "./app/transferQueue";
import { SUNFLOWER_GRADIENT, SUNFLOWER_GRADIENT_HOVER } from "./theme";

function ActionTileButton({
  icon,
  caption,
  subtitle,
  color,
  bgColor,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  caption: string;
  subtitle: string;
  color: string;
  bgColor: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";

  return (
    <Button
      color="inherit"
      disabled={disabled}
      onClick={onClick}
      sx={{
        width: "100%",
        py: 2,
        px: 1.25,
        borderRadius: "16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: isLight
          ? "rgba(255, 255, 255, 0.9)"
          : "rgba(38, 34, 29, 0.85)",
        transition: "all 0.18s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: color,
          backgroundColor: isLight ? "#FFFDF8" : "rgba(48, 43, 37, 0.95)",
        },
      }}
    >
      <Box
        sx={{
          width: 46,
          height: 46,
          borderRadius: "14px",
          backgroundColor: bgColor,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </Box>
      <Box sx={{ textAlign: "center" }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, color: "text.primary", lineHeight: 1.3 }}
        >
          {caption}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontSize: "0.7rem" }}
        >
          {subtitle}
        </Typography>
      </Box>
    </Button>
  );
}

export const UploadFab = forwardRef<HTMLButtonElement, { onClick: () => void }>(
  function UploadFabButton({ onClick }, ref) {
    return (
      <Fab
        ref={ref}
        aria-label="上传文件"
        variant="circular"
        size="large"
        sx={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 1050,
          color: "#FFFFFF",
          background: SUNFLOWER_GRADIENT,
          boxShadow: "0 10px 26px -4px rgba(217, 119, 6, 0.52)",
          "&:hover": {
            background: SUNFLOWER_GRADIENT_HOVER,
          },
        }}
        onClick={onClick}
      >
        <UploadRoundedIcon sx={{ fontSize: 28 }} />
      </Fab>
    );
  }
);

function UploadDrawer({
  open,
  setOpen,
  cwd,
  onUpload,
  onCreateFolder,
  onRequireLogin,
  onNotify,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  cwd: string;
  onUpload: () => void;
  onCreateFolder: () => void;
  onRequireLogin: () => void;
  onNotify: (
    message: string,
    severity?: "success" | "info" | "warning" | "error"
  ) => void;
}) {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";
  const uploadEnqueue = useUploadEnqueue();
  const [preparingFolders, setPreparingFolders] = useState(false);

  const handleUpload = useCallback(
    (action: "image" | "file") => () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = action === "image" ? "image/*,video/*" : "*/*";
      input.multiple = true;
      input.onchange = () => {
        if (!input.files?.length) return;
        const files = Array.from(input.files);
        uploadEnqueue(...files.map((file) => ({ file, basedir: cwd })));
        setOpen(false);
        onNotify(`已加入 ${files.length} 个文件到上传队列`, "info");
        onUpload();
      };
      input.click();
    },
    [cwd, onNotify, onUpload, setOpen, uploadEnqueue]
  );

  const handleUploadFolder = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");

    input.onchange = async () => {
      if (!input.files?.length) return;
      const files = Array.from(input.files);

      const staged = files.map((file) => {
        const relPath =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
          file.name;
        const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
        const lastSlash = normalized.lastIndexOf("/");
        const relativeDir = lastSlash > 0 ? normalized.slice(0, lastSlash) : "";
        return { file, relativeDir };
      });

      const relDirs = staged
        .map((item) => item.relativeDir)
        .filter((dir) => dir.length > 0);

      setPreparingFolders(true);
      try {
        const dirCount = await ensureFoldersExist(cwd, relDirs);
        uploadEnqueue(
          ...staged.map(({ file, relativeDir }) => ({
            file,
            basedir: relativeDir ? `${cwd}${relativeDir}/` : cwd,
          }))
        );
        setOpen(false);
        onNotify(
          dirCount > 0
            ? `已创建 ${dirCount} 个目录并将 ${files.length} 个文件加入上传队列`
            : `已加入 ${files.length} 个文件到上传队列`,
          "info"
        );
        onUpload();
      } catch (err) {
        if (err instanceof AuthRequiredError) {
          setOpen(false);
          onRequireLogin();
        }
        onNotify(
          err instanceof Error ? err.message : "上传文件夹失败",
          "error"
        );
      } finally {
        setPreparingFolders(false);
      }
    };

    input.click();
  }, [cwd, onNotify, onRequireLogin, onUpload, setOpen, uploadEnqueue]);

  const uploadImage = useMemo(() => handleUpload("image"), [handleUpload]);
  const uploadFile = useMemo(() => handleUpload("file"), [handleUpload]);

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={() => !preparingFolders && setOpen(false)}
      PaperProps={{
        sx: {
          borderRadius: "24px 24px 0 0",
          maxWidth: 640,
          mx: "auto",
          backgroundColor: "background.default",
          borderTop: "1px solid",
          borderColor: "divider",
        },
      }}
    >
      <Box sx={{ p: { xs: 2.25, sm: 3 } }}>
        <Box
          sx={{
            width: 40,
            height: 4,
            borderRadius: 999,
            backgroundColor: "divider",
            mx: "auto",
            mb: 2,
          }}
        />

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 2.25 }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontSize: "1.05rem" }}>
              上传与新建
            </Typography>
            <Typography variant="caption" color="text.secondary">
              目标路径：{cwd ? `/${cwd}` : "根目录"} · 支持多选或直接拖拽文件/文件夹到页面
            </Typography>
          </Box>
          <IconButton
            aria-label="关闭上传菜单"
            disabled={preparingFolders}
            onClick={() => setOpen(false)}
          >
            <CloseRoundedIcon />
          </IconButton>
        </Stack>

        <Grid container spacing={1.5}>
          <Grid item xs={6} sm={3}>
            <ActionTileButton
              icon={<CloudUploadRoundedIcon />}
              caption="上传文件"
              subtitle="任意格式"
              color={isLight ? "#D97706" : "#FBBF24"}
              bgColor={
                isLight
                  ? "rgba(251, 191, 36, 0.22)"
                  : "rgba(251, 191, 36, 0.16)"
              }
              disabled={preparingFolders}
              onClick={uploadFile}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <ActionTileButton
              icon={<ImageRoundedIcon />}
              caption="图片 / 视频"
              subtitle="自动缩略图"
              color={isLight ? "#059669" : "#34D399"}
              bgColor={
                isLight
                  ? "rgba(16, 185, 129, 0.16)"
                  : "rgba(16, 185, 129, 0.16)"
              }
              disabled={preparingFolders}
              onClick={uploadImage}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <ActionTileButton
              icon={
                preparingFolders ? (
                  <CircularProgress size={22} color="inherit" />
                ) : (
                  <DriveFolderUploadRoundedIcon />
                )
              }
              caption="上传文件夹"
              subtitle={preparingFolders ? "正在建目录…" : "保留层级结构"}
              color={isLight ? "#0284C7" : "#38BDF8"}
              bgColor={
                isLight
                  ? "rgba(14, 165, 233, 0.15)"
                  : "rgba(14, 165, 233, 0.16)"
              }
              disabled={preparingFolders}
              onClick={handleUploadFolder}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <ActionTileButton
              icon={<CreateNewFolderRoundedIcon />}
              caption="新建文件夹"
              subtitle="分类整理"
              color={isLight ? "#EA580C" : "#FB923C"}
              bgColor={
                isLight
                  ? "rgba(249, 115, 22, 0.16)"
                  : "rgba(249, 115, 22, 0.17)"
              }
              disabled={preparingFolders}
              onClick={() => {
                setOpen(false);
                onCreateFolder();
              }}
            />
          </Grid>
        </Grid>
      </Box>
    </Drawer>
  );
}

export default UploadDrawer;
