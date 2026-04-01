import React, { useState, useEffect, useMemo } from "react";
import {
  Drawer,
  Descriptions,
  Tag,
  Space,
  Input,
  Button,
  Timeline,
  Popconfirm,
  Typography,
  Divider,
  Skeleton,
  message,
} from "antd";
import {
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  PlusOutlined,
  TagOutlined,
} from "@ant-design/icons";
import { Tooltip } from "antd";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  KeyStatus,
  type TranslationKeyDTO,
} from "@hato-tms/shared";
import {
  getKey,
  deleteKey,
  saveKeyDetail,
  getKeyHistory,
  type KeyEditHistoryEntry,
} from "../services/api";
import dayjs from "dayjs";
import { useTranslation } from "../hooks/useTranslation";

const { TextArea } = Input;
const { Text, Title } = Typography;

interface KeyDetailDrawerProps {
  keyId: string | null;
  open: boolean;
  onClose: () => void;
}

const statusColors: Record<KeyStatus, string> = {
  [KeyStatus.TRANSLATED]: "green",
  [KeyStatus.PENDING]: "orange",
  [KeyStatus.IN_REVIEW]: "blue",
};

// ---- Editable Tags Component ----
function EditableTags({
  tags,
  onChange,
  readOnly,
  t,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  readOnly: boolean;
  t: (key: string) => string;
}) {
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = React.useRef<any>(null);

  useEffect(() => {
    if (inputVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputVisible]);

  const handleRemove = (removed: string) => {
    onChange(tags.filter((tag) => tag !== removed));
  };

  const handleInputConfirm = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      // Case-insensitive dedup
      const exists = tags.some(
        (t) => t.toLowerCase() === trimmed.toLowerCase()
      );
      if (exists) {
        message.warning(t("detail.duplicateTag"));
      } else {
        onChange([...tags, trimmed]);
      }
    }
    setInputVisible(false);
    setInputValue("");
  };

  return (
    <Space size={4} wrap>
      {tags.map((tag) => (
        <Tag
          key={tag}
          closable={!readOnly}
          onClose={(e) => {
            e.preventDefault();
            handleRemove(tag);
          }}
          style={!readOnly ? { cursor: "default" } : undefined}
        >
          {tag}
        </Tag>
      ))}
      {!readOnly &&
        (inputVisible ? (
          <Input
            ref={inputRef}
            type="text"
            size="small"
            style={{ width: 100 }}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleInputConfirm}
            onPressEnter={handleInputConfirm}
          />
        ) : (
          <Tag
            onClick={() => setInputVisible(true)}
            style={{
              borderStyle: "dashed",
              cursor: "pointer",
              background: "var(--hato-bg-input)",
            }}
          >
            <PlusOutlined /> {t("detail.addTag")}
          </Tag>
        ))}
      {readOnly && tags.length === 0 && (
        <Text type="secondary">{t("detail.none")}</Text>
      )}
    </Space>
  );
}

// ---- Field-level Diff Display ----
function FieldDiffDisplay({
  changes,
  t,
}: {
  changes: { fieldPath: string; from: any; to: any }[];
  t: (key: string) => string;
}) {
  if (!changes || changes.length === 0) return null;

  const fieldLabel = (fieldPath: string) => {
    switch (fieldPath) {
      case "th":
        return "TH";
      case "en":
        return "EN";
      case "tags":
        return t("detail.tags");
      default:
        return fieldPath;
    }
  };

  const formatValue = (val: any) => {
    if (Array.isArray(val)) return val.join(", ") || "(empty)";
    if (val === "" || val === null || val === undefined) return "(empty)";
    return String(val);
  };

  return (
    <div style={{ fontSize: 12, marginTop: 4 }}>
      {changes.map((c, i) => (
        <div
          key={i}
          style={{
            padding: "4px 8px",
            marginBottom: 4,
            borderRadius: 4,
            background: "var(--hato-bg-input)",
          }}
        >
          <Text strong style={{ fontSize: 12 }}>
            {fieldLabel(c.fieldPath)}
          </Text>
          <br />
          <Text
            delete
            type="danger"
            style={{ fontSize: 12, wordBreak: "break-all" }}
          >
            {formatValue(c.from)}
          </Text>
          <br />
          <Text
            type="success"
            style={{ fontSize: 12, wordBreak: "break-all" }}
          >
            {formatValue(c.to)}
          </Text>
        </div>
      ))}
    </div>
  );
}

