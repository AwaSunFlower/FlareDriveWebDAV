import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import CloseFullscreenRoundedIcon from "@mui/icons-material/CloseFullscreenRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DataObjectRoundedIcon from "@mui/icons-material/DataObjectRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import NoteAddRoundedIcon from "@mui/icons-material/NoteAddRounded";
import OpenInFullRoundedIcon from "@mui/icons-material/OpenInFullRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import { encodeKey, extractFilename, FileItem } from "./FileGrid";
import { getMimeTypeForFilename } from "./MimeIcon";
import { buildWebdavUrl, SPA_REQUEST_HEADERS } from "./app/api";

interface TextPadDrawerProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  cwd: string;
  authenticated: boolean;
  shareToken?: string;
  initialFile: FileItem | null;
  editableFiles: FileItem[];
  onSelectFile: (file: FileItem | null) => void;
  onUpload: () => void;
  onRequireLogin: () => void;
  onNotify: (
    message: string,
    severity?: "success" | "info" | "warning" | "error"
  ) => void;
}

const EXT_PRESETS = [".txt", ".md", ".json", ".js"];
const DRAFT_STORAGE_PREFIX = "sunflower_textpad_draft_";

function makeTimestampFilename() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate()
  )}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `note-${stamp}.txt`;
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const pattern =
    /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("`")) {
      tokens.push(
        <Box
          key={`code-${keyIdx++}`}
          component="code"
          sx={{
            px: 0.7,
            py: 0.15,
            borderRadius: "6px",
            fontSize: "0.85em",
            fontFamily:
              '"Cascadia Code", "Fira Code", Consolas, monospace',
            backgroundColor: "action.hover",
          }}
        >
          {token.slice(1, -1)}
        </Box>
      );
    } else if (token.startsWith("**")) {
      tokens.push(
        <strong key={`b-${keyIdx++}`}>{token.slice(2, -2)}</strong>
      );
    } else if (token.startsWith("*")) {
      tokens.push(<em key={`i-${keyIdx++}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("[")) {
      tokens.push(
        <Box
          key={`a-${keyIdx++}`}
          component="a"
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: "primary.main",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
        >
          {match[2]}
        </Box>
      );
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }
  return tokens;
}

function SimpleMarkdownPreview({ content }: { content: string }) {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";

  if (!content.trim()) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        暂无 Markdown 内容可预览…
      </Typography>
    );
  }

  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let keyCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        blocks.push(
          <Box
            key={`cb-${keyCounter++}`}
            component="pre"
            sx={{
              p: 1.5,
              my: 1.25,
              borderRadius: "12px",
              overflowX: "auto",
              fontSize: "0.84rem",
              fontFamily:
                '"Cascadia Code", "Fira Code", Consolas, monospace',
              backgroundColor: isLight
                ? "rgba(41, 32, 24, 0.06)"
                : "rgba(0, 0, 0, 0.35)",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <code>{codeLines.join("\n")}</code>
          </Box>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push(<Divider key={`hr-${keyCounter++}`} sx={{ my: 1.5 }} />);
    } else if (line.startsWith("### ")) {
      blocks.push(
        <Typography
          key={`h3-${keyCounter++}`}
          variant="subtitle1"
          fontWeight={700}
          sx={{ mt: 1.5, mb: 0.5 }}
        >
          {renderInlineMarkdown(line.slice(4))}
        </Typography>
      );
    } else if (line.startsWith("## ")) {
      blocks.push(
        <Typography
          key={`h2-${keyCounter++}`}
          variant="h6"
          fontWeight={700}
          sx={{ mt: 2, mb: 0.75, fontSize: "1.1rem" }}
        >
          {renderInlineMarkdown(line.slice(3))}
        </Typography>
      );
    } else if (line.startsWith("# ")) {
      blocks.push(
        <Typography
          key={`h1-${keyCounter++}`}
          variant="h5"
          fontWeight={800}
          sx={{
            mt: 1,
            mb: 1,
            pb: 0.5,
            fontSize: "1.3rem",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          {renderInlineMarkdown(line.slice(2))}
        </Typography>
      );
    } else if (line.startsWith("> ")) {
      blocks.push(
        <Box
          key={`bq-${keyCounter++}`}
          sx={{
            pl: 1.75,
            py: 0.4,
            my: 0.75,
            borderLeft: "3px solid",
            borderColor: "primary.main",
            color: "text.secondary",
          }}
        >
          <Typography variant="body2">
            {renderInlineMarkdown(line.slice(2))}
          </Typography>
        </Box>
      );
    } else if (/^[-*+]\s+/.test(line)) {
      blocks.push(
        <Typography
          key={`li-${keyCounter++}`}
          variant="body2"
          sx={{ pl: 1.5, my: 0.35, lineHeight: 1.7 }}
        >
          • {renderInlineMarkdown(line.replace(/^[-*+]\s+/, ""))}
        </Typography>
      );
    } else if (/^\d+\.\s+/.test(line)) {
      blocks.push(
        <Typography
          key={`oli-${keyCounter++}`}
          variant="body2"
          sx={{ pl: 1.5, my: 0.35, lineHeight: 1.7 }}
        >
          {renderInlineMarkdown(line)}
        </Typography>
      );
    } else if (!line.trim()) {
      blocks.push(<Box key={`sp-${keyCounter++}`} sx={{ height: 8 }} />);
    } else {
      blocks.push(
        <Typography
          key={`p-${keyCounter++}`}
          variant="body2"
          sx={{ my: 0.4, lineHeight: 1.75 }}
        >
          {renderInlineMarkdown(line)}
        </Typography>
      );
    }
  }

  return <Box sx={{ p: 2.25 }}>{blocks}</Box>;
}

const TextPadDrawer: React.FC<TextPadDrawerProps> = ({
  open,
  setOpen,
  cwd,
  authenticated,
  shareToken,
  initialFile,
  editableFiles,
  onSelectFile,
  onUpload,
  onRequireLogin,
  onNotify,
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";

  const [noteText, setNoteText] = useState("");
  const [noteName, setNoteName] = useState(makeTimestampFilename);
  const [originalText, setOriginalText] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editorTab, setEditorTab] = useState<"edit" | "preview">("edit");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [fileMenuAnchor, setFileMenuAnchor] = useState<null | HTMLElement>(
    null
  );
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const draftKey = `${DRAFT_STORAGE_PREFIX}${cwd || "root"}`;
  const isEditingExisting = Boolean(initialFile);
  const isMarkdown = /\.(md|markdown)$/i.test(noteName.trim());
  const isJson = /\.json$/i.test(noteName.trim());
  const isDirty = noteText !== originalText;

  // Load existing file or restore local draft when drawer opens / file switches
  useEffect(() => {
    if (!open) return;
    setFormatError(null);
    setEditorTab("edit");

    if (initialFile) {
      let cancelled = false;
      const filename = extractFilename(initialFile.key);
      setNoteName(filename);
      setLoadingFile(true);
      setLastSavedAt(null);

      fetch(buildWebdavUrl(initialFile.key, { shareToken }), {
        cache: "no-store",
        headers: SPA_REQUEST_HEADERS,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`读取文件失败 (${res.status})`);
          return res.text();
        })
        .then((text) => {
          if (cancelled) return;
          setNoteText(text);
          setOriginalText(text);
        })
        .catch((err: Error) => {
          if (cancelled) return;
          onNotify(err.message || "无法读取文件内容", "error");
          setNoteText("");
          setOriginalText("");
        })
        .finally(() => {
          if (!cancelled) setLoadingFile(false);
        });

      return () => {
        cancelled = true;
      };
    }

    // New note mode: try restoring local draft
    setLoadingFile(false);
    setLastSavedAt(null);
    try {
      const savedDraft = window.localStorage.getItem(draftKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft) as {
          name?: string;
          text?: string;
        };
        setNoteName(parsed.name || makeTimestampFilename());
        setNoteText(parsed.text || "");
        setOriginalText("");
        return;
      }
    } catch {
      // ignore invalid draft
    }
    setNoteName(makeTimestampFilename());
    setNoteText("");
    setOriginalText("");
  }, [draftKey, initialFile, onNotify, open, shareToken]);

  // Persist new-note draft automatically so closing never loses work
  useEffect(() => {
    if (!open || isEditingExisting) return;
    try {
      if (noteText.trim()) {
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({ name: noteName, text: noteText })
        );
      } else {
        window.localStorage.removeItem(draftKey);
      }
    } catch {
      // ignore storage errors
    }
  }, [draftKey, isEditingExisting, noteName, noteText, open]);

  const overwriteWarning = useMemo(() => {
    if (isEditingExisting) return false;
    const trimmed = noteName.trim().toLowerCase();
    if (!trimmed) return false;
    return editableFiles.some(
      (f) => extractFilename(f.key).toLowerCase() === trimmed
    );
  }, [editableFiles, isEditingExisting, noteName]);

  const stats = useMemo(() => {
    const chars = noteText.length;
    const lines = noteText ? noteText.split("\n").length : 0;
    const bytes = new Blob([noteText]).size;
    return { chars, lines, bytes };
  }, [noteText]);

  const applyExtension = (ext: string) => {
    const trimmed = noteName.trim() || "note";
    const base = trimmed.replace(/\.(txt|md|markdown|json|js|ts)$/i, "");
    setNoteName(`${base}${ext}`);
    setFormatError(null);
  };

  const handleSaveNote = useCallback(async () => {
    if (!authenticated) {
      onNotify("请先登录管理员账号再保存到云盘", "info");
      onRequireLogin();
      return;
    }
    const finalName = noteName.trim();
    if (!finalName || saving) return;
    if (finalName.includes("/")) {
      onNotify("文件名不能包含 /", "warning");
      return;
    }

    const targetKey = initialFile
      ? initialFile.key.replace(/[^/]+$/, finalName)
      : `${cwd}${finalName}`;
    const mimeType = getMimeTypeForFilename(finalName);

    setSaving(true);
    try {
      const res = await fetch(`/webdav/${encodeKey(targetKey)}`, {
        method: "PUT",
        headers: {
          "Content-Type": mimeType,
          ...SPA_REQUEST_HEADERS,
        },
        body: new Blob([noteText], { type: mimeType }),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          onRequireLogin();
          throw new Error("保存失败：请先登录管理员账号");
        }
        throw new Error(`保存失败 (${res.status})`);
      }

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");

      setOriginalText(noteText);
      setLastSavedAt(`${hh}:${mm}:${ss}`);
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
      onNotify(`已保存并上传：${finalName}`, "success");
      onUpload();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  }, [
    authenticated,
    cwd,
    draftKey,
    initialFile,
    noteName,
    noteText,
    onNotify,
    onRequireLogin,
    onUpload,
    saving,
  ]);

  // Ctrl+S / Cmd+S shortcut while open
  useEffect(() => {
    if (!open) return;
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (noteName.trim() && !saving && !loadingFile) {
          handleSaveNote();
        }
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [handleSaveNote, loadingFile, noteName, open, saving]);

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(noteText);
      setNoteText(JSON.stringify(parsed, null, 2));
      setFormatError(null);
      onNotify("JSON 已格式化", "success");
    } catch (err) {
      setFormatError(
        err instanceof Error ? `JSON 语法错误：${err.message}` : "JSON 语法错误"
      );
    }
  };

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(noteText);
      onNotify("已复制全部内容", "success");
    } catch {
      onNotify("复制失败", "warning");
    }
  };

  const handleInsertTimestamp = () => {
    const stamp = new Date().toLocaleString();
    setNoteText((prev) => (prev ? `${prev}\n${stamp}\n` : `${stamp}\n`));
  };

  const handleDownloadLocal = () => {
    const finalName = noteName.trim() || "note.txt";
    const blob = new Blob([noteText], {
      type: getMimeTypeForFilename(finalName),
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = finalName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEditorKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === "Tab" && textareaRef.current) {
      e.preventDefault();
      const el = textareaRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = `${noteText.slice(0, start)}  ${noteText.slice(end)}`;
      setNoteText(next);
      window.requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      });
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={() => setOpen(false)}
      PaperProps={{
        role: "dialog",
        "aria-label": "TextPad 在线记事本",
        sx: {
          width: expanded
            ? { xs: "100vw", md: "min(920px, 92vw)" }
            : { xs: "100vw", sm: 520 },
          transition: "width 0.22s ease",
          backgroundColor: "background.default",
          borderLeft: "1px solid",
          borderColor: "divider",
        },
      }}
    >
      <Box
        sx={{
          p: { xs: 2, sm: 2.75 },
          display: "flex",
          flexDirection: "column",
          height: "100%",
          gap: 1.75,
        }}
      >
        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
        >
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "12px",
                backgroundColor: isLight
                  ? "rgba(251, 191, 36, 0.2)"
                  : "rgba(251, 191, 36, 0.16)",
                color: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <NoteAddRoundedIcon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={0.85}>
                <Typography
                  variant="h6"
                  noWrap
                  sx={{ fontSize: "1.04rem", lineHeight: 1.25 }}
                >
                  TextPad 在线记事本
                </Typography>
                {isEditingExisting ? (
                  <Chip
                    label="编辑云端文件"
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700 }}
                  />
                ) : (
                  <Chip
                    label="新建"
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      backgroundColor: isLight
                        ? "rgba(251, 191, 36, 0.2)"
                        : "rgba(251, 191, 36, 0.14)",
                      color: "primary.main",
                    }}
                  />
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                路径：{cwd ? `/${cwd}` : "根目录"}
                {isDirty ? " · 有未保存修改" : lastSavedAt ? ` · 已于 ${lastSavedAt} 保存` : ""}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
            {editableFiles.length > 0 && (
              <Tooltip title="打开当前目录已有文本文件">
                <IconButton
                  size="small"
                  aria-label="打开已有文本文件"
                  onClick={(e) => setFileMenuAnchor(e.currentTarget)}
                >
                  <FolderOpenRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {isEditingExisting && (
              <Tooltip title="新建空白笔记">
                <IconButton
                  size="small"
                  aria-label="新建空白笔记"
                  onClick={() => onSelectFile(null)}
                >
                  <AddRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={expanded ? "恢复侧栏宽度" : "展开宽屏编辑"}>
              <IconButton
                size="small"
                aria-label="切换宽屏模式"
                onClick={() => setExpanded((v) => !v)}
                sx={{ display: { xs: "none", md: "inline-flex" } }}
              >
                {expanded ? (
                  <CloseFullscreenRoundedIcon fontSize="small" />
                ) : (
                  <OpenInFullRoundedIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
            <IconButton
              size="small"
              aria-label="关闭记事本"
              onClick={() => setOpen(false)}
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        {/* Quick Open Existing Text File Menu */}
        <Menu
          anchorEl={fileMenuAnchor}
          open={Boolean(fileMenuAnchor)}
          onClose={() => setFileMenuAnchor(null)}
        >
          <MenuItem
            selected={!initialFile}
            onClick={() => {
              setFileMenuAnchor(null);
              onSelectFile(null);
            }}
          >
            + 新建空白笔记
          </MenuItem>
          <Divider />
          {editableFiles.map((file) => (
            <MenuItem
              key={file.key}
              selected={initialFile?.key === file.key}
              onClick={() => {
                setFileMenuAnchor(null);
                onSelectFile(file);
              }}
              sx={{ maxWidth: 320 }}
            >
              <Typography variant="body2" noWrap>
                {extractFilename(file.key)}
              </Typography>
            </MenuItem>
          ))}
        </Menu>

        {/* Filename + Extension Presets */}
        <Box sx={{ mt: 0.25 }}>
          <TextField
            label="文件名"
            size="small"
            value={noteName}
            disabled={isEditingExisting}
            onChange={(e) => {
              setNoteName(e.target.value);
              setFormatError(null);
            }}
            fullWidth
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: "background.paper",
                borderRadius: "12px",
              },
            }}
          />

          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            useFlexGap
            spacing={1}
            sx={{ mt: 1 }}
          >
            {/* Suffix presets (only when creating new file) */}
            <Stack direction="row" spacing={0.6} alignItems="center">
              {!isEditingExisting &&
                EXT_PRESETS.map((ext) => {
                  const active = noteName.toLowerCase().endsWith(ext);
                  return (
                    <Chip
                      key={ext}
                      label={ext}
                      size="small"
                      clickable
                      onClick={() => applyExtension(ext)}
                      color={active ? "primary" : "default"}
                      variant={active ? "filled" : "outlined"}
                      sx={{ height: 24, fontSize: "0.72rem", fontWeight: 600 }}
                    />
                  );
                })}
              {isMarkdown && (
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={editorTab}
                  onChange={(_, val: "edit" | "preview" | null) => {
                    if (val) setEditorTab(val);
                  }}
                  sx={{
                    "& .MuiToggleButton-root": {
                      py: 0.2,
                      px: 1,
                      fontSize: "0.74rem",
                      borderRadius: "8px !important",
                    },
                  }}
                >
                  <ToggleButton value="edit">
                    <EditRoundedIcon sx={{ fontSize: 15, mr: 0.4 }} />
                    编辑
                  </ToggleButton>
                  <ToggleButton value="preview">
                    <VisibilityRoundedIcon sx={{ fontSize: 15, mr: 0.4 }} />
                    预览
                  </ToggleButton>
                </ToggleButtonGroup>
              )}
            </Stack>

            {/* Quick Editor Utility Buttons */}
            <Stack direction="row" spacing={0.25} alignItems="center">
              {isJson && (
                <Tooltip title="格式化 JSON">
                  <IconButton
                    size="small"
                    aria-label="格式化 JSON"
                    onClick={handleFormatJson}
                    disabled={!noteText.trim()}
                    sx={{ color: "primary.main" }}
                  >
                    <DataObjectRoundedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="插入当前时间">
                <IconButton
                  size="small"
                  aria-label="插入当前时间"
                  onClick={handleInsertTimestamp}
                >
                  <AccessTimeRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="复制全部内容">
                <IconButton
                  size="small"
                  aria-label="复制全部内容"
                  disabled={!noteText}
                  onClick={handleCopyContent}
                >
                  <ContentCopyRoundedIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="下载到本地">
                <IconButton
                  size="small"
                  aria-label="下载到本地"
                  disabled={!noteText}
                  onClick={handleDownloadLocal}
                >
                  <DownloadRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>

        {overwriteWarning && (
          <Alert severity="warning" sx={{ py: 0.25, borderRadius: "12px" }}>
            当前目录已存在同名文件「{noteName.trim()}」，保存将覆盖原文件。
          </Alert>
        )}

        {formatError && (
          <Alert
            severity="error"
            onClose={() => setFormatError(null)}
            sx={{ py: 0.25, borderRadius: "12px" }}
          >
            {formatError}
          </Alert>
        )}

        {/* Editor or Markdown Preview Body */}
        {loadingFile ? (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={1.5}
            sx={{
              flexGrow: 1,
              borderRadius: "14px",
              border: "1px solid",
              borderColor: "divider",
              backgroundColor: "background.paper",
            }}
          >
            <CircularProgress size={30} />
            <Typography variant="caption" color="text.secondary">
              正在加载文件内容…
            </Typography>
          </Stack>
        ) : isMarkdown && editorTab === "preview" ? (
          <Box
            sx={{
              flexGrow: 1,
              overflowY: "auto",
              borderRadius: "14px",
              border: "1px solid",
              borderColor: "divider",
              backgroundColor: "background.paper",
            }}
          >
            <SimpleMarkdownPreview content={noteText} />
          </Box>
        ) : (
          <Box
            component="textarea"
            ref={textareaRef}
            placeholder="在这里输入笔记、脚本或配置内容…（支持 Tab 缩进、Ctrl+S 快捷保存）"
            value={noteText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
              setNoteText(e.target.value);
              if (formatError) setFormatError(null);
            }}
            onKeyDown={handleEditorKeyDown}
            aria-label="文本编辑区"
            sx={{
              flexGrow: 1,
              width: "100%",
              minHeight: 260,
              resize: "none",
              p: 2,
              borderRadius: "14px",
              border: "1px solid",
              borderColor: "divider",
              backgroundColor: "background.paper",
              color: "text.primary",
              fontFamily:
                '"Cascadia Code", "Fira Code", Consolas, "Microsoft YaHei", monospace',
              fontSize: "0.89rem",
              lineHeight: 1.65,
              outline: "none",
              transition: "border-color 0.18s ease, box-shadow 0.18s ease",
              "&:focus": {
                borderColor: "primary.main",
                boxShadow: isLight
                  ? "0 0 0 3px rgba(245, 158, 11, 0.16)"
                  : "0 0 0 3px rgba(251, 191, 36, 0.16)",
              },
              "&::placeholder": {
                color: "text.secondary",
                opacity: 0.7,
              },
            }}
          />
        )}

        {/* Footer Actions */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1.5}
        >
          <Stack direction="row" alignItems="center" spacing={0.75}>
            {lastSavedAt && !isDirty && (
              <CheckCircleOutlineRoundedIcon
                color="success"
                sx={{ fontSize: 16 }}
              />
            )}
            <Typography variant="caption" color="text.secondary">
              {stats.lines} 行 · {stats.chars} 字符 · {stats.bytes} B
              {!isEditingExisting && noteText.trim() ? " · 草稿已暂存" : ""}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              disabled={!noteText || saving}
              onClick={() => setNoteText("")}
              sx={{ borderColor: "divider" }}
            >
              清空
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={
                saving ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <CloudUploadRoundedIcon />
                )
              }
              onClick={handleSaveNote}
              disabled={
                saving ||
                loadingFile ||
                !noteName.trim() ||
                (!isEditingExisting && !noteText.trim())
              }
              sx={{ px: 2 }}
            >
              {saving
                ? "保存中…"
                : authenticated
                ? "保存并上传 (Ctrl+S)"
                : "登录以保存"}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Drawer>
  );
};

export default TextPadDrawer;
