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
  Divider,
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
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import { encodeKey, extractFilename, FileItem } from "./FileGrid";
import { createSignedShare } from "./app/api";

interface ShareDialogProps {
  file: FileItem | null;
  authenticated: boolean;
  isPrivate: boolean;
  publicRead: boolean;
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
];

const ShareDialog: React.FC<ShareDialogProps> = ({
  file,
  authenticated,
  isPrivate,
  publicRead,
  onClose,
  onRequireLogin,
  onNotify,
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";

  const [ttlSeconds, setTtlSeconds] = useState(24 * 60 * 60);
  const [forceDownload, setForceDownload] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSignedUrl(null);
    setExpiresAt(null);
    setError(null);
    setTtlSeconds(24 * 60 * 60);
    setForceDownload(false);
  }, [file]);

  if (!file) return null;

  const filename = extractFilename(file.key);
  const directPublicUrl = new URL(
    `/webdav/${encodeKey(file.key)}`,
    window.location.href
  ).toString();
  const canUsePublicLink = publicRead && !isPrivate;

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
        forceDownload
      );
      setSignedUrl(result.url);
      setExpiresAt(result.expiresAt);
      onNotify("限时加密分享链接已生成", "success");
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
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
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
              <LinkRoundedIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontSize: "1.02rem" }}>
                分享文件
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {filename}
              </Typography>
            </Box>
          </Stack>
          <IconButton size="small" aria-label="关闭分享弹窗" onClick={onClose}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5 }}>
        <Stack spacing={2.5}>
          {/* Timed Encrypted Share Section */}
          <Box
            sx={{
              p: 2,
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
              sx={{ mb: 1.25 }}
            >
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <ScheduleRoundedIcon
                  sx={{ fontSize: 18, color: "primary.main" }}
                />
                <Typography variant="subtitle2" fontWeight={700}>
                  限时加密签名链接
                </Typography>
              </Stack>
              {isPrivate && (
                <Chip
                  icon={<LockRoundedIcon sx={{ fontSize: "14px !important" }} />}
                  label="私密文件专属可用"
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
              sx={{ mb: 1.5 }}
            >
              使用 HMAC-SHA256 签名，仅限访问此单个文件，到期后自动失效（即使位于私密目录也可安全分享）。
            </Typography>

            <Stack
              direction="row"
              spacing={0.85}
              flexWrap="wrap"
              useFlexGap
              sx={{ mb: 1.5 }}
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
                      setSignedUrl(null);
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
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={forceDownload}
                    onChange={(e) => {
                      setForceDownload(e.target.checked);
                      setSignedUrl(null);
                    }}
                  />
                }
                label={
                  <Typography variant="body2" color="text.secondary">
                    打开即触发下载
                  </Typography>
                }
              />

              <Button
                variant="contained"
                size="small"
                onClick={handleGenerateSignedLink}
                disabled={generating}
                sx={{ px: 2 }}
              >
                {generating ? (
                  <CircularProgress size={16} color="inherit" />
                ) : authenticated ? (
                  "生成限时链接"
                ) : (
                  "登录以生成限时链接"
                )}
              </Button>
            </Stack>

            {error && (
              <Alert severity="error" sx={{ mt: 1.5, borderRadius: "10px" }}>
                {error}
              </Alert>
            )}

            {signedUrl && (
              <Box sx={{ mt: 2 }}>
                <TextField
                  size="small"
                  fullWidth
                  value={signedUrl}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="复制限时链接">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => copyText(signedUrl, "限时分享链接")}
                          >
                            <ContentCopyRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="在新标签页打开测试">
                          <IconButton
                            size="small"
                            component="a"
                            href={signedUrl}
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
                {expiresAt && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.75, display: "block" }}
                  >
                    有效期至：{new Date(expiresAt).toLocaleString()}
                  </Typography>
                )}
              </Box>
            )}
          </Box>

          {/* Standard Public Direct Link */}
          {canUsePublicLink && (
            <>
              <Divider>
                <Typography variant="caption" color="text.secondary">
                  或使用公开直链
                </Typography>
              </Divider>
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 0.75, display: "block" }}
                >
                  永久直链（仅在公开只读开启且文件不在私密目录时可免登录访问）：
                </Typography>
                <TextField
                  size="small"
                  fullWidth
                  value={directPublicUrl}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="复制公开直链">
                          <IconButton
                            size="small"
                            onClick={() => copyText(directPublicUrl, "公开直链")}
                          >
                            <ContentCopyRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "10px",
                      fontSize: "0.8rem",
                    },
                  }}
                />
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
