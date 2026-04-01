import axios from "axios";
import type {
  TranslationKeyDTO,
  NamespaceDTO,
  ChangeRequestDTO,
  CoverageStats,
  CreateKeyRequest,
  UpdateKeyRequest,
  UpdateValueRequest,
  ImportRequest,
  ImportPreview,
  ExportOptions,
  SearchParams,
  PaginatedResponse,
  UserDTO,
  CRStatus,
} from "@hato-tms/shared";

// ============================================================
// Token management
// ============================================================

const TOKEN_KEY = "hato_token";
const REFRESH_TOKEN_KEY = "hato_refresh_token";
const EXPIRES_AT_KEY = "hato_token_expires_at";

/** How many ms before expiry to trigger a refresh (5 minutes) */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getRefreshTokenValue(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function getExpiresAt(): number {
  return parseInt(localStorage.getItem(EXPIRES_AT_KEY) || "0", 10);
}

function saveTokens(token: string, refreshToken: string, expiresIn: number) {
  const expiresAt = Date.now() + expiresIn * 1000;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
  scheduleTokenRefresh(expiresIn * 1000);
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function redirectToLogin(reason?: string) {
  clearTokens();
  if (reason) {
    // Store message so LoginPage can display it
    sessionStorage.setItem("hato_session_message", reason);
  }
  window.location.href = "/login";
}

// ============================================================
// Auto-refresh scheduling
// ============================================================

function scheduleTokenRefresh(expiresInMs: number) {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  // Refresh 5 minutes before expiry
  const delay = Math.max(expiresInMs - REFRESH_MARGIN_MS, 10_000);

  refreshTimer = setTimeout(() => {
    doRefresh().catch(() => {
      // Refresh failed — token will expire, 401 interceptor will handle it
    });
  }, delay);
}

async function doRefresh(): Promise<string> {
  // Prevent concurrent refreshes
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = getRefreshTokenValue();
  if (!refreshToken) {
    redirectToLogin("session_expired");
    return Promise.reject(new Error("No refresh token"));
  }

  isRefreshing = true;
  refreshPromise = axios
    .post(`${API_BASE}/auth/refresh`, { refreshToken })
    .then(({ data }) => {
      saveTokens(data.token, data.refreshToken, data.expiresIn);
      return data.token as string;
    })
    .catch((err) => {
      // Refresh token also expired or invalid
      redirectToLogin("session_expired");
      throw err;
    })
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });

  return refreshPromise;
}

// ============================================================
// Boot: schedule refresh from existing token if still valid
// ============================================================

function bootTokenRefresh() {
  const expiresAt = getExpiresAt();
  if (!expiresAt || !getAccessToken()) return;

  const remaining = expiresAt - Date.now();
  if (remaining <= 0) {
    // Already expired — try refresh immediately
    doRefresh().catch(() => {});
  } else {
    scheduleTokenRefresh(remaining);
  }
}

// Run on module load
bootTokenRefresh();

// ============================================================
// Visibility change: re-check token when tab comes back
// ============================================================

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (!getAccessToken()) return;

  const expiresAt = getExpiresAt();
  const remaining = expiresAt - Date.now();

  if (remaining <= 0) {
    // Token expired while tab was hidden — try refresh
    doRefresh().catch(() => {});
  } else if (remaining <= REFRESH_MARGIN_MS) {
    // About to expire — refresh now
    doRefresh().catch(() => {});
  } else {
    // Still valid — re-schedule and refetch user data
    scheduleTokenRefresh(remaining);
  }

  // Re-fetch user data when tab becomes active
  // This is handled by React Query's refetchOnWindowFocus
  // We enable it specifically for the "me" query (see main.tsx)
});

