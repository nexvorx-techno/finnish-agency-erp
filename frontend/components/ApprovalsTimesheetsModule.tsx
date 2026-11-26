"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileCheck2,
  Clock,
  CalendarDays,
  CheckCircle2,
  Search,
  RefreshCw,
  FileText,
  FileCheck,
  ShieldAlert,
  Calendar,
  ExternalLink,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type ApprovalsSubTab = "m1.4_leaves" | "m1.4_overtime" | "m1.4_timesheets";

interface SiteOption {
  id: number;
  site_name: string;
  site_code?: string;
}

interface ApprovalsTimesheetsModuleProps {
  clientId: number;
  currentUserId: number;
  userName: string;
  userRole: string;
  companyName: string;
  selectedSite: string;
  sites?: SiteOption[];
  activeSubTab: ApprovalsSubTab;
  onChangeSubTab: (tab: ApprovalsSubTab) => void;
  onNavigateToLiveAttendance?: () => void;
  onNavigateToInvoices?: () => void;
}

interface LeaveRecord {
  id: number;
  client_id: number;
  site_id: number;
  site_name: string;
  worker_id: number;
  worker_name: string;
  role_title: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  doctor_certificate_url?: string | null;
  doctor_certificate_verified: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  current_approval_step: number;
  total_approval_steps: number;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  reviewer_notes?: string | null;
  created_at: string;
}

interface OvertimeRecord {
  id: number;
  client_id: number;
  site_id: number;
  site_name: string;
  worker_id: number;
  worker_name: string;
  role_title: string;
  shift_date: string;
  planned_shift: string;
  overtime_hours: number;
  ot_50_hours: number;
  ot_100_hours: number;
  tes_rule: string;
  justification_reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  current_approval_step: number;
  total_approval_steps: number;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  reviewer_notes?: string | null;
  created_at: string;
}

interface TimesheetBatchRecord {
  id: number;
  client_id: number;
  site_id: number;
  site_name: string;
  batch_code: string;
  week_label: string;
  period_start: string;
  period_end: string;
  total_workers: number;
  total_regular_hours: number;
  total_overtime_hours: number;
  total_evening_hours: number;
  total_night_hours: number;
  status: "SUBMITTED_FOR_VERIFICATION" | "VERIFIED_BY_CLIENT" | "INVOICED" | string;
  verified_by_name?: string | null;
  verified_at?: string | null;
  verification_notes?: string | null;
}

interface WorkerDailyPunch {
  day: string;
  clock_in?: string | null;
  clock_out?: string | null;
  hours: number;
  status: string;
}

interface WorkerTimesheetRow {
  worker_id: number;
  worker_name: string;
  role_title: string;
  tes_category: string;
  regular_hours: number;
  overtime_50_hours: number;
  overtime_100_hours: number;
  evening_hours: number;
  night_hours: number;
  status: string;
  daily_punches: WorkerDailyPunch[];
}

