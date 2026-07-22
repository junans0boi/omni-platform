"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/I18nProvider";

export default function Home() {
  const { t } = useI18n();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          window.location.href = "/dashboard";
        } else {
          window.location.href = "/login";
        }
      } catch {
        window.location.href = "/login";
      }
    };

    checkUser();
  }, []);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg text-text">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        <p className="text-sm font-semibold text-muted">{t("landing.loading")}</p>
      </div>
    </div>
  );
}
