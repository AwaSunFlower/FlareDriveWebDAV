import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import AutoDeleteRoundedIcon from "@mui/icons-material/AutoDeleteRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CloudQueueRoundedIcon from "@mui/icons-material/CloudQueueRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import {
  cleanupOrphanThumbnails,
  fetchStorageStats,
  StorageStats,
} from "./app/api";
import { humanReadableSize } from "./app/utils";

interface StorageStatsDialogProps {
  open: boolean;
  onClose: () => void;
  onNotify?: (
    message: string,
    severity?: "success" | "info" | "warning" | "error"
  ) => void;
}

const CATEGORY_META: Array<{
  key: keyof StorageStats["categories"];
  label: string;
  color: string;
}> = [
  { key: "image", label: "图片", color: "#10B981" },
  { key: "video", label: "视频", color: "#F43F5E" },
  { key: "audio", label: "音频", color: "#8B5CF6" },
  { key: "archive", label: "压缩包", color: "#F97316" },
  { key: "document", label: "文档 / PDF", color: "#6366F1" },
  { key: "code", label: "代码 / 配置", color: "#0EA5E9" },
  { key: "other", label: "其他文件", color: "#78716C" },
];

const StorageStatsDialog: React.FC<StorageStatsDialogProps> = ({
  open,
  onClose,
  onNotify,
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";

  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchStorageStats()
      .then((data) => setStats(data))
      .catch((err: Error) => setError(err.message || "加载统计信息失败"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) {
      setShowSamples(false);
      loadStats();
    }
  }, [loadStats, open]);

  const handleCleanup = async () => {
    setCleaning(true);
    try {
      const res = await cleanupOrphanThumbnails();
      setStats(res.stats);
      setShowSamples(false);
      onNotify?.(
        res.deletedCount > 0
          ? `已清理 ${res.deletedCount} 个孤儿缩略图，释放 ${humanReadableSize(
              res.freedBytes
            )}`
          : "未发现可清理的孤儿缩略图",
        "success"
      );
    } catch (err) {
      onNotify?.(
        err instanceof Error ? err.message : "清理孤儿缩略图失败",
        "error"
      );
    } finally {
      setCleaning(false);
    }
  };

  const usagePercent =
    stats && stats.quotaBytes > 0
      ? Math.min(100, (stats.totalSize / stats.quotaBytes) * 100)
      : 0;

  const orphans = stats?.orphanThumbnails ?? null;
  const validThumbs =
    stats && orphans
      ? Math.max(
          0,
          (stats.thumbnailCount ?? 0) -
            orphans.count -
            orphans.protectedRecentCount
        )
      : stats?.thumbnailCount ?? 0;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
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
              <CloudQueueRoundedIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontSize: "1.02rem" }}>
                空间统计与存储维护
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                Cloudflare R2 免费 10 GB 额度 · 孤儿缩略图检测
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="刷新统计">
              <span>
                <IconButton
                  size="small"
                  onClick={loadStats}
                  disabled={loading || cleaning}
                >
                  <RefreshRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton size="small" aria-label="关闭统计弹窗" onClick={onClose}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5, pb: 3 }}>
        {loading && !stats ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }}>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">
              正在扫描存储桶与缩略图引用…
            </Typography>
          </Stack>
        ) : error ? (
          <Alert severity="error" sx={{ borderRadius: "12px" }}>
            {error}
          </Alert>
        ) : stats ? (
          <Stack spacing={2.5}>
            {/* Quota Progress Card */}
            <Paper
              elevation={0}
              sx={{
                p: 2.25,
                borderRadius: "16px",
                border: "1px solid",
                borderColor: "divider",
                backgroundColor: isLight
                  ? "rgba(251, 191, 36, 0.06)"
                  : "rgba(251, 191, 36, 0.05)",
              }}
            >
              <Stack
                direction="row"
                alignItems="baseline"
                justifyContent="space-between"
                sx={{ mb: 1 }}
              >
                <Typography variant="h5" fontWeight={800}>
                  {humanReadableSize(stats.totalSize)}
                  <Typography
                    component="span"
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 0.75 }}
                  >
                    / {humanReadableSize(stats.quotaBytes)}
                  </Typography>
                </Typography>
                <Chip
                  size="small"
                  label={`${usagePercent.toFixed(2)}%`}
                  color="primary"
                  sx={{ fontWeight: 700, height: 22 }}
                />
              </Stack>

              <LinearProgress
                variant="determinate"
                value={Math.max(usagePercent, stats.totalSize > 0 ? 1 : 0)}
                sx={{
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: isLight
                    ? "rgba(180, 83, 9, 0.12)"
                    : "rgba(251, 191, 36, 0.12)",
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 999,
                    background:
                      "linear-gradient(90deg, #F59E0B 0%, #EA580C 100%)",
                  },
                }}
              />

              <Grid container spacing={1.5} sx={{ mt: 1.5 }}>
                <Grid item xs={stats.includesPrivate ? 3 : 4}>
                  <Typography variant="caption" color="text.secondary">
                    文件总数
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {stats.totalFiles}
                  </Typography>
                </Grid>
                <Grid item xs={stats.includesPrivate ? 3 : 4}>
                  <Typography variant="caption" color="text.secondary">
                    文件夹数
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {stats.totalFolders}
                  </Typography>
                </Grid>
                {stats.includesPrivate ? (
                  <>
                    <Grid item xs={3}>
                      <Typography variant="caption" color="text.secondary">
                        有效缩略图
                      </Typography>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {validThumbs}
                      </Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="caption" color="text.secondary">
                        孤儿缩略图
                      </Typography>
                      <Typography
                        variant="subtitle1"
                        fontWeight={700}
                        color={
                          (orphans?.count ?? 0) > 0
                            ? "warning.main"
                            : "success.main"
                        }
                      >
                        {orphans?.count ?? 0}
                      </Typography>
                    </Grid>
                  </>
                ) : (
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">
                      统计范围
                    </Typography>
                    <Typography variant="subtitle2" fontWeight={700}>
                      公开目录
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>

            {/* Orphan Thumbnails One-Click Cleanup Card (Admin only) */}
            {orphans && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: "16px",
                  border: "1px solid",
                  borderColor:
                    orphans.count > 0 ? "warning.main" : "success.main",
                  backgroundColor:
                    orphans.count > 0
                      ? isLight
                        ? "rgba(245, 158, 11, 0.08)"
                        : "rgba(245, 158, 11, 0.06)"
                      : isLight
                      ? "rgba(16, 185, 129, 0.08)"
                      : "rgba(16, 185, 129, 0.06)",
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  justifyContent="space-between"
                  spacing={1.5}
                >
                  <Stack direction="row" alignItems="center" spacing={1.25}>
                    {orphans.count > 0 ? (
                      <WarningAmberRoundedIcon color="warning" />
                    ) : (
                      <CheckCircleRoundedIcon color="success" />
                    )}
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {orphans.count > 0
                          ? `发现 ${orphans.count} 个无主孤儿缩略图（可释放 ${humanReadableSize(
                              orphans.size
                            )}）`
                          : "缩略图缓存非常干净"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {orphans.count > 0
                          ? "原文件已删除但遗留了缩略图缓存，一键清理不影响任何现有文件。"
                          : `共 ${stats.thumbnailCount ?? 0} 个缩略图（${humanReadableSize(
                              stats.thumbnailSize ?? 0
                            )}）均正常关联。`}
                        {orphans.protectedRecentCount > 0 &&
                          `（另有 ${orphans.protectedRecentCount} 个 5 分钟内新上传项已自动保护）`}
                      </Typography>
                    </Box>
                  </Stack>

                  {orphans.count > 0 && (
                    <Stack direction="row" spacing={1} flexShrink={0}>
                      <Button
                        size="small"
                        color="inherit"
                        endIcon={
                          showSamples ? (
                            <ExpandLessRoundedIcon />
                          ) : (
                            <ExpandMoreRoundedIcon />
                          )
                        }
                        onClick={() => setShowSamples((v) => !v)}
                      >
                        明细
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="warning"
                        disabled={cleaning || loading}
                        startIcon={
                          cleaning ? (
                            <CircularProgress size={14} color="inherit" />
                          ) : (
                            <AutoDeleteRoundedIcon />
                          )
                        }
                        onClick={handleCleanup}
                      >
                        {cleaning ? "清理中…" : "一键清理"}
                      </Button>
                    </Stack>
                  )}
                </Stack>

                <Collapse in={showSamples && orphans.samples.length > 0}>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ maxHeight: 140, overflowY: "auto" }}>
                    {orphans.samples.map((s) => (
                      <Stack
                        key={s.name}
                        direction="row"
                        justifyContent="space-between"
                        sx={{ py: 0.35 }}
                      >
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{ fontFamily: "monospace", maxWidth: "68%" }}
                        >
                          {s.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {humanReadableSize(s.size)}
                        </Typography>
                      </Stack>
                    ))}
                  </Box>
                </Collapse>
              </Paper>
            )}

            {/* Category Breakdown */}
            <Box>
              <Typography
                variant="subtitle2"
                fontWeight={700}
                sx={{ mb: 1.25 }}
              >
                按文件类型分布
              </Typography>
              <Stack spacing={1.25}>
                {CATEGORY_META.map(({ key, label, color }) => {
                  const cat = stats.categories[key];
                  const baseSize = stats.userFilesSize ?? stats.totalSize;
                  const ratio =
                    baseSize > 0 ? (cat.size / baseSize) * 100 : 0;
                  return (
                    <Box key={key}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ mb: 0.4 }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              backgroundColor: color,
                            }}
                          />
                          <Typography variant="body2" fontWeight={600}>
                            {label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ({cat.count})
                          </Typography>
                        </Stack>
                        <Typography
                          variant="caption"
                          fontWeight={600}
                          color="text.secondary"
                          sx={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {humanReadableSize(cat.size)}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={ratio}
                        sx={{
                          height: 5,
                          borderRadius: 999,
                          backgroundColor: isLight
                            ? "rgba(0,0,0,0.06)"
                            : "rgba(255,255,255,0.08)",
                          "& .MuiLinearProgress-bar": {
                            borderRadius: 999,
                            backgroundColor: color,
                          },
                        }}
                      />
                    </Box>
                  );
                })}
              </Stack>
            </Box>

            {/* Top 5 Largest Files */}
            {stats.largestFiles && stats.largestFiles.length > 0 && (
              <Box>
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  sx={{ mb: 1 }}
                >
                  空间占用 Top {stats.largestFiles.length} 大文件
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{ borderRadius: "14px", p: 1.25 }}
                >
                  <Stack spacing={0.85}>
                    {stats.largestFiles.map((item) => (
                      <Stack
                        key={item.key}
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        spacing={1}
                      >
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          noWrap
                          title={item.key}
                          sx={{ minWidth: 0, flexGrow: 1 }}
                        >
                          {item.name}
                        </Typography>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={humanReadableSize(item.size)}
                          sx={{ fontWeight: 600, flexShrink: 0 }}
                        />
                      </Stack>
                    ))}
                  </Stack>
                </Paper>
              </Box>
            )}
          </Stack>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default StorageStatsDialog;
