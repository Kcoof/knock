"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const clean = username.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
          setError("Username: 3-20 characters, letters/numbers/underscore.");
          setBusy(false);
          return;
        }
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: clean } },
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
      router.push("/world");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-zinc-800/80 bg-zinc-900/75 p-4 text-left shadow-2xl shadow-black/30 backdrop-blur-md sm:p-6">
      <div className="mb-5 flex gap-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-1">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
              mode === m ? "bg-emerald-400 text-emerald-950 shadow-sm shadow-emerald-950/30" : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === "signup" && (
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
              Username
            </span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="pixel_builder"
              autoComplete="username"
              className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/50 px-3.5 py-2.5 text-sm text-zinc-100 shadow-inner shadow-black/10 transition-colors placeholder:text-zinc-600 hover:border-zinc-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
            Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/50 px-3.5 py-2.5 text-sm text-zinc-100 shadow-inner shadow-black/10 transition-colors placeholder:text-zinc-600 hover:border-zinc-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
            Password
          </span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/50 px-3.5 py-2.5 text-sm text-zinc-100 shadow-inner shadow-black/10 transition-colors placeholder:text-zinc-600 hover:border-zinc-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
          />
        </label>

        {error && (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-300 hover:shadow-emerald-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:pointer-events-none disabled:opacity-50"
        >
          {busy ? "…" : mode === "signin" ? "Sign in" : "Create account & claim your room"}
        </button>
      </form>

      <p className="mt-4 text-center text-[11px] text-zinc-500">
        Every account automatically gets a personal room.
      </p>
    </div>
  );
}
