import React, { useState, useCallback } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  ConfigProvider,
  Layout,
  Menu,
  Button,
  Typography,
  Tag,
  Dropdown,
  Avatar,
  Space,
  Divider,
  message,
  Modal,
  theme,
} from "antd";
import {
  TranslationOutlined,
  PullRequestOutlined,
  PieChartOutlined,
  ImportOutlined,
  ApiOutlined,
  LogoutOutlined,
  KeyOutlined,
  GlobalOutlined,
  CopyOutlined,
  CheckOutlined,
  SyncOutlined,
  DownOutlined,
  TeamOutlined,
  BulbOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Locale } from "@hato-tms/shared";
import { useTranslation } from "./hooks/useTranslation";
import { useTheme, type ThemeMode } from "./hooks/useTheme";
import { getMe, regenerateToken } from "./services/api";
import KeyListPage from "./pages/KeyListPage";
import ImportExportPage from "./pages/ImportExportPage";
import ChangeRequestsPage from "./pages/ChangeRequestsPage";
import ChangeRequestDetailPage from "./pages/ChangeRequestDetailPage";
import CoveragePage from "./pages/CoveragePage";
import ConnectionsPage from "./pages/ConnectionsPage";
import CreateChangeRequestPage from "./pages/CreateChangeRequestPage";
import UsersPage from "./pages/UsersPage";
import LoginPage from "./pages/LoginPage";

const { Sider, Header, Content } = Layout;
const { Title } = Typography;

const themeModeIcons: Record<ThemeMode, string> = {
  light: "\u2600\uFE0F",
  dark: "\uD83C\uDF19",
  system: "\uD83D\uDCBB",
};

// ============================================================
// User Profile Dropdown
// ============================================================

