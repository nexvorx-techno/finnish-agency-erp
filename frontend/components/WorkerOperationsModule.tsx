"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Search,
  Plus,
  ArrowRightLeft,
  UserX,
  Star,
  Building2,
  X,
  Send,
  Loader2,
  FileText,
  Eye,
} from "lucide-react";
import { SiteItem } from "../app/page";

export interface DeployedWorker {
  id: number;
  worker_id: number;
  worker_name: string;
  worker_hetu_masked: string;
  client_id: number;
  site_id: number;
  site_name: string;
  site_code: string;
  role_title: string;
  tes_category: string;
  client_charge_rate: number;
  supervisor_name: string;
  start_date: string;
  end_date: string | null;
  status: string;
  average_rating: number | null;
  last_action?: {
    id: number;
    action_type: string;
    status: string;
    created_at: string;
  } | null;
}

export interface WorkerActionRequestItem {
  id: number;
  worker_id: number;
  worker_name: string;
  role_title: string;
  site_name: string;
  action_type: "REQUEST_REPLACEMENT" | "SITE_SHIFT" | "END_PLACEMENT" | "PERFORMANCE_FEEDBACK";
  target_site_name?: string | null;
  urgency?: string | null;
  rating?: number | null;
  reason: string;
  effective_date?: string | null;
  status: string;
  agency_feedback?: string | null;
  created_by_name?: string | null;
  created_at: string;
}

export interface SafetyIncidentItem {
  id: number;
  incident_code: string;
  client_id: number;
  site_id: number;
  site_name: string;
  workshop_line: string;
  incident_type: "NEAR_MISS" | "MINOR_INJURY" | "EQUIPMENT_DAMAGE" | "SAFETY_VIOLATION";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  occurred_at: string;
  involved_worker_id?: number | null;
  involved_worker_name?: string | null;
  witnesses?: string | null;
  description: string;
  immediate_action_taken: string;
  preventative_recommendation?: string | null;
  status: "REPORTED" | "AGENCY_INVESTIGATING" | "CORRECTIVE_ACTION_ISSUED" | "CLOSED";
  reported_by_name?: string | null;
  created_at: string;
}

interface WorkerOperationsModuleProps {
  clientId: number;
  companyName: string;
  userName: string;
  userRole?: string;
  selectedSite: string;
  sites: SiteItem[];
  activeSubTab: "m1.5_actions" | "m1.5_safety";
  onChangeSubTab: (tab: "m1.5_actions" | "m1.5_safety") => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const WorkerOperationsModule: React.FC<WorkerOperationsModuleProps> = ({
  clientId,
  companyName,
  userName,
  selectedSite = "all",
  sites = [],
  activeSubTab = "m1.5_actions",
  onChangeSubTab,
}) => {
  // Workers & Action state
  const [workers, setWorkers] = useState<DeployedWorker[]>([]);
  const [actionRequests, setActionRequests] = useState<WorkerActionRequestItem[]>([]);
  const [incidents, setIncidents] = useState<SafetyIncidentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [selectedWorkerForAction, setSelectedWorkerForAction] = useState<DeployedWorker | null>(null);
  const [actionTypeModal, setActionTypeModal] = useState<
    "REQUEST_REPLACEMENT" | "SITE_SHIFT" | "END_PLACEMENT" | "PERFORMANCE_FEEDBACK" | null
  >(null);

  // Form State: Worker Action
  const [actionReason, setActionReason] = useState("");
  const [actionUrgency, setActionUrgency] = useState("STANDARD");
  const [targetSiteId, setTargetSiteId] = useState<number>(sites[1]?.id || sites[0]?.id || 2);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Form State: Safety Incident
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [incidentForm, setIncidentForm] = useState({
    workshop_line: "Line 2 - Heavy Assembly",
    incident_type: "NEAR_MISS",
    severity: "MEDIUM",
    occurred_at: new Date().toISOString().slice(0, 16),
    involved_worker_id: 0,
    involved_worker_name: "",
    witnesses: "",
    description: "",
    immediate_action_taken: "",
    preventative_recommendation: "",
  });
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false);

  // Selected Incident Detail Viewer
  const [viewingIncident, setViewingIncident] = useState<SafetyIncidentItem | null>(null);

