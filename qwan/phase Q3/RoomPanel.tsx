// RoomPanel.tsx
import React, { useState } from 'react';

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
}

const STATUSES = ['available', 'working', 'focus', 'away'];
const DOOR_STATES = [
  { id: 'open', label: 'Open', color: 'emerald' },
  { id: 'knock', label: 'Knock', color: 'yellow' },
  { id: 'focus', label: 'Focus', color: 'red' },
] as const;
const CHARACTERS = ['builder', 'noble', 'mage', 'traveler'];
const THEMES = [
  { id: 'warm', label: 'Warm', swatch: 'bg-orange-500' },
  { id: 'cool', label: 'Cool', swatch: 'bg-blue-500' },
  { id: 'mossy', label: 'Mossy', swatch: 'bg-emerald-600' },
] as const;

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
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleGithubUserChange = (val: string) => {
    onGithubChange(val, githubRepo);
  };

  const handleGithubRepoChange = (val: string) => {
    onGithubChange(githubUser, val);
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end pointer-events-none">
      {/* Toggle Tab */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close Room Panel" : "Open Room Panel"}
        className={`pointer-events-auto px-3 py-2 rounded-t-lg font-pixel text-xs tracking-wider transition-all duration-300 border border-b-0 ${
          isOpen 
            ? 'bg-zinc-900 border-zinc-700 text-zinc-100 shadow-[0_-2px_10px_rgba(0,0,0,0.5)]' 
            : 'bg-zinc-800/80 backdrop-blur-md border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
        }`}
      >
        YOUR ROOM
      </button>

      {/* Panel Content */}
      <div
        className={`pointer-events-auto w-72 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-b-xl shadow-2xl overflow-hidden transition-all duration-300 ease-in-out origin-top-right ${
          isOpen ? 'opacity-100 scale-y-100 max-h-[80vh]' : 'opacity-0 scale-y-0 max-h-0'
        }`}
      >
        <div className="p-4 space-y-5 overflow-y-auto max-h-[calc(80vh-40px)] scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          
          {/* Header Info */}
          <div className="pb-3 border-b border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-200 truncate">{username}</h3>
            {note && (
              <p className="text-xs text-violet-400 mt-1 italic truncate">"{note}"</p>
            )}
          </div>

          {/* Status Section */}
          <section>
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">
              Status
            </label>
            <div className="grid grid-cols-4 gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  className={`py-1.5 px-1 rounded text-[10px] font-medium capitalize transition-colors ${
                    status === s
                      ? 'bg-zinc-700 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          {/* Activity Section */}
          <section>
            <label htmlFor="activity-input" className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">
              Working On
            </label>
            <input
              id="activity-input"
              type="text"
              value={activity}
              onChange={(e) => onActivityChange(e.target.value)}
              placeholder="e.g. Building a castle"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors"
            />
          </section>

          {/* Door State Section */}
          <section>
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">
              Door
            </label>
            <div className="flex gap-2">
              {DOOR_STATES.map((ds) => {
                const isActive = doorState === ds.id;
                let activeClasses = '';
                if (ds.color === 'emerald') activeClasses = 'bg-emerald-600 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]';
                if (ds.color === 'yellow') activeClasses = 'bg-yellow-600 border-yellow-500 text-white shadow-[0_0_10px_rgba(234,179,8,0.3)]';
                if (ds.color === 'red') activeClasses = 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)]';

                return (
                  <button
                    key={ds.id}
                    onClick={() => onDoorStateChange(ds.id)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 ${
                      isActive 
                        ? activeClasses
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    {ds.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Character Section */}
          <section>
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">
              Character
            </label>
            <div className="flex flex-wrap gap-2">
              {CHARACTERS.map((c) => (
                <button
                  key={c}
                  onClick={() => onCharacterChange(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize border transition-all ${
                    character === c
                      ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </section>

          {/* Theme Section */}
          <section>
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">
              Room Theme
            </label>
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onThemeChange(t.id)}
                  className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                    theme === t.id
                      ? 'bg-zinc-800 border-zinc-500 ring-1 ring-zinc-500'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full ${t.swatch} shadow-inner`} />
                  <span className={`text-[10px] font-medium ${theme === t.id ? 'text-zinc-200' : 'text-zinc-500'}`}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* GitHub Section */}
          <section>
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">
              GitHub Link
            </label>
            <div className="space-y-2">
              <input
                type="text"
                value={githubUser}
                onChange={(e) => handleGithubUserChange(e.target.value)}
                placeholder="username"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500"
              />
              <input
                type="text"
                value={githubRepo}
                onChange={(e) => handleGithubRepoChange(e.target.value)}
                placeholder="repository-name"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500"
              />
            </div>
          </section>

          {/* Public Toggle */}
          <section className="flex items-center justify-between py-2 border-t border-zinc-800">
            <span className="text-xs text-zinc-400">List publicly</span>
            <button
              role="switch"
              aria-checked={isPublic}
              onClick={() => onPublicChange(!isPublic)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
                isPublic ? 'bg-emerald-600' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                  isPublic ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </section>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            <button
              onClick={onInviteAll}
              className="w-full py-2 px-3 bg-transparent border border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:border-amber-400 rounded-lg text-xs font-bold uppercase tracking-wide transition-all duration-200"
            >
              Come here — invite everyone
            </button>
            
            <button
              onClick={onSave}
              disabled={saving}
              className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-all duration-200 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};