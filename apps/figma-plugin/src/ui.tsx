// Hato TMS — Figma Plugin UI
// Plain HTML/JS approach rendered into the iframe

import { configure, isConfigured, searchKeys, getKey, createKey, getAllKeys, getNamespaces } from "./api";
import type { TranslationKeyDTO, CreateKeyRequest, NamespaceDTO, Locale } from "@hato-tms/shared";

// ---- Types ----

type ViewState =
  | "not-authenticated"
  | "search"
  | "results"
  | "linked-layer"
  | "create-key"
  | "multi-match"
  | "offline";

interface SelectionData {
  id: string;
  name: string;
  type: string;
  isText: boolean;
  text?: string;
  linked?: boolean;
  keyId?: string | null;
  keyName?: string | null;
  locale?: string;
  multiple?: boolean;
  count?: number;
}

interface TextLayerData {
  id: string;
  name: string;
  text: string;
  linked: boolean;
  keyId: string | null;
  keyName: string | null;
}

interface MatchedLayer {
  layer: TextLayerData;
  matchedKey: TranslationKeyDTO | null;
  matchLocale: string; // which locale matched ("th" or "en")
}

// ---- State ----

let currentView: ViewState = "not-authenticated";
let multiMatchResults: MatchedLayer[] = [];
let selection: SelectionData | null = null;
let searchResults: TranslationKeyDTO[] = [];
let linkedKeyData: TranslationKeyDTO | null = null;
let currentLocale: Locale = "th" as Locale;
let cachedTranslations: Record<string, Record<string, string>> = {};
let isOnline = true;
let allKeys: TranslationKeyDTO[] = [];
let isLoadingKeys = false;
let namespaces: NamespaceDTO[] = [];
let allPlatforms: string[] = [];
let filterNamespace = "";   // "" = all
let filterPlatform = "";    // "" = all

async function loadNamespaces(): Promise<void> {
  try {
    namespaces = await getNamespaces();
    // Extract unique platforms from all namespaces
    const platformSet = new Set<string>();
    for (const ns of namespaces) {
      for (const p of ns.platforms ?? []) {
        platformSet.add(p);
      }
    }
    allPlatforms = Array.from(platformSet).sort();
  } catch (err) {
    console.warn("Failed to load namespaces:", err);
  }
}

async function loadAllKeys(): Promise<void> {
  if (isLoadingKeys) return;
  isLoadingKeys = true;
  render();
  try {
    // Load namespaces in parallel on first load
    if (namespaces.length === 0) {
      await loadNamespaces();
    }
    allKeys = await getAllKeys(
      100,
      filterNamespace || undefined,
      filterPlatform || undefined
    );
    // Cache all translations
    for (const key of allKeys) {
      cacheKeyTranslations(key);
    }
    isLoadingKeys = false;
    render();
  } catch (err) {
    console.warn("Failed to load keys:", err);
    isLoadingKeys = false;
    isOnline = false;
    currentView = "offline";
    render();
  }
}

// ---- Init ----

function init(): void {
  try {
    // Check for stored credentials
    const storedUrl = localStorage.getItem("hato-tms-api-url");
    const storedToken = localStorage.getItem("hato-tms-token");

    if (storedUrl && storedToken) {
      configure(storedUrl, storedToken);
      currentView = "search";
      // Auto-load all keys from the server
      loadAllKeys();
    }
  } catch (e) {
    // localStorage may not be available in Figma sandbox
    console.warn("localStorage not available:", e);
    currentView = "not-authenticated";
  }

  render();

  // Request initial selection
  try {
    parent.postMessage({ pluginMessage: { type: "get-selection" } }, "*");
  } catch (e) {
    console.warn("postMessage failed:", e);
  }
}

// ---- Message handler from plugin code ----

window.onmessage = async (event: MessageEvent) => {
  const msg = event.data?.pluginMessage;
  if (!msg) return;

  switch (msg.type) {
    case "selection":
      selection = msg.data;
      if (selection?.multiple && selection.textLayers && selection.textLayers.length > 0 && isConfigured()) {
        // Multi-text selection: auto-match with TMS keys
        matchMultipleLayers(selection.textLayers as TextLayerData[]);
        currentView = "multi-match";
        render();
      } else if (selection?.linked && selection.keyId && isConfigured()) {
        try {
          linkedKeyData = await getKey(selection.keyId);
          cacheKeyTranslations(linkedKeyData);
          currentView = "linked-layer";
        } catch {
          currentView = "search";
        }
        render();
      } else if (isConfigured()) {
        linkedKeyData = null;
        currentView = "search";
        render();
      } else {
        render();
      }
      break;
  }
};

