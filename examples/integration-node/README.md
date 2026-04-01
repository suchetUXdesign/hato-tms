# Hato TMS — Node.js / Express Integration Example

This guide shows how to integrate Hato TMS translations into a Node.js backend,
useful for server-rendered pages, email templates, or API response messages.

## Setup

### 1. Install the CLI

```bash
npm install hato-tms -D
```

### 2. Initialize config

```bash
npx hato-tms init
```

Create `.hato-tms.json`:

```json
{
  "apiUrl": "https://tms.hato.app",
  "token": "",
  "namespaces": ["common", "errors", "emails"],
  "outputDir": "locales",
  "format": "nested",
  "perNamespace": false
}
```

> Tip: Leave `token` empty and use the `HATO_TMS_API_TOKEN` environment variable.

### 3. Pull translations

```bash
npx hato-tms sync
```

This writes:
- `locales/th.json`
- `locales/en.json`

### 4. Add to package.json scripts

```json
{
  "scripts": {
    "sync:i18n": "hato-tms sync",
    "prestart": "npm run sync:i18n",
    "start": "node dist/index.js",
    "prebuild": "npm run sync:i18n",
    "build": "tsc"
  }
}
```

## Usage with i18next (Node.js)

### Install dependencies

```bash
npm install i18next i18next-fs-backend
```

### Configure i18n (`src/i18n.ts`)

```typescript
import i18next from "i18next";
import Backend from "i18next-fs-backend";
import path from "path";

await i18next.use(Backend).init({
  lng: "th",
  fallbackLng: "en",
  preload: ["th", "en"],
  backend: {
    loadPath: path.join(__dirname, "../locales/{{lng}}.json"),
  },
});

export default i18next;
```

### Use in Express routes

```typescript
import express from "express";
import i18n from "./i18n";

const app = express();

// Middleware to detect locale from header or query
app.use((req, res, next) => {
  const lang = (req.query.lang as string) || req.headers["accept-language"]?.split(",")[0] || "th";
  req.language = lang.toLowerCase().startsWith("en") ? "en" : "th";
  next();
});

app.get("/api/greeting", (req, res) => {
  const t = i18n.getFixedT(req.language);
  res.json({
    message: t("common.welcome"),
    errors: {
      notFound: t("errors.notFound"),
    },
  });
});

app.listen(3000);
```

### Use in email templates

```typescript
import i18n from "./i18n";

async function sendWelcomeEmail(userEmail: string, locale: string) {
  const t = i18n.getFixedT(locale);

  const subject = t("emails.welcome.subject");
  const body = t("emails.welcome.body", { name: "User" });

  await sendEmail({
    to: userEmail,
    subject,
    html: body,
  });
}
```

## Simple approach (without i18next)

For simpler use cases, load the JSON files directly:

```typescript
import thTranslations from "../locales/th.json";
import enTranslations from "../locales/en.json";

const translations: Record<string, Record<string, any>> = {
  th: thTranslations,
  en: enTranslations,
};

function t(key: string, locale: string = "th"): string {
  const parts = key.split(".");
  let value: any = translations[locale];
  for (const part of parts) {
    value = value?.[part];
  }
  return typeof value === "string" ? value : key;
}

// Usage
console.log(t("common.welcome", "th")); // สวัสดี
console.log(t("common.welcome", "en")); // Welcome
```

## Per-namespace mode

Set `perNamespace: true` in `.hato-tms.json` to get:

```
locales/
  common/th.json
  common/en.json
  errors/th.json
  errors/en.json
  emails/th.json
  emails/en.json
```

Then load per namespace:

```typescript
import commonTh from "../locales/common/th.json";
import commonEn from "../locales/common/en.json";
import errorsTh from "../locales/errors/th.json";
import errorsEn from "../locales/errors/en.json";

const resources = {
  th: { common: commonTh, errors: errorsTh },
  en: { common: commonEn, errors: errorsEn },
};
```

## CI/CD with GitHub Actions

See the main Hato TMS repository for the reusable `sync-translations.yml`
GitHub Action workflow. It runs daily (or on manual trigger) and creates a PR
when translations change.

Required secrets:
- `HATO_TMS_API_URL` — e.g. `https://tms.hato.app`
- `HATO_TMS_API_TOKEN` — API bearer token
