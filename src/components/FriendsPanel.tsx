"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { emitGame } from "@/game/EventBus";
import type { Friend, FriendRequest } from "@/lib/friends";

interface SearchResult {
  id: string;
  username: string;
}

const STATUS_COLORS: Record<string, string> = {
  available: "bg-emerald-400",
  working: "bg-yellow-400",
  focus: "bg-red-400",
  away: "bg-zinc-500",
  offline: "bg-zinc-600",
};

/**
 * The compact friends panel (spec §9): list with live status, incoming
 * requests, user search — Visit/Knock actions keep the world primary.
 */
export default function FriendsPanel({
  userId,
  friends,
  friendRequests,
  onlineHubs,
  onClose,
}: {
  userId: string;
  friends: Friend[];
  friendRequests: FriendRequest[];
  onlineHubs: Map<string, string>;
  onClose: () => void;
}) {
  const [requests, setRequests] = useState<FriendRequest[]>(friendRequests);
  const [list, setList] = useState<Friend[]>(friends);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    const clean = query.trim().toLowerCase();
    if (clean.length < 2 || !isSupabaseConfigured) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, username")
        .ilike("username", `%${clean}%`)
        .neq("id", userId)
        .limit(5);
      setResults((data as SearchResult[]) ?? []);
    } finally {
      setBusy(false);
    }
  };

  const addFriend = async (id: string) => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    await supabase.from("friendships").insert({ requester_id: userId, addressee_id: id });
    setResults((current) => current?.filter((r) => r.id !== id) ?? null);
    emitGame("toast", "Friend request sent");
  };

  const respond = async (request: FriendRequest, accept: boolean) => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    await supabase
      .from("friendships")
      .update({ status: accept ? "accepted" : "declined" })
      .eq("id", request.friendshipId);
    setRequests((current) => current.filter((r) => r.friendshipId !== request.friendshipId));
  };

  const removeFriend = async (friend: Friend) => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    await supabase
      .from("friendships")
      .delete()
      .or(`and(requester_id.eq.${userId},addressee_id.eq.${friend.userId}),and(requester_id.eq.${friend.userId},addressee_id.eq.${userId})`);
    setList((current) => current.filter((f) => f.userId !== friend.userId));
  };

  const visit = (friend: Friend) => {
    const hub = onlineHubs.get(friend.userId);
    if (hub) {
      emitGame("toast", `${friend.username} is in the ${hub.toUpperCase()} hub — traveling…`);
      // full reload switches hubs cleanly
      window.location.assign(`/world?hub=${hub}`);
      return;
    }
    if (friend.roomId) {
      emitGame("friend:goknock", { roomId: friend.roomId });
      onClose();
    } else {
      emitGame("toast", `${friend.username} is offline — leave a note at their door.`);
    }
  };

  return (
    <div className="absolute left-3 top-20 z-30 flex max-h-[70vh] w-64 flex-col overflow-y-auto rounded-xl border border-zinc-700/80 bg-zinc-900/95 p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <p className="font-pixel text-[8px] text-emerald-300">FRIENDS</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1.5 text-xs text-zinc-500 hover:text-zinc-200"
          aria-label="Close friends panel"
        >
          ✕
        </button>
      </div>

      {requests.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {requests.map((request) => (
            <div key={request.friendshipId} className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-2">
              <p className="text-xs text-zinc-200">
                <span className="font-medium text-yellow-300">{request.username}</span> wants to be friends
              </p>
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => respond(request, true)}
                  className="rounded bg-emerald-500 px-2 py-1 text-[10px] font-medium text-emerald-950 hover:bg-emerald-400"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => respond(request, false)}
                  className="rounded border border-zinc-600 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-400"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 space-y-1">
        {list.length === 0 && (
          <p className="text-[11px] text-zinc-500">No friends yet — find builders below.</p>
        )}
        {list.map((friend) => {
          const hub = onlineHubs.get(friend.userId);
          return (
            <div key={friend.userId} className="rounded-lg bg-zinc-800/60 p-2">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${hub ? STATUS_COLORS[friend.status] ?? "bg-emerald-400" : "bg-zinc-600"}`} />
                <p className="truncate text-xs text-zinc-100">{friend.username}</p>
                <span className="ml-auto text-[9px] uppercase text-zinc-500">
                  {hub ? `${hub} · online` : friend.status}
                </span>
              </div>
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => visit(friend)}
                  className="rounded bg-zinc-700 px-2 py-1 text-[10px] text-zinc-100 hover:bg-zinc-600"
                >
                  {hub ? "Join" : "Visit"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    emitGame("friend:goknock", { roomId: friend.roomId });
                    onClose();
                  }}
                  disabled={!friend.roomId}
                  className="rounded border border-zinc-600 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-400 disabled:opacity-40"
                >
                  Knock
                </button>
                <button
                  type="button"
                  onClick={() => removeFriend(friend)}
                  className="ml-auto rounded px-1.5 py-1 text-[10px] text-zinc-500 hover:text-red-400"
                  aria-label={`Remove ${friend.username}`}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 border-t border-zinc-800 pt-2">
        <div className="flex gap-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void search();
            }}
            placeholder="find a builder…"
            maxLength={20}
            className="flex-1 rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void search()}
            disabled={busy}
            className="rounded bg-emerald-500 px-2.5 py-1.5 text-xs font-medium text-emerald-950 disabled:opacity-50"
          >
            {busy ? "…" : "Find"}
          </button>
        </div>
        {results && (
          <div className="mt-1.5 space-y-1">
            {results.length === 0 && <p className="text-[10px] text-zinc-500">no builders found</p>}
            {results.map((result) => (
              <div key={result.id} className="flex items-center justify-between rounded bg-zinc-800/60 px-2 py-1">
                <p className="text-[11px] text-zinc-200">{result.username}</p>
                <button
                  type="button"
                  onClick={() => void addFriend(result.id)}
                  className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-100 hover:bg-emerald-600"
                >
                  + add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
