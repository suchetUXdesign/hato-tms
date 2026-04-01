import React from "react";
import {
  Card,
  Steps,
  Typography,
  Tabs,
  Table,
  Tag,
  Alert,
  Space,
  Row,
  Col,
  Divider,
  Input,
  Collapse,
  message,
} from "antd";
import {
  GithubOutlined,
  CodeOutlined,
  ApiOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  RocketOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "../hooks/useTranslation";

const { Title, Text, Paragraph } = Typography;

// ============================================================
// Styles
// ============================================================

const codeBlockStyle: React.CSSProperties = {
  background: "var(--hato-bg-code)",
  borderRadius: 6,
  padding: 16,
  fontFamily:
    "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
  fontSize: 13,
  lineHeight: 1.6,
  overflow: "auto",
  whiteSpace: "pre",
  margin: 0,
};

// ============================================================
// Code Snippets
// ============================================================

const githubWorkflowYaml = `name: Sync Translations
on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch:
    inputs:
      namespaces:
        description: "Namespaces (comma-separated)"
        default: ""

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Pull TH
        run: |
          mkdir -p src/locales
          curl -sf -H "X-API-Token: \${{ secrets.HATO_TMS_TOKEN }}" \\
            "\${{ secrets.HATO_TMS_URL }}/api/v1/import-export/export/json?locale=TH" \\
            -o src/locales/th.json
      - name: Pull EN
        run: |
          curl -sf -H "X-API-Token: \${{ secrets.HATO_TMS_TOKEN }}" \\
            "\${{ secrets.HATO_TMS_URL }}/api/v1/import-export/export/json?locale=EN" \\
            -o src/locales/en.json
      - uses: peter-evans/create-pull-request@v6
        with:
          title: "chore: sync translations from Hato TMS"
          branch: chore/sync-translations`;

const cliConfigJson = `{
  "apiUrl": "https://tms.hato.app",
  "token": "",
  "namespaces": ["common", "dashboard"],
  "outputDir": "src/locales",
  "format": "nested",
  "perNamespace": false
}`;

const cliOutputExample = `  Hato TMS Sync
  API:        https://tms.hato.app
  Namespaces: common, dashboard
  Output:     src/locales

\u2714 TH \u2014 src/locales/th.json
\u2714 EN \u2014 src/locales/en.json

  +42 added  ~3 changed  -0 removed`;

const curlExamples = `# Get all translations as nested JSON (Thai)
curl -H "X-API-Token: YOUR_TOKEN" \\
  "https://tms.hato.app/api/v1/import-export/export/json?locale=TH"

# Get specific namespaces
curl -H "X-API-Token: YOUR_TOKEN" \\
  "https://tms.hato.app/api/v1/import-export/export/json?locale=EN&namespaces=common,dashboard"

# Flat format (for simple key-value)
curl -H "X-API-Token: YOUR_TOKEN" \\
  "https://tms.hato.app/api/v1/import-export/export/json?locale=TH&format=flat"`;

const reactI18nextCode = `// src/i18n.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import th from "./locales/th.json";
import en from "./locales/en.json";

i18n.use(initReactI18next).init({
  resources: {
    th: { translation: th },
    en: { translation: en },
  },
  lng: "th",
  fallbackLng: "en",
});

// In components:
const { t } = useTranslation();
<h1>{t("common.auth.loginTitle")}</h1>`;

const nodeExpressCode = `import th from "./locales/th.json";
import en from "./locales/en.json";

const translations: Record<string, any> = { th, en };

function t(key: string, locale = "th"): string {
  return key.split(".").reduce((obj: any, k: string) => obj?.[k], translations[locale]) ?? key;
}

// Usage:
app.get("/greeting", (req, res) => {
  const locale = req.query.lang === "en" ? "en" : "th";
  res.json({ message: t("common.navigation.home", locale) });
});`;

// ============================================================
// Secrets Table Data
// ============================================================

const secretsColumns = [
  {
    title: "Secret",
    dataIndex: "secret",
    key: "secret",
    render: (text: string) => (
      <Tag style={{ fontFamily: "monospace" }}>{text}</Tag>
    ),
  },
  {
    title: "Value",
    dataIndex: "value",
    key: "value",
  },
];

const secretsData = [
  {
    key: "1",
    secret: "HATO_TMS_URL",
    value: "API base URL (e.g. https://tms.hato.app)",
  },
  {
    key: "2",
    secret: "HATO_TMS_TOKEN",
    value: "Your API token",
  },
];

// ============================================================
// Component: CodeBlock
// ============================================================

function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <div style={{ position: "relative" }}>
      {language && (
        <Tag
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            fontSize: 11,
            opacity: 0.6,
          }}
        >
          {language}
        </Tag>
      )}
      <Paragraph
        copyable={{ text: code, tooltips: ["Copy", "Copied!"] }}
        style={{ marginBottom: 0 }}
      >
        <pre style={codeBlockStyle}>{code}</pre>
      </Paragraph>
    </div>
  );
}

