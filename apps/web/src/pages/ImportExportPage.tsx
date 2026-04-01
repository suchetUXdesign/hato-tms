import React, { useState } from "react";
import {
  Card,
  Steps,
  Upload,
  Button,
  Table,
  Tag,
  Select,
  Space,
  Typography,
  Divider,
  message,
  Result,
  Radio,
  Checkbox,
} from "antd";
import {
  InboxOutlined,
  DownloadOutlined,
  UploadOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UploadFile } from "antd/es/upload";
import {
  Locale,
  type ImportPreview,
  type ExportOptions,
} from "@hato-tms/shared";
import { importJSON, importCSV, exportJSON, exportCSV, getNamespaces } from "../services/api";
import { useTranslation } from "../hooks/useTranslation";

const { Title, Text } = Typography;
const { Dragger } = Upload;

// ============================================================
// Import Section
// ============================================================

function ImportSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [fileContent, setFileContent] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [namespacePath, setNamespacePath] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const { data: namespaces } = useQuery({
    queryKey: ["namespaces"],
    queryFn: getNamespaces,
  });

  const previewMutation = useMutation({
    mutationFn: () => {
      const fn = format === "json" ? importJSON : importCSV;
      return fn({ format, namespacePath, data: fileContent });
    },
    onSuccess: (data) => {
      setPreview(data);
      setCurrentStep(1);
    },
    onError: () => {
      message.error(t("error.importFailed"));
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => {
      const fn = format === "json" ? importJSON : importCSV;
      return fn({ format, namespacePath, data: fileContent });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keys"] });
      setCurrentStep(2);
    },
    onError: () => {
      message.error(t("error.importFailed"));
    },
  });

  const handleFileUpload = (file: UploadFile) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setFileContent(e.target?.result as string);
      setFileName(file.name ?? "");
      const ext = file.name?.split(".").pop()?.toLowerCase();
      setFormat(ext === "csv" ? "csv" : "json");
    };
    reader.readAsText(file as unknown as Blob);
    return false;
  };

  const handleReset = () => {
    setCurrentStep(0);
    setFileContent("");
    setFileName("");
    setPreview(null);
    setNamespacePath("");
  };

  const diffColumns = [
    {
      title: "Key",
      dataIndex: "key",
      key: "key",
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: "Type",
      key: "type",
      render: (_: unknown, __: unknown, index: number) => {
        // This is determined by the section
        return null;
      },
    },
    { title: "TH", dataIndex: "th", key: "th", ellipsis: true },
    { title: "EN", dataIndex: "en", key: "en", ellipsis: true },
  ];

  return (
    <Card title={t("action.import")} style={{ marginBottom: 24 }}>
      <Steps
        current={currentStep}
        items={[
          { title: t("import.upload") },
          { title: t("import.previewDiff") },
          { title: t("import.confirmStep") },
        ]}
        style={{ marginBottom: 24 }}
      />

      {currentStep === 0 && (
        <>
          <Select
            placeholder={t("import.selectNamespace")}
            value={namespacePath || undefined}
            onChange={setNamespacePath}
            style={{ width: 300, marginBottom: 16 }}
            options={(namespaces ?? []).map((ns) => ({
              value: ns.path,
              label: ns.path,
            }))}
          />
          <Dragger
            accept=".json,.csv"
            beforeUpload={handleFileUpload}
            maxCount={1}
            showUploadList={!!fileName}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              {t("import.uploadHint")}
            </p>
            <p className="ant-upload-hint">
              {t("import.uploadDesc")}
            </p>
          </Dragger>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => previewMutation.mutate()}
            loading={previewMutation.isPending}
            disabled={!fileContent || !namespacePath}
            style={{ marginTop: 16 }}
          >
            {t("import.previewChanges")}
          </Button>
        </>
      )}

      {currentStep === 1 && preview && (
        <>
          {preview.added.length > 0 && (
            <>
              <Title level={5}>
                <Tag color="green">{t("diff.added")}</Tag> {t("import.keysCount", { count: preview.added.length })}
              </Title>
              <Table
                rowKey="key"
                dataSource={preview.added}
                columns={[
                  {
                    title: t("col.key"),
                    dataIndex: "key",
                    render: (text: string) => <Text code>{text}</Text>,
                  },
                  { title: t("col.th"), dataIndex: "th", ellipsis: true },
                  { title: t("col.en"), dataIndex: "en", ellipsis: true },
                ]}
                pagination={false}
                size="small"
                style={{ marginBottom: 16 }}
              />
            </>
          )}

          {preview.modified.length > 0 && (
            <>
              <Title level={5}>
                <Tag color="orange">{t("diff.modified")}</Tag>{" "}
                {t("import.valuesCount", { count: preview.modified.length })}
              </Title>
              <Table
                rowKey={(r) => `${r.key}-${r.locale}`}
                dataSource={preview.modified}
                columns={[
                  {
                    title: t("col.key"),
                    dataIndex: "key",
                    render: (text: string) => <Text code>{text}</Text>,
                  },
                  { title: t("col.locale"), dataIndex: "locale", width: 80 },
                  {
                    title: t("col.oldValue"),
                    dataIndex: "oldValue",
                    ellipsis: true,
                    render: (text: string) => (
                      <Text delete type="danger">
                        {text}
                      </Text>
                    ),
                  },
                  {
                    title: t("col.newValue"),
                    dataIndex: "newValue",
                    ellipsis: true,
                    render: (text: string) => (
                      <Text type="success">{text}</Text>
                    ),
                  },
                ]}
                pagination={false}
                size="small"
                style={{ marginBottom: 16 }}
              />
            </>
          )}

          {preview.removed.length > 0 && (
            <>
              <Title level={5}>
                <Tag color="red">{t("diff.removed")}</Tag>{" "}
                {t("import.keysCount", { count: preview.removed.length })}
              </Title>
              <Table
                rowKey="key"
                dataSource={preview.removed}
                columns={[
                  {
                    title: t("col.key"),
                    dataIndex: "key",
                    render: (text: string) => <Text code>{text}</Text>,
                  },
                  { title: t("col.th"), dataIndex: "th", ellipsis: true },
                  { title: t("col.en"), dataIndex: "en", ellipsis: true },
                ]}
                pagination={false}
                size="small"
                style={{ marginBottom: 16 }}
              />
            </>
          )}

          <Space>
            <Button onClick={() => setCurrentStep(0)}>{t("common.back")}</Button>
            <Button
              type="primary"
              onClick={() => confirmMutation.mutate()}
              loading={confirmMutation.isPending}
            >
              {t("import.confirmApply")}
            </Button>
          </Space>
        </>
      )}

      {currentStep === 2 && (
        <Result
          status="success"
          icon={<CheckCircleOutlined />}
          title={t("import.complete")}
          subTitle={t("import.completeDesc", { ns: namespacePath })}
          extra={
            <Button type="primary" onClick={handleReset}>
              {t("import.importMore")}
            </Button>
          }
        />
      )}
    </Card>
  );
}

