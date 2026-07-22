"use client";

import Link from "next/link";
import { useState } from "react";

export default function ClaimPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/auth/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (response.ok) setSent(true);
    else setError("Account recovery is unavailable.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 text-text">
      <section className="w-full max-w-md rounded-2xl border border-line bg-surface p-8">
        <h1 className="text-2xl font-bold">Claim or reset your account</h1>
        <p className="mt-2 text-sm text-muted">
          Use the verified email you control. Existing passwords are never copied.
        </p>
        {sent ? (
          <p className="mt-6 rounded-lg bg-online/10 p-3 text-sm text-online">
            If an eligible account exists, a recovery link has been sent.
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-lg border border-line bg-surface px-4 py-3"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button className="w-full rounded-lg bg-accent py-3 font-semibold text-on-accent" type="submit">
              Send recovery link
            </button>
          </form>
        )}
        <Link className="mt-6 inline-block text-sm text-accent" href="/login">Back to login</Link>
      </section>
    </main>
  );
}
