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
      className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:border-zinc-500 disabled:opacity-50"
    >
      {busy ? "…" : "Sign out"}
    </button>
  );
}
