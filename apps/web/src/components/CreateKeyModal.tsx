import React, { useState } from "react";
import {
  Modal,
  Form,
  Input,
  AutoComplete,
  Select,
  Checkbox,
  Button,
  Alert,
  Space,
  Typography,
} from "antd";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Platform,
  validateKeyName,
  buildFullKey,
} from "@hato-tms/shared";
import { getNamespaces, createKey, getKeys } from "../services/api";
import { useTranslation } from "../hooks/useTranslation";

const { TextArea } = Input;
const { Text } = Typography;

interface CreateKeyModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateKeyModal({ open, onClose }: CreateKeyModalProps) {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const { data: namespaces } = useQuery({
    queryKey: ["namespaces"],
    queryFn: getNamespaces,
  });

  const namespaceOptions = (namespaces ?? []).map((ns) => ({
    value: ns.path,
    label: ns.path,
  }));

  const mutation = useMutation({
    mutationFn: createKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keys"] });
      queryClient.invalidateQueries({ queryKey: ["namespaces"] });
      form.resetFields();
      setShowAdvanced(false);
      setDuplicateWarning(null);
      onClose();
    },
  });

  const handleKeyNameChange = async () => {
    const namespacePath = form.getFieldValue("namespacePath");
    const keyName = form.getFieldValue("keyName");

    if (!namespacePath || !keyName) {
      setDuplicateWarning(null);
      return;
    }

    try {
      const fullKey = buildFullKey(namespacePath, keyName);
      const result = await getKeys({ query: fullKey, pageSize: 1 });
      if (result.data.some((k) => k.fullKey === fullKey)) {
        setDuplicateWarning(t("error.duplicateKey"));
      } else {
        setDuplicateWarning(null);
      }
    } catch {
      setDuplicateWarning(null);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      mutation.mutate({
        namespacePath: values.namespacePath,
        keyName: values.keyName,
        thValue: values.thValue,
        enValue: values.enValue,
        description: values.description,
        tags: values.tags,
        platforms: values.platforms,
      });
    } catch {
      // validation errors handled by form
    }
  };

  const platformOptions = Object.values(Platform).map((p) => ({
    label: p.toUpperCase(),
    value: p,
  }));

  return (
    <Modal
      title={t("cta.newKey")}
      open={open}
      onCancel={() => {
        form.resetFields();
        setShowAdvanced(false);
        setDuplicateWarning(null);
        onClose();
      }}
      onOk={handleSubmit}
      confirmLoading={mutation.isPending}
      okText={t("createKey.create")}
      width={560}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="namespacePath"
          label={t("filter.namespace")}
          rules={[{ required: true, message: t("createKey.nsRequired") }]}
        >
          <AutoComplete
            options={namespaceOptions}
            placeholder={t("createKey.nsPlaceholder")}
            filterOption={(input, option) =>
              (option?.value ?? "").toLowerCase().includes(input.toLowerCase())
            }
            onBlur={handleKeyNameChange}
          />
        </Form.Item>

        <Form.Item
          name="keyName"
          label={t("createKey.keyName")}
          rules={[
            { required: true, message: t("createKey.keyRequired") },
            {
              validator: (_, value) => {
                if (!value) return Promise.resolve();
                return validateKeyName(value)
                  ? Promise.resolve()
                  : Promise.reject(
                      new Error(
                        t("createKey.keyInvalid"),
                      ),
                    );
              },
            },
          ]}
        >
          <Input
            placeholder={t("createKey.keyPlaceholder")}
            onBlur={handleKeyNameChange}
          />
        </Form.Item>

        {duplicateWarning && (
          <Alert
            type="warning"
            message={duplicateWarning}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form.Item
          name="thValue"
          label={t("createKey.thValue")}
          rules={[{ required: true, message: t("createKey.thRequired") }]}
        >
          <TextArea rows={2} placeholder={t("createKey.thPlaceholder")} />
        </Form.Item>

        <Form.Item
          name="enValue"
          label={t("createKey.enValue")}
          rules={[{ required: true, message: t("createKey.enRequired") }]}
        >
          <TextArea rows={2} placeholder={t("createKey.enPlaceholder")} />
        </Form.Item>

        <Button
          type="link"
          onClick={() => setShowAdvanced(!showAdvanced)}
          icon={showAdvanced ? <UpOutlined /> : <DownOutlined />}
          style={{ padding: 0, marginBottom: 16 }}
        >
          {showAdvanced ? t("createKey.lessOptions") : t("createKey.moreOptions")}
        </Button>

        {showAdvanced && (
          <>
            <Form.Item name="description" label={t("detail.description")}>
              <TextArea rows={2} placeholder={t("createKey.descPlaceholder")} />
            </Form.Item>

            <Form.Item name="tags" label={t("detail.tags")}>
              <Select
                mode="tags"
                placeholder={t("createKey.addTags")}
                tokenSeparators={[","]}
              />
            </Form.Item>

            <Form.Item name="platforms" label={t("createKey.platformScope")}>
              <Checkbox.Group options={platformOptions} />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
}