  // 1. Fetch Workers
  const fetchWorkers = useCallback(async () => {
    setIsLoading(true);
    try {
      const siteQuery = selectedSite && selectedSite !== "all" ? `?site_id=${selectedSite}` : "";
      const res = await fetch(`${API_BASE}/api/client/${clientId}/operations/workers${siteQuery}`);
      if (res.ok) {
        const data = await res.json();
        setWorkers(data.workers || []);
      }
    } catch (err) {
      console.error("Error fetching operations workers:", err);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, selectedSite]);

  // 2. Fetch Actions
  const fetchActionRequests = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/client/${clientId}/operations/action-requests`);
      if (res.ok) {
        const data = await res.json();
        setActionRequests(data.action_requests || []);
      }
    } catch (err) {
      console.error("Error fetching action requests:", err);
    }
  }, [clientId]);

  // 3. Fetch Incidents
  const fetchIncidents = useCallback(async () => {
    try {
      const siteQuery = selectedSite && selectedSite !== "all" ? `?site_id=${selectedSite}` : "";
      const res = await fetch(`${API_BASE}/api/client/${clientId}/operations/incidents${siteQuery}`);
      if (res.ok) {
        const data = await res.json();
        setIncidents(data.incidents || []);
      }
    } catch (err) {
      console.error("Error fetching safety incidents:", err);
    }
  }, [clientId, selectedSite]);

  useEffect(() => {
    fetchWorkers();
    fetchActionRequests();
    fetchIncidents();
  }, [fetchWorkers, fetchActionRequests, fetchIncidents]);

  // Filtered workers
  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = w.worker_name.toLowerCase().includes(q);
        const matchRole = w.role_title.toLowerCase().includes(q);
        const matchHetu = w.worker_hetu_masked.toLowerCase().includes(q);
        const matchSite = w.site_name.toLowerCase().includes(q);
        if (!matchName && !matchRole && !matchHetu && !matchSite) return false;
      }
      return true;
    });
  }, [workers, searchQuery]);

  // Submit Worker Action
  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkerForAction || !actionTypeModal) return;
    setIsSubmittingAction(true);
    try {
      const payload = {
        worker_id: selectedWorkerForAction.worker_id,
        worker_name: selectedWorkerForAction.worker_name,
        site_id: selectedWorkerForAction.site_id,
        role_title: selectedWorkerForAction.role_title,
        action_type: actionTypeModal,
        target_site_id: actionTypeModal === "SITE_SHIFT" ? targetSiteId : undefined,
        urgency: actionUrgency,
        rating: actionTypeModal === "PERFORMANCE_FEEDBACK" ? feedbackRating : undefined,
        reason: actionReason.trim(),
        effective_date: new Date().toISOString().split("T")[0],
        created_by_name: userName || "Site Supervisor",
      };

      const res = await fetch(`${API_BASE}/api/client/${clientId}/operations/worker-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setActionTypeModal(null);
        setSelectedWorkerForAction(null);
        setActionReason("");
        await fetchWorkers();
        await fetchActionRequests();
      }
    } catch (err) {
      console.error("Submit worker action error:", err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Submit Safety Incident
  const handleSubmitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingIncident(true);
    try {
      const payload = {
        site_id: selectedSite !== "all" ? parseInt(selectedSite) : sites[0]?.id || 1,
        workshop_line: incidentForm.workshop_line,
        incident_type: incidentForm.incident_type,
        severity: incidentForm.severity,
        occurred_at: incidentForm.occurred_at,
        involved_worker_id: incidentForm.involved_worker_id || undefined,
        involved_worker_name: incidentForm.involved_worker_name.trim() || undefined,
        witnesses: incidentForm.witnesses.trim() || undefined,
        description: incidentForm.description.trim(),
        immediate_action_taken: incidentForm.immediate_action_taken.trim(),
        preventative_recommendation: incidentForm.preventative_recommendation.trim() || undefined,
        reported_by_name: userName || "Safety Officer",
      };

      const res = await fetch(`${API_BASE}/api/client/${clientId}/operations/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsIncidentModalOpen(false);
        setIncidentForm({
          workshop_line: "Line 2 - Heavy Assembly",
          incident_type: "NEAR_MISS",
          severity: "MEDIUM",
          occurred_at: new Date().toISOString().slice(0, 16),
          involved_worker_id: 0,
          involved_worker_name: "",
          witnesses: "",
          description: "",
          immediate_action_taken: "",
          preventative_recommendation: "",
        });
        await fetchIncidents();
      }
    } catch (err) {
      console.error("Submit safety incident error:", err);
    } finally {
      setIsSubmittingIncident(false);
    }
  };

  const getIncidentSeverityBadge = (severity: SafetyIncidentItem["severity"]) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-rose-500/15 text-rose-600 border-rose-500/30 font-bold";
      case "HIGH":
        return "bg-amber-500/15 text-amber-600 border-amber-500/30 font-bold";
      case "MEDIUM":
        return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30 font-semibold";
      default:
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    }
  };

  const getIncidentTypeLabel = (type: SafetyIncidentItem["incident_type"]) => {
    switch (type) {
      case "NEAR_MISS":
        return "Läheltä piti (Near Miss)";
      case "MINOR_INJURY":
        return "Tapaturma (Minor Injury)";
      case "EQUIPMENT_DAMAGE":
        return "Laitevaurio (Equipment Damage)";
      case "SAFETY_VIOLATION":
        return "Protokollavirhe (Violation)";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                Worker Operations & Safety Hub
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                Työturvallisuuslaki
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Plant operations for <strong className="text-[var(--text-primary)]">{companyName}</strong> &bull; Manage deployed workforce, trigger replacements & log occupational safety
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Subtabs Switcher */}
          <div className="flex items-center gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)]">
            <button
              type="button"
              onClick={() => onChangeSubTab("m1.5_actions")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "m1.5_actions"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Worker Action Desk</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeSubTab("m1.5_safety")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "m1.5_safety"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Safety & Incident Logs</span>
              {incidents.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                  {incidents.length}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              fetchWorkers();
              fetchActionRequests();
              fetchIncidents();
            }}
            className="p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Sync Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. SUB-TAB 1: WORKER ACTION DESK                                      */}
      {/* ===================================================================== */}
      {activeSubTab === "m1.5_actions" && (
        <div className="space-y-5">
          {/* Action Desk KPI Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xs">
              <div className="text-[11px] font-medium text-[var(--text-secondary)]">Deployed Agency Workers</div>
              <div className="text-xl font-bold text-[var(--text-primary)] mt-1">{workers.length}</div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-1">Active on plant lines</div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xs">
              <div className="text-[11px] font-medium text-[var(--text-secondary)]">Open Action Requests</div>
              <div className="text-xl font-bold text-amber-600 mt-1">
                {actionRequests.filter((a) => a.status === "PENDING_AGENCY" || a.status === "IN_REVIEW").length}
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] mt-1">Agency action queue</div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xs">
              <div className="text-[11px] font-medium text-[var(--text-secondary)]">Replacement Requests</div>
              <div className="text-xl font-bold text-[var(--text-primary)] mt-1">
                {actionRequests.filter((a) => a.action_type === "REQUEST_REPLACEMENT").length}
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] mt-1">SLA replacement tickets</div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xs">
              <div className="text-[11px] font-medium text-[var(--text-secondary)]">Plant Site Transfers</div>
              <div className="text-xl font-bold text-blue-600 mt-1">
                {actionRequests.filter((a) => a.action_type === "SITE_SHIFT").length}
              </div>
              <div className="text-[10px] text-blue-600 mt-1 font-semibold">Facility shifting</div>
            </div>
          </div>

          {/* Search Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search deployed worker, role or HETU..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
              />
            </div>
          </div>

          {/* Deployed Workers Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              <div className="col-span-full p-12 text-center text-[var(--text-secondary)]">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                Loading deployed workers...
              </div>
            ) : filteredWorkers.length === 0 ? (
              <div className="col-span-full p-12 text-center rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                No active workers match this query.
              </div>
            ) : (
              filteredWorkers.map((w) => {
                return (
                  <div
                    key={w.id}
                    className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Top Row: Name, Masked HETU & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-[var(--text-primary)]">{w.worker_name}</h3>
                          <div className="text-[11px] font-mono text-[var(--text-secondary)]">
                            HETU: {w.worker_hetu_masked}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          {w.status}
                        </span>
                      </div>

                      {/* Role & TES Category */}
                      <div className="mt-2.5 space-y-1 text-xs">
                        <div className="font-semibold text-blue-600 dark:text-blue-400">{w.role_title}</div>
                        <div className="text-[11px] text-[var(--text-secondary)]">{w.tes_category}</div>
                        <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1 mt-1">
                          <Building2 className="w-3 h-3 text-[var(--text-secondary)]" />
                          <span>{w.site_name}</span>
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          Billing Rate: <strong className="text-[var(--text-primary)]">€{w.client_charge_rate.toFixed(2)}/h</strong>
                        </div>
                      </div>

                      {/* Performance Rating Pill */}
                      <div className="mt-3 flex items-center gap-1.5">
                        <span className="text-[10px] text-[var(--text-secondary)]">Performance:</span>
                        {w.average_rating ? (
                          <div className="flex items-center gap-0.5 text-amber-500 text-xs font-bold">
                            <Star className="w-3 h-3 fill-amber-500" />
                            <span>{w.average_rating} / 5.0</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[var(--text-secondary)] italic">No ratings yet</span>
                        )}
                      </div>

                      {/* Recent Action Flag if active */}
                      {w.last_action && (
                        <div className="mt-2 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-700 dark:text-amber-300 flex items-center justify-between">
                          <span className="truncate">Ticket: {w.last_action.action_type.replace(/_/g, " ")}</span>
                          <span className="font-bold shrink-0 ml-1">{w.last_action.status}</span>
                        </div>
                      )}
                    </div>

                    {/* Operational Action Buttons Bar */}
                    <div className="pt-3 border-t border-[var(--border-color)] grid grid-cols-2 gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWorkerForAction(w);
                          setActionTypeModal("REQUEST_REPLACEMENT");
                        }}
                        className="px-2.5 py-1.5 rounded-xl border border-rose-500/30 text-rose-600 hover:bg-rose-500/10 font-semibold transition-all cursor-pointer flex items-center justify-center gap-1"
                        title="Request agency worker replacement"
                      >
                        <UserX className="w-3 h-3" />
                        <span>Replace</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWorkerForAction(w);
                          setActionTypeModal("SITE_SHIFT");
                        }}
                        className="px-2.5 py-1.5 rounded-xl border border-blue-500/30 text-blue-600 hover:bg-blue-500/10 font-semibold transition-all cursor-pointer flex items-center justify-center gap-1"
                        title="Transfer to another plant facility"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Shift Site</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWorkerForAction(w);
                          setActionTypeModal("PERFORMANCE_FEEDBACK");
                        }}
                        className="px-2.5 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1"
                        title="Rate worker performance"
                      >
                        <Star className="w-3 h-3 text-amber-500" />
                        <span>Rate</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWorkerForAction(w);
                          setActionTypeModal("END_PLACEMENT");
                        }}
                        className="px-2.5 py-1.5 rounded-xl border border-[var(--border-color)] hover:border-slate-400 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1"
                        title="Release worker / project ramp-down"
                      >
                        <span>Demobilize</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Action Requests Audit Table */}
          {actionRequests.length > 0 && (
            <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-5 space-y-3">
              <div className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Submitted Worker Action Tickets ({actionRequests.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--bg-secondary)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                    <tr>
                      <th className="py-2.5 px-3">Worker / Role</th>
                      <th className="py-2.5 px-3">Action Type</th>
                      <th className="py-2.5 px-3">Urgency / Target</th>
                      <th className="py-2.5 px-3">Reason</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {actionRequests.map((a) => (
                      <tr key={a.id} className="hover:bg-[var(--bg-secondary)]/50 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">
                          {a.worker_name}
                          <div className="text-[10px] text-[var(--text-secondary)] font-normal">{a.role_title}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-blue-600">{a.action_type.replace(/_/g, " ")}</span>
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                          {a.target_site_name ? `→ ${a.target_site_name}` : a.urgency || "Standard"}
                        </td>
                        <td className="py-2.5 px-3 max-w-xs truncate text-[var(--text-primary)]">{a.reason}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            {a.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[10px] text-[var(--text-secondary)]">
                          {new Date(a.created_at).toLocaleDateString("fi-FI")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. SUB-TAB 2: SAFETY & INCIDENT LOGS (Työturvallisuuslaki)             */}
      {/* ===================================================================== */}
      {activeSubTab === "m1.5_safety" && (
        <div className="space-y-5">
          {/* Top Safety Action & Statistics */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                  Occupational Safety Register (Työturvallisuusrekisteri)
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Mandatory reporting of near-misses (Läheltä piti) and workplace safety events directly to Agency HR
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsIncidentModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Report Safety Incident</span>
            </button>
          </div>

          {/* Safety Incidents Log Table */}
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg-secondary)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                  <tr>
                    <th className="py-3 px-4">Code / Date</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Location / Line</th>
                    <th className="py-3 px-3">Involved Worker</th>
                    <th className="py-3 px-3">Severity</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {incidents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[var(--text-secondary)]">
                        No safety incidents logged. Workplace is in full compliance.
                      </td>
                    </tr>
                  ) : (
                    incidents.map((inc) => (
                      <tr
                        key={inc.id}
                        onClick={() => setViewingIncident(inc)}
                        className="hover:bg-[var(--bg-secondary)]/50 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4">
                          <div className="font-bold text-[var(--text-primary)] font-mono">{inc.incident_code}</div>
                          <div className="text-[10px] text-[var(--text-secondary)]">
                            {new Date(inc.occurred_at).toLocaleString("fi-FI", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-[var(--text-primary)]">
                          {getIncidentTypeLabel(inc.incident_type)}
                        </td>
                        <td className="py-3 px-3 text-[var(--text-secondary)]">
                          {inc.site_name} &bull; {inc.workshop_line}
                        </td>
                        <td className="py-3 px-3 text-[var(--text-primary)]">
                          {inc.involved_worker_name || "N/A (Equipment/Line)"}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] border ${getIncidentSeverityBadge(
                              inc.severity
                            )}`}
                          >
                            {inc.severity}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            {inc.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingIncident(inc);
                            }}
                            className="p-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-blue-600 dark:text-blue-400 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. MODAL: WORKER OPERATIONAL ACTION (Replace, Shift Site, Rate)       */}
      {/* ===================================================================== */}
      {actionTypeModal && selectedWorkerForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  {actionTypeModal === "REQUEST_REPLACEMENT"
                    ? "Request Worker Replacement"
                    : actionTypeModal === "SITE_SHIFT"
                    ? "Transfer Worker Facility"
                    : actionTypeModal === "PERFORMANCE_FEEDBACK"
                    ? "Worker Performance Rating"
                    : "End Worker Placement"}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  {selectedWorkerForAction.worker_name} ({selectedWorkerForAction.role_title})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActionTypeModal(null)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAction} className="space-y-3.5">
              {/* Site Shift Target Selection */}
              {actionTypeModal === "SITE_SHIFT" && (
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Destination Plant Facility *
                  </label>
                  <select
                    value={targetSiteId}
                    onChange={(e) => setTargetSiteId(parseInt(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                    required
                  >
                    {sites.map((s) => (
                      <option key={s.id} value={s.id} disabled={s.id === selectedWorkerForAction.site_id}>
                        {s.site_code} — {s.site_name} {s.id === selectedWorkerForAction.site_id ? "(Current)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Urgency Selection for Replacement */}
              {actionTypeModal === "REQUEST_REPLACEMENT" && (
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Replacement Urgency / SLA *
                  </label>
                  <select
                    value={actionUrgency}
                    onChange={(e) => setActionUrgency(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                  >
                    <option value="IMMEDIATE_24H">Immediate (Critical 24h Replacement SLA)</option>
                    <option value="3_DAYS">Within 3 Business Days</option>
                    <option value="STANDARD">Standard Notice (1 Week)</option>
                  </select>
                </div>
              )}

              {/* Rating Selector */}
              {actionTypeModal === "PERFORMANCE_FEEDBACK" && (
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Performance Score (1 - 5 Stars)
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        className={`p-2 rounded-xl border transition-all cursor-pointer ${
                          feedbackRating >= star
                            ? "bg-amber-500/15 border-amber-500/40 text-amber-500"
                            : "border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                        }`}
                      >
                        <Star className={`w-5 h-5 ${feedbackRating >= star ? "fill-amber-500" : ""}`} />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-[var(--text-primary)] ml-2">
                      {feedbackRating === 5
                        ? "Excellent"
                        : feedbackRating === 4
                        ? "Good"
                        : feedbackRating === 3
                        ? "Satisfactory"
                        : feedbackRating === 2
                        ? "Needs Improvement"
                        : "Unacceptable"}
                    </span>
                  </div>
                </div>
              )}

              {/* Reason / Notes */}
              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Reason & Operational Notes *
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder={
                    actionTypeModal === "REQUEST_REPLACEMENT"
                      ? "Specify performance issues, lack of required welding/CNC certification, or chronic absenteeism..."
                      : actionTypeModal === "SITE_SHIFT"
                      ? "Specify reason for facility transfer (e.g. Line 2 increased production output)..."
                      : "Describe worker performance, attendance, and technical capability..."
                  }
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setActionTypeModal(null)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60 flex items-center gap-1.5 shadow-sm"
                >
                  {isSubmittingAction ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Action to Agency</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. MODAL: REPORT SAFETY INCIDENT (Työturvallisuuslaki)                 */}
      {/* ===================================================================== */}
      {isIncidentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Report Safety Incident / Near-Miss
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Finnish Occupational Safety Register (Työturvallisuusrekisteri)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsIncidentModalOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitIncident} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Incident Category *
                  </label>
                  <select
                    value={incidentForm.incident_type}
                    onChange={(e) => setIncidentForm((prev) => ({ ...prev, incident_type: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                    required
                  >
                    <option value="NEAR_MISS">Läheltä piti (Near-Miss)</option>
                    <option value="MINOR_INJURY">Minor Injury / Tapaturma</option>
                    <option value="EQUIPMENT_DAMAGE">Equipment / Machinery Damage</option>
                    <option value="SAFETY_VIOLATION">Safety Protocol Violation</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Severity Level *
                  </label>
                  <select
                    value={incidentForm.severity}
                    onChange={(e) => setIncidentForm((prev) => ({ ...prev, severity: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                    required
                  >
                    <option value="LOW">Low (First aid / superficial)</option>
                    <option value="MEDIUM">Medium (Near-miss with damage potential)</option>
                    <option value="HIGH">High (Medical visit required)</option>
                    <option value="CRITICAL">Critical (Severe injury / structural failure)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Workshop Line / Location *
                  </label>
                  <input
                    type="text"
                    value={incidentForm.workshop_line}
                    onChange={(e) => setIncidentForm((prev) => ({ ...prev, workshop_line: e.target.value }))}
                    placeholder="e.g. CNC Workshop Hall 2"
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Date & Time of Occurrence *
                  </label>
                  <input
                    type="datetime-local"
                    value={incidentForm.occurred_at}
                    onChange={(e) => setIncidentForm((prev) => ({ ...prev, occurred_at: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Involved Worker (Optional)
                  </label>
                  <input
                    type="text"
                    value={incidentForm.involved_worker_name}
                    onChange={(e) => setIncidentForm((prev) => ({ ...prev, involved_worker_name: e.target.value }))}
                    placeholder="e.g. Antti Mäkinen"
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Witnesses (Optional)
                  </label>
                  <input
                    type="text"
                    value={incidentForm.witnesses}
                    onChange={(e) => setIncidentForm((prev) => ({ ...prev, witnesses: e.target.value }))}
                    placeholder="e.g. Juho Rantanen"
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Incident Description (What happened?) *
                </label>
                <textarea
                  value={incidentForm.description}
                  onChange={(e) => setIncidentForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe in detail what occurred, equipment involved, and environmental conditions..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Immediate Action Taken on the Floor *
                </label>
                <textarea
                  value={incidentForm.immediate_action_taken}
                  onChange={(e) =>
                    setIncidentForm((prev) => ({ ...prev, immediate_action_taken: e.target.value }))
                  }
                  placeholder="e.g. Line power cut, first aid dressing applied, spill absorbed..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setIsIncidentModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingIncident}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60 flex items-center gap-1.5 shadow-sm"
                >
                  {isSubmittingIncident ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Logging...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Log & Alert Agency HR</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. MODAL: SAFETY INCIDENT DETAIL VIEWER                               */}
      {/* ===================================================================== */}
      {viewingIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl p-5 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-[var(--border-color)]">
              <div>
                <span className="text-[10px] font-mono font-bold text-rose-600 uppercase">
                  {viewingIncident.incident_code}
                </span>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                  {getIncidentTypeLabel(viewingIncident.incident_type)}
                </h3>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  {viewingIncident.site_name} &bull; {viewingIncident.workshop_line}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingIncident(null)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-1">
                <div className="text-[10px] font-bold uppercase text-[var(--text-secondary)]">Description</div>
                <p className="text-[var(--text-primary)] leading-relaxed">{viewingIncident.description}</p>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-1">
                <div className="text-[10px] font-bold uppercase text-[var(--text-secondary)]">
                  Immediate Corrective Action
                </div>
                <p className="text-[var(--text-primary)] leading-relaxed">{viewingIncident.immediate_action_taken}</p>
              </div>

              {viewingIncident.preventative_recommendation && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1 text-emerald-800 dark:text-emerald-300">
                  <div className="text-[10px] font-bold uppercase">Prevention Recommendation</div>
                  <p className="leading-relaxed">{viewingIncident.preventative_recommendation}</p>
                </div>
              )}

              <div className="text-[11px] text-[var(--text-secondary)] flex justify-between pt-1">
                <span>Reported by: {viewingIncident.reported_by_name || "Safety Lead"}</span>
                <span>Status: {viewingIncident.status.replace(/_/g, " ")}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--border-color)] text-right">
              <button
                type="button"
                onClick={() => setViewingIncident(null)}
                className="px-4 py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
