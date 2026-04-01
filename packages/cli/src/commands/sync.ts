import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import axios from "axios";

interface SyncConfig {
  apiUrl: string;
  token: string;
  namespaces: string[];
  outputDir: string;
  format: "nested" | "flat";
  perNamespace: boolean;
}

const CONFIG_FILENAME = ".hato-tms.json";

function loadSyncConfig(): SyncConfig {
  const configPath = path.resolve(process.cwd(), CONFIG_FILENAME);

  if (!fs.existsSync(configPath)) {
    console.log(
      chalk.red(
        `\n  Config file not found: ${CONFIG_FILENAME}\n` +
          `  Run ${chalk.cyan("hato-tms init")} to create one.\n`
      )
    );
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  return {
    apiUrl: raw.apiUrl || process.env.HATO_TMS_API_URL || "",
    token: raw.token || process.env.HATO_TMS_API_TOKEN || "",
    namespaces: raw.namespaces || [],
    outputDir: raw.outputDir || "src/locales",
    format: raw.format || "nested",
    perNamespace: raw.perNamespace ?? false,
  };
}

async function fetchLocale(
  apiUrl: string,
  token: string,
  locale: string,
  namespaces: string[],
  format: string
): Promise<Record<string, unknown>> {
  const params: Record<string, string> = {
    locale,
    format,
  };
  if (namespaces.length > 0) {
    params.namespaces = namespaces.join(",");
  }

  const res = await axios.get(
    `${apiUrl}/api/v1/import-export/export/json`,
    {
      params,
      headers: {
        "X-API-Token": token,
        Accept: "application/json",
      },
      timeout: 30_000,
    }
  );

  return res.data;
}

function countKeys(obj: unknown, prefix = ""): string[] {
  const keys: string[] = [];
  if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const full = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        keys.push(...countKeys(v, full));
      } else {
        keys.push(full);
      }
    }
  }
  return keys;
}

function computeDiff(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown>
): { added: number; changed: number; removed: number } {
  const oldKeys = oldData ? new Set(countKeys(oldData)) : new Set<string>();
  const newKeys = new Set(countKeys(newData));

  let added = 0;
  let changed = 0;
  let removed = 0;

  for (const k of newKeys) {
    if (!oldKeys.has(k)) {
      added++;
    }
  }
  for (const k of oldKeys) {
    if (!newKeys.has(k)) {
      removed++;
    }
  }

  // For changed, compare stringified values (simple approach)
  const oldFlat = oldData ? flattenForCompare(oldData) : {};
  const newFlat = flattenForCompare(newData);
  for (const k of newKeys) {
    if (oldKeys.has(k) && oldFlat[k] !== newFlat[k]) {
      changed++;
    }
  }

  return { added, changed, removed };
}

function flattenForCompare(
  obj: unknown,
  prefix = ""
): Record<string, string> {
  const result: Record<string, string> = {};
  if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const full = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        Object.assign(result, flattenForCompare(v, full));
      } else {
        result[full] = String(v ?? "");
      }
    }
  }
  return result;
}

function readJsonSafe(filePath: string): Record<string, unknown> | null {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

function writeJsonFile(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export async function syncCommand(): Promise<void> {
  const config = loadSyncConfig();

  if (!config.apiUrl) {
    console.log(chalk.red("\n  Missing apiUrl in config or HATO_TMS_API_URL env var.\n"));
    process.exit(1);
  }
  if (!config.token) {
    console.log(chalk.red("\n  Missing token in config or HATO_TMS_API_TOKEN env var.\n"));
    process.exit(1);
  }

  const nsLabel =
    config.namespaces.length > 0
      ? config.namespaces.join(", ")
      : "all namespaces";

  console.log(
    chalk.bold(`\n  Hato TMS Sync`)
  );
  console.log(chalk.dim(`  API:        ${config.apiUrl}`));
  console.log(chalk.dim(`  Namespaces: ${nsLabel}`));
  console.log(chalk.dim(`  Output:     ${config.outputDir}`));
  console.log(chalk.dim(`  Format:     ${config.format}`));
  console.log(chalk.dim(`  Per-NS:     ${config.perNamespace}`));
  console.log();

  const locales = ["TH", "EN"];
  const localeFileNames: Record<string, string> = { TH: "th", EN: "en" };

  let totalAdded = 0;
  let totalChanged = 0;
  let totalRemoved = 0;

  if (config.perNamespace && config.namespaces.length > 0) {
    // Per-namespace mode: write {outputDir}/{namespace}/th.json, en.json
    for (const ns of config.namespaces) {
      const spinner = ora(`Syncing namespace: ${ns}`).start();

      try {
        for (const locale of locales) {
          const data = await fetchLocale(
            config.apiUrl,
            config.token,
            locale,
            [ns],
            config.format
          );

          const outDir = path.resolve(config.outputDir, ns);
          const filePath = path.join(outDir, `${localeFileNames[locale]}.json`);

          const existing = readJsonSafe(filePath);
          const diff = computeDiff(existing, data as Record<string, unknown>);
          totalAdded += diff.added;
          totalChanged += diff.changed;
          totalRemoved += diff.removed;

          writeJsonFile(filePath, data);
        }

        spinner.succeed(`${ns}`);
      } catch (err: any) {
        spinner.fail(chalk.red(`${ns}: ${err?.message || "Failed"}`));
      }
    }
  } else {
    // Single-directory mode: write {outputDir}/th.json, en.json
    for (const locale of locales) {
      const spinner = ora(`Pulling ${locale} translations...`).start();

      try {
        const data = await fetchLocale(
          config.apiUrl,
          config.token,
          locale,
          config.namespaces,
          config.format
        );

        const outDir = path.resolve(config.outputDir);
        const filePath = path.join(outDir, `${localeFileNames[locale]}.json`);

        const existing = readJsonSafe(filePath);
        const diff = computeDiff(existing, data as Record<string, unknown>);
        totalAdded += diff.added;
        totalChanged += diff.changed;
        totalRemoved += diff.removed;

        writeJsonFile(filePath, data);
        spinner.succeed(`${locale} — ${filePath}`);
      } catch (err: any) {
        spinner.fail(chalk.red(`${locale}: ${err?.message || "Failed"}`));
      }
    }
  }

  // Summary
  console.log();
  console.log(
    `  ${chalk.green(`+${totalAdded} added`)}  ` +
      `${chalk.yellow(`~${totalChanged} changed`)}  ` +
      `${chalk.red(`-${totalRemoved} removed`)}`
  );
  console.log();
}
