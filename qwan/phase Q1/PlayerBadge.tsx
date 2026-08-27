// PlayerBadge.tsx
import React from 'react';

interface PlayerBadgeProps {
  username: string;
  status: string;
  activity: string;
}

const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'available':
      return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
    case 'working':
      return 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]';
    case 'focus':
      return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
    case 'away':
      return 'bg-zinc-500 shadow-[0_0_8px_rgba(113,113,122,0.6)]';
    default:
      return 'bg-zinc-500';
  }
};

export const PlayerBadge: React.FC<PlayerBadgeProps> = ({ username, status, activity }) => {
  const statusDotClass = getStatusColor(status);

  return (
    <div className="fixed top-4 left-4 z-50 pointer-events-none select-none">
      <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 min-w-[180px]">
        <div className={`w-3 h-3 rounded-full ${statusDotClass}`} aria-label={`Status: ${status}`} />
        <div className="flex flex-col justify-center">
          <span className="font-pixel text-sm text-zinc-100 leading-tight truncate max-w-[140px]">
            {username}
          </span>
          <span className="text-xs text-zinc-400 font-mono mt-0.5 truncate max-w-[140px]">
            {activity}
          </span>
        </div>
      </div>
    </div>
  );
};