export default function KeyDetailDrawer({
  keyId,
  open,
  onClose,
}: KeyDetailDrawerProps) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // ---- Edit mode state ----
  const [isEditing, setIsEditing] = useState(false);
  const [draftTH, setDraftTH] = useState("");
  const [draftEN, setDraftEN] = useState("");
  const [draftTags, setDraftTags] = useState<string[]>([]);

  // ---- Data fetching ----
  const { data: keyData, isLoading } = useQuery({
    queryKey: ["key", keyId],
    queryFn: () => getKey(keyId!),
    enabled: !!keyId,
  });

  const { data: editHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["key-history", keyId],
    queryFn: () => getKeyHistory(keyId!),
    enabled: !!keyId,
  });

  // API returns locale as uppercase ("TH"/"EN")
  const thValue = keyData?.values.find(
    (v) => v.locale.toUpperCase() === "TH"
  );
  const enValue = keyData?.values.find(
    (v) => v.locale.toUpperCase() === "EN"
  );

  // Sync drafts when data loads or edit mode enters
  useEffect(() => {
    if (keyData && !isEditing) {
      setDraftTH(thValue?.value ?? "");
      setDraftEN(enValue?.value ?? "");
      setDraftTags([...keyData.tags]);
    }
  }, [keyData, isEditing]);

  // Reset edit mode when drawer closes or key changes
  useEffect(() => {
    setIsEditing(false);
  }, [keyId, open]);

  // ---- Mutations ----
  const saveMutation = useMutation({
    mutationFn: () =>
      saveKeyDetail(keyId!, {
        th: draftTH,
        en: draftEN,
        tags: draftTags,
      }),
    onSuccess: (result) => {
      if ((result as any).message === "no_changes") {
        message.info(t("detail.noChanges"));
      } else {
        const count = result.changes.length;
        message.success(
          `${t("detail.saveAll")} — ${count} ${t("detail.fieldsChanged")}`
        );
      }
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["key", keyId] });
      queryClient.refetchQueries({ queryKey: ["key", keyId] });
      queryClient.invalidateQueries({ queryKey: ["key-history", keyId] });
      queryClient.refetchQueries({ queryKey: ["key-history", keyId] });
      queryClient.invalidateQueries({ queryKey: ["keys"] });
    },
    onError: (err: any) => {
      message.error(
        err?.response?.data?.error?.message ?? t("error.updateValue")
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteKey(keyId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keys"] });
      message.success(t("success.keyDeleted"));
      onClose();
    },
    onError: () => {
      message.error(t("error.deleteKey"));
    },
  });

  // ---- Handlers ----
  const handleEdit = () => {
    setDraftTH(thValue?.value ?? "");
    setDraftEN(enValue?.value ?? "");
    setDraftTags([...(keyData?.tags ?? [])]);
    setIsEditing(true);
  };

  const handleDiscard = () => {
    setDraftTH(thValue?.value ?? "");
    setDraftEN(enValue?.value ?? "");
    setDraftTags([...(keyData?.tags ?? [])]);
    setIsEditing(false);
  };

  const handleSave = () => {
    saveMutation.mutate();
  };

  // ---- Check if there are changes ----
  const hasChanges = useMemo(() => {
    if (!keyData) return false;
    const thChanged = draftTH !== (thValue?.value ?? "");
    const enChanged = draftEN !== (enValue?.value ?? "");
    const sortedOld = [...(keyData.tags || [])].sort();
    const sortedNew = [...draftTags].sort();
    const tagsChanged = JSON.stringify(sortedOld) !== JSON.stringify(sortedNew);
    return thChanged || enChanged || tagsChanged;
  }, [draftTH, draftEN, draftTags, keyData, thValue, enValue]);

  // ---- Build history items for Timeline ----
  const historyItems = useMemo(() => {
    const items: any[] = [];

    // Field-level edit history (from audit log)
    if (editHistory && editHistory.length > 0) {
      for (const entry of editHistory) {
        if (entry.changes && entry.changes.length > 0) {
          items.push({
            color: "blue",
            children: (
              <div>
                <Text strong style={{ fontSize: 13 }}>
                  {entry.changes.length} {t("detail.fieldsChanged")}
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(entry.changedAt).format("YYYY-MM-DD HH:mm")}
                  {entry.changedBy ? (
                    <>
                      {" by "}
                      <Tooltip title={entry.changedByEmail}>
                        <Text
                          type="secondary"
                          style={{
                            fontSize: 12,
                            cursor: entry.changedByEmail ? "help" : undefined,
                            borderBottom: entry.changedByEmail
                              ? "1px dotted #999"
                              : undefined,
                          }}
                        >
                          {entry.changedBy}
                        </Text>
                      </Tooltip>
                    </>
                  ) : null}
                </Text>
                <FieldDiffDisplay changes={entry.changes} t={t} />
              </div>
            ),
          });
        } else if (entry.action === "key.created") {
          items.push({
            color: "green",
            children: (
              <div>
                <Text strong>{t("detail.keyCreated")}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(entry.changedAt).format("YYYY-MM-DD HH:mm")}
                  {entry.changedBy ? ` by ${entry.changedBy}` : ""}
                </Text>
              </div>
            ),
          });
        }
      }
    }

    // Fallback: if no audit history yet, show legacy value-based history
    if (items.length === 0 && keyData) {
      const allVersions = (keyData as any).allVersions || keyData.values;
      if (allVersions) {
        const sorted = [...allVersions].sort(
          (a: any, b: any) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        for (const v of sorted) {
          items.push({
            children: (
              <div>
                <Text strong>{(v.locale || "").toUpperCase()}</Text>{" "}
                <Text type="secondary">v{v.version}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(v.updatedAt).format("YYYY-MM-DD HH:mm")}
                  {v.updatedBy ? (
                    <>
                      {" by "}
                      <Tooltip title={v.updatedByEmail}>
                        <Text
                          type="secondary"
                          style={{
                            fontSize: 12,
                            cursor: v.updatedByEmail ? "help" : undefined,
                            borderBottom: v.updatedByEmail
                              ? "1px dotted #999"
                              : undefined,
                          }}
                        >
                          {v.updatedBy}
                        </Text>
                      </Tooltip>
                    </>
                  ) : null}
                </Text>
              </div>
            ),
          });
        }
      }

      // Key creation entry
      items.push({
        color: "green",
        children: (
          <div>
            <Text strong>{t("detail.keyCreated")}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(keyData.createdAt).format("YYYY-MM-DD HH:mm")}
              {(keyData as any).createdBy
                ? ` by ${(keyData as any).createdBy}`
                : ""}
            </Text>
          </div>
        ),
      });
    }

    return items;
  }, [editHistory, keyData, t]);

  return (
    <Drawer
      title={keyData?.fullKey ?? "Key Detail"}
      open={open}
      onClose={onClose}
      width={520}
      extra={
        <Space>
          {!isEditing ? (
            <Button icon={<EditOutlined />} onClick={handleEdit}>
              {t("detail.edit")}
            </Button>
          ) : (
            <>
              <Button
                icon={<CloseOutlined />}
                onClick={handleDiscard}
                disabled={saveMutation.isPending}
              >
                {t("detail.discard")}
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={handleSave}
                loading={saveMutation.isPending}
                disabled={!hasChanges}
              >
                {t("detail.saveAll")}
              </Button>
            </>
          )}
          <Popconfirm
            title={t("detail.deleteConfirm")}
            description={t("detail.deleteDesc")}
            onConfirm={() => deleteMutation.mutate()}
            okText={t("detail.delete")}
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={deleteMutation.isPending}
            >
              {t("detail.delete")}
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : keyData ? (
        <>
          {/* ---- Key Metadata (read-only) ---- */}
          <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label={t("detail.fullKey")}>
              <Text code>{keyData.fullKey}</Text>
            </Descriptions.Item>
            <Descriptions.Item label={t("filter.namespace")}>
              {keyData.namespacePath}
            </Descriptions.Item>
            <Descriptions.Item label={t("detail.description")}>
              {keyData.description || (
                <Text type="secondary">{t("detail.none")}</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t("filter.status")}>
              <Tag color={statusColors[keyData.status]}>
                {keyData.status.toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t("detail.platforms")}>
              <Space size={4} wrap>
                {keyData.platforms.map((p) => (
                  <Tag key={p}>{p.toUpperCase()}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
          </Descriptions>

          <Divider />

          {/* ---- Tags (editable in edit mode) ---- */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <TagOutlined style={{ marginRight: 6 }} />
              <Text strong>{t("detail.tags")}</Text>
            </div>
            <EditableTags
              tags={isEditing ? draftTags : keyData.tags}
              onChange={setDraftTags}
              readOnly={!isEditing}
              t={t}
            />
          </div>

          <Divider />

          {/* ---- TH Value ---- */}
          <div style={{ marginBottom: 16 }}>
            <Text strong>TH (ไทย)</Text>
            {isEditing ? (
              <TextArea
                value={draftTH}
                onChange={(e) => setDraftTH(e.target.value)}
                rows={3}
                style={{ marginTop: 4 }}
                autoFocus
              />
            ) : (
              <div
                style={{
                  padding: "8px 12px",
                  background: "var(--hato-bg-input)",
                  borderRadius: 6,
                  minHeight: 40,
                  marginTop: 4,
                }}
              >
                <Text>
                  {thValue?.value || (
                    <Text type="secondary">{t("detail.empty")}</Text>
                  )}
                </Text>
              </div>
            )}
          </div>

          {/* ---- EN Value ---- */}
          <div style={{ marginBottom: 16 }}>
            <Text strong>EN (English)</Text>
            {isEditing ? (
              <TextArea
                value={draftEN}
                onChange={(e) => setDraftEN(e.target.value)}
                rows={3}
                style={{ marginTop: 4 }}
              />
            ) : (
              <div
                style={{
                  padding: "8px 12px",
                  background: "var(--hato-bg-input)",
                  borderRadius: 6,
                  minHeight: 40,
                  marginTop: 4,
                }}
              >
                <Text>
                  {enValue?.value || (
                    <Text type="secondary">{t("detail.empty")}</Text>
                  )}
                </Text>
              </div>
            )}
          </div>

          <Divider />

          {/* ---- Version History with field-level diffs ---- */}
          <Title level={5}>{t("detail.versionHistory")}</Title>
          {historyLoading ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : (
            <Timeline items={historyItems} />
          )}
        </>
      ) : null}
    </Drawer>
  );
}
