import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { readProjectConfig } from "../config";
import { exportNamespace } from "../api";
import type { ExportOptions, Locale } from "@hato-tms/shared";

export async function exportCommand(namespace?: string): Promise<void> {
  const config = readProjectConfig();
  const ns = namespace || config.defaultNamespace;

  const { format } = await inquirer.prompt([
    {
      type: "list",
      name: "format",
      message: "Export format:",
      choices: [
        { name: "JSON (nested)", value: "json_nested" },
        { name: "JSON (flat)", value: "json_flat" },
        { name: "CSV", value: "csv" },
      ],
      default: config.format || "json_nested",
    },
  ]);

  const exportOptions: ExportOptions = {
    format,
    namespacePaths: [ns],
    locales: ["th" as Locale, "en" as Locale],
  };

  const spinner = ora("Exporting translations…").start();

  try {
    const data = await exportNamespace(exportOptions);
    spinner.stop();

    // Determine output file name
    const ext = format === "csv" ? "csv" : "json";
    const outputFile = path.resolve(`${ns}.${ext}`);

    fs.writeFileSync(outputFile, data, "utf-8");

    console.log(
      chalk.green(`\n  Exported to ${chalk.bold(outputFile)}\n`)
    );
  } catch (err: any) {
    spinner.fail(chalk.red("Export failed"));
    console.log(chalk.red(`  ${err?.message || "Unknown error"}\n`));
    process.exit(1);
  }
}
