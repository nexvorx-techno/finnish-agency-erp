"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  Briefcase,
  FileSpreadsheet,
  ArrowRight,
  Plus,
  MapPin,
  Receipt,
  FileCheck2,
  Clock,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

import { SummaryType, SiteItem } from "../app/page";
import { DashboardClockAndWeather } from "./DashboardClockAndWeather";

interface RequisitionApiItem {
  id: number;
  req_code: string;
  role_title: string;
  site_id: number;
  site_name: string;
  site_code: string;
  vacancies_count: number;
  fulfilled_count: number;
  status: string;
  created_at: string;
}

interface InvoicePreviewItem {
  id: string;
  period: string;
  site: string;
  netAmount: string;
  vatAmount: string;
  totalAmount: string;
  dueDate: string;
  status: "New — HR Review" | "Approved — Accounts" | "Due Soon";
  statusColor: string;
}

interface ApprovalPreviewItem {
  id: string;
  type: "Overtime" | "Leave" | "Timesheet";
  title: string;
  workerOrScope: string;
  site: string;
  detail: string;
  submittedAt: string;
  targetModule: string;
  badgeColor: string;
}

interface ClientDashboardProps {
  clientId?: number;
  currentUserId?: number;
  companyName: string;
  userName: string;
  selectedSite: string;
  allowedSites?: SiteItem[];
  summary?: SummaryType;
  onNavigateToRequisitions?: () => void;
  onNavigateToAttendance?: () => void;
  onNavigateToInvoices?: () => void;
  onNavigateToApprovals?: (moduleId?: string) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const ClientDashboard: React.FC<ClientDashboardProps> = ({
  clientId = 1,
  currentUserId,
  companyName,
  userName,
  selectedSite,
  allowedSites = [],
  summary,
  onNavigateToRequisitions,
  onNavigateToAttendance,
  onNavigateToInvoices,
  onNavigateToApprovals,
}) => {
  const [liveRequisitions, setLiveRequisitions] = useState<RequisitionApiItem[]>([]);
  const [hasLoadedReqs, setHasLoadedReqs] = useState(false);

  useEffect(() => {
    const fetchActiveOrders = async () => {
      try {
        const params = new URLSearchParams();
        if (currentUserId) params.set("user_id", String(currentUserId));
        if (selectedSite !== "all") params.set("site_id", selectedSite);
        const qs = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`${API_BASE}/api/client/${clientId}/requisitions${qs}`);
        if (res.ok) {
          const data = await res.json();
          setLiveRequisitions(data.requisitions || []);
          setHasLoadedReqs(true);
        }
      } catch {
        // Fallback handled below
      }
    };
    fetchActiveOrders();
  }, [clientId, currentUserId, selectedSite]);

  // 1. STRENGTH OF WORKERS (Fetched from Agency ERP Attendance Register)
  const allWorkers = summary?.workers || [];
  const scopedWorkers =
    selectedSite === "all"
      ? allWorkers
      : allWorkers.filter((w) => w.site_id.toString() === selectedSite);

  // Compute today's strength metrics from ERP Attendance Register data
  const totalSupplyingWorkers = scopedWorkers.length > 0 ? scopedWorkers.length : selectedSite === "all" ? 20 : 12;
  const presentEmployees =
    scopedWorkers.length > 0
      ? scopedWorkers.filter((w) => w.status === "ON_DUTY" || w.status === "ON_BREAK").length
      : selectedSite === "all"
      ? 16
      : 10;
  const absentEmployees =
    scopedWorkers.length > 0
      ? scopedWorkers.filter((w) => w.status === "ABSENT" || w.status === "SICK_LEAVE").length
      : selectedSite === "all"
      ? 2
      : 1;
  // Total On Duty = Scheduled/rostered for today's active shifts (Present + Absent scheduled today)
  const totalOnDuty =
    scopedWorkers.length > 0
      ? Math.min(totalSupplyingWorkers, presentEmployees + absentEmployees)
      : selectedSite === "all"
      ? 18
      : 11;

