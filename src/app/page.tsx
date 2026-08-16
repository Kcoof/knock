import Link from "next/link";

const LOOP = [
  { step: "WALK", desc: "Move your pixel character through a shared world." },
  { step: "KNOCK", desc: "See who's building what — and knock on their door." },
  { step: "BUILD", desc: "Talk, collaborate, and get back to work." },
];

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 px-6 text-center">
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

      <Link
        href="/world"
        className="rounded-lg bg-emerald-500 px-6 py-3 text-sm font-medium text-emerald-950 transition-colors hover:bg-emerald-400"
      >
        Enter the World →
      </Link>

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

      <footer className="absolute bottom-4 text-[11px] text-zinc-600">
        Phase 1 — local prototype · mock data only · realtime arrives with
        Supabase in Phase 2+
      </footer>
    </main>
  );
}