function matchMultipleLayers(layers: TextLayerData[]): void {
  multiMatchResults = layers.map((layer) => {
    // If already linked, find the key
    if (layer.linked && layer.keyId) {
      const existing = allKeys.find((k) => k.id === layer.keyId);
      return { layer, matchedKey: existing || null, matchLocale: currentLocale as string };
    }

    // Try to match text content against TMS values (TH and EN)
    const text = layer.text.trim();
    if (!text) return { layer, matchedKey: null, matchLocale: "" };

    for (const key of allKeys) {
      for (const v of key.values) {
        if (v.value.trim() === text) {
          return { layer, matchedKey: key, matchLocale: v.locale.toLowerCase() };
        }
      }
    }

    return { layer, matchedKey: null, matchLocale: "" };
  });
}

function cacheKeyTranslations(key: TranslationKeyDTO): void {
  const values: Record<string, string> = {};
  for (const v of key.values) {
    // Store both lowercase and uppercase for compatibility
    values[v.locale.toLowerCase()] = v.value;
    values[v.locale.toUpperCase()] = v.value;
  }
  cachedTranslations[key.id] = values;
}

// ---- Render ----

function render(): void {
  const app = document.getElementById("app");
  if (!app) return;

  switch (currentView) {
    case "not-authenticated":
      app.innerHTML = renderAuth();
      bindAuthEvents();
      break;
    case "search":
      app.innerHTML = renderSearch();
      bindSearchEvents();
      break;
    case "results":
      app.innerHTML = renderResults();
      bindResultsEvents();
      break;
    case "linked-layer":
      app.innerHTML = renderLinkedLayer();
      bindLinkedLayerEvents();
      break;
    case "create-key":
      app.innerHTML = renderCreateKey();
      bindCreateKeyEvents();
      break;
    case "multi-match":
      app.innerHTML = renderMultiMatch();
      bindMultiMatchEvents();
      break;
    case "offline":
      app.innerHTML = renderOffline();
      bindOfflineEvents();
      break;
  }
}

// ---- Views ----

function renderAuth(): string {
  return `
    <div style="padding: 16px;">
      <h2 style="font-size: 14px; font-weight: 600; margin-bottom: 16px; color: #333;">
        Hato TMS
      </h2>
      <p style="color: #666; margin-bottom: 16px; font-size: 11px;">
        Connect to your Hato TMS server to manage translations.
      </p>
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 11px; font-weight: 500; color: #555; margin-bottom: 4px;">API URL</label>
        <input id="auth-url" type="text" value="http://localhost:4000"
          style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; outline: none;"
          placeholder="http://localhost:4000" />
      </div>
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 11px; font-weight: 500; color: #555; margin-bottom: 4px;">API Token</label>
        <input id="auth-token" type="password"
          style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; outline: none;"
          placeholder="Paste your API token" />
      </div>
      <button id="auth-submit"
        style="width: 100%; padding: 8px; background: #18A0FB; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;">
        Connect
      </button>
      <div id="auth-error" style="color: #E53935; font-size: 11px; margin-top: 8px; display: none;"></div>
    </div>
  `;
}

