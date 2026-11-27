"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";

interface GlobalFooterProps {
  currentUser?: unknown;
}

export const GlobalFooter: React.FC<GlobalFooterProps> = () => {
  return (
    <footer className="w-full shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-card)]/95 backdrop-blur-md px-4 sm:px-6 py-2.5 z-30 transition-colors">
      <div className="flex items-center justify-between gap-2.5 text-xs">
        {/* Left Corner: Enterprise System Status */}
        <div className="flex items-center gap-2 text-[var(--text-secondary)] text-[11px] sm:text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
          <span className="hidden sm:inline">Nexvorx Cloud Engineering &bull; RekrySilta ERP</span>
          <span className="sm:hidden">RekrySilta ERP</span>
        </div>

        {/* Right Corner: Nexvorx Technologies Trademark */}
        <div className="flex items-center gap-2 text-[var(--text-secondary)] text-[11px] sm:text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="tracking-tight">
            A Product of <strong className="text-[var(--text-primary)] font-bold">Nexvorx Technologies™</strong>
          </span>
        </div>
      </div>
    </footer>
  );
};
