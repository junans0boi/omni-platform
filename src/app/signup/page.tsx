"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { t } = useI18n();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formattedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!formattedUsername) {
      setError(t("auth.signup.invalidUsername"));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          username: formattedUsername,
          display_name: displayName.trim() || formattedUsername,
        }),
      });

      const data = await res.json();

      if (res.ok && data.verificationRequired) {
        setSuccess(true);
        setLoading(false);
      } else if (res.ok) {
        setSuccess(true);
        setLoading(false);
        window.location.href = "/dashboard";
      } else {
        const rawErr = data.error || "";
        const mappedErr = rawErr.includes("password between 8 and 1024")
          ? t("auth.error.passwordLength")
          : rawErr === "Username or email is already registered"
            ? "사용자 이름 또는 이메일이 이미 등록되어 있습니다."
            : rawErr || t("auth.signup.failed");
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
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-text">{t("auth.signup.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("auth.signup.subtitle")}</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger border border-danger/20">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg bg-online/10 p-3 text-sm text-online border border-online/20">
            {t("auth.signup.success")}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
              {t("auth.username")}
            </label>
            <input
              type="text"
              required
              className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-text placeholder-muted outline-hidden transition focus:border-accent focus:bg-surface-2"
              placeholder="johndoe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
              {t("auth.displayName")}
            </label>
            <input
              type="text"
              required
              className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-text placeholder-muted outline-hidden transition focus:border-accent focus:bg-surface-2"
              placeholder="John Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
              {t("auth.email")}
            </label>
            <input
              type="email"
              required
              className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-text placeholder-muted outline-hidden transition focus:border-accent focus:bg-surface-2"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1 flex justify-between">
              <span>{t("auth.password")}</span>
              <span className="text-[10px] text-muted lowercase">({t("auth.passwordHint")})</span>
            </label>
            <input
              type="password"
              required
              className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-text placeholder-muted outline-hidden transition focus:border-accent focus:bg-surface-2"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full rounded-lg bg-accent py-3 text-sm font-semibold text-on-accent shadow-[0_4px_12px_-2px_var(--accent)] transition hover:bg-accent-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? t("auth.signup.submitting") : t("auth.signup.submit")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {t("auth.signup.hasAccount")}{" "}
          <Link href="/login" className="font-semibold text-accent hover:text-accent-strong">
            {t("auth.login.submit")}
          </Link>
        </p>
      </div>
    </div>
  );
}