// ============================================================
// Section Contents (rendered inside accordion)
// ============================================================

function GitHubActionContent() {
  return (
    <div>
      <Alert
        type="info"
        showIcon
        icon={<ThunderboltOutlined />}
        message="Auto-sync translations to your repo via GitHub Actions. Creates a PR when translations change."
        style={{ marginBottom: 24 }}
      />
      <Steps
        direction="vertical"
        current={-1}
        items={[
          {
            title: (
              <Text strong>
                Copy workflow file to{" "}
                <Text code>.github/workflows/sync-translations.yml</Text>
              </Text>
            ),
            description: (
              <div style={{ marginTop: 12 }}>
                <CodeBlock code={githubWorkflowYaml} language="yaml" />
              </div>
            ),
          },
          {
            title: (
              <Text strong>Add secrets in GitHub repo settings</Text>
            ),
            description: (
              <div style={{ marginTop: 12 }}>
                <Text
                  type="secondary"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Go to{" "}
                  <Text code>
                    Settings &rarr; Secrets and variables &rarr; Actions
                  </Text>{" "}
                  and add the following secrets:
                </Text>
                <Table
                  columns={secretsColumns}
                  dataSource={secretsData}
                  pagination={false}
                  size="small"
                  bordered
                />
              </div>
            ),
          },
          {
            title: <Text strong>Workflow runs daily or manually</Text>,
            description: (
              <Text type="secondary">
                The workflow runs on a daily schedule (06:00 UTC) or can be
                triggered manually via <Text code>workflow_dispatch</Text>.
              </Text>
            ),
          },
        ]}
      />
    </div>
  );
}

