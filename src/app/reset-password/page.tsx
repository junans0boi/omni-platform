"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setError("Account recovery is unavailable.");
      return;
    }
    const supabase = createBrowserClient(url, key);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("The recovery link is invalid or expired.");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <form className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-white/5 p-8" onSubmit={submit}>
        <h1 className="text-2xl font-bold">Set a new password</h1>
        <input
          type="password"
          required
          minLength={8}
          maxLength={1024}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="New password"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3"
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button className="w-full rounded-lg bg-indigo-600 py-3 font-semibold" type="submit">
          Save password
        </button>
      </form>
    </main>
  );
}
