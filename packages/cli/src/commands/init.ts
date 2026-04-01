import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import inquirer from "inquirer";

const CONFIG_FILENAME = ".hato-tms.json";

interface SyncConfig {
  apiUrl: string;
  token: string;
  namespaces: string[];
  outputDir: string;
  format: "nested" | "flat";
  perNamespace: boolean;
}

export async function initCommand(): Promise<void> {
  const configPath = path.resolve(process.cwd(), CONFIG_FILENAME);
  const exists = fs.existsSync(configPath);

  console.log(chalk.bold("\n  Hato TMS — Project Setup\n"));

  if (exists) {
    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: `${CONFIG_FILENAME} already exists. Overwrite?`,
        default: false,
      },
    ]);
    if (!overwrite) {
      console.log(chalk.dim("  Aborted.\n"));
      return;
    }
  }

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "apiUrl",
      message: "Hato TMS API URL:",
      default: "https://tms.hato.app",
      validate: (v: string) =>
        v.startsWith("http") ? true : "Must be a valid URL starting with http(s)",
    },
    {
      type: "input",
      name: "token",
      message: "API token (or leave blank to use HATO_TMS_API_TOKEN env var):",
      default: "",
    },
    {
      type: "input",
      name: "namespaces",
      message: "Namespaces to sync (comma-separated, or blank for all):",
      default: "common",
    },
    {
      type: "input",
      name: "outputDir",
      message: "Output directory for locale files:",
      default: "src/locales",
    },
    {
      type: "list",
      name: "format",
      message: "JSON format:",
      choices: [
        { name: "Nested (menu.title -> { menu: { title: ... } })", value: "nested" },
        { name: "Flat (menu.title -> { \"menu.title\": ... })", value: "flat" },
      ],
      default: "nested",
    },
    {
      type: "confirm",
      name: "perNamespace",
      message: "Create separate directories per namespace?",
      default: false,
    },
  ]);

  const config: SyncConfig = {
    apiUrl: answers.apiUrl,
    token: answers.token,
    namespaces: answers.namespaces
      ? answers.namespaces
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [],
    outputDir: answers.outputDir,
    format: answers.format,
    perNamespace: answers.perNamespace,
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

  console.log(chalk.green(`\n  Created ${CONFIG_FILENAME}\n`));

  // Show next steps
  console.log(chalk.bold("  Next steps:\n"));
  console.log(chalk.dim("  1. Add the sync script to your package.json:"));
  console.log();
  console.log(
    chalk.cyan('     "scripts": {')
  );
  console.log(
    chalk.cyan('       "sync:i18n": "hato-tms sync"')
  );
  console.log(
    chalk.cyan("     }")
  );
  console.log();
  console.log(chalk.dim("  2. Run the sync:"));
  console.log(chalk.cyan("     npx hato-tms sync"));
  console.log();
  console.log(chalk.dim("  3. Add .hato-tms.json to version control (but consider"));
  console.log(chalk.dim("     removing the token field and using HATO_TMS_API_TOKEN"));
  console.log(chalk.dim("     environment variable instead)."));
  console.log();
}
