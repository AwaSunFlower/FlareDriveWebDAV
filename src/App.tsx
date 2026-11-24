import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  CssBaseline,
  GlobalStyles,
  PaletteMode,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";

import Header from "./Header";
import Main from "./Main";
import ProgressDialog from "./ProgressDialog";
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
  const [refreshToken, setRefreshToken] = useState(0);
  const [resetRootToken, setResetRootToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
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

  const handleLogoClick = useCallback(() => {
    setSearch("");
    setResetRootToken((v) => v + 1);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshToken((v) => v + 1);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {globalStyles}
      <TransferQueueProvider>
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
          />
          <Main
            search={search}
            onClearSearch={() => setSearch("")}
            refreshToken={refreshToken}
            resetRootToken={resetRootToken}
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

        <ProgressDialog
          open={showProgressDialog}
          onClose={() => setShowProgressDialog(false)}
        />
      </TransferQueueProvider>
    </ThemeProvider>
  );
}

export default App;
