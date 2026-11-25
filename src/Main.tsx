import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import CreateNewFolderRoundedIcon from "@mui/icons-material/CreateNewFolderRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import FolderSharedRoundedIcon from "@mui/icons-material/FolderSharedRounded";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import LockPersonRoundedIcon from "@mui/icons-material/LockPersonRounded";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import NoteAddRoundedIcon from "@mui/icons-material/NoteAddRounded";
import SortRoundedIcon from "@mui/icons-material/SortRounded";
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded";

import FileGrid, {
  encodeKey,
  extractFilename,
  FileItem,
  isDirectory,
  isPathInPrivateDirs,
  ViewMode,
} from "./FileGrid";
import MediaPreviewDialog from "./MediaPreviewDialog";
import { isEditableTextFile, isImageFile } from "./MimeIcon";
import MoveCopyDialog from "./MoveCopyDialog";
import MultiSelectToolbar from "./MultiSelectToolbar";
import ShareDialog from "./ShareDialog";
import TextPadDrawer from "./TextPadDrawer";
import UploadDrawer, { UploadFab } from "./UploadDrawer";
import {
  ActiveDirShare,
  AuthRequiredError,
  AuthStatus,
  buildWebdavUrl,
  setFolderPrivacy,
  SPA_REQUEST_HEADERS,
} from "./app/api";
import {
  collectDroppedEntries,
  copyPaste,
  createFolder,
  ensureFoldersExist,
  fetchPath,
} from "./app/transfer";
import { useTransferQueue, useUploadEnqueue } from "./app/transferQueue";
import { humanReadableSize } from "./app/utils";

type SortField = "name" | "date" | "size";
type SortOrder = "asc" | "desc";
type NotifySeverity = "success" | "info" | "warning" | "error";

const VIEW_MODE_KEY = "sunflower_drive_view_mode";
const SORT_FIELD_KEY = "sunflower_drive_sort_field";
const SORT_ORDER_KEY = "sunflower_drive_sort_order";

const SORT_LABELS: Record<SortField, string> = {
  name: "名称",
  date: "修改时间",
  size: "文件大小",
};

function readStorage<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  try {
    const val = window.localStorage.getItem(key) as T | null;
    if (val && allowed.includes(val)) return val;
  } catch {
    // ignore storage errors
  }
  return fallback;
}

function PathBreadcrumb({
  path,
  rootPrefix,
  rootLabel,
  onCwdChange,
}: {
  path: string;
  rootPrefix: string;
  rootLabel: string;
  onCwdChange: (newCwd: string) => void;
}) {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";

  const relativePath =
    rootPrefix && path.startsWith(rootPrefix)
      ? path.slice(rootPrefix.length)
      : path;
  const parts = relativePath
    ? relativePath.replace(/\/$/, "").split("/").filter(Boolean)
    : [];

  return (
    <Breadcrumbs
      separator={
        <NavigateNextRoundedIcon
          sx={{ fontSize: 18, color: "text.secondary" }}
        />
      }
      aria-label="当前目录路径"
      sx={{
        "& .MuiBreadcrumbs-ol": { alignItems: "center", flexWrap: "wrap" },
      }}
    >
      <Button
        size="small"
        startIcon={
          rootPrefix ? (
            <FolderSharedRoundedIcon sx={{ fontSize: 18 }} />
          ) : (
            <HomeRoundedIcon sx={{ fontSize: 18 }} />
          )
        }
        onClick={() => onCwdChange(rootPrefix)}
        sx={{
          minWidth: 0,
          px: 1.25,
          py: 0.4,
          borderRadius: "10px",
          color: parts.length === 0 ? "primary.main" : "text.secondary",
          backgroundColor:
            parts.length === 0
              ? isLight
                ? "rgba(251, 191, 36, 0.18)"
                : "rgba(251, 191, 36, 0.14)"
              : "transparent",
          fontWeight: parts.length === 0 ? 700 : 600,
          "&:hover": {
            backgroundColor: isLight
              ? "rgba(251, 191, 36, 0.14)"
              : "rgba(251, 191, 36, 0.1)",
          },
        }}
      >
        {rootLabel}
      </Button>

      {parts.map((part, index) => {
        const isLast = index === parts.length - 1;
        return isLast ? (
          <Chip
            key={`${part}-${index}`}
            label={part}
            size="small"
            sx={{
              height: 28,
              fontWeight: 700,
              fontSize: "0.84rem",
              borderRadius: "10px",
              color: isLight ? "#92400E" : "#FDE68A",
              backgroundColor: isLight
                ? "rgba(251, 191, 36, 0.2)"
                : "rgba(251, 191, 36, 0.16)",
            }}
          />
        ) : (
          <Button
            key={`${part}-${index}`}
            size="small"
            onClick={() =>
              onCwdChange(
                `${rootPrefix}${parts.slice(0, index + 1).join("/")}/`
              )
            }
            sx={{
              minWidth: 0,
              px: 1,
              py: 0.35,
              borderRadius: "10px",
              color: "text.secondary",
              fontWeight: 600,
              "&:hover": { color: "primary.main" },
            }}
          >
            {part}
          </Button>
        );
      })}
    </Breadcrumbs>
  );
}

