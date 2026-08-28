// Toast.tsx
import React, { useEffect, useState } from 'react';

interface ToastProps {
  text: string;
}

const getToastStyle = (text: string) => {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('let you in')) {
    return {
      container: "border-emerald-500/50 bg-emerald-950/90 shadow-[0_0_15px_rgba(16,185,129,0.2)]",
      text: "text-emerald-300"
    };
  }
  
  if (lowerText.includes('not now') || lowerText.includes('not confirmed')) {
    return {
      container: "border-zinc-700 bg-zinc-900/90 shadow-none",
      text: "text-zinc-400"
    };
  }

  return {
    container: "border-violet-500/30 bg-zinc-900/90 shadow-[0_0_10px_rgba(139,92,246,0.1)]",
    text: "text-zinc-200"
  };
};

export const Toast: React.FC<ToastProps> = ({ text }) => {
  const [isVisible, setIsVisible] = useState(false);
  const styleConfig = getToastStyle(text);

  useEffect(() => {
    // Trigger entrance animation on mount
    const timer = setTimeout(() => setIsVisible(true), 10);
    
    // Auto-dismiss after 4 seconds
    const dismissTimer = setTimeout(() => {
      setIsVisible(false);
    }, 4000);

    return () => {
      clearTimeout(timer);
      clearTimeout(dismissTimer);
    };
  }, []);

  return (
    <div 
      role="alert"
      aria-live="polite"
      className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className={`px-4 py-2 rounded-lg border backdrop-blur-md ${styleConfig.container}`}>
        <p className={`text-sm font-medium whitespace-nowrap ${styleConfig.text}`}>
          {text}
        </p>
      </div>
    </div>
  );
};