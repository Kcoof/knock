"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await createClient().auth.signOut();
        } finally {
          router.push("/");
          router.refresh();
        }
      }}
      className="rounded-xl border border-zinc-700 bg-zinc-900/70 px-5 py-3 text-sm font-medium text-zinc-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:pointer-events-none disabled:opacity-50"
    >
      {busy ? "…" : "Sign out"}
    </button>
  );
}