interface MainProps {
  search: string;
  onClearSearch: () => void;
  refreshToken: number;
  resetRootToken: number;
  authStatus: AuthStatus;
  activeDirShare: ActiveDirShare | null;
  onExitDirShare: () => void;
  onRequireLogin: () => void;
  onPrivateDirsChange: (dirs: string[]) => void;
  onRefreshingChange: (loading: boolean) => void;
  onNotify: (message: string, severity?: NotifySeverity) => void;
}

function Main({
  search,
  onClearSearch,
  refreshToken,
  resetRootToken,
  authStatus,
  activeDirShare,
  onExitDirShare,
  onRequireLogin,
  onPrivateDirsChange,
  onRefreshingChange,
  onNotify,
}: MainProps) {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";
  const { authenticated, guestFileLocked, privateDirs } = authStatus;

  const shareRootPrefix = activeDirShare
    ? `${activeDirShare.rootDir.replace(/^\/+|\/+$/g, "")}/`
    : "";
  const shareToken = activeDirShare?.token;

  // Normal unauthenticated guests (NOT via a valid share link) have files locked & images blurred
  const guestLocked = !authenticated && !activeDirShare && guestFileLocked;

  const [cwd, setCwd] = useState(shareRootPrefix);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [multiSelected, setMultiSelected] = useState<string[] | null>(null);
  const [showUploadDrawer, setShowUploadDrawer] = useState(false);
  const [showTextPadDrawer, setShowTextPadDrawer] = useState(false);
  const [editingTextFile, setEditingTextFile] = useState<FileItem | null>(null);
  const [lastUploadKey, setLastUploadKey] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    readStorage(VIEW_MODE_KEY, ["grid", "list"] as const, "grid")
  );
  const [sortField, setSortField] = useState<SortField>(() =>
    readStorage(SORT_FIELD_KEY, ["name", "date", "size"] as const, "name")
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>(() =>
    readStorage(SORT_ORDER_KEY, ["asc", "desc"] as const, "asc")
  );
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(
    null
  );

  // Dialog states
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveCopyState, setMoveCopyState] = useState<{
    open: boolean;
    mode: "move" | "copy";
  }>({ open: false, mode: "move" });
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<FileItem | null>(null);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);

  // Drag & drop state using counter so child elements don't cause flicker
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  const transferQueue = useTransferQueue();
  const uploadEnqueue = useUploadEnqueue();

  // Keep cwd aligned when entering/exiting a shared folder
  useEffect(() => {
    setCwd(shareRootPrefix);
    setMultiSelected(null);
  }, [shareRootPrefix]);

  const handleCwdChange = useCallback(
    (nextCwd: string) => {
      if (shareRootPrefix && !nextCwd.startsWith(shareRootPrefix)) {
        setCwd(shareRootPrefix);
        return;
      }
      setCwd(nextCwd);
    },
    [shareRootPrefix]
  );

  const handleViewModeChange = (next: ViewMode) => {
    setViewMode(next);
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, next);
    } catch {
      // ignore
    }
  };

  const handleSortFieldChange = (field: SortField) => {
    setSortField(field);
    try {
      window.localStorage.setItem(SORT_FIELD_KEY, field);
    } catch {
      // ignore
    }
    setSortMenuAnchor(null);
  };

  const handleToggleSortOrder = () => {
    const next: SortOrder = sortOrder === "asc" ? "desc" : "asc";
    setSortOrder(next);
    try {
      window.localStorage.setItem(SORT_ORDER_KEY, next);
    } catch {
      // ignore
    }
  };

  const callbacksRef = useRef({
    onNotify,
    onRefreshingChange,
    onRequireLogin,
  });
  callbacksRef.current = {
    onNotify,
    onRefreshingChange,
    onRequireLogin,
  };

  const fetchSeqRef = useRef(0);

  const fetchFiles = useCallback(
    (showFullLoader = false) => {
      const seq = ++fetchSeqRef.current;
      if (showFullLoader) setLoading(true);
      callbacksRef.current.onRefreshingChange(true);
      fetchPath(cwd, shareToken)
        .then((fetchedFiles) => {
          if (seq !== fetchSeqRef.current) return;
          setFiles(fetchedFiles);
          setMultiSelected(null);
        })
        .catch((err: unknown) => {
          if (seq !== fetchSeqRef.current) return;
          if (err instanceof AuthRequiredError) {
            callbacksRef.current.onRequireLogin();
            return;
          }
          callbacksRef.current.onNotify(
            err instanceof Error ? err.message : "加载文件列表失败",
            "error"
          );
        })
        .finally(() => {
          if (seq !== fetchSeqRef.current) return;
          setLoading(false);
          callbacksRef.current.onRefreshingChange(false);
        });
    },
    [cwd, shareToken]
  );

  useEffect(() => {
    fetchFiles(true);
  }, [fetchFiles, authenticated]);

  useEffect(() => {
    if (refreshToken > 0) {
      fetchFiles(false);
    }
  }, [fetchFiles, refreshToken]);

  useEffect(() => {
    if (resetRootToken > 0) {
      setCwd(shareRootPrefix);
      setMultiSelected(null);
    }
  }, [resetRootToken, shareRootPrefix]);

  useEffect(() => {
    if (!transferQueue.length) return;
    const lastFile = transferQueue[transferQueue.length - 1];
    if (["pending", "in-progress"].includes(lastFile.status)) {
      setLastUploadKey(lastFile.remoteKey);
    } else if (lastUploadKey) {
      setLastUploadKey(null);
      if (lastFile.status === "completed") {
        fetchFiles(false);
        onNotify(`已上传：${lastFile.name}`, "success");
      } else if (lastFile.status === "failed") {
        if (lastFile.error instanceof AuthRequiredError) {
          onRequireLogin();
        }
        onNotify(
          lastFile.error?.message || `上传 ${lastFile.name} 失败`,
          "error"
        );
      }
    }
  }, [fetchFiles, lastUploadKey, onNotify, onRequireLogin, transferQueue]);

  const filteredFiles = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const base = keyword
      ? files.filter((file) =>
          extractFilename(file.key).toLowerCase().includes(keyword)
        )
      : files;

    const dirMultiplier = sortOrder === "asc" ? 1 : -1;

    return [...base].sort((a, b) => {
      const aDir = isDirectory(a);
      const bDir = isDirectory(b);
      if (aDir !== bDir) return aDir ? -1 : 1;

      if (sortField === "date") {
        const aTime = new Date(a.uploaded).getTime() || 0;
        const bTime = new Date(b.uploaded).getTime() || 0;
        return (aTime - bTime) * dirMultiplier;
      }
      if (sortField === "size") {
        return (a.size - b.size) * dirMultiplier;
      }
      return (
        extractFilename(a.key).localeCompare(
          extractFilename(b.key),
          "zh-CN",
          { numeric: true, sensitivity: "base" }
        ) * dirMultiplier
      );
    });
  }, [files, search, sortField, sortOrder]);

  const folderCount = useMemo(
    () => files.filter((f) => isDirectory(f)).length,
    [files]
  );
  const fileCount = files.length - folderCount;
  const totalSize = useMemo(
    () => files.reduce((acc, f) => acc + (isDirectory(f) ? 0 : f.size), 0),
    [files]
  );

  const imageFiles = useMemo(
    () =>
      filteredFiles.filter(
        (f) =>
          !isDirectory(f) &&
          isImageFile(f.httpMetadata?.contentType, extractFilename(f.key))
      ),
    [filteredFiles]
  );

  const editableTextFiles = useMemo(
    () =>
      files.filter(
        (f) =>
          !isDirectory(f) &&
          isEditableTextFile(f.httpMetadata?.contentType, extractFilename(f.key))
      ),
    [files]
  );

  const handleOpenTextPadForNew = useCallback(() => {
    setEditingTextFile(null);
    setShowTextPadDrawer(true);
  }, []);

  const handleEditTextFile = useCallback((file: FileItem) => {
    setEditingTextFile(file);
    setShowTextPadDrawer(true);
  }, []);

  const handleLockedFileClick = useCallback(
    (file: FileItem) => {
      const filename = extractFilename(file.key);
      const isImg = isImageFile(file.httpMetadata?.contentType, filename);
      onNotify(
        isImg
          ? "该图片已加密模糊保护，请登录管理员或通过分享链接查看"
          : "该文件已加密保护无法直接打开，请登录管理员或使用分享链接",
        "warning"
      );
    },
    [onNotify]
  );

  const handleMultiSelect = useCallback((key: string) => {
    setMultiSelected((prev) => {
      if (prev === null) return [key];
      if (prev.includes(key)) {
        const updated = prev.filter((k) => k !== key);
        return updated.length ? updated : null;
      }
      return [...prev, key];
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!filteredFiles.length) return;
    setMultiSelected((prev) =>
      prev && prev.length === filteredFiles.length
        ? null
        : filteredFiles.map((f) => f.key)
    );
  }, [filteredFiles]);

  const handleCopyLink = useCallback(
    async (file: FileItem) => {
      const url = new URL(
        buildWebdavUrl(file.key, { shareToken }),
        window.location.href
      ).toString();
      try {
        await navigator.clipboard.writeText(url);
        onNotify(`已复制链接：${extractFilename(file.key)}`, "success");
      } catch {
        onNotify("复制失败，请手动打开文件地址", "warning");
      }
    },
    [onNotify, shareToken]
  );

  const handleTogglePrivacy = useCallback(
    async (folderPath: string, nextPrivate: boolean) => {
      try {
        const res = await setFolderPrivacy(folderPath, nextPrivate);
        onPrivateDirsChange(res.privateDirs);
        onNotify(
          nextPrivate
            ? `已将「${extractFilename(folderPath)}」设为私密目录（未登录访客不可见）`
            : `已取消「${extractFilename(folderPath)}」的私密保护`,
          "success"
        );
      } catch (err) {
        if (err instanceof AuthRequiredError) {
          onRequireLogin();
          return;
        }
        onNotify(
          err instanceof Error ? err.message : "更新目录权限失败",
          "error"
        );
      }
    },
    [onNotify, onPrivateDirsChange, onRequireLogin]
  );

  const handleCreateFolderSubmit = async () => {
    if (!newFolderName.trim()) return;
    setDialogSubmitting(true);
    try {
      const created = await createFolder(cwd, newFolderName);
      if (created) {
        onNotify(`已创建文件夹「${newFolderName.trim()}」`, "success");
        setFolderDialogOpen(false);
        setNewFolderName("");
        fetchFiles(false);
      }
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        setFolderDialogOpen(false);
        onRequireLogin();
        return;
      }
      onNotify(
        err instanceof Error ? err.message : "创建文件夹失败",
        "error"
      );
    } finally {
      setDialogSubmitting(false);
    }
  };

  const openRenameDialog = () => {
    if (multiSelected?.length !== 1) return;
    setRenameValue(extractFilename(multiSelected[0]));
    setRenameDialogOpen(true);
  };

  const handleRenameSubmit = async () => {
    if (multiSelected?.length !== 1 || !renameValue.trim()) return;
    const trimmed = renameValue.trim();
    if (trimmed.includes("/")) {
      onNotify("名称不能包含 /", "warning");
      return;
    }
    setDialogSubmitting(true);
    try {
      await copyPaste(multiSelected[0], cwd + trimmed, true);
      onNotify(`已重命名为「${trimmed}」`, "success");
      setRenameDialogOpen(false);
      fetchFiles(false);
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        setRenameDialogOpen(false);
        onRequireLogin();
        return;
      }
      onNotify(err instanceof Error ? err.message : "重命名失败", "error");
    } finally {
      setDialogSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!multiSelected?.length) return;
    setDialogSubmitting(true);
    try {
      for (const key of multiSelected) {
        const res = await fetch(`/webdav/${encodeKey(key)}`, {
          method: "DELETE",
          headers: SPA_REQUEST_HEADERS,
        });
        if (res.status === 401) throw new AuthRequiredError();
        if (!res.ok) {
          throw new Error(`删除 ${extractFilename(key)} 失败 (${res.status})`);
        }
      }
      onNotify(`已删除 ${multiSelected.length} 个项目`, "success");
      setDeleteDialogOpen(false);
      fetchFiles(false);
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        setDeleteDialogOpen(false);
        onRequireLogin();
        return;
      }
      onNotify(err instanceof Error ? err.message : "删除失败", "error");
    } finally {
      setDialogSubmitting(false);
    }
  };

  const handleShareSelectedFromToolbar = () => {
    if (multiSelected?.length !== 1) return;
    const found = files.find((f) => f.key === multiSelected[0]);
    if (found) setShareFile(found);
  };

  const isLongTermDirShare =
    activeDirShare &&
    activeDirShare.expiresAt - Date.now() > 365 * 24 * 60 * 60 * 1000;

  return (
    <Box
      component="main"
      sx={{
        flexGrow: 1,
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        dragCounter.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = authenticated ? "copy" : "none";
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) {
          dragCounter.current = 0;
          setDragging(false);
        }
      }}
      onDrop={async (e) => {
        e.preventDefault();
        dragCounter.current = 0;
        setDragging(false);
        if (!e.dataTransfer.files?.length && !e.dataTransfer.items?.length) {
          return;
        }
        if (!authenticated) {
          onNotify("访客模式下无法上传，请先登录管理员账号", "info");
          onRequireLogin();
          return;
        }
        try {
          const { files: droppedFiles, dirs } = await collectDroppedEntries(
            e.dataTransfer
          );
          if (!droppedFiles.length && !dirs.length) return;
          if (dirs.length > 0) {
            await ensureFoldersExist(cwd, dirs);
          }
          if (droppedFiles.length > 0) {
            uploadEnqueue(
              ...droppedFiles.map(({ file, relativeDir }) => ({
                file,
                basedir: relativeDir ? `${cwd}${relativeDir}/` : cwd,
              }))
            );
            onNotify(
              dirs.length > 0
                ? `已创建 ${dirs.length} 个目录并将 ${droppedFiles.length} 个文件加入上传队列`
                : `已加入 ${droppedFiles.length} 个文件到上传队列`,
              "info"
            );
          } else {
            onNotify(`已创建 ${dirs.length} 个空文件夹`, "success");
            fetchFiles(false);
          }
        } catch (err) {
          if (err instanceof AuthRequiredError) {
            onRequireLogin();
          }
          onNotify(
            err instanceof Error ? err.message : "拖拽上传失败",
            "error"
          );
        }
      }}
    >
      {/* Drag Overlay */}
      {dragging && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 1400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 3,
            backgroundColor: isLight
              ? "rgba(253, 251, 247, 0.86)"
              : "rgba(20, 18, 16, 0.86)",
            backdropFilter: "blur(8px)",
            pointerEvents: "none",
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: 5,
              borderRadius: "28px",
              border: "2px dashed",
              borderColor: "primary.main",
              backgroundColor: isLight
                ? "rgba(255, 251, 235, 0.95)"
                : "rgba(38, 34, 29, 0.95)",
              textAlign: "center",
            }}
          >
            <CloudUploadRoundedIcon
              sx={{ fontSize: 56, color: "primary.main", mb: 1.5 }}
            />
            <Typography variant="h6" gutterBottom>
              {authenticated ? "松手即可上传文件或文件夹" : "请先登录管理员后再上传"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              目标目录：{cwd ? `/${cwd}` : "根目录"}
            </Typography>
          </Paper>
        </Box>
      )}

      {/* Main Content Container */}
      <Box
        sx={{
          width: "100%",
          maxWidth: 1240,
          mx: "auto",
          px: { xs: 1.5, sm: 3 },
          pt: { xs: 1.5, sm: 3 },
          pb: { xs: 4, sm: 6 },
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Active Folder Share Banner */}
        {activeDirShare && (
          <Alert
            severity="success"
            icon={<FolderSharedRoundedIcon />}
            action={
              <Button color="inherit" size="small" onClick={onExitDirShare}>
                返回云盘主页
              </Button>
            }
            sx={{
              mb: 2,
              borderRadius: "16px",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            正在通过加密分享链接访问文件夹「
            <strong>{extractFilename(activeDirShare.rootDir)}</strong>
            」· 此目录内文件与高清原图已全部解锁（
            {isLongTermDirShare
              ? "长期有效"
              : `有效期至 ${new Date(
                  activeDirShare.expiresAt
                ).toLocaleString()}`}
            ）
          </Alert>
        )}

        {/* Workspace Hero & Action Card */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, sm: 2.25 },
            mb: { xs: 1.75, sm: 2.5 },
            borderRadius: { xs: "16px", sm: "20px" },
            border: "1px solid",
            borderColor: "divider",
            backgroundColor: isLight
              ? "rgba(255, 255, 255, 0.86)"
              : "rgba(30, 27, 24, 0.86)",
            backdropFilter: "blur(12px)",
            boxShadow: isLight
              ? "0 4px 20px rgba(120, 53, 15, 0.04)"
              : "0 4px 22px rgba(0, 0, 0, 0.28)",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            alignItems={{ xs: "stretch", md: "center" }}
            justifyContent="space-between"
            spacing={{ xs: 1.25, sm: 2 }}
          >
            {/* Left: Breadcrumbs + Stats */}
            <Stack spacing={0.7} sx={{ minWidth: 0 }}>
              <PathBreadcrumb
                path={cwd}
                rootPrefix={shareRootPrefix}
                rootLabel={
                  activeDirShare
                    ? extractFilename(activeDirShare.rootDir)
                    : "全部文件"
                }
                onCwdChange={handleCwdChange}
              />
              <Stack
                direction="row"
                alignItems="center"
                spacing={0.85}
                flexWrap="wrap"
                useFlexGap
                sx={{ pl: 0.5 }}
              >
                <Typography variant="caption" color="text.secondary">
                  {folderCount} 个文件夹 · {fileCount} 个文件
                  {totalSize > 0
                    ? ` · 共 ${humanReadableSize(totalSize)}`
                    : ""}
                </Typography>
                {guestLocked && (
                  <Chip
                    size="small"
                    label="访客加密模式（仅文件夹可浏览）"
                    sx={{
                      height: 20,
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      backgroundColor: isLight
                        ? "rgba(217, 119, 6, 0.12)"
                        : "rgba(251, 191, 36, 0.14)",
                      color: isLight ? "#B45309" : "#FDE68A",
                    }}
                  />
                )}
                {!authenticated && activeDirShare && (
                  <Chip
                    size="small"
                    color="success"
                    variant="outlined"
                    label="分享链接已解锁"
                    sx={{ height: 20, fontSize: "0.69rem", fontWeight: 700 }}
                  />
                )}
                {search.trim() && (
                  <Chip
                    size="small"
                    label={`筛选“${search.trim()}” (${filteredFiles.length})`}
                    onDelete={onClearSearch}
                    color="primary"
                    variant="outlined"
                    sx={{ height: 22, fontSize: "0.72rem" }}
                  />
                )}
              </Stack>
            </Stack>

            {/* Right: Responsive Primary Actions (Desktop & Mobile!) */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={{ xs: 0.75, sm: 1 }}
              sx={{
                display: "flex",
                flexShrink: 0,
              }}
            >
              {authenticated ? (
                <>
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    startIcon={
                      <CreateNewFolderRoundedIcon
                        sx={{ fontSize: { xs: 16, sm: 19 } }}
                      />
                    }
                    onClick={() => {
                      setNewFolderName("");
                      setFolderDialogOpen(true);
                    }}
                    sx={{
                      flex: { xs: 1, sm: "none" },
                      py: { xs: 0.75, sm: 0.85 },
                      px: { xs: 1, sm: 1.75 },
                      fontSize: { xs: "0.76rem", sm: "0.86rem" },
                      whiteSpace: "nowrap",
                      borderColor: "divider",
                      backgroundColor: isLight
                        ? "rgba(255, 255, 255, 0.8)"
                        : "rgba(38, 34, 29, 0.7)",
                      "&:hover": {
                        borderColor: "primary.main",
                        color: "primary.main",
                      },
                    }}
                  >
                    新建文件夹
                  </Button>
                  <Tooltip title="新建或在线编辑文本 / Markdown / JSON 文件">
                    <Button
                      variant="outlined"
                      color="primary"
                      size="small"
                      startIcon={
                        <NoteAddRoundedIcon
                          sx={{ fontSize: { xs: 16, sm: 19 } }}
                        />
                      }
                      onClick={handleOpenTextPadForNew}
                      sx={{
                        flex: { xs: 1, sm: "none" },
                        py: { xs: 0.75, sm: 0.85 },
                        px: { xs: 1, sm: 1.75 },
                        fontSize: { xs: "0.76rem", sm: "0.86rem" },
                        whiteSpace: "nowrap",
                        backgroundColor: isLight
                          ? "rgba(251, 191, 36, 0.08)"
                          : "rgba(251, 191, 36, 0.08)",
                      }}
                    >
                      TextPad
                    </Button>
                  </Tooltip>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={
                      <CloudUploadRoundedIcon
                        sx={{ fontSize: { xs: 16, sm: 19 } }}
                      />
                    }
                    onClick={() => setShowUploadDrawer(true)}
                    sx={{
                      flex: { xs: 1, sm: "none" },
                      py: { xs: 0.75, sm: 0.85 },
                      px: { xs: 1.25, sm: 2.25 },
                      fontSize: { xs: "0.76rem", sm: "0.86rem" },
                      whiteSpace: "nowrap",
                    }}
                  >
                    上传
                  </Button>
                </>
              ) : (
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  fullWidth
                  startIcon={<LockPersonRoundedIcon />}
                  onClick={onRequireLogin}
                  sx={{
                    width: { xs: "100%", sm: "auto" },
                    py: { xs: 0.75, sm: 0.85 },
                    px: { xs: 1.5, sm: 2 },
                    fontSize: { xs: "0.8rem", sm: "0.86rem" },
                    backgroundColor: isLight
                      ? "rgba(251, 191, 36, 0.08)"
                      : "rgba(251, 191, 36, 0.08)",
                  }}
                >
                  {activeDirShare
                    ? "管理员登录"
                    : "管理员登录以解锁文件与原图"}
                </Button>
              )}
            </Stack>
          </Stack>

          <Divider sx={{ my: { xs: 1.15, sm: 1.5 } }} />

          {/* Sub-bar: Hints + Sort + View Switcher */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1.5}
            flexWrap="wrap"
            useFlexGap
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              {authenticated
                ? "支持拖拽文件/文件夹上传 · 文件夹可一键设为私密或加密分享"
                : activeDirShare
                ? "当前目录通过加密分享链接访问，可自由预览高清原图与下载文件"
                : "访客仅可浏览文件夹目录，所有文件已加密锁定、图片已模糊保护"}
            </Typography>

            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ ml: "auto" }}
            >
              <Button
                size="small"
                color="inherit"
                startIcon={<SortRoundedIcon sx={{ fontSize: 18 }} />}
                onClick={(e) => setSortMenuAnchor(e.currentTarget)}
                sx={{
                  px: 1.25,
                  py: 0.45,
                  fontSize: "0.8rem",
                  borderRadius: "10px",
                  border: "1px solid",
                  borderColor: "divider",
                  color: "text.secondary",
                }}
              >
                {SORT_LABELS[sortField]}
              </Button>

              <Tooltip title={sortOrder === "asc" ? "当前升序" : "当前降序"}>
                <Button
                  size="small"
                  color="inherit"
                  aria-label="切换排序方向"
                  onClick={handleToggleSortOrder}
                  sx={{
                    minWidth: 34,
                    px: 0.8,
                    py: 0.55,
                    borderRadius: "10px",
                    border: "1px solid",
                    borderColor: "divider",
                    color: "text.secondary",
                  }}
                >
                  {sortOrder === "asc" ? (
                    <ArrowUpwardRoundedIcon sx={{ fontSize: 17 }} />
                  ) : (
                    <ArrowDownwardRoundedIcon sx={{ fontSize: 17 }} />
                  )}
                </Button>
              </Tooltip>

              <ToggleButtonGroup
                size="small"
                exclusive
                value={viewMode}
                onChange={(_, val: ViewMode | null) => {
                  if (val) handleViewModeChange(val);
                }}
                aria-label="切换文件视图"
                sx={{
                  "& .MuiToggleButton-root": {
                    px: 1,
                    py: 0.45,
                    borderColor: "divider",
                    borderRadius: "10px !important",
                    "&.Mui-selected": {
                      color: "primary.main",
                      backgroundColor: isLight
                        ? "rgba(251, 191, 36, 0.18)"
                        : "rgba(251, 191, 36, 0.16)",
                    },
                  },
                }}
              >
                <ToggleButton value="grid" aria-label="网格卡片视图">
                  <Tooltip title="网格卡片">
                    <GridViewRoundedIcon sx={{ fontSize: 18 }} />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="list" aria-label="紧凑列表视图">
                  <Tooltip title="紧凑列表">
                    <ViewListRoundedIcon sx={{ fontSize: 18 }} />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>
        </Paper>

        {/* Sort Menu */}
        <Menu
          anchorEl={sortMenuAnchor}
          open={Boolean(sortMenuAnchor)}
          onClose={() => setSortMenuAnchor(null)}
        >
          {(["name", "date", "size"] as SortField[]).map((field) => (
            <MenuItem
              key={field}
              selected={sortField === field}
              onClick={() => handleSortFieldChange(field)}
              sx={{ minWidth: 148 }}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                {sortField === field ? (
                  <CheckRoundedIcon fontSize="small" color="primary" />
                ) : null}
              </ListItemIcon>
              <ListItemText
                primary={SORT_LABELS[field]}
                primaryTypographyProps={{ fontSize: "0.875rem" }}
              />
            </MenuItem>
          ))}
        </Menu>

        {/* File Area */}
        {loading ? (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={2}
            sx={{ flexGrow: 1, minHeight: 280 }}
          >
            <CircularProgress size={36} thickness={4} />
            <Typography variant="body2" color="text.secondary">
              正在读取云盘目录…
            </Typography>
          </Stack>
        ) : (
          <FileGrid
            files={filteredFiles}
            viewMode={viewMode}
            authenticated={authenticated}
            guestLocked={guestLocked}
            shareToken={shareToken}
            privateDirs={privateDirs}
            onCwdChange={handleCwdChange}
            multiSelected={multiSelected}
            onMultiSelect={handleMultiSelect}
            onPreviewMedia={setPreviewMedia}
            onEditTextFile={handleEditTextFile}
            onOpenShare={setShareFile}
            onTogglePrivacy={handleTogglePrivacy}
            onLockedFileClick={handleLockedFileClick}
            emptyMessage={
              <Paper
                elevation={0}
                sx={{
                  py: 8,
                  px: 3,
                  borderRadius: "22px",
                  border: "1px dashed",
                  borderColor: "divider",
                  backgroundColor: isLight
                    ? "rgba(255, 255, 255, 0.65)"
                    : "rgba(30, 27, 24, 0.55)",
                  textAlign: "center",
                }}
              >
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: "20px",
                    mx: "auto",
                    mb: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isLight
                      ? "rgba(251, 191, 36, 0.16)"
                      : "rgba(251, 191, 36, 0.12)",
                    color: "primary.main",
                  }}
                >
                  <FolderOpenRoundedIcon sx={{ fontSize: 34 }} />
                </Box>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  {search.trim() ? "没有匹配的文件" : "当前目录还是空的"}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2.5 }}
                >
                  {search.trim()
                    ? "试试更换其他关键词，或者清空搜索条件"
                    : authenticated
                    ? "拖拽文件或文件夹到这里，或点击下方按钮开始上传"
                    : "此目录暂时没有可查看的项目"}
                </Typography>
                {search.trim() ? (
                  <Button variant="outlined" onClick={onClearSearch}>
                    清除搜索
                  </Button>
                ) : authenticated ? (
                  <Button
                    variant="contained"
                    startIcon={<CloudUploadRoundedIcon />}
                    onClick={() => setShowUploadDrawer(true)}
                  >
                    立即上传文件
                  </Button>
                ) : null}
              </Paper>
            }
          />
        )}
      </Box>

      {/* Mobile Quick Upload FAB (single compact FAB so cards aren't occluded) */}
      {authenticated && multiSelected === null && (
        <Box sx={{ display: { xs: "block", sm: "none" } }}>
          <UploadFab onClick={() => setShowUploadDrawer(true)} />
        </Box>
      )}

      {/* Drawers & Dialogs */}
      <UploadDrawer
        open={showUploadDrawer}
        setOpen={setShowUploadDrawer}
        cwd={cwd}
        onUpload={() => fetchFiles(false)}
        onCreateFolder={() => {
          setNewFolderName("");
          setFolderDialogOpen(true);
        }}
        onRequireLogin={onRequireLogin}
        onNotify={onNotify}
      />

      <TextPadDrawer
        open={showTextPadDrawer}
        setOpen={setShowTextPadDrawer}
        cwd={cwd}
        authenticated={authenticated}
        shareToken={shareToken}
        initialFile={editingTextFile}
        editableFiles={editableTextFiles}
        onSelectFile={setEditingTextFile}
        onUpload={() => fetchFiles(false)}
        onRequireLogin={onRequireLogin}
        onNotify={onNotify}
      />

      <MediaPreviewDialog
        file={previewMedia}
        images={imageFiles}
        authenticated={authenticated}
        shareToken={shareToken}
        onClose={() => setPreviewMedia(null)}
        onSelectFile={setPreviewMedia}
        onCopyLink={handleCopyLink}
        onOpenShare={(f) => setShareFile(f)}
      />

      <ShareDialog
        file={shareFile}
        authenticated={authenticated}
        isPrivate={
          shareFile ? isPathInPrivateDirs(shareFile.key, privateDirs) : false
        }
        onClose={() => setShareFile(null)}
        onRequireLogin={onRequireLogin}
        onNotify={onNotify}
      />

      <MoveCopyDialog
        open={moveCopyState.open}
        mode={moveCopyState.mode}
        items={multiSelected ?? []}
        currentCwd={cwd}
        onClose={() => setMoveCopyState((prev) => ({ ...prev, open: false }))}
        onSuccess={() => {
          setMultiSelected(null);
          fetchFiles(false);
        }}
        onNotify={onNotify}
      />

      <MultiSelectToolbar
        multiSelected={multiSelected}
        totalCount={filteredFiles.length}
        authenticated={authenticated}
        onSelectAll={handleSelectAll}
        onClose={() => setMultiSelected(null)}
        onDownload={() => {
          if (multiSelected?.length !== 1 || guestLocked) return;
          const a = document.createElement("a");
          a.href = buildWebdavUrl(multiSelected[0], {
            shareToken,
            download: true,
          });
          a.download = extractFilename(multiSelected[0]);
          a.click();
        }}
        onMove={() => setMoveCopyState({ open: true, mode: "move" })}
        onCopy={() => setMoveCopyState({ open: true, mode: "copy" })}
        onRename={openRenameDialog}
        onDelete={() => setDeleteDialogOpen(true)}
        onShare={handleShareSelectedFromToolbar}
      />

      {/* Create Folder Dialog */}
      <Dialog
        open={folderDialogOpen}
        onClose={() => !dialogSubmitting && setFolderDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>新建文件夹</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="文件夹名称"
            fullWidth
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFolderName.trim()) {
                handleCreateFolderSubmit();
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            color="inherit"
            onClick={() => setFolderDialogOpen(false)}
            disabled={dialogSubmitting}
          >
            取消
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateFolderSubmit}
            disabled={dialogSubmitting || !newFolderName.trim()}
          >
            创建
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog
        open={renameDialogOpen}
        onClose={() => !dialogSubmitting && setRenameDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>重命名</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="新名称"
            fullWidth
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameValue.trim()) {
                handleRenameSubmit();
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            color="inherit"
            onClick={() => setRenameDialogOpen(false)}
            disabled={dialogSubmitting}
          >
            取消
          </Button>
          <Button
            variant="contained"
            onClick={handleRenameSubmit}
            disabled={dialogSubmitting || !renameValue.trim()}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !dialogSubmitting && setDeleteDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>确认永久删除</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            以下 {multiSelected?.length ?? 0} 个项目将被永久删除（目录会递归清理其下全部文件），操作不可撤销：
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              borderRadius: "12px",
              maxHeight: 160,
              overflowY: "auto",
              backgroundColor: "background.default",
            }}
          >
            {(multiSelected ?? []).map((key) => (
              <Typography key={key} variant="body2" fontWeight={600} noWrap>
                • {extractFilename(key)}
              </Typography>
            ))}
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            color="inherit"
            onClick={() => setDeleteDialogOpen(false)}
            disabled={dialogSubmitting}
          >
            取消
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
            disabled={dialogSubmitting}
            sx={{
              background: "#DC2626",
              "&:hover": { background: "#B91C1C" },
            }}
          >
            确认删除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Main;
