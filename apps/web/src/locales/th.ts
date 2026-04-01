import { TMS_UI_TRANSLATIONS } from "@hato-tms/shared";

const th: Record<string, string> = {};

for (const [key, value] of Object.entries(TMS_UI_TRANSLATIONS)) {
  th[key] = value.th;
}

export default th;
