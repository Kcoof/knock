// RoomChatPanel.tsx
import React, { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  username: string;
  content: string;
  at: number;
}

interface RoomChatPanelProps {
  ownerName: string;
  messages: ChatMessage[];
  selfName: string;
  canChat: boolean;
  onSend: (text: string) => void;
  onInputFocusChange: (focused: boolean) => void;
}

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const RoomChatPanel: React.FC<RoomChatPanelProps> = ({
  ownerName,
  messages,
  selfName,
  canChat,
  onSend,
  onInputFocusChange,
}) => {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && canChat) {
        onSend(inputValue.trim());
        setInputValue('');
      }
    }
  };

  const handleFocus = () => onInputFocusChange(true);
  const handleBlur = () => onInputFocusChange(false);

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[320px] h-[400px] flex flex-col bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
      
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/50 flex items-center justify-between shrink-0">
        <h3 className="font-pixel text-xs text-zinc-400 tracking-wider uppercase truncate max-w-[200px]">
          {ownerName}&apos;s Room — Chat
        </h3>
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-label="Live chat indicator" />
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-600 text-sm font-mono">
            No messages yet...
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSelf = msg.username === selfName;
            return (
              <div 
                key={`${msg.username}-${msg.at}-${index}`} 
                className="group flex flex-col gap-1 animate-[fade-in-up_0.3s_ease-out]"
              >
                <div className="flex items-end gap-2">
                  <span className={`text-xs font-bold ${isSelf ? 'text-emerald-400' : 'text-blue-300'}`}>
                    {msg.username}
                  </span>
                  <span className="text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {formatTime(msg.at)}
                  </span>
                </div>
                <p className="text-sm text-zinc-200 leading-snug break-words bg-zinc-800/50 px-3 py-2 rounded-lg rounded-tl-none border border-zinc-700/50">
                  {msg.content}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950/80 shrink-0">
        {canChat ? (
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="Type a message..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-3 pr-10 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
              aria-label="Chat input"
            />
            <button
              onClick={() => {
                if (inputValue.trim()) {
                  onSend(inputValue.trim());
                  setInputValue('');
                  inputRef.current?.focus();
                }
              }}
              disabled={!inputValue.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-violet-400 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors"
              aria-label="Send message"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="w-full bg-zinc-900/50 border border-dashed border-zinc-700 rounded-lg py-2 px-3 text-center">
            <p className="text-xs text-zinc-500 italic">Sign in to chat</p>
          </div>
        )}
      </div>

      
    </div>
  );
};