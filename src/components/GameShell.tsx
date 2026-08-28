"use client";

import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { createGame } from "@/game/createGame";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { DOOR_STATE_LABELS, HUBS, KNOCK_REASONS } from "@/game/constants";
import { emitGame, onGame } from "@/game/EventBus";
import type { DoorInfo } from "@/game/types";
import type { WorldRoom } from "@/lib/rooms";
import type { PendingKnock } from "@/lib/knocks";
import type { DoorNote } from "@/lib/notes";
import type { Friend, FriendRequest } from "@/lib/friends";
import { VoiceService } from "@/lib/voice";
import TouchControls from "@/components/TouchControls";

// Qwen-designed presentation layer (phase Q1–Q6)
import { PlayerBadge } from "@/components/ui/PlayerBadge";
import { ControlsHint } from "@/components/ui/ControlsHint";
import { Toast } from "@/components/ui/Toast";
import { InteractionPrompt } from "@/components/ui/InteractionPrompt";
import { KnockDialog } from "@/components/ui/KnockDialog";
import { IncomingKnockCard } from "@/components/ui/IncomingKnockCard";
import { RoomPanel } from "@/components/ui/RoomPanel";
import { DoorNoteCards } from "@/components/ui/DoorNoteCards";
import { RoomChatPanel } from "@/components/ui/RoomChatPanel";
import { GitHubCard } from "@/components/ui/GitHubCard";
import { VoiceBar } from "@/components/ui/VoiceBar";
import { PortalPrompt } from "@/components/ui/PortalPrompt";
import { WorldMapOverlay } from "@/components/ui/WorldMapOverlay";
import { FriendsPanel } from "@/components/ui/FriendsPanel";
import { EventBoard } from "@/components/ui/EventBoard";

const ACCENT_NAMES: Record<string, string> = {
  "#22c55e": "emerald",
  "#eab308": "amber",
  "#f472b6": "pink",
  "#60a5fa": "blue",
  "#a78bfa": "violet",
  "#f87171": "red",
  "#fbbf24": "amber",
};

interface UiEvent {
  id: string;
  title: string;
  hub: string;
  starts_at: string;
  created_by: string | null;
}

