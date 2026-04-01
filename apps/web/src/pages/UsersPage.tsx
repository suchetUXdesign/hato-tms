import React, { useState } from "react";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  Modal,
  Form,
  Typography,
  Avatar,
  Badge,
  Tooltip,
  Popconfirm,
  message,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  StopOutlined,
  CheckCircleOutlined,
  UserOutlined,
  CrownOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminUsers, inviteUser, updateUser, deleteUser, getMe } from "../services/api";
import dayjs from "dayjs";
import { useTranslation } from "../hooks/useTranslation";

const { Title, Text } = Typography;

const roleConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  ADMIN: { color: "red", label: "Admin", icon: <CrownOutlined /> },
  EDITOR: { color: "blue", label: "Editor", icon: <EditOutlined /> },
  TRANSLATOR: { color: "green", label: "Translator", icon: <UserOutlined /> },
  VIEWER: { color: "default", label: "Viewer", icon: <UserOutlined /> },
  // Legacy
  DEVELOPER: { color: "blue", label: "Developer", icon: <UserOutlined /> },
  REVIEWER: { color: "purple", label: "Reviewer", icon: <UserOutlined /> },
};

const rolePermissions: Record<string, string[]> = {
  ADMIN: ["Full access", "Manage users", "All EDITOR permissions"],
  EDITOR: ["Create/edit keys", "Create/approve CR", "Import/Export", "Publish"],
  TRANSLATOR: ["Edit translation values (TH/EN)", "Create change requests"],
  VIEWER: ["View only — no edits allowed"],
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [inviteForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users", search, roleFilter],
    queryFn: () =>
      getAdminUsers({
        search: search || undefined,
        role: roleFilter || undefined,
      }),
  });

  const inviteMutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: () => {
      message.success(t("success.userInvited"));
      setInviteOpen(false);
      inviteForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message ?? t("error.saveFailed"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: any) => updateUser(id, payload),
    onSuccess: () => {
      message.success(t("success.userUpdated"));
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message ?? t("error.saveFailed"));
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      message.success(t("success.userDeactivated"));
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message ?? t("error.saveFailed"));
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => updateUser(id, { isActive: true }),
    onSuccess: () => {
      message.success(t("success.userActivated"));
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const columns = [
    {
      title: t("col.user"),
      key: "user",
      width: "30%",
      render: (_: any, record: any) => {
        const initials = (record.name || "?").charAt(0).toUpperCase();
        const rc = roleConfig[record.role] ?? roleConfig.VIEWER;
        return (
          <Space>
            <Badge
              dot
              color={record.isActive ? "#52c41a" : "#d9d9d9"}
              offset={[-4, 32]}
            >
              <Avatar
                size={36}
                style={{
                  background: record.isActive
                    ? "linear-gradient(135deg, #4F46E5, #7C3AED)"
                    : "#d9d9d9",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {initials}
              </Avatar>
            </Badge>
            <div>
              <div style={{ fontWeight: 500, fontSize: 13 }}>
                {record.name}
                {record.id === me?.id && (
                  <Tag
                    style={{
                      marginLeft: 6,
                      fontSize: 10,
                      lineHeight: "16px",
                      padding: "0 4px",
                    }}
                  >
                    {t("users.you")}
                  </Tag>
                )}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.email}
              </Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: t("col.role"),
      dataIndex: "role",
      key: "role",
      width: 140,
      render: (role: string) => {
        const rc = roleConfig[role] ?? roleConfig.VIEWER;
        return (
          <Tag
            icon={rc.icon}
            color={rc.color}
            style={{ borderRadius: 4 }}
          >
            {rc.label}
          </Tag>
        );
      },
    },
    {
      title: t("col.status"),
      key: "status",
      width: 100,
      render: (_: any, record: any) =>
        record.isActive ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            {t("users.active")}
          </Tag>
        ) : (
          <Tag icon={<StopOutlined />} color="default">
            {t("users.inactive")}
          </Tag>
        ),
    },
    {
      title: t("col.created"),
      dataIndex: "createdAt",
      key: "createdAt",
      width: 140,
      render: (date: string) => dayjs(date).format("MMM D, YYYY"),
    },
    {
      title: t("col.actions"),
      key: "actions",
      width: 120,
      render: (_: any, record: any) => {
        const isSelf = record.id === me?.id;
        return (
          <Space size={4}>
            <Tooltip title={t("common.edit")}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingUser(record);
                  editForm.setFieldsValue({
                    name: record.name,
                    role: record.role,
                  });
                }}
              />
            </Tooltip>
            {record.isActive ? (
              <Popconfirm
                title={t("users.deactivate")}
                description={t("users.deactivateConfirm", { name: record.name })}
                onConfirm={() => deactivateMutation.mutate(record.id)}
                okText={t("users.deactivate")}
                okButtonProps={{ danger: true }}
                disabled={isSelf}
              >
                <Tooltip title={isSelf ? t("users.cannotDeactivateSelf") : t("users.deactivate")}>
                  <Button
                    type="text"
                    size="small"
                    icon={<StopOutlined />}
                    danger
                    disabled={isSelf}
                  />
                </Tooltip>
              </Popconfirm>
            ) : (
              <Tooltip title={t("users.activate")}>
                <Button
                  type="text"
                  size="small"
                  icon={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
                  onClick={() => activateMutation.mutate(record.id)}
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            {t("users.title")}
          </Title>
          <Text type="secondary">
            {t("users.subtitle")}
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          onClick={() => setInviteOpen(true)}
        >
          {t("users.invite")}
        </Button>
      </div>

      {/* Role overview cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {(["ADMIN", "EDITOR", "TRANSLATOR", "VIEWER"] as const).map((role) => {
          const rc = roleConfig[role];
          const count = users.filter((u: any) => u.role === role).length;
          return (
            <Card
              key={role}
              size="small"
              style={{
                borderRadius: 10,
                cursor: "pointer",
                borderColor: roleFilter === role ? "#4F46E5" : undefined,
                background: roleFilter === role ? "var(--hato-bg-hover)" : undefined,
              }}
              onClick={() =>
                setRoleFilter(roleFilter === role ? undefined : role)
              }
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Tag color={rc.color} style={{ fontSize: 12, borderRadius: 4 }}>
                  {rc.icon} {rc.label}
                </Tag>
                <span style={{ fontWeight: 600, fontSize: 18 }}>{count}</span>
              </div>
              <Text
                type="secondary"
                style={{ fontSize: 11, display: "block", marginTop: 4 }}
              >
                {rolePermissions[role]?.[0]}
              </Text>
            </Card>
          );
        })}
      </div>

      {/* Search + table */}
      <Card style={{ borderRadius: 10 }}>
        <div style={{ marginBottom: 16 }}>
          <Input
            placeholder={t("users.searchPlaceholder")}
            prefix={<SearchOutlined style={{ color: "#bbb" }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ maxWidth: 360 }}
          />
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={users}
          loading={isLoading}
          pagination={
            users.length > 20 ? { pageSize: 20, showSizeChanger: false } : false
          }
          size="middle"
        />
      </Card>

      {/* ===== Invite User Modal ===== */}
      <Modal
        title={t("users.inviteTitle")}
        open={inviteOpen}
        onCancel={() => {
          setInviteOpen(false);
          inviteForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={inviteForm}
          layout="vertical"
          onFinish={(values) => inviteMutation.mutate(values)}
          initialValues={{ role: "EDITOR" }}
        >
          <Form.Item
            name="name"
            label={t("col.name")}
            rules={[{ required: true, message: "Name is required" }]}
          >
            <Input placeholder="e.g. Somchai Dev" />
          </Form.Item>

          <Form.Item
            name="email"
            label={t("col.email")}
            rules={[
              { required: true, message: "Email is required" },
              { type: "email", message: "Please enter a valid email" },
            ]}
          >
            <Input placeholder="e.g. somchai@hato.co" />
          </Form.Item>

          <Form.Item name="role" label={t("col.role")} rules={[{ required: true }]}>
            <Select>
              {(["ADMIN", "EDITOR", "TRANSLATOR", "VIEWER"] as const).map(
                (role) => {
                  const rc = roleConfig[role];
                  return (
                    <Select.Option key={role} value={role}>
                      <Space>
                        <Tag
                          color={rc.color}
                          style={{ margin: 0, borderRadius: 4 }}
                        >
                          {rc.icon} {rc.label}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {rolePermissions[role]?.[0]}
                        </Text>
                      </Space>
                    </Select.Option>
                  );
                }
              )}
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Space>
              <Button
                onClick={() => {
                  setInviteOpen(false);
                  inviteForm.resetFields();
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={inviteMutation.isPending}
              >
                {t("users.sendInvite")}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== Edit User Modal ===== */}
      <Modal
        title={`${t("users.editTitle")} — ${editingUser?.name}`}
        open={!!editingUser}
        onCancel={() => setEditingUser(null)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) =>
            updateMutation.mutate({ id: editingUser.id, ...values })
          }
        >
          <Form.Item
            name="name"
            label={t("col.name")}
            rules={[{ required: true, message: "Name is required" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="role" label={t("col.role")} rules={[{ required: true }]}>
            <Select
              disabled={editingUser?.id === me?.id}
            >
              {(["ADMIN", "EDITOR", "TRANSLATOR", "VIEWER"] as const).map(
                (role) => {
                  const rc = roleConfig[role];
                  return (
                    <Select.Option key={role} value={role}>
                      <Space>
                        <Tag
                          color={rc.color}
                          style={{ margin: 0, borderRadius: 4 }}
                        >
                          {rc.icon} {rc.label}
                        </Tag>
                      </Space>
                    </Select.Option>
                  );
                }
              )}
            </Select>
          </Form.Item>

          {editingUser?.id === me?.id && (
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 16 }}>
              <ExclamationCircleOutlined /> {t("users.cannotChangeOwnRole")}
            </Text>
          )}

          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Space>
              <Button onClick={() => setEditingUser(null)}>{t("common.cancel")}</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateMutation.isPending}
              >
                {t("users.saveChanges")}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
