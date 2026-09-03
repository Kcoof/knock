// RoomPanel.tsx
import React, { useEffect, useRef, useState } from "react";

interface RoomPanelProps {
  username: string;
  status: string;
  onStatusChange: (s: string) => void;
  activity: string;
  onActivityChange: (a: string) => void;
  doorState: "open" | "knock" | "focus";
  onDoorStateChange: (d: "open" | "knock" | "focus") => void;
  character: string;
  onCharacterChange: (c: string) => void;
  theme: string;
  onThemeChange: (t: string) => void;
  githubUser: string;
  githubRepo: string;
  onGithubChange: (user: string, repo: string) => void;
  isPublic: boolean;
  onPublicChange: (v: boolean) => void;
  onInviteAll: () => void;
  onSave: () => void;
  saving: boolean;
  note: string | null;
  /** Timestamp of the last successful save — clears the unsaved-changes dot. */
  savedAt?: number;
}

type DoorState = RoomPanelProps["doorState"];

const Icon: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

const GITHUB_MARK = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const STATUSES = [
  {
    id: "available",
    label: "Available",
    dot: "bg-emerald-400",
    selected: "bg-emerald-500/15 text-emerald-300",
  },
  {
    id: "working",
    label: "Working",
    dot: "bg-yellow-400",
    selected: "bg-yellow-500/15 text-yellow-300",
  },
  {
    id: "focus",
    label: "Focus",
    dot: "bg-red-400",
    selected: "bg-red-500/15 text-red-300",
  },
  {
    id: "away",
    label: "Away",
    dot: "bg-zinc-400",
    selected: "bg-zinc-500/20 text-zinc-200",
  },
] as const;

const DOOR_META: Record<DoorState, { label: string; dot: string; pill: string; card: string }> = {
  open: {
    label: "Open",
    dot: "bg-emerald-400",
    pill: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
    card:
      "border-emerald-500/60 bg-emerald-500/10 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.22)]",
  },
  knock: {
    label: "Knock",
    dot: "bg-yellow-400",
    pill: "border-yellow-500/30 bg-yellow-500/15 text-yellow-300",
    card:
      "border-yellow-500/60 bg-yellow-500/10 text-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.22)]",
  },
  focus: {
    label: "Focus",
    dot: "bg-red-400",
    pill: "border-red-500/30 bg-red-500/15 text-red-300",
    card: "border-red-500/60 bg-red-500/10 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.22)]",
  },
};

const DOOR_STATES: Array<{ id: DoorState; label: string; hint: string; icon: React.ReactNode }> = [
  {
    id: "open",
    label: "Open",
    hint: "anyone can walk in",
    icon: (
      <>
        <path d="M2.5 21.5h19" />
        <path d="M6.5 21.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v15.5" />
        <path d="M14 9l5.9 2.3a1 1 0 0 1 .6.9v9.3" />
        <circle cx="17" cy="14.4" r="0.65" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    id: "knock",
    label: "Knock",
    hint: "visitors knock first",
    icon: (
      <>
        <path d="M3 21.5h13.5" />
        <path d="M6.5 21.5V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v16" />
        <circle cx="11.4" cy="13.5" r="0.65" fill="currentColor" stroke="none" />
        <path strokeWidth={2.25} d="M16.2 9.3c1 1 1 2.9 0 3.9" />
        <path strokeWidth={2.25} d="M18.7 6.6c2.1 2.1 2.1 6.6 0 8.7" />
      </>
    ),
  },
  {
    id: "focus",
    label: "Focus",
    hint: "do not disturb",
    icon: (
      <>
        <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
        <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
        <path d="M12 14.5v2" />
      </>
    ),
  },
];

const CHARACTERS = ["builder", "noble", "mage", "traveler"] as const;

const THEMES = [
  { id: "warm", label: "Warm", tiles: ["#d97706", "#f59e0b", "#92400e"] },
  { id: "cool", label: "Cool", tiles: ["#3b82f6", "#7dd3fc", "#1e40af"] },
  { id: "mossy", label: "Mossy", tiles: ["#16a34a", "#84cc16", "#14532d"] },
] as const;

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-2 flex items-center gap-2">
    <span className="font-pixel text-[9px] uppercase tracking-[0.15em] text-zinc-500">{children}</span>
    <span className="h-px flex-1 bg-zinc-800" />
  </div>
);

/** Values as they are persisted (trimmed, capped) — used for the unsaved dot. */
interface Snapshot {
  status: string;
  activity: string;
  doorState: string;
  character: string;
  theme: string;
  githubUser: string;
  githubRepo: string;
  isPublic: boolean;
}

