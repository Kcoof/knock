// VoiceBar.tsx
import React from 'react';

interface Participant {
  username: string;
  speaking: boolean;
  isSelf: boolean;
}

interface VoiceBarProps {
  joined: boolean;
  muted: boolean;
  error: string | null;
  participants: Participant[];
  onJoin: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
}

export const VoiceBar: React.FC<VoiceBarProps> = ({
  joined,
  muted,
  error,
  participants,
  onJoin,
  onLeave,
  onToggleMute,
}) => {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
      
      {error && (
        <div className="pointer-events-auto px-3 py-1 bg-red-950/80 border border-red-500/30 rounded-lg text-xs text-red-300 font-medium backdrop-blur-sm animate-[shake_0.3s_ease-in-out]">
          {error}
        </div>
      )}

      <div className="pointer-events-auto flex items-center gap-3 bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-full px-4 py-2 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        
        {!joined ? (
          <button
            onClick={onJoin}
            className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-full transition-all duration-200 shadow-[0_0_10px_rgba(16,185,129,0.3)] hover:shadow-[0_0_15px_rgba(16,185,129,0.5)] active:scale-95"
            aria-label="Join voice chat"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0-4H8m7 0h3m-4-7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Join Voice
          </button>
        ) : (
          <>
            {/* Mute Toggle */}
            <button
              onClick={onToggleMute}
              className={`p-2 rounded-full transition-colors duration-200 ${
                muted 
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
            >
              {muted ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.836 12 6v12c0 1.164-1.077 2.337-2.707 1.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0-4H8m7 0h3m-4-7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>

            {/* Participants List */}
            <div className="flex items-center gap-2 px-2 border-l border-r border-zinc-700/50 mx-1">
              {participants.length === 0 ? (
                <span className="text-xs text-zinc-500 italic">Alone...</span>
              ) : (
                participants.slice(0, 5).map((p) => (
                  <div key={p.username} className="flex items-center gap-1 group relative">
                    <div 
                      className={`w-2 h-2 rounded-full transition-all duration-150 ${
                        p.speaking 
                          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] scale-125' 
                          : 'bg-zinc-600'
                      }`}
                      aria-label={`${p.username} is ${p.speaking ? 'speaking' : 'silent'}`}
                    />
                    <span className={`text-xs font-medium hidden sm:block ${p.isSelf ? 'text-emerald-300' : 'text-zinc-400'}`}>
                      {p.username}
                    </span>
                    {/* Tooltip for small screens or overflow */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-[10px] text-zinc-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {p.username}
                    </div>
                  </div>
                ))
              )}
              {participants.length > 5 && (
                <span className="text-xs text-zinc-500">+{participants.length - 5}</span>
              )}
            </div>

            {/* Leave Button */}
            <button
              onClick={onLeave}
              className="p-2 rounded-full bg-zinc-800 text-zinc-400 hover:bg-red-500/20 hover:text-red-400 transition-colors duration-200"
              aria-label="Leave voice chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </>
        )}
      </div>

      
    </div>
  );
};