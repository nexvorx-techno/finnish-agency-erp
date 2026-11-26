"use client";

import React, { useState } from "react";
import {
  LifeBuoy,
  X,
  AlertCircle,
  CheckCircle2,
  Send,
  User,
  Mail,
  Shield,
  Building2,
  Layers,
  Flag,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://finnish-agency-erp.onrender.com";

export interface SupportTicketUser {
  userId?: number | string;
  fullName?: string;
  username?: string;
  email?: string;
  role?: string;
  clientId?: number;
  clientName?: string;
}

interface SupportTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: SupportTicketUser | null;
}

const MODULE_OPTIONS = [
  "Dashboard Overview",
  "Workforce & Attendance",
  "Talent Acquisition & Job Requisitions",
  "Shift Planning & Rosters",
  "Approvals & Timesheets",
  "Worker Operations & Safety Incident Logs",
  "Invoices & Settlement (ALV 25.5%)",
  "Master Data Configuration",
  "Team Messaging & Live Chat",
  "Client User Management & Roles",
  "General / System Performance Issue",
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low", desc: "Minor cosmetic or non-blocking inquiry", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { value: "MEDIUM", label: "Medium", desc: "Normal operational issue or query", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  { value: "HIGH", label: "High", desc: "Urgent issue impeding workflow execution", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  { value: "CRITICAL", label: "Critical", desc: "System blocking / Plant operation halted", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
];

export const SupportTicketModal: React.FC<SupportTicketModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [moduleIssue, setModuleIssue] = useState(MODULE_OPTIONS[0]);
  const [priority, setPriority] = useState("MEDIUM");
  const [explanation, setExplanation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successData, setSuccessData] = useState<{ ticketCode: string; message: string } | null>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setModuleIssue(MODULE_OPTIONS[0]);
    setPriority("MEDIUM");
    setExplanation("");
    setErrorMessage("");
    setSuccessData(null);
  };

  const handleModalClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!explanation.trim()) {
      setErrorMessage("Please enter an explanation of the issue.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const payload = {
        client_id: currentUser?.clientId || 1,
        user_id: currentUser?.userId ? String(currentUser.userId) : "anonymous",
        user_name: currentUser?.fullName || "Operational User",
        user_email: currentUser?.email || "anonymous@client.local",
        user_role: currentUser?.role || "Operational Staff",
        module_issue: moduleIssue,
        priority: priority,
        explanation: explanation.trim(),
      };

      const res = await fetch(`${API_BASE}/api/client/support/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to dispatch ticket." }));
        throw new Error(err.detail || "Failed to dispatch support ticket.");
      }

      const data = await res.json();
      setSuccessData({
        ticketCode: data.ticket_code || "TICK-RECEIVED",
        message: data.message || "Support ticket submitted and forwarded to nexvorx@gmail.com",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred while submitting your ticket. Please retry.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <span>Raise a Support Ticket / Complaint</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 border border-purple-500/20">
                  Nexvorx Helpdesk
                </span>
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Directly forwarded to engineering & support at{" "}
                <span className="font-semibold text-[var(--text-primary)]">nexvorx@gmail.com</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {successData ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-[var(--text-primary)]">
                  Ticket Submitted Successfully!
                </h4>
                <div className="inline-block px-3 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] font-mono text-xs font-bold text-[var(--accent-color)]">
                  {successData.ticketCode}
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
                Your complaint has been registered and forwarded to{" "}
                <strong className="text-[var(--text-primary)]">nexvorx@gmail.com</strong>.
                Our technical team will review and respond promptly.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-6 py-2.5 rounded-xl bg-[var(--accent-color)] text-white text-xs font-bold hover:bg-[var(--accent-hover)] transition-all cursor-pointer shadow-sm"
                >
                  Close & Return
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 4. Auto-Fetched User Details Strip */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1.5 text-[var(--text-primary)]">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    4. User Details (Auto-Fetched from Active Session)
                  </span>
                  <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold">
                    Verified ERP User
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]/70">
                    <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1 mb-0.5">
                      <User className="w-2.5 h-2.5" /> Full Name
                    </span>
                    <span className="font-bold text-[var(--text-primary)] truncate block">
                      {currentUser?.fullName || "Current User"}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]/70">
                    <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1 mb-0.5">
                      <Mail className="w-2.5 h-2.5" /> User ID / Email
                    </span>
                    <span className="font-mono text-[11px] text-[var(--text-primary)] truncate block" title={currentUser?.email}>
                      {currentUser?.username || currentUser?.email || "user@erp.fi"}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]/70">
                    <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1 mb-0.5">
                      <Shield className="w-2.5 h-2.5" /> Role
                    </span>
                    <span className="font-bold text-[var(--text-primary)] truncate block">
                      {currentUser?.role?.replace(/_/g, " ") || "Operational Staff"}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]/70">
                    <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1 mb-0.5">
                      <Building2 className="w-2.5 h-2.5" /> Enterprise
                    </span>
                    <span className="font-bold text-[var(--text-primary)] truncate block">
                      {currentUser?.clientName || "Valmet Technologies Oy"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 1. Module Issue Dropdown */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                  <span>1. Select the Module Issue *</span>
                </label>
                <select
                  value={moduleIssue}
                  onChange={(e) => setModuleIssue(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] font-medium focus:outline-none focus:border-[var(--accent-color)] cursor-pointer"
                >
                  {MODULE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Priority Type */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
                  <Flag className="w-3.5 h-3.5 text-amber-500" />
                  <span>3. Priority Type *</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRIORITY_OPTIONS.map((p) => {
                    const selected = priority === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPriority(p.value)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          selected
                            ? "border-[var(--accent-color)] bg-[var(--accent-color)]/10 ring-2 ring-[var(--accent-color)]/20"
                            : "border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--accent-color)]/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${p.color}`}>
                            {p.label}
                          </span>
                          {selected && <div className="w-2 h-2 rounded-full bg-[var(--accent-color)]" />}
                        </div>
                        <span className="text-[10px] text-[var(--text-secondary)] mt-1 block leading-tight">
                          {p.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Explain the Issue */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                  <span>2. Explain the Issue (Text Input) *</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Describe what occurred, any error messages displayed, or steps to reproduce the issue..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] leading-relaxed focus:outline-none focus:border-[var(--accent-color)] placeholder:text-[var(--text-secondary)]/60"
                />
                <span className="text-[10px] text-[var(--text-secondary)] mt-0.5 block">
                  Please be as descriptive as possible so our engineering team can diagnose and resolve the issue quickly.
                </span>
              </div>

              {/* Footer Actions */}
              <div className="pt-2 flex items-center justify-between">
                <div className="text-[11px] text-[var(--text-secondary)]">
                  Destination: <span className="font-semibold text-[var(--text-primary)]">nexvorx@gmail.com</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleModalClose}
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !explanation.trim()}
                    className="px-5 py-2 rounded-xl bg-[var(--accent-color)] text-white text-xs font-bold hover:bg-[var(--accent-hover)] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending to Nexvorx...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit Ticket</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
