// PortalPrompt.tsx
import React from 'react';

interface PortalPromptProps {
  onOpen: () => void;
}

export const PortalPrompt: React.FC<PortalPromptProps> = ({ onOpen }) => {
  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
      <button
        onClick={onOpen}
        aria-label="Open World Portal. Press E or click to travel."
        className="group relative flex items-center gap-3 bg-zinc-900/95 backdrop-blur-md border border-violet-500/40 rounded-xl px-5 py-3 shadow-[0_0_20px_rgba(139,92,246,0.15)] hover:border-violet-400/60 hover:bg-zinc-800/95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
      >
        {/* Swirl Accent */}
        <div className="relative w-8 h-8 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-400 border-r-violet-600 animate-[spin-slow_3s_linear_infinite]" />
          <div className="absolute inset-1 rounded-full border-2 border-transparent border-b-violet-300 border-l-violet-500 animate-[spin-reverse_2s_linear_infinite]" />
          <div className="w-2 h-2 bg-violet-400 rounded-full shadow-[0_0_10px_rgba(167,139,250,0.8)]" />
        </div>

        {/* Text Content */}
        <div className="flex flex-col items-start text-left">
          <span className="font-pixel text-sm text-violet-300 leading-tight tracking-wider group-hover:text-violet-200 transition-colors">
            WORLD PORTAL
          </span>
          <span className="text-xs text-zinc-400 leading-tight mt-0.5">press E or click to travel</span>
        </div>

        {/* Subtle Glow Effect behind button */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </button>

      <style jsx>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
};