"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { ClientSidebar } from "../components/ClientSidebar";
import { ClientHeader } from "../components/ClientHeader";
import { ClientDashboard } from "../components/ClientDashboard";
import { LiveWorkforceDashboard } from "../components/LiveWorkforceDashboard";
import { TalentAcquisitionModule } from "../components/TalentAcquisitionModule";
import { RightRail } from "../components/RightRail";
import { BottomNavBar } from "../components/BottomNavBar";
import { PreferencesModal, MenuPositionType } from "../components/PreferencesModal";
import { SupervisorAdjustmentModal } from "../components/SupervisorAdjustmentModal";
import { ClientLogin } from "../components/ClientLogin";
import { PinSetupModal } from "../components/PinSetupModal";
import { FirstLoginPasswordModal } from "../components/FirstLoginPasswordModal";
import { ClientUserManagement, UserMgmtSubTab } from "../components/ClientUserManagement";
import { MasterDataModule, MasterSubTab } from "../components/MasterDataModule";
import { ShiftPlanningModule, RosterSubTab } from "../components/ShiftPlanningModule";
import { UserProfileModal } from "../components/UserProfileModal";
import { GlobalLoader } from "../components/GlobalLoader";
import { ArrowLeft, X } from "lucide-react";

export interface WorkerItem {
  worker_id: number;
  worker_name: string;
  site_id: number;
  site_name: string;
  role_title: string;
  tes_category: string;
  status: string;
  clock_in_time: string | null;
  last_punch_type: string | null;
  last_punch_time: string | null;
  shift_hours_so_far: number;
}

export interface SiteItem {
  id: number;
  client_id: number;
  site_name: string;
  site_code: string;
  city: string;
  address: string;
  postal_code: string;
  tes_industry_sector: string;
  biometric_terminal_id: string | null;
  is_active: boolean;
}

export interface SummaryType {
  client_id: number;
  client_name: string;
  total_deployed_headcount: number;
  currently_on_duty: number;
  on_scheduled_break: number;
  reported_absent_or_sick: number;
  sites_count: number;
  sites: SiteItem[];
  workers: WorkerItem[];
}

export interface CurrentUser {
  userId: number;
  fullName: string;
  email: string;
  role: string;
  clientId: number;
  clientName: string;
  assigned_site_ids?: string;
  mustChangePassword?: boolean;
  modulePermissions?: string;
  token: string;
  avatarUrl?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
}

interface SavedPinData {
  userId?: number;
  pin: string;
  length: 4 | 6;
  userEmail: string;
  userName: string;
  role?: string;
  assigned_site_ids?: string;
  modulePermissions?: string;
}

