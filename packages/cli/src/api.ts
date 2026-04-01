import axios, { AxiosInstance } from "axios";
import { getApiUrl, getUserToken } from "./config";
import type {
  TranslationKeyDTO,
  PaginatedResponse,
  SearchParams,
  ImportPreview,
  ExportOptions,
} from "@hato-tms/shared";

let client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (!client) {
    client = axios.create({
      baseURL: getApiUrl(),
      headers: {
        Authorization: `Bearer ${getUserToken()}`,
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    });
  }
  return client;
}

export function resetClient(): void {
  client = null;
}

// ---- Auth ----

export async function login(
  apiUrl: string,
  email: string,
  password: string
): Promise<{ token: string; user: { id: string; name: string; email: string } }> {
  const res = await axios.post(`${apiUrl}/api/auth/login`, { email, password });
  return res.data;
}

// ---- Keys ----

export async function getKeys(
  params: SearchParams = {}
): Promise<PaginatedResponse<TranslationKeyDTO>> {
  const res = await getClient().get("/api/keys", { params });
  return res.data;
}

export async function getRemoteKeys(
  namespace: string
): Promise<TranslationKeyDTO[]> {
  const allKeys: TranslationKeyDTO[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const res = await getKeys({ namespace, page, pageSize });
    allKeys.push(...res.data);
    if (page >= res.totalPages) break;
    page++;
  }

  return allKeys;
}

// ---- Pull ----

export async function pullNamespace(
  namespace: string
): Promise<{ keys: TranslationKeyDTO[] }> {
  const keys = await getRemoteKeys(namespace);
  return { keys };
}

// ---- Push / Import ----

export async function pushFile(
  namespacePath: string,
  format: "json" | "csv",
  data: string
): Promise<ImportPreview> {
  const res = await getClient().post("/api/import/preview", {
    namespacePath,
    format,
    data,
  });
  return res.data;
}

export async function confirmPush(
  namespacePath: string,
  format: "json" | "csv",
  data: string
): Promise<{ added: number; modified: number; removed: number }> {
  const res = await getClient().post("/api/import", {
    namespacePath,
    format,
    data,
  });
  return res.data;
}

// ---- Export ----

export async function exportNamespace(
  options: ExportOptions
): Promise<string> {
  const res = await getClient().post("/api/export", options, {
    responseType: "text",
  });
  return res.data;
}

// ---- Search (for scan) ----

export async function searchKeys(
  query: string,
  namespace?: string
): Promise<TranslationKeyDTO[]> {
  const res = await getKeys({ query, namespace, pageSize: 200 });
  return res.data;
}