function readPassport() {
  try {
    return {
      visited: JSON.parse(localStorage.getItem("knock-passport-visited") ?? "[]") as string[],
      knocks: Number(localStorage.getItem("knock-passport-knocks") ?? 0),
      rooms: Number(localStorage.getItem("knock-passport-rooms") ?? 0),
    };
  } catch {
    return { visited: [], knocks: 0, rooms: 0 };
  }
}

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
  const voiceRef = useRef<VoiceService | null>(null);

  const [nearDoor, setNearDoor] = useState<DoorInfo | null>(null);
  const [dialog, setDialog] = useState<DoorInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [knocks, setKnocks] = useState<PendingKnock[]>(pendingKnocks);
  const [notes, setNotes] = useState<DoorNote[]>(doorNotes);
  const [room, setRoom] = useState<{
    ownerName: string;
    roomId: string;
    githubUsername: string | null;
    githubRepo: string | null;
  } | null>(null);
  const [chat, setChat] = useState<Array<{ username: string; content: string; at: number }>>([]);
  const [repoSnap, setRepoSnap] = useState<{
    repo: string;
    latestCommitMessage: string | null;
    latestCommitTime: string | null;
  } | null>(null);
  const [invite, setInvite] = useState<{ ownerName: string; ownerKey: string } | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [nearPortal, setNearPortal] = useState(false);
  const [onlineHubs, setOnlineHubs] = useState<Map<string, string>>(new Map());
  const [publicRooms, setPublicRooms] = useState<Array<{ id: string; name: string; doorState: string }>>([]);
  const [passport, setPassport] = useState({ visited: [] as string[], knocks: 0, rooms: 0 });
  const [events, setEvents] = useState<UiEvent[]>([]);
  const [friendList, setFriendList] = useState<Friend[]>(friends);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string }> | null>(null);
  const [searching, setSearching] = useState(false);
  const [noteSent, setNoteSent] = useState(false);
  const [touchDevice] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
  );

  const [voiceJoined, setVoiceJoined] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceParticipants, setVoiceParticipants] = useState<
    Array<{ key: string; username: string; speaking: boolean }>
  >([]);

  const [pStatus, setPStatus] = useState(myRoom?.status ?? "available");
  const [pActivity, setPActivity] = useState(activity);
  const [pDoor, setPDoor] = useState<"open" | "knock" | "focus">(
    myRoom?.doorState === "focus" ? "focus" : myRoom?.doorState === "open" ? "open" : "knock",
  );
  const [pCharacter, setPCharacter] = useState(char);
  const [pTheme, setPTheme] = useState(myRoom?.theme ?? "warm");
  const [ghUser, setGhUser] = useState(myRoom?.githubUsername ?? "");
  const [ghRepo, setGhRepo] = useState(myRoom?.githubRepo ?? "");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState({ title: "", hubId: hub, when: "" });

  const bumpPassport = (key: string) => {
    try {
      localStorage.setItem(key, String(Number(localStorage.getItem(key) ?? 0) + 1));
    } catch {}
  };

  useEffect(() => {
    if (!containerRef.current) return;
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

  useEffect(() => {
    const offs = [
      onGame("door:near", (door) => setNearDoor(door)),
      onGame("knock:open", (door) => {
        setDialog(door);
        setNoteSent(false);
      }),
      onGame("toast", (text) => setToast(text)),
      onGame("room:entered", (r) => {
        setRoom(r);
        setRepoSnap(null);
        bumpPassport("knock-passport-rooms");
        try {
          localStorage.setItem(
            "knock-passport-visited",
            JSON.stringify([
              ...new Set([
                ...(JSON.parse(localStorage.getItem("knock-passport-visited") ?? "[]") as string[]),
                hub,
              ]),
            ]),
          );
        } catch {}
      }),
      onGame("room:exited", () => setRoom(null)),
      onGame("chat:message", (message) => setChat((current) => [...current.slice(-49), message])),
      onGame("come:invite", (payload) => setInvite(payload)),
      onGame("worldmap:open", () => {
        setPassport(readPassport());
        setMapOpen(true);
        if (isSupabaseConfigured) {
          void createClient()
            .from("rooms")
            .select("id, name, door_state")
            .eq("visibility", "public")
            .limit(10)
            .then(({ data }) => {
              setPublicRooms(
                ((data as Array<{ id: string; name: string; door_state: string }>) ?? []).map((r) => ({
                  id: r.id,
                  name: r.name,
                  doorState: r.door_state,
                })),
              );
            });
        }
      }),
      onGame("worldmap:close", () => setMapOpen(false)),
      onGame("portal:near", (near) => setNearPortal(near)),
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
  }, [hub]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!room?.githubUsername || !room.githubRepo) return;
    let cancelled = false;
    void import("@/lib/github").then(({ fetchRepoSnapshot }) =>
      fetchRepoSnapshot(room.githubUsername!, room.githubRepo!).then((snap) => {
        if (!cancelled) setRepoSnap(snap);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [room]);

  useEffect(() => {
    if ((!friendsOpen && !mapOpen) || !isSupabaseConfigured || !userId) return;
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
  }, [friendsOpen, mapOpen, userId]);

  useEffect(() => {
    if (!eventsOpen || !isSupabaseConfigured) return;
    void createClient()
      .from("events")
      .select("id, title, hub, starts_at, created_by")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(8)
      .then(({ data }) => setEvents((data as UiEvent[]) ?? []));
  }, [eventsOpen]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- leaving a room must reset voice state */
    if (room) return;
    voiceRef.current?.leave();
    voiceRef.current = null;
    setVoiceJoined(false);
    setVoiceMuted(false);
    setVoiceParticipants([]);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [room]);

  const openDialogFromHud = () => {
    if (!nearDoor || dialog) return;
    setDialog(nearDoor);
    setNoteSent(false);
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

  const leaveNote = async (note: string) => {
    if (!dialog?.roomId) return;
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("sign in");
      const { error } = await supabase.from("door_notes").insert({
        room_id: dialog.roomId,
        author_id: user.id,
        message: note.trim().slice(0, 200),
      });
      if (error) throw error;
      setNoteSent(true);
    } catch {
      emitGame("toast", "Could not leave the note — try again.");
    }
  };

  const respondKnock = async (knock: PendingKnock, accepted: boolean) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("knocks")
      .update({ status: accepted ? "accepted" : "declined" })
      .eq("id", knock.id);
    if (error) return;
    emitGame("knock:respond", {
      knockId: knock.id,
      roomId: myRoom?.roomId ?? "",
      visitorKey: knock.visitorId,
      accepted,
    });
    setKnocks((current) => current.filter((k) => k.id !== knock.id));
  };

  const sendChat = (content: string) => {
    const clean = content.trim().slice(0, 200);
    if (!clean) return;
    emitGame("chat:send", clean);
    setChat((current) => [...current.slice(-49), { username: playerName, content: clean, at: Date.now() }]);
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

  const inviteAll = () => {
    emitGame("come:send");
    setSaveNote("Invite sent — watch for visitors");
    setTimeout(() => setSaveNote(null), 3000);
  };

  const saveRoom = async () => {
    if (!myRoom) return;
    setSaving(true);
    setSaveNote(null);
    try {
      const supabase = createClient();
      const cleanActivity = pActivity.trim().slice(0, 60);
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          status: pStatus,
          activity_text: cleanActivity,
          avatar: pCharacter,
          github_username: ghUser.trim() || null,
          github_repo: ghRepo.trim() || null,
        })
        .eq("id", myRoom.ownerId);
      if (profileErr) throw profileErr;
      const { error: roomErr } = await supabase
        .from("rooms")
        .update({ door_state: pDoor, theme: pTheme, visibility: isPublic ? "public" : "friends" })
        .eq("id", myRoom.roomId);
      if (roomErr) throw roomErr;
      emitGame("room:update", {
        roomId: myRoom.roomId,
        doorState: pDoor,
        activity: cleanActivity,
        username: playerName,
      });
      setSaveNote("Saved — your door is live");
    } catch (err) {
      setSaveNote(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveNote(null), 3000);
    }
  };

  const doSearch = async () => {
    const clean = searchQuery.trim().toLowerCase();
    if (clean.length < 2 || !isSupabaseConfigured) return;
    setSearching(true);
    try {
      const { data } = await createClient()
        .from("profiles")
        .select("id, username")
        .ilike("username", `%${clean}%`)
        .neq("id", userId ?? "")
        .limit(5);
      setSearchResults((data as Array<{ id: string; username: string }>) ?? []);
    } finally {
      setSearching(false);
    }
  };

  const addFriend = async (id: string) => {
    await createClient().from("friendships").insert({ requester_id: userId, addressee_id: id });
    setSearchResults((current) => current?.filter((r) => r.id !== id) ?? null);
    emitGame("toast", "Friend request sent");
  };

  const respondFriend = async (friendshipId: string, accept: boolean) => {
    await createClient()
      .from("friendships")
      .update({ status: accept ? "accepted" : "declined" })
      .eq("id", friendshipId);
  };

  const removeFriend = async (friendUserId: string) => {
    await createClient()
      .from("friendships")
      .delete()
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${friendUserId}),and(requester_id.eq.${friendUserId},addressee_id.eq.${userId})`,
      );
    setFriendList((current) => current.filter((f) => f.userId !== friendUserId));
  };

  const friendAction = (friendUserId: string, mode: "join" | "visit" | "knock") => {
    const friend = friendList.find((f) => f.userId === friendUserId);
    if (!friend) return;
    const onlineHub = onlineHubs.get(friend.userId);
    if (mode === "join" && onlineHub) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload resets the game between hubs
      window.location.assign(`/world?hub=${onlineHub}`);
      return;
    }
    if (friend.roomId) {
      emitGame("friend:goknock", { roomId: friend.roomId });
      setFriendsOpen(false);
    } else {
      emitGame("toast", `${friend.username} is offline — leave a note at their door.`);
    }
  };

  const createEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.when) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("events")
      .insert({
        title: eventForm.title.trim(),
        hub: eventForm.hubId,
        starts_at: new Date(eventForm.when).toISOString(),
        created_by: userId,
      })
      .select("id, title, hub, starts_at, created_by")
      .single();
    if (!error && data) setEvents((current) => [...current, data as UiEvent]);
    setEventForm({ title: "", hubId: hub, when: "" });
    emitGame("toast", "Event posted to the board");
  };

  const joinVoice = async () => {
    if (!room || !userId) return;
    setVoiceError(null);
    const supabase = createClient();
    const service = new VoiceService(supabase, room.roomId, { key: userId, username: playerName }, {
      onParticipants: setVoiceParticipants,
      onError: (message) => {
        setVoiceError(message);
        setVoiceJoined(false);
      },
    });
    voiceRef.current = service;
    await service.join();
    setVoiceJoined(true);
  };

  const leaveVoice = () => {
    voiceRef.current?.leave();
    voiceRef.current = null;
    setVoiceJoined(false);
    setVoiceMuted(false);
    setVoiceParticipants([]);
  };

  const travel = (hubId: string) => {
    const visited = new Set(passport.visited);
    visited.add(hubId);
    localStorage.setItem("knock-passport-visited", JSON.stringify([...visited]));
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload resets the game between hubs
      window.location.assign(`/world?hub=${hubId}`);
  };

  const promptTitle = nearDoor
    ? nearDoor.state === "focus"
      ? `${nearDoor.buildingName.toUpperCase()} IS IN FOCUS MODE`
      : `KNOCK ON ${nearDoor.owner.toUpperCase()}'S DOOR?`
    : "";
  const promptSubtitle = nearDoor ? `${DOOR_STATE_LABELS[nearDoor.state]} · press E or click` : "";

  const hubCards = Object.entries(HUBS).map(([id, h]) => ({
    id,
    name: h.name.replace(" Hub", ""),
    accent: ACCENT_NAMES[h.accent] ?? "violet",
    onlineCount: [...onlineHubs.values()].filter((v) => v === id).length,
  }));

  return (
    <div className="fixed inset-0 overflow-hidden bg-zinc-950">
      <div ref={containerRef} className="absolute inset-0" data-testid="game-root" />
      {/* ambient grade: warm sunlight tint + soft vignette for painterly cohesion */}
      <div className="pointer-events-none absolute inset-0 z-[5] bg-amber-200 opacity-[0.04]" />
      <div className="pointer-events-none absolute inset-0 z-[5] bg-[radial-gradient(ellipse_at_center,transparent_58%,rgba(8,12,6,0.38)_100%)]" />

      <PlayerBadge username={playerName} status={myRoom?.status ?? "available"} activity={activity} />
      <ControlsHint touch={touchDevice} />
      {toast && <Toast key={toast} text={toast} />}

      {nearDoor && !dialog && !room && (
        <InteractionPrompt title={promptTitle} subtitle={promptSubtitle} onActivate={openDialogFromHud} />
      )}

      {dialog && (
        <KnockDialog
          ownerName={dialog.owner}
          activity={dialog.activity}
          doorState={dialog.state}
          reasons={[...KNOCK_REASONS]}
          onSend={sendKnock}
          onCancel={closeDialog}
          showNote={Boolean(dialog.roomId && dialog.ownerOnline === false && userId)}
          onLeaveNote={(note) => void leaveNote(note)}
          noteSent={noteSent}
        />
      )}

      {userId && myRoom && !room && (
        <RoomPanel
          username={playerName}
          status={pStatus}
          onStatusChange={setPStatus}
          activity={pActivity}
          onActivityChange={setPActivity}
          doorState={pDoor}
          onDoorStateChange={setPDoor}
          character={pCharacter}
          onCharacterChange={setPCharacter}
          theme={pTheme}
          onThemeChange={setPTheme}
          githubUser={ghUser}
          githubRepo={ghRepo}
          onGithubChange={(u, r) => {
            setGhUser(u);
            setGhRepo(r);
          }}
          isPublic={isPublic}
          onPublicChange={setIsPublic}
          onInviteAll={inviteAll}
          onSave={() => void saveRoom()}
          saving={saving}
          note={saveNote}
        />
      )}

      {userId && myRoom && !room && notes.length > 0 && (
        <DoorNoteCards
          notes={notes.map((n) => ({ id: n.id, authorName: n.authorName, message: n.message }))}
          onDismiss={(id) => {
            const note = notes.find((n) => n.id === id);
            if (note) dismissNote(note);
          }}
        />
      )}

      {userId && myRoom && !room && knocks.length > 0 && (
        <div className="fixed inset-x-0 top-6 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
          {knocks.map((knock) => (
            <div key={knock.id} className="pointer-events-auto w-full max-w-sm">
              <IncomingKnockCard
                visitorName={knock.visitorName}
                reason={knock.reason}
                message={knock.message}
                onAccept={() => void respondKnock(knock, true)}
                onDecline={() => void respondKnock(knock, false)}
              />
            </div>
          ))}
        </div>
      )}

      {room && (
        <>
          <RoomChatPanel
            ownerName={room.ownerName}
            messages={chat}
            selfName={playerName}
            canChat={Boolean(userId)}
            onSend={sendChat}
            onInputFocusChange={(focused) => emitGame("chat:focus", focused)}
          />
          {repoSnap && (
            <GitHubCard
              repo={repoSnap.repo}
              latestCommit={repoSnap.latestCommitMessage}
              commitTime={repoSnap.latestCommitTime}
            />
          )}
          {userId && (
            <>
              <VoiceBar
                joined={voiceJoined}
                muted={voiceMuted}
                error={voiceError}
                participants={voiceParticipants.map((p) => ({
                  username: p.username,
                  speaking: p.speaking,
                  isSelf: p.key === userId,
                }))}
                onJoin={() => void joinVoice()}
                onLeave={leaveVoice}
                onToggleMute={() => {
                  const next = !voiceMuted;
                  setVoiceMuted(next);
                  voiceRef.current?.setMuted(next);
                }}
              />
              {voiceJoined &&
                voiceParticipants
                  .filter((p) => p.key !== userId)
                  .map((p) => <VoiceSink key={p.key} peerKey={p.key} service={voiceRef} />)}
            </>
          )}
        </>
      )}

      {nearPortal && !mapOpen && !room && !dialog && (
        <PortalPrompt onOpen={() => emitGame("worldmap:open")} />
      )}

      {mapOpen && (
        <WorldMapOverlay
          currentHub={hub}
          hubs={hubCards}
          publicRooms={publicRooms}
          passport={{
            countriesVisited: passport.visited.length,
            countriesTotal: Object.keys(HUBS).length,
            roomsEntered: passport.rooms,
            knocksSent: passport.knocks,
          }}
          onTravel={travel}
          onClose={() => setMapOpen(false)}
        />
      )}

      {userId && !room && !mapOpen && (
        <button
          type="button"
          onClick={() => setFriendsOpen((v) => !v)}
          className="fixed left-4 top-[76px] z-40 rounded-t-lg border border-zinc-700/50 bg-zinc-800/80 px-3 py-2 font-pixel text-xs tracking-wider text-zinc-400 backdrop-blur-md hover:text-zinc-100"
        >
          FRIENDS{friendRequests.length > 0 ? " ●" : ""}
        </button>
      )}
      {userId && friendsOpen && !room && (
        <FriendsPanel
          friends={friendList.map((f) => ({
            userId: f.userId,
            username: f.username,
            status: f.status,
            onlineHub: onlineHubs.get(f.userId) ?? null,
            hasRoom: Boolean(f.roomId),
          }))}
          requests={friendRequests.map((r) => ({ friendshipId: r.friendshipId, username: r.username }))}
          searchResults={searchResults}
          searching={searching}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSearch={() => void doSearch()}
          onAddFriend={(id) => void addFriend(id)}
          onRespond={(id, accept) => void respondFriend(id, accept)}
          onJoin={(uid) => friendAction(uid, "join")}
          onVisit={(uid) => friendAction(uid, "visit")}
          onKnock={(uid) => friendAction(uid, "knock")}
          onRemove={(uid) => void removeFriend(uid)}
          onClose={() => setFriendsOpen(false)}
        />
      )}

      {userId && !room && !mapOpen && !friendsOpen && (
        <button
          type="button"
          onClick={() => setEventsOpen((v) => !v)}
          className="fixed left-4 top-[116px] z-40 rounded-t-lg border border-zinc-700/50 bg-zinc-800/80 px-3 py-2 font-pixel text-xs tracking-wider text-violet-300 backdrop-blur-md hover:text-violet-100"
        >
          EVENTS
        </button>
      )}
      {userId && eventsOpen && !room && (
        <EventBoard
          events={events.map((e) => ({
            id: e.id,
            title: e.title,
            hubName: HUBS[e.hub as keyof typeof HUBS]?.name.replace(" Hub", "") ?? e.hub,
            hubId: e.hub,
            startsAt: e.starts_at,
            isMine: e.created_by === userId,
          }))}
          hubs={Object.entries(HUBS).map(([id, h]) => ({ id, name: h.name.replace(" Hub", "") }))}
          title={eventForm.title}
          onTitleChange={(t) => setEventForm((f) => ({ ...f, title: t }))}
          hubId={eventForm.hubId}
          onHubChange={(h) => setEventForm((f) => ({ ...f, hubId: h }))}
          when={eventForm.when}
          onWhenChange={(w) => setEventForm((f) => ({ ...f, when: w }))}
          onCreate={() => void createEvent()}
          creating={false}
          onGoToHub={travel}
          onRemove={(id) => {
            void createClient().from("events").delete().eq("id", id);
            setEvents((current) => current.filter((e) => e.id !== id));
          }}
          onClose={() => setEventsOpen(false)}
        />
      )}

      {invite && !room && !mapOpen && (
        <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2">
          <div className="rounded-xl border border-amber-500/50 bg-zinc-900/95 px-4 py-3 shadow-xl backdrop-blur-sm">
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
        </div>
      )}

      <TouchControls visible={touchDevice && !dialog && !mapOpen} />
    </div>
  );
}

/** Plays one remote peer's voice stream through a hidden audio element. */
function VoiceSink({
  peerKey,
  service,
}: {
  peerKey: string;
  service: React.RefObject<VoiceService | null>;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [, force] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    const stream = service.current?.getStream(peerKey);
    if (ref.current && stream && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
      void ref.current.play().catch(() => {});
    }
  }, [peerKey, service]);
  return <audio ref={ref} autoPlay className="hidden" />;
}
