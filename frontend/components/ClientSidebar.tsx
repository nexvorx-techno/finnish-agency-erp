"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarDays,
  FileCheck2,
  ShieldAlert,
  Receipt,
  LogOut,
  ChevronDown,
  ChevronRight,
  Briefcase,
  FileSpreadsheet,
  CalendarCheck2,
  UserCheck,
  Clock,
  CheckCircle,
  FileText,
  AlertTriangle,
  CreditCard,
  SlidersHorizontal,
  Database,
  UserCog,
  UserPlus,
  GitBranch,
  User,
  MessageSquare,
} from "lucide-react";

interface SubMenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  count?: number | null;
  statusBadge?: string | null;
}

interface NavGroup {
  id: string;
  title: string;
  icon: React.ElementType;
  items: SubMenuItem[];
}

interface ClientSidebarProps {
  activeModule: string;
  setActiveModule: (mod: string) => void;
  onOpenPreferences: () => void;
  onOpenProfile?: () => void;
  onLogout: () => void;
  companyName: string;
  currentUser: {
    fullName: string;
    role: string;
    email: string;
    modulePermissions?: string;
    avatarUrl?: string;
  } | null;
}

export const ClientSidebar: React.FC<ClientSidebarProps> = ({
  activeModule,
  setActiveModule,
  onOpenPreferences,
  onOpenProfile,
  onLogout,
  companyName,
  currentUser,
}) => {
  // Professional Enterprise Navigation Architecture (Inspired by Softcount / SAP / Workday)
  const navigationGroups: NavGroup[] = [
    {
      id: "grp_workforce",
      title: "Workforce Management",
      icon: Users,
      items: [
        {
          id: "m1.1_live",
          label: "Live Attendance",
          icon: Clock,
          statusBadge: "Live",
        },
        {
          id: "m1.1_sites",
          label: "Plant Facilities",
          icon: Building2,
        },
      ],
    },
    {
      id: "grp_talent",
      title: "Talent Acquisition",
      icon: Briefcase,
      items: [
        {
          id: "m1.2_req",
          label: "Job Requisitions",
          icon: FileSpreadsheet,
        },
        {
          id: "m1.2_shortlist",
          label: "Candidate Matches",
          icon: Users,
          count: 4,
        },
        {
          id: "m1.2_interviews",
          label: "Interview Schedule",
          icon: CalendarCheck2,
          count: 1,
        },
        {
          id: "m1.2_relocation",
          label: "New Joining Status",
          icon: UserCheck,
        },
      ],
    },
    {
      id: "grp_rosters",
      title: "Shift Planning",
      icon: CalendarDays,
      items: [
        {
          id: "m1.3_builder",
          label: "Roster Schedule Builder",
          icon: CalendarDays,
        },
        {
          id: "m1.3_assignments",
          label: "Worker Shift Allocations",
          icon: Clock,
        },
        {
          id: "m1.3_changes",
          label: "Shift Change Requests",
          icon: FileText,
        },
        {
          id: "m1.3_published",
          label: "Published Plant Rosters",
          icon: CheckCircle,
        },
      ],
    },
    {
      id: "grp_approvals",
      title: "Approvals & Timesheets",
      icon: FileCheck2,
      items: [
        {
          id: "m1.4_leaves",
          label: "Leave Sign-Offs",
          icon: FileText,
          count: 1,
        },
        {
          id: "m1.4_overtime",
          label: "Overtime Requests",
          icon: Clock,
          count: 2,
        },
        {
          id: "m1.4_timesheets",
          label: "Biometric Timesheets",
          icon: FileCheck2,
        },
      ],
    },
    {
      id: "grp_governance",
      title: "Worker Operations & Safety",
      icon: ShieldAlert,
      items: [
        {
          id: "m1.5_actions",
          label: "Worker Action Desk",
          icon: Users,
        },
        {
          id: "m1.5_safety",
          label: "Safety & Incident Logs",
          icon: AlertTriangle,
        },
      ],
    },
    {
      id: "grp_finance",
      title: "Invoices & Settlement",
      icon: Receipt,
      items: [
        {
          id: "m1.6_invoices",
          label: "Invoices & ALV 25.5%",
          icon: Receipt,
          count: 1,
        },
        {
          id: "m1.6_payments",
          label: "Payment Reconciliation",
          icon: CreditCard,
        },
        {
          id: "m1.6_credit",
          label: "Credit Notes & Adjustments",
          icon: FileText,
        },
      ],
    },
    {
      id: "grp_master",
      title: "Master Data",
      icon: Database,
      items: [
        {
          id: "m1.8_site_master",
          label: "Site & Facility Master",
          icon: Building2,
        },
        {
          id: "m1.8_user_master",
          label: "User Directory Master",
          icon: Users,
        },
        {
          id: "m1.8_job_role_master",
          label: "Internal Job Role Master",
          icon: Briefcase,
        },
        {
          id: "m1.8_shift_master",
          label: "Shift Schedule Master",
          icon: Clock,
        },
        {
          id: "m1.8_approval_flow_master",
          label: "Master Approval Flow",
          icon: GitBranch,
        },
      ],
    },
    {
      id: "grp_communications",
      title: "Communications",
      icon: MessageSquare,
      items: [
        {
          id: "messaging",
          label: "Team Messaging",
          icon: MessageSquare,
          statusBadge: "Live",
        },
      ],
    },
    {
      id: "grp_users",
      title: "User Management",
      icon: UserCog,
      items: [
        {
          id: "m1.9_user_list",
          label: "User Directory",
          icon: Users,
        },
        {
          id: "m1.9_create_user",
          label: "Create New User",
          icon: UserPlus,
        },
      ],
    },
  ];

  // Filter navigation groups based on assigned module permissions (Client Admin always sees all)
  const isAdminUser = ["CLIENT_ADMIN", "HR_ADMIN", "SUPER_ADMIN", "ADMIN"].includes(
    (currentUser?.role || "").toUpperCase()
  );
  const groupToPermKey: Record<string, string> = {
    grp_workforce: "workforce",
    grp_talent: "talent",
    grp_rosters: "rosters",
    grp_approvals: "approvals",
    grp_governance: "operations",
    grp_finance: "invoices",
    grp_master: "master_data",
  };
  let parsedPerms: Record<string, { view?: boolean }> | null = null;
  try {
    if (currentUser?.modulePermissions) {
      parsedPerms = JSON.parse(currentUser.modulePermissions);
    }
  } catch {}

  const visibleNavGroups = isAdminUser || !parsedPerms || (parsedPerms as Record<string, unknown>).all === true
    ? navigationGroups
    : navigationGroups.filter((grp) => {
        if (grp.id === "grp_users") return false; // User Management is Client Admin only
        const permKey = groupToPermKey[grp.id];
        return permKey ? Boolean(parsedPerms?.[permKey]?.view) : true;
      });

  // Expanded menu states
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const sidebarRef = useRef<HTMLElement>(null);

  // Auto-collapse submenus when clicking anywhere outside the sidebar
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setExpandedGroups({});
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const isCurrentlyOpen = !!prev[groupId];
      // Accordion single-open behavior: opening this collapses others, clicking again collapses it
      if (isCurrentlyOpen) {
        return {};
      }
      return { [groupId]: true };
    });
  };

  const handleSelectModule = (modId: string) => {
    setActiveModule(modId);
    // Auto-collapse submenus immediately when an item is selected
    setExpandedGroups({});
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <aside
      ref={sidebarRef}
      className="w-full lg:w-72 h-full lg:h-screen shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] flex flex-col justify-between select-none text-[var(--text-primary)] transition-all overflow-hidden"
    >
      {/* 1. TOP BRANDING & CLIENT CONTEXT */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Main Logo & Platform Label */}
        <div className="px-5 py-4 border-b border-[var(--border-color)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-base shadow-sm">
              S
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
                SuomiStaff ERP
              </div>
              <div className="text-[11px] font-medium text-[var(--text-secondary)]">
                Client Workspace
              </div>
            </div>
          </div>

          {/* Active Client Company Card */}
          <div className="mt-3.5 px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-[var(--accent-color)] shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                {companyName}
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] font-mono">
                Y-tunnus: 2516487-1
              </div>
            </div>
          </div>
        </div>

        {/* 2. ENTERPRISE NAVIGATION ACCORDION */}
        <nav className="p-3 space-y-1 overflow-y-auto flex-1 scrollbar-thin">
          {/* Top Dashboard Summary Button */}
          <div className="mb-2">
            <button
              type="button"
              onClick={() => handleSelectModule("dashboard")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeModule === "dashboard"
                  ? "bg-[var(--accent-color)] text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>Dashboard</span>
              </div>
              <span
                className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-extrabold tracking-wider ${
                  activeModule === "dashboard"
                    ? "bg-white/20 text-white"
                    : "bg-blue-500/10 text-blue-600"
                }`}
              >
                Overview
              </span>
            </button>
          </div>

          {visibleNavGroups.map((group) => {
            const GroupIcon = group.icon;
            const isExpanded = !!expandedGroups[group.id];
            const hasActiveChild = group.items.some(
              (item) => item.id === activeModule || (activeModule === "m1.1" && item.id === "m1.1_live")
            );

            return (
              <div key={group.id} className="mb-0.5">
                {/* Section Header (Clickable Accordion) */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    hasActiveChild
                      ? "text-[var(--accent-color)] bg-[var(--accent-light)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <GroupIcon className="w-4 h-4 shrink-0 opacity-80" />
                    <span className="truncate">{group.title}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    )}
                  </div>
                </button>

                {/* Sub-Items */}
                {isExpanded && (
                  <div className="mt-0.5 ml-3 pl-3 border-l border-[var(--border-color)] space-y-0.5">
                    {group.items.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSelected =
                        activeModule === sub.id || (activeModule === "m1.1" && sub.id === "m1.1_live");

                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleSelectModule(sub.id)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                            isSelected
                              ? "bg-[var(--accent-color)] text-white font-medium shadow-sm"
                              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] font-normal"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-white" : "opacity-70"}`} />
                            <span className="truncate">{sub.label}</span>
                          </div>

                          {/* Refined clean status badges */}
                          {sub.statusBadge && (
                            <span
                              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                                isSelected
                                  ? "bg-white/20 text-white"
                                  : "bg-emerald-500/10 text-emerald-600 font-bold"
                              }`}
                            >
                              {sub.statusBadge}
                            </span>
                          )}

                          {sub.count !== undefined && sub.count !== null && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                                isSelected
                                  ? "bg-white/20 text-white"
                                  : "bg-amber-500/15 text-amber-600"
                              }`}
                            >
                              {sub.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* 3. FOOTER USER PROFILE & SETTINGS */}
      <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <button
          type="button"
          onClick={onOpenProfile}
          className="w-full flex items-center justify-between px-2 py-1.5 mb-2 rounded-xl hover:bg-[var(--bg-card)] border border-transparent hover:border-[var(--border-color)] transition-all text-left cursor-pointer group"
          title="Click to view and edit current profile"
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-color)] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform overflow-hidden">
              {currentUser?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.fullName}
                  className="w-full h-full object-cover"
                />
              ) : currentUser ? (
                getInitials(currentUser.fullName)
              ) : (
                "JL"
              )}
            </div>
            <div className="truncate">
              <div className="text-xs font-bold leading-tight truncate text-[var(--text-primary)] group-hover:text-[var(--accent-color)] flex items-center gap-1">
                <span>{currentUser?.fullName || "Johanna Lehtonen"}</span>
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] truncate">
                {currentUser?.role === "HR_ADMIN"
                  ? "HR Director"
                  : currentUser?.role === "SITE_SUPERVISOR"
                  ? "Site Supervisor"
                  : "Client Administrator"}
              </div>
            </div>
          </div>
          <User className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-[var(--accent-color)] shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
        </button>

        <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-[var(--border-color)]">
          <button
            type="button"
            onClick={onOpenProfile}
            title="Edit Profile & Account Settings"
            className="flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent-color)] hover:bg-[var(--bg-card)] border border-transparent hover:border-[var(--border-color)] transition-all cursor-pointer"
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile</span>
          </button>

          <button
            type="button"
            onClick={onOpenPreferences}
            title="UI Theme & Font Preferences"
            className="flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] border border-transparent hover:border-[var(--border-color)] transition-all cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Prefs</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            title="Sign out of Client Portal"
            className="flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-xs font-medium text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
