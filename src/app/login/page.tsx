"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { t } = useI18n();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/dashboard");
      } else {
        setError(data.code ? t("auth.login.failed") : (data.error || t("auth.login.failed")));
        setLoading(false);
      }
    } catch {
      setError(t("error.unexpected"));
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-100 px-4 text-zinc-900 dark:bg-radial dark:from-[#1e1b4b] dark:via-[#09090b] dark:to-black dark:text-white">
      {/* Dynamic ambient lights */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-purple-600/10 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[120px]" />

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-tr from-indigo-500 to-purple-600 text-2xl font-bold shadow-lg shadow-indigo-500/30">
            Ω
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{t("auth.login.title")}</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("auth.login.subtitle")}</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              {t("auth.email")}
            </label>
            <input
              type="text"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-hidden transition focus:border-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-zinc-500 dark:focus:bg-white/10"
              placeholder="johndoe or name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              {t("auth.password")}
            </label>
            <input
              type="password"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-hidden transition focus:border-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-zinc-500 dark:focus:bg-white/10"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? t("auth.login.submitting") : t("auth.login.submit")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {t("auth.login.noAccount")}{" "}
          <Link href="/signup" className="font-semibold text-indigo-400 hover:text-indigo-300">
            {t("auth.signup.submit")}
          </Link>
        </p>
        <p className="mt-3 text-center text-sm">
          <Link href="/claim" className="text-indigo-400 hover:text-indigo-300">
            Claim or reset an existing account
          </Link>
        </p>
      </div>
    </div>
  );
}
