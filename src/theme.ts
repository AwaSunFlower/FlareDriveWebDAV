import { createTheme, PaletteMode } from "@mui/material";

export const SUNFLOWER_GRADIENT =
  "linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)";

export const SUNFLOWER_GRADIENT_HOVER =
  "linear-gradient(135deg, #D97706 0%, #C2410C 100%)";

export function createSunflowerTheme(mode: PaletteMode) {
  const isLight = mode === "light";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isLight ? "#D97706" : "#FBBF24",
        light: isLight ? "#FBBF24" : "#FDE68A",
        dark: isLight ? "#B45309" : "#D97706",
        contrastText: isLight ? "#FFFFFF" : "#1C1917",
      },
      secondary: {
        main: isLight ? "#65A30D" : "#A3E635",
      },
      background: {
        default: isLight ? "#FDFBF7" : "#141210",
        paper: isLight ? "#FFFFFF" : "#1E1B18",
      },
      text: {
        primary: isLight ? "#292018" : "#F5F0E8",
        secondary: isLight ? "#786B5D" : "#A89F91",
      },
      divider: isLight
        ? "rgba(180, 83, 9, 0.11)"
        : "rgba(251, 191, 36, 0.11)",
    },
    shape: {
      borderRadius: 14,
    },
    typography: {
      fontFamily: [
        "-apple-system",
        "BlinkMacSystemFont",
        '"Segoe UI"',
        '"PingFang SC"',
        '"Hiragino Sans GB"',
        '"Microsoft YaHei"',
        '"Helvetica Neue"',
        "sans-serif",
      ].join(","),
      h6: {
        fontWeight: 700,
        letterSpacing: "-0.015em",
      },
      button: {
        textTransform: "none",
        fontWeight: 600,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            transition: "background-color 0.25s ease, color 0.25s ease",
            backgroundImage: isLight
              ? "radial-gradient(ellipse 85% 42% at 50% -12%, rgba(251, 191, 36, 0.18), transparent 68%)"
              : "radial-gradient(ellipse 85% 38% at 50% -12%, rgba(245, 158, 11, 0.12), transparent 65%)",
            backgroundAttachment: "fixed",
          },
          "::-webkit-scrollbar": {
            width: 8,
            height: 8,
          },
          "::-webkit-scrollbar-thumb": {
            borderRadius: 999,
            backgroundColor: isLight
              ? "rgba(180, 83, 9, 0.2)"
              : "rgba(251, 191, 36, 0.2)",
          },
          "::-webkit-scrollbar-thumb:hover": {
            backgroundColor: isLight
              ? "rgba(180, 83, 9, 0.35)"
              : "rgba(251, 191, 36, 0.35)",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: "none",
            "&:hover": {
              boxShadow: "none",
            },
          },
          containedPrimary: {
            background: SUNFLOWER_GRADIENT,
            color: "#FFFFFF",
            "&:hover": {
              background: SUNFLOWER_GRADIENT_HOVER,
              boxShadow: "0 6px 16px -4px rgba(217, 119, 6, 0.4)",
            },
            "&.Mui-disabled": {
              background: isLight
                ? "rgba(120, 113, 108, 0.16)"
                : "rgba(255, 255, 255, 0.12)",
              color: isLight
                ? "rgba(41, 32, 24, 0.38)"
                : "rgba(245, 240, 232, 0.36)",
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 20,
            border: isLight
              ? "1px solid rgba(180, 83, 9, 0.12)"
              : "1px solid rgba(251, 191, 36, 0.14)",
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 14,
            marginTop: 6,
            border: isLight
              ? "1px solid rgba(180, 83, 9, 0.12)"
              : "1px solid rgba(251, 191, 36, 0.14)",
            boxShadow: isLight
              ? "0 14px 32px -8px rgba(120, 53, 15, 0.14)"
              : "0 16px 36px -8px rgba(0, 0, 0, 0.55)",
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 8,
            fontSize: "0.75rem",
            padding: "5px 10px",
          },
        },
      },
    },
  });
}