const INITIAL_SUMMARY: SummaryType = {
  client_id: 1,
  client_name: "Valmet Technologies Oy",
  total_deployed_headcount: 0,
  currently_on_duty: 0,
  on_scheduled_break: 0,
  reported_absent_or_sick: 0,
  sites_count: 2,
  sites: [
    {
      id: 1,
      client_id: 1,
      site_name: "Tampere Heavy Machinery Works",
      site_code: "TMP-01",
      city: "Tampere",
      address: "Lentokentänkatu 11",
      postal_code: "33900",
      tes_industry_sector: "Teknologiateollisuus TES",
      biometric_terminal_id: "BIO-TMP-GATE-A",
      is_active: true,
    },
    {
      id: 2,
      client_id: 1,
      site_name: "Jyväskylä Foundry & Automation",
      site_code: "JYK-02",
      city: "Jyväskylä",
      address: "Rautpohjankatu 1",
      postal_code: "40700",
      tes_industry_sector: "Teknologiateollisuus TES",
      biometric_terminal_id: "BIO-JYK-GATE-1",
      is_active: true,
    },
  ],
  workers: [],
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function ClientPortalPage() {
  // Authentication gate state
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Quick PIN setup and saved data
  const [savedPinData, setSavedPinData] = useState<SavedPinData | null>(null);
  const [isPinSetupOpen, setIsPinSetupOpen] = useState(false);

  const [activeModule, setActiveModuleState] = useState("dashboard");
  const [navHistory, setNavHistory] = useState<string[]>(["dashboard"]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoadingOverlay, setIsLoadingOverlay] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const loaderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initial load transition of 0.6s on startup/refresh
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const triggerLoader = useCallback((duration = 600) => {
    if (loaderTimeoutRef.current) {
      clearTimeout(loaderTimeoutRef.current);
    }
    setIsLoadingOverlay(true);
    loaderTimeoutRef.current = setTimeout(() => {
      setIsLoadingOverlay(false);
    }, duration);
  }, []);

  const navigateToModule = (newModule: string) => {
    setIsMobileMenuOpen(false);
    if (newModule !== activeModule) {
      triggerLoader(600);
      setNavHistory((prev) => [...prev, newModule]);
      setActiveModuleState(newModule);
    }
  };

  const handleNavigateBack = () => {
    triggerLoader(600);
    if (navHistory.length > 1) {
      const updated = [...navHistory];
      updated.pop();
      const prev = updated[updated.length - 1];
      setNavHistory(updated);
      setActiveModuleState(prev || "dashboard");
    } else {
      setActiveModuleState("dashboard");
      setNavHistory(["dashboard"]);
    }
  };

  const handleNavigateToDashboard = () => {
    triggerLoader(600);
    setActiveModuleState("dashboard");
    setNavHistory(["dashboard"]);
  };

  const handleSiteChange = (newSite: string) => {
    if (newSite !== selectedSite) {
      triggerLoader(600);
      setSelectedSite(newSite);
    }
  };

  // Menu Bar Position & Auto Session Timeout Preferences
  const [menuPosition, setMenuPosition] = useState<MenuPositionType>("left");
  const [sessionTimeoutSec, setSessionTimeoutSec] = useState<number>(180);
  const [idleWarningSec, setIdleWarningSec] = useState<number | null>(null);
  const [timeoutNotice, setTimeoutNotice] = useState<string>("");
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    try {
      const savedMenuPos = (localStorage.getItem("erp_menu_position") as MenuPositionType) || "left";
      setMenuPosition(savedMenuPos);
      const savedTimeout = Number(localStorage.getItem("erp_session_timeout_sec"));
      if (!Number.isNaN(savedTimeout) && savedTimeout >= 30 && savedTimeout <= 3600) {
        setSessionTimeoutSec(savedTimeout);
      }
    } catch {}
  }, []);

  const handleMenuPositionChange = (pos: MenuPositionType) => {
    setMenuPosition(pos);
    try {
      localStorage.setItem("erp_menu_position", pos);
    } catch {}
  };

  const handleSessionTimeoutChange = (sec: number) => {
    const clamped = Math.max(30, Math.min(3600, Math.round(sec) || 180));
    setSessionTimeoutSec(clamped);
    lastActivityRef.current = Date.now();
    setIdleWarningSec(null);
    try {
      localStorage.setItem("erp_session_timeout_sec", String(clamped));
    } catch {}
  };

  // Standby Auto-Session Timeout Tracker (Default: 180s)
  useEffect(() => {
    if (!currentUser) {
      setIdleWarningSec(null);
      return;
    }

    lastActivityRef.current = Date.now();
    const markActivity = () => {
      lastActivityRef.current = Date.now();
      setIdleWarningSec((prev) => (prev !== null ? null : prev));
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];
    events.forEach((ev) => window.addEventListener(ev, markActivity, { passive: true }));

    const interval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remaining = sessionTimeoutSec - elapsedSec;

      if (remaining <= 0) {
        if (currentUser) {
          fetch(`${API_BASE}/api/client/${currentUser.clientId}/chat/availability`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: currentUser.userId,
              availability_status: "OFFLINE",
            }),
          }).catch(() => {});
        }
        setIdleWarningSec(null);
        setCurrentUser(null);
        setSelectedSite("all");
        setTimeoutNotice(`Session timed out after ${sessionTimeoutSec}s of standby inactivity.`);
      } else if (remaining <= 15) {
        setIdleWarningSec(remaining);
      } else {
        setIdleWarningSec((prev) => (prev !== null ? null : prev));
      }
    }, 1000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, markActivity));
      clearInterval(interval);
    };
  }, [currentUser, sessionTimeoutSec]);

  const [activeTab, setActiveTab] = useState("overview");
  const [selectedSite, setSelectedSite] = useState("all");
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [summary, setSummary] = useState<SummaryType>(INITIAL_SUMMARY);

  // Supervisor modal state
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedShiftForAdjustment, setSelectedShiftForAdjustment] = useState<{
    shiftId: number;
    workerName: string;
    siteName: string;
    currentHours: number;
    breakMinutes: number;
  } | null>(null);

  // Load saved PIN on startup
  useEffect(() => {
    try {
      const pinJson = localStorage.getItem("suomistaff_client_pin");
      if (pinJson) {
        setSavedPinData(JSON.parse(pinJson));
      }
    } catch {}
  }, []);

  // Fetch live workforce from FastAPI backend
  const fetchWorkforceData = useCallback(async () => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      const url =
        selectedSite === "all"
          ? `${API_BASE}/api/client/${currentUser.clientId}/workforce/live`
          : `${API_BASE}/api/client/${currentUser.clientId}/workforce/live?site_id=${selectedSite}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch {
      // Backend not running yet or unreachable, maintain client-side state
    } finally {
      setIsSyncing(false);
    }
  }, [selectedSite, currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchWorkforceData();
    }
  }, [fetchWorkforceData, currentUser]);

  // Login Handler
  const handleLoginSuccess = (userData: CurrentUser) => {
    setTimeoutNotice("");
    lastActivityRef.current = Date.now();

    // Mark status as ONLINE in chat presence
    fetch(`${API_BASE}/api/client/${userData.clientId}/chat/availability`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userData.userId,
        availability_status: "ONLINE",
      }),
    }).catch(() => {});

    const savedAvatar = localStorage.getItem(`erp_user_avatar_${userData.userId}`) || "";
    const savedPhone = localStorage.getItem(`user_phone_${userData.userId}`) || "";
    const savedTitle = localStorage.getItem(`user_title_${userData.userId}`) || "";
    const savedDept = localStorage.getItem(`user_dept_${userData.userId}`) || "";

    setCurrentUser({
      ...userData,
      avatarUrl: savedAvatar,
      phone: savedPhone,
      jobTitle: savedTitle,
      department: savedDept,
    });
    const assigned = (userData.assigned_site_ids || "*").trim();
    if (assigned !== "*" && assigned.toLowerCase() !== "all" && !assigned.includes(",")) {
      setSelectedSite(assigned);
    } else {
      setSelectedSite("all");
    }

    // If user must change default password on first login, hold off PIN setup until after password change
    if (userData.mustChangePassword) {
      setIsPinSetupOpen(false);
      return;
    }

    // Check if user has already set up or skipped PIN
    try {
      const pinConfigured = localStorage.getItem(`suomistaff_pin_configured_${userData.userId}`);
      if (!pinConfigured) {
        setIsPinSetupOpen(true);
      }
    } catch {}
  };

  const handleFirstPasswordChanged = () => {
    if (!currentUser) return;
    setCurrentUser({ ...currentUser, mustChangePassword: false });
    try {
      const pinConfigured = localStorage.getItem(`suomistaff_pin_configured_${currentUser.userId}`);
      if (!pinConfigured) {
        setIsPinSetupOpen(true);
      }
    } catch {}
  };

  const handleProfileUpdated = (updated: {
    fullName: string;
    email: string;
    role?: string;
    avatarUrl?: string;
    phone?: string;
    jobTitle?: string;
    department?: string;
  }) => {
    setCurrentUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        fullName: updated.fullName,
        email: updated.email,
        role: updated.role || prev.role,
        avatarUrl: updated.avatarUrl !== undefined ? updated.avatarUrl : prev.avatarUrl,
        phone: updated.phone || prev.phone,
        jobTitle: updated.jobTitle || prev.jobTitle,
        department: updated.department || prev.department,
      };
    });
  };

  // PIN Setup Handlers
  const handlePinSaved = (newPin: string, length: 4 | 6) => {
    if (!currentUser) return;
    const pinData: SavedPinData = {
      userId: currentUser.userId,
      pin: newPin,
      length: length,
      userEmail: currentUser.email,
      userName: currentUser.fullName,
      role: currentUser.role,
      assigned_site_ids: currentUser.assigned_site_ids,
      modulePermissions: currentUser.modulePermissions,
    };
    setSavedPinData(pinData);
    try {
      localStorage.setItem("suomistaff_client_pin", JSON.stringify(pinData));
      localStorage.setItem(`suomistaff_pin_configured_${currentUser.userId}`, "true");
    } catch {}
    setIsPinSetupOpen(false);
  };

  const handlePinSkip = () => {
    if (currentUser) {
      try {
        localStorage.setItem(`suomistaff_pin_configured_${currentUser.userId}`, "skipped");
      } catch {}
    }
    setIsPinSetupOpen(false);
  };

  // Window unload listener: Set presence to OFFLINE when closing tab/browser
  useEffect(() => {
    if (!currentUser) return;
    const handleUnload = () => {
      fetch(`${API_BASE}/api/client/${currentUser.clientId}/chat/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUser.userId,
          availability_status: "OFFLINE",
        }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [currentUser]);

  // Logout Handler
  const handleLogout = () => {
    if (currentUser) {
      fetch(`${API_BASE}/api/client/${currentUser.clientId}/chat/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUser.userId,
          availability_status: "OFFLINE",
        }),
        keepalive: true,
      }).catch(() => {});
    }
    setCurrentUser(null);
    setSelectedSite("all");
  };

  // Simulate hardware punch
  const handleSimulatePunch = async (
    workerId: number,
    siteId: number,
    currentStatus: string
  ) => {
    setIsSyncing(true);
    const newDirection = currentStatus === "ON_DUTY" ? "CLOCK_OUT" : "CLOCK_IN";
    try {
      const payload = {
        device_id: siteId === 1 ? "BIO-TMP-GATE-A" : "BIO-JYK-GATE-1",
        worker_id: workerId,
        site_id: siteId,
        timestamp: new Date().toISOString(),
        direction: newDirection,
        verification_mode: "FACIAL_SCAN",
      };

      await fetch(`${API_BASE}/api/client/biometric/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Refetch
      await fetchWorkforceData();
    } catch {
      // Local fallback toggle
      setSummary((prev) => {
        const updatedWorkers: WorkerItem[] = prev.workers.map((w) => {
          if (w.worker_id === workerId) {
            const nextStatus = w.status === "ON_DUTY" ? "CLOCKED_OUT" : "ON_DUTY";
            return {
              ...w,
              status: nextStatus,
              clock_in_time: nextStatus === "ON_DUTY" ? new Date().toISOString() : w.clock_in_time,
              shift_hours_so_far: nextStatus === "CLOCKED_OUT" ? 8.0 : w.shift_hours_so_far,
            };
          }
          return w;
        });
        const onDutyCount = updatedWorkers.filter((w) => w.status === "ON_DUTY").length;
        return {
          ...prev,
          currently_on_duty: onDutyCount,
          workers: updatedWorkers,
        };
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenAdjustment = (worker: WorkerItem) => {
    setSelectedShiftForAdjustment({
      shiftId: worker.worker_id,
      workerName: worker.worker_name,
      siteName: worker.site_name,
      currentHours: worker.shift_hours_so_far || 8.0,
      breakMinutes: 30,
    });
    setIsAdjustmentOpen(true);
  };

  const handleConfirmAdjustment = async (
    shiftId: number,
    adjustedHours: number,
    breakMinutes: number,
    reason: string
  ) => {
    try {
      await fetch(`${API_BASE}/api/client/workforce/adjust-hours`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shift_id: shiftId,
          supervisor_name: currentUser?.fullName || "Tapio Saarinen",
          adjusted_regular_hours: adjustedHours,
          adjusted_break_minutes: breakMinutes,
          reason: reason,
        }),
      });
      await fetchWorkforceData();
    } catch {
      // Client-side fallback update
      setSummary((prev) => ({
        ...prev,
        workers: prev.workers.map((w) =>
          w.worker_id === shiftId
            ? { ...w, shift_hours_so_far: adjustedHours }
            : w
        ),
      }));
    }
  };

  // 1. IF NOT AUTHENTICATED: Display the dedicated Split-Screen Client Portal Login Gate
  if (!currentUser) {
    return (
      <>
        {timeoutNotice && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] px-4 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold shadow-xl flex items-center gap-3">
            <span>{timeoutNotice}</span>
            <button
              type="button"
              onClick={() => setTimeoutNotice("")}
              className="underline text-white/90 hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
        <ClientLogin
          onLoginSuccess={handleLoginSuccess}
          onOpenPreferences={() => setIsPreferencesOpen(true)}
          savedPinData={savedPinData}
        />
        <PreferencesModal
          isOpen={isPreferencesOpen}
          onClose={() => setIsPreferencesOpen(false)}
          menuPosition={menuPosition}
          onMenuPositionChange={handleMenuPositionChange}
          sessionTimeoutSec={sessionTimeoutSec}
          onSessionTimeoutChange={handleSessionTimeoutChange}
        />
        <GlobalLoader isLoading={isLoadingOverlay || isInitialLoading} />
      </>
    );
  }

  // Compute sites accessible to this logged-in user (RBAC site scoping)
  const assignedRaw = (currentUser.assigned_site_ids || "*").trim();
  const isAllSitesUser = assignedRaw === "*" || assignedRaw.toLowerCase() === "all" || assignedRaw === "";
  const allowedSiteIds = isAllSitesUser
    ? null
    : assignedRaw.split(",").map((id) => id.trim());
  const allowedSites = isAllSitesUser
    ? summary.sites
    : summary.sites.filter((s) => allowedSiteIds?.includes(s.id.toString()));
  const canSwitchSite = allowedSites.length > 1;

  // 2. IF AUTHENTICATED: Display the Full 3-Pane Client Portal Workspace
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-primary)]">
      {/* 1. Left Sidebar for Desktop (Rendered when menuPosition === 'left') */}
      {menuPosition === "left" && (
        <div className="hidden lg:flex shrink-0">
          <ClientSidebar
            activeModule={activeModule}
            setActiveModule={navigateToModule}
            onOpenPreferences={() => setIsPreferencesOpen(true)}
            onOpenProfile={() => setIsProfileOpen(true)}
            onLogout={handleLogout}
            companyName={summary.client_name}
            currentUser={currentUser}
          />
        </div>
      )}

      {/* Mobile Slide-Over Drawer for Tablets & Mobile (< 1024px) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden flex">
          {/* Dark Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Drawer Canvas */}
          <div className="relative w-80 max-w-[85vw] h-full bg-[var(--bg-sidebar)] shadow-2xl z-[101] flex flex-col animate-in slide-in-from-left duration-200">
            <div className="absolute top-3.5 right-3.5 z-20">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer shadow-xs"
                title="Close Navigation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ClientSidebar
              activeModule={activeModule}
              setActiveModule={(mod) => {
                navigateToModule(mod);
                setIsMobileMenuOpen(false);
              }}
              onOpenPreferences={() => {
                setIsPreferencesOpen(true);
                setIsMobileMenuOpen(false);
              }}
              onOpenProfile={() => {
                setIsProfileOpen(true);
                setIsMobileMenuOpen(false);
              }}
              onLogout={handleLogout}
              companyName={summary.client_name}
              currentUser={currentUser}
            />
          </div>
        </div>
      )}

      {/* 2. Main Area (Header + Canvas) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header with Back / Dashboard Navigation Controls & Mobile Menu Toggle */}
        <ClientHeader
          activeModule={activeModule}
          canGoBack={navHistory.length > 1 || activeModule !== "dashboard"}
          onNavigateBack={handleNavigateBack}
          onNavigateToDashboard={handleNavigateToDashboard}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          selectedSite={selectedSite}
          setSelectedSite={handleSiteChange}
          sites={allowedSites}
          canSwitchSite={canSwitchSite}
          onOpenPreferences={() => setIsPreferencesOpen(true)}
          onOpenProfile={() => setIsProfileOpen(true)}
          currentUser={currentUser}
          isLoading={isSyncing}
          clientId={currentUser.clientId}
          currentUserId={currentUser.userId}
        />

        {/* Scrollable Canvas */}
        <main className={`flex-1 overflow-y-auto p-3.5 sm:p-6 lg:p-8 transition-colors ${menuPosition === "bottom" ? "lg:pb-32 pb-6" : ""}`}>
          {activeModule === "dashboard" ? (
            <ClientDashboard
              clientId={currentUser.clientId}
              companyName={summary.client_name}
              userName={currentUser.fullName}
              selectedSite={selectedSite}
              summary={summary}
              onNavigateToAttendance={() => navigateToModule("m1.1_live")}
              onNavigateToRequisitions={() => navigateToModule("m1.2_req")}
              onNavigateToInvoices={() => navigateToModule("m1.6_invoices")}
              onNavigateToApprovals={(modId) => navigateToModule(modId || "m1.4_overtime")}
            />
          ) : activeModule.startsWith("m1.2") ? (
            <TalentAcquisitionModule
              clientId={currentUser.clientId}
              selectedSubTab={
                activeModule === "m1.2_shortlist"
                  ? "m1.2_shortlist"
                  : activeModule === "m1.2_interviews"
                  ? "m1.2_interviews"
                  : activeModule === "m1.2_relocation"
                  ? "m1.2_relocation"
                  : "m1.2_req"
              }
              onChangeSubTab={(tab) => navigateToModule(tab)}
              selectedSite={selectedSite}
              userName={currentUser.fullName}
            />
          ) : activeModule.startsWith("m1.3") ? (
            <ShiftPlanningModule
              clientId={currentUser.clientId}
              companyName={summary.client_name}
              userName={currentUser.fullName}
              selectedSite={selectedSite}
              sites={allowedSites.length > 0 ? allowedSites : summary.sites}
              activeSubTab={
                activeModule === "m1.3_assignments" ||
                activeModule === "m1.3_changes" ||
                activeModule === "m1.3_published"
                  ? (activeModule as RosterSubTab)
                  : "m1.3_builder"
              }
              onChangeSubTab={(tab) => navigateToModule(tab)}
            />
          ) : activeModule.startsWith("m1.8") ? (
            <MasterDataModule
              clientId={currentUser.clientId}
              companyName={summary.client_name}
              activeSubTab={
                activeModule === "m1.8_user_master" ||
                activeModule === "m1.8_job_role_master" ||
                activeModule === "m1.8_shift_master" ||
                activeModule === "m1.8_approval_flow_master"
                  ? (activeModule as MasterSubTab)
                  : "m1.8_site_master"
              }
              onChangeSubTab={(tab) => navigateToModule(tab)}
              sites={summary.sites}
              onRefreshSites={fetchWorkforceData}
              onNavigateToCreateUser={() => navigateToModule("m1.9_create_user")}
            />
          ) : activeModule.startsWith("m1.9") ? (
            <ClientUserManagement
              clientId={currentUser.clientId}
              companyName={summary.client_name}
              currentUserRole={currentUser.role}
              sites={summary.sites}
              activeSubTab={
                activeModule === "m1.9_create_user"
                  ? ("m1.9_create_user" as UserMgmtSubTab)
                  : ("m1.9_user_list" as UserMgmtSubTab)
              }
              onChangeSubTab={(tab) => navigateToModule(tab)}
            />
          ) : activeModule === "m1.1_live" || activeModule === "m1.1" ? (
            <LiveWorkforceDashboard
              summary={summary}
              selectedSite={selectedSite}
              setSelectedSite={handleSiteChange}
              onSimulatePunch={handleSimulatePunch}
              onOpenAdjustment={handleOpenAdjustment}
              isSyncing={isSyncing}
              onRefresh={() => {
                triggerLoader(600);
                fetchWorkforceData();
              }}
            />
          ) : (
            <div className="max-w-2xl mx-auto my-12 p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-[var(--accent-color)] mx-auto flex items-center justify-center font-bold text-lg">
                📁
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Module Workspace
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                  This sub-module is linked into the ERP workflow. You can return to the previous page or examine live plant shift attendance.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleNavigateBack}
                  className="px-4 py-2 rounded-xl bg-[var(--accent-color)] text-white text-xs font-bold hover:bg-[var(--accent-hover)] transition-all shadow-sm flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateToModule("m1.1_live")}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all"
                >
                  View Live Attendance
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 3. Internal Portal Chat Right Rail */}
      <RightRail
        clientId={currentUser.clientId}
        companyName={summary.client_name}
        currentUser={currentUser}
      />

      {/* 4. Bottom Side Bar (Rendered when menuPosition === 'bottom' on desktop only) */}
      {menuPosition === "bottom" && (
        <div className="hidden lg:block">
          <BottomNavBar
            activeModule={activeModule}
            setActiveModule={navigateToModule}
            onOpenPreferences={() => setIsPreferencesOpen(true)}
            onOpenProfile={() => setIsProfileOpen(true)}
            onLogout={handleLogout}
            companyName={summary.client_name}
            userName={currentUser.fullName}
            avatarUrl={currentUser.avatarUrl}
          />
        </div>
      )}

      {/* Mandatory First-Time Password Change Modal */}
      <FirstLoginPasswordModal
        isOpen={Boolean(currentUser.mustChangePassword)}
        userId={currentUser.userId}
        userName={currentUser.fullName}
        userEmail={currentUser.email}
        onPasswordChanged={handleFirstPasswordChanged}
        onLogout={handleLogout}
      />

      {/* First-Time PIN Setup Modal */}
      <PinSetupModal
        isOpen={isPinSetupOpen && !currentUser.mustChangePassword}
        userName={currentUser.fullName}
        onPinSaved={handlePinSaved}
        onSkip={handlePinSkip}
      />

      {/* Standby Inactivity 15-Second Countdown Banner */}
      {idleWarningSec !== null && (
        <div className="fixed bottom-5 right-5 z-[90] px-4 py-3 rounded-xl bg-amber-600 text-white text-xs font-bold shadow-2xl flex items-center gap-3">
          <span>Standby session timeout in {idleWarningSec}s</span>
          <button
            type="button"
            onClick={() => {
              lastActivityRef.current = Date.now();
              setIdleWarningSec(null);
            }}
            className="px-2.5 py-1 rounded-lg bg-white text-amber-700 font-bold text-[11px] cursor-pointer"
          >
            Stay Signed In
          </button>
        </div>
      )}

      {/* Preferences Modal (4 Modes, 5 Fonts, Menu Layout & Session Timeout) */}
      <PreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        menuPosition={menuPosition}
        onMenuPositionChange={handleMenuPositionChange}
        sessionTimeoutSec={sessionTimeoutSec}
        onSessionTimeoutChange={handleSessionTimeoutChange}
      />

      {/* User Profile & Account Settings Modal */}
      {currentUser && (
        <UserProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          currentUser={currentUser}
          sites={summary.sites}
          onProfileUpdated={handleProfileUpdated}
          onOpenPinSetup={() => setIsPinSetupOpen(true)}
        />
      )}

      {/* Supervisor Manual Adjustment Modal */}
      <SupervisorAdjustmentModal
        isOpen={isAdjustmentOpen}
        onClose={() => setIsAdjustmentOpen(false)}
        shiftData={selectedShiftForAdjustment}
        onConfirm={handleConfirmAdjustment}
      />

      {/* Global Animated Glow Loader */}
      <GlobalLoader isLoading={isLoadingOverlay || isInitialLoading} />
    </div>
  );
}
