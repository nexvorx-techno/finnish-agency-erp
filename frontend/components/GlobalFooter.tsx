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
      {/* Fixed Sticky Bottom Footer Bar */}
      <footer className="w-full shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-card)]/95 backdrop-blur-md px-4 sm:px-6 py-2 z-30 transition-colors">
        <div className="flex items-center justify-between gap-2.5 text-xs">
          {/* Left Corner: Raise a Ticket */}
          <button
            type="button"
            onClick={() => setIsTicketModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/25 text-xs font-bold transition-all cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98]"
            title="Raise a Support Ticket / Complaint"
          >
            <LifeBuoy className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Raise a Ticket</span>
          </button>

          {/* Right Corner: Nexvorx Technologies Trademark */}
          <div className="flex items-center gap-2 text-[var(--text-secondary)] text-[11px] sm:text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="tracking-tight">
              A Product of <strong className="text-[var(--text-primary)] font-bold">Nexvorx Technologies™</strong>
            </span>
          </div>
        </div>
      </footer>

      {/* Complaint / Support Ticket Popup Modal */}
      <SupportTicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        currentUser={currentUser}
      />
    </>
  );
};
