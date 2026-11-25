import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DriveFileMoveRoundedIcon from "@mui/icons-material/DriveFileMoveRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import { extractFilename, FileItem, isDirectory } from "./FileGrid";
import { copyPaste, fetchPath } from "./app/transfer";

interface MoveCopyDialogProps {
  open: boolean;
  mode: "move" | "copy";
  items: string[];
  currentCwd: string;
  onClose: () => void;
  onSuccess: () => void;
  onNotify: (
    message: string,
    severity?: "success" | "info" | "warning" | "error"
  ) => void;
}

const MoveCopyDialog: React.FC<MoveCopyDialogProps> = ({
  open,
  mode,
  items,
  currentCwd,
  onClose,
  onSuccess,
  onNotify,
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";

  const [browsePath, setBrowsePath] = useState("");
  const [folders, setFolders] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBrowsePath("");
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPath(browsePath)
      .then((list) => {
        if (cancelled) return;
        setFolders(
          list
            .filter(isDirectory)
            .sort((a, b) =>
              extractFilename(a.key).localeCompare(
                extractFilename(b.key),
                "zh-CN",
                { numeric: true }
              )
            )
        );
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "读取目录失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [browsePath, open]);

  const normalizedBrowse = browsePath.replace(/\/$/, "");
  const isBlockedFolder = (folderKey: string) => {
    const cleanFolder = folderKey.replace(/\/$/, "");
    return items.some((src) => {
      const cleanSrc = src.replace(/\/$/, "");
      return (
        cleanFolder === cleanSrc || cleanFolder.startsWith(`${cleanSrc}/`)
      );
    });
  };

  const isSameAsSource =
    mode === "move" && browsePath === currentCwd;

  const isInsideSelectedDir = items.some((src) => {
    const cleanSrc = src.replace(/\/$/, "");
    return (
      normalizedBrowse === cleanSrc ||
      normalizedBrowse.startsWith(`${cleanSrc}/`)
    );
  });

  const handleConfirm = async () => {
    if (!items.length || isSameAsSource || isInsideSelectedDir) return;
    setSubmitting(true);
    setError(null);
    try {
      for (const srcKey of items) {
        const cleanSrc = srcKey.replace(/\/$/, "");
        const name = extractFilename(cleanSrc);
        const targetKey = `${browsePath}${name}`;
        await copyPaste(cleanSrc, targetKey, mode === "move");
      }
      onNotify(
        `已${mode === "move" ? "移动" : "复制"} ${items.length} 个项目到「${
          browsePath ? `/${browsePath}` : "根目录"
        }」`,
        "success"
      );
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `${mode === "move" ? "移动" : "复制"}失败`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const pathParts = browsePath
    ? browsePath.replace(/\/$/, "").split("/").filter(Boolean)
    : [];

  return (
    <Dialog
      open={open}
      onClose={() => !submitting && onClose()}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "11px",
                backgroundColor: isLight
                  ? "rgba(251, 191, 36, 0.2)"
                  : "rgba(251, 191, 36, 0.15)",
                color: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {mode === "move" ? (
                <DriveFileMoveRoundedIcon fontSize="small" />
              ) : (
                <ContentCopyRoundedIcon fontSize="small" />
              )}
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontSize: "1.02rem" }}>
                {mode === "move" ? "移动到文件夹" : "复制到文件夹"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                已选择 {items.length} 个项目
              </Typography>
            </Box>
          </Stack>
          <IconButton
            size="small"
            aria-label="关闭"
            onClick={onClose}
            disabled={submitting}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* Target Path Breadcrumbs */}
        <Box
          sx={{
            px: 1.5,
            py: 1,
            mb: 1.5,
            borderRadius: "12px",
            border: "1px solid",
            borderColor: "divider",
            backgroundColor: "background.default",
          }}
        >
          <Breadcrumbs
            separator={<NavigateNextRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{ "& .MuiBreadcrumbs-ol": { alignItems: "center" } }}
          >
            <Button
              size="small"
              startIcon={<HomeRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => setBrowsePath("")}
              sx={{ minWidth: 0, px: 0.75, py: 0.2, fontSize: "0.8rem" }}
            >
              根目录
            </Button>
            {pathParts.map((part, idx) => (
              <Button
                key={`${part}-${idx}`}
                size="small"
                onClick={() =>
                  setBrowsePath(pathParts.slice(0, idx + 1).join("/") + "/")
                }
                sx={{ minWidth: 0, px: 0.75, py: 0.2, fontSize: "0.8rem" }}
              >
                {part}
              </Button>
            ))}
          </Breadcrumbs>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 1.5, borderRadius: "10px" }}>
            {error}
          </Alert>
        )}

        {/* Subfolders list */}
        <Box
          sx={{
            minHeight: 190,
            maxHeight: 280,
            overflowY: "auto",
            borderRadius: "14px",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          {loading ? (
            <Stack
              alignItems="center"
              justifyContent="center"
              sx={{ height: 190 }}
            >
              <CircularProgress size={26} />
            </Stack>
          ) : folders.length === 0 ? (
            <Stack
              alignItems="center"
              justifyContent="center"
              sx={{ height: 190, px: 2 }}
            >
              <Typography variant="body2" color="text.secondary">
                此目录下没有子文件夹
              </Typography>
            </Stack>
          ) : (
            <List disablePadding>
              {folders.map((folder) => {
                const blocked = isBlockedFolder(folder.key);
                return (
                  <ListItemButton
                    key={folder.key}
                    disabled={blocked || submitting}
                    onClick={() =>
                      setBrowsePath(folder.key.replace(/\/$/, "") + "/")
                    }
                    sx={{ py: 1.1 }}
                  >
                    <ListItemIcon sx={{ minWidth: 38 }}>
                      <FolderRoundedIcon sx={{ color: "primary.main" }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={extractFilename(folder.key)}
                      primaryTypographyProps={{
                        variant: "body2",
                        fontWeight: 600,
                        noWrap: true,
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={onClose} disabled={submitting}>
          取消
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={submitting || isSameAsSource || isInsideSelectedDir}
        >
          {submitting
            ? "处理中…"
            : mode === "move"
            ? "移动到此处"
            : "复制到此处"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MoveCopyDialog;