const isSameSnapshot = (a: Snapshot, b: Snapshot): boolean =>
  a.status === b.status &&
  a.activity === b.activity &&
  a.doorState === b.doorState &&
  a.character === b.character &&
  a.theme === b.theme &&
  a.githubUser === b.githubUser &&
  a.githubRepo === b.githubRepo &&
  a.isPublic === b.isPublic;

export const RoomPanel: React.FC<RoomPanelProps> = ({
  username,
  status,
  onStatusChange,
  activity,
  onActivityChange,
  doorState,
  onDoorStateChange,
  character,
  onCharacterChange,
  theme,
  onThemeChange,
  githubUser,
  githubRepo,
  onGithubChange,
  isPublic,
  onPublicChange,
  onInviteAll,
  onSave,
  saving,
  note,
  savedAt = 0,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const current: Snapshot = {
    status,
    activity: activity.trim().slice(0, 60),
    doorState,
    character,
    theme,
    githubUser: githubUser.trim(),
    githubRepo: githubRepo.trim(),
    isPublic,
  };
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  });
  const [saved, setSaved] = useState<Snapshot>(current);

  // After a successful save the parent bumps `savedAt` — re-baseline the dirty check.
  useEffect(() => {
    setSaved((prev) => (isSameSnapshot(prev, currentRef.current) ? prev : currentRef.current));
  }, [savedAt]);

  const dirty = !isSameSnapshot(saved, current);

  const statusMeta = STATUSES.find((s) => s.id === status);
  const ghUserClean = githubUser.trim();
  const ghRepoClean = githubRepo.trim();
  const ghReady = Boolean(ghUserClean && ghRepoClean);

  const noteTone = !note
    ? null
    : note.startsWith("Saved")
      ? "success"
      : note.startsWith("Invite")
        ? "invite"
        : "info";

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col items-end">
      {/* Toggle Tab */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="room-panel"
        aria-label={isOpen ? "Close Room Panel" : "Open Room Panel"}
        className={`pointer-events-auto flex items-center gap-2 rounded-t-xl border border-b-0 px-3.5 py-2 shadow-lg shadow-black/30 backdrop-blur-md transition-colors duration-200 ${
          isOpen
            ? "border-zinc-700 bg-zinc-900 text-zinc-100"
            : "border-zinc-700/60 bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800/90 hover:text-zinc-100"
        }`}
      >
        <span className={`h-2 w-2 shrink-0 rounded-[2px] ${DOOR_META[doorState].dot}`} aria-hidden="true" />
        <span className="font-pixel text-[10px] tracking-widest">YOUR ROOM</span>
        {dirty && !isOpen && (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" aria-label="Unsaved changes" />
        )}
        <Icon className={`h-3 w-3 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>
          <path d="M6.5 9.5l5.5 5.5 5.5-5.5" />
        </Icon>
      </button>

      {/* Panel */}
      <div
        id="room-panel"
        inert={!isOpen}
        className={`pointer-events-auto flex max-h-[80vh] w-[min(20rem,calc(100vw-2rem))] origin-top-right flex-col overflow-hidden rounded-b-xl border border-t-0 border-zinc-700 bg-zinc-900/95 shadow-2xl shadow-black/50 backdrop-blur-xl transition-[max-height,opacity,transform] duration-300 ease-in-out motion-reduce:transition-none ${
          isOpen ? "scale-y-100 opacity-100" : "max-h-0 scale-y-0 opacity-0"
        }`}
      >
        <div className="h-[3px] shrink-0 bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />

        {/* Profile preview — how neighbours see you */}
        <header className="relative shrink-0 overflow-hidden border-b border-zinc-800/80 px-4 pb-3 pt-3">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "4px 4px",
            }}
          />
          <div className="relative flex items-center gap-3">
            <div className="relative flex h-[52px] w-11 shrink-0 items-end justify-center overflow-hidden rounded-lg border border-zinc-700/50 bg-zinc-950/80">
              {/* eslint-disable-next-line @next/next/no-img-element -- pixel art needs crisp nearest-neighbor scaling */}
              <img
                src={`/sprites/chars/${character}.png`}
                alt={`${character} avatar`}
                width={32}
                height={64}
                style={{ imageRendering: "pixelated" }}
                className="h-11 w-auto"
              />
              <div className="absolute bottom-0 h-3.5 w-full bg-gradient-to-t from-zinc-800/90 to-transparent" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-pixel text-[11px] tracking-wider text-zinc-100">{username}</h3>
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-[2px] ${statusMeta?.dot ?? "bg-zinc-400"}`} />
                <span className="capitalize">{status}</span>
                {activity.trim() && (
                  <>
                    <span className="text-zinc-600">/</span>
                    <span className="truncate italic">{activity.trim()}</span>
                  </>
                )}
              </p>
            </div>
            <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold ${DOOR_META[doorState].pill}`}>
              {DOOR_META[doorState].label}
            </span>
          </div>
        </header>

        {/* Scrollable settings */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 [scrollbar-color:#3f3f46_transparent] [scrollbar-width:thin]">
          {/* Door */}
          <section aria-label="Door policy">
            <SectionLabel>Door</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {DOOR_STATES.map((ds) => {
                const active = doorState === ds.id;
                return (
                  <button
                    key={ds.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onDoorStateChange(ds.id)}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2.5 text-center transition-all duration-200 ${
                      active
                        ? DOOR_META[ds.id].card
                        : "border-zinc-800 bg-zinc-950/60 text-zinc-500 hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-300"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]">{ds.icon}</Icon>
                    <span className="text-[10px] font-bold uppercase tracking-wide">{ds.label}</span>
                    <span className={`text-[9px] leading-tight ${active ? "text-zinc-400" : "text-zinc-600"}`}>
                      {ds.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Status */}
          <section aria-label="Status">
            <SectionLabel>Status</SectionLabel>
            <div className="grid grid-cols-4 gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
              {STATUSES.map((s) => {
                const active = status === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onStatusChange(s.id)}
                    className={`flex flex-col items-center gap-1 rounded-md py-1.5 transition-colors duration-150 ${
                      active ? s.selected : "text-zinc-500 hover:bg-zinc-800/70 hover:text-zinc-300"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-[2px] ${s.dot} ${active ? "" : "opacity-60"}`} />
                    <span className="text-[9px] font-semibold uppercase tracking-wide">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Activity */}
          <section aria-label="Working on">
            <SectionLabel>Working On</SectionLabel>
            <input
              id="activity-input"
              type="text"
              value={activity}
              maxLength={60}
              onChange={(e) => onActivityChange(e.target.value)}
              placeholder="e.g. building a castle"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 transition-colors focus:border-violet-500/70 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
            />
            <div className="mt-1 flex justify-end">
              <span className={`font-mono text-[10px] ${activity.length >= 55 ? "text-amber-400" : "text-zinc-600"}`}>
                {activity.length}/60
              </span>
            </div>
          </section>

          {/* Character */}
          <section aria-label="Character">
            <SectionLabel>Character</SectionLabel>
            <div className="grid grid-cols-4 gap-2">
              {CHARACTERS.map((c) => {
                const active = character === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onCharacterChange(c)}
                    className={`group flex flex-col items-center gap-1 rounded-lg border py-2 transition-all duration-200 ${
                      active
                        ? "border-violet-500/70 bg-violet-500/10 shadow-[0_0_10px_rgba(139,92,246,0.2)]"
                        : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-600 hover:bg-zinc-900"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- pixel art needs crisp nearest-neighbor scaling */}
                    <img
                      src={`/sprites/chars/${c}.png`}
                      alt=""
                      width={32}
                      height={64}
                      style={{ imageRendering: "pixelated" }}
                      className={`h-10 w-auto transition-transform duration-200 ${active ? "-translate-y-0.5" : "group-hover:-translate-y-0.5"}`}
                    />
                    <span className={`text-[9px] font-semibold uppercase tracking-wide ${active ? "text-violet-300" : "text-zinc-500"}`}>
                      {c}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Theme */}
          <section aria-label="Room theme">
            <SectionLabel>Room Theme</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((t) => {
                const active = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onThemeChange(t.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all duration-200 ${
                      active
                        ? "border-violet-500/70 bg-violet-500/10 shadow-[0_0_10px_rgba(139,92,246,0.2)]"
                        : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-600 hover:bg-zinc-900"
                    }`}
                  >
                    <div className="grid h-8 w-full grid-cols-2 overflow-hidden rounded-md border border-black/40">
                      {[t.tiles[0], t.tiles[1], t.tiles[2], t.tiles[0]].map((c, i) => (
                        <div key={i} className="h-full w-full" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <span className={`text-[9px] font-semibold uppercase tracking-wide ${active ? "text-violet-300" : "text-zinc-500"}`}>
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* GitHub */}
          <section aria-label="GitHub link">
            <SectionLabel>GitHub</SectionLabel>
            <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-950 transition-colors focus-within:border-violet-500/70 focus-within:ring-1 focus-within:ring-violet-500/30">
              <span className="flex select-none items-center gap-1.5 border-r border-zinc-800 pl-2.5 pr-2 text-zinc-500">
                {GITHUB_MARK}
                <span className="font-mono text-[11px]">github.com</span>
              </span>
              <input
                type="text"
                value={githubUser}
                onChange={(e) => onGithubChange(e.target.value, githubRepo)}
                placeholder="username"
                aria-label="GitHub username"
                spellCheck={false}
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent px-2 py-1.5 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none"
              />
              <span className="text-zinc-600">/</span>
              <input
                type="text"
                value={githubRepo}
                onChange={(e) => onGithubChange(githubUser, e.target.value)}
                placeholder="repo"
                aria-label="GitHub repository"
                spellCheck={false}
                autoComplete="off"
                className="min-w-0 flex-[1.2] bg-transparent px-2 py-1.5 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none"
              />
            </div>
            {ghReady ? (
              <a
                href={`https://github.com/${ghUserClean}/${ghRepoClean}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 font-mono text-[11px] text-emerald-300 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/15"
              >
                <Icon className="h-3 w-3 shrink-0">
                  <path d="M14 4h6v6" />
                  <path d="M20 4L11 13" />
                  <path d="M19 13.5V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V7.5A1.5 1.5 0 0 1 6 6h5.5" />
                </Icon>
                <span className="truncate">
                  {ghUserClean}/{ghRepoClean}
                </span>
              </a>
            ) : (
              <p className="mt-2 text-[10px] leading-snug text-zinc-600">
                Your latest commits show on a card inside the room.
              </p>
            )}
          </section>

          {/* Visibility */}
          <section aria-label="Visibility">
            <SectionLabel>Visibility</SectionLabel>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="flex items-start gap-2.5">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500">
                  <circle cx="12" cy="12" r="8.5" />
                  <path d="M3.5 12h17" />
                  <path d="M12 3.5c2.3 2.4 2.3 14.6 0 17M12 3.5c-2.3 2.4-2.3 14.6 0 17" />
                </Icon>
                <div>
                  <p className="text-xs font-semibold text-zinc-300">List publicly</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">
                    {isPublic ? "Anyone in the world can find your room" : "Only accepted friends can find your room"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                aria-label="List room publicly"
                onClick={() => onPublicChange(!isPublic)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 ${
                  isPublic ? "border-emerald-400/50 bg-emerald-500/80" : "border-zinc-700 bg-zinc-800"
                }`}
              >
                <span
                  className={`absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    isPublic ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="shrink-0 space-y-2 border-t border-zinc-800 bg-zinc-950/60 px-4 py-3">
          {note && noteTone && (
            <div
              key={note}
              className={`flex animate-[fade-in-up_0.25s_ease-out] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${
                noteTone === "success"
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  : noteTone === "invite"
                    ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                    : "border-violet-500/25 bg-violet-500/10 text-violet-300"
              }`}
            >
              {noteTone === "success" && (
                <Icon className="h-3.5 w-3.5 shrink-0">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </Icon>
              )}
              {noteTone === "invite" && (
                <Icon className="h-3.5 w-3.5 shrink-0">
                  <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5H3.5S6 15 6 9" />
                  <path d="M10.4 20.5a1.9 1.9 0 0 0 3.2 0" />
                </Icon>
              )}
              {noteTone === "info" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />}
              <span className="truncate">{note}</span>
            </div>
          )}

          <button
            type="button"
            onClick={onInviteAll}
            title="Come here — invite everyone"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/50 bg-transparent px-3 py-2 font-pixel text-[10px] tracking-wider text-amber-400 transition-all duration-200 hover:border-amber-400 hover:bg-amber-500/10 active:scale-[0.98]"
          >
            <Icon className="h-3.5 w-3.5">
              <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5H3.5S6 15 6 9" />
              <path d="M10.4 20.5a1.9 1.9 0 0 0 3.2 0" />
            </Icon>
            INVITE EVERYONE
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 font-pixel text-[10px] tracking-wider text-white shadow-[0_0_18px_rgba(16,185,129,0.25)] transition-all duration-200 hover:bg-emerald-500 hover:shadow-[0_0_24px_rgba(16,185,129,0.45)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <>
                <Icon className="h-3.5 w-3.5 animate-spin">
                  <circle cx="12" cy="12" r="8.5" className="opacity-25" />
                  <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" className="opacity-90" />
                </Icon>
                SAVING...
              </>
            ) : (
              <>
                {dirty && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />}
                SAVE CHANGES
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
};
