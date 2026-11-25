import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  PaletteMode,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import AudioFileRoundedIcon from "@mui/icons-material/AudioFileRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import MimeIcon, {
  getFileBadgeLabel,
  getFileCategory,
  isEditableTextFile,
} from "./MimeIcon";
import SunflowerLogo from "./SunflowerLogo";
import {
  buildWebdavUrl,
  fetchShareInfo,
  ShareInfo,
  SPA_REQUEST_HEADERS,
} from "./app/api";
import { humanReadableSize } from "./app/utils";

interface ShareLandingViewProps {
  shareToken: string;
  fileKey: string;
  colorMode: PaletteMode;
  onToggleColorMode: () => void;
  onExitShare: () => void;
  onNotify: (
    message: string,
    severity?: "success" | "info" | "warning" | "error"
  ) => void;
}

const LONG_TERM_THRESHOLD_MS = 365 * 24 * 60 * 60 * 1000;

const ShareLandingView: React.FC<ShareLandingViewProps> = ({
  shareToken,
  fileKey,
  colorMode,
  onToggleColorMode,
  onExitShare,
  onNotify,
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";

  const [loading, setLoading] = useState(true);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTextContent(null);

    fetchShareInfo(shareToken, fileKey)
      .then((info) => {
        if (cancelled) return;
        setShareInfo(info);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message || "该分享链接无效或已过期");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fileKey, shareToken]);

  useEffect(() => {
    if (!shareInfo || shareInfo.isDirectory) return;
    if (!isEditableTextFile(shareInfo.contentType, shareInfo.name)) return;
    if (shareInfo.size > 512 * 1024) return; // Skip inline text read for huge files

    let cancelled = false;
    setLoadingText(true);
    const url = buildWebdavUrl(shareInfo.key, { shareToken });

    fetch(url, { headers: SPA_REQUEST_HEADERS })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error())))
      .then((txt) => {
        if (!cancelled) setTextContent(txt);
      })
      .catch(() => {
        if (!cancelled) setTextContent(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingText(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shareInfo, shareToken]);

  const category = shareInfo
    ? getFileCategory(shareInfo.contentType, shareInfo.name)
    : "other";
  const viewUrl = shareInfo
    ? buildWebdavUrl(shareInfo.key, { shareToken })
    : "";
  const downloadUrl = shareInfo
    ? buildWebdavUrl(shareInfo.key, { shareToken, download: true })
    : "";
  const isLongTerm =
    shareInfo && shareInfo.expiresAt - Date.now() > LONG_TERM_THRESHOLD_MS;

  const handleCopyText = async () => {
    if (!textContent) return;
    try {
      await navigator.clipboard.writeText(textContent);
      onNotify("已复制文本内容", "success");
    } catch {
      onNotify("复制失败", "warning");
    }
  };

  return (
    <Stack sx={{ minHeight: "100vh" }}>
      {/* Top Bar */}
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1100,
          backgroundColor: isLight
            ? "rgba(253, 251, 247, 0.86)"
            : "rgba(20, 18, 16, 0.86)",
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ maxWidth: 1040, mx: "auto", px: { xs: 2, sm: 3 }, py: 1.5 }}
        >
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <SunflowerLogo size={32} />
            <Typography
              variant="h6"
              sx={{
                fontSize: "1.08rem",
                background: isLight
                  ? "linear-gradient(135deg, #92400E 0%, #D97706 60%, #EA580C 100%)"
                  : "linear-gradient(135deg, #FEF08A 0%, #FBBF24 55%, #F97316 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Sunflower Drive
            </Typography>
            <Chip
              icon={<VerifiedRoundedIcon sx={{ fontSize: "14px !important" }} />}
              label="安全分享"
              size="small"
              color="primary"
              variant="outlined"
              sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700 }}
            />
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1}>
            <Tooltip
              title={colorMode === "light" ? "切换到深色模式" : "切换到浅色模式"}
              disableFocusListener
            >
              <IconButton
                size="small"
                aria-label="切换深浅色主题"
                onClick={onToggleColorMode}
                sx={{
                  borderRadius: "11px",
                  border: "1px solid",
                  borderColor: "divider",
                  color: isLight ? "#B45309" : "#FBBF24",
                }}
              >
                {colorMode === "light" ? (
                  <DarkModeRoundedIcon fontSize="small" />
                ) : (
                  <LightModeRoundedIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<HomeRoundedIcon sx={{ fontSize: 17 }} />}
              onClick={onExitShare}
              sx={{ borderColor: "divider" }}
            >
              云盘主页
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* Body */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: "100%",
          maxWidth: 960,
          mx: "auto",
          px: { xs: 2, sm: 3 },
          py: { xs: 3, sm: 4 },
          display: "flex",
          flexDirection: "column",
        }}
      >
        {loading ? (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={2}
            sx={{ flexGrow: 1, minHeight: 320 }}
          >
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">
              正在验证加密分享链接…
            </Typography>
          </Stack>
        ) : error || !shareInfo ? (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3.5, sm: 5 },
              my: "auto",
              borderRadius: "24px",
              border: "1px solid",
              borderColor: "divider",
              textAlign: "center",
            }}
          >
            <Box
              sx={{
                width: 68,
                height: 68,
                borderRadius: "20px",
                mx: "auto",
                mb: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(239, 68, 68, 0.12)",
                color: "error.main",
              }}
            >
              <LinkOffRoundedIcon sx={{ fontSize: 36 }} />
            </Box>
            <Typography variant="h6" gutterBottom>
              分享链接已失效或过期
            </Typography>
            <Alert
              severity="warning"
              sx={{
                maxWidth: 420,
                mx: "auto",
                my: 2,
                borderRadius: "12px",
                textAlign: "left",
              }}
            >
              {error || "请向分享者重新获取有效的加密分享链接。"}
            </Alert>
            <Button
              variant="contained"
              startIcon={<HomeRoundedIcon />}
              onClick={onExitShare}
            >
              前往 Sunflower Drive 主页
            </Button>
          </Paper>
        ) : (
          <Stack spacing={2.5}>
            {/* File Info & Action Header Card */}
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.25, sm: 3 },
                borderRadius: "22px",
                border: "1px solid",
                borderColor: "divider",
                boxShadow: isLight
                  ? "0 8px 28px -8px rgba(120, 53, 15, 0.08)"
                  : "0 10px 30px -8px rgba(0, 0, 0, 0.35)",
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
                spacing={2}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1.75}
                  sx={{ minWidth: 0 }}
                >
                  <MimeIcon
                    contentType={shareInfo.contentType}
                    filename={shareInfo.name}
                    size="medium"
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontSize: { xs: "1.05rem", sm: "1.18rem" },
                        wordBreak: "break-all",
                      }}
                    >
                      {shareInfo.name}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                      sx={{ mt: 0.5 }}
                    >
                      <Chip
                        label={getFileBadgeLabel(
                          shareInfo.contentType,
                          shareInfo.name
                        )}
                        size="small"
                        sx={{ height: 21, fontSize: "0.7rem", fontWeight: 700 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {humanReadableSize(shareInfo.size)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ·{" "}
                        {isLongTerm
                          ? "长期有效分享"
                          : `有效期至 ${new Date(
                              shareInfo.expiresAt
                            ).toLocaleString()}`}
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    component="a"
                    href={viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<OpenInNewRoundedIcon />}
                    sx={{ borderColor: "divider" }}
                  >
                    原文件
                  </Button>
                  <Button
                    variant="contained"
                    component="a"
                    href={downloadUrl}
                    download={shareInfo.name}
                    startIcon={<DownloadRoundedIcon />}
                    sx={{ px: 2.5 }}
                  >
                    立即下载
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            {/* Unlocked Full Preview Area */}
            <Paper
              elevation={0}
              sx={{
                borderRadius: "22px",
                border: "1px solid",
                borderColor: "divider",
                overflow: "hidden",
                backgroundColor: "background.paper",
              }}
            >
              {category === "image" ? (
                <Box
                  sx={{
                    p: { xs: 2, sm: 3 },
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isLight
                      ? "rgba(251, 191, 36, 0.04)"
                      : "rgba(0, 0, 0, 0.25)",
                  }}
                >
                  <Box
                    component="img"
                    src={viewUrl}
                    alt={shareInfo.name}
                    sx={{
                      maxWidth: "100%",
                      maxHeight: "68vh",
                      objectFit: "contain",
                      borderRadius: "14px",
                      boxShadow: "0 14px 36px rgba(0, 0, 0, 0.18)",
                    }}
                  />
                </Box>
              ) : category === "video" ? (
                <Box sx={{ backgroundColor: "#000000", p: 1 }}>
                  <Box
                    component="video"
                    src={viewUrl}
                    controls
                    playsInline
                    preload="metadata"
                    sx={{
                      width: "100%",
                      maxHeight: "68vh",
                      display: "block",
                      borderRadius: "12px",
                    }}
                  />
                </Box>
              ) : category === "audio" ? (
                <Stack
                  alignItems="center"
                  spacing={2.5}
                  sx={{ py: 5, px: 3 }}
                >
                  <Box
                    sx={{
                      width: 84,
                      height: 84,
                      borderRadius: "24px",
                      background:
                        "linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(139, 92, 246, 0.24) 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "primary.main",
                    }}
                  >
                    <AudioFileRoundedIcon sx={{ fontSize: 44 }} />
                  </Box>
                  <Box
                    component="audio"
                    src={viewUrl}
                    controls
                    preload="metadata"
                    sx={{ width: "100%", maxWidth: 460 }}
                  />
                </Stack>
              ) : category === "pdf" ? (
                <Box
                  component="iframe"
                  title={shareInfo.name}
                  src={viewUrl}
                  sx={{ width: "100%", height: "70vh", border: "none" }}
                />
              ) : loadingText ? (
                <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                  <Typography variant="caption" color="text.secondary">
                    正在加载文本预览…
                  </Typography>
                </Stack>
              ) : textContent !== null ? (
                <Box>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{
                      px: 2.5,
                      py: 1.25,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      backgroundColor: isLight
                        ? "rgba(251, 191, 36, 0.05)"
                        : "rgba(251, 191, 36, 0.04)",
                    }}
                  >
                    <Typography variant="caption" fontWeight={700} color="text.secondary">
                      文本内容预览（只读）
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<ContentCopyRoundedIcon sx={{ fontSize: 16 }} />}
                      onClick={handleCopyText}
                    >
                      复制全文
                    </Button>
                  </Stack>
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      p: 2.5,
                      maxHeight: "62vh",
                      overflow: "auto",
                      fontSize: "0.86rem",
                      lineHeight: 1.65,
                      fontFamily:
                        '"Cascadia Code", "Fira Code", Consolas, "Microsoft YaHei", monospace',
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {textContent}
                  </Box>
                </Box>
              ) : (
                <Stack alignItems="center" spacing={1.5} sx={{ py: 6, px: 3 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    此文件已通过分享链接解锁
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    该格式暂不支持网页内嵌预览，请点击上方「立即下载」获取完整文件。
                  </Typography>
                </Stack>
              )}
            </Paper>
          </Stack>
        )}
      </Box>

      <Box
        component="footer"
        sx={{
          py: 2.25,
          textAlign: "center",
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Sunflower Drive · 加密签名安全分享
        </Typography>
      </Box>
    </Stack>
  );
};

export default ShareLandingView;