function renderSearch(): string {
  const selectionInfo = getSelectionInfo();
  return `
    <div style="padding: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="font-size: 13px; font-weight: 600; color: #333;">Hato TMS</h2>
        <div style="display: flex; gap: 4px;">
          <button id="btn-sync-all" title="Sync all"
            style="padding: 4px 8px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; cursor: pointer;">
            Sync
          </button>
          <button id="btn-switch-lang" title="Switch language"
            style="padding: 4px 8px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; cursor: pointer; font-weight: 600;">
            ${currentLocale.toUpperCase()}
          </button>
          <button id="btn-highlight" title="Highlight unlinked"
            style="padding: 4px 8px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; cursor: pointer;">
            Unlinked
          </button>
        </div>
      </div>

      ${selectionInfo}

      <div style="margin-bottom: 12px;">
        <input id="search-input" type="text"
          style="width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 11px; outline: none;"
          placeholder="Search translation keys…" />
      </div>

      <div style="display: flex; gap: 6px; margin-bottom: 10px;">
        <select id="filter-namespace"
          style="flex: 1; padding: 5px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; color: #555; background: white; outline: none; cursor: pointer;">
          <option value="">All namespaces</option>
          ${namespaces.map((ns) => `
            <option value="${escapeAttr(ns.path)}" ${filterNamespace === ns.path ? "selected" : ""}>
              ${ns.path}${ns.keyCount != null ? ` (${ns.keyCount})` : ""}
            </option>
          `).join("")}
        </select>
        <select id="filter-platform"
          style="flex: 1; padding: 5px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; color: #555; background: white; outline: none; cursor: pointer;">
          <option value="">All platforms</option>
          ${allPlatforms.map((p) => `
            <option value="${escapeAttr(p)}" ${filterPlatform === p ? "selected" : ""}>
              ${p}
            </option>
          `).join("")}
        </select>
      </div>

      <button id="btn-create-key"
        style="width: 100%; padding: 6px; background: none; border: 1px dashed #ccc; border-radius: 6px; font-size: 11px; color: #666; cursor: pointer;">
        + Create new key
      </button>

      <div id="search-results" style="margin-top: 8px;"></div>

      ${isLoadingKeys ? `
        <div style="text-align: center; padding: 16px; color: #999; font-size: 11px;">
          Loading translations…
        </div>
      ` : allKeys.length > 0 ? `
        <div style="margin-top: 12px;">
          <div style="font-size: 10px; color: #888; margin-bottom: 6px; font-weight: 500;">
            ${allKeys.length} TRANSLATIONS${filterNamespace ? ` in ${filterNamespace}` : ""}${filterPlatform ? ` · ${filterPlatform}` : ""}
          </div>
          <div style="max-height: 220px; overflow-y: auto;">
            ${allKeys.map((key) => `
              <div class="browse-item" data-key-id="${key.id}"
                style="padding: 8px; border: 1px solid #eee; border-radius: 6px; margin-bottom: 4px; cursor: pointer; transition: background 0.1s;"
                onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="font-size: 11px; font-weight: 500; color: #333;">${key.fullKey}</div>
                  ${key.platforms?.length ? `<div style="font-size: 9px; color: #aaa;">${key.platforms.join(", ")}</div>` : ""}
                </div>
                <div style="font-size: 10px; color: #888; margin-top: 2px;">TH: ${truncate(getLocaleValue(key, "th"), 35)}</div>
                <div style="font-size: 10px; color: #888;">EN: ${truncate(getLocaleValue(key, "en"), 35)}</div>
              </div>
            `).join("")}
          </div>
        </div>
      ` : !isLoadingKeys ? `
        <div style="text-align: center; padding: 20px; color: #999; font-size: 11px;">
          No translations found${filterNamespace || filterPlatform ? " for this filter" : ""}
        </div>
      ` : ""}
    </div>
  `;
}

function renderResults(): string {
  const items = searchResults
    .map(
      (key) => `
      <div class="result-item" data-key-id="${key.id}" data-key-name="${key.fullKey}"
        data-th-value="${escapeAttr(getLocaleValue(key, "th"))}"
        data-en-value="${escapeAttr(getLocaleValue(key, "en"))}"
        style="padding: 8px; border: 1px solid #eee; border-radius: 6px; margin-bottom: 6px; cursor: pointer; transition: background 0.1s;"
        onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
        <div style="font-size: 11px; font-weight: 500; color: #333; margin-bottom: 2px;">${key.fullKey}</div>
        <div style="font-size: 10px; color: #888;">TH: ${truncate(getLocaleValue(key, "th"), 40)}</div>
        <div style="font-size: 10px; color: #888;">EN: ${truncate(getLocaleValue(key, "en"), 40)}</div>
        ${selection?.isText ? `<button class="btn-link" data-key-id="${key.id}" data-key-name="${key.fullKey}"
          style="margin-top: 4px; padding: 3px 10px; background: #18A0FB; color: white; border: none; border-radius: 4px; font-size: 10px; cursor: pointer;">
          Link
        </button>` : ""}
      </div>
    `
    )
    .join("");

  return `
    <div style="padding: 12px;">
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <button id="btn-back"
          style="padding: 4px 8px; background: none; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; cursor: pointer; margin-right: 8px;">
          Back
        </button>
        <span style="font-size: 11px; color: #666;">${searchResults.length} results</span>
      </div>
      <div>${items || '<p style="color: #999; font-size: 11px; text-align: center; padding: 20px;">No results found</p>'}</div>
    </div>
  `;
}

