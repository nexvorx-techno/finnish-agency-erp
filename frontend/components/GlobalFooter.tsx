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
      <footer className="mt-auto border-t border-[var(--border-color)] bg-[var(--bg-card)]/80 backdrop-blur-md px-4 sm:px-6 py-3 transition-colors">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
          {/* Left Corner: Raise a Ticket */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTicketModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/25 text-xs font-bold transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
            >
              <LifeBuoy className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Raise a Ticket</span>
              <span className="text-[10px] font-medium text-purple-600/80 dark:text-purple-300/80 border-l border-purple-500/30 pl-1.5 ml-0.5 hidden xs:inline">
                File a Complaint
              </span>
            </button>
            <span className="text-[11px] text-[var(--text-secondary)] hidden md:inline">
              Need technical or operational assistance? Our engineering desk is on standby.
            </span>
          </div>

          {/* Right Corner: Nexvorx Technologies Trademark */}
          <div className="flex items-center gap-2 text-[var(--text-secondary)] text-[11px] sm:text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="tracking-wide">
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
