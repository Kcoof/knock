// InteractionPrompt.tsx
import React from 'react';

interface InteractionPromptProps {
  title: string;
  subtitle: string;
  onActivate: () => void;
}

export const InteractionPrompt: React.FC<InteractionPromptProps> = ({ title, subtitle, onActivate }) => {
  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
      <button
        onClick={onActivate}
        aria-label={`${title}. Press E or click to activate.`}
        className="group relative flex items-center gap-3 bg-zinc-900/95 backdrop-blur-md border border-violet-500/40 rounded-xl px-5 py-3 shadow-[0_0_20px_rgba(139,92,246,0.15)] hover:border-violet-400/60 hover:bg-zinc-800/95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 animate-[pulse-border_2s_infinite]"
      >
        {/* Key Visual */}
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-zinc-800 border border-zinc-600 shadow-inner group-hover:border-violet-400/50 transition-colors">
          <span className="font-pixel text-xs text-violet-300 group-hover:text-violet-200 transition-colors">E</span>
        </div>

        {/* Text Content */}
        <div className="flex flex-col items-start text-left">
          <span className="text-sm font-bold text-zinc-100 leading-tight">{title}</span>
          <span className="text-xs text-zinc-400 leading-tight mt-0.5">{subtitle}</span>
        </div>

        {/* Subtle Glow Effect behind button */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </button>
      
      <style jsx>{`
        @keyframes pulse-border {
          0% { box-shadow: 0 0 10px rgba(139, 92, 246, 0.1); border-color: rgba(139, 92, 246, 0.3); }
          50% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.3); border-color: rgba(139, 92, 246, 0.6); }
          100% { box-shadow: 0 0 10px rgba(139, 92, 246, 0.1); border-color: rgba(139, 92, 246, 0.3); }
        }
      `}</style>
    </div>
  );
};