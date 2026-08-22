"use client";

import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { createGame } from "@/game/createGame";
import { emitGame, onGame } from "@/game/EventBus";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { DOOR_STATE_LABELS, KNOCK_REASONS } from "@/game/constants";
import type { DoorInfo } from "@/game/types";
import type { WorldRoom } from "@/lib/rooms";
import type { PendingKnock } from "@/lib/knocks";
import type { DoorNote } from "@/lib/notes";
import type { Friend, FriendRequest } from "@/lib/friends";
import FriendsPanel from "@/components/FriendsPanel";
import EventBoard from "@/components/EventBoard";
import TouchControls from "@/components/TouchControls";
import { fetchRepoSnapshot } from "@/lib/github";
import WorldMap from "@/components/WorldMap";

const STATE_BADGE: Record<string, string> = {
  open: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  knock: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40",
  focus: "bg-red-500/15 text-red-300 border-red-500/40",
};

export default function GameShell({
  playerName = "Guest Builder",
  activity = "exploring the prototype",
  userId = null,
  char = "builder",
  hub = "india",
  worldRooms = [],
  myRoom = null,
  pendingKnocks = [],
  friends = [],
  friendRequests = [],
  doorNotes = [],
}: {
  playerName?: string;
  activity?: string;
  userId?: string | null;
  char?: string;
  hub?: string;
  worldRooms?: WorldRoom[];
  myRoom?: WorldRoom | null;
  pendingKnocks?: PendingKnock[];
  friends?: Friend[];
  friendRequests?: FriendRequest[];
  doorNotes?: DoorNote[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [nearDoor, setNearDoor] = useState<DoorInfo | null>(null);
  const [dialog, setDialog] = useState<DoorInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [knocks, setKnocks] = useState<PendingKnock[]>(pendingKnocks);
  const [notes, setNotes] = useState<DoorNote[]>(doorNotes);
  const [room, setRoom] = useState<{ ownerName: string; roomId: string; githubUsername: string | null; githubRepo: string | null } | null>(null);
  const [repoSnap, setRepoSnap] = useState<ReturnType<typeof fetchRepoSnapshot> extends Promise<infer T> ? T : never>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [touchDevice] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const [onlineHubs, setOnlineHubs] = useState<Map<string, string>>(new Map());
  const [nearPortal, setNearPortal] = useState(false);
  const [invite, setInvite] = useState<{ ownerName: string; ownerKey: string } | null>(null);
  const [chat, setChat] = useState<Array<{ username: string; content: string; at: number }>>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    // stable per-tab guest key so a guest keeps their identity across reloads
    let netKey = userId ?? null;
    if (!netKey) {
      netKey = sessionStorage.getItem("knock-guest-key");
      if (!netKey) {
        netKey = "guest_" + Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem("knock-guest-key", netKey);
      }
    }
    const game = createGame(containerRef.current, {
      playerName,
      netIdentity: { key: netKey, username: playerName, char, guest: !userId },
      worldRooms,
      myRoomId: myRoom?.roomId ?? null,
      roomTheme: myRoom?.theme ?? "warm",
      hub,
    });
    gameRef.current = game;
    (window as unknown as { __KNOCK_GAME?: Phaser.Game }).__KNOCK_GAME = game;
    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, [playerName, char, userId, worldRooms, myRoom, hub]);

  const bumpPassport = (key: string) => {
    try {
      localStorage.setItem(key, String(Number(localStorage.getItem(key) ?? 0) + 1));
    } catch {}
  };

  useEffect(() => {
    const offs = [
      onGame("door:near", (door) => setNearDoor(door)),
      onGame("knock:open", (door) => setDialog(door)),
      onGame("toast", (text) => setToast(text)),
      onGame("room:entered", (r) => { setRoom(r); setRepoSnap(null); bumpPassport("knock-passport-rooms"); try { localStorage.setItem("knock-passport-visited", JSON.stringify([...new Set([...(JSON.parse(localStorage.getItem("knock-passport-visited") ?? "[]") as string[]), hub])])); } catch {} }),
      onGame("come:invite", (payload) => setInvite(payload)),
      onGame("worldmap:open", () => setMapOpen(true)),
      onGame("worldmap:close", () => setMapOpen(false)),
      onGame("portal:near", (near) => setNearPortal(near)),
      onGame("room:exited", () => setRoom(null)),
      onGame("chat:message", (message) =>
        setChat((current) => [...current.slice(-49), message]),
      ),
      onGame("knock:incoming", (event) => {
        setKnocks((current) => [
          {
            id: event.knockId,
            reason: event.reason,
            message: event.message,
            visitorName: event.visitorName,
            visitorId: event.visitorKey,
            createdAt: new Date().toISOString(),
          },
          ...current.filter((k) => k.id !== event.knockId),
        ]);
      }),
    ];
    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hub is stable per page load
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!room?.githubUsername || !room.githubRepo) return;
    let cancelled = false;
    void fetchRepoSnapshot(room.githubUsername, room.githubRepo).then((snap) => {
      if (!cancelled) setRepoSnap(snap);
    });
    return () => {
      cancelled = true;
    };
  }, [room]);



  // online friends: listen to meta pings while the friends panel is open
  useEffect(() => {
    if (!friendsOpen || !isSupabaseConfigured || !userId) return;
    const supabase = createClient();
    const channel = supabase.channel("knock:hubs-meta");
    const seen = new Map<string, { hub: string; at: number }>();
    channel.on("broadcast", { event: "here" }, ({ payload }) => {
      seen.set(payload.userKey as string, { hub: payload.hub as string, at: Date.now() });
    });
    void channel.subscribe();
    const interval = setInterval(() => {
      const now = Date.now();
      const next = new Map<string, string>();
      for (const [key, value] of seen) if (now - value.at < 16000) next.set(key, value.hub);
      setOnlineHubs(next);
    }, 3000);
    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [friendsOpen, userId]);


  const openDialogFromHud = () => {
    if (!nearDoor || dialog) return;
    setDialog(nearDoor);
    emitGame("dialog:open", nearDoor);
  };

  const closeDialog = () => {
    setDialog(null);
    emitGame("dialog:closed");
  };



  const sendKnock = (reason: string, message: string) => {
    if (!dialog) return;
    emitGame("knock:send", { doorId: dialog.id, reason, message });
    bumpPassport("knock-passport-knocks");
    closeDialog();
  };

  const sendChat = (content: string) => {
    const clean = content.trim().slice(0, 200);
    if (!clean) return;
    emitGame("chat:send", clean);
    setChat((current) => [
      ...current.slice(-49),
      { username: playerName, content: clean, at: Date.now() },
    ]);
    if (userId && room) {
      void createClient()
        .from("room_messages")
        .insert({ room_id: room.roomId, author_id: userId, content: clean })
        .then(({ error }) => {
          if (error) console.warn("chat history not saved", error.message);
        });
    }
  };

  const dismissNote = (note: DoorNote) => {
    setNotes((current) => current.filter((n) => n.id !== note.id));
    void createClient()
      .from("door_notes")
      .update({ read_at: new Date().toISOString() })
      .eq("id", note.id);
  };
  return (
    <div className="fixed inset-0 overflow-hidden bg-zinc-950">
      <div ref={containerRef} className="absolute inset-0" data-testid="game-root" />
      {/* ambient grade: warm sunlight tint + soft vignette for painterly cohesion */}
      <div className="pointer-events-none absolute inset-0 z-[5] bg-amber-200 opacity-[0.04]" />
      <div className="pointer-events-none absolute inset-0 z-[5] bg-[radial-gradient(ellipse_at_center,transparent_58%,rgba(8,12,6,0.38)_100%)]" />

      {/* top-left player badge */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 backdrop-blur-sm">
        <p className="font-pixel text-[9px] leading-relaxed text-emerald-300">
          {playerName.toUpperCase()}
        </p>
        <p className="mt-1 text-xs text-zinc-400">Available — {activity}</p>
      </div>

      {/* friends toggle (spec §9: compact, not the primary interface) */}
      {userId && !room && !mapOpen && (
        <button
          type="button"
          onClick={() => setFriendsOpen((v) => !v)}
          className="absolute left-3 top-[76px] z-10 rounded-md border border-zinc-700/80 bg-zinc-900/80 px-3 py-1.5 font-pixel text-[8px] text-emerald-300 backdrop-blur-sm hover:border-emerald-500/60"
        >
          FRIENDS{friendRequests.length > 0 ? " ●" : ""}
        </button>
      )}
      {userId && !room && !mapOpen && !friendsOpen && (
        <button
          type="button"
          onClick={() => setEventsOpen((v) => !v)}
          className="absolute left-3 top-[116px] z-10 rounded-md border border-zinc-700/80 bg-zinc-900/80 px-3 py-1.5 font-pixel text-[8px] text-violet-300 backdrop-blur-sm hover:border-violet-500/60"
        >
          EVENTS
        </button>
      )}
      {userId && eventsOpen && !room && (
        <EventBoard userId={userId} currentHub={hub} onClose={() => setEventsOpen(false)} />
      )}
      {userId && friendsOpen && !room && (
        <FriendsPanel
          userId={userId}
          friends={friends}
          friendRequests={friendRequests}
          onlineHubs={onlineHubs}
          onClose={() => setFriendsOpen(false)}
        />
      )}
      {/* signed-in room controls */}
      {userId && myRoom && (
        <PlayerPanel playerName={playerName} initialActivity={activity} myRoom={myRoom} char={char} />
      )}

      {/* owner's GitHub context inside their room (spec §14) */}
      {room && repoSnap && (
        <div className="absolute bottom-4 left-3 z-20 w-72 rounded-lg border border-zinc-700/80 bg-zinc-900/90 p-3 backdrop-blur-sm">
          <p className="font-pixel text-[8px] text-blue-300">GITHUB</p>
          <p className="mt-1 text-xs font-medium text-zinc-100">{repoSnap.repo}</p>
          {repoSnap.latestCommitMessage ? (
            <p className="mt-1 truncate text-[11px] text-zinc-400" title={repoSnap.latestCommitMessage}>
              latest: {repoSnap.latestCommitMessage}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-zinc-500">no public commits found</p>
          )}
          {repoSnap.latestCommitTime && (
            <p className="mt-0.5 text-[10px] text-zinc-600">{repoSnap.latestCommitTime}</p>
          )}
        </div>
      )}

      {/* someone invited everyone to their room */}
      {invite && !room && (
        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-amber-500/50 bg-zinc-900/95 px-4 py-3 shadow-xl backdrop-blur-sm">
          <p className="text-sm text-zinc-100">
            <span className="font-medium text-amber-300">{invite.ownerName}</span> is calling you over.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                emitGame("come:accept");
                setInvite(null);
              }}
              className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-400"
            >
              Go to their door
            </button>
            <button
              type="button"
              onClick={() => setInvite(null)}
              className="rounded-lg border border-zinc-600 px-4 py-1.5 text-xs text-zinc-300 hover:border-zinc-400"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      <TouchControls visible={touchDevice && !dialog && !mapOpen} />

      {/* world portal prompt + map overlay (V2) */}
      {nearPortal && !mapOpen && !room && (
        <button
          type="button"
          onClick={() => emitGame("worldmap:open")}
          className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 rounded-lg border border-violet-500/60 bg-zinc-900/90 px-4 py-3 text-center shadow-xl backdrop-blur-sm hover:border-violet-400"
        >
          <p className="font-pixel text-[9px] text-violet-200">WORLD PORTAL</p>
          <p className="mt-1 text-xs text-zinc-400">
            press <kbd className="rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px]">E</kbd> or click to travel
          </p>
        </button>
      )}
      {mapOpen && <WorldMap currentHub={hub} />}

      {/* room chat while inside a room */}
      {room && <ChatPanel ownerName={room.ownerName} roomId={room.roomId} messages={chat} playerName={playerName} onSend={sendChat} />}

      {/* notes left at my door while away */}
      {userId && myRoom && notes.length > 0 && (
        <DoorNoteCards notes={notes} onDismiss={dismissNote} />
      )}

      {/* knocks at my door — live and while-away */}
      {userId && myRoom && knocks.length > 0 && (
        <KnockQueue roomId={myRoom.roomId} knocks={knocks} onResolved={() => setKnocks([])} />
      )}

      {/* toast */}
      {toast && (
        <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-md border border-emerald-500/40 bg-zinc-900/90 px-4 py-2 text-sm text-emerald-200 shadow-lg">
          {toast}
        </div>
      )}

      {/* interaction prompt — clickable for keyboard-free access (spec §32) */}
      {nearDoor && !dialog && (
        <button
          type="button"
          onClick={openDialogFromHud}
          className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-900/90 px-4 py-3 text-center shadow-xl backdrop-blur-sm transition-colors hover:border-emerald-500/60"
        >
          <p className="font-pixel text-[9px] text-zinc-100">
            {nearDoor.state === "focus"
              ? `${nearDoor.buildingName.toUpperCase()} IS IN FOCUS MODE`
              : `KNOCK ON ${nearDoor.owner.toUpperCase()}'S DOOR?`}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {DOOR_STATE_LABELS[nearDoor.state]} · press{" "}
            <kbd className="rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-200">
              E
            </kbd>{" "}
            or click here
          </p>
        </button>
      )}

      {/* controls hint */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 text-[11px] text-zinc-500">
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono">WASD</kbd>{" "}
        /{" "}
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono">↑←↓→</kbd>{" "}
        move ·{" "}
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono">E</kbd>{" "}
        interact
      </div>

      {dialog && <KnockDialog door={dialog} onCancel={closeDialog} onSend={sendKnock} />}
    </div>
  );
}

const STATUSES = ["available", "working", "focus", "away"] as const;
const DOOR_STATES = ["open", "knock", "focus"] as const;

function PlayerPanel({
  playerName,
  initialActivity,
  myRoom,
  char,
}: {
  playerName: string;
  initialActivity: string;
  myRoom: WorldRoom;
  char: string;
}) {
  const [status, setStatus] = useState<string>(myRoom.status);
  const [activityText, setActivityText] = useState(initialActivity);
  const [doorState, setDoorState] = useState<"open" | "knock" | "focus">(
    myRoom.doorState === "private" ? "knock" : myRoom.doorState,
  );
  const [avatar, setAvatar] = useState<string>(char);
  const [theme, setTheme] = useState<string>(myRoom.theme || "warm");
  const [ghUser, setGhUser] = useState<string>(myRoom.githubUsername ?? "");
  const [ghRepo, setGhRepo] = useState<string>(myRoom.githubRepo ?? "");
  const [isPublic, setIsPublic] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const inviteAll = () => {
    emitGame("come:send");
    setNote("Invite sent — watch for visitors");
    setTimeout(() => setNote(null), 3000);
  };

  const save = async () => {
    setSaving(true);
    setNote(null);
    try {
      const supabase = createClient();
      const cleanActivity = activityText.trim().slice(0, 60);
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          status,
          activity_text: cleanActivity,
          avatar,
          github_username: ghUser.trim() || null,
          github_repo: ghRepo.trim() || null,
        })
        .eq("id", myRoom.ownerId);
      if (profileErr) throw profileErr;
      const { error: roomErr } = await supabase
        .from("rooms")
        .update({ door_state: doorState, theme, visibility: isPublic ? "public" : "friends" })
        .eq("id", myRoom.roomId);
      if (roomErr) throw roomErr;

      // update this tab instantly and tell other players
      emitGame("room:update", {
        roomId: myRoom.roomId,
        doorState,
        activity: cleanActivity,
        username: playerName,
      });
      setNote("Saved — your door is live");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
      setTimeout(() => setNote(null), 3000);
    }
  };

  return (
    <div className="absolute right-3 top-3 z-10 w-64 rounded-lg border border-zinc-700/80 bg-zinc-900/85 p-3 backdrop-blur-sm">
      <p className="font-pixel text-[8px] text-emerald-300">YOUR ROOM</p>

      <label className="mt-2 block text-[10px] uppercase tracking-wide text-zinc-500">
        Status
      </label>
      <div className="mt-1 flex gap-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`flex-1 rounded px-1.5 py-1 text-[10px] capitalize transition-colors ${
              status === s
                ? "bg-emerald-500 text-emerald-950"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <label className="mt-2 block text-[10px] uppercase tracking-wide text-zinc-500">
        Working on
      </label>
      <input
        value={activityText}
        onChange={(e) => setActivityText(e.target.value)}
        maxLength={60}
        placeholder="e.g. Authentication API"
        className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
      />

      <label className="mt-2 block text-[10px] uppercase tracking-wide text-zinc-500">
        Character
      </label>
      <div className="mt-1 flex gap-1">
        {["builder", "noble", "mage", "traveler"].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setAvatar(c)}
            className={`flex-1 rounded px-1 py-1 text-[10px] capitalize transition-colors ${
              avatar === c ? "bg-emerald-500 text-emerald-950" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <label className="mt-2 block text-[10px] uppercase tracking-wide text-zinc-500">
        Room theme
      </label>
      <div className="mt-1 flex gap-1">
        {["warm", "cool", "mossy"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            className={`flex-1 rounded px-1 py-1 text-[10px] capitalize transition-colors ${
              theme === t ? "bg-amber-500 text-amber-950" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <label className="mt-2 block text-[10px] uppercase tracking-wide text-zinc-500">
        GitHub (public repo)
      </label>
      <div className="mt-1 flex gap-1">
        <input
          value={ghUser}
          onChange={(e) => setGhUser(e.target.value)}
          maxLength={40}
          placeholder="username"
          className="w-1/2 rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
        />
        <input
          value={ghRepo}
          onChange={(e) => setGhRepo(e.target.value)}
          maxLength={60}
          placeholder="repo"
          className="w-1/2 rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="h-3.5 w-3.5 accent-emerald-500"
        />
        List my room publicly on the world map
      </label>

      <button
        type="button"
        onClick={inviteAll}
        className="mt-3 w-full rounded border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/20"
      >
        Invite everyone: &quot;Come here&quot;
      </button>

      <label className="mt-2 block text-[10px] uppercase tracking-wide text-zinc-500">
        Door
      </label>
      <div className="mt-1 flex gap-1">
        {DOOR_STATES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setDoorState(s)}
            className={`flex-1 rounded px-1.5 py-1 text-[10px] transition-colors ${
              doorState === s
                ? s === "open"
                  ? "bg-emerald-500 text-emerald-950"
                  : s === "knock"
                    ? "bg-yellow-500 text-yellow-950"
                    : "bg-red-500 text-red-950"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {s === "open" ? "Open" : s === "knock" ? "Knock" : "Focus"}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-3 w-full rounded bg-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Update my door"}
      </button>
      {note && <p className="mt-2 text-center text-[10px] text-zinc-400">{note}</p>}
    </div>
  );
}

function ChatPanel({
  ownerName,
  roomId,
  messages,
  playerName,
  onSend,
}: {
  ownerName: string;
  roomId: string;
  messages: Array<{ username: string; content: string; at: number }>;
  playerName: string;
  onSend: (content: string) => void;
}) {
  const [text, setText] = useState("");
  void roomId;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSend(text);
    setText("");
  };

  return (
    <div className="absolute bottom-4 right-3 z-20 flex h-72 w-80 flex-col rounded-lg border border-zinc-700/80 bg-zinc-900/90 backdrop-blur-sm">
      <p className="border-b border-zinc-800 px-3 py-2 font-pixel text-[8px] text-emerald-300">
        {ownerName.toUpperCase()}&apos;S ROOM — CHAT
      </p>
      <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-2">
        {messages.length === 0 && (
          <p className="text-center text-[11px] text-zinc-500">Say hi — walk to the door below to leave (E)</p>
        )}
        {messages.map((m, i) => (
          <p key={i} className="text-xs leading-relaxed">
            <span className={m.username === playerName ? "text-emerald-300" : "text-blue-300"}>
              {m.username}
            </span>
            <span className="text-zinc-500">: </span>
            <span className="text-zinc-200">{m.content}</span>
          </p>
        ))}
      </div>
      <form onSubmit={submit} className="border-t border-zinc-800 p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => emitGame("chat:focus", true)}
          onBlur={() => emitGame("chat:focus", false)}
          maxLength={200}
          placeholder="Type a message…"
          className="w-full rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
        />
      </form>
    </div>
  );
}

function DoorNoteCards({
  notes,
  onDismiss,
}: {
  notes: DoorNote[];
  onDismiss: (note: DoorNote) => void;
}) {
  return (
    <div className="absolute bottom-16 left-1/2 z-20 w-80 -translate-x-1/2 space-y-2">
      {notes.map((note) => (
        <div
          key={note.id}
          className="rounded-lg border border-emerald-500/40 bg-zinc-900/95 p-4 shadow-xl backdrop-blur-sm"
          role="note"
        >
          <p className="text-sm text-zinc-100">
            <span className="font-medium text-emerald-300">{note.authorName}</span> stopped by.
          </p>
          <p className="mt-1 text-xs text-zinc-400">“{note.message}”</p>
          <button
            type="button"
            onClick={() => onDismiss(note)}
            className="mt-3 w-full rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-400"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}

function KnockQueue({
  roomId,
  knocks,
  onResolved,
}: {
  roomId: string;
  knocks: PendingKnock[];
  onResolved: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const respond = async (knock: PendingKnock, accepted: boolean) => {
    setBusy(knock.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("knocks")
        .update({ status: accepted ? "accepted" : "declined" })
        .eq("id", knock.id);
      if (error) throw error;
      emitGame("knock:respond", {
        knockId: knock.id,
        roomId,
        visitorKey: knock.visitorId,
        accepted,
      });
      onResolved();
    } catch {
      setBusy(null);
    }
  };

  return (
    <div className="absolute left-1/2 top-3 z-20 w-80 -translate-x-1/2 space-y-2">
      {knocks.map((knock) => (
        <div
          key={knock.id}
          className="rounded-lg border border-yellow-500/50 bg-zinc-900/95 p-4 shadow-xl backdrop-blur-sm"
          role="alert"
        >
          <p className="font-pixel text-[9px] text-yellow-300">KNOCK KNOCK</p>
          <p className="mt-2 text-sm text-zinc-100">
            <span className="font-medium text-yellow-200">{knock.visitorName}</span> is outside your
            room.
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {knock.reason}
            {knock.message ? ` — “${knock.message}”` : ""}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy === knock.id}
              onClick={() => respond(knock, true)}
              className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              Let In
            </button>
            <button
              type="button"
              disabled={busy === knock.id}
              onClick={() => respond(knock, false)}
              className="flex-1 rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-300 hover:border-zinc-400 disabled:opacity-50"
            >
              Not Now
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function LeaveNoteSection({ door }: { door: DoorInfo }) {
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  const leave = async () => {
    const clean = note.trim().slice(0, 200);
    if (!clean) return;
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("sign in");
      const { error } = await supabase.from("door_notes").insert({
        room_id: door.roomId,
        author_id: user.id,
        message: clean,
      });
      if (error) throw error;
      setSent(true);
    } catch {
      setSent(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-800/40 p-3">
      <p className="text-xs text-zinc-400">
        {door.owner} is away — leave a note at their door instead?
      </p>
      {sent ? (
        <p className="mt-2 text-xs text-emerald-300">Note left ✓ they&apos;ll see it next visit</p>
      ) : (
        <div className="mt-2 flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Check the login issue when you&apos;re back…"
            className="flex-1 rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={leave}
            className="rounded border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200 hover:border-emerald-500"
          >
            Leave note
          </button>
        </div>
      )}
    </div>
  );
}

function KnockDialog({  door,
  onCancel,
  onSend,
}: {
  door: DoorInfo;
  onCancel: () => void;
  onSend: (reason: string, message: string) => void;
}) {
  const [reason, setReason] = useState<string>(KNOCK_REASONS[0]);
  const [message, setMessage] = useState("");

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-[2px]"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={`Knock on ${door.owner}'s door`}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-pixel text-[11px] leading-relaxed text-zinc-100">
              KNOCK KNOCK
            </h2>
            <p className="mt-2 text-sm text-zinc-300">
              {door.owner} — <span className="text-zinc-500">{door.activity}</span>
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${STATE_BADGE[door.state]}`}
          >
            {DOOR_STATE_LABELS[door.state]}
          </span>
        </div>

        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Reason
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {KNOCK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                reason === r
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-200"
                  : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Message (optional)
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 140))}
          placeholder="Can you help me with this bug?"
          rows={2}
          className="mt-2 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
        />

        {door.roomId && door.ownerOnline === false && <LeaveNoteSection door={door} />}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => onSend(reason, message)}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
          >
            Knock
          </button>
        </div>
      </div>
    </div>
  );
}
