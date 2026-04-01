import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { readProjectConfig } from "../config";
import { getRemoteKeys } from "../api";
import type { Locale } from "@hato-tms/shared";

export async function diffCommand(namespace?: string): Promise<void> {
  const config = readProjectConfig();
  const ns = namespace || config.defaultNamespace;

  console.log(
    chalk.bold(`\n  Comparing local vs remote for namespace: ${chalk.cyan(ns)}\n`)
  );

  // Load local files
  const localDir = path.resolve(config.outputPath, ns);
  const thPath = path.join(localDir, "th.json");
  const enPath = path.join(localDir, "en.json");

  let localTh: Record<string, string> = {};
  let localEn: Record<string, string> = {};

  if (fs.existsSync(thPath)) {
    localTh = JSON.parse(fs.readFileSync(thPath, "utf-8"));
  }
  if (fs.existsSync(enPath)) {
    localEn = JSON.parse(fs.readFileSync(enPath, "utf-8"));
  }

  const localKeySet = new Set([
    ...Object.keys(localTh),
    ...Object.keys(localEn),
  ]);

  if (localKeySet.size === 0) {
    console.log(
      chalk.dim(
        `  No local translation files found at ${localDir}/\n  Run "hato-tms pull" first.\n`
      )
    );
    return;
  }

  // Fetch remote
  const spinner = ora("Fetching remote translations…").start();

  let remoteTh: Record<string, string> = {};
  let remoteEn: Record<string, string> = {};

  try {
    const keys = await getRemoteKeys(ns);
    for (const key of keys) {
      const thVal = key.values.find((v) => v.locale === ("th" as Locale));
      const enVal = key.values.find((v) => v.locale === ("en" as Locale));
      if (thVal) remoteTh[key.keyName] = thVal.value;
      if (enVal) remoteEn[key.keyName] = enVal.value;
    }
    spinner.succeed(`Fetched ${keys.length} remote keys`);
  } catch (err: any) {
    spinner.fail(chalk.red("Could not fetch remote translations"));
    console.log(chalk.red(`  ${err?.message || "Unknown error"}\n`));
    process.exit(1);
  }

  const remoteKeySet = new Set([
    ...Object.keys(remoteTh),
    ...Object.keys(remoteEn),
  ]);

  // Compute diffs
  const added: string[] = []; // in remote but not local
  const removed: string[] = []; // in local but not remote
  const modified: Array<{
    key: string;
    locale: string;
    local: string;
    remote: string;
  }> = [];

  for (const key of remoteKeySet) {
    if (!localKeySet.has(key)) {
      added.push(key);
    }
  }

  for (const key of localKeySet) {
    if (!remoteKeySet.has(key)) {
      removed.push(key);
    }
  }

  for (const key of localKeySet) {
    if (!remoteKeySet.has(key)) continue;
    if (localTh[key] !== undefined && remoteTh[key] !== undefined && localTh[key] !== remoteTh[key]) {
      modified.push({
        key,
        locale: "TH",
        local: localTh[key],
        remote: remoteTh[key],
      });
    }
    if (localEn[key] !== undefined && remoteEn[key] !== undefined && localEn[key] !== remoteEn[key]) {
      modified.push({
        key,
        locale: "EN",
        local: localEn[key],
        remote: remoteEn[key],
      });
    }
  }

  // Display
  if (added.length === 0 && removed.length === 0 && modified.length === 0) {
    console.log(chalk.green.bold("\n  ✓ Local and remote are in sync!\n"));
    return;
  }

  console.log();

  if (added.length > 0) {
    console.log(
      chalk.green.bold(`  + New in remote (${added.length}):`)
    );
    for (const key of added.sort()) {
      console.log(chalk.green(`    + ${key}`));
      if (remoteTh[key]) console.log(chalk.dim(`      TH: ${remoteTh[key]}`));
      if (remoteEn[key]) console.log(chalk.dim(`      EN: ${remoteEn[key]}`));
    }
    console.log();
  }

  if (modified.length > 0) {
    console.log(
      chalk.yellow.bold(`  ~ Modified (${modified.length}):`)
    );
    for (const item of modified.sort((a, b) => a.key.localeCompare(b.key))) {
      console.log(chalk.yellow(`    ~ ${item.key} [${item.locale}]`));
      console.log(chalk.red(`      local:  ${item.local}`));
      console.log(chalk.green(`      remote: ${item.remote}`));
    }
    console.log();
  }

  if (removed.length > 0) {
    console.log(
      chalk.red.bold(`  - Removed from remote (${removed.length}):`)
    );
    for (const key of removed.sort()) {
      console.log(chalk.red(`    - ${key}`));
    }
    console.log();
  }

  // Summary
  console.log(chalk.dim("  ─────────────────────────────────"));
  console.log(
    `  ${chalk.green(`+${added.length} added`)}  ${chalk.yellow(`~${modified.length} modified`)}  ${chalk.red(`-${removed.length} removed`)}`
  );
  console.log();
}
