import React, { useState, useMemo, useCallback } from "react";
import {
  Table,
  Input,
  Select,
  Button,
  Tag,
  Space,
  Typography,
  Empty,
  Result,
  message,
} from "antd";
import {
  SearchOutlined,
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  KeyStatus,
  Platform,
  type TranslationKeyDTO,
  type SearchParams,
  Locale,
} from "@hato-tms/shared";
import { getKeys, getNamespaces, deleteKey } from "../services/api";
import { useTranslation } from "../hooks/useTranslation";
import dayjs from "dayjs";
import CreateKeyModal from "../components/CreateKeyModal";
import KeyDetailDrawer from "./KeyDetailDrawer";

const { Text } = Typography;

const statusColors: Record<string, string> = {
  translated: "green",
  TRANSLATED: "green",
  pending: "orange",
  PENDING: "orange",
  in_review: "blue",
  IN_REVIEW: "blue",
};

export default function KeyListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [namespaceFilter, setNamespaceFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [platformFilter, setPlatformFilter] = useState<string | undefined>();
  const [tagFilter, setTagFilter] = useState<string[] | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // UI state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Debounce search
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(value);
      setPage(1);
    }, 300);
  }, []);

  const searchParams: SearchParams = useMemo(
    () => ({
      query: debouncedQuery || undefined,
      namespace: namespaceFilter,
      status: statusFilter as any,
      platform: platformFilter as any,
      tags: tagFilter?.length ? tagFilter : undefined,
      page,
      pageSize,
      sortBy: "updated" as const,
      sortOrder: "desc" as const,
    }),
    [debouncedQuery, namespaceFilter, statusFilter, platformFilter, tagFilter, page, pageSize],
  );

  const {
    data: keysResponse,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["keys", searchParams],
    queryFn: () => getKeys(searchParams),
  });

  const { data: namespaces } = useQuery({
    queryKey: ["namespaces"],
    queryFn: getNamespaces,
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => deleteKey(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keys"] });
      setSelectedRowKeys([]);
      message.success(t("success.keysDeleted", { count: selectedRowKeys.length }));
    },
    onError: () => {
      message.error(t("error.deleteFailed"));
    },
  });

  const columns = [
    {
      title: t("col.key"),
      dataIndex: "fullKey",
      key: "fullKey",
      render: (text: string) => <Text code>{text}</Text>,
      ellipsis: true,
      width: "25%",
    },
    {
      title: t("col.th"),
      key: "thValue",
      render: (_: any, record: TranslationKeyDTO) => {
        const val = record.values?.find((v: any) => v.locale === "TH" || v.locale === "th");
        return (
          <Text ellipsis style={{ maxWidth: 200 }}>
            {val?.value || <Text type="secondary">-</Text>}
          </Text>
        );
      },
      width: "20%",
    },
    {
      title: t("col.en"),
      key: "enValue",
      render: (_: any, record: TranslationKeyDTO) => {
        const val = record.values?.find((v: any) => v.locale === "EN" || v.locale === "en");
        return (
          <Text ellipsis style={{ maxWidth: 200 }}>
            {val?.value || <Text type="secondary">-</Text>}
          </Text>
        );
      },
      width: "20%",
    },
    {
      title: t("col.status"),
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status: string) => (
        <Tag color={statusColors[status] || "default"}>{String(status).toUpperCase()}</Tag>
      ),
    },
    {
      title: t("col.tags"),
      dataIndex: "tags",
      key: "tags",
      width: 150,
      render: (tags: string[]) =>
        tags && tags.length > 0 ? (
          <Space size={4} wrap>
            {tags.slice(0, 3).map((tag: string) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
            {tags.length > 3 && <Tag>+{tags.length - 3}</Tag>}
          </Space>
        ) : null,
    },
    {
      title: t("col.lastUpdated"),
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 140,
      render: (date: string) => (
        <Text type="secondary">{dayjs(date).format("MMM D, YYYY")}</Text>
      ),
    },
  ];

  const handleTableChange = (pagination: any) => {
    setPage(pagination.current ?? 1);
    setPageSize(pagination.pageSize ?? 20);
  };

  const handleRowClick = (record: TranslationKeyDTO) => {
    setSelectedKeyId(record.id);
    setDrawerOpen(true);
  };

  // Error state
  if (isError) {
    return (
      <Result
        status="error"
        title={t("error.loadKeys")}
        subTitle={t("error.loadKeysDesc")}
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  const hasActiveFilters = debouncedQuery || namespaceFilter || statusFilter || platformFilter;
  const isEmpty = !isLoading && keysResponse?.total === 0 && !hasActiveFilters;
  const isFilteredEmpty = !isLoading && keysResponse?.total === 0 && hasActiveFilters;

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t("page.title")}
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalOpen(true)}
        >
          {t("cta.newKey")}
        </Button>
      </div>

      {/* Search & Filters */}
      <Space wrap style={{ marginBottom: 16, width: "100%" }}>
        <Input
          placeholder={t("search.placeholder")}
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={{ width: 320 }}
          allowClear
        />
        <Select
          placeholder={t("filter.namespace")}
          value={namespaceFilter}
          onChange={(val) => {
            setNamespaceFilter(val);
            setPage(1);
          }}
          allowClear
          style={{ width: 180 }}
          options={(namespaces ?? []).map((ns: any) => ({
            value: ns.path,
            label: ns.path,
          }))}
        />
        <Select
          placeholder={t("filter.status")}
          value={statusFilter}
          onChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
          allowClear
          style={{ width: 150 }}
          options={[
            { value: "TRANSLATED", label: "TRANSLATED" },
            { value: "PENDING", label: "PENDING" },
            { value: "IN_REVIEW", label: "IN REVIEW" },
          ]}
        />
        <Select
          placeholder={t("filter.platform")}
          value={platformFilter}
          onChange={(val) => {
            setPlatformFilter(val);
            setPage(1);
          }}
          allowClear
          style={{ width: 140 }}
          options={Object.values(Platform).map((p) => ({
            value: p,
            label: p,
          }))}
        />
        <Select
          placeholder={t("filter.tags")}
          mode="tags"
          value={tagFilter}
          onChange={(val) => {
            setTagFilter(val);
            setPage(1);
          }}
          style={{ minWidth: 160 }}
          tokenSeparators={[","]}
        />
      </Space>

      {/* Table */}
      {isEmpty ? (
        <Empty description={t("empty.noKeys")}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            {t("cta.newKey")}
          </Button>
        </Empty>
      ) : isFilteredEmpty ? (
        <Empty description={t("keys.noMatch")} />
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={keysResponse?.data ?? []}
          loading={isLoading}
          pagination={{
            current: page,
            pageSize,
            total: keysResponse?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total: number) => t("keys.total", { count: total }),
          }}
          onChange={handleTableChange}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: "pointer" },
          })}
          size="middle"
        />
      )}

      {/* Bulk action bar */}
      {selectedRowKeys.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1677ff",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 16,
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            zIndex: 100,
          }}
        >
          <Text style={{ color: "#fff" }}>
            {t("keys.keysSelected", { count: selectedRowKeys.length })}
          </Text>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => bulkDeleteMutation.mutate(selectedRowKeys as string[])}
            loading={bulkDeleteMutation.isPending}
          >
            {t("common.delete")}
          </Button>
          <Button
            size="small"
            onClick={() => setSelectedRowKeys([])}
            style={{ color: "#fff", borderColor: "#fff" }}
            ghost
          >
            {t("common.clear")}
          </Button>
        </div>
      )}

      <CreateKeyModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      <KeyDetailDrawer
        keyId={selectedKeyId}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedKeyId(null);
        }}
      />
    </div>
  );
}
