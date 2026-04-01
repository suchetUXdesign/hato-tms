import React, { useState, useMemo } from "react";
import {
  Card,
  Input,
  Button,
  Select,
  Table,
  Typography,
  Space,
  message,
  Divider,
  Empty,
  Tag,
} from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  getKeys,
  getUsers,
  createChangeRequest,
} from "../services/api";
import type { TranslationKeyDTO, UserDTO } from "@hato-tms/shared";
import { useTranslation } from "../hooks/useTranslation";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface CRItem {
  uid: string; // local unique id for table rowKey
  keyId: string;
  fullKey: string;
  locale: "TH" | "EN";
  oldValue: string;
  newValue: string;
  comment: string;
}

export default function CreateChangeRequestPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const [items, setItems] = useState<CRItem[]>([]);

  // For the "Add key" row
  const [selectedKeyId, setSelectedKeyId] = useState<string | undefined>();
  const [selectedLocale, setSelectedLocale] = useState<"TH" | "EN">("TH");

  // ---- Data fetching ----

  const { data: keysData } = useQuery({
    queryKey: ["keys", "all-for-cr"],
    queryFn: () => getKeys({ pageSize: 500, sortBy: "updated", sortOrder: "desc" }),
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  const allKeys: TranslationKeyDTO[] = keysData?.data ?? [];

  const keyOptions = useMemo(
    () =>
      allKeys.map((k) => ({
        label: k.fullKey,
        value: k.id,
        key: k,
      })),
    [allKeys]
  );

  const reviewerOptions = useMemo(
    () =>
      (users ?? []).map((u: UserDTO) => ({
        label: `${u.name} (${u.role})`,
        value: u.id,
      })),
    [users]
  );

  // ---- Add item ----

  const handleAddItem = () => {
    if (!selectedKeyId) {
      message.warning(t("createCR.selectKeyFirst"));
      return;
    }

    const key = allKeys.find((k) => k.id === selectedKeyId);
    if (!key) return;

    // Check for duplicate
    const exists = items.some(
      (i) => i.keyId === selectedKeyId && i.locale === selectedLocale
    );
    if (exists) {
      message.warning(t("createCR.alreadyAdded", { key: key.fullKey, locale: selectedLocale }));
      return;
    }

    const currentValue =
      key.values.find((v) => v.locale.toUpperCase() === selectedLocale)
        ?.value ?? "";

    setItems((prev) => [
      ...prev,
      {
        uid: `${selectedKeyId}-${selectedLocale}-${Date.now()}`,
        keyId: selectedKeyId,
        fullKey: key.fullKey,
        locale: selectedLocale,
        oldValue: currentValue,
        newValue: "",
        comment: "",
      },
    ]);

    setSelectedKeyId(undefined);
  };

  const handleRemoveItem = (uid: string) => {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
  };

  const handleUpdateItem = (
    uid: string,
    field: "newValue" | "comment",
    value: string
  ) => {
    setItems((prev) =>
      prev.map((i) => (i.uid === uid ? { ...i, [field]: value } : i))
    );
  };

  // ---- Submit ----

  const submitMutation = useMutation({
    mutationFn: () =>
      createChangeRequest({
        title,
        items: items.map((i) => ({
          keyId: i.keyId,
          locale: i.locale,
          newValue: i.newValue,
          comment: i.comment || undefined,
        })),
        reviewerIds,
      }),
    onSuccess: (cr) => {
      message.success(t("createCR.created"));
      navigate(`/change-requests/${cr.id}`);
    },
    onError: (err: any) => {
      message.error(
        err?.response?.data?.error?.message ?? t("createCR.failed")
      );
    },
  });

  const canSubmit =
    title.trim().length > 0 &&
    items.length > 0 &&
    items.every((i) => i.newValue.trim().length > 0);

  // ---- Table columns ----

  const columns = [
    {
      title: t("col.key"),
      dataIndex: "fullKey",
      key: "fullKey",
      width: 220,
      render: (text: string) => <Text code style={{ fontSize: 12 }}>{text}</Text>,
    },
    {
      title: t("col.locale"),
      dataIndex: "locale",
      key: "locale",
      width: 70,
      render: (locale: string) => <Tag>{locale}</Tag>,
    },
    {
      title: t("createCR.currentValue"),
      dataIndex: "oldValue",
      key: "oldValue",
      width: 200,
      render: (text: string) =>
        text ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {text}
          </Text>
        ) : (
          <Text type="secondary" italic>
            {t("detail.empty")}
          </Text>
        ),
    },
    {
      title: t("col.newValue"),
      key: "newValue",
      width: 250,
      render: (_: unknown, record: CRItem) => (
        <TextArea
          size="small"
          rows={2}
          value={record.newValue}
          onChange={(e) =>
            handleUpdateItem(record.uid, "newValue", e.target.value)
          }
          placeholder={t("createCR.newValuePlaceholder")}
          status={record.newValue.trim() ? undefined : "error"}
          style={{ fontSize: 12 }}
        />
      ),
    },
    {
      title: t("col.comment"),
      key: "comment",
      width: 180,
      render: (_: unknown, record: CRItem) => (
        <Input
          size="small"
          value={record.comment}
          onChange={(e) =>
            handleUpdateItem(record.uid, "comment", e.target.value)
          }
          placeholder={t("createCR.commentPlaceholder")}
          style={{ fontSize: 12 }}
        />
      ),
    },
    {
      title: "",
      key: "actions",
      width: 50,
      render: (_: unknown, record: CRItem) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveItem(record.uid)}
        />
      ),
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

      <Title level={4} style={{ marginBottom: 24 }}>
        {t("createCR.title")}
      </Title>

      {/* Title & Reviewers */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: "block", marginBottom: 6 }}>
            {t("createCR.crTitle")}
          </Text>
          <Input
            size="large"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("createCR.titlePlaceholder")}
            maxLength={200}
          />
        </div>

        <div>
          <Text strong style={{ display: "block", marginBottom: 6 }}>
            {t("createCR.reviewers")}
          </Text>
          <Select
            mode="multiple"
            style={{ width: "100%" }}
            placeholder={t("createCR.reviewerPlaceholder")}
            value={reviewerIds}
            onChange={setReviewerIds}
            options={reviewerOptions}
            optionFilterProp="label"
            allowClear
          />
        </div>
      </Card>

      {/* Changes */}
      <Card
        title={t("createCR.changesCount", { count: items.length })}
        style={{ marginBottom: 24 }}
        extra={
          <Space>
            <Select
              showSearch
              style={{ width: 320 }}
              placeholder={t("createCR.searchKey")}
              value={selectedKeyId}
              onChange={setSelectedKeyId}
              options={keyOptions}
              optionFilterProp="label"
              allowClear
              filterOption={(input, option) =>
                (option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
            <Select
              style={{ width: 80 }}
              value={selectedLocale}
              onChange={setSelectedLocale}
              options={[
                { label: "TH", value: "TH" },
                { label: "EN", value: "EN" },
              ]}
            />
            <Button
              icon={<PlusOutlined />}
              onClick={handleAddItem}
            >
              {t("createCR.addBtn")}
            </Button>
          </Space>
        }
      >
        {items.length === 0 ? (
          <Empty
            description={t("createCR.noChanges")}
            style={{ padding: "40px 0" }}
          />
        ) : (
          <Table
            rowKey="uid"
            columns={columns}
            dataSource={items}
            pagination={false}
            size="small"
          />
        )}
      </Card>

      {/* Submit */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
        <Button size="large" onClick={() => navigate("/change-requests")}>
          {t("common.cancel")}
        </Button>
        <Button
          type="primary"
          size="large"
          icon={<SendOutlined />}
          onClick={() => submitMutation.mutate()}
          loading={submitMutation.isPending}
          disabled={!canSubmit}
        >
          {t("createCR.submit")}
        </Button>
      </div>
    </div>
  );
}