// ============================================================
// Export Section
// ============================================================

function ExportSection() {
  const { t } = useTranslation();
  const [format, setFormat] = useState<ExportOptions["format"]>("json_nested");
  const [selectedNamespaces, setSelectedNamespaces] = useState<string[]>([]);
  const [selectedLocales, setSelectedLocales] = useState<string[]>([Locale.TH, Locale.EN]);

  const { data: namespaces } = useQuery({
    queryKey: ["namespaces"],
    queryFn: getNamespaces,
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const params: any = {
        format,
        namespacePaths: selectedNamespaces,
        locales: selectedLocales,
      };
      const fn = format === "csv" ? exportCSV : exportJSON;
      const blob = await fn(params);

      const ext = format === "csv" ? "csv" : "json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `translations.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      message.success(t("export.downloaded"));
    },
    onError: () => {
      message.error(t("export.failed"));
    },
  });

  return (
    <Card title={t("action.export")}>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <div>
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            {t("export.format")}
          </Text>
          <Radio.Group
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <Radio.Button value="json_nested">{t("export.jsonNested")}</Radio.Button>
            <Radio.Button value="json_flat">{t("export.jsonFlat")}</Radio.Button>
            <Radio.Button value="csv">{t("export.csv")}</Radio.Button>
          </Radio.Group>
        </div>

        <div>
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            {t("coverage.namespaces")}
          </Text>
          <Select
            mode="multiple"
            placeholder={t("import.selectNamespace")}
            value={selectedNamespaces}
            onChange={setSelectedNamespaces}
            style={{ width: "100%", maxWidth: 500 }}
            options={(namespaces ?? []).map((ns) => ({
              value: ns.path,
              label: ns.path,
            }))}
          />
        </div>

        <div>
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            {t("export.locales")}
          </Text>
          <Checkbox.Group
            value={selectedLocales}
            onChange={(vals) => setSelectedLocales(vals as string[])}
            options={[
              { label: t("export.thLabel"), value: Locale.TH },
              { label: t("export.enLabel"), value: Locale.EN },
            ]}
          />
        </div>

        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={() => exportMutation.mutate()}
          loading={exportMutation.isPending}
        >
          {t("export.download")}
        </Button>
      </Space>
    </Card>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function ImportExportPage() {
  const { t } = useTranslation();
  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        {t("nav.importExport")}
      </Typography.Title>
      <ImportSection />
      <ExportSection />
    </div>
  );
}