function UserProfileDropdown() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, locale, setLocale } = useTranslation();
  const { mode: themeMode, cycleMode, isDark } = useTheme();
  const [tokenCopied, setTokenCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    retry: false,
    staleTime: 60_000,
  });

  const userName = me?.name || me?.email?.split("@")[0] || "User";
  const userEmail = me?.email || "";
  const apiToken = (me as any)?.apiToken || "";
  const initials = userName.charAt(0).toUpperCase();

  const handleCopyToken = useCallback(() => {
    if (!apiToken) {
      message.warning(t("error.noToken"));
      return;
    }
    navigator.clipboard.writeText(apiToken);
    setTokenCopied(true);
    message.success(t("success.tokenCopied"));
    setTimeout(() => setTokenCopied(false), 2000);
  }, [apiToken]);

  const handleRegenerate = useCallback(() => {
    Modal.confirm({
      title: t("dropdown.regenerateTitle"),
      content: t("dropdown.regenerateDesc"),
      okText: t("dropdown.regenerate"),
      okType: "danger",
      cancelText: t("common.cancel"),
      onOk: async () => {
        setRegenerating(true);
        try {
          await regenerateToken();
          queryClient.invalidateQueries({ queryKey: ["me"] });
          message.success(t("success.tokenRegenerated"));
        } catch {
          message.error(t("error.regenFailed"));
        } finally {
          setRegenerating(false);
        }
      },
    });
  }, [queryClient, t]);

  const handleToggleLocale = useCallback(() => {
    const next = locale === Locale.TH ? Locale.EN : Locale.TH;
    setLocale(next);
    message.info(t("success.langSwitched", { lang: next.toUpperCase() }));
  }, [locale, setLocale, t]);

  const handleLogout = useCallback(() => {
    Modal.confirm({
      title: t("dropdown.logout"),
      content: t("dropdown.logoutConfirm"),
      okText: t("dropdown.logout"),
      okType: "danger",
      cancelText: t("common.cancel"),
      onOk: () => {
        localStorage.removeItem("hato_token");
        localStorage.removeItem("hato_refresh_token");
        localStorage.removeItem("hato_token_expires_at");
        queryClient.clear();
        navigate("/login");
      },
    });
  }, [navigate, queryClient, t]);

  const maskedToken = apiToken
    ? `${apiToken.slice(0, 8)}\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022${apiToken.slice(-4)}`
    : t("app.noToken");

  const currentThemeIcon = themeModeIcons[themeMode];

  const menuRowStyle = (hoverColor: string): React.CSSProperties => ({
    padding: "10px 20px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    transition: "background 0.15s",
  });

  const dropdownContent = (
    <div
      style={{
        background: "var(--hato-bg-dropdown)",
        borderRadius: 12,
        boxShadow: "var(--hato-shadow-dropdown)",
        width: 300,
        overflow: "hidden",
        border: `1px solid var(--hato-border)`,
      }}
    >
      {/* User info header */}
      <div style={{ padding: "16px 20px", background: "var(--hato-bg-dropdown-header)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar
            size={44}
            style={{
              background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            {initials}
          </Avatar>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                color: "var(--hato-text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {userName}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--hato-text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {userEmail}
            </div>
          </div>
        </div>
      </div>

      <Divider style={{ margin: 0, borderColor: "var(--hato-border)" }} />

      {/* API Token section */}
      <div style={{ padding: "12px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <KeyOutlined style={{ color: "var(--hato-accent)", fontSize: 14 }} />
          <span style={{ fontWeight: 500, fontSize: 13, color: "var(--hato-text-primary)" }}>
            {t("dropdown.apiToken")}
          </span>
        </div>
        <div
          style={{
            background: "var(--hato-bg-code)",
            borderRadius: 6,
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <code
            style={{
              flex: 1,
              fontSize: 11,
              color: "var(--hato-text-code)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {maskedToken}
          </code>
          <Button
            type="text"
            size="small"
            icon={
              tokenCopied ? (
                <CheckOutlined style={{ color: "#52c41a" }} />
              ) : (
                <CopyOutlined />
              )
            }
            onClick={(e) => {
              e.stopPropagation();
              handleCopyToken();
            }}
            style={{ minWidth: 28, padding: "0 4px" }}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--hato-text-secondary)" }}>
            {t("dropdown.tokenHint")}
          </span>
          <Button
            type="link"
            size="small"
            icon={<SyncOutlined spin={regenerating} />}
            onClick={(e) => {
              e.stopPropagation();
              handleRegenerate();
            }}
            style={{ fontSize: 11, padding: 0, height: "auto" }}
          >
            {t("dropdown.regenerate")}
          </Button>
        </div>
      </div>

      <Divider style={{ margin: 0, borderColor: "var(--hato-border)" }} />

      {/* Language toggle */}
      <div
        style={menuRowStyle("#f5f5ff")}
        onClick={handleToggleLocale}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "var(--hato-bg-hover)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "transparent")
        }
      >
        <Space size={8}>
          <GlobalOutlined style={{ color: "var(--hato-accent)", fontSize: 14 }} />
          <span style={{ fontSize: 13, color: "var(--hato-text-primary)" }}>{t("dropdown.language")}</span>
        </Space>
        <Tag color="purple" style={{ margin: 0, fontSize: 12, borderRadius: 4 }}>
          {locale.toUpperCase()}
        </Tag>
      </div>

      <Divider style={{ margin: 0, borderColor: "var(--hato-border)" }} />

      {/* Theme toggle */}
      <div
        style={menuRowStyle("var(--hato-bg-hover)")}
        onClick={(e) => {
          e.stopPropagation();
          cycleMode();
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "var(--hato-bg-hover)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "transparent")
        }
      >
        <Space size={8}>
          <BulbOutlined style={{ color: "var(--hato-accent)", fontSize: 14 }} />
          <span style={{ fontSize: 13, color: "var(--hato-text-primary)" }}>{t("dropdown.theme")}</span>
        </Space>
        <Tag
          style={{
            margin: 0,
            fontSize: 12,
            borderRadius: 4,
            background: isDark ? "#303050" : "#f0f0ff",
            color: isDark ? "#b0b0ff" : "#4F46E5",
            border: "none",
          }}
        >
          {currentThemeIcon} {t(`theme.${themeMode}`)}
        </Tag>
      </div>

      <Divider style={{ margin: 0, borderColor: "var(--hato-border)" }} />

      {/* Logout */}
      <div
        style={{
          padding: "10px 20px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "background 0.15s",
        }}
        onClick={handleLogout}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "var(--hato-logout-hover)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "transparent")
        }
      >
        <LogoutOutlined style={{ color: "#ff4d4f", fontSize: 14 }} />
        <span style={{ fontSize: 13, color: "#ff4d4f" }}>{t("dropdown.logout")}</span>
      </div>
    </div>
  );

  return (
    <Dropdown
      dropdownRender={() => dropdownContent}
      trigger={["click"]}
      placement="bottomRight"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          padding: "4px 8px",
          borderRadius: 8,
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "var(--hato-bg-hover)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "transparent")
        }
      >
        <Avatar
          size={32}
          style={{
            background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {initials}
        </Avatar>
        <div style={{ lineHeight: 1.3 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--hato-text-primary)",
              maxWidth: 120,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {userName}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--hato-text-secondary)",
              maxWidth: 120,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {userEmail}
          </div>
        </div>
        <DownOutlined style={{ fontSize: 10, color: "var(--hato-text-secondary)" }} />
      </div>
    </Dropdown>
  );
}

// ============================================================
// Auth Layout
// ============================================================

function AuthLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const { data: layoutMe } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    retry: false,
    staleTime: 60_000,
  });

  const isAdmin = (layoutMe as any)?.role?.toUpperCase() === "ADMIN";

  const menuItems = [
    { key: "/keys", icon: <TranslationOutlined />, label: t("nav.keys") },
    { key: "/change-requests", icon: <PullRequestOutlined />, label: t("nav.changeRequests") },
    { key: "/coverage", icon: <PieChartOutlined />, label: t("nav.coverage") },
    { key: "/import-export", icon: <ImportOutlined />, label: t("nav.importExport") },
    { key: "/connections", icon: <ApiOutlined />, label: t("nav.connections") },
    ...(isAdmin
      ? [
          { type: "divider" as const },
          { key: "/users", icon: <TeamOutlined />, label: t("nav.users") },
        ]
      : []),
  ];

  const pageTitle =
    menuItems.find((item) => location.pathname.startsWith(item.key))?.label || "Keys";

  const selectedKey =
    menuItems.find((item) => location.pathname.startsWith(item.key))?.key || "/keys";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        width={240}
        theme={isDark ? "dark" : "light"}
        style={{
          borderRight: `1px solid var(--hato-border)`,
          overflow: "auto",
          height: "100vh",
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--hato-bg-sidebar)",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <img
            src="/logo-icon.svg"
            alt="Hato TMS"
            style={{ height: 36, width: 36, borderRadius: 8, objectFit: "cover" }}
          />
          <Title level={4} style={{ margin: 0, color: "#fff", flex: 1 }}>
            Hato TMS
          </Title>
          <Tag
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "#fff",
              fontSize: 11,
              borderRadius: 4,
            }}
          >
            v1.0
          </Tag>
        </div>
        <Menu
          mode="inline"
          theme={isDark ? "dark" : "light"}
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{
            border: "none",
            padding: "8px 0",
            fontSize: 14,
            flex: 1,
            background: "transparent",
          }}
        />
        <div
          style={{
            padding: "12px 20px",
            borderTop: `1px solid var(--hato-border-light)`,
            textAlign: "center",
          }}
        >
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {t("app.subtitle")}
          </Typography.Text>
        </div>
      </Sider>
      <Layout style={{ marginLeft: 240 }}>
        <Header
          style={{
            background: "var(--hato-bg-header)",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid var(--hato-border)`,
            height: 56,
          }}
        >
          <Typography.Text strong style={{ fontSize: 16 }}>
            {pageTitle}
          </Typography.Text>
          <UserProfileDropdown />
        </Header>
        <Content
          style={{
            padding: 24,
            background: "var(--hato-bg-secondary)",
            minHeight: "calc(100vh - 56px)",
          }}
        >
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("hato_token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <AuthLayout>{children}</AuthLayout>;
}

export default function App() {
  const { isDark } = useTheme();

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: "#4F46E5",
          borderRadius: 8,
          ...(isDark
            ? {
                colorBgContainer: "#1f1f1f",
                colorBgElevated: "#1f1f1f",
                colorBgLayout: "#141414",
                colorBorderSecondary: "#303030",
              }
            : {
                colorBgContainer: "#ffffff",
                colorBgLayout: "#F8F9FC",
                colorBorderSecondary: "#e8e8ef",
              }),
        },
      }}
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/keys"
          element={<ProtectedRoute><KeyListPage /></ProtectedRoute>}
        />
        <Route
          path="/change-requests"
          element={<ProtectedRoute><ChangeRequestsPage /></ProtectedRoute>}
        />
        <Route
          path="/change-requests/create"
          element={<ProtectedRoute><CreateChangeRequestPage /></ProtectedRoute>}
        />
        <Route
          path="/change-requests/:id"
          element={<ProtectedRoute><ChangeRequestDetailPage /></ProtectedRoute>}
        />
        <Route
          path="/coverage"
          element={<ProtectedRoute><CoveragePage /></ProtectedRoute>}
        />
        <Route
          path="/import-export"
          element={<ProtectedRoute><ImportExportPage /></ProtectedRoute>}
        />
        <Route
          path="/connections"
          element={<ProtectedRoute><ConnectionsPage /></ProtectedRoute>}
        />
        <Route
          path="/users"
          element={<ProtectedRoute><UsersPage /></ProtectedRoute>}
        />
        <Route path="*" element={<Navigate to="/keys" replace />} />
      </Routes>
    </ConfigProvider>
  );
}