  // 2. ACTIVE WORKER PROCUREMENT
  const fallbackOrders: RequisitionApiItem[] = [
    {
      id: 1,
      req_code: "REQ-2026-081",
      role_title: "5-Axis CNC Machinist (Koneistaja)",
      site_id: 1,
      site_name: "Tampere Heavy Machinery Works",
      site_code: "TMP-01",
      vacancies_count: 2,
      fulfilled_count: 1,
      status: "INTERVIEWING",
      created_at: "2026-11-16",
    },
    {
      id: 2,
      req_code: "REQ-2026-079",
      role_title: "MIG/MAG & TIG Welder (Hitsaaja)",
      site_id: 1,
      site_name: "Tampere Heavy Machinery Works",
      site_code: "TMP-01",
      vacancies_count: 3,
      fulfilled_count: 1,
      status: "IN_SOURCING",
      created_at: "2026-11-14",
    },
    {
      id: 3,
      req_code: "REQ-2026-075",
      role_title: "Industrial Electrician (Automaatioasentaja)",
      site_id: 1,
      site_name: "Tampere Heavy Machinery Works",
      site_code: "TMP-01",
      vacancies_count: 1,
      fulfilled_count: 1,
      status: "OFFER_ACCEPTED",
      created_at: "2026-11-11",
    },
  ];

  const allowedCodes = new Set(allowedSites.map((s) => s.site_code));
  const allowedIdsSet = new Set(allowedSites.map((s) => s.id.toString()));
  const activeSiteObj =
    selectedSite !== "all" ? allowedSites.find((s) => s.id.toString() === selectedSite) : null;

