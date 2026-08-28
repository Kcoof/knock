// WorldMapOverlay.tsx
import React from 'react';

interface Hub {
  id: string;
  name: string;
  accent: string; // e.g., "emerald", "blue", "amber"
  onlineCount: number;
}

interface PublicRoom {
  id: string;
  name: string;
  doorState: string; // "open", "knock", "focus"
}

interface PassportStats {
  countriesVisited: number;
  countriesTotal: number;
  roomsEntered: number;
  knocksSent: number;
}

interface WorldMapOverlayProps {
  currentHub: string;
  hubs: Hub[];
  publicRooms: PublicRoom[];
  passport: PassportStats;
  onTravel: (hubId: string) => void;
  onClose: () => void;
}

const getAccentClasses = (accent: string) => {
  switch (accent) {
    case 'emerald': return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-500' };
    case 'blue': return { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', dot: 'bg-blue-500' };
    case 'amber': return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-500' };
    case 'violet': return { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30', dot: 'bg-violet-500' };
    case 'pink': return { text: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30', dot: 'bg-pink-500' };
    case 'red': return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-500' };
    default: return { text: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', dot: 'bg-zinc-500' };
  }
};

const getDoorDotClass = (state: string) => {
  switch (state) {
    case 'open': return 'bg-emerald-500';
    case 'knock': return 'bg-yellow-500';
    case 'focus': return 'bg-red-500';
    default: return 'bg-zinc-500';
  }
};

export const WorldMapOverlay: React.FC<WorldMapOverlayProps> = ({
  currentHub,
  hubs,
  publicRooms,
  passport,
  onTravel,
  onClose,
}) => {
  const progress = Math.min((passport.countriesVisited / passport.countriesTotal) * 100, 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-violet-500/30 rounded-2xl shadow-[0_0_40px_rgba(139,92,246,0.15)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Starfield/Dotted Map Background Texture */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20" 
          style={{ 
            backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', 
            backgroundSize: '20px 20px' 
          }} 
        />

        {/* Header */}
        <div className="p-6 pb-4 border-b border-zinc-800 flex items-center justify-between relative z-10">
          <h2 className="font-pixel text-2xl text-violet-400 tracking-widest drop-shadow-[0_0_8px_rgba(167,139,250,0.5)]">
            KNOCK WORLD
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors p-2 rounded-lg hover:bg-zinc-800"
            aria-label="Close world map"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 space-y-8 relative z-10 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          
          {/* Hubs Grid */}
          <section>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Hubs</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {hubs.map((hub) => {
                const isCurrent = hub.id === currentHub;
                const accentStyles = getAccentClasses(hub.accent);
                
                return (
                  <div 
                    key={hub.id} 
                    className={`relative p-4 rounded-xl border transition-all duration-200 ${
                      isCurrent 
                        ? `${accentStyles.bg} ${accentStyles.border} ring-1 ring-white/10` 
                        : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-bold text-sm ${isCurrent ? accentStyles.text : 'text-zinc-200'}`}>
                        {hub.name}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-medium">
                          You are here
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mb-4">
                      <div className={`w-2 h-2 rounded-full ${accentStyles.dot} ${hub.onlineCount > 0 ? 'animate-pulse' : 'opacity-50'}`} />
                      <span className="text-xs text-zinc-400">
                        {hub.onlineCount} builder{hub.onlineCount !== 1 ? 's' : ''} online
                      </span>
                    </div>

                    {!isCurrent && (
                      <button
                        onClick={() => onTravel(hub.id)}
                        className="w-full py-1.5 px-3 bg-zinc-800 hover:bg-violet-600 text-zinc-300 hover:text-white text-xs font-bold rounded-lg transition-colors duration-200 border border-zinc-700 hover:border-violet-500"
                      >
                        Travel
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Bottom Section: Rooms & Passport */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Open Rooms */}
            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Nearby Rooms</h3>
              <div className="space-y-2">
                {publicRooms.length === 0 ? (
                  <p className="text-sm text-zinc-600 italic">No open rooms nearby.</p>
                ) : (
                  publicRooms.map((room) => (
                    <div key={room.id} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-950/30 border border-zinc-800/50">
                      <div className={`w-2 h-2 rounded-full ${getDoorDotClass(room.doorState)}`} />
                      <span className="text-sm text-zinc-300 truncate">{room.name}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Passport Stats */}
            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Passport</h3>
              <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 space-y-4">
                
                {/* Countries Progress */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">Countries Visited</span>
                    <span className="text-violet-400 font-mono">{passport.countriesVisited}/{passport.countriesTotal}</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-500 ease-out" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Other Stats */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="text-center">
                    <p className="text-lg font-bold text-zinc-200 font-mono">{passport.roomsEntered}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Rooms Entered</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-zinc-200 font-mono">{passport.knocksSent}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Knocks Sent</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 flex justify-end relative z-10">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-sm font-bold rounded-lg transition-colors border border-zinc-700"
          >
            Stay Here
          </button>
        </div>
      </div>
    </div>
  );
};