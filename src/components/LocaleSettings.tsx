"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/locale";

export function LocaleSettings() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const changeLocale = async (nextLocale: Locale) => {
    setSaving(true);
    try {
      const response = await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      if (response.ok) router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <label className="flex items-center justify-between gap-4 text-sm">
      <span>{t("settings.locale.label")}</span>
      <select
        aria-label={t("settings.locale.label")}
        value={locale}
        disabled={saving}
        onChange={(event) => void changeLocale(event.target.value as Locale)}
      >
        {SUPPORTED_LOCALES.map((item) => (
          <option key={item} value={item}>{t(`settings.locale.${item}`)}</option>
        ))}
      </select>
    </label>
  );
}
