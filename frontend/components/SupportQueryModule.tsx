"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  HelpCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
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
  RefreshCw,
  Search,
  CheckCheck,
  MessageSquare,
  ArrowRight,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://finnish-agency-erp.onrender.com";

export interface SupportQueryUser {
  userId?: number | string;
  fullName?: string;
  username?: string;
  email?: string;
  role?: string;
  clientId?: number;
  clientName?: string;
}

interface SupportQueryModuleProps {
  currentUser: SupportQueryUser | null;
  companyName: string;
  activeSubTab: "raise_query" | "track_query";
  onChangeSubTab: (tab: "raise_query" | "track_query") => void;
  onNavigateToMessaging?: () => void;
}

interface QueryRecord {
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

export const SupportQueryModule: React.FC<SupportQueryModuleProps> = ({
  currentUser,
  companyName,
  activeSubTab,
  onChangeSubTab,
  onNavigateToMessaging,
}) => {
  // Form State (Raise Query)
  const [moduleIssue, setModuleIssue] = useState(MODULE_OPTIONS[0]);
  const [priority, setPriority] = useState("MEDIUM");
  const [explanation, setExplanation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  // Tracking State (Track Query)
  const [queries, setQueries] = useState<QueryRecord[]>([]);
  const [isLoadingQueries, setIsLoadingQueries] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "RESOLVED">("ALL");

  const fetchQueries = useCallback(async () => {
    setIsLoadingQueries(true);
    try {
      const clientId = currentUser?.clientId || 1;
      const res = await fetch(`${API_BASE}/api/client/support/tickets?client_id=${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setQueries(data.tickets || []);
      }
    } catch {
      // silent fallback
    } finally {
      setIsLoadingQueries(false);
    }
  }, [currentUser?.clientId]);

  useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!explanation.trim()) {
      setErrorMessage("Please enter an explanation of the query or complaint.");
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
        const err = await res.json().catch(() => ({ detail: "Failed to dispatch query." }));
        throw new Error(err.detail || "Failed to dispatch query to support desk.");
      }

      const data = await res.json();
      setSubmittedCode(data.ticket_code || "QRY-RECEIVED");
      setExplanation("");
      await fetchQueries();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred while submitting. Please retry.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCount = queries.filter((q) => q.status !== "RESOLVED").length;
  const resolvedCount = queries.filter((q) => q.status === "RESOLVED").length;

  const filteredQueries = queries.filter((q) => {
    if (statusFilter === "OPEN" && q.status === "RESOLVED") return false;
    if (statusFilter === "RESOLVED" && q.status !== "RESOLVED") return false;
    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      const codeMatch = (q.ticket_code || "").toLowerCase().includes(term);
      const modMatch = (q.module_issue || "").toLowerCase().includes(term);
      const descMatch = (q.explanation || "").toLowerCase().includes(term);
      const userMatch = (q.user_name || "").toLowerCase().includes(term);
      return codeMatch || modMatch || descMatch || userMatch;
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Sub-Menu Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20 uppercase tracking-wider">
              Communications & Helpdesk
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-medium">
              {companyName}
            </span>
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
            <span>Operational Queries & Technical Support</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Submit inquiries to Nexvorx engineering. Receive automated email and in-app notifications upon resolution.
          </p>
        </div>

        {/* Sub-Menu Tabs */}
        <div className="flex items-center gap-2 p-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          <button
            type="button"
            onClick={() => {
              setSubmittedCode(null);
              onChangeSubTab("raise_query");
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === "raise_query"
                ? "bg-[var(--accent-color)] text-white shadow-xs"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Raise a Query</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onChangeSubTab("track_query");
              fetchQueries();
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === "track_query"
                ? "bg-[var(--accent-color)] text-white shadow-xs"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Track Query</span>
            {openCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeSubTab === "track_query" ? "bg-white text-[var(--accent-color)]" : "bg-amber-500 text-white"
              }`}>
                {openCount}
              </span>
            )}
          </button>

          {onNavigateToMessaging && (
            <button
              type="button"
              onClick={onNavigateToMessaging}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all flex items-center gap-1.5 cursor-pointer ml-1"
              title="Open Team Messaging"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Team Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* SUB-VIEW 1: RAISE A QUERY (FULL PAGE VIEW) */}
      {activeSubTab === "raise_query" && (
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs overflow-hidden">
          {submittedCode ? (
            <div className="p-8 sm:p-12 text-center max-w-xl mx-auto space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Query Submitted Successfully!
                </h3>
                <div className="inline-block px-3 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] font-mono text-xs font-bold text-[var(--accent-color)]">
                  {submittedCode}
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Your query has been dispatched directly to <strong className="text-[var(--text-primary)]">nexvorx@gmail.com</strong>.
                Our engineering team is reviewing it. Once resolved, an official resolution email will be delivered to{" "}
                <strong className="text-[var(--text-primary)]">{currentUser?.email}</strong>.
              </p>
              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onChangeSubTab("track_query")}
                  className="px-5 py-2.5 rounded-xl bg-[var(--accent-color)] text-white text-xs font-bold hover:bg-[var(--accent-hover)] transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>Go to Track Query</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSubmittedCode(null)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all cursor-pointer"
                >
                  Raise Another Query
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 4. Auto-Fetched User Details (Auto-Fetch Verified Session) */}
              <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--text-primary)]">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>User Details (Auto-Fetched from Active Session)</span>
                  </span>
                  <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold border border-emerald-500/20">
                    Verified ERP User
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]">
                    <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1 mb-0.5">
                      <User className="w-2.5 h-2.5" /> Full Name
                    </span>
                    <strong className="text-[var(--text-primary)] truncate block">
                      {currentUser?.fullName || "Current User"}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]">
                    <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1 mb-0.5">
                      <Mail className="w-2.5 h-2.5" /> User ID / Work Email
                    </span>
                    <strong className="font-mono text-[11px] text-[var(--text-primary)] truncate block" title={currentUser?.email}>
                      {currentUser?.username || currentUser?.email || "user@erp.fi"}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]">
                    <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1 mb-0.5">
                      <Shield className="w-2.5 h-2.5" /> Role
                    </span>
                    <strong className="text-[var(--text-primary)] truncate block">
                      {currentUser?.role?.replace(/_/g, " ") || "Operational User"}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]">
                    <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1 mb-0.5">
                      <Building2 className="w-2.5 h-2.5" /> Client Enterprise
                    </span>
                    <strong className="text-[var(--text-primary)] truncate block">
                      {companyName}
                    </strong>
                  </div>
                </div>
              </div>

