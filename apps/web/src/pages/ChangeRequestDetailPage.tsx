import React, { useState } from "react";
import {
  Card,
  Descriptions,
  Tag,
  Table,
  Button,
  Space,
  Typography,
  Input,
  message,
  Skeleton,
  Result,
  Alert,
  Modal,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  ArrowLeftOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getChangeRequest,
  reviewChangeRequest,
  publishChangeRequest,
  getMe,
} from "../services/api";
import dayjs from "dayjs";
import { useTranslation } from "../hooks/useTranslation";

const { Title, Text } = Typography;
const { TextArea } = Input;

const statusColors: Record<string, string> = {
  DRAFT: "default",
  PENDING: "processing",
  APPROVED: "success",
  REJECTED: "error",
  PUBLISHED: "purple",
};

export default function ChangeRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState("");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);

  // Local override: set immediately on approve/reject/publish so UI updates
  // before the refetch round-trip completes.
  const [statusOverride, setStatusOverride] = useState<string | null>(null);
  const { t } = useTranslation();

  const {
    data: cr,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["changeRequest", id],
    queryFn: () => getChangeRequest(id!),
    enabled: !!id,
  });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });

  // ---- Mutations ----

  const approveMutation = useMutation({
    mutationFn: () => reviewChangeRequest(id!, { action: "approve" }),
    onMutate: () => {
      // Immediately lock the UI so buttons disappear
      setStatusOverride("APPROVED");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["changeRequest", id] });
      queryClient.invalidateQueries({ queryKey: ["changeRequests"] });
      message.success(t("success.crApproved"));
    },
    onError: (err: any) => {
      // Revert override on failure
      setStatusOverride(null);
      message.error(
        err?.response?.data?.error?.message ?? t("error.approveFailed")
      );
    },
    onSettled: () => {
      // After refetch completes, clear override so we use server data
      queryClient.refetchQueries({ queryKey: ["changeRequest", id] }).then(() => {
        setStatusOverride(null);
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (comment: string) =>
      reviewChangeRequest(id!, {
        action: "reject",
        comment: comment || undefined,
      }),
    onMutate: () => {
      setStatusOverride("REJECTED");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["changeRequest", id] });
      queryClient.invalidateQueries({ queryKey: ["changeRequests"] });
      message.success(t("success.crRejected"));
      setRejectModalOpen(false);
      setRejectReason("");
    },
    onError: (err: any) => {
      setStatusOverride(null);
      message.error(
        err?.response?.data?.error?.message ?? t("error.rejectFailed")
      );
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: ["changeRequest", id] }).then(() => {
        setStatusOverride(null);
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => publishChangeRequest(id!),
    onMutate: () => {
      setStatusOverride("PUBLISHED");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["changeRequest", id] });
      queryClient.invalidateQueries({ queryKey: ["changeRequests"] });
      queryClient.invalidateQueries({ queryKey: ["keys"] });
      message.success(t("success.crPublished"));
    },
    onError: (err: any) => {
      setStatusOverride(null);
      message.error(
        err?.response?.data?.error?.message ?? t("error.publishFailed")
      );
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: ["changeRequest", id] }).then(() => {
        setStatusOverride(null);
      });
    },
  });

  // ---- Derived data ----

  const authorName =
    (cr as any)?.author?.name ?? cr?.authorName ?? "Unknown";
  const reviewers: any[] = (cr as any)?.reviewers ?? [];
  const reviewerIds: string[] =
    cr?.reviewerIds ?? reviewers.map((r: any) => r.userId);

  // Use override if set, otherwise use server data
  const normalizedStatus = statusOverride ?? cr?.status?.toUpperCase() ?? "";
  const isPending = normalizedStatus === "PENDING";
  const isApproved = normalizedStatus === "APPROVED";
  const isRejected = normalizedStatus === "REJECTED";
  const isPublished = normalizedStatus === "PUBLISHED";

  const isAuthor = me?.id === cr?.authorId;
  const isReviewer = reviewerIds.includes(me?.id ?? "");
  const isAdmin = (me as any)?.role?.toUpperCase() === "ADMIN";

  // Only show review buttons when PENDING and user has permission
  const canReview = isPending && (isAdmin || isReviewer) && !isAuthor;
  const canPublish = isApproved && (isAuthor || isAdmin);

  // Any mutation in progress — disable all action buttons
  const isBusy =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    publishMutation.isPending;

  // Find which reviewer approved/rejected
  const approvedReviewer = reviewers.find((r: any) => r.approved);
  const resolvedByName = approvedReviewer?.name ?? me?.name ?? "a reviewer";

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }

  if (isError || !cr) {
    return (
      <Result
        status="error"
        title={t("error.loadCRDetail")}
        extra={
          <Button onClick={() => navigate("/change-requests")}>
            {t("cr.backToList")}
          </Button>
        }
      />
    );
  }

  const diffColumns = [
    {
      title: t("col.key"),
      dataIndex: "fullKey",
      key: "fullKey",
      width: "25%",
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: t("col.locale"),
      dataIndex: "locale",
      key: "locale",
      width: 80,
      render: (locale: string) => locale?.toUpperCase(),
    },
    {
      title: t("col.oldValue"),
      dataIndex: "oldValue",
      key: "oldValue",
      render: (text: string | null) =>
        text ? (
          <div
            style={{
              background: "var(--hato-diff-del-bg)",
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid var(--hato-diff-del-border)",
            }}
          >
            <Text delete>{text}</Text>
          </div>
        ) : (
          <Text type="secondary">{t("cr.new")}</Text>
        ),
    },
    {
      title: t("col.newValue"),
      dataIndex: "newValue",
      key: "newValue",
      render: (text: string) => (
        <div
          style={{
            background: "var(--hato-diff-add-bg)",
            padding: "4px 8px",
            borderRadius: 4,
            border: "1px solid var(--hato-diff-add-border)",
          }}
        >
          <Text>{text}</Text>
        </div>
      ),
    },
    {
      title: t("col.comment"),
      dataIndex: "comment",
      key: "comment",
      width: 150,
      render: (text: string | null) =>
        text ? <Text type="secondary">{text}</Text> : null,
    },
  ];

  return (
    <div>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/change-requests")}
        style={{ marginBottom: 16 }}
      >
        {t("cr.backToList")}
      </Button>

      {/* Header card */}
      <Card style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {cr.title}
            </Title>
            <Space style={{ marginTop: 8 }}>
              <Tag color={statusColors[normalizedStatus] ?? "default"}>
                {normalizedStatus}
              </Tag>
              <Text type="secondary">
                by {authorName} on{" "}
                {dayjs(cr.createdAt).format("MMM D, YYYY")}
              </Text>
            </Space>
          </div>
        </div>

        <Descriptions column={2} size="small" style={{ marginTop: 16 }}>
          <Descriptions.Item label={t("col.status")}>
            <Tag color={statusColors[normalizedStatus] ?? "default"}>
              {normalizedStatus}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t("col.changes")}>
            {t("cr.items", { count: cr.items?.length ?? 0 })}
          </Descriptions.Item>
          <Descriptions.Item label={t("col.author")}>{authorName}</Descriptions.Item>
          <Descriptions.Item label={t("col.reviewers")}>
            {reviewers.length > 0 ? (
              <Space size={4} wrap>
                {reviewers.map((r: any, i: number) => (
                  <Tag
                    key={i}
                    color={r.approved ? "success" : "default"}
                    icon={r.approved ? <CheckOutlined /> : undefined}
                  >
                    {r.name ?? r.userId}
                  </Tag>
                ))}
              </Space>
            ) : reviewerIds.length > 0 ? (
              reviewerIds.join(", ")
            ) : (
              t("cr.noneAssigned")
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Diff Table */}
      <Card title={t("cr.changes")} style={{ marginBottom: 24 }}>
        <Table
          rowKey={(record, idx) => record.id ?? `item-${idx}`}
          columns={diffColumns}
          dataSource={cr.items}
          pagination={false}
          size="small"
        />
      </Card>

      {/* ===== Action Section ===== */}

      {/* PENDING — author sees info banner */}
      {isAuthor && isPending && (
        <Alert
          type="info"
          icon={<ExclamationCircleOutlined />}
          message={t("cr.waitingApproval")}
          description={t("cr.waitingApprovalDesc")}
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* PENDING — reviewer sees Approve / Reject buttons */}
      {canReview && (
        <Card
          title={t("cr.reviewTitle")}
          style={{ marginBottom: 24 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
            }}
          >
            <Button
              danger
              size="large"
              icon={<CloseOutlined />}
              onClick={() => setRejectModalOpen(true)}
              disabled={isBusy}
              loading={rejectMutation.isPending}
            >
              {t("cr.reject")}
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<CheckOutlined />}
              onClick={() => approveMutation.mutate()}
              disabled={isBusy}
              loading={approveMutation.isPending}
            >
              {t("cr.approve")}
            </Button>
          </div>
        </Card>
      )}

      {/* APPROVED — show banner + Publish button */}
      {isApproved && (
        <Card style={{ marginBottom: 24 }}>
          <Alert
            type="success"
            showIcon
            icon={<CheckOutlined />}
            message={t("cr.approvedBy", { name: resolvedByName })}
            description={
              canPublish
                ? t("cr.approvedDesc")
                : t("cr.approvedOtherDesc")
            }
            style={{ marginBottom: canPublish ? 16 : 0 }}
          />
          {canPublish && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                type="primary"
                size="large"
                icon={<SendOutlined />}
                onClick={() => publishMutation.mutate()}
                disabled={isBusy}
                loading={publishMutation.isPending}
              >
                {t("cr.publish")}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* PUBLISHED — show published banner */}
      {isPublished && (
        <Card style={{ marginBottom: 24 }}>
          <Alert
            type="success"
            showIcon
            icon={<CheckOutlined />}
            message={t("status.published")}
            description={t("cr.publishedBanner")}
          />
        </Card>
      )}

      {/* REJECTED — show rejection info */}
      {isRejected && (
        <Card style={{ marginBottom: 24 }}>
          <Alert
            type="error"
            showIcon
            icon={<CloseOutlined />}
            message={t("status.rejected")}
            description={t("cr.rejectedDesc", { name: resolvedByName })}
          />
        </Card>
      )}

      {/* Reject Modal with reason input */}
      <Modal
        title={t("cr.rejectTitle")}
        open={rejectModalOpen}
        onCancel={() => {
          if (!rejectMutation.isPending) {
            setRejectModalOpen(false);
            setRejectReason("");
          }
        }}
        closable={!rejectMutation.isPending}
        maskClosable={!rejectMutation.isPending}
        footer={[
          <Button
            key="cancel"
            disabled={rejectMutation.isPending}
            onClick={() => {
              setRejectModalOpen(false);
              setRejectReason("");
            }}
          >
            {t("common.cancel")}
          </Button>,
          <Button
            key="reject"
            danger
            type="primary"
            icon={<CloseOutlined />}
            loading={rejectMutation.isPending}
            disabled={rejectMutation.isPending}
            onClick={() => rejectMutation.mutate(rejectReason)}
          >
            {t("cr.reject")}
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 8 }}>
          <Text>{t("cr.rejectReason")}</Text>
        </div>
        <TextArea
          rows={4}
          placeholder={t("cr.rejectPlaceholder")}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          disabled={rejectMutation.isPending}
          autoFocus
        />
      </Modal>
    </div>
  );
}
