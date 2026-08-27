// DoorNoteCards.tsx
import React from 'react';

interface Note {
  id: string;
  authorName: string;
  message: string;
}

interface DoorNoteCardsProps {
  notes: Note[];
  onDismiss: (id: string) => void;
}

export const DoorNoteCards: React.FC<DoorNoteCardsProps> = ({ notes, onDismiss }) => {
  if (notes.length === 0) return null;

  // Show only the last 3 notes to keep it clean, or all if fewer than 3
  const visibleNotes = notes.slice(-3);

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex flex-col-reverse gap-2 pointer-events-none w-full max-w-xs px-4">
      {visibleNotes.map((note, index) => {
        // Slight rotation for "sticky note" effect based on index
        const rotation = index % 2 === 0 ? 'rotate-[-1deg]' : 'rotate-[1deg]';
        const zIndex = 10 + index;
        
        return (
          <div
            key={note.id}
            style={{ zIndex }}
            className={`pointer-events-auto relative bg-emerald-950/90 backdrop-blur-md border border-emerald-500/30 rounded-lg p-3 shadow-[0_4px_15px_rgba(0,0,0,0.3)] ${rotation} transition-transform duration-300 hover:scale-105 hover:z-20 group animate-[pop-in_0.3s_ease-out_backwards]`}
          >
            {/* Tape effect at top center */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-3 bg-zinc-200/20 rotate-[-2deg] blur-[1px]" />
            
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-emerald-400 truncate">
                  {note.authorName} stopped by
                </p>
                <p className="text-sm text-emerald-100/90 leading-snug mt-1 break-words">
                  "{note.message}"
                </p>
              </div>
              
              <button
                onClick={() => onDismiss(note.id)}
                aria-label={`Dismiss note from ${note.authorName}`}
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-emerald-500/50 hover:text-emerald-300 p-1 -m-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
      
      <style jsx>{`
        @keyframes pop-in {
          0% { opacity: 0; transform: translateY(10px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};