import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { setUserCredentials } from "../config";
import { login, resetClient } from "../api";

export async function loginCommand(): Promise<void> {
  console.log(chalk.bold("\n  Hato TMS — Login\n"));

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "apiUrl",
      message: "API URL:",
      default: "https://hato-tms-api.vercel.app",
      validate: (v: string) =>
        v.startsWith("http://") || v.startsWith("https://")
          ? true
          : "Must be a valid URL starting with http:// or https://",
    },
    {
      type: "input",
      name: "email",
      message: "Email:",
      validate: (v: string) => (v.includes("@") ? true : "Enter a valid email"),
    },
  ]);

  const spinner = ora("Authenticating…").start();

  try {
    const { token, user } = await login(answers.apiUrl, answers.email);

    setUserCredentials(answers.apiUrl, token);
    resetClient();

    spinner.succeed(
      chalk.green(`Logged in as ${chalk.bold(user.name)} (${user.email})`)
    );
    console.log(
      chalk.dim(`  Token stored in user config. API: ${answers.apiUrl}\n`)
    );
  } catch (err: any) {
    spinner.fail(chalk.red("Login failed"));
    if (err?.response?.status === 404) {
      console.log(chalk.red("  Email not found. Check your email address.\n"));
    } else if (err?.response?.status === 401) {
      console.log(chalk.red("  Unauthorized.\n"));
    } else {
      console.log(
        chalk.red(`  ${err?.message || "Could not reach the server."}\n`)
      );
    }
    process.exit(1);
  }
}
