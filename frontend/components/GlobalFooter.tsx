"use client";

import React, { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { SupportTicketModal, SupportTicketUser } from "./SupportTicketModal";

interface GlobalFooterProps {
  currentUser: SupportTicketUser | null;
}

export const GlobalFooter: React.FC<GlobalFooterProps> = ({ currentUser }) => {
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  return (
    <>
      {/* Floating Corner Overlay: Leaves center 100% clear for Floating Dock */}
      <div className="absolute bottom-0 inset-x-0 pointer-events-none z-30 flex items-center justify-between p-3.5 sm:p-5 transition-all">
        {/* Left Corner: Raise a Ticket */}
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsTicketModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--bg-card)]/90 hover:bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-sm hover:shadow-md text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] backdrop-blur-md cursor-pointer group"
            title="Raise a Support Ticket / Complaint"
          >
            <span className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <LifeBuoy className="w-3 h-3" />
            </span>
            <span className="text-xs font-bold text-[var(--text-primary)]">Raise a Ticket</span>
          </button>
        </div>

        {/* Right Corner: Nexvorx Technologies Trademark */}
        <div className="pointer-events-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--bg-card)]/85 border border-[var(--border-color)] shadow-xs text-[11px] sm:text-xs text-[var(--text-secondary)] backdrop-blur-md select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="tracking-tight">
              A Product of <strong className="text-[var(--text-primary)] font-bold">Nexvorx Technologies™</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Complaint / Support Ticket Popup Modal */}
      <SupportTicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        currentUser={currentUser}
      />
    </>
  );
};