              {/* 1. Module Issue */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {PRIORITY_OPTIONS.map((p) => {
                    const selected = priority === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPriority(p.value)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
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
                        <span className="text-[10px] text-[var(--text-secondary)] mt-1.5 block leading-tight">
                          {p.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Explain the Issue */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                  <span>2. Explain the Issue (Text Input) *</span>
                </label>
                <textarea
                  rows={5}
                  required
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Describe what occurred, any error messages displayed, or steps to reproduce the issue..."
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] leading-relaxed focus:outline-none focus:border-[var(--accent-color)] placeholder:text-[var(--text-secondary)]/60"
                />
                <span className="text-[10px] text-[var(--text-secondary)] mt-1 block">
                  Please be as descriptive as possible so our engineering team can diagnose and resolve the issue quickly.
                </span>
              </div>

              {/* Submit Action */}
              <div className="pt-2 flex items-center justify-between border-t border-[var(--border-color)]">
                <div className="text-[11px] text-[var(--text-secondary)]">
                  Forward destination: <span className="font-semibold text-[var(--text-primary)]">nexvorx@gmail.com</span>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !explanation.trim()}
                  className="px-6 py-2.5 rounded-xl bg-[var(--accent-color)] text-white text-xs font-bold hover:bg-[var(--accent-hover)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Query...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Query to Nexvorx</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* SUB-VIEW 2: TRACK QUERY (FULL PAGE VIEW) */}
      {activeSubTab === "track_query" && (
        <div className="space-y-5">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] block">Total Queries Filed</span>
                <strong className="text-xl font-bold text-[var(--text-primary)]">{queries.length}</strong>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                <HelpCircle className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] block">Pending / Under Review</span>
                <strong className="text-xl font-bold text-amber-600">{openCount}</strong>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] block">Resolved & Closed</span>
                <strong className="text-xl font-bold text-emerald-600">{resolvedCount}</strong>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCheck className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder="Search queries by ID, module, description..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-color)]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs">
                {(["ALL", "OPEN", "RESOLVED"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      statusFilter === st
                        ? "bg-[var(--accent-color)] text-white font-bold shadow-xs"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {st === "ALL" ? "All" : st === "OPEN" ? "Under Review" : "Resolved"}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={fetchQueries}
                disabled={isLoadingQueries}
                className="px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQueries ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Queries List */}
          {isLoadingQueries ? (
            <div className="p-12 text-center text-xs text-[var(--text-secondary)] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-color)]" />
              <span>Loading queries...</span>
            </div>
          ) : filteredQueries.length === 0 ? (
            <div className="p-12 text-center text-xs text-[var(--text-secondary)] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl space-y-2">
              <HelpCircle className="w-8 h-8 mx-auto text-[var(--text-secondary)]/40" />
              <p>No queries found matching the selected filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredQueries.map((q) => {
                const isResolved = q.status === "RESOLVED";

                return (
                  <div
                    key={q.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isResolved
                        ? "bg-emerald-500/5 border-emerald-500/25"
                        : "bg-[var(--bg-card)] border-[var(--border-color)] shadow-xs"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[var(--text-primary)]">
                          {q.ticket_code}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-[var(--bg-secondary)] text-[var(--text-primary)]">
                          {q.module_issue}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            q.priority === "CRITICAL"
                              ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                              : q.priority === "HIGH"
                              ? "bg-orange-500/10 text-orange-600 border border-orange-500/20"
                              : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                          }`}
                        >
                          {q.priority}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-xs border border-emerald-500/30">
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Resolved</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold text-xs border border-amber-500/30">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Under Review</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata Strip */}
                    <div className="text-[11px] text-[var(--text-secondary)] flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-3 font-mono">
                      <span>Reported by: <strong className="text-[var(--text-primary)]">{q.user_name}</strong> ({q.user_email})</span>
                      <span>•</span>
                      <span>Submitted: {q.created_at ? new Date(q.created_at).toLocaleString() : "Recently"}</span>
                    </div>

                    {/* Issue Description */}
                    <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] text-xs text-[var(--text-primary)] leading-relaxed">
                      <strong className="text-[10px] text-[var(--text-secondary)] uppercase block mb-1">
                        Query Description:
                      </strong>
                      {q.explanation}
                    </div>

                    {/* RESOLUTION DETAILS (if resolved) */}
                    {isResolved && q.resolution_notes && (
                      <div className="mt-3.5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Resolution Summary & Action Taken:</span>
                          </span>
                          <span className="text-[10px] font-normal text-emerald-700 dark:text-emerald-400">
                            {q.resolved_at ? new Date(q.resolved_at).toLocaleString() : "Recently"}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-950 dark:text-emerald-100 whitespace-pre-wrap leading-relaxed font-medium">
                          {q.resolution_notes}
                        </p>
                        <div className="pt-1.5 flex items-center justify-between text-[11px] text-emerald-700/80 dark:text-emerald-400/80 border-t border-emerald-500/20">
                          <span>Resolved By: <strong>{q.resolved_by || "Nexvorx Support Desk"}</strong></span>
                          <span className="flex items-center gap-1 font-semibold">
                            <Mail className="w-3 h-3" /> Email confirmation dispatched to user
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Open Status Note (Read-Only) */}
                    {!isResolved && (
                      <div className="mt-3.5 pt-3 border-t border-[var(--border-color)]/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          Current Status: <strong className="text-amber-600 dark:text-amber-400 font-bold">Pending Resolution</strong>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold text-[11px] border border-amber-500/20">
                          <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                          <span>Under investigation by Nexvorx Engineering Support</span>
                        </span>
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
  );
};
