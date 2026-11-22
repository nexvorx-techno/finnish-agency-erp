"use client";

import React from "react";

interface GlobalLoaderProps {
  isLoading: boolean;
  message?: string;
}

export const GlobalLoader: React.FC<GlobalLoaderProps> = ({ isLoading, message }) => {
  if (!isLoading) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md select-none animate-in fade-in duration-150"
    >
      <div className="loader-wrapper pointer-events-none">
        <span className="loader-letter">L</span>
        <span className="loader-letter">o</span>
        <span className="loader-letter">a</span>
        <span className="loader-letter">d</span>
        <span className="loader-letter">i</span>
        <span className="loader-letter">n</span>
        <span className="loader-letter">g</span>
        <span className="loader-letter">.</span>
        <span className="loader-letter">.</span>
        <span className="loader-letter">.</span>

        <div className="loader"></div>
      </div>
      {message && (
        <p className="mt-4 text-xs font-bold tracking-widest text-slate-300 uppercase animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
};
