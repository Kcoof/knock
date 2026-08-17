import Link from "next/link";
import AuthPanel from "@/components/AuthPanel";
import SignOutButton from "@/components/SignOutButton";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const LOOP = [
  { step: "WALK", desc: "Move your pixel character through a shared world." },
  { step: "KNOCK", desc: "See who's building what — and knock on their door." },
  { step: "BUILD", desc: "Talk, collaborate, and get back to work." },
];

export default async function Home() {
  const profile = isSupabaseConfigured ? await getProfile() : null;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <div className="space-y-5">
        <p className="font-pixel text-[10px] tracking-widest text-emerald-400">
          A MULTIPLAYER PIXEL WORLD FOR BUILDERS
        </p>
        <h1 className="font-pixel text-5xl leading-tight text-zinc-50 drop-shadow-[0_0_24px_rgba(52,211,153,0.35)]">
          KNOCK
        </h1>
        <p className="mx-auto max-w-md text-balance text-sm leading-relaxed text-zinc-400">
          Don&apos;t schedule a meeting. Just knock. Walk into the world, see
          what people are building right now, and drop by their room.
        </p>
      </div>

      {profile ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-zinc-400">
            Signed in as{" "}
            <span className="font-medium text-emerald-300">{profile.username}</span>
            {profile.activity_text ? ` — ${profile.activity_text}` : ""}
          </p>
          <div className="flex gap-2">
            <Link
              href="/world"
              className="rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-medium text-emerald-950 transition-colors hover:bg-emerald-400"
            >
              Enter the World →
            </Link>
            <SignOutButton />
          </div>
        </div>
      ) : isSupabaseConfigured ? (
        <div className="flex w-full flex-col items-center gap-3">
          <AuthPanel />
          <Link
            href="/world"
            className="text-xs text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-300 hover:underline"
          >
            or explore as a guest →
          </Link>
        </div>
      ) : (
        <div className="flex w-full flex-col items-center gap-3">
          <Link
            href="/world"
            className="rounded-lg bg-emerald-500 px-6 py-3 text-sm font-medium text-emerald-950 transition-colors hover:bg-emerald-400"
          >
            Enter the World →
          </Link>
          <p className="max-w-xs text-[11px] leading-relaxed text-zinc-500">
            Running in guest mode — connect a Supabase project
            (see README) to enable accounts and rooms.
          </p>
        </div>
      )}

      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
        {LOOP.map(({ step, desc }) => (
          <div
            key={step}
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-left"
          >
            <p className="font-pixel text-[9px] text-emerald-300">{step}</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">{desc}</p>
          </div>
        ))}
      </div>

      <footer className="text-[11px] text-zinc-600">
        Phase 2 — authentication & database foundation · realtime arrives in
        Phase 3
      </footer>
    </main>
  );
}
