import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogContent,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import SunflowerLogo from "./SunflowerLogo";
import { loginAdmin } from "./app/api";

interface LoginDialogProps {
  open: boolean;
  fullPage?: boolean;
  onClose?: () => void;
  onSuccess: (data: { username: string; privateDirs: string[] }) => void;
}

const LoginDialog: React.FC<LoginDialogProps> = ({
  open,
  fullPage = false,
  onClose,
  onSuccess,
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("请输入用户名和密码");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await loginAdmin(username.trim(), password, remember);
      setPassword("");
      onSuccess({
        username: result.username,
        privateDirs: result.privateDirs,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  const formContent = (
    <Box component="form" onSubmit={handleSubmit} sx={{ width: "100%" }}>
      <Stack spacing={2.25}>
        {/* Header */}
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "16px",
                backgroundColor: isLight
                  ? "rgba(251, 191, 36, 0.18)"
                  : "rgba(251, 191, 36, 0.14)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SunflowerLogo size={32} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontSize: "1.12rem", lineHeight: 1.25 }}>
                管理员登录
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {fullPage
                  ? "当前网盘已启用全站私密保护，请登录后访问"
                  : "登录后解锁上传、编辑、私密目录与限时分享"}
              </Typography>
            </Box>
          </Stack>

          {!fullPage && onClose && (
            <IconButton
              size="small"
              aria-label="关闭登录弹窗"
              onClick={onClose}
              disabled={submitting}
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>

        {error && (
          <Alert severity="error" sx={{ borderRadius: "12px" }}>
            {error}
          </Alert>
        )}

        <TextField
          autoFocus
          fullWidth
          label="用户名"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={submitting}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PersonRoundedIcon
                  sx={{ fontSize: 20, color: "text.secondary" }}
                />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          fullWidth
          label="密码"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockRoundedIcon
                  sx={{ fontSize: 20, color: "text.secondary" }}
                />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  onClick={() => setShowPassword((v) => !v)}
                  edge="end"
                >
                  {showPassword ? (
                    <VisibilityOffRoundedIcon fontSize="small" />
                  ) : (
                    <VisibilityRoundedIcon fontSize="small" />
                  )}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={submitting}
              />
            }
            label={
              <Typography variant="body2" color="text.secondary">
                保持登录 7 天
              </Typography>
            }
          />
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <ShieldRoundedIcon sx={{ fontSize: 15, color: "secondary.main" }} />
            <Typography variant="caption" color="text.secondary">
              HttpOnly 安全会话
            </Typography>
          </Stack>
        </Stack>

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={submitting || !username.trim() || !password}
          sx={{ py: 1.25, fontSize: "0.95rem" }}
        >
          {submitting ? (
            <Stack direction="row" alignItems="center" spacing={1}>
              <CircularProgress size={18} color="inherit" />
              <span>正在验证…</span>
            </Stack>
          ) : (
            "立即登录"
          )}
        </Button>

        <Typography
          variant="caption"
          color="text.secondary"
          textAlign="center"
          sx={{ lineHeight: 1.6 }}
        >
          使用与 WebDAV 相同的账号密码登录；第三方 WebDAV 客户端仍支持直接挂载。
        </Typography>
      </Stack>
    </Box>
  );

  if (fullPage) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2.5,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: "100%",
            maxWidth: 420,
            p: { xs: 3, sm: 4 },
            borderRadius: "24px",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: isLight
              ? "0 20px 50px -16px rgba(180, 83, 9, 0.16)"
              : "0 22px 54px -14px rgba(0, 0, 0, 0.55)",
          }}
        >
          {formContent}
        </Paper>
      </Box>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={() => !submitting && onClose?.()}
      fullWidth
      maxWidth="xs"
    >
      <DialogContent sx={{ p: { xs: 2.5, sm: 3.25 } }}>
        {formContent}
      </DialogContent>
    </Dialog>
  );
};

export default LoginDialog;
