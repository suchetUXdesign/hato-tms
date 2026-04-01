// API client for the Figma plugin — uses fetch (available in Figma plugin iframe)

import type {
  TranslationKeyDTO,
  PaginatedResponse,
  CreateKeyRequest,
  TranslationValueDTO,
  NamespaceDTO,
  Locale,
} from "@hato-tms/shared";

let apiUrl = "";
let authToken = "";

export function configure(url: string, token: string): void {
  apiUrl = url.replace(/\/$/, "");
  authToken = token;
}

export function isConfigured(): boolean {
  return !!apiUrl && !!authToken;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Token": authToken,
  };

  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ---- Get namespaces ----

export async function getNamespaces(): Promise<NamespaceDTO[]> {
  const result = await request<{ data: NamespaceDTO[] } | NamespaceDTO[]>(
    "GET",
    "/api/v1/namespaces"
  );
  return Array.isArray(result) ? result : (result as any).data ?? result;
}

// ---- Get all keys (browse) ----

export async function getAllKeys(
  pageSize = 100,
  namespace?: string,
  platform?: string
): Promise<TranslationKeyDTO[]> {
  const params = new URLSearchParams();
  params.set("pageSize", String(pageSize));
  params.set("sortBy", "updated");
  params.set("sortOrder", "desc");
  if (namespace) params.set("namespace", namespace);
  if (platform) params.set("platform", platform);

  const result = await request<PaginatedResponse<TranslationKeyDTO>>(
    "GET",
    `/api/v1/keys?${params.toString()}`
  );
  return result.data;
}

// ---- Search keys ----

export async function searchKeys(
  query: string,
  namespace?: string
): Promise<TranslationKeyDTO[]> {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (namespace) params.set("namespace", namespace);
  params.set("pageSize", "20");

  const result = await request<PaginatedResponse<TranslationKeyDTO>>(
    "GET",
    `/api/v1/keys?${params.toString()}`
  );
  return result.data;
}

// ---- Get single key ----

export async function getKey(keyId: string): Promise<TranslationKeyDTO> {
  return request<TranslationKeyDTO>("GET", `/api/v1/keys/${keyId}`);
}

// ---- Create key ----

export async function createKey(
  data: CreateKeyRequest
): Promise<TranslationKeyDTO> {
  return request<TranslationKeyDTO>("POST", "/api/v1/keys", data);
}

// ---- Get values for a key ----

export async function getKeyValues(
  keyId: string
): Promise<TranslationValueDTO[]> {
  const key = await getKey(keyId);
  return key.values;
}

// ---- Get value for specific locale ----

export function getValueForLocale(
  values: TranslationValueDTO[],
  locale: Locale
): string {
  const normalizedLocale = (locale as string).toUpperCase();
  const v = values.find((val) => val.locale.toUpperCase() === normalizedLocale);
  return v?.value || "";
}
