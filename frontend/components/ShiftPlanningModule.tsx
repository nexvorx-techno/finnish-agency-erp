"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Send,
  CheckCircle2,
  Printer,
  Copy,
  Users,
  AlertTriangle,
  Trash2,
  X,
  Check,
  Building2,
  Briefcase,
  Layers,
  ArrowRight,
  FileText,
} from "lucide-react";
import { SiteItem } from "../app/page";
import { ConfirmDialog } from "./ConfirmDialog";

export type RosterSubTab =
  | "m1.3_builder"
  | "m1.3_assignments"
  | "m1.3_changes"
  | "m1.3_published";

interface WeekDateItem {
  key: string; // mon, tue, etc.
  label: string; // "Mon 23 Nov"
  iso: string; // "2026-11-23"
  is_weekend: boolean;
}

interface AllocationItem {
  id: number;
  roster_id: number;
  worker_id: number;
  worker_name: string;
  role_title: string;
  tes_category: string;
  mon: string;
  tue: string;
  wed: string;
  thu: string;
  fri: string;
  sat: string;
  sun: string;
  weekly_hours: number;
  warnings: string[];
}

interface RosterItem {
  id: number;
  client_id: number;
  site_id: number;
  site_code: string;
  site_name: string;
  roster_code: string;
  start_date: string; // YYYY-MM-DD
  week_dates: WeekDateItem[];
  week_label: string;
  department_line: string;
  status: "DRAFT" | "PENDING_INTERNAL_APPROVAL" | "SUBMITTED_TO_AGENCY" | "PUBLISHED";
  current_approval_step?: number;
  total_approval_steps?: number;
  current_approver_id?: number | null;
  current_approver_name?: string | null;
  total_planned_hours: number;
  workers_count: number;
  created_by: string;
  created_at: string;
  published_at: string | null;
  allocations: AllocationItem[];
}

interface DeployedWorker {
  worker_id: number;
  worker_name: string;
  site_id: number;
  role_title: string;
  tes_category: string;
}

interface ShiftMasterOption {
  name: string;
  window: string;
  weekly: string;
  tes: string;
}

interface ShiftChangeItem {
  id: number;
  site_id: number;
  site_code: string;
  roster_id: number | null;
  worker_id: number;
  worker_name: string;
  role_title: string;
  shift_date: string;
  day_of_week: string;
  current_shift: string;
  requested_shift: string;
  reason: string;
  status: string;
  current_approval_step?: number;
  total_approval_steps?: number;
  current_approver_id?: number | null;
  current_approver_name?: string | null;
  attendance_sync_status: string;
  fallback_resolution: string;
  reviewed_by: string | null;
}

