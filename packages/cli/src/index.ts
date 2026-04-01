#!/usr/bin/env node

import { Command } from "commander";
import { loginCommand } from "./commands/login";
import { pullCommand } from "./commands/pull";
import { pushCommand } from "./commands/push";
import { scanCommand } from "./commands/scan";
import { exportCommand } from "./commands/export";
import { diffCommand } from "./commands/diff";
import { syncCommand } from "./commands/sync";
import { initCommand } from "./commands/init";

const program = new Command();

program
  .name("hato-tms")
  .description("Hato TMS — Translation Management CLI")
  .version("1.0.0");

program
  .command("login")
  .description("Authenticate with the Hato TMS server")
  .action(async () => {
    await loginCommand();
  });

program
  .command("pull [namespace]")
  .description(
    "Download translations from TMS to local JSON files"
  )
  .action(async (namespace?: string) => {
    await pullCommand(namespace);
  });

program
  .command("push <file>")
  .description("Upload a local JSON/CSV file to TMS")
  .action(async (file: string) => {
    await pushCommand(file);
  });

program
  .command("scan")
  .description(
    "Scan source code for translation key usage and compare with TMS"
  )
  .action(async () => {
    await scanCommand();
  });

program
  .command("export [namespace]")
  .description("Export translations as JSON or CSV")
  .action(async (namespace?: string) => {
    await exportCommand(namespace);
  });

program
  .command("diff [namespace]")
  .description(
    "Show diff between local and remote translations"
  )
  .action(async (namespace?: string) => {
    await diffCommand(namespace);
  });

program
  .command("sync")
  .description(
    "Sync translations from TMS to local JSON files (uses .hato-tms.json config)"
  )
  .action(async () => {
    await syncCommand();
  });

program
  .command("init")
  .description(
    "Initialize .hato-tms.json config for translation syncing"
  )
  .action(async () => {
    await initCommand();
  });

program.parse();
