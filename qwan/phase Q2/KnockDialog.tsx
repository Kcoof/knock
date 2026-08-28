// KnockDialog.tsx
import React, { useState } from 'react';

interface KnockDialogProps {
  ownerName: string;
  activity: string;
  doorState: "open" | "knock" | "focus";
  reasons: string[];
  onSend: (reason: string, message: string) => void;
  onCancel: () => void;
  // Optional Note Props
  showNote?: boolean;
  onLeaveNote?: (note: string) => void;
  noteSent?: boolean;
}

const getDoorStateStyle = (state: KnockDialogProps['doorState']) => {
  switch (state) {
    case 'open':
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Open' };
    case 'knock':
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'Knocking' };
    case 'focus':
      return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'Focus Mode' };
    default:
      return { bg: 'bg-zinc-800', text: 'text-zinc-400', border: 'border-zinc-700', label: 'Unknown' };
  }
};

export const KnockDialog: React.FC<KnockDialogProps> = ({
  ownerName,
  activity,
  doorState,
  reasons,
  onSend,
  onCancel,
  showNote = false,
  onLeaveNote,
  noteSent = false,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>(reasons[0] || '');
  const [message, setMessage] = useState<string>('');
  const [noteText, setNoteText] = useState<string>('');

  const stateStyle = getDoorStateStyle(doorState);

  const handleSend = () => {
    if (onSend && selectedReason) {
      onSend(selectedReason, message);
    }
  };

  const handleLeaveNote = () => {
    if (onLeaveNote && noteText.trim()) {
      onLeaveNote(noteText);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal Panel */}
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-[modal-pop_0.3s_ease-out]">
        
        {/* Header */}
        <div className="p-6 pb-4 border-b border-zinc-800 relative overflow-hidden">
          {/* Decorative Pixel Grid Background */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '4px 4px' }} />
          
          <div className="flex items-center gap-3 mb-2">
            <h2 className="font-pixel text-xl text-zinc-100 tracking-wide animate-[shake-knock_0.5s_ease-in-out]">
              KNOCK KNOCK
            </h2>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-zinc-200">{ownerName}</p>
              <p className="text-xs text-zinc-500">{activity}</p>
            </div>
            <span className={`px-2 py-1 rounded-md text-xs font-medium border ${stateStyle.bg} ${stateStyle.text} ${stateStyle.border}`}>
              {stateStyle.label}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* Reasons */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Reason
            </label>
            <div className="flex flex-wrap gap-2">
              {reasons.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
                    selectedReason === reason
                      ? 'bg-violet-600 border-violet-500 text-white shadow-[0_0_10px_rgba(139,92,246,0.3)] scale-105'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          {/* Message Input */}
          {!showNote && (
            <div>
              <label htmlFor="knock-message" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Message (Optional)
              </label>
              <textarea
                id="knock-message"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 140))}
                placeholder="Say something..."
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 resize-none transition-colors"
              />
              <div className="text-right mt-1">
                <span className="text-xs text-zinc-600">{message.length}/140</span>
              </div>
            </div>
          )}

          {/* Note Section (Only if showNote is true) */}
          {showNote && (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
              <p className="text-sm text-zinc-300 mb-3">
                <span className="font-bold text-zinc-100">{ownerName}</span> is away — leave a note
              </p>
              
              {noteSent ? (
                <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className="text-sm font-medium">Note sent!</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Write your note..."
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors"
                  />
                  <button
                    onClick={handleLeaveNote}
                    disabled={!noteText.trim()}
                    className="w-full py-2 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-violet-900/20"
                  >
                    Leave Note
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500/50 rounded-lg"
          >
            Not now
          </button>
          {!showNote && (
            <button
              onClick={handleSend}
              disabled={!selectedReason}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all duration-200 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transform active:scale-95"
            >
              Knock
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes modal-pop {
          0% { opacity: 0; transform: scale(0.95) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes shake-knock {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px) rotate(-1deg); }
          50% { transform: translateX(2px) rotate(1deg); }
          75% { transform: translateX(-1px) rotate(-0.5deg); }
        }
      `}</style>
    </div>
  );
};