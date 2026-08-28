// IncomingKnockCard.tsx
import React from 'react';

interface IncomingKnockCardProps {
  visitorName: string;
  reason: string;
  message: string;
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingKnockCard: React.FC<IncomingKnockCardProps> = ({
  visitorName,
  reason,
  message,
  onAccept,
  onDecline,
}) => {
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
      <div className="relative bg-zinc-900/95 backdrop-blur-md border border-yellow-500/30 rounded-xl shadow-[0_0_30px_rgba(234,179,8,0.15)] overflow-hidden animate-[slide-down-fade_0.4s_ease-out]">
        
        {/* Ripple Animation Container */}
        <div className="absolute top-2 right-2 w-12 h-12 pointer-events-none">
          <div className="absolute inset-0 flex items-center justify-center">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="absolute rounded-full border border-yellow-400/60 animate-[ripple-expand_2s_infinite]"
                style={{
                  width: `${12 + i * 10}px`,
                  height: `${12 + i * 10}px`,
                  animationDelay: `${i * 0.3}s`,
                  opacity: 1 - (i * 0.2)
                }}
              />
            ))}
          </div>
          {/* Center Dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
          </div>
        </div>

        <div className="p-4 pl-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="mt-0.5">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-pixel text-sm text-yellow-300 leading-tight">
                KNOCK KNOCK
              </h3>
              <p className="text-sm text-zinc-200 font-medium mt-1">
                <span className="text-zinc-400">—</span> {visitorName} is outside
              </p>
            </div>
          </div>

          <div className="mb-4">
            <div className="inline-block px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-400 font-mono mb-2">
              {reason}
            </div>
            {message && (
              <p className="text-xs text-zinc-400 italic border-l-2 border-zinc-700 pl-2">
                {String.fromCharCode(34)}{message}{String.fromCharCode(34)}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onDecline}
              className="flex-1 px-3 py-2 text-sm font-medium text-zinc-400 bg-transparent border border-zinc-700 rounded-lg hover:bg-zinc-800 hover:text-zinc-200 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
            >
              Not Now
            </button>
            <button
              onClick={onAccept}
              className="flex-1 px-3 py-2 text-sm font-bold text-white bg-emerald-600 border border-emerald-500 rounded-lg hover:bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] hover:shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all duration-200 transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              Let In
            </button>
          </div>
        </div>
      </div>

      
    </div>
  );
};