import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { Locale, TMS_UI_TRANSLATIONS } from "@hato-tms/shared";
import React from "react";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: Locale.EN,
  setLocale: () => {},
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(
    () => (localStorage.getItem("hato_locale") as Locale) || Locale.EN,
  );

  const handleSetLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem("hato_locale", newLocale);
  }, []);

  return React.createElement(
    LocaleContext.Provider,
    { value: { locale, setLocale: handleSetLocale } },
    children,
  );
}

export function useTranslation() {
  const { locale, setLocale } = useContext(LocaleContext);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const entry = TMS_UI_TRANSLATIONS[key];
      if (!entry) return key;

      let text = locale === Locale.TH ? entry.th : entry.en;

      if (params) {
        for (const [param, value] of Object.entries(params)) {
          text = text.replace(`{${param}}`, String(value));
        }
      }

      return text;
    },
    [locale],
  );

  return { t, locale, setLocale };
}