function renderLinkedLayer(): string {
  if (!linkedKeyData || !selection) return "";

  const thValue = getLocaleValue(linkedKeyData, "th");
  const enValue = getLocaleValue(linkedKeyData, "en");

  return `
    <div style="padding: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <button id="btn-back-search"
          style="padding: 4px 8px; background: none; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; cursor: pointer;">
          Back
        </button>
        <button id="btn-switch-lang-linked" title="Switch language"
          style="padding: 4px 8px; background: #18A0FB; color: white; border: none; border-radius: 4px; font-size: 10px; cursor: pointer; font-weight: 600;">
          ${currentLocale.toUpperCase()}
        </button>
      </div>

      <div style="padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 12px;">
        <div style="font-size: 10px; color: #888; margin-bottom: 2px;">LINKED KEY</div>
        <div style="font-size: 12px; font-weight: 600; color: #333; margin-bottom: 8px;">${linkedKeyData.fullKey}</div>

        <div style="font-size: 10px; color: #888; margin-bottom: 2px;">Layer: ${selection.name}</div>

        <div style="margin-top: 10px;">
          <div style="font-size: 10px; font-weight: 500; color: #555; margin-bottom: 2px;">TH</div>
          <div style="font-size: 11px; color: #333; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #eee; margin-bottom: 6px;">${thValue || '<span style="color: #ccc;">—</span>'}</div>
        </div>

        <div>
          <div style="font-size: 10px; font-weight: 500; color: #555; margin-bottom: 2px;">EN</div>
          <div style="font-size: 11px; color: #333; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #eee;">${enValue || '<span style="color: #ccc;">—</span>'}</div>
        </div>
      </div>

      <div style="display: flex; gap: 6px;">
        <button id="btn-unlink"
          style="flex: 1; padding: 6px; background: none; border: 1px solid #E53935; border-radius: 6px; font-size: 11px; color: #E53935; cursor: pointer;">
          Unlink
        </button>
        <button id="btn-refresh-linked"
          style="flex: 1; padding: 6px; background: #18A0FB; color: white; border: none; border-radius: 6px; font-size: 11px; cursor: pointer;">
          Refresh
        </button>
      </div>

      <div style="margin-top: 8px; font-size: 10px; color: #aaa;">
        Status: ${linkedKeyData.status} | Tags: ${linkedKeyData.tags.join(", ") || "none"}
      </div>
    </div>
  `;
}

function renderCreateKey(): string {
  return `
    <div style="padding: 12px;">
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <button id="btn-back-create"
          style="padding: 4px 8px; background: none; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; cursor: pointer; margin-right: 8px;">
          Back
        </button>
        <h3 style="font-size: 12px; font-weight: 600; color: #333;">Create Key</h3>
      </div>

      <div style="margin-bottom: 10px;">
        <label style="display: block; font-size: 10px; font-weight: 500; color: #555; margin-bottom: 3px;">Namespace</label>
        <input id="create-namespace" type="text"
          style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; outline: none;"
          placeholder="e.g. common" />
      </div>

      <div style="margin-bottom: 10px;">
        <label style="display: block; font-size: 10px; font-weight: 500; color: #555; margin-bottom: 3px;">Key Name</label>
        <input id="create-keyname" type="text"
          style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; outline: none;"
          placeholder="e.g. welcomeTitle" />
      </div>

      <div style="margin-bottom: 10px;">
        <label style="display: block; font-size: 10px; font-weight: 500; color: #555; margin-bottom: 3px;">Thai Value</label>
        <input id="create-th" type="text"
          style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; outline: none;"
          value="${escapeAttr(selection?.text || "")}" />
      </div>

      <div style="margin-bottom: 10px;">
        <label style="display: block; font-size: 10px; font-weight: 500; color: #555; margin-bottom: 3px;">English Value</label>
        <input id="create-en" type="text"
          style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; outline: none;" />
      </div>

      <div style="margin-bottom: 10px;">
        <label style="display: block; font-size: 10px; font-weight: 500; color: #555; margin-bottom: 3px;">Description (optional)</label>
        <input id="create-desc" type="text"
          style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; outline: none;"
          placeholder="What is this text used for?" />
      </div>

      <button id="btn-create-submit"
        style="width: 100%; padding: 8px; background: #18A0FB; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;">
        Create & Link
      </button>

      <div id="create-error" style="color: #E53935; font-size: 11px; margin-top: 8px; display: none;"></div>
    </div>
  `;
}

