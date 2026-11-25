"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Search,
  SlidersHorizontal,
  Bell,
  MessageSquare,
  Building,
  ArrowLeft,
  X,
  CheckCheck,
  Workflow,
  Menu,
} from "lucide-react";

export interface NotificationItem {
  id: number;
  client_id: number;
  user_id?: number | null;
  title: string;
  message: string;
  notification_type: string;
  approval_type?: string | null;
  approver_level?: string | null;
  next_level_approver?: string | null;
  target_module?: string | null;
  reference_id?: number | null;
  is_read: boolean;
  created_at: string;
}

interface ClientHeaderProps {
  activeModule: string;
  canGoBack?: boolean;
  onNavigateBack?: () => void;
  onNavigateToDashboard?: () => void;
  onToggleMobileMenu?: () => void;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  selectedSite: string;
  setSelectedSite: (site: string) => void;
  sites: Array<{ id: number; site_name: string; site_code: string }>;
  canSwitchSite?: boolean;
  onOpenPreferences: () => void;
  onOpenProfile?: () => void;
  onOpenMessaging?: () => void;
  onNavigateToModule?: (moduleId: string) => void;
  unreadMessagesCount?: number;
  currentUser?: { fullName: string; role: string; avatarUrl?: string } | null;
  isLoading?: boolean;
  clientId?: number;
  currentUserId?: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const ClientHeader: React.FC<ClientHeaderProps> = ({
  activeModule,
  canGoBack,
  onNavigateBack,
  onToggleMobileMenu,
  selectedSite,
  setSelectedSite,
  sites,
  canSwitchSite,
  onOpenPreferences,
  onOpenProfile,
  onOpenMessaging,
  onNavigateToModule,
  unreadMessagesCount = 0,
  currentUser,
  clientId = 1,
  currentUserId,
}) => {
  const [isSearchExploded, setIsSearchExploded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Notification Drawer / Popover State
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!clientId) return;
    setIsLoadingNotifs(true);
    try {
      const url = currentUserId
        ? `${API_BASE}/api/client/${clientId}/notifications?user_id=${currentUserId}`
        : `${API_BASE}/api/client/${clientId}/notifications`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data || []);
      }
    } catch {
      // ignore network errors
    } finally {
      setIsLoadingNotifs(false);
    }
  }, [clientId, currentUserId]);

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 15000); // Poll every 15s
    const handleRefresh = () => {
      fetchNotifications();
    };
    window.addEventListener("refresh-notifications", handleRefresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("refresh-notifications", handleRefresh);
    };
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notifId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await fetch(`${API_BASE}/api/client/${clientId}/notifications/${notifId}/read`, {
        method: "POST",
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      const url = currentUserId
        ? `${API_BASE}/api/client/${clientId}/notifications/mark-all-read?user_id=${currentUserId}`
        : `${API_BASE}/api/client/${clientId}/notifications/mark-all-read`;
      await fetch(url, { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {}
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (isSearchExploded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExploded]);

  // Collapse search & notification when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        if (!searchQuery.trim()) {
          setIsSearchExploded(false);
        }
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [searchQuery]);

  const getBreadcrumbTitle = (mod: string) => {
    switch (mod) {
      case "dashboard":
        return "Executive Dashboard";
      case "m1.1_live":
      case "m1.1":
        return "Workforce / Live Attendance";
      case "m1.1_sites":
        return "Workforce / Plant Facilities";
      case "m1.2_req":
        return "Talent Acquisition / Job Requisitions";
      case "m1.2_shortlist":
        return "Talent Acquisition / Candidate Matches";
      case "m1.2_interviews":
        return "Talent Acquisition / Interview Schedule";
      case "m1.2_relocation":
        return "Talent Acquisition / New Joining Status";
      case "m1.3_builder":
      case "m1.3_assignments":
      case "m1.3_published":
        return "Shift Planning / Rosters";
      case "m1.4_leaves":
      case "m1.4_overtime":
      case "m1.4_timesheets":
        return "Approvals & Timesheets";
      case "m1.5_actions":
      case "m1.5_safety":
        return "Worker Operations & Safety";
      case "m1.6_invoices":
      case "m1.6_payments":
      case "m1.6_credit":
        return "Invoices & Settlement";
      case "m1.8_site_master":
        return "Master Data / Site & Facility Master";
      case "m1.8_user_master":
        return "Master Data / User Directory Master";
      case "m1.8_job_role_master":
        return "Master Data / Internal Job Role Master";
      case "m1.8_shift_master":
        return "Master Data / Shift Schedule Master";
      case "m1.8_approval_flow_master":
        return "Master Data / Master Approval Flow";
      case "m1.9_user_list":
        return "User Management / User Directory";
      case "m1.9_create_user":
        return "User Management / Create New User";
      case "messaging":
        return "Team Communications / Messaging";
      default:
        return "Client Workspace";
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (diffSec < 60) return "Just now";
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch {
      return "Recent";
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[var(--border-color)] bg-[var(--bg-header)] backdrop-blur-md px-3 sm:px-6 py-2.5 transition-colors">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Mobile Menu, Global Back Button, Module Breadcrumb & Site Selection */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          {/* Mobile Hamburger Drawer Toggle (Mobile & Tablet) */}
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              title="Open Navigation Menu"
              className="lg:hidden p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] hover:border-[var(--accent-color)] transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
            >
              <Menu className="w-4 h-4 text-[var(--accent-color)]" />
            </button>
          )}

          {canGoBack && onNavigateBack && (
            <button
              type="button"
              onClick={onNavigateBack}
              title="Go to previous page"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] hover:border-[var(--accent-color)] text-xs font-bold text-[var(--text-primary)] transition-all shadow-sm active:scale-95 group cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[var(--accent-color)] transition-transform group-hover:-translate-x-0.5" />
              <span className="hidden xs:inline">Back</span>
            </button>
          )}

          {activeModule !== "dashboard" && (
            <div className="hidden md:flex items-center gap-2 text-xs text-[var(--text-secondary)] font-medium">
              <span className="font-bold text-[var(--text-primary)] truncate max-w-[200px] lg:max-w-[260px]">
                {getBreadcrumbTitle(activeModule)}
              </span>
              <div className="h-4 w-px bg-[var(--border-color)] mx-1" />
            </div>
          )}

          {/* 1. Site Context Pill (Dropdown ONLY for multi-site users; static badge for single-site users) */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm shrink min-w-0 max-w-[130px] sm:max-w-none">
            <Building className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />
            {(canSwitchSite ?? sites.length > 1) ? (
              <select
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[var(--text-primary)] focus:outline-none cursor-pointer truncate w-full"
              >
                <option value="all">
                  All Sites ({sites.map((s) => s.site_code).join(", ")})
                </option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id.toString()}>
                    {s.site_code} — {s.site_name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {sites[0]
                  ? `${sites[0].site_code} — ${sites[0].site_name}`
                  : "Assigned Plant"}
              </span>
            )}
          </div>
        </div>

        {/* Right: Search Icon (Explodes on Hover), Preferences, Notification */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* 2. Search Icon (Explodes to Search Input on hover) */}
          <div
            ref={searchContainerRef}
            onMouseEnter={() => setIsSearchExploded(true)}
            onMouseLeave={() => {
              if (!searchQuery.trim()) {
                setIsSearchExploded(false);
              }
            }}
            className="relative flex items-center"
          >
            {!isSearchExploded ? (
              <button
                type="button"
                onMouseEnter={() => setIsSearchExploded(true)}
                title="Search worker, HETU, role (Hover to expand)"
                className="p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--accent-color)] hover:bg-[var(--bg-secondary)] transition-all shadow-sm cursor-pointer"
              >
                <Search className="w-4 h-4" />
              </button>
            ) : (
              <div className="relative flex items-center animate-in fade-in zoom-in-95 duration-150">
                <Search className="w-4 h-4 absolute left-3 text-[var(--accent-color)] pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search worker, HETU, role..."
                  className="w-56 sm:w-64 pl-9 pr-8 py-1.5 text-xs rounded-xl bg-[var(--bg-card)] border border-[var(--accent-color)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none ring-2 ring-[var(--accent-ring)] shadow-md"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setIsSearchExploded(false);
                  }}
                  className="absolute right-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-0.5 cursor-pointer"
                  title="Close Search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 3. Messaging (LinkedIn-Style Top Bar Launcher) */}
          {onOpenMessaging && (
            <button
              type="button"
              onClick={onOpenMessaging}
              title="Messaging & Team Chat"
              className={`relative p-2 rounded-xl border transition-all shadow-sm cursor-pointer ${
                activeModule === "messaging"
                  ? "border-[var(--accent-color)] bg-[var(--bg-secondary)] text-[var(--accent-color)]"
                  : "border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-black text-[9px] min-w-4 text-center ring-2 ring-white dark:ring-slate-900 animate-pulse">
                  {unreadMessagesCount}
                </span>
              )}
            </button>
          )}

          {/* 4. Preferences */}
          <button
            type="button"
            onClick={onOpenPreferences}
            title="UI Theme, Font & Layout Preferences"
            className="p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all shadow-sm cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* 5. Notification Center with Real-Time Approval Flow Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setIsNotifOpen(!isNotifOpen);
                if (!isNotifOpen) fetchNotifications();
              }}
              title="Notifications & Approval Assignments"
              className={`relative p-2 rounded-xl border transition-all shadow-sm cursor-pointer ${
                isNotifOpen
                  ? "border-[var(--accent-color)] bg-[var(--bg-secondary)] text-[var(--accent-color)]"
                  : "border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
              }`}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-black text-[9px] min-w-4 text-center ring-2 ring-white dark:ring-slate-900 animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Popover Dropdown */}
            {isNotifOpen && (
              <div className="absolute right-0 top-full mt-2 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="p-3.5 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[var(--accent-color)]/10 text-[var(--accent-color)] flex items-center justify-center">
                      <Bell className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[var(--text-primary)]">Notifications</h4>
                      <p className="text-[10px] text-[var(--text-secondary)]">
                        {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}` : "All notifications caught up"}
                      </p>
                    </div>
                  </div>

                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-[10px] font-bold text-[var(--accent-color)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck className="w-3 h-3" />
                      <span>Mark all read</span>
                    </button>
                  )}
                </div>

                {/* Notifications List */}
                <div className="max-h-[380px] overflow-y-auto divide-y divide-[var(--border-color)] custom-scrollbar">
                  {isLoadingNotifs && notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[var(--text-secondary)]">
                      Loading notifications...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] mx-auto flex items-center justify-center font-bold">
                        🔔
                      </div>
                      <p className="text-xs font-bold text-[var(--text-primary)]">No notifications yet</p>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                        When approval flows are configured or assigned to you, you will receive instant notifications here.
                      </p>
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const resolveTargetModule = (): string | null => {
                        if (n.target_module && n.target_module.trim()) {
                          return n.target_module.trim();
                        }
                        const hay = `${n.approval_type || ""} ${n.title || ""} ${n.message || ""}`.toLowerCase();
                        if (hay.includes("m1.2") || hay.includes("requisition") || hay.includes("work requirement") || hay.includes("req-")) {
                          return "m1.2_req";
                        }
                        if (hay.includes("m1.6") || hay.includes("invoice") || hay.includes("inv-")) {
                          return "m1.6_invoices";
                        }
                        if (hay.includes("m1.3_changes") || hay.includes("shift change")) {
                          return "m1.3_changes";
                        }
                        if (hay.includes("m1.3") || hay.includes("roster")) {
                          return "m1.3_builder";
                        }
                        if (hay.includes("m1.5_safety") || hay.includes("safety") || hay.includes("inc-")) {
                          return "m1.5_safety";
                        }
                        if (hay.includes("m1.5") || hay.includes("worker action")) {
                          return "m1.5_actions";
                        }
                        return null;
                      };

                      const targetModule = resolveTargetModule();
                      const shortDisplayText = (n.message || n.title || "").trim();

                      const handleCardClick = () => {
                        if (!n.is_read) {
                          handleMarkAsRead(n.id);
                        }
                        setIsNotifOpen(false);
                        if (targetModule && onNavigateToModule) {
                          onNavigateToModule(targetModule);
                          if (typeof window !== "undefined") {
                            setTimeout(() => {
                              window.dispatchEvent(
                                new CustomEvent("open-approval-target", {
                                  detail: {
                                    module: targetModule,
                                    referenceId: n.reference_id || null,
                                  },
                                })
                              );
                            }, 80);
                          }
                        }
                      };

                      return (
                        <div
                          key={n.id}
                          onClick={handleCardClick}
                          className={`px-3.5 py-3 transition-colors flex items-center gap-3 cursor-pointer ${
                            n.is_read
                              ? "bg-[var(--bg-card)] opacity-80 hover:bg-[var(--bg-secondary)]/60"
                              : "bg-[var(--accent-light)]/40 hover:bg-[var(--accent-light)]/70 border-l-3 border-l-[var(--accent-color)]"
                          }`}
                        >
                          <div className="shrink-0">
                            <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-[var(--accent-color)] flex items-center justify-center">
                              <Workflow className="w-3.5 h-3.5" />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-xs leading-snug ${
                                n.is_read ? "font-medium text-[var(--text-primary)]" : "font-bold text-[var(--text-primary)]"
                              }`}
                            >
                              {shortDisplayText}
                            </p>
                            <span className="text-[10px] text-[var(--text-secondary)] mt-0.5 block">
                              {formatTimeAgo(n.created_at)}
                            </span>
                          </div>

                          {!n.is_read && (
                            <span
                              title="Unread"
                              className="w-2 h-2 rounded-full bg-[var(--accent-color)] shrink-0"
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="p-2.5 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/50 text-center">
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    Notifications automatically sync with plant workflow triggers
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 5. User Profile Button */}
          {onOpenProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              title="Edit Profile & Account Settings"
              className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--accent-color)] hover:bg-[var(--bg-secondary)] transition-all shadow-sm cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-lg bg-[var(--accent-color)] text-white font-black text-[10px] flex items-center justify-center shadow-xs overflow-hidden">
                {currentUser?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : currentUser?.fullName ? (
                  currentUser.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                ) : (
                  "CA"
                )}
              </div>
              <span className="hidden md:inline-block text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-color)] max-w-[100px] truncate">
                {currentUser?.fullName ? currentUser.fullName.split(" ")[0] : "Profile"}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