function CLIContent() {
  return (
    <div>
      <Alert
        type="info"
        showIcon
        icon={<RocketOutlined />}
        message="Use the CLI to sync translations directly into your project. Works with any framework."
        style={{ marginBottom: 24 }}
      />
      <Steps
        direction="vertical"
        current={-1}
        items={[
          {
            title: <Text strong>Install</Text>,
            description: (
              <div style={{ marginTop: 8 }}>
                <Paragraph
                  copyable={{ text: "npm install @hato-tms/cli -D" }}
                  style={{ marginBottom: 0 }}
                >
                  <pre style={codeBlockStyle}>npm install @hato-tms/cli -D</pre>
                </Paragraph>
              </div>
            ),
          },
          {
            title: <Text strong>Initialize</Text>,
            description: (
              <div style={{ marginTop: 8 }}>
                <Text
                  type="secondary"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Creates a <Text code>.hato-tms.json</Text> config file:
                </Text>
                <Paragraph
                  copyable={{ text: "npx hato-tms init" }}
                  style={{ marginBottom: 12 }}
                >
                  <pre style={codeBlockStyle}>npx hato-tms init</pre>
                </Paragraph>
                <CodeBlock code={cliConfigJson} language="json" />
              </div>
            ),
          },
          {
            title: <Text strong>Sync translations</Text>,
            description: (
              <div style={{ marginTop: 8 }}>
                <Paragraph
                  copyable={{ text: "npx hato-tms sync" }}
                  style={{ marginBottom: 12 }}
                >
                  <pre style={codeBlockStyle}>npx hato-tms sync</pre>
                </Paragraph>
                <Text
                  type="secondary"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Example output:
                </Text>
                <pre style={{ ...codeBlockStyle, color: "#52c41a" }}>
                  {cliOutputExample}
                </pre>
              </div>
            ),
          },
          {
            title: <Text strong>Add to package.json scripts</Text>,
            description: (
              <div style={{ marginTop: 8 }}>
                <Paragraph
                  copyable={{ text: '"predev": "hato-tms sync"' }}
                  style={{ marginBottom: 0 }}
                >
                  <pre style={codeBlockStyle}>{`"predev": "hato-tms sync"`}</pre>
                </Paragraph>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function DirectAPIContent() {
  return (
    <div>
      <Alert
        type="info"
        showIcon
        icon={<ApiOutlined />}
        message="Use the REST API directly to fetch translations in any language or framework."
        style={{ marginBottom: 24 }}
      />

      <Title level={5}>curl examples</Title>
      <CodeBlock code={curlExamples} language="bash" />

      <Divider />

      <Title level={5}>Framework Integration</Title>
      <Tabs
        items={[
          {
            key: "react",
            label: (
              <span>
                <ThunderboltOutlined /> React + i18next
              </span>
            ),
            children: (
              <CodeBlock code={reactI18nextCode} language="typescript" />
            ),
          },
          {
            key: "node",
            label: (
              <span>
                <CodeOutlined /> Node.js / Express
              </span>
            ),
            children: (
              <CodeBlock code={nodeExpressCode} language="typescript" />
            ),
          },
        ]}
      />
    </div>
  );
}

// ============================================================
// Quick Setup Card
// ============================================================

function QuickSetupCard() {
  const { t } = useTranslation();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/v1/auth/me", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const token = me?.apiToken;

  return (
    <Card
      style={{ borderRadius: 8 }}
      title={
        <Space>
          <CheckCircleOutlined style={{ color: "#52c41a" }} />
          <Text strong>{t("connections.quickSetup")}</Text>
        </Space>
      }
    >
      <Row gutter={16} align="middle">
        <Col flex="auto">
          <Text
            type="secondary"
            style={{ display: "block", marginBottom: 8 }}
          >
            {t("connections.yourToken")}
          </Text>
          {token ? (
            <Input.Password
              value={token}
              readOnly
              style={{ fontFamily: "monospace", maxWidth: 480 }}
              addonAfter={
                <CopyOutlined
                  onClick={() => {
                    navigator.clipboard.writeText(token);
                    message.success(t("success.tokenCopied"));
                  }}
                  style={{ cursor: "pointer" }}
                />
              }
            />
          ) : (
            <Alert
              type="warning"
              showIcon
              message={t("empty.tokenNotFound")}
              style={{ maxWidth: 540 }}
            />
          )}
        </Col>
      </Row>
    </Card>
  );
}

// ============================================================
// Accordion items config
// ============================================================

const integrationItems = [
  {
    key: "github",
    icon: <GithubOutlined style={{ fontSize: 20 }} />,
    name: "GitHub Action",
    description: "Auto-sync translations to your repo daily via CI/CD",
    badge: "Auto-sync",
    badgeColor: "#333",
    borderColor: "#333",
    content: <GitHubActionContent />,
  },
  {
    key: "cli",
    icon: <CodeOutlined style={{ fontSize: 20, color: "#18A0FB" }} />,
    name: "CLI",
    description: "Pull translations locally with a single command",
    badge: "Local sync",
    badgeColor: "#18A0FB",
    borderColor: "#18A0FB",
    content: <CLIContent />,
  },
  {
    key: "api",
    icon: <ApiOutlined style={{ fontSize: 20, color: "#52c41a" }} />,
    name: "Direct API",
    description: "Fetch translations via REST from any language or framework",
    badge: "REST",
    badgeColor: "#52c41a",
    borderColor: "#52c41a",
    content: <DirectAPIContent />,
  },
];

// ============================================================
// Main Page
// ============================================================

export default function ConnectionsPage() {
  const { t } = useTranslation();
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <Title level={2} style={{ marginBottom: 4 }}>
          {t("connections.title")}
        </Title>
        <Text type="secondary" style={{ fontSize: 16 }}>
          {t("connections.subtitle")}
        </Text>
      </div>

      {/* Accordion */}
      <Collapse
        accordion
        bordered={false}
        expandIconPosition="end"
        style={{ background: "transparent", marginBottom: 24 }}
        items={integrationItems.map((item) => ({
          key: item.key,
          label: (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "4px 0",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `${item.borderColor}10`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Text strong style={{ fontSize: 15 }}>
                    {item.name}
                  </Text>
                  <Tag
                    color={item.badgeColor}
                    style={{
                      fontSize: 11,
                      lineHeight: "18px",
                      borderRadius: 4,
                      padding: "0 6px",
                    }}
                  >
                    {item.badge}
                  </Tag>
                </div>
                <Text
                  type="secondary"
                  style={{ fontSize: 13, lineHeight: "18px" }}
                >
                  {item.description}
                </Text>
              </div>
            </div>
          ),
          children: (
            <div style={{ padding: "8px 0 0 0" }}>{item.content}</div>
          ),
          style: {
            marginBottom: 12,
            borderRadius: 10,
            border: "1px solid var(--hato-border)",
            borderLeft: `4px solid ${item.borderColor}`,
            background: "var(--hato-bg-elevated)",
            overflow: "hidden",
          },
        }))}
      />

      {/* Quick Setup — always visible */}
      <QuickSetupCard />
    </div>
  );
}
