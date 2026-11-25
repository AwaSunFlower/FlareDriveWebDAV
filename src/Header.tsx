import React, { useEffect, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  InputBase,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  PaletteMode,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import CloudQueueRoundedIcon from "@mui/icons-material/CloudQueueRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SwapVertRoundedIcon from "@mui/icons-material/SwapVertRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import SunflowerLogo from "./SunflowerLogo";
import { useTransferQueue } from "./app/transferQueue";

interface HeaderProps {
  search: string;
  onSearchChange: (newSearch: string) => void;
  onLogoClick: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  colorMode: PaletteMode;
  onToggleColorMode: () => void;
  setShowProgressDialog: (show: boolean) => void;
  onOpenStats: () => void;
  authenticated: boolean;
  username: string | null;
  onOpenLogin: () => void;
  onLogout: () => void;
}

function Header({
  search,
  onSearchChange,
  onLogoClick,
  onRefresh,
  refreshing,
  colorMode,
  onToggleColorMode,
  setShowProgressDialog,
  onOpenStats,
  authenticated,
  username,
  onOpenLogin,
  onLogout,
}: HeaderProps) {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";
  const searchInputRef = useRef<HTMLInputElement>(null);
  const transferQueue = useTransferQueue();
  const [accountMenuAnchor, setAccountMenuAnchor] =
    useState<null | HTMLElement>(null);

  const activeTransfers = transferQueue.filter(
    (task) => task.status === "pending" || task.status === "in-progress"
  ).length;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "/" && !isInputFocused) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (
        e.key === "Escape" &&
        document.activeElement === searchInputRef.current
      ) {
        onSearchChange("");
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSearchChange]);

  const searchBar = (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        maxWidth: { xs: "100%", md: 420 },
        px: 1.75,
        py: 0.65,
        borderRadius: "999px",
        backgroundColor: isLight
          ? "rgba(255, 255, 255, 0.9)"
          : "rgba(38, 34, 29, 0.92)",
        border: "1px solid",
        borderColor: isLight
          ? "rgba(180, 83, 9, 0.16)"
          : "rgba(251, 191, 36, 0.16)",
        boxShadow: isLight
          ? "0 2px 8px rgba(120, 53, 15, 0.04)"
          : "0 2px 8px rgba(0, 0, 0, 0.25)",
        transition: "all 0.2s ease",
        "&:focus-within": {
          borderColor: theme.palette.primary.main,
          boxShadow: isLight
            ? "0 0 0 3px rgba(245, 158, 11, 0.18)"
            : "0 0 0 3px rgba(251, 191, 36, 0.18)",
        },
      }}
    >
      <SearchRoundedIcon
        sx={{
          fontSize: 20,
          color: "text.secondary",
          mr: 1,
          flexShrink: 0,
        }}
      />
      <InputBase
        inputRef={searchInputRef}
        size="small"
        fullWidth
        placeholder="搜索当前目录文件或文件夹…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        inputProps={{ "aria-label": "搜索文件" }}
        sx={{
          fontSize: "0.9rem",
          color: "text.primary",
          "& input::placeholder": {
            opacity: 0.72,
          },
        }}
      />
      {search ? (
        <IconButton
          size="small"
          aria-label="清除搜索"
          onClick={() => onSearchChange("")}
          sx={{ p: 0.35, color: "text.secondary" }}
        >
          <ClearRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      ) : (
        <Box
          component="kbd"
          sx={{
            display: { xs: "none", sm: "inline-flex" },
            alignItems: "center",
            justifyContent: "center",
            minWidth: 22,
            height: 22,
            px: 0.75,
            borderRadius: "6px",
            fontSize: "0.72rem",
            fontFamily: "inherit",
            fontWeight: 600,
            color: "text.secondary",
            backgroundColor: isLight
              ? "rgba(180, 83, 9, 0.07)"
              : "rgba(251, 191, 36, 0.08)",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          /
        </Box>
      )}
    </Box>
  );

  const iconBtnSx = {
    borderRadius: "12px",
    border: "1px solid",
    borderColor: "divider",
    backgroundColor: isLight
      ? "rgba(255, 255, 255, 0.72)"
      : "rgba(38, 34, 29, 0.72)",
    "&:hover": {
      borderColor: "primary.main",
      color: "primary.main",
    },
  };

  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 1100,
        backgroundColor: isLight
          ? "rgba(253, 251, 247, 0.84)"
          : "rgba(20, 18, 16, 0.84)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        sx={{
          maxWidth: 1240,
          mx: "auto",
          px: { xs: 2, sm: 3 },
          py: 1.5,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1.5}
        >
          {/* Brand */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.25}
            onClick={onLogoClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onLogoClick();
              }
            }}
            sx={{
              cursor: "pointer",
              userSelect: "none",
              flexShrink: 0,
              borderRadius: 2,
              py: 0.25,
              pr: 0.5,
              transition: "opacity 0.15s ease",
              "&:hover": { opacity: 0.86 },
            }}
          >
            <SunflowerLogo size={34} />
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.85}>
                <Typography
                  variant="h6"
                  sx={{
                    fontSize: { xs: "1.02rem", sm: "1.14rem" },
                    lineHeight: 1.2,
                    fontWeight: 700,
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
                  label="WebDAV"
                  size="small"
                  sx={{
                    display: { xs: "none", lg: "inline-flex" },
                    height: 20,
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: "0.03em",
                    color: isLight ? "#B45309" : "#FDE68A",
                    backgroundColor: isLight
                      ? "rgba(251, 191, 36, 0.2)"
                      : "rgba(251, 191, 36, 0.15)",
                    border: "1px solid",
                    borderColor: isLight
                      ? "rgba(217, 119, 6, 0.2)"
                      : "rgba(251, 191, 36, 0.22)",
                    "& .MuiChip-label": { px: 0.9 },
                  }}
                />
              </Stack>
            </Box>
          </Stack>

          {/* Desktop Search */}
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              flexGrow: 1,
              justifyContent: "center",
              px: 1,
            }}
          >
            {searchBar}
          </Box>

          {/* Right Controls */}
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Tooltip title="R2 存储空间统计" disableFocusListener>
              <IconButton
                aria-label="存储空间统计"
                onClick={onOpenStats}
                sx={iconBtnSx}
              >
                <CloudQueueRoundedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>

            {authenticated && (
              <Tooltip title="传输队列" disableFocusListener>
                <IconButton
                  aria-label="传输队列"
                  onClick={() => setShowProgressDialog(true)}
                  sx={iconBtnSx}
                >
                  <Badge
                    badgeContent={activeTransfers}
                    color="primary"
                    max={99}
                    sx={{
                      "& .MuiBadge-badge": {
                        fontSize: "0.68rem",
                        minWidth: 17,
                        height: 17,
                      },
                    }}
                  >
                    <SwapVertRoundedIcon sx={{ fontSize: 20 }} />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title="刷新当前目录" disableFocusListener>
              <IconButton
                aria-label="刷新"
                onClick={onRefresh}
                sx={iconBtnSx}
              >
                <RefreshRoundedIcon
                  sx={{
                    fontSize: 20,
                    animation: refreshing
                      ? "sf-spin 0.85s linear infinite"
                      : "none",
                    "@keyframes sf-spin": {
                      "0%": { transform: "rotate(0deg)" },
                      "100%": { transform: "rotate(360deg)" },
                    },
                  }}
                />
              </IconButton>
            </Tooltip>

            <Tooltip
              title={colorMode === "light" ? "切换到深色模式" : "切换到浅色模式"}
              disableFocusListener
            >
              <IconButton
                aria-label="切换深浅色主题"
                onClick={onToggleColorMode}
                sx={{
                  ...iconBtnSx,
                  color: isLight ? "#B45309" : "#FBBF24",
                  "&:hover": {
                    borderColor: "primary.main",
                    backgroundColor: isLight
                      ? "rgba(251, 191, 36, 0.14)"
                      : "rgba(251, 191, 36, 0.14)",
                  },
                }}
              >
                {colorMode === "light" ? (
                  <DarkModeRoundedIcon sx={{ fontSize: 20 }} />
                ) : (
                  <LightModeRoundedIcon sx={{ fontSize: 20 }} />
                )}
              </IconButton>
            </Tooltip>

            {/* Auth Control */}
            {authenticated ? (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={
                    <VerifiedUserRoundedIcon
                      sx={{ fontSize: 17, color: "secondary.main" }}
                    />
                  }
                  onClick={(e) => setAccountMenuAnchor(e.currentTarget)}
                  sx={{
                    px: 1.4,
                    py: 0.72,
                    borderRadius: "12px",
                    borderColor: isLight
                      ? "rgba(101, 163, 13, 0.35)"
                      : "rgba(163, 230, 53, 0.35)",
                    backgroundColor: isLight
                      ? "rgba(101, 163, 13, 0.08)"
                      : "rgba(163, 230, 53, 0.08)",
                    color: "text.primary",
                    fontSize: "0.82rem",
                    maxWidth: 140,
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {username || "管理员"}
                  </Box>
                </Button>
                <Menu
                  anchorEl={accountMenuAnchor}
                  open={Boolean(accountMenuAnchor)}
                  onClose={() => setAccountMenuAnchor(null)}
                >
                  <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {username || "管理员"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      已开启完整读写与私密目录权限
                    </Typography>
                  </Box>
                  <Divider />
                  <MenuItem
                    onClick={() => {
                      setAccountMenuAnchor(null);
                      onOpenStats();
                    }}
                  >
                    <ListItemIcon>
                      <CloudQueueRoundedIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="R2 存储空间统计" />
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setAccountMenuAnchor(null);
                      onLogout();
                    }}
                    sx={{ color: "error.main" }}
                  >
                    <ListItemIcon sx={{ color: "error.main" }}>
                      <LogoutRoundedIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="退出登录" />
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Button
                size="small"
                variant="contained"
                startIcon={<LoginRoundedIcon sx={{ fontSize: 17 }} />}
                onClick={onOpenLogin}
                sx={{
                  px: { xs: 1.4, sm: 1.85 },
                  py: 0.78,
                  borderRadius: "12px",
                  fontSize: "0.82rem",
                  flexShrink: 0,
                }}
              >
                登录
              </Button>
            )}
          </Stack>
        </Stack>

        {/* Mobile Search Row */}
        <Box sx={{ display: { xs: "block", md: "none" }, mt: 1.25 }}>
          {searchBar}
        </Box>
      </Box>
    </Box>
  );
}

export default Header;