function renderMultiMatch(): string {
  const matched = multiMatchResults.filter((m) => m.matchedKey);
  const unmatched = multiMatchResults.filter((m) => !m.matchedKey);

  return `
    <div style="padding: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="font-size: 13px; font-weight: 600; color: #333;">Bulk Sync</h2>
        <button id="btn-back-multi"
          style="padding: 4px 8px; background: none; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; cursor: pointer;">
          Back
        </button>
      </div>

      <div style="padding: 8px; background: #E8F5E9; border-radius: 6px; margin-bottom: 10px; font-size: 11px; color: #2E7D32;">
        ${matched.length} of ${multiMatchResults.length} text layers matched with TMS
      </div>

      ${matched.length > 0 ? `
        <button id="btn-bulk-sync"
          style="width: 100%; padding: 8px; background: #18A0FB; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; margin-bottom: 12px;">
          Sync ${matched.length} layers & rename to keys
        </button>
      ` : ""}

      <div style="max-height: 280px; overflow-y: auto;">
        ${matched.map((m, i) => `
          <div class="match-item" data-index="${i}"
            style="padding: 8px; border: 1px solid #C8E6C9; background: #F1F8E9; border-radius: 6px; margin-bottom: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 10px; color: #888; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                title="${escapeAttr(m.layer.name)}">
                ${m.layer.name}
              </div>
              <div style="font-size: 9px; color: #4CAF50; font-weight: 500;">MATCHED</div>
            </div>
            <div style="font-size: 10px; color: #555; margin: 3px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
              title="${escapeAttr(m.layer.text)}">
              "${truncate(m.layer.text, 30)}"
            </div>
            <div style="font-size: 11px; font-weight: 500; color: #1B5E20;">
              → ${m.matchedKey!.fullKey}
            </div>
          </div>
        `).join("")}

        ${unmatched.length > 0 ? `
          <div style="font-size: 10px; color: #999; margin: 8px 0 4px; font-weight: 500;">
            ${unmatched.length} UNMATCHED
          </div>
          ${unmatched.map((m) => `
            <div style="padding: 8px; border: 1px solid #eee; background: #FAFAFA; border-radius: 6px; margin-bottom: 4px;">
              <div style="font-size: 10px; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                title="${escapeAttr(m.layer.name)}">
                ${m.layer.name}
              </div>
              <div style="font-size: 10px; color: #999; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                "${truncate(m.layer.text, 35)}"
              </div>
              <div style="font-size: 9px; color: #E65100; margin-top: 2px;">No match in TMS</div>
            </div>
          `).join("")}
        ` : ""}
      </div>
    </div>
  `;
}

function bindMultiMatchEvents(): void {
  document.getElementById("btn-back-multi")?.addEventListener("click", () => {
    currentView = "search";
    render();
  });

  document.getElementById("btn-bulk-sync")?.addEventListener("click", () => {
    const matched = multiMatchResults.filter((m) => m.matchedKey);
    if (matched.length === 0) return;

    const items = matched.map((m) => {
      const key = m.matchedKey!;
      cacheKeyTranslations(key);

      // Use current locale for the text value
      const value = getLocaleValue(key, currentLocale as string)
        || getLocaleValue(key, (currentLocale as string).toUpperCase())
        || getLocaleValue(key, m.matchLocale)
        || m.layer.text;

      return {
        nodeId: m.layer.id,
        keyId: key.id,
        keyName: key.fullKey,
        value,
        locale: currentLocale as string,
      };
    });

    parent.postMessage(
      { pluginMessage: { type: "bulk-sync", items } },
      "*"
    );
  });
}

