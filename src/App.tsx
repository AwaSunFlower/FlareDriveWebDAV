import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  CssBaseline,
  GlobalStyles,
  PaletteMode,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";

import Header from "./Header";
import LoginDialog from "./LoginDialog";
import Main from "./Main";
import ProgressDialog from "./ProgressDialog";
import StorageStatsDialog from "./StorageStatsDialog";
import { AuthStatus, fetchAuthStatus, logoutAdmin } from "./app/api";
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

  const requireFullPageLogin =
    !authLoading && !authStatus.publicRead && !authStatus.authenticated;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {globalStyles}
      <TransferQueueProvider>
        {authLoading ? (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={2}
            sx={{ minHeight: "100vh" }}
          >
            <CircularProgress size={34} />
            <Typography variant="body2" color="text.secondary">
              正在检查登录状态…
            </Typography>
          </Stack>
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
              onRequireLogin={handleOpenLogin}
              onPrivateDirsChange={handlePrivateDirsChange}
              onRefreshingChange={setRefreshing}
              onNotify={handleNotify}
            />
            <Box
              component="footer"
              sx={{
                py: 2.5,
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
