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
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.10),transparent_34%),linear-gradient(to_bottom,#09090b,#18181b_52%,#09090b)] px-4 py-10 text-center sm:px-6 sm:py-16">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl sm:h-96 sm:w-96" />

      <div className="flex w-full max-w-3xl flex-col items-center gap-8 sm:gap-10">
      <div className="space-y-5 sm:space-y-6">
        <p className="font-pixel text-[9px] tracking-[0.2em] text-emerald-400 sm:text-[10px] sm:tracking-[0.3em]">
          A MULTIPLAYER PIXEL WORLD FOR BUILDERS
        </p>
        <h1 className="font-pixel text-5xl leading-tight tracking-[0.08em] text-zinc-50 drop-shadow-[0_0_28px_rgba(52,211,153,0.45)] sm:text-7xl">
          KNOCK
        </h1>
        <p className="mx-auto max-w-lg text-balance text-sm leading-6 text-zinc-400 sm:text-base sm:leading-7">
          Don&apos;t schedule a meeting. Just knock. Walk into the world, see
          what people are building right now, and drop by their room.
        </p>
      </div>

      {profile ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/45 px-5 py-5 shadow-xl shadow-black/20 backdrop-blur-sm sm:px-8">
          <p className="text-sm text-zinc-400">
            Signed in as{" "}
            <span className="font-medium text-emerald-300">{profile.username}</span>
            {profile.activity_text ? ` — ${profile.activity_text}` : ""}
          </p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              href="/world"
              className="group rounded-xl bg-emerald-400 px-7 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-300 hover:shadow-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              Enter the World →
            </Link>
            <SignOutButton />
          </div>
        </div>
      ) : isSupabaseConfigured ? (
        <div className="flex w-full flex-col items-center gap-4">
          <AuthPanel />
          <Link
            href="/world"
            className="rounded-md px-2 py-1 text-xs text-zinc-500 underline-offset-4 transition-colors hover:text-emerald-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
          >
            or explore as a guest →
          </Link>
        </div>
      ) : (
        <div className="flex w-full flex-col items-center gap-4">
          <Link
            href="/world"
            className="rounded-xl bg-emerald-400 px-8 py-3.5 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-300 hover:shadow-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            Enter the World →
          </Link>
          <p className="max-w-xs text-[11px] leading-relaxed text-zinc-500">
            Running in guest mode — connect a Supabase project
            (see README) to enable accounts and rooms.
          </p>
        </div>
      )}

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {LOOP.map(({ step, desc }) => (
          <div
            key={step}
            className="group rounded-2xl border border-zinc-800/80 bg-zinc-900/55 p-5 text-left shadow-lg shadow-black/10 backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:border-emerald-500/30 hover:bg-zinc-900/80 hover:shadow-emerald-950/20"
          >
            <p className="font-pixel text-[9px] tracking-wider text-emerald-300 transition-colors group-hover:text-emerald-200">{step}</p>
            <p className="mt-3 text-xs leading-relaxed text-zinc-400">{desc}</p>
          </div>
        ))}
      </div>

      <footer className="max-w-md text-balance text-[10px] leading-relaxed text-zinc-600 sm:text-[11px]">
        Phase 2 — authentication & database foundation · realtime arrives in
        Phase 3
      </footer>
      </div>
    </main>
  );
}