function renderOffline(): string {
  return `
    <div style="padding: 16px; text-align: center;">
      <div style="background: #FFF3E0; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <div style="font-size: 12px; font-weight: 600; color: #E65100; margin-bottom: 4px;">Offline</div>
        <div style="font-size: 11px; color: #BF360C;">
          Cannot reach the TMS server. Cached data may be available.
        </div>
      </div>
      <div style="font-size: 10px; color: #999; margin-bottom: 12px;">
        ${Object.keys(cachedTranslations).length} keys cached locally
      </div>
      <button id="btn-retry"
        style="padding: 8px 16px; background: #18A0FB; color: white; border: none; border-radius: 6px; font-size: 11px; cursor: pointer;">
        Retry Connection
      </button>
    </div>
  `;
}

// ---- Event Bindings ----

function bindAuthEvents(): void {
  const btn = document.getElementById("auth-submit");
  btn?.addEventListener("click", () => {
    const url = (document.getElementById("auth-url") as HTMLInputElement).value.trim();
    const token = (document.getElementById("auth-token") as HTMLInputElement).value.trim();
    const errEl = document.getElementById("auth-error")!;

    if (!url || !token) {
      errEl.style.display = "block";
      errEl.textContent = "Please fill in both fields.";
      return;
    }

    configure(url, token);
    try {
      localStorage.setItem("hato-tms-api-url", url);
      localStorage.setItem("hato-tms-token", token);
    } catch (e) {
      // localStorage may not be available
    }

    currentView = "search";
    render();
    parent.postMessage({ pluginMessage: { type: "get-selection" } }, "*");
    // Auto-load all keys after connecting
    loadAllKeys();
  });
}

function bindSearchEvents(): void {
  const input = document.getElementById("search-input") as HTMLInputElement;
  let debounceTimer: ReturnType<typeof setTimeout>;

  input?.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const query = input.value.trim();
      if (query.length < 2) {
        document.getElementById("search-results")!.innerHTML = "";
        return;
      }

      try {
        searchResults = await searchKeys(query);
        currentView = "results";
        render();
      } catch (err) {
        isOnline = false;
        currentView = "offline";
        render();
      }
    }, 300);
  });

  input?.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      clearTimeout(debounceTimer);
      const query = input.value.trim();
      if (query.length >= 1) {
        searchKeys(query)
          .then((results) => {
            searchResults = results;
            currentView = "results";
            render();
          })
          .catch(() => {
            currentView = "offline";
            render();
          });
      }
    }
  });

  document.getElementById("btn-create-key")?.addEventListener("click", () => {
    currentView = "create-key";
    render();
  });

  // Multi-select: Match & Sync button
  document.getElementById("btn-multi-sync")?.addEventListener("click", () => {
    if (selection?.multiple && (selection as any).textLayers) {
      matchMultipleLayers((selection as any).textLayers as TextLayerData[]);
      currentView = "multi-match";
      render();
    }
  });

  // Filter by namespace
  document.getElementById("filter-namespace")?.addEventListener("change", (e) => {
    filterNamespace = (e.target as HTMLSelectElement).value;
    loadAllKeys();
  });

  // Filter by platform
  document.getElementById("filter-platform")?.addEventListener("change", (e) => {
    filterPlatform = (e.target as HTMLSelectElement).value;
    loadAllKeys();
  });

  document.getElementById("btn-sync-all")?.addEventListener("click", () => {
    parent.postMessage(
      {
        pluginMessage: {
          type: "sync-all",
          translations: cachedTranslations,
          locale: currentLocale,
        },
      },
      "*"
    );
  });

  document.getElementById("btn-switch-lang")?.addEventListener("click", () => {
    currentLocale = currentLocale === ("th" as Locale) ? ("en" as Locale) : ("th" as Locale);
    parent.postMessage(
      {
        pluginMessage: {
          type: "switch-language",
          locale: currentLocale,
          translations: cachedTranslations,
        },
      },
      "*"
    );
    render();
  });

  document.getElementById("btn-highlight")?.addEventListener("click", () => {
    parent.postMessage(
      { pluginMessage: { type: "highlight-unlinked" } },
      "*"
    );
  });

  // Click on browse items to view key details
  document.querySelectorAll(".browse-item").forEach((item) => {
    item.addEventListener("click", async () => {
      const el = item as HTMLElement;
      const keyId = el.dataset.keyId!;
      try {
        linkedKeyData = await getKey(keyId);
        cacheKeyTranslations(linkedKeyData);
        currentView = "linked-layer";
        render();
      } catch {
        // ignore
      }
    });
  });
}

