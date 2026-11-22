"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CalendarDays,
  FileCheck2,
  ShieldAlert,
  Receipt,
  SlidersHorizontal,
  LogOut,
  Clock,
  Building2,
  FileSpreadsheet,
  CalendarCheck2,
  UserCheck,
  CheckCircle,
  FileText,
  AlertTriangle,
  CreditCard,
  ChevronUp,
  Database,
  UserCog,
  UserPlus,
  GitBranch
} from "lucide-react";

interface SubMenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  description?: string;
  count?: number | null;
  statusBadge?: string | null;
}

interface BottomNavCategory {
  id: string;
  title: string;
  shortLabel: string;
  icon: React.ElementType;
  items: SubMenuItem[];
}

interface BottomNavBarProps {
  activeModule: string;
  setActiveModule: (mod: string) => void;
  onOpenPreferences: () => void;
  onOpenProfile?: () => void;
  onLogout: () => void;
  companyName: string;
  userName: string;
  avatarUrl?: string;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeModule,
  setActiveModule,
  onOpenPreferences,
  onOpenProfile,
  onLogout,
  companyName,
  userName,
  avatarUrl,
}) => {
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close floating popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenCategoryId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const categories: BottomNavCategory[] = [
    {
      id: "grp_workforce",
      title: "Workforce Management",
      shortLabel: "Workforce",
      icon: Users,
      items: [
        {
          id: "m1.1_live",
          label: "Live Attendance",
          description: "Real-time plant punches & active worker counts",
          icon: Clock,
          statusBadge: "Live",
        },
        {
          id: "m1.1_sites",
          label: "Plant Facilities",
          description: "Production workshops, shifts & site lines",
          icon: Building2,
        },
      ],
    },
    {
      id: "grp_talent",
      title: "Talent Acquisition",
      shortLabel: "Talent",
      icon: Briefcase,
      items: [
        {
          id: "m1.2_req",
          label: "Job Requisitions",
          description: "Open staffing orders & client vacancies",
          icon: FileSpreadsheet,
        },
        {
          id: "m1.2_shortlist",
          label: "Candidate Matches",
          description: "AI-screened & qualified candidates",
          icon: Users,
          count: 4,
        },
        {
          id: "m1.2_interviews",
          label: "Interview Schedule",
          description: "Technical evaluations & client bookings",
          icon: CalendarCheck2,
          count: 1,
        },
        {
          id: "m1.2_relocation",
          label: "New Joining Status",
          description: "Relocation, DVV & Finnish immigration",
          icon: UserCheck,
          statusBadge: "2 Active",
        },
      ],
    },
    {
      id: "grp_rosters",
      title: "Shift Planning",
      shortLabel: "Rosters",
      icon: CalendarDays,
      items: [
        {
          id: "m1.3_builder",
          label: "Roster Schedule Builder",
          description: "Shift allocation matrix & line coverage",
          icon: CalendarDays,
        },
        {
          id: "m1.3_assignments",
          label: "Worker Shift Allocations",
          description: "Assign plant operators to daily shifts",
          icon: Clock,
        },
        {
          id: "m1.3_changes",
          label: "Shift Change Requests",
          description: "Approve swaps & sync ERP attendance register",
          icon: FileText,
        },
        {
          id: "m1.3_published",
          label: "Published Plant Rosters",
          description: "Confirmed plant schedules & shift notices",
          icon: CheckCircle,
        },
      ],
    },
    {
      id: "grp_approvals",
      title: "Approvals & Timesheets",
      shortLabel: "Approvals",
      icon: FileCheck2,
      items: [
        {
          id: "m1.4_leaves",
          label: "Leave Sign-Offs",
          description: "Statutory vacations & medical sick leaves",
          icon: FileText,
          count: 1,
        },
        {
          id: "m1.4_overtime",
          label: "Overtime Requests",
          description: "TES statutory extra-hour approvals",
          icon: Clock,
          count: 2,
        },
        {
          id: "m1.4_timesheets",
          label: "Biometric Timesheets",
          description: "Verified electronic plant gate punch cards",
          icon: FileCheck2,
        },
      ],
    },
    {
      id: "grp_governance",
      title: "Worker Operations & Safety",
      shortLabel: "Operations",
      icon: ShieldAlert,
      items: [
        {
          id: "m1.5_actions",
          label: "Worker Action Desk",
          description: "Plant incidents, notes & operator desk",
          icon: Users,
        },
        {
          id: "m1.5_safety",
          label: "Safety & Incident Logs",
          description: "Finnish occupational health & TES compliance",
          icon: AlertTriangle,
        },
      ],
    },
    {
      id: "grp_finance",
      title: "Invoices & Settlement",
      shortLabel: "Invoices",
      icon: Receipt,
      items: [
        {
          id: "m1.6_invoices",
          label: "Invoices & ALV 25.5%",
          description: "Monthly client billing statements & VAT",
          icon: Receipt,
          count: 1,
        },
        {
          id: "m1.6_payments",
          label: "Payment Reconciliation",
          description: "Bank settlements & payment verification",
          icon: CreditCard,
        },
        {
          id: "m1.6_credit",
          label: "Credit Notes & Adjustments",
          description: "Rate adjustments & invoice credit memos",
          icon: FileText,
        },
      ],
    },
    {
      id: "grp_master",
      title: "Master Data",
      shortLabel: "Masters",
      icon: Database,
      items: [
        {
          id: "m1.8_site_master",
          label: "Site & Facility Master",
          description: "Plant locations, TES sectors & terminals",
          icon: Building2,
        },
        {
          id: "m1.8_user_master",
          label: "User Directory Master",
          description: "Master registry of client portal accounts",
          icon: Users,
        },
        {
          id: "m1.8_job_role_master",
          label: "Internal Job Role Master",
          description: "Client designations (HR Head, HR Manager, etc.)",
          icon: Briefcase,
        },
        {
          id: "m1.8_shift_master",
          label: "Shift Schedule Master",
          description: "Standard plant shifts & TES allowance rules",
          icon: Clock,
        },
        {
          id: "m1.8_approval_flow_master",
          label: "Master Approval Flow",
          description: "Multi-level approval stages & designated approvers",
          icon: GitBranch,
        },
      ],
    },
    {
      id: "grp_users",
      title: "User Management",
      shortLabel: "Users",
      icon: UserCog,
      items: [
        {
          id: "m1.9_user_list",
          label: "User Directory",
          description: "View, edit & manage created client users",
          icon: Users,
        },
        {
          id: "m1.9_create_user",
          label: "Create New User",
          description: "Onboard operational user & assign sites",
          icon: UserPlus,
        },
      ],
    },
  ];

  const handleCategoryClick = (catId: string) => {
    setOpenCategoryId((prev) => (prev === catId ? null : catId));
  };

  const handleSubItemSelect = (subId: string) => {
    setActiveModule(subId);
    setOpenCategoryId(null);
  };

  const activeCategory = categories.find((c) =>
    c.items.some((item) => item.id === activeModule || (activeModule === "m1.1" && item.id === "m1.1_live"))
  );

  const openCategory = categories.find((c) => c.id === openCategoryId);

  return (
    <nav
      ref={containerRef}
      className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[98vw] sm:max-w-[96vw] bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 shadow-[0_16px_50px_rgba(0,0,0,0.18)] dark:shadow-[0_16px_50px_rgba(0,0,0,0.6)] rounded-2xl sm:rounded-full px-2 sm:px-3 py-1.5 sm:py-2 transition-all ring-1 ring-black/5"
    >
      {/* 100% Solid Floating Landscape Tiled Popover Submenu */}
      {openCategory && (
        <div
          className={`absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 shadow-[0_25px_65px_-10px_rgba(0,0,0,0.35)] dark:shadow-[0_25px_65px_-10px_rgba(0,0,0,0.85)] rounded-3xl p-3.5 sm:p-4.5 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/5 dark:ring-white/10 ${
            openCategory.items.length === 2
              ? "w-[92vw] sm:w-[480px] md:w-[520px]"
              : openCategory.items.length === 3
              ? "w-[94vw] sm:w-[620px] md:w-[690px]"
              : "w-[95vw] sm:w-[740px] md:w-[840px]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                {React.createElement(openCategory.icon, { className: "w-4 h-4" })}
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-none">
                  {openCategory.title}
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Landscape Tile View &bull; Select module to navigate
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {openCategory.items.length} Modules
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenCategoryId(null);
                }}
                className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-xs transition-colors"
                title="Close submenu"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Landscape Tiled Grid */}
          <div
            className={`grid gap-2.5 sm:gap-3 ${
              openCategory.items.length === 2
                ? "grid-cols-1 sm:grid-cols-2"
                : openCategory.items.length === 3
                ? "grid-cols-1 sm:grid-cols-3"
                : "grid-cols-2 sm:grid-cols-4"
            }`}
          >
            {openCategory.items.map((sub) => {
              const SubIcon = sub.icon;
              const isSubActive =
                activeModule === sub.id || (activeModule === "m1.1" && sub.id === "m1.1_live");

              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => handleSubItemSelect(sub.id)}
                  className={`group relative text-left p-3.5 sm:p-4 rounded-2xl border transition-all duration-150 flex flex-col justify-between min-h-[96px] sm:min-h-[110px] ${
                    isSubActive
                      ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/25 ring-2 ring-blue-400/40"
                      : "bg-slate-50/80 dark:bg-slate-900/60 hover:bg-blue-50/80 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-800 hover:border-blue-400/60 dark:hover:border-blue-500/40 shadow-xs hover:shadow-md hover:-translate-y-0.5"
                  }`}
                >
                  {/* Top Row: Squircle Icon & Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                        isSubActive
                          ? "bg-white/20 text-white"
                          : "bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                      }`}
                    >
                      <SubIcon className="w-4 h-4 shrink-0" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {sub.statusBadge && (
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isSubActive
                              ? "bg-white/20 text-white"
                              : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          }`}
                        >
                          {sub.statusBadge}
                        </span>
                      )}

                      {sub.count !== undefined && sub.count !== null && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isSubActive
                              ? "bg-white/20 text-white"
                              : "bg-amber-500/15 text-amber-600 border border-amber-500/25"
                          }`}
                        >
                          {sub.count}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Row: Title and Short Subtitle */}
                  <div>
                    <div
                      className={`text-xs sm:text-[13px] font-bold tracking-tight mb-0.5 leading-snug line-clamp-1 ${
                        isSubActive
                          ? "text-white"
                          : "text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-300"
                      }`}
                    >
                      {sub.label}
                    </div>
                    {sub.description && (
                      <p
                        className={`text-[10px] sm:text-[11px] leading-tight line-clamp-2 ${
                          isSubActive ? "text-blue-100" : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {sub.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-0.5 sm:gap-2">
        {/* Brand / Company Pill */}
        <div className="hidden lg:flex items-center gap-2 pl-1 pr-3 border-r border-slate-200 dark:border-slate-800">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-xs flex items-center justify-center shadow-sm">
            S
          </div>
          <div className="truncate max-w-[120px]">
            <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">{companyName}</div>
            <div className="text-[9px] text-slate-500 dark:text-slate-400 truncate">Floating Dock</div>
          </div>
        </div>

        {/* 1. Primary Dashboard Button */}
        <button
          type="button"
          onClick={() => {
            setActiveModule("dashboard");
            setOpenCategoryId(null);
          }}
          className={`flex flex-col items-center justify-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition-all relative ${
            activeModule === "dashboard"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" />
          <span className="text-[9px] sm:text-[10px] tracking-tight">Dashboard</span>
        </button>

        {/* 2. Category Dock Buttons */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 flex-1 justify-center">
          {categories.map((cat) => {
            const CatIcon = cat.icon;
            const isCatActive = activeCategory?.id === cat.id;
            const isMenuOpen = openCategoryId === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryClick(cat.id)}
                className={`flex flex-col items-center justify-center px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-semibold transition-all relative ${
                  isMenuOpen || isCatActive
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold ring-1 ring-blue-500/30"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <div className="relative">
                  <CatIcon className="w-3.5 sm:w-4 h-3.5 sm:h-4 mb-0.5" />
                  {isMenuOpen && (
                    <ChevronUp className="w-2.5 h-2.5 absolute -top-1 -right-2 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <span className="text-[9px] sm:text-[10px] tracking-tight">{cat.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* 3. Settings & Sign Out Controls */}
        <div className="flex items-center gap-1 pl-1 sm:pl-2 border-l border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onOpenProfile}
            title="Edit Profile & Account Settings"
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs cursor-pointer transition-all"
          >
            <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
              ) : (
                userName.split(" ").map((n) => n[0]).join("").slice(0, 2)
              )}
            </div>
            <span className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[85px]">{userName.split(" ")[0]}</span>
          </button>

          <button
            type="button"
            onClick={onOpenPreferences}
            title="UI Preferences (Theme, Font & Layout)"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onLogout}
            title="Sign out of Client Portal"
            className="p-2 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
};
