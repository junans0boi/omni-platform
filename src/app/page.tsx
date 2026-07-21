"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";

export default function Home() {
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          router.replace("/dashboard");
        } else {
          router.replace("/login");
        }
      } catch {
        router.replace("/login");
      }
    };

    checkUser();
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        <p className="text-sm text-zinc-400">{t("landing.loading")}</p>
      </div>
    </div>
  );
}
