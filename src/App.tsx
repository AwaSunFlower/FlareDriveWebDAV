import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  GlobalStyles,
  PaletteMode,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import { ThemeProvider } from "@mui/material/styles";

import Header from "./Header";
import LoginDialog from "./LoginDialog";
import Main from "./Main";
import ProgressDialog from "./ProgressDialog";
import ShareLandingView from "./ShareLandingView";
import StorageStatsDialog from "./StorageStatsDialog";
import {
  ActiveDirShare,
  AuthStatus,
  fetchAuthStatus,
  fetchShareInfo,
  logoutAdmin,
} from "./app/api";
import { TransferQueueProvider } from "./app/transferQueue";
import { createSunflowerTheme } from "./theme";

const COLOR_MODE_STORAGE_KEY = "sunflower_drive_color_mode";

function getInitialColorMode(): PaletteMode {
  try {
    const saved = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  } catch {
    // ignore
  }
  return "light";
}

interface UrlShareParams {
  token: string;
  file?: string;
  dir?: string;
}

function readUrlShareParams(): UrlShareParams | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("share")?.trim();
    if (!token) return null;
    const file = params.get("file")?.trim() || undefined;
    const dir = params.get("dir")?.trim() || undefined;
    if (!file && !dir) return null;
    return { token, file, dir };
  } catch {
    return null;
  }
}

const globalStyles = (
  <GlobalStyles
    styles={{
      "html, body, #root": {
        minHeight: "100%",
        height: "100%",
      },
    }}
  />
);

interface ToastState {
  open: boolean;
  message: string;
  severity: "success" | "info" | "warning" | "error";
}

