import React, { useState } from "react";
import {
  Card,
  Row,
  Col,
  Progress,
  Typography,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Skeleton,
  Result,
  Modal,
} from "antd";
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import type { CoverageStats } from "@hato-tms/shared";
import { getCoverage, getMissingKeys } from "../services/api";
import { useTranslation } from "../hooks/useTranslation";

const { Title, Text } = Typography;

function getCoverageColor(pct: number): string {
  if (pct >= 90) return "#52c41a";
  if (pct >= 70) return "#faad14";
  return "#ff4d4f";
}

function getCoverageStatus(pct: number) {
  if (pct >= 90) return { icon: <CheckCircleOutlined />, label: "Good" };
  if (pct >= 70) return { icon: <WarningOutlined />, label: "Partial" };
  return { icon: <CloseCircleOutlined />, label: "Low" };
}

function OverallStats({ stats }: { stats: CoverageStats[] }) {
  const { t } = useTranslation();
  const totalKeys = stats.reduce((sum, s) => sum + s.totalKeys, 0);
  const totalTH = stats.reduce((sum, s) => sum + s.translatedTH, 0);
  const totalEN = stats.reduce((sum, s) => sum + s.translatedEN, 0);
  const overallTH = totalKeys > 0 ? Math.round((totalTH / totalKeys) * 100) : 0;
  const overallEN = totalKeys > 0 ? Math.round((totalEN / totalKeys) * 100) : 0;

  return (
    <Card style={{ marginBottom: 24 }}>
      <Row gutter={24}>
        <Col span={6}>
          <Statistic title={t("coverage.totalKeys")} value={totalKeys} />
        </Col>
        <Col span={6}>
          <Statistic
            title={t("coverage.thCoverage")}
            value={overallTH}
            suffix="%"
            valueStyle={{ color: getCoverageColor(overallTH) }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title={t("coverage.enCoverage")}
            value={overallEN}
            suffix="%"
            valueStyle={{ color: getCoverageColor(overallEN) }}
          />
        </Col>
        <Col span={6}>
          <Statistic title={t("coverage.namespaces")} value={stats.length} />
        </Col>
      </Row>
    </Card>
  );
}

function NamespaceCard({
  stats,
  onClick,
}: {
  stats: CoverageStats;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card
      hoverable
      onClick={onClick}
      size="small"
      style={{ height: "100%" }}
      extra={
        <Button type="text" size="small" icon={<EyeOutlined />}>
          {t("coverage.details")}
        </Button>
      }
    >
      <Title level={5} style={{ margin: 0, marginBottom: 12 }}>
        {stats.namespacePath}
      </Title>
      <Text type="secondary">{t("coverage.keys", { count: stats.totalKeys })}</Text>

      <div style={{ marginTop: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <Text>TH</Text>
          <Text style={{ color: getCoverageColor(stats.coverageTH) }}>
            {stats.coverageTH}%
          </Text>
        </div>
        <Progress
          percent={stats.coverageTH}
          showInfo={false}
          strokeColor={getCoverageColor(stats.coverageTH)}
          size="small"
        />
      </div>

      <div style={{ marginTop: 8 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <Text>EN</Text>
          <Text style={{ color: getCoverageColor(stats.coverageEN) }}>
            {stats.coverageEN}%
          </Text>
        </div>
        <Progress
          percent={stats.coverageEN}
          showInfo={false}
          strokeColor={getCoverageColor(stats.coverageEN)}
          size="small"
        />
      </div>

      <div style={{ marginTop: 8 }}>
        <Text type="secondary">
          {t("coverage.pendingCount", { count: stats.pending })}
        </Text>
      </div>
    </Card>
  );
}

export default function CoveragePage() {
  const { t } = useTranslation();
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const [missingModalOpen, setMissingModalOpen] = useState(false);

  const {
    data: coverageStats,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["coverage"],
    queryFn: getCoverage,
  });

  const { data: missingKeys, isLoading: missingLoading } = useQuery({
    queryKey: ["missingKeys"],
    queryFn: getMissingKeys,
    enabled: missingModalOpen,
  });

  if (isError) {
    return (
      <Result
        status="error"
        title={t("coverage.loadFailed")}
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  const stats = coverageStats ?? [];

  const filteredMissing = selectedNamespace
    ? (missingKeys ?? []).filter(
        (k) => k.namespacePath === selectedNamespace,
      )
    : (missingKeys ?? []);

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        {t("coverage.title")}
      </Title>

      <OverallStats stats={stats} />

      <Row gutter={[16, 16]}>
        {stats.map((s) => (
          <Col xs={24} sm={12} lg={8} xl={6} key={s.namespacePath}>
            <NamespaceCard
              stats={s}
              onClick={() => {
                setSelectedNamespace(s.namespacePath);
                setMissingModalOpen(true);
              }}
            />
          </Col>
        ))}
      </Row>

      <Modal
        title={t("coverage.missingKeys", { ns: selectedNamespace ?? t("common.all") })}
        open={missingModalOpen}
        onCancel={() => {
          setMissingModalOpen(false);
          setSelectedNamespace(null);
        }}
        footer={null}
        width={700}
      >
        <Table
          rowKey="id"
          dataSource={filteredMissing}
          loading={missingLoading}
          columns={[
            {
              title: t("col.key"),
              dataIndex: "fullKey",
              render: (text: string) => <Text code>{text}</Text>,
            },
            {
              title: t("col.th"),
              key: "th",
              width: 120,
              render: (_: unknown, record: any) => {
                const missing = record.missingLocales ?? [];
                const isMissing = missing.some((l: string) => l.toUpperCase() === "TH");
                return isMissing ? (
                  <Tag color="red">{t("coverage.missing")}</Tag>
                ) : (
                  <Tag color="green">{record.thValue ? t("coverage.ok") : "—"}</Tag>
                );
              },
            },
            {
              title: t("col.en"),
              key: "en",
              width: 120,
              render: (_: unknown, record: any) => {
                const missing = record.missingLocales ?? [];
                const isMissing = missing.some((l: string) => l.toUpperCase() === "EN");
                return isMissing ? (
                  <Tag color="red">{t("coverage.missing")}</Tag>
                ) : (
                  <Tag color="green">{record.enValue ? t("coverage.ok") : "—"}</Tag>
                );
              },
            },
            {
              title: t("filter.namespace"),
              dataIndex: "namespacePath",
              width: 160,
              render: (ns: string) => (
                <Text type="secondary">{ns}</Text>
              ),
            },
          ]}
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Modal>
    </div>
  );
}
