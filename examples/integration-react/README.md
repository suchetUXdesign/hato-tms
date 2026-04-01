# Hato TMS — React Integration Example

This guide shows how to integrate Hato TMS translations into a React project
using react-i18next.

## Setup

### 1. Install the CLI

```bash
npm install hato-tms -D
```

### 2. Initialize config

```bash
npx hato-tms init
```

This creates a `.hato-tms.json` file in your project root:

```json
{
  "apiUrl": "https://tms.hato.app",
  "token": "",
  "namespaces": ["common", "dashboard"],
  "outputDir": "src/locales",
  "format": "nested",
  "perNamespace": false
}
```

> Tip: Leave `token` empty and set the `HATO_TMS_API_TOKEN` environment variable
> instead, so you don't commit secrets to version control.

### 3. Pull translations

```bash
npx hato-tms sync
```

This writes:
- `src/locales/th.json`
- `src/locales/en.json`

### 4. Add to package.json scripts

```json
{
  "scripts": {
    "sync:i18n": "hato-tms sync",
    "predev": "npm run sync:i18n",
    "dev": "vite",
    "prebuild": "npm run sync:i18n",
    "build": "vite build"
  }
}
```

Translations are synced automatically before every `dev` and `build` run.

## Usage with react-i18next

### Install dependencies

```bash
npm install i18next react-i18next
```

### Configure i18n (`src/i18n.ts`)

```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import th from "./locales/th.json";
import en from "./locales/en.json";

i18n.use(initReactI18next).init({
  resources: {
    th: { translation: th },
    en: { translation: en },
  },
  lng: "th", // default language
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React already escapes
  },
});

export default i18n;
```

### Use in components

```tsx
import { useTranslation } from "react-i18next";

function Dashboard() {
  const { t, i18n } = useTranslation();

  return (
    <div>
      <h1>{t("dashboard.title")}</h1>
      <p>{t("common.welcome")}</p>
      <button onClick={() => i18n.changeLanguage("en")}>
        English
      </button>
      <button onClick={() => i18n.changeLanguage("th")}>
        ภาษาไทย
      </button>
    </div>
  );
}
```

### Initialize in App entry (`src/main.tsx`)

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./i18n"; // Initialize i18n

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## Per-namespace mode

If you have many namespaces and want separate files per namespace, set
`perNamespace: true` in `.hato-tms.json`:

```json
{
  "namespaces": ["common", "dashboard", "errors"],
  "outputDir": "src/locales",
  "perNamespace": true
}
```

This produces:
```
src/locales/
  common/th.json
  common/en.json
  dashboard/th.json
  dashboard/en.json
  errors/th.json
  errors/en.json
```

Then configure i18next with multiple namespaces:

```typescript
import common_th from "./locales/common/th.json";
import common_en from "./locales/common/en.json";
import dashboard_th from "./locales/dashboard/th.json";
import dashboard_en from "./locales/dashboard/en.json";

i18n.use(initReactI18next).init({
  resources: {
    th: { common: common_th, dashboard: dashboard_th },
    en: { common: common_en, dashboard: dashboard_en },
  },
  defaultNS: "common",
  lng: "th",
  fallbackLng: "en",
});
```

## CI/CD with GitHub Actions

Add the sync workflow to your repo. See the main Hato TMS repository for the
reusable `sync-translations.yml` workflow that creates PRs automatically when
translations change.

Required secrets:
- `HATO_TMS_API_URL` — e.g. `https://tms.hato.app`
- `HATO_TMS_API_TOKEN` — API bearer token