function App() {
  const [colorMode, setColorMode] = useState<PaletteMode>(getInitialColorMode);
  const [urlShare, setUrlShare] = useState<UrlShareParams | null>(
    readUrlShareParams
  );
  const [activeDirShare, setActiveDirShare] = useState<ActiveDirShare | null>(
    null
  );
  const [dirShareLoading, setDirShareLoading] = useState(
    Boolean(readUrlShareParams()?.dir)
  );
  const [dirShareError, setDirShareError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [resetRootToken, setResetRootToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [authLoading, setAuthLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    authenticated: false,
    username: null,
    publicRead: true,
    authConfigured: true,
    guestFileLocked: true,
    privateDirs: [],
  });

  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    severity: "info",
  });

  const theme = useMemo(() => createSunflowerTheme(colorMode), [colorMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, colorMode);
    } catch {
      // ignore
    }
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        "content",
        colorMode === "light" ? "#fdfbf7" : "#141210"
      );
    }
  }, [colorMode]);

  useEffect(() => {
    let cancelled = false;
    fetchAuthStatus()
      .then((status) => {
        if (!cancelled) setAuthStatus(status);
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Validate folder share link if present in URL (?share=...&dir=...)
  useEffect(() => {
    if (!urlShare?.dir) {
      setActiveDirShare(null);
      setDirShareError(null);
      setDirShareLoading(false);
      return;
    }

    let cancelled = false;
    setDirShareLoading(true);
    setDirShareError(null);

    fetchShareInfo(urlShare.token, urlShare.dir)
      .then((info) => {
        if (cancelled) return;
        if (info.scope !== "dir" || !info.isDirectory) {
          setDirShareError("该分享链接不是有效的文件夹分享");
          setActiveDirShare(null);
          return;
        }
        setActiveDirShare({
          token: urlShare.token,
          rootDir: info.rootKey,
          expiresAt: info.expiresAt,
        });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setDirShareError(err.message || "该文件夹分享链接无效或已过期");
        setActiveDirShare(null);
      })
      .finally(() => {
        if (!cancelled) setDirShareLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [urlShare]);

  const handleToggleColorMode = useCallback(() => {
    setColorMode((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const handleNotify = useCallback(
    (
      message: string,
      severity: "success" | "info" | "warning" | "error" = "info"
    ) => {
      setToast({ open: true, message, severity });
    },
    []
  );

  const handleClearSearch = useCallback(() => {
    setSearch("");
  }, []);

  const handleOpenLogin = useCallback(() => {
    setShowLoginDialog(true);
  }, []);

  const handleCloseLogin = useCallback(() => {
    setShowLoginDialog(false);
  }, []);

  const handleOpenStats = useCallback(() => {
    setShowStatsDialog(true);
  }, []);

  const handleCloseStats = useCallback(() => {
    setShowStatsDialog(false);
  }, []);

  const handleExitShare = useCallback(() => {
    try {
      window.history.replaceState({}, "", "/");
    } catch {
      // ignore
    }
    setUrlShare(null);
    setActiveDirShare(null);
    setDirShareError(null);
    setSearch("");
    setResetRootToken((v) => v + 1);
  }, []);

  const handleLogoClick = useCallback(() => {
    setSearch("");
    setResetRootToken((v) => v + 1);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshToken((v) => v + 1);
  }, []);

  const handleLoginSuccess = useCallback(
    ({ username, privateDirs }: { username: string; privateDirs: string[] }) => {
      setAuthStatus((prev) => ({
        ...prev,
        authenticated: true,
        username,
        privateDirs,
      }));
      setShowLoginDialog(false);
      setRefreshToken((v) => v + 1);
      handleNotify(`欢迎回来，${username}`, "success");
    },
    [handleNotify]
  );

  const handleLogout = useCallback(async () => {
    await logoutAdmin();
    setAuthStatus((prev) => ({
      ...prev,
      authenticated: false,
      username: null,
      privateDirs: [],
    }));
    setResetRootToken((v) => v + 1);
    setRefreshToken((v) => v + 1);
    handleNotify("已安全退出登录", "info");
  }, [handleNotify]);

  const handlePrivateDirsChange = useCallback((privateDirs: string[]) => {
    setAuthStatus((prev) => ({ ...prev, privateDirs }));
  }, []);

  // Single-file share landing page — completely bypasses guest lock & full-page login
  if (urlShare?.file) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {globalStyles}
        <ShareLandingView
          shareToken={urlShare.token}
          fileKey={urlShare.file}
          colorMode={colorMode}
          onToggleColorMode={handleToggleColorMode}
          onExitShare={handleExitShare}
          onNotify={handleNotify}
        />
        <Snackbar
          autoHideDuration={3600}
          open={toast.open}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        >
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={() => setToast((prev) => ({ ...prev, open: false }))}
            sx={{ borderRadius: "12px", fontWeight: 600 }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      </ThemeProvider>
    );
  }

  const requireFullPageLogin =
    !authLoading &&
    !dirShareLoading &&
    !activeDirShare &&
    !authStatus.publicRead &&
    !authStatus.authenticated;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {globalStyles}
      <TransferQueueProvider>
        {authLoading || dirShareLoading ? (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={2}
            sx={{ minHeight: "100vh" }}
          >
            <CircularProgress size={34} />
            <Typography variant="body2" color="text.secondary">
              {dirShareLoading ? "正在验证分享链接…" : "正在检查登录状态…"}
            </Typography>
          </Stack>
        ) : dirShareError ? (
          <Box
            sx={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 3,
            }}
          >
            <Paper
              elevation={0}
              sx={{
                maxWidth: 440,
                width: "100%",
                p: 4,
                borderRadius: "24px",
                border: "1px solid",
                borderColor: "divider",
                textAlign: "center",
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: "18px",
                  mx: "auto",
                  mb: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                  color: "error.main",
                }}
              >
                <LinkOffRoundedIcon sx={{ fontSize: 34 }} />
              </Box>
              <Typography variant="h6" gutterBottom>
                文件夹分享链接无效或已过期
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 3 }}
              >
                {dirShareError}
              </Typography>
              <Button
                variant="contained"
                startIcon={<HomeRoundedIcon />}
                onClick={handleExitShare}
              >
                前往云盘主页
              </Button>
            </Paper>
          </Box>
        ) : requireFullPageLogin ? (
          <LoginDialog open fullPage onSuccess={handleLoginSuccess} />
        ) : (
          <Stack sx={{ minHeight: "100%" }}>
            <Header
              search={search}
              onSearchChange={setSearch}
              onLogoClick={handleLogoClick}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              colorMode={colorMode}
              onToggleColorMode={handleToggleColorMode}
              setShowProgressDialog={setShowProgressDialog}
              onOpenStats={handleOpenStats}
              authenticated={authStatus.authenticated}
              username={authStatus.username}
              onOpenLogin={handleOpenLogin}
              onLogout={handleLogout}
            />
            <Main
              search={search}
              onClearSearch={handleClearSearch}
              refreshToken={refreshToken}
              resetRootToken={resetRootToken}
              authStatus={authStatus}
              activeDirShare={activeDirShare}
              onExitDirShare={handleExitShare}
              onRequireLogin={handleOpenLogin}
              onPrivateDirsChange={handlePrivateDirsChange}
              onRefreshingChange={setRefreshing}
              onNotify={handleNotify}
            />
            <Box
              component="footer"
              sx={{
                pt: 2.5,
                pb: {
                  xs: authStatus.authenticated
                    ? "calc(82px + env(safe-area-inset-bottom))"
                    : "calc(24px + env(safe-area-inset-bottom))",
                  sm: 2.5,
                },
                px: 2,
                textAlign: "center",
                borderTop: "1px solid",
                borderColor: "divider",
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Sunflower Drive · Powered by Cloudflare R2 &amp; WebDAV
              </Typography>
            </Box>
          </Stack>
        )}

        <LoginDialog
          open={showLoginDialog}
          onClose={handleCloseLogin}
          onSuccess={handleLoginSuccess}
        />

        <StorageStatsDialog
          open={showStatsDialog}
          onClose={handleCloseStats}
        />

        <ProgressDialog
          open={showProgressDialog}
          onClose={() => setShowProgressDialog(false)}
        />

        <Snackbar
          autoHideDuration={3600}
          open={toast.open}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        >
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={() => setToast((prev) => ({ ...prev, open: false }))}
            sx={{ borderRadius: "12px", fontWeight: 600 }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      </TransferQueueProvider>
    </ThemeProvider>
  );
}

export default App;
