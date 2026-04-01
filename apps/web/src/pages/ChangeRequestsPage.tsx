import React from "react";
import {
  Table,
  Button,
  Tag,
  Typography,
  Space,
  Skeleton,
  Result,
} from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getChangeRequests } from "../services/api";
import dayjs from "dayjs";
import { useTranslation } from "../hooks/useTranslation";

const { Title, Text } = Typography;

const statusColors: Record<string, string> = {
  draft: "default",
  pending: "processing",
  approved: "success",
  rejected: "error",
  DRAFT: "default",
  PENDING: "processing",
  APPROVED: "success",
  REJECTED: "error",
  published: "purple",
  PUBLISHED: "purple",
};

export default function ChangeRequestsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["changeRequests"],
    queryFn: getChangeRequests,
  });

  if (isError) {
    return (
      <Result
        status="error"
        title={t("error.loadCR")}
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  const columns = [
    {
      title: t("col.crTitle"),
      dataIndex: "title",
      key: "title",
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: t("col.author"),
      key: "author",
      render: (_: unknown, record: any) => record.author?.name ?? record.authorName ?? "—",
    },
    {
      title: t("col.status"),
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string) => (
        <Tag color={statusColors[status] ?? "default"}>{status.toUpperCase()}</Tag>
      ),
    },
    {
      title: t("col.changes"),
      key: "items",
      width: 100,
      render: (_: unknown, record: any) => (
        <Text type="secondary">{t("cr.items", { count: record.items?.length ?? 0 })}</Text>
      ),
    },
    {
      title: t("col.created"),
      dataIndex: "createdAt",
      key: "createdAt",
      width: 140,
      render: (date: string) => (
        <Text type="secondary">{dayjs(date).format("MMM D, YYYY")}</Text>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          {t("cr.title")}
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate("/change-requests/create")}
        >
          {t("cr.createCR")}
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data ?? []}
        loading={isLoading}
        onRow={(record) => ({
          onClick: () => navigate(`/change-requests/${record.id}`),
          style: { cursor: "pointer" },
        })}
        pagination={{
          showSizeChanger: true,
          showTotal: (total) => t("cr.total", { count: total }),
        }}
        size="middle"
      />
    </div>
  );
}
