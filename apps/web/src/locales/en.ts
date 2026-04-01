import { TMS_UI_TRANSLATIONS } from "@hato-tms/shared";

const en: Record<string, string> = {};

for (const [key, value] of Object.entries(TMS_UI_TRANSLATIONS)) {
  en[key] = value.en;
}

export default en;
