import React, { useMemo, useState } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import SwapVertRoundedIcon from "@mui/icons-material/SwapVertRounded";
import { TransferTask, useTransferQueue } from "./app/transferQueue";
import { humanReadableSize } from "./app/utils";

function ProgressDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";
  const [tab, setTab] = useState(1);
  const transferQueue: TransferTask[] = useTransferQueue();

  const tasks = useMemo(() => {
    const taskType = tab === 0 ? "download" : "upload";
    return Object.values(transferQueue).filter(
      (task) => task.type === taskType
    );
  }, [tab, transferQueue]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: "10px",
                backgroundColor: isLight
                  ? "rgba(251, 191, 36, 0.2)"
                  : "rgba(251, 191, 36, 0.15)",
                color: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SwapVertRoundedIcon fontSize="small" />
            </Box>
            <Typography variant="h6" sx={{ fontSize: "1.02rem" }}>
              传输队列
            </Typography>
          </Stack>
          <IconButton size="small" aria-label="关闭" onClick={onClose}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <Tabs
        value={tab}
        onChange={(_, newTab) => setTab(newTab)}
        sx={{
          px: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
          "& .MuiTab-root": { flexBasis: "50%", minHeight: 42 },
        }}
      >
        <Tab label="下载" />
        <Tab label="上传" />
      </Tabs>

      {tasks.length === 0 ? (
        <DialogContent sx={{ py: 5 }}>
          <Typography
            variant="body2"
            textAlign="center"
            color="text.secondary"
          >
            当前暂无{tab === 0 ? "下载" : "上传"}任务
          </Typography>
        </DialogContent>
      ) : (
        <DialogContent sx={{ p: 0, maxHeight: 360 }}>
          <List disablePadding>
            {tasks.map((task, idx) => {
              const percent =
                task.total > 0
                  ? Math.min(100, Math.round((task.loaded / task.total) * 100))
                  : task.status === "completed"
                  ? 100
                  : 0;

              return (
                <ListItem
                  key={`${task.remoteKey}-${idx}`}
                  sx={{
                    px: 2.5,
                    py: 1.5,
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: 0.75,
                    borderBottom:
                      idx === tasks.length - 1 ? "none" : "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={1.5}
                  >
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {task.name}
                    </Typography>
                    {task.status === "failed" ? (
                      <Tooltip title={task.error?.message ?? "传输失败"}>
                        <ErrorOutlineRoundedIcon
                          color="error"
                          fontSize="small"
                        />
                      </Tooltip>
                    ) : task.status === "completed" ? (
                      <CheckCircleRoundedIcon
                        color="success"
                        fontSize="small"
                      />
                    ) : (
                      <Typography
                        variant="caption"
                        color="primary"
                        fontWeight={700}
                      >
                        {percent}%
                      </Typography>
                    )}
                  </Stack>

                  <LinearProgress
                    variant="determinate"
                    value={percent}
                    color={
                      task.status === "failed"
                        ? "error"
                        : task.status === "completed"
                        ? "success"
                        : "primary"
                    }
                    sx={{ height: 5, borderRadius: 999 }}
                  />

                  <Typography variant="caption" color="text.secondary">
                    {humanReadableSize(task.loaded)} /{" "}
                    {humanReadableSize(task.total)}
                  </Typography>
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
      )}
    </Dialog>
  );
}

export default ProgressDialog;