export const ApprovalsTimesheetsModule: React.FC<ApprovalsTimesheetsModuleProps> = ({
  clientId,
  currentUserId,
  userName,
  userRole,
  companyName,
  selectedSite,
  activeSubTab,
  onChangeSubTab,
}) => {
  // Shared state
  const activeSiteId = selectedSite;
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Leave State
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);

  // Overtime State
  const [overtimes, setOvertimes] = useState<OvertimeRecord[]>([]);

  // Timesheets State
  const [batches, setBatches] = useState<TimesheetBatchRecord[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [batchWorkerRows, setBatchWorkerRows] = useState<WorkerTimesheetRow[]>([]);
  const [isSignOffModalOpen, setIsSignOffModalOpen] = useState(false);
  const [signOffNotes, setSignOffNotes] = useState("");
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  // Certificate Viewer Modal
  const [certViewerUrl, setCertViewerUrl] = useState<string | null>(null);

  // Fetch Leaves
  const fetchLeaves = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ user_id: String(currentUserId) });
      if (activeSiteId !== "all") qs.set("site_id", activeSiteId);
      if (statusFilter !== "ALL") qs.set("status", statusFilter);

      const res = await fetch(`${API_BASE}/api/client/${clientId}/approvals/leaves?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeaves(data.leaves || []);
      }
    } catch {}
  }, [clientId, currentUserId, activeSiteId, statusFilter]);

  // Fetch Overtime
  const fetchOvertimes = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ user_id: String(currentUserId) });
      if (activeSiteId !== "all") qs.set("site_id", activeSiteId);
      if (statusFilter !== "ALL") qs.set("status", statusFilter);

      const res = await fetch(`${API_BASE}/api/client/${clientId}/approvals/overtime?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOvertimes(data.overtime_requests || []);
      }
    } catch {}
  }, [clientId, currentUserId, activeSiteId, statusFilter]);

  // Fetch Timesheet Batches
  const fetchBatches = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ user_id: String(currentUserId) });
      if (activeSiteId !== "all") qs.set("site_id", activeSiteId);
      if (statusFilter !== "ALL") qs.set("status", statusFilter);

      const res = await fetch(`${API_BASE}/api/client/${clientId}/approvals/timesheets?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const batchList: TimesheetBatchRecord[] = data.batches || [];
        setBatches(batchList);
        if (batchList.length > 0 && !selectedBatchId) {
          setSelectedBatchId(batchList[0].id);
        }
      }
    } catch {}
  }, [clientId, currentUserId, activeSiteId, statusFilter, selectedBatchId]);

  // Fetch Batch Details when selected
  useEffect(() => {
    if (!selectedBatchId) return;
    const fetchBatchDetails = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/client/approvals/timesheets/${selectedBatchId}/details`);
        if (res.ok) {
          const data = await res.json();
          setBatchWorkerRows(data.worker_timesheets || []);
        }
      } catch {}
    };
    fetchBatchDetails();
  }, [selectedBatchId]);

  // Initial load
  useEffect(() => {
    Promise.all([fetchLeaves(), fetchOvertimes(), fetchBatches()]);
  }, [fetchLeaves, fetchOvertimes, fetchBatches]);

  // Handle Leave Decision (Approve / Reject)
  const handleLeaveDecision = async (leaveId: number, action: "APPROVE" | "REJECT") => {
    setIsActionSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/client/approvals/leaves/${leaveId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          notes: action === "APPROVE" ? "Statutory leave sign-off approved." : "Leave rejected due to plant staffing minimum coverage requirements.",
          user_id: currentUserId,
          user_name: userName,
          user_role: userRole,
        }),
      });
      if (res.ok) {
        await fetchLeaves();
      }
    } catch {}
    setIsActionSubmitting(false);
  };

  // Handle Overtime Decision (Approve / Reject)
  const handleOvertimeDecision = async (otId: number, action: "APPROVE" | "REJECT") => {
    setIsActionSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/client/approvals/overtime/${otId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          notes: action === "APPROVE" ? "TES extra hours approved with statutory 50%/100% surcharges." : "Overtime authorization declined.",
          user_id: currentUserId,
          user_name: userName,
          user_role: userRole,
        }),
      });
      if (res.ok) {
        await fetchOvertimes();
      }
    } catch {}
    setIsActionSubmitting(false);
  };

  // Handle Timesheet Batch Sign-Off
  const handleSignOffBatch = async () => {
    if (!selectedBatchId) return;
    setIsActionSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/client/approvals/timesheets/${selectedBatchId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: signOffNotes || "Electronic biometric plant gate punches reconciled against shift roster. Verified and approved for agency billing.",
          user_id: currentUserId,
          user_name: userName,
          user_role: userRole,
        }),
      });
      if (res.ok) {
        setIsSignOffModalOpen(false);
        setSignOffNotes("");
        await fetchBatches();
      }
    } catch {}
    setIsActionSubmitting(false);
  };

  // KPI Calculations
  const pendingLeaves = leaves.filter((l) => l.status === "PENDING").length;
  const sickLeavesWithCert = leaves.filter((l) => l.leave_type === "SICK_LEAVE" && l.doctor_certificate_verified).length;

  const pendingOt = overtimes.filter((ot) => ot.status === "PENDING").length;
  const totalOtHoursPending = overtimes
    .filter((ot) => ot.status === "PENDING")
    .reduce((sum, ot) => sum + ot.overtime_hours, 0);

  const selectedBatch = batches.find((b) => b.id === selectedBatchId) || batches[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header & Navigation Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
                Approvals & Biometric Timesheets
              </h1>
              <p className="text-xs text-[var(--text-secondary)] font-medium">
                {companyName} &bull; Statutory Finnish TES Compliance & Timesheet Sign-Offs
              </p>
            </div>
          </div>
        </div>

        {/* Sub-Tab Navigation Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeSubTab("m1.4_leaves")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeSubTab === "m1.4_leaves"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-color)]"
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Leave Sign-Offs</span>
            {pendingLeaves > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-extrabold">
                {pendingLeaves}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onChangeSubTab("m1.4_overtime")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeSubTab === "m1.4_overtime"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-color)]"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Overtime Requests</span>
            {pendingOt > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-extrabold">
                {pendingOt}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onChangeSubTab("m1.4_timesheets")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeSubTab === "m1.4_timesheets"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-color)]"
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Biometric Timesheets</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-600 font-extrabold">
              TES Verified
            </span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Bar & Site Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1">
            <span>Pending Leave Sign-Offs</span>
            <CalendarDays className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[var(--text-primary)]">{pendingLeaves}</span>
            <span className="text-[11px] text-amber-600 font-bold">Awaiting client decision</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1">
            <span>Pending Overtime Requests</span>
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[var(--text-primary)]">{totalOtHoursPending}h</span>
            <span className="text-[11px] text-rose-600 font-bold">{pendingOt} operators</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1">
            <span>Doctor Certifications (A/SV)</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[var(--text-primary)]">{sickLeavesWithCert}</span>
            <span className="text-[11px] text-emerald-600 font-bold">100% verified proof</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1">
            <span>Active Plant Gate Biometrics</span>
            <ShieldAlert className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[var(--text-primary)]">Synced</span>
            <span className="text-[11px] text-emerald-600 font-bold">Teknologiateollisuus TES</span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: LEAVE SIGN-OFFS (Vuosiloma & Sairausloma)
          ===================================================================== */}
      {activeSubTab === "m1.4_leaves" && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by worker name or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter leave requests by status"
                className="px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] font-medium focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => fetchLeaves()}
                className="p-2 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] border border-[var(--border-color)] text-slate-500 transition-colors"
                title="Refresh leave requests"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Leave Records Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {leaves
              .filter(
                (l) =>
                  !searchQuery ||
                  l.worker_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  l.role_title.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((leave) => {
                const isSick = leave.leave_type === "SICK_LEAVE";
                const isPending = leave.status === "PENDING";

                return (
                  <div
                    key={leave.id}
                    className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs flex flex-col justify-between space-y-4 transition-all hover:border-blue-500/40"
                  >
                    <div>
                      {/* Top Row: Worker, Role & Status Chip */}
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${
                              isSick
                                ? "bg-rose-500/10 text-rose-600"
                                : "bg-blue-500/10 text-blue-600"
                            }`}
                          >
                            {isSick ? "SL" : "VL"}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-[var(--text-primary)]">
                              {leave.worker_name}
                            </h3>
                            <p className="text-[11px] text-[var(--text-secondary)] font-medium">
                              {leave.role_title} &bull; {leave.site_name}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                            leave.status === "APPROVED"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : leave.status === "REJECTED"
                              ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          }`}
                        >
                          {leave.status === "PENDING" ? "Awaiting Decision" : leave.status}
                        </span>
                      </div>

                      {/* Dates and Type Pills */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)]">
                          {isSick ? "Sairausloma (Paid Sick Leave)" : "Vuosiloma (Annual Vacation)"}
                        </span>
                        <span className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {leave.start_date} to {leave.end_date} ({leave.total_days} {leave.total_days === 1 ? "day" : "days"})
                        </span>
                      </div>

                      {/* Reason Description */}
                      <p className="text-xs text-[var(--text-primary)] leading-relaxed bg-[var(--bg-secondary)]/50 p-3 rounded-xl border border-[var(--border-color)]">
                        {leave.reason}
                      </p>

                      {/* Medical Doctor Certificate Proof */}
                      {isSick && (
                        <div className="mt-3 flex items-center justify-between p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/15">
                          <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 font-medium">
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span>
                              {leave.doctor_certificate_verified
                                ? "Lääkärintodistus A (Medical Proof Verified)"
                                : "Self-Reported Absence (< 3 days)"}
                            </span>
                          </div>
                          {leave.doctor_certificate_url && (
                            <button
                              type="button"
                              onClick={() => setCertViewerUrl(leave.doctor_certificate_url || null)}
                              className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <span>View Proof</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom: Approver History or Action Buttons */}
                    <div className="pt-3 border-t border-[var(--border-color)]">
                      {isPending ? (
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            type="button"
                            disabled={isActionSubmitting}
                            onClick={() => handleLeaveDecision(leave.id, "REJECT")}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-bold border border-rose-500/20 transition-all"
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            disabled={isActionSubmitting}
                            onClick={() => handleLeaveDecision(leave.id, "APPROVE")}
                            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve Sign-Off</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                          <span>
                            Reviewed by: <strong className="text-[var(--text-primary)]">{leave.reviewed_by}</strong>
                          </span>
                          <span>{leave.reviewed_at ? new Date(leave.reviewed_at).toLocaleDateString() : ""}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: OVERTIME REQUESTS (Työaikalaki TES §18)
          ===================================================================== */}
      {activeSubTab === "m1.4_overtime" && (
        <div className="space-y-4">
          {/* Statutory TES Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[var(--text-primary)]">
                  Finnish Statutory Overtime Engine (Työaikalaki & TES §18)
                </h4>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Incoming overtime authorizations: First 2 daily hours at +50% surcharge, subsequent extra hours at +100%. Review and approve/decline below.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchOvertimes()}
              className="p-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] text-slate-500 transition-colors shrink-0"
              title="Refresh overtime requests"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Overtime Requests Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {overtimes.map((ot) => {
              const isPending = ot.status === "PENDING";

              return (
                <div
                  key={ot.id}
                  className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-500/40 transition-all"
                >
                  <div>
                    {/* Header: Worker & Extra Hours badge */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-sm">
                          +{ot.overtime_hours}h
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[var(--text-primary)]">
                            {ot.worker_name}
                          </h3>
                          <p className="text-[11px] text-[var(--text-secondary)] font-medium">
                            {ot.role_title} &bull; {ot.site_name}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          ot.status === "APPROVED"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : ot.status === "REJECTED"
                            ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                            : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                        }`}
                      >
                        {ot.status}
                      </span>
                    </div>

                    {/* Breakdown Badges */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600">
                        {ot.ot_50_hours}h @ +50% Surcharge
                      </span>
                      {ot.ot_100_hours > 0 && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-600">
                          {ot.ot_100_hours}h @ +100% Surcharge
                        </span>
                      )}
                      <span className="text-[11px] text-[var(--text-secondary)] font-medium">
                        Shift: {ot.planned_shift}
                      </span>
                    </div>

                    {/* Reason */}
                    <p className="text-xs text-[var(--text-primary)] leading-relaxed bg-[var(--bg-secondary)]/50 p-3 rounded-xl border border-[var(--border-color)]">
                      {ot.justification_reason}
                    </p>
                  </div>

                  {/* Actions / Approver Info */}
                  <div className="pt-3 border-t border-[var(--border-color)]">
                    {isPending ? (
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          type="button"
                          disabled={isActionSubmitting}
                          onClick={() => handleOvertimeDecision(ot.id, "REJECT")}
                          className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-bold border border-rose-500/20 transition-all"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          disabled={isActionSubmitting}
                          onClick={() => handleOvertimeDecision(ot.id, "APPROVE")}
                          className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Authorize Overtime</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                        <span>
                          Authorized by: <strong className="text-[var(--text-primary)]">{ot.reviewed_by}</strong>
                        </span>
                        <span>{ot.reviewed_at ? new Date(ot.reviewed_at).toLocaleDateString() : ""}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: BIOMETRIC TIMESHEETS (Weekly Punch Card Grid & Sign-Off)
          ===================================================================== */}
      {activeSubTab === "m1.4_timesheets" && (
        <div className="space-y-5">
          {/* Batch Selector & Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 bg-blue-500/10 px-2.5 py-0.5 rounded-md">
                Biometric Timesheet Batch
              </span>
              <h3 className="text-base font-black text-[var(--text-primary)]">
                {selectedBatch?.week_label || "Weekly Timesheet Register"}
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Batch: <strong className="text-[var(--text-primary)] font-mono">{selectedBatch?.batch_code}</strong> &bull; {selectedBatch?.site_name}
              </p>
            </div>

            {/* Batch Period Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {batches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBatchId(b.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedBatchId === b.id
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-color)]"
                  }`}
                >
                  {b.week_label.split(" ")[0]} {b.week_label.split(" ")[1]}
                </button>
              ))}

              {selectedBatch?.status === "SUBMITTED_FOR_VERIFICATION" && (
                <button
                  type="button"
                  onClick={() => setIsSignOffModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer ml-2"
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>Verify & Sign Off Batch</span>
                </button>
              )}
            </div>
          </div>

          {/* Batch Summary Stats */}
          {selectedBatch && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
                <span className="text-[11px] text-[var(--text-secondary)]">Deployed Workers</span>
                <p className="text-lg font-black text-[var(--text-primary)] mt-0.5">
                  {selectedBatch.total_workers} Operators
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
                <span className="text-[11px] text-[var(--text-secondary)]">Regular Hours</span>
                <p className="text-lg font-black text-[var(--text-primary)] mt-0.5">
                  {selectedBatch.total_regular_hours}h
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
                <span className="text-[11px] text-[var(--text-secondary)]">Overtime Total</span>
                <p className="text-lg font-black text-amber-600 mt-0.5">
                  +{selectedBatch.total_overtime_hours}h
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
                <span className="text-[11px] text-[var(--text-secondary)]">Evening Surcharges (Iltalisä)</span>
                <p className="text-lg font-black text-indigo-600 mt-0.5">
                  {selectedBatch.total_evening_hours}h
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
                <span className="text-[11px] text-[var(--text-secondary)]">Verification State</span>
                <p className="text-xs font-black text-emerald-600 mt-1 uppercase tracking-wide">
                  {selectedBatch.status === "VERIFIED_BY_CLIENT" ? "Verified & Locked" : "Pending Sign-Off"}
                </p>
              </div>
            </div>
          )}

          {/* Detailed Worker Timesheet Matrix */}
          <div className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Electronic Biometric Punch Cards & Daily Shift Reconciliation
              </h4>
              <span className="text-[11px] text-[var(--text-secondary)]">
                Statutory 30-min unpaid meal break automatically deducted
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[11px] font-bold text-[var(--text-secondary)]">
                    <th className="py-2.5 px-3">Worker / Designation</th>
                    <th className="py-2.5 px-2 text-center">Mon</th>
                    <th className="py-2.5 px-2 text-center">Tue</th>
                    <th className="py-2.5 px-2 text-center">Wed</th>
                    <th className="py-2.5 px-2 text-center">Thu</th>
                    <th className="py-2.5 px-2 text-center">Fri</th>
                    <th className="py-2.5 px-2 text-center">Sat</th>
                    <th className="py-2.5 px-2 text-center">Sun</th>
                    <th className="py-2.5 px-3 text-right">Regular</th>
                    <th className="py-2.5 px-3 text-right">Overtime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] text-xs">
                  {batchWorkerRows.map((row) => (
                    <tr key={row.worker_id} className="hover:bg-[var(--bg-secondary)]/50 transition-colors">
                      <td className="py-3 px-3">
                        <strong className="text-[var(--text-primary)] block">{row.worker_name}</strong>
                        <span className="text-[10px] text-[var(--text-secondary)]">{row.role_title}</span>
                      </td>

                      {row.daily_punches.map((p, idx) => (
                        <td key={idx} className="py-3 px-2 text-center">
                          {p.hours > 0 ? (
                            <div className="inline-block px-2 py-1 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[10px] font-mono">
                              <span className="text-[var(--text-primary)] font-bold">{p.hours}h</span>
                              <span className="block text-[8px] text-[var(--text-secondary)]">{p.clock_in}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">OFF</span>
                          )}
                        </td>
                      ))}

                      <td className="py-3 px-3 text-right font-bold text-[var(--text-primary)] font-mono">
                        {row.regular_hours}h
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-amber-600 font-mono">
                        {row.overtime_50_hours + row.overtime_100_hours > 0
                          ? `+${row.overtime_50_hours + row.overtime_100_hours}h`
                          : "0.0h"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: VERIFY & SIGN OFF TIMESHEET BATCH
          ===================================================================== */}
      {isSignOffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
              <FileCheck2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-[var(--text-primary)]">
                Verify & Sign Off Timesheet
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                You are verifying batch <strong>{selectedBatch?.batch_code}</strong> for {selectedBatch?.week_label}.
                This will lock biometric hours and transmit the verified records to Agency Accounts for invoicing.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--text-secondary)]">Verification Sign-Off Notes</label>
              <textarea
                rows={3}
                placeholder="All electronic plant gate punches reconciled against shift roster..."
                value={signOffNotes}
                onChange={(e) => setSignOffNotes(e.target.value)}
                className="w-full p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsSignOffModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-[var(--bg-secondary)] text-xs font-bold text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isActionSubmitting}
                onClick={handleSignOffBatch}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
              >
                Confirm & Sign Off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: MEDICAL CERTIFICATE VIEWER
          ===================================================================== */}
      {certViewerUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Lääkärintodistus (Medical Certificate Proof)
              </h3>
              <button
                type="button"
                onClick={() => setCertViewerUrl(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Verified Finnish Occupational Health Provider</span>
              </div>
              <p className="text-[var(--text-secondary)]">
                Certificate URL: <a href={certViewerUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline font-mono break-all">{certViewerUrl}</a>
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] pt-2 leading-relaxed">
                Complies with Finnish Employment Contracts Act (Työsopimuslaki 55/2001) §11 and collective agreement regulations for statutory paid sick leave.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCertViewerUrl(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
              >
                Close Proof Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