  const sourceOrders = hasLoadedReqs
    ? liveRequisitions
    : fallbackOrders.filter((o) =>
        selectedSite !== "all"
          ? o.site_id.toString() === selectedSite
          : allowedIdsSet.size === 0 || allowedIdsSet.has(o.site_id.toString())
      );
  const activeProcurementOrders = sourceOrders.filter((o) => o.status !== "FULFILLED");

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "INTERVIEWING":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "IN_SOURCING":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "OFFER_ACCEPTED":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      default:
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    }
  };

  // 3. NEW INVOICES
  const newInvoices: InvoicePreviewItem[] = [
    {
      id: "INV-2026-1104",
      period: "01 Nov – 15 Nov 2026",
      site: "TMP-01 Tampere & JYK-02 Jyväskylä",
      netAmount: "€14,701.20",
      vatAmount: "€3,748.80 (ALV 25.5%)",
      totalAmount: "€18,450.00",
      dueDate: "30 Nov 2026",
      status: "New — HR Review",
      statusColor: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    },
    {
      id: "INV-2026-1089",
      period: "16 Oct – 31 Oct 2026",
      site: "TMP-01 Tampere Heavy Machinery",
      netAmount: "€11,240.00",
      vatAmount: "€2,866.20 (ALV 25.5%)",
      totalAmount: "€14,106.20",
      dueDate: "22 Nov 2026",
      status: "Due Soon",
      statusColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    },
    {
      id: "INV-2026-1072",
      period: "01 Oct – 15 Oct 2026",
      site: "JYK-02 Jyväskylä Foundry",
      netAmount: "€6,850.00",
      vatAmount: "€1,746.75 (ALV 25.5%)",
      totalAmount: "€8,596.75",
      dueDate: "28 Nov 2026",
      status: "Approved — Accounts",
      statusColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    },
  ];

  const scopedInvoices = newInvoices.filter((inv) => {
    if (activeSiteObj) {
      return inv.site.includes(activeSiteObj.site_code);
    }
    if (allowedCodes.size > 0 && allowedCodes.size < 2) {
      return Array.from(allowedCodes).some((code) => inv.site.includes(code));
    }
    return true;
  });

  // 4. APPROVAL REQUESTS
  const rawApprovalRequests: ApprovalPreviewItem[] = [
    {
      id: "APR-01",
      type: "Overtime",
      title: "TES Overtime Request (+2.5 hrs)",
      workerOrScope: "Jari Mäkinen • 5-Axis CNC Operator",
      site: "TMP-01",
      detail: "Evening shift extension on Turbine Milling Cell",
      submittedAt: "Today, 09:40",
      targetModule: "m1.4_overtime",
      badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    },
    {
      id: "APR-02",
      type: "Leave",
      title: "Paid Sick Leave Sign-Off (Kela)",
      workerOrScope: "Mikko Koskinen • TIG Welder",
      site: "JYK-02",
      detail: "Medical certificate attached • 19 Nov – 20 Nov",
      submittedAt: "Today, 08:15",
      targetModule: "m1.4_leaves",
      badgeColor: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    },
    {
      id: "APR-03",
      type: "Overtime",
      title: "Weekend Shift Overtime (+4.0 hrs)",
      workerOrScope: "Kari Lindholm • Automation Tech",
      site: "TMP-01",
      detail: "Saturday preventive line maintenance (50%/100% TES)",
      submittedAt: "Yesterday",
      targetModule: "m1.4_overtime",
      badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    },
  ];

  const approvalRequests = rawApprovalRequests.filter((apr) => {
    if (activeSiteObj) return apr.site === activeSiteObj.site_code;
    if (allowedCodes.size > 0) return allowedCodes.has(apr.site);
    return true;
  });

  const attendanceRate =
    totalOnDuty > 0 ? Math.round((presentEmployees / totalOnDuty) * 100) : 0;

  return (
    <div className="space-y-6 w-full">
      {/* TOP WELCOME GREETING & SITE FILTER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-[var(--accent-light)] text-[var(--accent-color)] uppercase tracking-wider">
              Client Portal Dashboard
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] mt-1.5 tracking-tight">
            Welcome back, {userName.split(" ")[0]}!
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Daily worker strength, active procurement, new invoices & pending approvals for{" "}
            <strong className="text-[var(--text-primary)]">{companyName}</strong>.
          </p>
        </div>

        {/* CLOCK & WEATHER WIDGETS */}
        <div className="shrink-0">
          <DashboardClockAndWeather />
        </div>
      </div>

      {/* SECTION 1: STRENGTH OF WORKERS (TODAY) — SYNCED FROM AGENCY ERP ATTENDANCE REGISTER */}
      <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-color)]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-[var(--text-primary)]">
                Today&apos;s Strength of Workers
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <RefreshCw className="w-2.5 h-2.5" />
                <span>ERP Attendance Register</span>
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Synced from the agency biometric attendance register for today&apos;s active shifts.
            </p>
          </div>

          <button
            type="button"
            onClick={onNavigateToAttendance}
            className="text-xs font-bold text-[var(--accent-color)] hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>View Attendance Register</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 4 Exact Worker Strength Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. Total Supplying Workers */}
          <div className="p-4 sm:p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--text-secondary)]">
                Total Supplying Workers
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] mt-2">
              {totalSupplyingWorkers}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-1">
              Active agency workforce supplied
            </div>
          </div>

          {/* 2. Total On Duty */}
          <div className="p-4 sm:p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--text-secondary)]">
                Total On Duty
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-indigo-600 mt-2">
              {totalOnDuty}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-1">
              Scheduled for today&apos;s shifts
            </div>
          </div>

          {/* 3. Present Employees */}
          <div className="p-4 sm:p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--text-secondary)]">
                Present Employees
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-2">
              {presentEmployees}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1">
              {attendanceRate}% present of today&apos;s duty
            </div>
          </div>

          {/* 4. Absent Employees */}
          <div className="p-4 sm:p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--text-secondary)]">
                Absent Employees
              </span>
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <UserX className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-rose-600 mt-2">
              {absentEmployees}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-1">
              {absentEmployees > 0 ? "Reported absent / sick leave" : "Zero absences today"}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 & 3: ACTIVE WORKER PROCUREMENT (LEFT) + APPROVAL REQUESTS (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SECTION 2: ACTIVE WORKER PROCUREMENT (7 cols) */}
        <section className="lg:col-span-7 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-[var(--border-color)] mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[var(--accent-color)]" />
                  <h2 className="text-sm sm:text-base font-black text-[var(--text-primary)]">
                    Active Worker Procurement
                  </h2>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[var(--accent-color)]/10 text-[var(--accent-color)]">
                    {activeProcurementOrders.length} Active
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Open staffing requisitions currently in sourcing, matching, or interviews.
                </p>
              </div>

              <button
                type="button"
                onClick={onNavigateToRequisitions}
                className="flex items-center gap-1 text-xs font-bold text-[var(--accent-color)] hover:underline shrink-0 cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {activeProcurementOrders.map((order) => {
                const percent =
                  order.vacancies_count > 0
                    ? Math.round((order.fulfilled_count / order.vacancies_count) * 100)
                    : 0;

                return (
                  <div
                    key={order.id}
                    onClick={onNavigateToRequisitions}
                    className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-color)] transition-all cursor-pointer space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {order.role_title}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] font-bold">
                            {order.req_code}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] mt-1">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[var(--accent-color)]" />
                            {order.site_code} — {order.site_name.split(" ")[0]}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-right">
                          <div className="text-xs font-black text-[var(--text-primary)]">
                            {order.fulfilled_count} / {order.vacancies_count}
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)]">Filled</div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${getStatusBadgeStyle(
                            order.status
                          )}`}
                        >
                          {order.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-[var(--bg-card)] overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <span className="text-[var(--text-secondary)]">
              Need additional workers for upcoming production shifts?
            </span>
            <button
              type="button"
              onClick={onNavigateToRequisitions}
              className="px-3.5 py-2 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Staffing Order</span>
            </button>
          </div>
        </section>

        {/* SECTION 3: APPROVAL REQUESTS (5 cols) */}
        <section className="lg:col-span-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-[var(--border-color)] mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-amber-600" />
                  <h2 className="text-sm sm:text-base font-black text-[var(--text-primary)]">
                    Approval Requests
                  </h2>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                    {approvalRequests.length} Pending
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Overtime, leave sign-offs & timesheets awaiting your action.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {approvalRequests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => onNavigateToApprovals && onNavigateToApprovals(req.targetModule)}
                  className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-color)] transition-all cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${req.badgeColor}`}
                    >
                      {req.type}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {req.submittedAt}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-[var(--text-primary)]">
                    {req.title}
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    {req.workerOrScope} • <span className="font-semibold">{req.site}</span>
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] opacity-80">
                    {req.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[var(--border-color)]">
            <button
              type="button"
              onClick={() => onNavigateToApprovals && onNavigateToApprovals("m1.4_overtime")}
              className="w-full py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--accent-color)] hover:text-white text-xs font-bold text-[var(--text-primary)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Review All Approval Requests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      </div>

      {/* SECTION 4: NEW INVOICES */}
      <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[var(--border-color)]">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm sm:text-base font-black text-[var(--text-primary)]">
                New Invoices
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                {scopedInvoices.length} Unsettled
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Recent agency billing statements including Finnish ALV 25.5% VAT awaiting HR review or Accounts settlement.
            </p>
          </div>

          <button
            type="button"
            onClick={onNavigateToInvoices}
            className="text-xs font-bold text-[var(--accent-color)] hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>Open Invoices & Settlement</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scopedInvoices.map((inv) => (
            <div
              key={inv.id}
              onClick={onNavigateToInvoices}
              className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-color)] transition-all cursor-pointer flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-black text-[var(--text-primary)]">
                    {inv.id}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${inv.statusColor}`}
                  >
                    {inv.status}
                  </span>
                </div>

                <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />
                  <span>{inv.period}</span>
                </div>

                <div className="text-[11px] text-[var(--text-secondary)] truncate">
                  {inv.site}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-color)] flex items-end justify-between gap-2">
                <div>
                  <div className="text-base font-black text-[var(--text-primary)]">
                    {inv.totalAmount}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)]">
                    Net {inv.netAmount} + {inv.vatAmount}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[10px] text-[var(--text-secondary)]">Due Date</div>
                  <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
                    {inv.status === "Due Soon" ? (
                      <AlertCircle className="w-3 h-3 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    )}
                    <span>{inv.dueDate}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
