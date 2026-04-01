import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { readProjectConfig } from "../config";
import { pushFile, confirmPush } from "../api";

export async function pushCommand(file: string): Promise<void> {
  const config = readProjectConfig();

  // Resolve file path
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.log(chalk.red(`\n  File not found: ${filePath}\n`));
    process.exit(1);
  }

  // Determine namespace from file path or config
  const dirName = path.basename(path.dirname(filePath));
  const namespacePath = dirName !== "locales" ? dirName : config.defaultNamespace;

  // Determine format from extension
  const ext = path.extname(filePath).toLowerCase();
  const format: "json" | "csv" = ext === ".csv" ? "csv" : "json";

  const data = fs.readFileSync(filePath, "utf-8");

  console.log(
    chalk.bold(
      `\n  Pushing ${chalk.cyan(path.basename(filePath))} to namespace ${chalk.cyan(namespacePath)}\n`
    )
  );

  const spinner = ora("Computing diff…").start();

  try {
    const preview = await pushFile(namespacePath, format, data);
    spinner.stop();

    const totalChanges =
      preview.added.length + preview.modified.length + preview.removed.length;

    if (totalChanges === 0) {
      console.log(chalk.dim("  No changes detected. Everything is up to date.\n"));
      return;
    }

    // Show diff preview
    console.log(chalk.bold("  Changes preview:\n"));

    if (preview.added.length > 0) {
      console.log(chalk.green.bold(`  + Added (${preview.added.length}):`));
      for (const item of preview.added) {
        console.log(chalk.green(`    + ${item.key}`));
        console.log(chalk.green(`      TH: ${item.th}`));
        console.log(chalk.green(`      EN: ${item.en}`));
      }
      console.log();
    }

    if (preview.modified.length > 0) {
      console.log(chalk.yellow.bold(`  ~ Modified (${preview.modified.length}):`));
      for (const item of preview.modified) {
        console.log(chalk.yellow(`    ~ ${item.key} [${item.locale}]`));
        console.log(chalk.red(`      - ${item.oldValue}`));
        console.log(chalk.green(`      + ${item.newValue}`));
      }
      console.log();
    }

    if (preview.removed.length > 0) {
      console.log(chalk.red.bold(`  - Removed (${preview.removed.length}):`));
      for (const item of preview.removed) {
        console.log(chalk.red(`    - ${item.key}`));
      }
      console.log();
    }

    console.log(
      chalk.dim(
        `  Total: ${chalk.green(`+${preview.added.length}`)} ${chalk.yellow(`~${preview.modified.length}`)} ${chalk.red(`-${preview.removed.length}`)}`
      )
    );
    console.log();

    // Confirmation
    const { confirmed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmed",
        message: "Push these changes?",
        default: false,
      },
    ]);

    if (!confirmed) {
      console.log(chalk.dim("\n  Push cancelled.\n"));
      return;
    }

    const pushSpinner = ora("Pushing changes…").start();
    const result = await confirmPush(namespacePath, format, data);
    pushSpinner.succeed(
      chalk.green(
        `Push complete: ${chalk.bold(`+${result.added}`)} added, ${chalk.bold(`~${result.modified}`)} modified, ${chalk.bold(`-${result.removed}`)} removed`
      )
    );
    console.log();
  } catch (err: any) {
    spinner.fail(chalk.red("Push failed"));
    console.log(chalk.red(`  ${err?.message || "Unknown error"}\n`));
    process.exit(1);
  }
}
