import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { readProjectConfig } from "../config";
import { pullNamespace } from "../api";
import type { TranslationKeyDTO, Locale } from "@hato-tms/shared";

function buildLocaleMap(
  keys: TranslationKeyDTO[],
  locale: Locale
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const key of keys) {
    const value = key.values.find((v) => v.locale === locale);
    if (value) {
      map[key.keyName] = value.value;
    }
  }
  // Deterministic key ordering
  const sorted: Record<string, string> = {};
  for (const k of Object.keys(map).sort()) {
    sorted[k] = map[k];
  }
  return sorted;
}

export async function pullCommand(namespace?: string): Promise<void> {
  const config = readProjectConfig();
  const ns = namespace || config.defaultNamespace;

  console.log(chalk.bold(`\n  Pulling translations for namespace: ${chalk.cyan(ns)}\n`));

  const spinner = ora("Fetching translations…").start();

  try {
    const { keys } = await pullNamespace(ns);
    spinner.succeed(`Fetched ${keys.length} keys`);

    // Build locale files
    const thMap = buildLocaleMap(keys, "th" as Locale);
    const enMap = buildLocaleMap(keys, "en" as Locale);

    // Ensure output directory exists
    const outputDir = path.resolve(config.outputPath, ns);
    fs.mkdirSync(outputDir, { recursive: true });

    // Read existing files to compute diff
    const thPath = path.join(outputDir, "th.json");
    const enPath = path.join(outputDir, "en.json");

    let existingTh: Record<string, string> = {};
    let existingEn: Record<string, string> = {};
    if (fs.existsSync(thPath)) {
      existingTh = JSON.parse(fs.readFileSync(thPath, "utf-8"));
    }
    if (fs.existsSync(enPath)) {
      existingEn = JSON.parse(fs.readFileSync(enPath, "utf-8"));
    }

    // Compute summary
    const allNewKeys = new Set([...Object.keys(thMap), ...Object.keys(enMap)]);
    const allOldKeys = new Set([...Object.keys(existingTh), ...Object.keys(existingEn)]);

    let added = 0;
    let updated = 0;
    let removed = 0;

    for (const k of allNewKeys) {
      if (!allOldKeys.has(k)) {
        added++;
      } else if (
        thMap[k] !== existingTh[k] ||
        enMap[k] !== existingEn[k]
      ) {
        updated++;
      }
    }
    for (const k of allOldKeys) {
      if (!allNewKeys.has(k)) {
        removed++;
      }
    }

    // Write files
    fs.writeFileSync(thPath, JSON.stringify(thMap, null, 2) + "\n", "utf-8");
    fs.writeFileSync(enPath, JSON.stringify(enMap, null, 2) + "\n", "utf-8");

    // Summary
    console.log(chalk.dim(`  Output: ${outputDir}/`));
    console.log(
      `  ${chalk.green(`+${added} added`)}  ${chalk.yellow(`~${updated} updated`)}  ${chalk.red(`-${removed} removed`)}`
    );
    console.log();
  } catch (err: any) {
    spinner.fail(chalk.red("Pull failed"));
    console.log(chalk.red(`  ${err?.message || "Unknown error"}\n`));
    process.exit(1);
  }
}
