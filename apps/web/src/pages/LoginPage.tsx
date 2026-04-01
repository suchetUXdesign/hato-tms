import React, { useEffect } from "react";
import { Card, Form, Input, Button, Typography, message, Space, Alert } from "antd";
import { MailOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { login } from "../services/api";
import { useTranslation } from "../hooks/useTranslation";

const { Title, Text } = Typography;

export default function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form] = Form.useForm();

  // Show session expired message if redirected from expired token
  useEffect(() => {
    const sessionMsg = sessionStorage.getItem("hato_session_message");
    if (sessionMsg === "session_expired") {
      message.warning(t("error.sessionExpired"));
      sessionStorage.removeItem("hato_session_message");
    }
  }, [t]);

  const loginMutation = useMutation({
    mutationFn: (email: string) => login(email),
    onSuccess: (data) => {
      // Tokens are saved inside login() in api.ts
      message.success(t("success.loggedIn"));
      navigate("/keys", { replace: true });
    },
    onError: () => {
      message.error(t("error.loginFailed"));
    },
  });

  const handleSubmit = (values: { email: string }) => {
    loginMutation.mutate(values.email);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--hato-bg-secondary)",
      }}
    >
      <Card style={{ width: 400, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div style={{ textAlign: "center" }}>
            <Title level={2} style={{ marginBottom: 4 }}>
              {t("login.title")}
            </Title>
            <Text type="secondary">{t("login.subtitle")}</Text>
          </div>

          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              name="email"
              label={t("login.email")}
              rules={[
                { required: true, message: t("login.emailRequired") },
                { type: "email", message: t("login.emailInvalid") },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder={t("login.emailPlaceholder")}
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loginMutation.isPending}
                block
                size="large"
              >
                {t("login.signIn")}
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