function bindResultsEvents(): void {
  document.getElementById("btn-back")?.addEventListener("click", () => {
    currentView = "search";
    render();
  });

  // Link buttons
  document.querySelectorAll(".btn-link").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const el = btn as HTMLElement;
      const keyId = el.dataset.keyId!;
      const keyName = el.dataset.keyName!;
      const item = el.closest(".result-item") as HTMLElement;
      const value =
        currentLocale === ("th" as Locale)
          ? item.dataset.thValue
          : item.dataset.enValue;

      // Cache translations for this key
      cachedTranslations[keyId] = {
        th: item.dataset.thValue || "",
        TH: item.dataset.thValue || "",
        en: item.dataset.enValue || "",
        EN: item.dataset.enValue || "",
      };

      parent.postMessage(
        {
          pluginMessage: {
            type: "link-key",
            keyId,
            keyName,
            value: value || "",
            locale: currentLocale,
          },
        },
        "*"
      );
    });
  });

  // Click on result item to view details
  document.querySelectorAll(".result-item").forEach((item) => {
    item.addEventListener("click", async (e) => {
      if ((e.target as HTMLElement).classList.contains("btn-link")) return;
      const el = item as HTMLElement;
      const keyId = el.dataset.keyId!;
      try {
        linkedKeyData = await getKey(keyId);
        cacheKeyTranslations(linkedKeyData);
        currentView = "linked-layer";
        render();
      } catch {
        // ignore
      }
    });
  });
}

function bindLinkedLayerEvents(): void {
  document.getElementById("btn-back-search")?.addEventListener("click", () => {
    currentView = "search";
    render();
  });

  document.getElementById("btn-unlink")?.addEventListener("click", () => {
    if (selection?.isText) {
      // Clear plugin data by linking with empty values
      parent.postMessage(
        {
          pluginMessage: {
            type: "link-key",
            keyId: "",
            keyName: "",
            value: selection.text || "",
            locale: currentLocale,
          },
        },
        "*"
      );
      linkedKeyData = null;
      currentView = "search";
      render();
    }
  });

  document.getElementById("btn-refresh-linked")?.addEventListener("click", async () => {
    if (linkedKeyData) {
      try {
        linkedKeyData = await getKey(linkedKeyData.id);
        cacheKeyTranslations(linkedKeyData);

        const value = getLocaleValue(linkedKeyData, currentLocale);
        parent.postMessage(
          {
            pluginMessage: {
              type: "link-key",
              keyId: linkedKeyData.id,
              keyName: linkedKeyData.fullKey,
              value,
              locale: currentLocale,
            },
          },
          "*"
        );
        render();
        parent.postMessage(
          { pluginMessage: { type: "notify", message: "Refreshed!" } },
          "*"
        );
      } catch {
        currentView = "offline";
        render();
      }
    }
  });

  document.getElementById("btn-switch-lang-linked")?.addEventListener("click", () => {
    currentLocale = currentLocale === ("th" as Locale) ? ("en" as Locale) : ("th" as Locale);

    if (linkedKeyData && selection?.isText) {
      const value = getLocaleValue(linkedKeyData, currentLocale);
      parent.postMessage(
        {
          pluginMessage: {
            type: "link-key",
            keyId: linkedKeyData.id,
            keyName: linkedKeyData.fullKey,
            value,
            locale: currentLocale,
          },
        },
        "*"
      );
    }

    render();
  });
}

