import * as fs from "fs";
import * as path from "path";
import Conf from "conf";

// ---- Project-level config (.hato-tms.config.json) ----

export interface ProjectConfig {
  apiUrl?: string;
  outputPath: string;
  defaultNamespace: string;
  format: "json_nested" | "json_flat";
}

const CONFIG_FILENAME = ".hato-tms.config.json";

function findProjectRoot(): string {
  let dir = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(dir, CONFIG_FILENAME))) {
      return dir;
    }
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function getProjectConfigPath(): string {
  return path.join(findProjectRoot(), CONFIG_FILENAME);
}

export function readProjectConfig(): ProjectConfig {
  const configPath = getProjectConfigPath();
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as ProjectConfig;
  }
  return {
    outputPath: "./locales",
    defaultNamespace: "common",
    format: "json_nested",
  };
}

export function writeProjectConfig(config: ProjectConfig): void {
  const configPath = getProjectConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

// ---- User-level config (stored in home dir via conf) ----

interface UserConfig {
  apiUrl: string;
  token: string;
}

const userConf = new Conf<UserConfig>({
  projectName: "hato-tms",
  schema: {
    apiUrl: { type: "string", default: "" },
    token: { type: "string", default: "" },
  },
});

export function getUserApiUrl(): string {
  return userConf.get("apiUrl") || "http://localhost:4000";
}

export function getUserToken(): string {
  return userConf.get("token") || "";
}

export function setUserCredentials(apiUrl: string, token: string): void {
  userConf.set("apiUrl", apiUrl);
  userConf.set("token", token);
}

export function getApiUrl(): string {
  const projectConfig = readProjectConfig();
  return projectConfig.apiUrl || getUserApiUrl();
}
