"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { formatMessage, type MessageKey } from "./catalogs";
import type { Locale } from "./locale";

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;
const I18nContext = createContext<{ locale: Locale; t: Translate } | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(
    () => ({ locale, t: (key: MessageKey, values?: Record<string, string | number>) => formatMessage(locale, key, values) }),
    [locale]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used within I18nProvider");
  return value;
}
