// FriendsPanel.tsx
import React, { useState } from 'react';

interface Friend {
  userId: string;
  username: string;
  status: string;
  onlineHub: string | null;
  hasRoom: boolean;
}

interface Request {
  friendshipId: string;
  username: string;
}

interface SearchResult {
  id: string;
  username: string;
}

interface FriendsPanelProps {
  friends: Friend[];
  requests: Request[];
  searchResults: SearchResult[] | null;
  searching: boolean;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSearch: () => void;
  onAddFriend: (id: string) => void;
  onRespond: (friendshipId: string, accept: boolean) => void;
  onJoin: (userId: string) => void;
  onVisit: (userId: string) => void;
  onKnock: (userId: string) => void;
  onRemove: (userId: string) => void;
  onClose: () => void;
}

const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'available': return 'bg-emerald-500';
    case 'working': return 'bg-yellow-400';
    case 'focus': return 'bg-red-500';
    case 'away': return 'bg-zinc-500';
    default: return 'bg-zinc-600';
  }
};

export const FriendsPanel: React.FC<FriendsPanelProps> = ({
  friends,
  requests,
  searchResults,
  searching,
  searchQuery,
  onSearchQueryChange,
  onSearch,
  onAddFriend,
  onRespond,
  onJoin,
  onVisit,
  onKnock,
  onRemove,
  onClose,
}) => {
  const [hoveredUser, setHoveredUser] = useState<string | null>(null);

  return (
    <div className="fixed top-0 left-0 h-full w-[320px] bg-zinc-900/95 backdrop-blur-xl border-r border-zinc-800 z-50 flex flex-col shadow-2xl animate-[slide-in-left_0.3s_ease-out]">
      
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <h2 className="font-pixel text-lg text-zinc-100 tracking-wide">FRIENDS</h2>
        <button
          onClick={onClose}
          aria-label="Close friends panel"
          className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors rounded-md hover:bg-zinc-800"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        
        {/* Requests Section */}
        {requests.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Incoming Requests
            </h3>
            <div className="space-y-2">
              {requests.map((req) => (
                <div key={req.friendshipId} className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-center justify-between group">
                  <span className="text-sm text-amber-200 font-medium truncate max-w-[140px]">{req.username}</span>
                  <div className="flex gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onRespond(req.friendshipId, true)}
                      className="p-1.5 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors"
                      aria-label={`Accept request from ${req.username}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </button>
                    <button
                      onClick={() => onRespond(req.friendshipId, false)}
                      className="p-1.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white transition-colors"
                      aria-label={`Reject request from ${req.username}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Search Section */}
        <section>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              placeholder="Search players..."
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-3 pr-10 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors"
            />
            <button
              onClick={onSearch}
              disabled={searching || !searchQuery.trim()}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-violet-400 disabled:opacity-50 transition-colors"
              aria-label="Search"
            >
              {searching ? (
                <div className="w-4 h-4 border-2 border-zinc-600 border-t-violet-400 rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              )}
            </button>
          </div>

          {searchResults && searchResults.length > 0 && (
            <div className="mt-2 space-y-1">
              {searchResults.map((res) => (
                <div key={res.id} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded hover:bg-zinc-800 transition-colors">
                  <span className="text-sm text-zinc-300 truncate">{res.username}</span>
                  <button
                    onClick={() => onAddFriend(res.id)}
                    className="text-xs px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded transition-colors"
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
          )}
          {searchResults && searchResults.length === 0 && searchQuery && !searching && (
             <p className="text-xs text-zinc-600 italic mt-2 text-center">No players found.</p>
          )}
        </section>

        {/* Friends List */}
        <section>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Friends ({friends.length})</h3>
          {friends.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-zinc-600 text-sm">It's lonely in here...</p>
              <p className="text-zinc-700 text-xs mt-1">Find some builders to knock on!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {friends.map((friend) => {
                const isOnline = friend.onlineHub !== null;
                return (
                  <div 
                    key={friend.userId}
                    onMouseEnter={() => setHoveredUser(friend.userId)}
                    onMouseLeave={() => setHoveredUser(null)}
                    className={`group relative flex items-center gap-3 p-2 rounded-lg transition-colors ${
                      hoveredUser === friend.userId ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                    }`}
                  >
                    {/* Status Dot */}
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(friend.status)} shrink-0`} />
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate font-medium">{friend.username}</p>
                      {isOnline && (
                        <span className="text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20">
                          {friend.onlineHub}
                        </span>
                      )}
                    </div>

                    {/* Actions Overlay */}
                    <div className={`flex items-center gap-1 transition-opacity duration-200 ${
                      hoveredUser === friend.userId ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}>
                      {isOnline && (
                        <>
                          <button
                            onClick={() => onJoin(friend.userId)}
                            className="p-1.5 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors"
                            aria-label={`Join ${friend.username}'s room`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                          </button>
                          {friend.hasRoom && (
                            <button
                              onClick={() => onVisit(friend.userId)}
                              className="p-1.5 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white transition-colors"
                              aria-label={`Visit ${friend.username}'s profile`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </button>
                          )}
                          <button
                            onClick={() => onKnock(friend.userId)}
                            className="p-1.5 rounded bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600 hover:text-white transition-colors"
                            aria-label={`Knock on ${friend.username}'s door`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => onRemove(friend.userId)}
                        className="p-1.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white transition-colors ml-1"
                        aria-label={`Remove ${friend.username}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        @keyframes slide-in-left {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};