interface ShiftPlanningModuleProps {
  clientId: number;
  currentUserId?: number;
  userRole?: string;
  companyName: string;
  userName: string;
  selectedSite: string;
  sites: SiteItem[];
  activeSubTab: RosterSubTab;
  onChangeSubTab: (tab: RosterSubTab) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function getMondayOfDate(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekNumber(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

function formatWeekPillLabel(monday: Date, currentMonday: Date): { code: string; label: string; tag: string } {
  const wNum = getWeekNumber(monday);
  const diffWeeks = Math.round((monday.getTime() - currentMonday.getTime()) / (7 * 24 * 3600 * 1000));
  const end = new Date(monday);
  end.setDate(monday.getDate() + 6);
  const label = `${monday.getDate()} ${monday.toLocaleString("en-US", { month: "short" })} – ${end.getDate()} ${end.toLocaleString("en-US", { month: "short" })}`;

  let tag = "";
  if (diffWeeks === 0) tag = "Current";
  else if (diffWeeks === 1) tag = "Next Week";
  else if (diffWeeks === -1) tag = "Last Week";
  else if (diffWeeks > 1) tag = `+${diffWeeks} wks`;

  return { code: `Week ${wNum}`, label, tag };
}

function getShiftBadgeStyle(shift: string) {
  const s = (shift || "").toUpperCase();
  if (s.includes("OFF") || s === "REST") {
    return {
      bg: "bg-slate-100 dark:bg-slate-800/60",
      text: "text-slate-600 dark:text-slate-400",
      border: "border-slate-200 dark:border-slate-700",
      short: "OFF",
      time: "Rest Day",
    };
  }
  if (s.includes("MORNING") || s.includes("AAMU")) {
    return {
      bg: "bg-sky-50 dark:bg-sky-950/40",
      text: "text-sky-700 dark:text-sky-300",
      border: "border-sky-200 dark:border-sky-800",
      short: "Morning",
      time: "06:00 – 14:30",
    };
  }
  if (s.includes("EVENING") || s.includes("ILTA")) {
    return {
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-200 dark:border-amber-800",
      short: "Evening",
      time: "14:30 – 23:00",
    };
  }
  if (s.includes("NIGHT") || s.includes("YÖ")) {
    return {
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      text: "text-indigo-700 dark:text-indigo-300",
      border: "border-indigo-200 dark:border-indigo-800",
      short: "Night",
      time: "22:30 – 07:00",
    };
  }
  // Standard Day
  return {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    short: "Day",
    time: "07:00 – 15:30",
  };
}

export const ShiftPlanningModule: React.FC<ShiftPlanningModuleProps> = ({
  clientId,
  currentUserId,
  userRole = "SITE_MANAGER",
  companyName,
  userName,
  selectedSite,
  sites,
  activeSubTab,
  onChangeSubTab,
}) => {
  const currentMonday = useMemo(() => getMondayOfDate(new Date()), []);
  const [selectedMonday, setSelectedMonday] = useState<Date>(() => {
    // Default to current week's Monday
    return getMondayOfDate(new Date());
  });

  const [activeSiteId, setActiveSiteId] = useState<string>(
    selectedSite !== "all" ? selectedSite : sites[0]?.id.toString() || "1"
  );
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  const [rosters, setRosters] = useState<RosterItem[]>([]);
  const [deployedWorkers, setDeployedWorkers] = useState<DeployedWorker[]>([]);
  const [shiftOptions, setShiftOptions] = useState<ShiftMasterOption[]>([]);
  const [changeRequests, setChangeRequests] = useState<ShiftChangeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");

  // Quick Inline Cell Shift Editor Popover
  const [activeCellEdit, setActiveCellEdit] = useState<{
    allocId: number;
    dayKey: string;
    currentValue: string;
  } | null>(null);

  // Modals
  const [isAddWorkerOpen, setIsAddWorkerOpen] = useState(false);
  const [selectedAddWorkerId, setSelectedAddWorkerId] = useState<number>(0);
  const [selectedAddShift, setSelectedAddShift] = useState<string>("Morning Shift (Aamuvuoro)");

  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [bulkShift, setBulkShift] = useState<string>("Morning Shift (Aamuvuoro)");
  const [bulkDays, setBulkDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri"]);

  const [isCreateRosterOpen, setIsCreateRosterOpen] = useState(false);
  const [newRosterDept, setNewRosterDept] = useState("CNC Machining & Assembly Line A");
  const [newRosterDefaultShift, setNewRosterDefaultShift] = useState("Morning Shift (Aamuvuoro)");
  const [newRosterCopyFromId, setNewRosterCopyFromId] = useState<number | null>(null);

  const [isLogChangeOpen, setIsLogChangeOpen] = useState(false);
  const [changeWorkerId, setChangeWorkerId] = useState<number>(0);
  const [changeDate, setChangeDate] = useState(() => toIsoDate(new Date()));
  const [changeCurrentShift, setChangeCurrentShift] = useState("");
  const [changeRequestedShift, setChangeRequestedShift] = useState("");
  const [changeReason, setChangeReason] = useState("");

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: "danger" | "primary";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  useEffect(() => {
    if (sites.length === 1) {
      const onlyId = sites[0].id.toString();
      if (activeSiteId !== onlyId) setActiveSiteId(onlyId);
    } else if (selectedSite !== "all") {
      setActiveSiteId(selectedSite);
    }
  }, [selectedSite, sites, activeSiteId]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentUserId) params.set("user_id", String(currentUserId));
      if (activeSiteId !== "all") params.set("site_id", activeSiteId);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const [rRes, cRes] = await Promise.all([
        fetch(`${API_BASE}/api/client/${clientId}/rosters${qs}`),
        fetch(`${API_BASE}/api/client/${clientId}/shift-change-requests${qs}`),
      ]);
      if (rRes.ok) {
        const data = await rRes.json();
        setRosters(data.rosters || []);
        setDeployedWorkers(data.deployed_workers || []);
        setShiftOptions(data.shift_master_options || []);
        if (data.shift_master_options?.length > 0) {
          setSelectedAddShift(data.shift_master_options[0].name);
          setBulkShift(data.shift_master_options[0].name);
          setNewRosterDefaultShift(data.shift_master_options[0].name);
          setChangeCurrentShift(data.shift_master_options[0].name);
          setChangeRequestedShift(data.shift_master_options[1]?.name || data.shift_master_options[0].name);
        }
      }
      if (cRes.ok) {
        const cData = await cRes.json();
        setChangeRequests(cData.requests || []);
      }
    } catch {
      // Network error handled
    } finally {
      setIsLoading(false);
    }
  }, [clientId, currentUserId, activeSiteId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Generate Quick Week Selector Pills (Previous, Current, Next, +2, +3, +4 weeks)
  const weekPills = useMemo(() => {
    const list = [];
    for (let i = -1; i <= 4; i++) {
      const m = new Date(currentMonday);
      m.setDate(currentMonday.getDate() + i * 7);
      const info = formatWeekPillLabel(m, currentMonday);
      const iso = toIsoDate(m);
      list.push({
        mondayDate: m,
        iso,
        ...info,
      });
    }
    return list;
  }, [currentMonday]);

  // Selected Week's Monday ISO
  const selectedMondayIso = useMemo(() => toIsoDate(selectedMonday), [selectedMonday]);

  // Find existing roster for selected week & active site
  const currentRoster = useMemo(() => {
    return rosters.find((r) => {
      const matchesDate = r.start_date === selectedMondayIso;
      const matchesSite = activeSiteId === "all" || r.site_id === Number(activeSiteId);
      const matchesDept = departmentFilter === "all" || r.department_line === departmentFilter;
      return matchesDate && matchesSite && matchesDept;
    }) || rosters.find((r) => {
      // Fallback: match by date and site only
      const matchesDate = r.start_date === selectedMondayIso;
      const matchesSite = activeSiteId === "all" || r.site_id === Number(activeSiteId);
      return matchesDate && matchesSite;
    });
  }, [rosters, selectedMondayIso, activeSiteId, departmentFilter]);

  // Find previous roster (for 1-click "Copy from previous week")
  const previousRoster = useMemo(() => {
    const prevMon = new Date(selectedMonday);
    prevMon.setDate(selectedMonday.getDate() - 7);
    const prevIso = toIsoDate(prevMon);
    return rosters.find((r) => {
      const matchesDate = r.start_date === prevIso;
      const matchesSite = activeSiteId === "all" || r.site_id === Number(activeSiteId);
      return matchesDate && matchesSite;
    });
  }, [rosters, selectedMonday, activeSiteId]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    rosters.forEach((r) => {
      if (r.department_line) set.add(r.department_line);
    });
    return Array.from(set);
  }, [rosters]);

  // Calculate Daily Staffing Coverage for Current Roster
  const dailyCoverage = useMemo(() => {
    if (!currentRoster || !currentRoster.allocations) return null;
    const stats: Record<string, { morning: number; day: number; evening: number; night: number; off: number; totalOnDuty: number }> = {};

    DAY_KEYS.forEach((d) => {
      stats[d] = { morning: 0, day: 0, evening: 0, night: 0, off: 0, totalOnDuty: 0 };
    });

    currentRoster.allocations.forEach((alloc) => {
      DAY_KEYS.forEach((dayKey) => {
        const val = (alloc[dayKey] || "").toUpperCase();
        if (val.includes("OFF") || val === "REST") {
          stats[dayKey].off += 1;
        } else {
          stats[dayKey].totalOnDuty += 1;
          if (val.includes("MORNING") || val.includes("AAMU")) stats[dayKey].morning += 1;
          else if (val.includes("EVENING") || val.includes("ILTA")) stats[dayKey].evening += 1;
          else if (val.includes("NIGHT") || val.includes("YÖ")) stats[dayKey].night += 1;
          else stats[dayKey].day += 1;
        }
      });
    });

    return stats;
  }, [currentRoster]);

  // Handlers for Shift Table
  const handleUpdateShiftCell = async (allocId: number, dayKey: string, newShift: string) => {
    if (!currentRoster) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/client/rosters/${currentRoster.id}/allocations/${allocId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [dayKey]: newShift }),
        }
      );
      if (res.ok) {
        const updatedRoster: RosterItem = await res.json();
        setRosters((prev) => prev.map((r) => (r.id === updatedRoster.id ? updatedRoster : r)));
        setActiveCellEdit(null);
      }
    } catch {
      // Error handled
    }
  };

  const handleCopyFromPrevious = async () => {
    if (!previousRoster) return;
    const targetSiteId = activeSiteId !== "all" ? Number(activeSiteId) : sites[0]?.id || 1;
    try {
      const res = await fetch(`${API_BASE}/api/client/${clientId}/rosters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: targetSiteId,
          start_date: selectedMondayIso,
          department_line: previousRoster.department_line || "CNC Machining & Assembly Line A",
          default_shift: "Morning Shift (Aamuvuoro)",
          copy_from_roster_id: previousRoster.id,
          created_by: userName || "Client Admin",
        }),
      });
      if (res.ok) {
        const created: RosterItem = await res.json();
        setRosters((prev) => [created, ...prev]);
        setNotice(`Successfully cloned schedule from ${previousRoster.week_label} into this week!`);
      }
    } catch {
      // Error handled
    }
  };

  const handleCreateNewRoster = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSiteId = activeSiteId !== "all" ? Number(activeSiteId) : sites[0]?.id || 1;
    try {
      const res = await fetch(`${API_BASE}/api/client/${clientId}/rosters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: targetSiteId,
          start_date: selectedMondayIso,
          department_line: newRosterDept.trim() || "General Workforce & Operations",
          default_shift: newRosterDefaultShift,
          copy_from_roster_id: newRosterCopyFromId,
          created_by: userName || "Client Admin",
        }),
      });
      if (res.ok) {
        const created: RosterItem = await res.json();
        setRosters((prev) => [created, ...prev]);
        setIsCreateRosterOpen(false);
        setNotice(`Created new schedule for ${created.week_label}.`);
      }
    } catch {
      // Error handled
    }
  };

  const handleBulkAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoster) return;
    try {
      const res = await fetch(`${API_BASE}/api/client/rosters/${currentRoster.id}/bulk-assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shift_label: bulkShift,
          days: bulkDays,
        }),
      });
      if (res.ok) {
        const updated: RosterItem = await res.json();
        setRosters((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setIsBulkAssignOpen(false);
        setNotice(`Applied ${bulkShift} across ${bulkDays.length} days for all roster workers.`);
      }
    } catch {
      // Error handled
    }
  };

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoster || !selectedAddWorkerId) return;
    try {
      const res = await fetch(`${API_BASE}/api/client/rosters/${currentRoster.id}/workers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worker_id: selectedAddWorkerId,
          default_shift: selectedAddShift,
        }),
      });
      if (res.ok) {
        const updated: RosterItem = await res.json();
        setRosters((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setIsAddWorkerOpen(false);
        setSelectedAddWorkerId(0);
        setNotice("Worker successfully added to schedule.");
      }
    } catch {
      // Error handled
    }
  };

  const handleRemoveWorker = (allocId: number, workerName: string) => {
    if (!currentRoster) return;
    setConfirmDialog({
      isOpen: true,
      title: "Remove Worker from Week Schedule",
      message: `Are you sure you want to remove ${workerName} from ${currentRoster.week_label}? This will not affect their employment or other weeks.`,
      confirmLabel: "Remove Worker",
      variant: "danger",
      onConfirm: async () => {
        try {
          const res = await fetch(
            `${API_BASE}/api/client/rosters/${currentRoster.id}/allocations/${allocId}`,
            { method: "DELETE" }
          );
          if (res.ok) {
            const updated: RosterItem = await res.json();
            setRosters((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setNotice(`Removed ${workerName} from schedule.`);
          }
        } catch {}
      },
    });
  };

  const handleDeleteRoster = () => {
    if (!currentRoster) return;
    setConfirmDialog({
      isOpen: true,
      title: "Delete Week Schedule",
      message: `Are you sure you want to completely delete the schedule for ${currentRoster.week_label}? All ${currentRoster.allocations.length} worker shift allocations will be cleared.`,
      confirmLabel: "Delete Schedule",
      variant: "danger",
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE}/api/client/rosters/${currentRoster.id}`, {
            method: "DELETE",
          });
          if (res.ok) {
            setRosters((prev) => prev.filter((r) => r.id !== currentRoster.id));
            setNotice(`Deleted schedule for ${currentRoster.week_label}.`);
          }
        } catch {}
      },
    });
  };

  const handleRosterStatusAction = async (targetStatus: "SUBMITTED_TO_AGENCY" | "PUBLISHED") => {
    if (!currentRoster) return;
    try {
      const res = await fetch(`${API_BASE}/api/client/rosters/${currentRoster.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_status: targetStatus,
          user_id: currentUserId,
          user_name: userName || "Client Admin",
        }),
      });
      if (res.ok) {
        const updated: RosterItem = await res.json();
        setRosters((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("refresh-notifications"));
        }
        setNotice(
          updated.status === "PENDING_INTERNAL_APPROVAL"
            ? `${updated.week_label} schedule submitted for Level 1 internal approval.`
            : targetStatus === "SUBMITTED_TO_AGENCY"
            ? `${updated.week_label} schedule submitted to Agency for operational verification.`
            : `${updated.week_label} schedule published live! Workers and Agency notified.`
        );
      }
    } catch {}
  };

  const handleShiftChangeDecision = async (
    reqId: number,
    decision: "APPROVE" | "REJECT" | "RESOLVE_ABSENT" | "RESOLVE_OVERTIME" | "RETRY_SYNC"
  ) => {
    try {
      const res = await fetch(`${API_BASE}/api/client/shift-change-requests/${reqId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          reviewed_by: userName || "Client Admin",
          approver_user_id: currentUserId,
          approver_role: userRole,
        }),
      });
      if (res.ok) {
        const updated: ShiftChangeItem = await res.json();
        setChangeRequests((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("refresh-notifications"));
        }
        if (decision === "APPROVE" || decision === "RETRY_SYNC") {
          setNotice(
            updated.status === "PENDING_INTERNAL_APPROVAL"
              ? `Level ${(updated.current_approval_step || 2) - 1} approved — forwarded to Level ${updated.current_approval_step} approver.`
              : `Approved shift change for ${updated.worker_name} — Calendar & ERP Attendance Register synced.`
          );
          await fetchData();
        } else if (decision === "REJECT") {
          setNotice(`Rejected shift change for ${updated.worker_name}.`);
        } else if (decision === "RESOLVE_ABSENT") {
          setNotice(`Marked ${updated.worker_name} Absent for ${updated.shift_date}.`);
        } else if (decision === "RESOLVE_OVERTIME") {
          setNotice(`Marked ${updated.worker_name} shift as Overtime for ${updated.shift_date}.`);
        }
      }
    } catch {}
  };

  const handleLogShiftChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeWorkerId || !changeReason.trim()) return;
    const worker = deployedWorkers.find((w) => w.worker_id === changeWorkerId);
    try {
      const res = await fetch(`${API_BASE}/api/client/${clientId}/shift-change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: worker?.site_id || (activeSiteId !== "all" ? Number(activeSiteId) : sites[0]?.id || 1),
          roster_id: currentRoster?.id || null,
          worker_id: changeWorkerId,
          shift_date: changeDate,
          current_shift: changeCurrentShift,
          requested_shift: changeRequestedShift,
          reason: changeReason.trim(),
          created_by_user_id: currentUserId,
          created_by_name: userName || "Site Supervisor",
        }),
      });
      if (res.ok) {
        const created: ShiftChangeItem = await res.json();
        setChangeRequests((prev) => [created, ...prev]);
        setIsLogChangeOpen(false);
        setChangeReason("");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("refresh-notifications"));
        }
        setNotice(`Logged shift change request for ${created.worker_name}.`);
      }
    } catch {}
  };

  // Step week backward/forward
  const stepWeek = (delta: number) => {
    const next = new Date(selectedMonday);
    next.setDate(selectedMonday.getDate() + delta * 7);
    setSelectedMonday(next);
    setActiveCellEdit(null);
  };

  // Available workers not currently in this roster
  const availableWorkersForRoster = useMemo(() => {
    if (!currentRoster) return deployedWorkers;
    const assignedIds = new Set(currentRoster.allocations.map((a) => a.worker_id));
    return deployedWorkers.filter((w) => !assignedIds.has(w.worker_id));
  }, [currentRoster, deployedWorkers]);

  const isChangeTab = activeSubTab === "m1.3_changes";
  const isPublishedTab = activeSubTab === "m1.3_published";
  const isScheduleTab = !isChangeTab && !isPublishedTab;
  const pendingChangesCount = changeRequests.filter((c) => c.status === "PENDING").length;

  return (
    <div className="space-y-4 w-full pb-12">
      {/* =================================================================== */}
      {/* 1. TOP HEADER & MAIN TABS                                           */}
      {/* =================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Shift Planning & Scheduling</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Työaikalaki Verified
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Professional weekly workforce shift scheduling for {companyName} across sites and departments with mandatory 11h daily rest checking.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex rounded-lg bg-[var(--bg-secondary)] p-1 border border-[var(--border-color)] self-start md:self-auto">
          <button
            type="button"
            onClick={() => onChangeSubTab("m1.3_builder")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
              isScheduleTab
                ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm font-bold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-[var(--accent-color)]" />
            <span>Weekly Schedule</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeSubTab("m1.3_changes")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
              isChangeTab
                ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm font-bold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Shift Changes</span>
            {pendingChangesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600">
                {pendingChangesCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onChangeSubTab("m1.3_published")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
              isPublishedTab
                ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm font-bold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Published Rosters</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="px-4 py-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice("")}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 1: WEEKLY SCHEDULE PLANNER (CORE HR TOOL)                      */}
      {/* =================================================================== */}
      {isScheduleTab && (
        <div className="space-y-4">
          {/* Top Control Bar: Filters & Quick Week Pills */}
          <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 shadow-sm space-y-3">
            {/* Row 1: Site, Department, Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
              <div className="flex flex-wrap items-center gap-2">
                {/* Site Selector */}
                {sites.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[var(--text-secondary)]" />
                    <select
                      value={activeSiteId}
                      onChange={(e) => setActiveSiteId(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
                    >
                      <option value="all">All Plant Sites</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id.toString()}>
                          {s.site_code} — {s.city} ({s.site_name})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Department / Production Line Selector */}
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-[var(--text-secondary)]" />
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
                  >
                    <option value="all">All Departments / Lines</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Roster Lifecycle & Quick Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {currentRoster && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsAddWorkerOpen(true)}
                      className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                      <span>Add Worker</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsBulkAssignOpen(true)}
                      className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-amber-500" />
                      <span>Bulk Assign</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="p-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      title="Print Weekly Roster"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    {currentRoster.status === "DRAFT" && (
                      <button
                        type="button"
                        onClick={() => handleRosterStatusAction("SUBMITTED_TO_AGENCY")}
                        className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit to Agency</span>
                      </button>
                    )}

                    {currentRoster.status === "SUBMITTED_TO_AGENCY" && (
                      <button
                        type="button"
                        onClick={() => handleRosterStatusAction("PUBLISHED")}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Publish Schedule</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleDeleteRoster}
                      className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                      title="Delete This Schedule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}

                {!currentRoster && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewRosterCopyFromId(previousRoster ? previousRoster.id : null);
                      setIsCreateRosterOpen(true);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Schedule</span>
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: Week Navigation with Fast Pills */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pt-1">
              {/* Stepper */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => stepWeek(-1)}
                  className="p-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] cursor-pointer"
                  title="Previous Week"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMonday(new Date(currentMonday))}
                  className="px-2.5 py-1 rounded-lg border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  This Week
                </button>
                <button
                  type="button"
                  onClick={() => stepWeek(1)}
                  className="p-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] cursor-pointer"
                  title="Next Week"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Week Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                {weekPills.map((wp) => {
                  const isSelected = wp.iso === selectedMondayIso;
                  return (
                    <button
                      key={wp.iso}
                      type="button"
                      onClick={() => {
                        setSelectedMonday(wp.mondayDate);
                        setActiveCellEdit(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border ${
                        isSelected
                          ? "bg-[var(--accent-color)] text-white border-transparent shadow-sm font-bold"
                          : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-color)]"
                      }`}
                    >
                      <span>{wp.code}</span>
                      <span className="opacity-80 text-[11px]">({wp.label})</span>
                      {wp.tag && (
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase tracking-wider ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-[var(--border-color)] text-[var(--text-secondary)]"
                          }`}
                        >
                          {wp.tag}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Status Badge of Selected Week */}
              {currentRoster && (
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      currentRoster.status === "PUBLISHED"
                        ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                        : currentRoster.status === "SUBMITTED_TO_AGENCY"
                        ? "bg-sky-500/15 text-sky-600 border border-sky-500/30"
                        : "bg-amber-500/15 text-amber-600 border border-amber-500/30"
                    }`}
                  >
                    {currentRoster.status === "SUBMITTED_TO_AGENCY" ? "Sent to Agency" : currentRoster.status}
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)] font-medium">
                    {currentRoster.workers_count} Workers • {currentRoster.total_planned_hours} Planned Hours
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* =============================================================== */}
          {/* STATE A: NO ROSTER FOR THIS WEEK (PROFESSIONAL EMPTY PROMPT)    */}
          {/* =============================================================== */}
          {!isLoading && !currentRoster && (
            <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] p-8 shadow-sm text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[var(--accent-color)]/10 text-[var(--accent-color)] flex items-center justify-center mx-auto">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  No Schedule Created for {formatWeekPillLabel(selectedMonday, currentMonday).code}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Dates: {formatWeekPillLabel(selectedMonday, currentMonday).label}. You can instantly clone the previous week&apos;s shift schedule or start fresh.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {previousRoster ? (
                  <button
                    type="button"
                    onClick={handleCopyFromPrevious}
                    className="px-4 py-2 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Schedule Week (Copy from {previousRoster.week_label.split("(")[0].trim()})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setNewRosterCopyFromId(null);
                      setIsCreateRosterOpen(true);
                    }}
                    className="px-4 py-2 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Schedule for this Week</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setNewRosterCopyFromId(null);
                    setIsCreateRosterOpen(true);
                  }}
                  className="px-4 py-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Start Blank Schedule</span>
                </button>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* STATE B: ACTIVE WEEKLY ROSTER GRID (STANDARD EXCEL / HR TABLE)   */}
          {/* =============================================================== */}
          {!isLoading && currentRoster && (
            <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm overflow-hidden">
              {/* Shift Timing Color Legend */}
              <div className="px-4 py-2 bg-[var(--bg-secondary)]/50 border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-semibold text-[var(--text-primary)]">Shift Types:</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    <span className="text-[var(--text-primary)] font-medium">Morning (06:00–14:30)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-[var(--text-primary)] font-medium">Day (07:00–15:30)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-[var(--text-primary)] font-medium">Evening (14:30–23:00)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <span className="text-[var(--text-primary)] font-medium">Night (22:30–07:00)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    <span>Weekly Off (Rest)</span>
                  </span>
                </div>
                <span className="text-[10px] text-[var(--text-secondary)]">
                  💡 Click any shift badge to change it with 1 click
                </span>
              </div>

              {/* Roster Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[960px]">
                  <thead>
                    <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-[var(--text-secondary)] font-bold">
                      <th className="py-3 px-4 w-[240px] sticky left-0 bg-[var(--bg-secondary)] z-10 border-r border-[var(--border-color)]">
                        Worker & Role
                      </th>
                      {currentRoster.week_dates.map((wd) => (
                        <th
                          key={wd.key}
                          className={`py-3 px-3 text-center border-r border-[var(--border-color)] ${
                            wd.is_weekend ? "bg-amber-500/5 text-amber-700 dark:text-amber-400" : ""
                          }`}
                        >
                          <div className="font-bold">{wd.label.split(" ")[0]}</div>
                          <div className="text-[10px] font-normal opacity-80">{wd.label.slice(4)}</div>
                        </th>
                      ))}
                      <th className="py-3 px-3 text-center w-[100px] border-r border-[var(--border-color)]">
                        Total Hrs
                      </th>
                      <th className="py-3 px-3 text-center w-[60px]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {currentRoster.allocations.map((alloc) => {
                      const isOvertime = alloc.weekly_hours > 40.0;
                      return (
                        <tr
                          key={alloc.id}
                          className="hover:bg-[var(--bg-secondary)]/30 transition-colors group"
                        >
                          {/* Worker Column (Sticky Left) */}
                          <td className="py-2.5 px-4 sticky left-0 bg-[var(--bg-card)] group-hover:bg-[var(--bg-secondary)]/50 z-10 border-r border-[var(--border-color)]">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-[var(--accent-color)]/10 text-[var(--accent-color)] font-bold text-xs flex items-center justify-center shrink-0">
                                {alloc.worker_name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-[var(--text-primary)] truncate">
                                  {alloc.worker_name}
                                </div>
                                <div className="text-[10px] text-[var(--text-secondary)] truncate">
                                  {alloc.role_title.split("(")[0].trim()}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Day Columns (Mon – Sun) */}
                          {DAY_KEYS.map((dayKey, dayIdx) => {
                            const shiftVal = alloc[dayKey] || "OFF";
                            const style = getShiftBadgeStyle(shiftVal);
                            const isWeekend = dayIdx >= 5;
                            const isEditing =
                              activeCellEdit?.allocId === alloc.id && activeCellEdit?.dayKey === dayKey;

                            // Check Työaikalaki warning on this day
                            const hasWarning = alloc.warnings.some((w) =>
                              w.toLowerCase().includes(dayKey)
                            );

                            return (
                              <td
                                key={dayKey}
                                className={`py-2 px-2 text-center border-r border-[var(--border-color)] relative ${
                                  isWeekend ? "bg-amber-500/5" : ""
                                }`}
                              >
                                {/* Quick Popover / Dropdown on Click */}
                                {isEditing ? (
                                  <div className="absolute top-1 left-1 right-1 z-30 bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl rounded-lg p-1.5 space-y-1 animate-in fade-in zoom-in-95">
                                    <div className="text-[10px] font-bold text-[var(--text-secondary)] px-1 flex items-center justify-between">
                                      <span>Select Shift:</span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveCellEdit(null);
                                        }}
                                        className="hover:text-[var(--text-primary)] cursor-pointer"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                    {shiftOptions.map((opt) => (
                                      <button
                                        key={opt.name}
                                        type="button"
                                        onClick={() => handleUpdateShiftCell(alloc.id, dayKey, opt.name)}
                                        className={`w-full text-left px-2 py-1 rounded text-[11px] font-medium flex items-center justify-between cursor-pointer hover:bg-[var(--bg-secondary)] ${
                                          shiftVal === opt.name
                                            ? "bg-[var(--accent-color)] text-white font-bold"
                                            : "text-[var(--text-primary)]"
                                        }`}
                                      >
                                        <span>{opt.name.split("(")[0].trim()}</span>
                                        <span className="text-[9px] opacity-75">{opt.window}</span>
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateShiftCell(alloc.id, dayKey, "OFF")}
                                      className={`w-full text-left px-2 py-1 rounded text-[11px] font-medium flex items-center justify-between cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 ${
                                        shiftVal.toUpperCase() === "OFF"
                                          ? "bg-slate-300 dark:bg-slate-700 font-bold"
                                          : "text-slate-600 dark:text-slate-400"
                                      }`}
                                    >
                                      <span>Weekly Off</span>
                                      <span className="text-[9px]">Rest</span>
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveCellEdit({
                                        allocId: alloc.id,
                                        dayKey,
                                        currentValue: shiftVal,
                                      })
                                    }
                                    className={`w-full px-2 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer flex flex-col items-center justify-center group/btn hover:scale-[1.02] shadow-2xs ${style.bg} ${style.text} ${style.border}`}
                                    title="Click to change shift"
                                  >
                                    <div className="flex items-center gap-1 font-bold">
                                      <span>{style.short}</span>
                                      {hasWarning && (
                                        <span title="Työaikalaki: <11h daily rest warning" className="inline-flex">
                                          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[9px] opacity-75 leading-tight">{style.time}</span>
                                  </button>
                                )}
                              </td>
                            );
                          })}

                          {/* Total Hours Column */}
                          <td className="py-2 px-3 text-center border-r border-[var(--border-color)]">
                            <span
                              className={`font-bold ${
                                isOvertime ? "text-amber-600 dark:text-amber-400" : "text-[var(--text-primary)]"
                              }`}
                            >
                              {alloc.weekly_hours} h
                            </span>
                            {isOvertime && (
                              <div className="text-[9px] text-amber-600 font-bold">OT (+{(alloc.weekly_hours - 37.5).toFixed(1)}h)</div>
                            )}
                          </td>

                          {/* Action Column */}
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveWorker(alloc.id, alloc.worker_name)}
                              className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[var(--text-secondary)] hover:text-rose-600 cursor-pointer"
                              title="Remove from this week"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Daily Headcount & Staffing Coverage Footer */}
                  {dailyCoverage && (
                    <tfoot>
                      <tr className="bg-[var(--bg-secondary)] border-t-2 border-[var(--border-color)] font-semibold text-[11px] text-[var(--text-primary)]">
                        <td className="py-3 px-4 sticky left-0 bg-[var(--bg-secondary)] z-10 border-r border-[var(--border-color)]">
                          <div className="font-bold flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                            <span>Staffing Coverage</span>
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)] font-normal">
                            Daily Workers On Duty
                          </div>
                        </td>

                        {DAY_KEYS.map((dayKey, i) => {
                          const stats = dailyCoverage[dayKey];
                          const isWeekend = i >= 5;
                          return (
                            <td
                              key={dayKey}
                              className={`py-2 px-2 text-center border-r border-[var(--border-color)] ${
                                isWeekend ? "bg-amber-500/10" : ""
                              }`}
                            >
                              <div className="text-xs font-bold text-[var(--text-primary)]">
                                {stats.totalOnDuty} on duty
                              </div>
                              <div className="text-[9px] text-[var(--text-secondary)] space-y-0.5 mt-0.5">
                                {stats.morning > 0 && <div>{stats.morning} M</div>}
                                {stats.evening > 0 && <div>{stats.evening} E</div>}
                                {stats.night > 0 && <div>{stats.night} N</div>}
                                {stats.day > 0 && <div>{stats.day} D</div>}
                                {stats.off > 0 && <div className="text-slate-400">{stats.off} Off</div>}
                              </div>
                            </td>
                          );
                        })}

                        <td className="py-2 px-3 text-center border-r border-[var(--border-color)] font-bold text-xs">
                          {currentRoster.total_planned_hours} h
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: SHIFT CHANGE REQUESTS & ATTENDANCE REGISTER SYNC            */}
      {/* =================================================================== */}
      {isChangeTab && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Worker Shift Change Requests</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Directly approve or reject shift swap requests. Approvals automatically sync with the ERP Attendance Register.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsLogChangeOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Shift Change</span>
            </button>
          </div>

          <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-[var(--text-secondary)] font-bold">
                    <th className="py-3 px-4">Worker & Site</th>
                    <th className="py-3 px-3">Date & Day</th>
                    <th className="py-3 px-4">Shift Change</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {changeRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-secondary)]">
                        No shift change requests on file.
                      </td>
                    </tr>
                  ) : (
                    changeRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-[var(--bg-secondary)]/30">
                        <td className="py-3 px-4">
                          <div className="font-bold text-[var(--text-primary)]">{req.worker_name}</div>
                          <div className="text-[10px] text-[var(--text-secondary)]">
                            {req.role_title} • {req.site_code}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-[var(--text-primary)]">{req.shift_date}</div>
                          <div className="text-[10px] text-[var(--text-secondary)] uppercase">{req.day_of_week}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                              {req.current_shift.split("(")[0].trim()}
                            </span>
                            <ArrowRight className="w-3 h-3 text-[var(--text-secondary)]" />
                            <span className="px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold">
                              {req.requested_shift.split("(")[0].trim()}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 max-w-[280px]">
                          <p className="text-xs text-[var(--text-primary)] line-clamp-2">{req.reason}</p>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              req.status === "APPROVED"
                                ? "bg-emerald-500/15 text-emerald-600"
                                : req.status === "REJECTED"
                                ? "bg-rose-500/15 text-rose-600"
                                : "bg-amber-500/15 text-amber-600"
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {req.status === "PENDING" || req.status === "PENDING_INTERNAL_APPROVAL" ? (
                            req.current_approver_id != null &&
                            Number(currentUserId) !== Number(req.current_approver_id) ? (
                              <span className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                                Locked — L{req.current_approval_step || 1} ({req.current_approver_name || "Approver"})
                              </span>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleShiftChangeDecision(req.id, "APPROVE")}
                                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer shadow-2xs"
                                >
                                  {req.current_approver_id != null
                                    ? `Approve L${req.current_approval_step || 1}`
                                    : "Approve & Sync"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleShiftChangeDecision(req.id, "REJECT")}
                                  className="px-2.5 py-1 rounded border border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 text-[11px] font-semibold cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            )
                          ) : (
                            <span className="text-[11px] text-[var(--text-secondary)]">
                              Reviewed by {req.reviewed_by || "Admin"}
                            </span>
                          )}
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

      {/* =================================================================== */}
      {/* VIEW 3: PUBLISHED ROSTERS ARCHIVE                                   */}
      {/* =================================================================== */}
      {isPublishedTab && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">Published Plant Rosters Archive</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Historical record of all finalized and published shift schedules across all plant sites.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rosters
              .filter((r) => r.status === "PUBLISHED")
              .map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600">
                      PUBLISHED
                    </span>
                    <span className="text-xs font-mono text-[var(--text-secondary)]">{r.roster_code}</span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">{r.week_label}</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {r.site_name} • {r.department_line}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-[var(--border-color)]">
                    <div>
                      <span className="text-[10px] text-[var(--text-secondary)] block">Workers</span>
                      <span className="font-bold text-[var(--text-primary)]">{r.workers_count} employees</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-secondary)] block">Planned Hours</span>
                      <span className="font-bold text-[var(--text-primary)]">{r.total_planned_hours} hrs</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      Published {r.published_at ? new Date(r.published_at).toLocaleDateString() : "Recently"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMonday(new Date(r.start_date + "T00:00:00"));
                        onChangeSubTab("m1.3_builder");
                      }}
                      className="text-xs font-semibold text-[var(--accent-color)] hover:underline cursor-pointer"
                    >
                      View Schedule →
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: ADD WORKER TO ROSTER                                       */}
      {/* =================================================================== */}
      {isAddWorkerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Add Worker to Schedule</h3>
                <p className="text-xs text-[var(--text-secondary)]">Assign deployed employee to this week</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddWorkerOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddWorker} className="p-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Select Employee
                </label>
                <select
                  value={selectedAddWorkerId}
                  onChange={(e) => setSelectedAddWorkerId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] cursor-pointer"
                  required
                >
                  <option value={0}>Choose an employee...</option>
                  {availableWorkersForRoster.map((w) => (
                    <option key={w.worker_id} value={w.worker_id}>
                      {w.worker_name} — {w.role_title.split("(")[0].trim()} ({w.tes_category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Default Week Shift
                </label>
                <select
                  value={selectedAddShift}
                  onChange={(e) => setSelectedAddShift(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] cursor-pointer"
                >
                  {shiftOptions.map((opt) => (
                    <option key={opt.name} value={opt.name}>
                      {opt.name} ({opt.window})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                  Assigned Mon–Fri with Sat & Sun as Weekly Off. You can adjust individual days anytime.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setIsAddWorkerOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedAddWorkerId}
                  className="px-4 py-1.5 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-sm"
                >
                  Add to Week
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: BULK ASSIGN SHIFT                                          */}
      {/* =================================================================== */}
      {isBulkAssignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Bulk Assign Shifts</h3>
                <p className="text-xs text-[var(--text-secondary)]">Apply shift pattern across all workers</p>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkAssignOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBulkAssign} className="p-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Target Shift
                </label>
                <select
                  value={bulkShift}
                  onChange={(e) => setBulkShift(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] cursor-pointer"
                >
                  {shiftOptions.map((opt) => (
                    <option key={opt.name} value={opt.name}>
                      {opt.name} ({opt.window})
                    </option>
                  ))}
                  <option value="OFF">Weekly Off (Rest)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Apply on Days
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {DAY_KEYS.map((day) => {
                    const active = bulkDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setBulkDays((prev) =>
                            active ? prev.filter((d) => d !== day) : [...prev, day]
                          );
                        }}
                        className={`py-1.5 text-xs font-semibold rounded border cursor-pointer uppercase ${
                          active
                            ? "bg-[var(--accent-color)] text-white border-transparent"
                            : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setIsBulkAssignOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkDays.length === 0}
                  className="px-4 py-1.5 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-sm"
                >
                  Apply to All Workers
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: CREATE NEW ROSTER                                          */}
      {/* =================================================================== */}
      {isCreateRosterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Create Shift Schedule — {formatWeekPillLabel(selectedMonday, currentMonday).code}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  {formatWeekPillLabel(selectedMonday, currentMonday).label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateRosterOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewRoster} className="p-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Department / Production Line
                </label>
                <input
                  type="text"
                  value={newRosterDept}
                  onChange={(e) => setNewRosterDept(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                  placeholder="e.g. CNC Machining & Assembly Line A"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Schedule Creation Mode
                </label>
                <div className="space-y-2">
                  {previousRoster && (
                    <label className="flex items-center gap-2 p-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] cursor-pointer">
                      <input
                        type="radio"
                        name="roster_mode"
                        checked={newRosterCopyFromId === previousRoster.id}
                        onChange={() => setNewRosterCopyFromId(previousRoster.id)}
                        className="accent-[var(--accent-color)]"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-[var(--text-primary)]">
                          Copy from Previous Week ({previousRoster.week_label.split("(")[0].trim()})
                        </span>
                        <p className="text-[10px] text-[var(--text-secondary)]">
                          Copies all {previousRoster.allocations.length} workers and their exact shift pattern
                        </p>
                      </div>
                    </label>
                  )}

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] cursor-pointer">
                    <input
                      type="radio"
                      name="roster_mode"
                      checked={newRosterCopyFromId === null}
                      onChange={() => setNewRosterCopyFromId(null)}
                      className="accent-[var(--accent-color)]"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-[var(--text-primary)]">Start with Default Shift</span>
                      <p className="text-[10px] text-[var(--text-secondary)]">
                        Adds all deployed site workers with a standard Mon–Fri schedule
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {newRosterCopyFromId === null && (
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Initial Default Shift
                  </label>
                  <select
                    value={newRosterDefaultShift}
                    onChange={(e) => setNewRosterDefaultShift(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] cursor-pointer"
                  >
                    {shiftOptions.map((opt) => (
                      <option key={opt.name} value={opt.name}>
                        {opt.name} ({opt.window})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setIsCreateRosterOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold cursor-pointer shadow-sm"
                >
                  Create Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 4: LOG SHIFT CHANGE REQUEST                                   */}
      {/* =================================================================== */}
      {isLogChangeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Log Shift Change Request</h3>
                <p className="text-xs text-[var(--text-secondary)]">Manual entry for employee request</p>
              </div>
              <button
                type="button"
                onClick={() => setIsLogChangeOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLogShiftChange} className="p-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Worker
                </label>
                <select
                  value={changeWorkerId}
                  onChange={(e) => setChangeWorkerId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] cursor-pointer"
                  required
                >
                  <option value={0}>Choose worker...</option>
                  {deployedWorkers.map((w) => (
                    <option key={w.worker_id} value={w.worker_id}>
                      {w.worker_name} — {w.role_title.split("(")[0].trim()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Shift Date
                </label>
                <input
                  type="date"
                  value={changeDate}
                  onChange={(e) => setChangeDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Current Shift
                  </label>
                  <select
                    value={changeCurrentShift}
                    onChange={(e) => setChangeCurrentShift(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] cursor-pointer"
                  >
                    {shiftOptions.map((opt) => (
                      <option key={opt.name} value={opt.name}>
                        {opt.name.split("(")[0].trim()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Requested Shift
                  </label>
                  <select
                    value={changeRequestedShift}
                    onChange={(e) => setChangeRequestedShift(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] cursor-pointer"
                  >
                    {shiftOptions.map((opt) => (
                      <option key={opt.name} value={opt.name}>
                        {opt.name.split("(")[0].trim()}
                      </option>
                    ))}
                    <option value="OFF">Weekly Off</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Reason for Change
                </label>
                <textarea
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                  placeholder="e.g. Swapping Friday shift with peer for medical appointment"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setIsLogChangeOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!changeWorkerId || !changeReason.trim()}
                  className="px-4 py-1.5 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-sm"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
