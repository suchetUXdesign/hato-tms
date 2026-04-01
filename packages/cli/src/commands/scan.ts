import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { readProjectConfig } from "../config";
import { getRemoteKeys } from "../api";

// Patterns to match translation key usage in source code
const KEY_PATTERNS = [
  // t("key.name") or t('key.name')
  /\bt\(\s*["']([a-zA-Z0-9_.]+)["']\s*[),]/g,
  // i18n.t("key.name") or i18n.t('key.name')
  /i18n\.t\(\s*["']([a-zA-Z0-9_.]+)["']\s*[),]/g,
  // $t("key.name") — Vue style
  /\$t\(\s*["']([a-zA-Z0-9_.]+)["']\s*[),]/g,
  // useTranslation pattern with t function — already covered by first pattern
];

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  ".turbo",
  "coverage",
]);

function scanDirectory(dir: string): Map<string, string[]> {
  const keyUsages = new Map<string, string[]>(); // key -> [file:line, ...]

  function walk(currentDir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".") continue;
      if (IGNORE_DIRS.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        scanFile(fullPath, keyUsages);
      }
    }
  }

  walk(dir);
  return keyUsages;
}

function scanFile(filePath: string, keyUsages: Map<string, string[]>): void {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return;
  }

  const lines = content.split("\n");

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    for (const pattern of KEY_PATTERNS) {
      // Reset lastIndex for global regex
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line)) !== null) {
        const key = match[1];
        const location = `${path.relative(process.cwd(), filePath)}:${lineNum + 1}`;
        if (!keyUsages.has(key)) {
          keyUsages.set(key, []);
        }
        keyUsages.get(key)!.push(location);
      }
    }
  }
}

export async function scanCommand(): Promise<void> {
  const config = readProjectConfig();
  const ns = config.defaultNamespace;

  console.log(
    chalk.bold(`\n  Scanning for translation keys in current directory…\n`)
  );

  // Step 1: Scan local files
  const scanSpinner = ora("Scanning source files…").start();
  const localKeys = scanDirectory(process.cwd());
  scanSpinner.succeed(`Found ${localKeys.size} unique keys in source code`);

  // Step 2: Fetch remote keys
  const fetchSpinner = ora("Fetching TMS keys…").start();
  let remoteKeys: Set<string>;
  try {
    const keys = await getRemoteKeys(ns);
    remoteKeys = new Set(keys.map((k) => k.fullKey));
    // Also add just keyName for matching without namespace prefix
    for (const k of keys) {
      remoteKeys.add(k.keyName);
    }
    fetchSpinner.succeed(`Found ${keys.length} keys in TMS (namespace: ${ns})`);
  } catch (err: any) {
    fetchSpinner.fail(chalk.red("Could not fetch TMS keys"));
    console.log(chalk.red(`  ${err?.message || "Unknown error"}`));
    console.log(chalk.dim("  Showing local scan results only.\n"));
    remoteKeys = new Set();
  }

  // Step 3: Compare
  const unregistered: Array<{ key: string; locations: string[] }> = [];
  const used = new Set<string>();

  for (const [key, locations] of localKeys) {
    if (remoteKeys.has(key)) {
      used.add(key);
    } else {
      unregistered.push({ key, locations });
    }
  }

  const unused: string[] = [];
  for (const rk of remoteKeys) {
    if (!localKeys.has(rk) && !used.has(rk)) {
      unused.push(rk);
    }
  }

  // Step 4: Report
  console.log();

  if (unregistered.length > 0) {
    console.log(
      chalk.yellow.bold(`  ⚠ Unregistered keys (${unregistered.length}):`)
    );
    console.log(
      chalk.dim("  Keys found in code but not registered in TMS\n")
    );
    for (const item of unregistered.sort((a, b) => a.key.localeCompare(b.key))) {
      console.log(chalk.yellow(`    ${item.key}`));
      for (const loc of item.locations.slice(0, 3)) {
        console.log(chalk.dim(`      ${loc}`));
      }
      if (item.locations.length > 3) {
        console.log(chalk.dim(`      … and ${item.locations.length - 3} more`));
      }
    }
    console.log();
  }

  if (unused.length > 0) {
    console.log(chalk.red.bold(`  ✗ Unused keys (${unused.length}):`));
    console.log(
      chalk.dim("  Keys registered in TMS but not found in code\n")
    );
    for (const key of unused.sort()) {
      console.log(chalk.red(`    ${key}`));
    }
    console.log();
  }

  if (unregistered.length === 0 && unused.length === 0) {
    console.log(chalk.green.bold("  ✓ All keys are in sync!\n"));
  }

  // Summary
  console.log(chalk.dim("  ─────────────────────────────────"));
  console.log(
    `  ${chalk.bold("Summary:")} ${localKeys.size} in code, ${remoteKeys.size} in TMS`
  );
  console.log(
    `  ${chalk.green(`${used.size} matched`)}  ${chalk.yellow(`${unregistered.length} unregistered`)}  ${chalk.red(`${unused.length} unused`)}`
  );
  console.log();
}