// ============================================================
// Axios instance
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : "/api/v1";

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use(async (config) => {
  let token = getAccessToken();

  // If token is about to expire, refresh first
  const expiresAt = getExpiresAt();
  if (token && expiresAt && expiresAt - Date.now() < 30_000) {
    try {
      token = await doRefresh();
    } catch {
      // Will fail with 401 and interceptor will redirect
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't retried yet, try refreshing
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = getRefreshTokenValue();
      if (refreshToken) {
        try {
          const newToken = await doRefresh();
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch {
          // Refresh also failed
        }
      }

      // No refresh token or refresh failed — redirect to login
      redirectToLogin("session_expired");
    }

    return Promise.reject(error);
  },
);

// ============================================================
// Auth
// ============================================================

export async function login(email: string): Promise<{ token: string; user: UserDTO }> {
  const { data } = await api.post("/auth/login", { email });
  // Save both tokens
  saveTokens(data.token, data.refreshToken, data.expiresIn);
  return data;
}

export async function getMe(): Promise<UserDTO> {
  const { data } = await api.get("/auth/me");
  return data.user ?? data;
}

export async function regenerateToken(): Promise<string> {
  const { data } = await api.post("/auth/token/regenerate");
  return data.apiToken;
}

export async function getUsers(): Promise<UserDTO[]> {
  const { data } = await api.get("/auth/users");
  return data.data ?? data;
}

// ---- User Management (Admin) ----

export async function getAdminUsers(params?: { search?: string; role?: string }): Promise<any[]> {
  const { data } = await api.get("/users", { params });
  return data.data ?? data;
}

export async function inviteUser(payload: { email: string; name: string; role: string }): Promise<any> {
  const { data } = await api.post("/users/invite", payload);
  return data.data ?? data;
}

export async function updateUser(id: string, payload: { name?: string; role?: string; isActive?: boolean }): Promise<any> {
  const { data } = await api.put(`/users/${id}`, payload);
  return data.data ?? data;
}

export async function deleteUser(id: string): Promise<any> {
  const { data } = await api.delete(`/users/${id}`);
  return data.data ?? data;
}

// ---- Keys ----

export async function getKeys(
  params: SearchParams,
): Promise<PaginatedResponse<TranslationKeyDTO>> {
  const { data } = await api.get("/keys", { params });
  return data;
}

export async function getKey(id: string): Promise<TranslationKeyDTO> {
  const { data } = await api.get(`/keys/${id}`);
  return data;
}

export async function createKey(
  payload: CreateKeyRequest,
): Promise<TranslationKeyDTO> {
  const { data } = await api.post("/keys", payload);
  return data;
}

export async function updateKey(
  id: string,
  payload: UpdateKeyRequest,
): Promise<TranslationKeyDTO> {
  const { data } = await api.patch(`/keys/${id}`, payload);
  return data;
}

export async function updateValue(
  keyId: string,
  payload: UpdateValueRequest,
): Promise<TranslationKeyDTO> {
  const normalizedPayload = {
    locale: payload.locale.toUpperCase(),
    value: payload.value,
  };
  const { data } = await api.put(`/keys/${keyId}/values`, [normalizedPayload]);
  return data;
}

export async function saveKeyDetail(
  keyId: string,
  payload: { th?: string; en?: string; tags?: string[] },
): Promise<{ status: string; changes: { fieldPath: string; from: any; to: any }[]; values: any[] }> {
  const { data } = await api.put(`/keys/${keyId}/save`, payload);
  return data;
}

export interface KeyEditHistoryEntry {
  id: string;
  action: string;
  changedAt: string;
  changedBy: string;
  changedByEmail: string;
  changes: { fieldPath: string; from: any; to: any }[];
}

export async function getKeyHistory(keyId: string): Promise<KeyEditHistoryEntry[]> {
  const { data } = await api.get(`/keys/${keyId}/history`);
  return data.history ?? [];
}

export async function deleteKey(id: string): Promise<void> {
  await api.delete(`/keys/${id}`);
}

// ---- Namespaces ----

export async function getNamespaces(): Promise<NamespaceDTO[]> {
  const { data } = await api.get("/namespaces");
  return data.data ?? data;
}

export async function createNamespace(payload: {
  path: string;
  description?: string;
  platforms?: string[];
}): Promise<NamespaceDTO> {
  const { data } = await api.post("/namespaces", payload);
  return data;
}

// ---- Import / Export ----

export async function importJSON(
  payload: ImportRequest,
): Promise<ImportPreview> {
  const { data } = await api.post("/import/json", payload);
  return data;
}

export async function importCSV(
  payload: ImportRequest,
): Promise<ImportPreview> {
  const { data } = await api.post("/import/csv", payload);
  return data;
}

export async function exportJSON(params: ExportOptions): Promise<Blob> {
  const { data } = await api.post("/export/json", params, {
    responseType: "blob",
  });
  return data;
}

export async function exportCSV(params: ExportOptions): Promise<Blob> {
  const { data } = await api.post("/export/csv", params, {
    responseType: "blob",
  });
  return data;
}

// ---- Change Requests ----

export async function getChangeRequests(): Promise<ChangeRequestDTO[]> {
  const { data } = await api.get("/change-requests");
  return data.data ?? data;
}

export async function getChangeRequest(
  id: string,
): Promise<ChangeRequestDTO> {
  const { data } = await api.get(`/change-requests/${id}`);
  return data.data ?? data;
}

export async function createChangeRequest(payload: {
  title: string;
  items: { keyId: string; locale: string; newValue: string; comment?: string }[];
  reviewerIds: string[];
}): Promise<ChangeRequestDTO> {
  const { data } = await api.post("/change-requests", payload);
  return data;
}

export async function reviewChangeRequest(
  id: string,
  payload: { action: "approve" | "request-changes" | "reject"; comment?: string },
): Promise<ChangeRequestDTO> {
  const { data } = await api.put(`/change-requests/${id}/review`, payload);
  return data.data ?? data;
}

export async function publishChangeRequest(
  id: string,
): Promise<void> {
  await api.put(`/change-requests/${id}/publish`);
}

// ---- Coverage ----

export async function getCoverage(): Promise<CoverageStats[]> {
  const { data } = await api.get("/coverage");
  return data.namespaces ?? data.data ?? data;
}

export async function getMissingKeys(): Promise<any[]> {
  const { data } = await api.get("/coverage/missing");
  return data.data ?? data;
}

export default api;
