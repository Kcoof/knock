// ControlsHint.tsx
import React from 'react';

interface ControlsHintProps {
  touch: boolean;
}

export const ControlsHint: React.FC<ControlsHintProps> = ({ touch }) => {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none select-none">
      <p className="text-zinc-500 text-xs font-mono tracking-wide opacity-70 transition-opacity duration-300 hover:opacity-100">
        {touch ? (
          <span>joystick to move · E to talk</span>
        ) : (
          <span>WASD / Arrows to move · E to interact</span>
        )}
      </p>
    </div>
  );
};