import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import FolderSharedRoundedIcon from "@mui/icons-material/FolderSharedRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import { extractFilename, FileItem, isDirectory } from "./FileGrid";
import { createSignedShare } from "./app/api";

interface ShareDialogProps {
  file: FileItem | null;
  authenticated: boolean;
  isPrivate: boolean;
  onClose: () => void;
  onRequireLogin: () => void;
  onNotify: (
    message: string,
    severity?: "success" | "info" | "warning" | "error"
  ) => void;
}

const TTL_OPTIONS = [
  { label: "1 小时", seconds: 60 * 60 },
  { label: "24 小时", seconds: 24 * 60 * 60 },
  { label: "7 天", seconds: 7 * 24 * 60 * 60 },
  { label: "30 天", seconds: 30 * 24 * 60 * 60 },
  { label: "长期有效", seconds: 3650 * 24 * 60 * 60 },
];

const ShareDialog: React.FC<ShareDialogProps> = ({
  file,
  authenticated,
  isPrivate,
  onClose,
  onRequireLogin,
  onNotify,
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";

  const [ttlSeconds, setTtlSeconds] = useState(24 * 60 * 60);
  const [forceDownload, setForceDownload] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [shareResult, setShareResult] = useState<{
    pageUrl: string;
    directUrl: string | null;
    scope: "file" | "dir";
    expiresAt: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setShareResult(null);
    setError(null);
    setTtlSeconds(24 * 60 * 60);
    setForceDownload(false);
  }, [file]);

  if (!file) return null;

  const filename = extractFilename(file.key);
  const isDir = isDirectory(file);
  const isLongTerm = ttlSeconds >= 365 * 24 * 60 * 60;

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify(`已复制${label}`, "success");
    } catch {
      onNotify("复制失败，请手动选中复制", "warning");
    }
  };

  const handleGenerateSignedLink = async () => {
    if (!authenticated) {
      onRequireLogin();
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const result = await createSignedShare(
        file.key,
        ttlSeconds,
        !isDir && forceDownload
      );
      setShareResult({
        pageUrl: result.pageUrl,
        directUrl: result.directUrl,
        scope: result.scope,
        expiresAt: result.expiresAt,
      });
      onNotify(
        isDir ? "加密文件夹分享链接已生成" : "加密文件分享链接已生成",
        "success"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={Boolean(file)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.25}
            sx={{ minWidth: 0 }}
          >
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
                flexShrink: 0,
              }}
            >
              {isDir ? (
                <FolderSharedRoundedIcon fontSize="small" />
              ) : (
                <LinkRoundedIcon fontSize="small" />
              )}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontSize: "1.02rem" }}>
                {isDir ? "加密分享文件夹" : "加密分享文件"}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                display="block"
              >
                {filename}
              </Typography>
            </Box>
          </Stack>
          <IconButton size="small" aria-label="关闭分享弹窗" onClick={onClose}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5, pb: 3 }}>
        <Box
          sx={{
            p: 2.25,
            borderRadius: "16px",
            border: "1px solid",
            borderColor: "divider",
            backgroundColor: isLight
              ? "rgba(251, 191, 36, 0.05)"
              : "rgba(251, 191, 36, 0.04)",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1 }}
          >
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <ScheduleRoundedIcon
                sx={{ fontSize: 18, color: "primary.main" }}
              />
              <Typography variant="subtitle2" fontWeight={700}>
                HMAC-SHA256 签名通行链接
              </Typography>
            </Stack>
            {isPrivate && (
              <Chip
                icon={<LockRoundedIcon sx={{ fontSize: "14px !important" }} />}
                label="私密内容专属放行"
                size="small"
                color="primary"
                variant="outlined"
                sx={{ height: 22, fontSize: "0.7rem" }}
              />
            )}
          </Stack>

          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ mb: 1.75, lineHeight: 1.6 }}
          >
            {isDir
              ? "访客打开此链接后，将自动解锁该文件夹及其子目录内的全部文件与清晰原图，不会被访客加密拦截；但无法查看其他目录的加密文件。"
              : "访客通过此链接访问不会触发文件加密或图片模糊拦截，可直接高清预览或下载此文件。"}
          </Typography>

          <Stack
            direction="row"
            spacing={0.85}
            flexWrap="wrap"
            useFlexGap
            sx={{ mb: 1.75 }}
          >
            {TTL_OPTIONS.map((opt) => {
              const selected = ttlSeconds === opt.seconds;
              return (
                <Chip
                  key={opt.seconds}
                  label={opt.label}
                  clickable
                  color={selected ? "primary" : "default"}
                  variant={selected ? "filled" : "outlined"}
                  onClick={() => {
                    setTtlSeconds(opt.seconds);
                    setShareResult(null);
                  }}
                  sx={{ fontWeight: 600 }}
                />
              );
            })}
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
            spacing={1}
          >
            {!isDir ? (
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={forceDownload}
                    onChange={(e) => {
                      setForceDownload(e.target.checked);
                      setShareResult(null);
                    }}
                  />
                }
                label={
                  <Typography variant="body2" color="text.secondary">
                    直链打开即触发下载
                  </Typography>
                }
              />
            ) : (
              <Typography variant="caption" color="text.secondary">
                仅开放只读浏览、预览与下载权限
              </Typography>
            )}

            <Button
              variant="contained"
              size="small"
              onClick={handleGenerateSignedLink}
              disabled={generating}
              sx={{ px: 2.25 }}
            >
              {generating ? (
                <CircularProgress size={16} color="inherit" />
              ) : authenticated ? (
                "生成分享链接"
              ) : (
                "登录以生成分享链接"
              )}
            </Button>
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mt: 1.5, borderRadius: "10px" }}>
              {error}
            </Alert>
          )}

          {shareResult && (
            <Stack spacing={1.75} sx={{ mt: 2.25 }}>
              {/* Recommended Share Page URL */}
              <Box>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  color="primary.main"
                  sx={{ mb: 0.6, display: "block" }}
                >
                  {isDir
                    ? "文件夹分享链接（发给访客即可直接浏览）"
                    : "分享预览页链接（推荐发给好友，支持在线高清预览与下载）"}
                </Typography>
                <TextField
                  size="small"
                  fullWidth
                  value={shareResult.pageUrl}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="复制分享页链接">
                          <IconButton
                            size="small"
                            color="primary"
                            aria-label="复制分享页链接"
                            onClick={() =>
                              copyText(shareResult.pageUrl, "分享页链接")
                            }
                          >
                            <ContentCopyRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="在新标签页打开测试">
                          <IconButton
                            size="small"
                            component="a"
                            href={shareResult.pageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <OpenInNewRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      backgroundColor: "background.paper",
                      borderRadius: "10px",
                      fontSize: "0.8rem",
                    },
                  }}
                />
              </Box>

              {/* Direct Signed File Link (for downloaders / direct embedding) */}
              {shareResult.directUrl && (
                <Box>
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    color="text.secondary"
                    sx={{ mb: 0.6, display: "block" }}
                  >
                    签名文件直链（适合下载器 / 播放器 / 外链使用）
                  </Typography>
                  <TextField
                    size="small"
                    fullWidth
                    value={shareResult.directUrl}
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <Tooltip title="复制签名直链">
                            <IconButton
                              size="small"
                              aria-label="复制签名直链"
                              onClick={() =>
                                copyText(shareResult.directUrl!, "签名文件直链")
                              }
                            >
                              <ContentCopyRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        backgroundColor: "background.paper",
                        borderRadius: "10px",
                        fontSize: "0.78rem",
                      },
                    }}
                  />
                </Box>
              )}

              <Typography variant="caption" color="text.secondary">
                {isLongTerm
                  ? "有效期：长期有效"
                  : `有效期至：${new Date(
                      shareResult.expiresAt
                    ).toLocaleString()}`}
              </Typography>
            </Stack>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
