"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Clock,
  CheckCheck,
  Bell,
  RefreshCw,
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

interface TicketRecord {
  id: number;
  ticket_code: string;
  client_id?: number;
  user_id?: string;
  user_name: string;
  user_email: string;
  user_role?: string;
  module_issue: string;
  priority: string;
  explanation: string;
  status: "OPEN" | "RESOLVED" | string;
  resolution_notes?: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at?: string;
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
  const [activeTab, setActiveTab] = useState<"raise" | "track">("raise");
  const [moduleIssue, setModuleIssue] = useState(MODULE_OPTIONS[0]);
  const [priority, setPriority] = useState("MEDIUM");
  const [explanation, setExplanation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successData, setSuccessData] = useState<{ ticketCode: string; message: string } | null>(null);

  // Tracking state
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [resolvingTicketCode, setResolvingTicketCode] = useState<string | null>(null);
  const [resolutionInput, setResolutionInput] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  const fetchTickets = useCallback(async () => {
    setIsLoadingTickets(true);
    try {
      const clientId = currentUser?.clientId || 1;
      const res = await fetch(`${API_BASE}/api/client/support/tickets?client_id=${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch {
      // silent fallback
    } finally {
      setIsLoadingTickets(false);
    }
  }, [currentUser?.clientId]);

  useEffect(() => {
    if (isOpen) {
      fetchTickets();
    }
  }, [isOpen, fetchTickets]);

  if (!isOpen) return null;

  const handleReset = () => {
    setModuleIssue(MODULE_OPTIONS[0]);
    setPriority("MEDIUM");
    setExplanation("");
    setErrorMessage("");
    setSuccessData(null);
    setResolvingTicketCode(null);
    setResolutionInput("");
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
      fetchTickets();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred while submitting your ticket. Please retry.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveTicket = async (ticketCode: string) => {
    if (!resolutionInput.trim()) return;
    setIsResolving(true);
    try {
      const res = await fetch(`${API_BASE}/api/client/support/tickets/${ticketCode}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution_notes: resolutionInput.trim(),
          resolved_by: `${currentUser?.fullName || "Nexvorx Support"} (${currentUser?.role?.replace(/_/g, " ") || "Admin"})`,
        }),
      });
      if (res.ok) {
        setResolvingTicketCode(null);
        setResolutionInput("");
        await fetchTickets();
      }
    } catch {
      // error handled
    } finally {
      setIsResolving(false);
    }
  };

  const openTicketsCount = tickets.filter((t) => t.status !== "RESOLVED").length;
  const resolvedTicketsCount = tickets.filter((t) => t.status === "RESOLVED").length;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header with Navigation Tabs */}
        <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <span>Support Desk & Incident Tracking</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 border border-purple-500/20">
                  Nexvorx Helpdesk
                </span>
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Email notification automatically sent to the user upon resolution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher Tabs */}
            <div className="flex items-center p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("raise")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeTab === "raise"
                    ? "bg-[var(--accent-color)] text-white shadow-xs font-bold"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Raise Ticket
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("track");
                  fetchTickets();
                }}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "track"
                    ? "bg-[var(--accent-color)] text-white shadow-xs font-bold"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>Track Tickets</span>
                {openTicketsCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    activeTab === "track" ? "bg-white text-[var(--accent-color)]" : "bg-amber-500 text-white"
                  }`}>
                    {openTicketsCount}
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleModalClose}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {activeTab === "raise" ? (
            successData ? (
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
                  Once resolved, you will receive an automatic email notification at{" "}
                  <strong className="text-[var(--text-primary)]">{currentUser?.email}</strong>.
                </p>
                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSuccessData(null);
                      setActiveTab("track");
                      fetchTickets();
                    }}
                    className="px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all cursor-pointer"
                  >
                    View in Ticket Tracker
                  </button>
                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="px-6 py-2 rounded-xl bg-[var(--accent-color)] text-white text-xs font-bold hover:bg-[var(--accent-hover)] transition-all cursor-pointer shadow-sm"
                  >
                    Close
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
                </div>

                {/* Footer Actions */}
                <div className="pt-2 flex items-center justify-between">
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Forward destination: <span className="font-semibold text-[var(--text-primary)]">nexvorx@gmail.com</span>
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
            )
          ) : (
            /* TAB 2: TRACK TICKETS & RESOLUTIONS */
            <div className="space-y-4">
              {/* Informative resolution notice */}
              <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs flex items-start gap-2.5">
                <Bell className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-[var(--text-secondary)]">
                  <strong className="text-[var(--text-primary)]">Automated Notification System:</strong> When Nexvorx engineers resolve any issue, the reporting user automatically receives an official **Resolution Email** with solution details and an **In-App Notification Alert** under the top bell icon.
                </div>
              </div>

              {/* Status Counters */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-[var(--text-primary)]">
                    Tickets History ({tickets.length})
                  </span>
                  <span className="text-[11px] text-amber-600 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                    {openTicketsCount} Open
                  </span>
                  <span className="text-[11px] text-emerald-600 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    {resolvedTicketsCount} Resolved
                  </span>
                </div>
                <button
                  type="button"
                  onClick={fetchTickets}
                  disabled={isLoadingTickets}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border-color)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingTickets ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Ticket Cards */}
              {isLoadingTickets ? (
                <div className="py-12 text-center text-xs text-[var(--text-secondary)] flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-color)]" />
                  <span>Loading support tickets...</span>
                </div>
              ) : tickets.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--text-secondary)] space-y-2">
                  <LifeBuoy className="w-8 h-8 mx-auto text-[var(--text-secondary)]/40" />
                  <p>No support tickets filed yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((t) => {
                    const isResolved = t.status === "RESOLVED";
                    const isResolvingThis = resolvingTicketCode === t.ticket_code;

                    return (
                      <div
                        key={t.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isResolved
                            ? "bg-emerald-500/5 border-emerald-500/25"
                            : "bg-[var(--bg-secondary)]/50 border-[var(--border-color)]"
                        }`}
                      >
                        {/* Top bar of ticket */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-[var(--text-primary)]">
                              {t.ticket_code}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-[var(--bg-card)] text-[var(--text-primary)]">
                              {t.module_issue}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                t.priority === "CRITICAL"
                                  ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                                  : t.priority === "HIGH"
                                  ? "bg-orange-500/10 text-orange-600 border border-orange-500/20"
                                  : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                              }`}
                            >
                              {t.priority}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isResolved ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                                <CheckCheck className="w-3 h-3" />
                                <span>Resolved</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold text-[10px] border border-amber-500/30">
                                <Clock className="w-3 h-3" />
                                <span>Under Review</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Reported by and time */}
                        <div className="text-[11px] text-[var(--text-secondary)] flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-2 font-mono">
                          <span>Reported by: <strong className="text-[var(--text-primary)]">{t.user_name}</strong> ({t.user_email})</span>
                          <span>•</span>
                          <span>{t.created_at ? new Date(t.created_at).toLocaleString() : "Recently"}</span>
                        </div>

                        {/* Issue Explanation */}
                        <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] leading-relaxed">
                          <strong className="text-[10px] text-[var(--text-secondary)] uppercase block mb-1">
                            Issue Description:
                          </strong>
                          {t.explanation}
                        </div>

                        {/* RESOLUTION DETAILS (if resolved) */}
                        {isResolved && t.resolution_notes && (
                          <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Resolution Summary & Action Taken:</span>
                              </span>
                              <span className="text-[10px] font-normal text-emerald-700 dark:text-emerald-400">
                                {t.resolved_at ? new Date(t.resolved_at).toLocaleString() : "Recently"}
                              </span>
                            </div>
                            <p className="text-xs text-emerald-950 dark:text-emerald-100 whitespace-pre-wrap leading-relaxed">
                              {t.resolution_notes}
                            </p>
                            <div className="pt-1 flex items-center justify-between text-[10px] text-emerald-700/80 dark:text-emerald-400/80 border-t border-emerald-500/20">
                              <span>Resolved By: <strong>{t.resolved_by || "Nexvorx Support"}</strong></span>
                              <span className="flex items-center gap-1">
                                <Mail className="w-2.5 h-2.5" /> Notification dispatched to user
                              </span>
                            </div>
                          </div>
                        )}

                        {/* ACTION TO RESOLVE (For Admins / Nexvorx Support) */}
                        {!isResolved && (
                          <div className="mt-3 pt-2.5 border-t border-[var(--border-color)]/60 flex flex-col gap-2">
                            {isResolvingThis ? (
                              <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--accent-color)] space-y-2">
                                <label className="block text-xs font-bold text-[var(--text-primary)]">
                                  Enter Resolution / Fix Explanation:
                                </label>
                                <textarea
                                  rows={2}
                                  value={resolutionInput}
                                  onChange={(e) => setResolutionInput(e.target.value)}
                                  placeholder="Explain what was fixed or the resolution steps taken..."
                                  className="w-full p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
                                />
                                <div className="flex items-center justify-between pt-1">
                                  <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-semibold">
                                    <Mail className="w-3 h-3" /> Will email {t.user_email} & alert in-app
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setResolvingTicketCode(null);
                                        setResolutionInput("");
                                      }}
                                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isResolving || !resolutionInput.trim()}
                                      onClick={() => handleResolveTicket(t.ticket_code)}
                                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                    >
                                      {isResolving ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <CheckCheck className="w-3 h-3" />
                                      )}
                                      <span>Mark Resolved & Send Email</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-[var(--text-secondary)]">
                                  Status: <strong className="text-amber-600">Pending Resolution</strong>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResolvingTicketCode(t.ticket_code);
                                    setResolutionInput(`The issue reported in ${t.module_issue} has been diagnosed and resolved by the Nexvorx engineering desk.`);
                                  }}
                                  className="px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                                >
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Mark as Resolved</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
