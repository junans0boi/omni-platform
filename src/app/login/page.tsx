"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        window.location.href = "/dashboard";
      } else {
        const rawErr = data.error || "";
        const mappedErr = rawErr === "Invalid username or password"
          ? t("auth.error.invalidCredentials")
          : rawErr === "Unable to log in"
            ? t("auth.error.unableLogin")
            : rawErr || t("auth.login.failed");
        setError(mappedErr);
        setLoading(false);
      }
    } catch {
      setError(t("error.unexpected"));
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg px-4 text-text">
      {/* Dynamic ambient lights */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-accent-soft blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-accent-soft blur-[120px]" />

      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-2xl font-bold shadow-[0_4px_12px_-2px_var(--accent)]">
            Ω
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-text">{t("auth.login.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("auth.login.subtitle")}</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger border border-danger/20">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              {t("auth.email")} / {t("auth.username")}
            </label>
            <input
              type="text"
              required
              className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm text-text placeholder-muted outline-hidden transition focus:border-accent focus:bg-surface-2"
              placeholder="johndoe or name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              {t("auth.password")}
            </label>
            <input
              type="password"
              required
              className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm text-text placeholder-muted outline-hidden transition focus:border-accent focus:bg-surface-2"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent py-3 text-sm font-semibold text-on-accent shadow-[0_4px_12px_-2px_var(--accent)] transition hover:bg-accent-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? t("auth.login.submitting") : t("auth.login.submit")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {t("auth.login.noAccount")}{" "}
          <Link href="/signup" className="font-semibold text-accent hover:text-accent-strong">
            {t("auth.signup.submit")}
          </Link>
        </p>
        <p className="mt-3 text-center text-sm">
          <Link href="/claim" className="text-accent hover:text-accent-strong">
            {t("auth.claimOrReset")}
          </Link>
        </p>
      </div>
    </div>
  );
}
