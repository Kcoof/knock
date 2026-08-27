// EventBoard.tsx
import React from 'react';

interface Event {
  id: string;
  title: string;
  hubName: string;
  hubId: string;
  startsAt: string; // ISO string or similar
  isMine: boolean;
}

interface HubOption {
  id: string;
  name: string;
}

interface EventBoardProps {
  events: Event[];
  hubs: HubOption[];
  title: string;
  onTitleChange: (t: string) => void;
  hubId: string;
  onHubChange: (h: string) => void;
  when: string;
  onWhenChange: (w: string) => void;
  onCreate: () => void;
  creating: boolean;
  onGoToHub: (hubId: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

const formatEventDate = (dateStr: string): { day: string; time: string } => {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return { day: 'Invalid', time: '--:--' };
    
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false };
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
    
    const dayPart = parts.find(p => p.type === 'weekday')?.value || '';
    const hourPart = parts.find(p => p.type === 'hour')?.value || '';
    const minutePart = parts.find(p => p.type === 'minute')?.value || '';
    
    return {
      day: dayPart,
      time: `${hourPart}:${minutePart}`
    };
  } catch {
    return { day: '?', time: '--:--' };
  }
};

export const EventBoard: React.FC<EventBoardProps> = ({
  events,
  hubs,
  title,
  onTitleChange,
  hubId,
  onHubChange,
  when,
  onWhenChange,
  onCreate,
  creating,
  onGoToHub,
  onRemove,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 pb-8 px-4 pointer-events-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm pointer-events-auto transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-zinc-900 border border-violet-500/30 rounded-2xl shadow-[0_0_40px_rgba(139,92,246,0.15)] overflow-hidden flex flex-col max-h-[80vh] pointer-events-auto animate-[pop-down_0.3s_ease-out]">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
          <h2 className="font-pixel text-lg text-violet-400 tracking-widest drop-shadow-[0_0_8px_rgba(167,139,250,0.5)]">
            EVENT BOARD
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded-md hover:bg-zinc-800"
            aria-label="Close event board"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Events List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          {events.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-zinc-600 text-sm">No scheduled events.</p>
              <p className="text-zinc-700 text-xs mt-1">Be the first to host one!</p>
            </div>
          ) : (
            events.map((event) => {
              const { day, time } = formatEventDate(event.startsAt);
              return (
                <div key={event.id} className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-3 flex items-center justify-between group hover:border-violet-500/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-200 truncate">{event.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 bg-violet-500/10 text-violet-300 rounded border border-violet-500/20">
                        {event.hubName}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {day} {time}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-2">
                    <button
                      onClick={() => onGoToHub(event.hubId)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-violet-600 text-zinc-300 hover:text-white text-xs font-bold rounded-lg transition-colors border border-zinc-700 hover:border-violet-500"
                    >
                      Go to Hub
                    </button>
                    {event.isMine && (
                      <button
                        onClick={() => onRemove(event.id)}
                        className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        aria-label={`Delete event ${event.title}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Create Form */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/80">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Host an Event</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Event Title"
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
            />
            <select
              value={hubId}
              onChange={(e) => onHubChange(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 appearance-none cursor-pointer"
            >
              <option value="" disabled>Select Hub</option>
              {hubs.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => onWhenChange(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 col-span-1 sm:col-span-2"
            />
            <button
              onClick={onCreate}
              disabled={creating || !title || !hubId || !when}
              className="sm:col-span-2 w-full py-2 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all duration-200 shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:shadow-[0_0_20px_rgba(139,92,246,0.4)]"
            >
              {creating ? 'Posting...' : 'Post Event'}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pop-down {
          0% { opacity: 0; transform: translateY(-20px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};