function bindCreateKeyEvents(): void {
  document.getElementById("btn-back-create")?.addEventListener("click", () => {
    currentView = "search";
    render();
  });

  document.getElementById("btn-create-submit")?.addEventListener("click", async () => {
    const namespace = (document.getElementById("create-namespace") as HTMLInputElement).value.trim();
    const keyName = (document.getElementById("create-keyname") as HTMLInputElement).value.trim();
    const thValue = (document.getElementById("create-th") as HTMLInputElement).value.trim();
    const enValue = (document.getElementById("create-en") as HTMLInputElement).value.trim();
    const desc = (document.getElementById("create-desc") as HTMLInputElement).value.trim();
    const errEl = document.getElementById("create-error")!;

    if (!namespace || !keyName || !thValue || !enValue) {
      errEl.style.display = "block";
      errEl.textContent = "Namespace, key name, and both values are required.";
      return;
    }

    const req: CreateKeyRequest = {
      namespacePath: namespace,
      keyName,
      thValue,
      enValue,
      description: desc || undefined,
    };

    try {
      const newKey = await createKey(req);
      cacheKeyTranslations(newKey);

      // Link to selected text if available
      if (selection?.isText) {
        const value = currentLocale === ("th" as Locale) ? thValue : enValue;
        parent.postMessage(
          {
            pluginMessage: {
              type: "create-key",
              keyId: newKey.id,
              keyName: newKey.fullKey,
              value,
              locale: currentLocale,
            },
          },
          "*"
        );
      }

      parent.postMessage(
        { pluginMessage: { type: "notify", message: `Created ${newKey.fullKey}` } },
        "*"
      );

      linkedKeyData = newKey;
      currentView = selection?.isText ? "linked-layer" : "search";
      render();
    } catch (err: any) {
      errEl.style.display = "block";
      errEl.textContent = err?.message || "Failed to create key.";
    }
  });
}

function bindOfflineEvents(): void {
  document.getElementById("btn-retry")?.addEventListener("click", () => {
    isOnline = true;
    currentView = isConfigured() ? "search" : "not-authenticated";
    render();
  });
}

// ---- Helpers ----

function getSelectionInfo(): string {
  if (!selection) {
    return `<div style="padding: 8px; background: #f5f5f5; border-radius: 6px; margin-bottom: 12px; font-size: 11px; color: #888;">
      Select a text layer to link translations.
    </div>`;
  }

  if (selection.multiple) {
    const textCount = (selection as any).textCount ?? 0;
    if (textCount > 0) {
      return `<div style="padding: 8px; background: #E3F2FD; border-radius: 6px; margin-bottom: 12px; font-size: 11px; color: #1565C0;">
        ${textCount} text layers selected
        <button id="btn-multi-sync" style="margin-left: 8px; padding: 3px 10px; background: #18A0FB; color: white; border: none; border-radius: 4px; font-size: 10px; cursor: pointer; font-weight: 500;">
          Match & Sync
        </button>
      </div>`;
    }
    return `<div style="padding: 8px; background: #FFF3E0; border-radius: 6px; margin-bottom: 12px; font-size: 11px; color: #E65100;">
      ${selection.count} layers selected — no text layers found.
    </div>`;
  }

  if (!selection.isText) {
    return `<div style="padding: 8px; background: #f5f5f5; border-radius: 6px; margin-bottom: 12px; font-size: 11px; color: #888;">
      Selected: ${selection.name} (${selection.type}) — not a text layer
    </div>`;
  }

  return `<div style="padding: 8px; background: #E3F2FD; border-radius: 6px; margin-bottom: 12px;">
    <div style="font-size: 10px; color: #1565C0; font-weight: 500;">${selection.name}</div>
    <div style="font-size: 11px; color: #333; margin-top: 2px;">${truncate(selection.text || "", 60)}</div>
    ${selection.linked ? `<div style="font-size: 10px; color: #2E7D32; margin-top: 4px;">Linked: ${selection.keyName}</div>` : ""}
  </div>`;
}

function getLocaleValue(key: TranslationKeyDTO, locale: string): string {
  const normalizedLocale = locale.toUpperCase();
  const v = key.values.find((val) => val.locale.toUpperCase() === normalizedLocale);
  return v?.value || "";
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.substring(0, max) + "...";
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---- Start ----

init();
