import React from "react";
import {
  Box,
  Chip,
  Divider,
  IconButton,
  Paper,
  Slide,
  Stack,
  Tooltip,
  useTheme,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import DriveFileMoveRoundedIcon from "@mui/icons-material/DriveFileMoveRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";

interface MultiSelectToolbarProps {
  multiSelected: string[] | null;
  totalCount: number;
  authenticated: boolean;
  onSelectAll: () => void;
  onClose: () => void;
  onDownload: () => void;
  onMove: () => void;
  onCopy: () => void;
  onRename: () => void;
  onDelete: () => void;
  onShare: () => void;
}

function MultiSelectToolbar({
  multiSelected,
  totalCount,
  authenticated,
  onSelectAll,
  onClose,
  onDownload,
  onMove,
  onCopy,
  onRename,
  onDelete,
  onShare,
}: MultiSelectToolbarProps) {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";
  const count = multiSelected?.length ?? 0;
  const isSingleFile = count === 1 && !multiSelected![0].endsWith("/");
  const isAllSelected = totalCount > 0 && count === totalCount;

  return (
    <Slide direction="up" in={multiSelected !== null} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: "fixed",
          bottom: { xs: 16, sm: 24 },
          left: 0,
          right: 0,
          zIndex: 1200,
          display: "flex",
          justifyContent: "center",
          px: 2,
          pointerEvents: "none",
        }}
      >
        <Paper
          elevation={8}
          sx={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: { xs: 0.4, sm: 0.9 },
            px: { xs: 1.4, sm: 2 },
            py: 1,
            borderRadius: "999px",
            backgroundColor: isLight
              ? "rgba(41, 32, 24, 0.94)"
              : "rgba(38, 34, 29, 0.96)",
            color: "#FAF6F0",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(251, 191, 36, 0.25)",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.32)",
          }}
        >
          <Chip
            label={`已选 ${count} 项`}
            size="small"
            sx={{
              fontWeight: 700,
              fontSize: "0.78rem",
              backgroundColor: "rgba(251, 191, 36, 0.22)",
              color: "#FDE68A",
            }}
          />

          <Tooltip title={isAllSelected ? "取消全选" : "全选当前目录"}>
            <IconButton
              size="small"
              onClick={onSelectAll}
              sx={{
                color: isAllSelected ? "#FBBF24" : "#E7DFD5",
                "&:hover": { color: "#FBBF24" },
              }}
            >
              <DoneAllRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Divider
            orientation="vertical"
            flexItem
            sx={{ borderColor: "rgba(255,255,255,0.14)", my: 0.5 }}
          />

          <Stack direction="row" spacing={0.25} alignItems="center">
            <Tooltip title="下载">
              <span>
                <IconButton
                  size="small"
                  disabled={!isSingleFile}
                  onClick={onDownload}
                  sx={{
                    color: "#FAF6F0",
                    "&.Mui-disabled": { color: "rgba(255,255,255,0.28)" },
                    "&:hover": { color: "#FBBF24" },
                  }}
                >
                  <DownloadRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>

            {authenticated && (
              <Tooltip title="分享 / 加密链接">
                <span>
                  <IconButton
                    size="small"
                    disabled={count !== 1}
                    onClick={onShare}
                    sx={{
                      color: "#FAF6F0",
                      "&.Mui-disabled": { color: "rgba(255,255,255,0.28)" },
                      "&:hover": { color: "#FBBF24" },
                    }}
                  >
                    <ShareRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}

            {authenticated && (
              <>
                <Tooltip title="移动到文件夹">
                  <IconButton
                    size="small"
                    aria-label="移动到文件夹"
                    onClick={onMove}
                    sx={{
                      color: "#FAF6F0",
                      "&:hover": { color: "#FBBF24" },
                    }}
                  >
                    <DriveFileMoveRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                <Tooltip title="复制到文件夹">
                  <IconButton
                    size="small"
                    aria-label="复制到文件夹"
                    onClick={onCopy}
                    sx={{
                      color: "#FAF6F0",
                      "&:hover": { color: "#FBBF24" },
                    }}
                  >
                    <ContentCopyRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                <Tooltip title="重命名">
                  <span>
                    <IconButton
                      size="small"
                      disabled={count !== 1}
                      onClick={onRename}
                      sx={{
                        color: "#FAF6F0",
                        "&.Mui-disabled": { color: "rgba(255,255,255,0.28)" },
                        "&:hover": { color: "#FBBF24" },
                      }}
                    >
                      <DriveFileRenameOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>

                <Tooltip title="删除">
                  <IconButton
                    size="small"
                    onClick={onDelete}
                    sx={{
                      color: "#FCA5A5",
                      "&:hover": {
                        color: "#EF4444",
                        backgroundColor: "rgba(239, 68, 68, 0.14)",
                      },
                    }}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Stack>

          <Divider
            orientation="vertical"
            flexItem
            sx={{ borderColor: "rgba(255,255,255,0.14)", my: 0.5 }}
          />

          <Tooltip title="退出选择">
            <IconButton
              size="small"
              onClick={onClose}
              sx={{
                color: "#D6CCC2",
                "&:hover": { color: "#FFFFFF" },
              }}
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Paper>
      </Box>
    </Slide>
  );
}

export default MultiSelectToolbar;
