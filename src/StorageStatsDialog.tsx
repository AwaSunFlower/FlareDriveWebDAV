import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CloudQueueRoundedIcon from "@mui/icons-material/CloudQueueRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { fetchStorageStats, StorageStats } from "./app/api";
import { humanReadableSize } from "./app/utils";

interface StorageStatsDialogProps {
  open: boolean;
  onClose: () => void;
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
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";

  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(false);
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
    if (open) loadStats();
  }, [loadStats, open]);

  const usagePercent =
    stats && stats.quotaBytes > 0
      ? Math.min(100, (stats.totalSize / stats.quotaBytes) * 100)
      : 0;

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
            <Box>
              <Typography variant="h6" sx={{ fontSize: "1.02rem" }}>
                R2 存储空间统计
              </Typography>
              <Typography variant="caption" color="text.secondary">
                对照 Cloudflare R2 免费 10 GB 存储额度
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="刷新统计">
              <IconButton size="small" onClick={loadStats} disabled={loading}>
                <RefreshRoundedIcon fontSize="small" />
              </IconButton>
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
              正在统计存储桶文件…
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
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">
                    文件总数
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {stats.totalFiles}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">
                    文件夹数
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {stats.totalFolders}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">
                    统计范围
                  </Typography>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {stats.includesPrivate ? "全部目录" : "公开目录"}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

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
                  const ratio =
                    stats.totalSize > 0 ? (cat.size / stats.totalSize) * 100 : 0;
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
          </Stack>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default StorageStatsDialog;
