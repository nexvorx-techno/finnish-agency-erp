"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Users,
  Briefcase,
  Clock,
  Plus,
  Trash2,
  Pencil,
  Check,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Lock,
  ArrowRight,
  Database,
  X,
  GitBranch,
  Workflow,
  CheckCheck,
  ChevronRight,
  Search,
  UserX,
  UserCheck,
  ArrowLeft,
} from "lucide-react";
import { SiteItem } from "../app/page";
import { ConfirmDialog } from "./ConfirmDialog";

export type MasterSubTab =
  | "m1.8_site_master"
  | "m1.8_user_master"
  | "m1.8_job_role_master"
  | "m1.8_shift_master"
  | "m1.8_approval_flow_master";

export interface ApprovalLevel {
  level: number;
  level_name: string;
  approver_type: "USER" | "ROLE";
  approver_id: number | null;
  approver_name: string;
  approver_email?: string | null;
  approver_role?: string | null;
  sla_hours: number;
  is_mandatory: boolean;
  auto_escalate: boolean;
}

export interface ApprovalFlow {
  id: number;
  client_id: number;
  flow_key: string;
  flow_name: string;
  description?: string | null;
  is_active: boolean;
  levels: ApprovalLevel[];
  updated_at?: string | null;
}

interface ClientUserRecord {
  id: number;
  full_name: string;
  email: string;
  role: string;
  assigned_site_ids: string;
  is_active: boolean;
  is_client_admin: boolean;
  assigned_by: string;
}

interface MasterDataModuleProps {
  clientId: number;
  companyName: string;
  activeSubTab: MasterSubTab;
  onChangeSubTab: (tab: MasterSubTab) => void;
  sites: SiteItem[];
  onRefreshSites?: () => void;
  onNavigateToCreateUser?: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const MasterDataModule: React.FC<MasterDataModuleProps> = ({
  clientId,
  companyName,
  activeSubTab,
  onChangeSubTab,
  sites,
  onRefreshSites,
  onNavigateToCreateUser,
}) => {
  const [users, setUsers] = useState<ClientUserRecord[]>([]);
  const [jobRoles, setJobRoles] = useState<string[]>([]);
  const [shifts, setShifts] = useState<string[]>([]);
  const [approvalFlows, setApprovalFlows] = useState<ApprovalFlow[]>([]);
  const [isSavingFlow, setIsSavingFlow] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Real Application Sub-Menus fetched from application architecture (ClientSidebar)
  const REAL_APPLICATION_SUBMENUS = [
    // 1. Workforce Management
    { id: "m1.1_live", label: "Live Attendance", groupTitle: "Workforce Management", icon: "⏱️" },
    { id: "m1.1_sites", label: "Plant Facilities", groupTitle: "Workforce Management", icon: "🏢" },
    // 2. Talent Acquisition
    { id: "m1.2_req", label: "Job Requisitions", groupTitle: "Talent Acquisition", icon: "💼" },
    { id: "m1.2_shortlist", label: "Candidate Matches", groupTitle: "Talent Acquisition", icon: "👥" },
    { id: "m1.2_interviews", label: "Interview Schedule", groupTitle: "Talent Acquisition", icon: "📅" },
    { id: "m1.2_relocation", label: "New Joining Status", groupTitle: "Talent Acquisition", icon: "✈️" },
    // 3. Shift Planning
    { id: "m1.3_builder", label: "Roster Schedule Builder", groupTitle: "Shift Planning", icon: "🗓️" },
    { id: "m1.3_assignments", label: "Worker Shift Allocations", groupTitle: "Shift Planning", icon: "🕒" },
    { id: "m1.3_changes", label: "Shift Change Requests", groupTitle: "Shift Planning", icon: "🔄" },
    { id: "m1.3_published", label: "Published Plant Rosters", groupTitle: "Shift Planning", icon: "📋" },
    // 4. Approvals & Timesheets
    { id: "m1.4_leaves", label: "Leave Sign-Offs", groupTitle: "Approvals & Timesheets", icon: "🏖️" },
    { id: "m1.4_overtime", label: "Overtime Requests", groupTitle: "Approvals & Timesheets", icon: "⏳" },
    { id: "m1.4_timesheets", label: "Biometric Timesheets", groupTitle: "Approvals & Timesheets", icon: "📊" },
    // 5. Worker Operations & Safety
    { id: "m1.5_actions", label: "Worker Action Desk", groupTitle: "Worker Operations & Safety", icon: "⚡" },
    { id: "m1.5_safety", label: "Safety & Incident Logs", groupTitle: "Worker Operations & Safety", icon: "⚠️" },
    // 6. Invoices & Settlement
    { id: "m1.6_invoices", label: "Invoices & ALV 25.5%", groupTitle: "Invoices & Settlement", icon: "🧾" },
    { id: "m1.6_payments", label: "Payment Reconciliation", groupTitle: "Invoices & Settlement", icon: "💳" },
    { id: "m1.6_credit", label: "Credit Notes & Adjustments", groupTitle: "Invoices & Settlement", icon: "📝" },
    // 7. Master Data
    { id: "m1.8_site_master", label: "Site & Facility Master", groupTitle: "Master Data", icon: "🏭" },
    { id: "m1.8_user_master", label: "User Directory Master", groupTitle: "Master Data", icon: "👤" },
    { id: "m1.8_job_role_master", label: "Internal Job Role Master", groupTitle: "Master Data", icon: "🏷️" },
    { id: "m1.8_shift_master", label: "Shift Schedule Master", groupTitle: "Master Data", icon: "⏰" },
    // 8. User Management
    { id: "m1.9_user_list", label: "User Directory", groupTitle: "User Management", icon: "👥" },
    { id: "m1.9_create_user", label: "Create New User", groupTitle: "User Management", icon: "➕" },
  ];

  // Master Approval Flow State:
  // When isFlowEditorOpen is false: default view shows the list of created approval flows
  // When isFlowEditorOpen is true: shows the create/edit flow canvas
  const [isFlowEditorOpen, setIsFlowEditorOpen] = useState(false);
  const [flowSearchQuery, setFlowSearchQuery] = useState("");
  const [moduleSearchQuery, setModuleSearchQuery] = useState("");

  const [activeModuleKey, setActiveModuleKey] = useState<string>("m1.2_req");
  const [simpleNumLevels, setSimpleNumLevels] = useState<number>(1);
  const [simpleApproverIds, setSimpleApproverIds] = useState<(number | null)[]>([null]);

  // Assign User Popup Modal State:
  const [assignUserModal, setAssignUserModal] = useState<{
    isOpen: boolean;
    levelIndex: number;
    searchQuery: string;
  }>({
    isOpen: false,
    levelIndex: 0,
    searchQuery: "",
  });

    // Notification Dispatch Confirmation Modal
  const [dispatchedNotifsModal, setDispatchedNotifsModal] = useState<{
    isOpen: boolean;
    flowName: string;
    notifications: Array<{
      approver_name: string;
      approval_type: string;
      approver_level: string;
      next_level_approver: string;
    }>;
  }>({ isOpen: false, flowName: "", notifications: [] });

  // Site create / edit form
  const [isSiteFormOpen, setIsSiteFormOpen] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);
  const [siteName, setSiteName] = useState("");
  const [siteCode, setSiteCode] = useState("");
  const [siteCity, setSiteCity] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [sitePostal, setSitePostal] = useState("33100");
  const [siteTes, setSiteTes] = useState("Teknologiateollisuus TES");
  const [siteTerminal, setSiteTerminal] = useState("");
  const [isSavingSite, setIsSavingSite] = useState(false);

  // Job Role create / inline edit
  const [newRoleName, setNewRoleName] = useState("");
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [editingRoleOld, setEditingRoleOld] = useState<string | null>(null);
  const [editingRoleNew, setEditingRoleNew] = useState("");

  // Shift create / inline edit
  const [shiftName, setShiftName] = useState("");
  const [shiftWindow, setShiftWindow] = useState("08:00–16:00");
  const [shiftWeeklyHrs, setShiftWeeklyHrs] = useState("37.5h/wk");
  const [shiftTesNote, setShiftTesNote] = useState("Standard TES");
  const [isSavingShift, setIsSavingShift] = useState(false);
  const [editingShiftOld, setEditingShiftOld] = useState<string | null>(null);
  const [editShiftName, setEditShiftName] = useState("");
  const [editShiftWindow, setEditShiftWindow] = useState("");
  const [editShiftWeekly, setEditShiftWeekly] = useState("");
  const [editShiftTes, setEditShiftTes] = useState("");

  // In-app delete confirmation modal state
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  const fetchMasterData = useCallback(async () => {
    try {
      const [mdRes, usrRes, flowRes] = await Promise.all([
        fetch(`${API_BASE}/api/client/${clientId}/master-data`),
        fetch(`${API_BASE}/api/client/${clientId}/users`),
        fetch(`${API_BASE}/api/client/${clientId}/approval-flows`),
      ]);
      if (mdRes.ok) {
        const data = await mdRes.json();
        const grouped = data.master_data || {};
        setJobRoles(grouped.client_job_roles || []);
        setShifts(grouped.client_shift_templates || []);
      }
      if (usrRes.ok) {
        const uData = await usrRes.json();
        setUsers(uData.users || []);
      }
      if (flowRes.ok) {
        const fData = await flowRes.json();
        setApprovalFlows(fData.approval_flows || []);
      }
    } catch {}
  }, [clientId]);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  // ---------------- SITE HANDLERS ----------------
  const openAddSite = () => {
    setEditingSiteId(null);
    setSiteName("");
    setSiteCode("");
    setSiteCity("");
    setSiteAddress("");
    setSitePostal("33100");
    setSiteTes("Teknologiateollisuus TES");
    setSiteTerminal("");
    setIsSiteFormOpen(true);
  };

  const openEditSite = (s: SiteItem) => {
    setEditingSiteId(s.id);
    setSiteName(s.site_name);
    setSiteCode(s.site_code);
    setSiteCity(s.city);
    setSiteAddress(s.address);
    setSitePostal(s.postal_code);
    setSiteTes(s.tes_industry_sector);
    setSiteTerminal(s.biometric_terminal_id || "");
    setIsSiteFormOpen(true);
  };

  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteName.trim() || !siteCode.trim() || !siteCity.trim()) return;
    setIsSavingSite(true);
    setFeedback(null);
    try {
      const url = editingSiteId
        ? `${API_BASE}/api/client/${clientId}/sites/${editingSiteId}`
        : `${API_BASE}/api/client/${clientId}/sites/create`;
      const method = editingSiteId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_name: siteName.trim(),
          site_code: siteCode.trim().toUpperCase(),
          city: siteCity.trim(),
          address: siteAddress.trim() || "Teollisuuskatu 1",
          postal_code: sitePostal.trim() || "33100",
          tes_industry_sector: siteTes.trim() || "Teknologiateollisuus TES",
          biometric_terminal_id: siteTerminal.trim() || null,
        }),
      });
      if (res.ok) {
        setIsSiteFormOpen(false);
        setFeedback({
          type: "success",
          text: editingSiteId
            ? `Updated site "${siteCode.toUpperCase()}" in Site Master.`
            : `Site "${siteCode.toUpperCase()}" created in Site Master.`,
        });
        if (onRefreshSites) onRefreshSites();
      } else {
        setFeedback({ type: "error", text: "Failed to save site." });
      }
    } catch {
      setFeedback({ type: "error", text: "Network error while saving site." });
    } finally {
      setIsSavingSite(false);
    }
  };

  const handleDeleteSite = (s: SiteItem) => {
    setConfirmState({
      title: "Delete Plant Site",
      message: `Are you sure you want to remove plant site "${s.site_code} — ${s.site_name}" from Site Master?`,
      confirmLabel: "Delete Site",
      onConfirm: async () => {
        setFeedback(null);
        try {
          const res = await fetch(`${API_BASE}/api/client/${clientId}/sites/${s.id}`, {
            method: "DELETE",
          });
          if (res.ok) {
            setFeedback({ type: "success", text: `Deleted site "${s.site_code} — ${s.site_name}".` });
            if (onRefreshSites) onRefreshSites();
          }
        } catch {
          setFeedback({ type: "error", text: "Failed to delete site." });
        }
      },
    });
  };

  // ---------------- USER MASTER HANDLER ----------------
  const handleDeleteUserFromMaster = (u: ClientUserRecord) => {
    if (u.is_client_admin) return;
    setConfirmState({
      title: "Delete Operational User",
      message: `Are you sure you want to permanently remove "${u.full_name}" (${u.email}) from the Client Portal?`,
      confirmLabel: "Delete User",
      onConfirm: async () => {
        setFeedback(null);
        try {
          const res = await fetch(`${API_BASE}/api/client/${clientId}/users/${u.id}`, {
            method: "DELETE",
          });
          if (res.ok) {
            setFeedback({ type: "success", text: `Deleted operational user "${u.full_name}".` });
            await fetchMasterData();
          }
        } catch {}
      },
    });
  };

  // ---------------- JOB ROLE HANDLERS ----------------
  const handleAddJobRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newRoleName.trim();
    if (!cleaned) return;
    setIsSavingRole(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/client/${clientId}/master-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "client_job_roles", item_value: cleaned }),
      });
      if (res.ok) {
        setNewRoleName("");
        setFeedback({
          type: "success",
          text: `Added internal job role "${cleaned}".`,
        });
        await fetchMasterData();
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to add job role." });
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleSaveRoleEdit = async (oldVal: string) => {
    const cleaned = editingRoleNew.trim();
    if (!cleaned || cleaned === oldVal) {
      setEditingRoleOld(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/client/${clientId}/master-data`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "client_job_roles",
          old_value: oldVal,
          new_value: cleaned,
        }),
      });
      if (res.ok) {
        setEditingRoleOld(null);
        setFeedback({ type: "success", text: `Updated job role to "${cleaned}".` });
        await fetchMasterData();
      }
    } catch {}
  };

  const handleDeleteJobRole = (roleVal: string) => {
    setConfirmState({
      title: "Delete Internal Job Role",
      message: `Are you sure you want to delete "${roleVal}" from Internal Job Role Master?`,
      confirmLabel: "Delete Role",
      onConfirm: async () => {
        try {
          const res = await fetch(
            `${API_BASE}/api/client/${clientId}/master-data?category=client_job_roles&item_value=${encodeURIComponent(
              roleVal
            )}`,
            { method: "DELETE" }
          );
          if (res.ok) {
            setFeedback({ type: "success", text: `Deleted job role "${roleVal}".` });
            await fetchMasterData();
          }
        } catch {}
      },
    });
  };

  // ---------------- SHIFT HANDLERS ----------------
  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftName.trim()) return;
    const formatted = `${shiftName.trim()} | ${shiftWindow.trim()} | ${shiftWeeklyHrs.trim()} | ${shiftTesNote.trim()}`;
    setIsSavingShift(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/client/${clientId}/master-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "client_shift_templates", item_value: formatted }),
      });
      if (res.ok) {
        setShiftName("");
        setFeedback({ type: "success", text: `Added shift template "${shiftName.trim()}".` });
        await fetchMasterData();
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to add shift template." });
    } finally {
      setIsSavingShift(false);
    }
  };

  const openEditShift = (sh: string) => {
    const parts = sh.split("|").map((p) => p.trim());
    setEditingShiftOld(sh);
    setEditShiftName(parts[0] || sh);
    setEditShiftWindow(parts[1] || "08:00–16:00");
    setEditShiftWeekly(parts[2] || "37.5h/wk");
    setEditShiftTes(parts[3] || "Standard TES");
  };

  const handleSaveShiftEdit = async (oldVal: string) => {
    if (!editShiftName.trim()) return;
    const newVal = `${editShiftName.trim()} | ${editShiftWindow.trim()} | ${editShiftWeekly.trim()} | ${editShiftTes.trim()}`;
    try {
      const res = await fetch(`${API_BASE}/api/client/${clientId}/master-data`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "client_shift_templates",
          old_value: oldVal,
          new_value: newVal,
        }),
      });
      if (res.ok) {
        setEditingShiftOld(null);
        setFeedback({ type: "success", text: `Updated shift template "${editShiftName.trim()}".` });
        await fetchMasterData();
      }
    } catch {}
  };

  const handleDeleteShift = (shiftVal: string) => {
    const label = shiftVal.split("|")[0]?.trim() || shiftVal;
    setConfirmState({
      title: "Delete Shift Template",
      message: `Are you sure you want to delete shift template "${label}" from Shift Schedule Master?`,
      confirmLabel: "Delete Shift",
      onConfirm: async () => {
        try {
          const res = await fetch(
            `${API_BASE}/api/client/${clientId}/master-data?category=client_shift_templates&item_value=${encodeURIComponent(
              shiftVal
            )}`,
            { method: "DELETE" }
          );
          if (res.ok) {
            setFeedback({ type: "success", text: `Deleted shift template "${label}".` });
            await fetchMasterData();
          }
        } catch {}
      },
    });
  };

  // ---------------- APPROVAL FLOW HANDLERS ----------------
  const handleSaveFlowToBackend = async (flowPayload: {
    flow_key: string;
    flow_name: string;
    description?: string | null;
    is_active: boolean;
    levels: ApprovalLevel[];
  }) => {
    setIsSavingFlow(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/client/${clientId}/approval-flows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flowPayload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.flow) {
          setApprovalFlows((prev) => {
            const exists = prev.some((f) => f.flow_key === flowPayload.flow_key);
            if (exists) {
              return prev.map((f) => (f.flow_key === flowPayload.flow_key ? data.flow : f));
            }
            return [...prev, data.flow];
          });
        }
        await fetchMasterData();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("refresh-notifications"));
        }
        if (data.notifications_dispatched && data.notifications_dispatched.length > 0) {
          setDispatchedNotifsModal({
            isOpen: true,
            flowName: flowPayload.flow_name,
            notifications: data.notifications_dispatched,
          });
        }
        setFeedback({
          type: "success",
          text: `Saved "${flowPayload.flow_name}" approval flow. Notifications dispatched to approver users!`,
        });
      } else {
        setFeedback({ type: "error", text: "Failed to save approval flow changes." });
      }
    } catch {
      setFeedback({ type: "error", text: "Network error while saving approval flow." });
    } finally {
      setIsSavingFlow(false);
    }
  };

  // --- Master Approval Flow Helpers ---
  const handleOpenCreateFlow = () => {
    setIsFlowEditorOpen(true);
    setActiveModuleKey("m1.2_req");
    setSimpleNumLevels(1);
    setSimpleApproverIds([null]);
    setModuleSearchQuery("");
  };

  const handleOpenEditFlow = (flow: ApprovalFlow) => {
    setIsFlowEditorOpen(true);
    setActiveModuleKey(flow.flow_key);
    setSimpleNumLevels(flow.levels.length || 1);
    setSimpleApproverIds(
      flow.levels.length > 0 ? flow.levels.map((l) => l.approver_id) : [null]
    );
    setModuleSearchQuery("");
  };

  const handleCloseFlowEditor = () => {
    setIsFlowEditorOpen(false);
  };

  const handleSelectModule = (moduleKey: string) => {
    setActiveModuleKey(moduleKey);
    const existing = approvalFlows.find((f) => f.flow_key === moduleKey);
    if (existing && existing.levels && existing.levels.length > 0) {
      setSimpleNumLevels(existing.levels.length);
      setSimpleApproverIds(existing.levels.map((l) => l.approver_id));
    } else {
      setSimpleNumLevels(1);
      setSimpleApproverIds([null]);
    }
  };

  const handleAddLevelRow = () => {
    setSimpleNumLevels((prev) => prev + 1);
    setSimpleApproverIds((prev) => [...prev, null]);
  };

  const handleRemoveLevelRow = (levelIdx: number) => {
    if (simpleNumLevels <= 1) {
      setFeedback({ type: "error", text: "At least one level is required in the approval flow." });
      return;
    }
    setSimpleNumLevels((prev) => prev - 1);
    setSimpleApproverIds((prev) => prev.filter((_, idx) => idx !== levelIdx));
  };

  const handleOpenAssignModal = (levelIdx: number) => {
    setAssignUserModal({
      isOpen: true,
      levelIndex: levelIdx,
      searchQuery: "",
    });
  };

  const handleAssignUserToLevel = (userId: number) => {
    setSimpleApproverIds((prev) => {
      const copy = [...prev];
      copy[assignUserModal.levelIndex] = userId;
      return copy;
    });
    setAssignUserModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleRemoveAssignedUser = () => {
    setSimpleApproverIds((prev) => {
      const copy = [...prev];
      copy[assignUserModal.levelIndex] = null;
      return copy;
    });
    setAssignUserModal((prev) => ({ ...prev, isOpen: false }));
    setFeedback({
      type: "success",
      text: `Removed assigned user for Level ${assignUserModal.levelIndex + 1}.`,
    });
  };

  const handleSaveSimpleFlow = async () => {
    if (!activeModuleKey) {
      setFeedback({ type: "error", text: "Please select an application sub-menu module first." });
      return;
    }

    const subItem = REAL_APPLICATION_SUBMENUS.find((s) => s.id === activeModuleKey);
    const flowName = subItem ? subItem.label : activeModuleKey;

    // Check if any level is unassigned
    const unassignedIdx = simpleApproverIds.findIndex((id) => !id);
    if (unassignedIdx !== -1) {
      setFeedback({
        type: "error",
        text: `Please assign an approver user for Level ${unassignedIdx + 1} before submitting.`,
      });
      return;
    }

    const constructedLevels: ApprovalLevel[] = [];
    for (let i = 0; i < simpleNumLevels; i++) {
      const approverId = simpleApproverIds[i]!;
      const userObj = users.find((u) => u.id === approverId);
      const levelNum = i + 1;
      constructedLevels.push({
        level: levelNum,
        level_name: `Level ${levelNum}: ${levelNum === simpleNumLevels ? "Final Sign-Off Authorization" : "Verification & Review"}`,
        approver_type: "USER",
        approver_id: userObj ? userObj.id : approverId,
        approver_name: userObj ? userObj.full_name : `Approver ${approverId}`,
        approver_email: userObj ? userObj.email : null,
        approver_role: userObj ? userObj.role : "CLIENT_ADMIN",
        sla_hours: levelNum === 1 ? 24 : 48,
        is_mandatory: true,
        auto_escalate: false,
      });
    }

    const payload = {
      flow_key: activeModuleKey,
      flow_name: flowName.includes("Approval") ? flowName : `${flowName} Approval`,
      description: `Approval workflow for ${flowName} (${subItem?.groupTitle || "Operational Sub-menu"}).`,
      is_active: true,
      levels: constructedLevels,
    };

    await handleSaveFlowToBackend(payload);
    setIsFlowEditorOpen(false); // Return to default flows list
  };

  const handleDeleteApprovalFlow = (flow: ApprovalFlow) => {
    setConfirmState({
      title: "Delete Approval Flow",
      message: `Are you sure you want to permanently delete the approval flow for "${flow.flow_name}"?`,
      confirmLabel: "Delete Flow",
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE}/api/client/${clientId}/approval-flows/${flow.id}`, {
            method: "DELETE",
          });
          if (res.ok) {
            setApprovalFlows((prev) => prev.filter((f) => f.id !== flow.id));
            await fetchMasterData();
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("refresh-notifications"));
            }
            setFeedback({ type: "success", text: `Deleted approval flow "${flow.flow_name}".` });
          }
        } catch {
          setFeedback({ type: "error", text: "Failed to delete approval flow." });
        }
      },
    });
  };

  const tabs: Array<{ id: MasterSubTab; label: string; icon: React.ElementType; count: number }> = [
    { id: "m1.8_site_master", label: "Site & Facility Master", icon: Building2, count: sites.length },
    { id: "m1.8_user_master", label: "User Directory Master", icon: Users, count: users.length },
    { id: "m1.8_job_role_master", label: "Internal Job Role Master", icon: Briefcase, count: jobRoles.length },
    { id: "m1.8_shift_master", label: "Shift Schedule Master", icon: Clock, count: shifts.length },
    { id: "m1.8_approval_flow_master", label: "Master Approval Flow", icon: GitBranch, count: approvalFlows.length },
  ];

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-[var(--accent-light)] text-[var(--accent-color)] uppercase tracking-wider">
              Master Configuration
            </span>
            <span className="text-xs text-[var(--text-secondary)]">{companyName}</span>
          </div>
          <h1 className="text-xl font-black text-[var(--text-primary)] mt-1 flex items-center gap-2">
            <Database className="w-5 h-5 text-[var(--accent-color)]" />
            <span>Master Data Management</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Create, edit, and delete master records for plant sites, portal users, internal job roles, and shift schedules.
          </p>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[var(--border-color)]">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeSubTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setFeedback(null);
                onChangeSubTab(t.id);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                active
                  ? "bg-[var(--accent-color)] text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  active ? "bg-white/20 text-white" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
              : "bg-rose-500/10 border-rose-500/20 text-rose-600"
          }`}
        >
          <span className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {feedback.text}
          </span>
          <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. SITE & FACILITY MASTER */}
      {activeSubTab === "m1.8_site_master" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-[var(--text-primary)]">
                Registered Plant Sites & Facilities ({sites.length})
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Locations linked to Finnish TES agreements and biometric attendance terminals.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddSite}
              className="px-3.5 py-2 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Plant Site</span>
            </button>
          </div>

          {isSiteFormOpen && (
            <form
              onSubmit={handleSaveSite}
              className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--accent-color)]/40 shadow-sm space-y-3"
            >
              <div className="text-xs font-black text-[var(--text-primary)]">
                {editingSiteId ? "Edit Plant Site" : "Register New Plant Site"}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Site Code (e.g. HEL-03)"
                  value={siteCode}
                  onChange={(e) => setSiteCode(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                />
                <input
                  type="text"
                  required
                  placeholder="Facility Name (e.g. Helsinki Logistics Hub)"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                />
                <input
                  type="text"
                  required
                  placeholder="City (e.g. Helsinki)"
                  value={siteCity}
                  onChange={(e) => setSiteCity(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                />
                <input
                  type="text"
                  placeholder="Street Address"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                />
                <input
                  type="text"
                  placeholder="Postal Code"
                  value={sitePostal}
                  onChange={(e) => setSitePostal(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                />
                <input
                  type="text"
                  placeholder="TES Industry Sector"
                  value={siteTes}
                  onChange={(e) => setSiteTes(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                />
                <input
                  type="text"
                  placeholder="Biometric Terminal ID (optional)"
                  value={siteTerminal}
                  onChange={(e) => setSiteTerminal(e.target.value)}
                  className="sm:col-span-3 px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSiteFormOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-[var(--border-color)] text-xs font-bold text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSite}
                  className="px-4 py-1.5 rounded-xl bg-[var(--accent-color)] text-white text-xs font-bold cursor-pointer"
                >
                  {isSavingSite ? "Saving..." : editingSiteId ? "Save Site Changes" : "Save Site"}
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sites.map((s) => (
              <div
                key={s.id}
                className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--accent-color)] border border-[var(--border-color)]">
                        {s.site_code}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        Active
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-[var(--text-primary)] mt-1.5">
                      {s.site_name}
                    </h3>
                  </div>

                  {/* Edit / Delete Site Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditSite(s)}
                      className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--accent-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-all"
                      title="Edit Site"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSite(s)}
                      className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-rose-500 text-[var(--text-secondary)] hover:text-rose-600 cursor-pointer transition-all"
                      title="Delete Site"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-xs text-[var(--text-secondary)] space-y-1">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                    <span>
                      {s.address}, {s.postal_code} {s.city}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      TES Sector: <strong className="text-[var(--text-primary)]">{s.tes_industry_sector}</strong>
                    </span>
                  </div>
                  {s.biometric_terminal_id && (
                    <div className="text-[11px] font-mono text-[var(--text-secondary)]">
                      Biometric Terminal: {s.biometric_terminal_id}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. USER DIRECTORY MASTER */}
      {activeSubTab === "m1.8_user_master" && (
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm overflow-hidden">
          <div className="p-5 border-b border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-[var(--text-primary)]">
                Master Client User Registry ({users.length})
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Complete master record of all Admin and Operational accounts linked to {companyName}.
              </p>
            </div>
            {onNavigateToCreateUser && (
              <button
                type="button"
                onClick={onNavigateToCreateUser}
                className="px-3.5 py-2 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto"
              >
                <span>Open User Management</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-5 py-3">User Name</th>
                  <th className="px-5 py-3">Login ID</th>
                  <th className="px-5 py-3">Internal Role</th>
                  <th className="px-5 py-3">Site Access</th>
                  <th className="px-5 py-3">Assigned By</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[var(--bg-secondary)]/40">
                    <td className="px-5 py-3.5 font-bold text-[var(--text-primary)]">{u.full_name}</td>
                    <td className="px-5 py-3.5 font-mono text-[var(--text-secondary)]">{u.email}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)]">
                        {u.is_client_admin ? "Client Admin" : u.role.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[var(--text-secondary)]">
                      {u.assigned_site_ids === "*" ? "All Sites" : `Site ID: ${u.assigned_site_ids}`}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-primary)]">
                        {u.is_client_admin && <Lock className="w-3 h-3 text-indigo-500" />}
                        {u.assigned_by}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.is_active
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-rose-500/10 text-rose-600"
                        }`}
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {u.is_client_admin ? (
                        <span className="text-[10px] text-[var(--text-secondary)] font-semibold">
                          Locked
                        </span>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          {onNavigateToCreateUser && (
                            <button
                              type="button"
                              onClick={onNavigateToCreateUser}
                              className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--accent-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                              title="Edit in User Management"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteUserFromMaster(u)}
                            className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-rose-500 text-[var(--text-secondary)] hover:text-rose-600 cursor-pointer"
                            title="Delete Operational User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. INTERNAL JOB ROLE MASTER (Full Edit & Delete on every role) */}
      {activeSubTab === "m1.8_job_role_master" && (
        <div className="space-y-4">
          <form
            onSubmit={handleAddJobRole}
            className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-end"
          >
            <div className="flex-1">
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                Add Internal Client Job Role / Designation
              </label>
              <input
                type="text"
                required
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g. HR Head, HR Manager, Production Lead, Payroll Coordinator..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
              />
            </div>
            <button
              type="submit"
              disabled={isSavingRole}
              className="px-4 py-2.5 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{isSavingRole ? "Adding..." : "Add Job Role"}</span>
            </button>
          </form>

          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div>
                <h2 className="text-sm font-black text-[var(--text-primary)]">
                  Client Internal Job Roles ({jobRoles.length})
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Edit or delete any role below — updates sync immediately to Create New User.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {jobRoles.map((r) => {
                const isEditing = editingRoleOld === r;
                return (
                  <div
                    key={r}
                    className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-between gap-2"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="text"
                          autoFocus
                          value={editingRoleNew}
                          onChange={(e) => setEditingRoleNew(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveRoleEdit(r);
                            }
                            if (e.key === "Escape") setEditingRoleOld(null);
                          }}
                          className="flex-1 min-w-0 px-2.5 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--accent-color)] text-xs font-bold text-[var(--text-primary)] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRoleEdit(r)}
                          className="p-1.5 rounded-lg bg-emerald-600 text-white cursor-pointer"
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRoleOld(null)}
                          className="p-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <Briefcase className="w-4 h-4 text-[var(--accent-color)] shrink-0" />
                          <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {r}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRoleOld(r);
                              setEditingRoleNew(r);
                            }}
                            className="p-1.5 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                            title="Edit Role"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteJobRole(r)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-[var(--text-secondary)] hover:text-rose-600 cursor-pointer"
                            title="Delete Role"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. SHIFT SCHEDULE MASTER (Full Edit & Delete on every shift) */}
      {activeSubTab === "m1.8_shift_master" && (
        <div className="space-y-4">
          <form
            onSubmit={handleAddShift}
            className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm space-y-3"
          >
            <div className="text-xs font-black text-[var(--text-primary)]">
              Add New Shift Template
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                required
                placeholder="Shift Name (e.g. Weekend Shift)"
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
              />
              <input
                type="text"
                required
                placeholder="Hours (e.g. 07:00–19:00)"
                value={shiftWindow}
                onChange={(e) => setShiftWindow(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
              />
              <input
                type="text"
                placeholder="Weekly (e.g. 37.5h/wk)"
                value={shiftWeeklyHrs}
                onChange={(e) => setShiftWeeklyHrs(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
              />
              <input
                type="text"
                placeholder="TES Allowance Note"
                value={shiftTesNote}
                onChange={(e) => setShiftTesNote(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSavingShift}
                className="px-4 py-2 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isSavingShift ? "Saving..." : "Add Shift Template"}</span>
              </button>
            </div>
          </form>

          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm space-y-3">
            <h2 className="text-sm font-black text-[var(--text-primary)] border-b border-[var(--border-color)] pb-3">
              Active Shift Master Templates ({shifts.length})
            </h2>
            <div className="space-y-2.5">
              {shifts.map((sh) => {
                const parts = sh.split("|").map((p) => p.trim());
                const isEditing = editingShiftOld === sh;
                return (
                  <div
                    key={sh}
                    className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]"
                  >
                    {isEditing ? (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <input
                            type="text"
                            value={editShiftName}
                            onChange={(e) => setEditShiftName(e.target.value)}
                            placeholder="Shift Name"
                            className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--accent-color)] text-xs text-[var(--text-primary)]"
                          />
                          <input
                            type="text"
                            value={editShiftWindow}
                            onChange={(e) => setEditShiftWindow(e.target.value)}
                            placeholder="Hours Window"
                            className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                          />
                          <input
                            type="text"
                            value={editShiftWeekly}
                            onChange={(e) => setEditShiftWeekly(e.target.value)}
                            placeholder="Weekly Hours"
                            className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                          />
                          <input
                            type="text"
                            value={editShiftTes}
                            onChange={(e) => setEditShiftTes(e.target.value)}
                            placeholder="TES Note"
                            className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingShiftOld(null)}
                            className="px-3 py-1 rounded-lg border border-[var(--border-color)] text-xs font-bold text-[var(--text-secondary)] cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveShiftEdit(sh)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[var(--text-primary)]">
                              {parts[0] || sh}
                            </div>
                            <div className="text-[11px] text-[var(--text-secondary)]">
                              {parts[1] || "Standard Hours"} • {parts[2] || "37.5h/wk"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]">
                            {parts[3] || "TES Standard"}
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditShift(sh)}
                            className="p-1.5 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                            title="Edit Shift Template"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteShift(sh)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-[var(--text-secondary)] hover:text-rose-600 cursor-pointer"
                            title="Delete Shift Template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. MASTER APPROVAL FLOW */}
      {activeSubTab === "m1.8_approval_flow_master" && (
        <div className="space-y-6 w-full">
          {/* VIEW 1: DEFAULT SHOW LIST OF CREATED APPROVAL FLOWS */}
          {!isFlowEditorOpen ? (
            <div className="space-y-6">
              {/* Top Header Card */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                      Governance & Authorization
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">Sequential Multi-Level Approvals</span>
                  </div>
                  <h2 className="text-lg font-black text-[var(--text-primary)] mt-1 flex items-center gap-2">
                    <Workflow className="w-5 h-5 text-[var(--accent-color)]" />
                    <span>Master Approval Flow</span>
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Overview of all active multi-level approval hierarchies configured across application sub-menus.
                  </p>
                </div>

                {/* Open Create Workflow Button */}
                <button
                  type="button"
                  onClick={handleOpenCreateFlow}
                  className="px-5 py-2.5 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Create Approval Flow</span>
                </button>
              </div>

              {/* Table Toolbar: Search & Total Count */}
              <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={flowSearchQuery}
                    onChange={(e) => setFlowSearchQuery(e.target.value)}
                    placeholder="Search created flows by module name or key..."
                    className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
                  />
                  {flowSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setFlowSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] self-start sm:self-auto">
                  {approvalFlows.length} Configured Workflow{approvalFlows.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Created Approval Flows Table */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm space-y-4">
                <div className="overflow-x-auto rounded-xl border border-[var(--border-color)]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)]">
                        <th className="py-3 px-4 font-bold">Module / Sub-Menu</th>
                        <th className="py-3 px-4 font-bold text-center">Levels</th>
                        <th className="py-3 px-4 font-bold">Approval Chain Sequence</th>
                        <th className="py-3 px-4 font-bold text-center">Status</th>
                        <th className="py-3 px-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]">
                      {approvalFlows
                        .filter((flow) => {
                          const q = flowSearchQuery.toLowerCase().trim();
                          if (!q) return true;
                          return (
                            flow.flow_name.toLowerCase().includes(q) ||
                            flow.flow_key.toLowerCase().includes(q) ||
                            flow.levels.some((l) => l.approver_name.toLowerCase().includes(q))
                          );
                        })
                        .map((flow) => {
                          const subItem = REAL_APPLICATION_SUBMENUS.find((s) => s.id === flow.flow_key);
                          return (
                            <tr key={flow.id || flow.flow_key} className="hover:bg-[var(--bg-secondary)]/30 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-base">{subItem?.icon || "⚙️"}</span>
                                  <div>
                                    <div className="font-bold text-[var(--text-primary)]">{flow.flow_name}</div>
                                    <div className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1.5 mt-0.5">
                                      {subItem?.groupTitle && (
                                        <span className="px-1.5 py-0.2 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] font-medium">
                                          {subItem.groupTitle}
                                        </span>
                                      )}
                                      <span className="font-mono">{flow.flow_key}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-4 text-center">
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[var(--accent-light)] text-[var(--accent-color)]">
                                  {flow.levels.length} {flow.levels.length === 1 ? "Level" : "Levels"}
                                </span>
                              </td>

                              <td className="py-3 px-4">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {flow.levels.map((lvl, lIdx) => (
                                    <React.Fragment key={lvl.level}>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[11px]">
                                        <span className="font-bold text-[var(--accent-color)]">L{lvl.level}:</span>
                                        <span className="text-[var(--text-primary)]">{lvl.approver_name}</span>
                                      </span>
                                      {lIdx < flow.levels.length - 1 && (
                                        <ChevronRight className="w-3 h-3 text-[var(--text-secondary)]" />
                                      )}
                                    </React.Fragment>
                                  ))}
                                </div>
                              </td>

                              <td className="py-3 px-4 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  flow.is_active
                                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                }`}>
                                  {flow.is_active ? "Active" : "Paused"}
                                </span>
                              </td>

                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditFlow(flow)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent-light)] text-[var(--accent-color)] hover:bg-[var(--accent-color)] hover:text-white text-[11px] font-bold transition-all cursor-pointer"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteApprovalFlow(flow)}
                                    className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-rose-600 hover:bg-rose-500/10 transition-all cursor-pointer"
                                    title="Delete Flow"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                      {approvalFlows.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-xs text-[var(--text-secondary)] space-y-3">
                            <Workflow className="w-10 h-10 mx-auto opacity-30 text-[var(--accent-color)]" />
                            <div className="text-sm font-bold text-[var(--text-primary)]">
                              No Approval Flows Configured Yet
                            </div>
                            <p className="max-w-md mx-auto text-[11px]">
                              Set up multi-level authorization workflows for any application sub-menu. Default starts clean with zero dummy data.
                            </p>
                            <button
                              type="button"
                              onClick={handleOpenCreateFlow}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Create First Approval Flow</span>
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* VIEW 2: CREATE / EDIT APPROVAL FLOW CANVAS (OPENED THROUGH BUTTON) */
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Back to Flows Navigation Header */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCloseFlowEditor}
                    className="p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-card)] text-[var(--text-primary)] transition-all cursor-pointer shadow-xs"
                    title="Back to created approval flows"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-base font-black text-[var(--text-primary)] flex items-center gap-2">
                      <span>{approvalFlows.some((f) => f.flow_key === activeModuleKey) ? "Edit Approval Flow" : "Create New Approval Flow"}</span>
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Select an application sub-menu, set the levels of approval, and assign approver users.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCloseFlowEditor}
                    className="px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-card)] text-xs font-bold text-[var(--text-primary)] transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Two-Panel Builder */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT PANEL: Select Sub-Menu Module */}
                <div className="lg:col-span-4 space-y-3">
                  <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                      <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                        <span>📋</span>
                        <span>Select Sub-Menu Module</span>
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                        {REAL_APPLICATION_SUBMENUS.length} Sub-Menus
                      </span>
                    </div>

                    {/* Sub-menu Search Bar */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={moduleSearchQuery}
                        onChange={(e) => setModuleSearchQuery(e.target.value)}
                        placeholder="Filter sub-menus..."
                        className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
                      />
                      {moduleSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setModuleSearchQuery("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Scrollable Sub-Menu List */}
                    <div className="space-y-1.5 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                      {REAL_APPLICATION_SUBMENUS.filter((s) => {
                        const q = moduleSearchQuery.toLowerCase().trim();
                        if (!q) return true;
                        return (
                          s.label.toLowerCase().includes(q) ||
                          s.groupTitle.toLowerCase().includes(q)
                        );
                      }).map((sub) => {
                        const isSelected = activeModuleKey === sub.id;
                        const existingFlow = approvalFlows.find((f) => f.flow_key === sub.id);
                        const isSaved = Boolean(existingFlow && existingFlow.levels && existingFlow.levels.length > 0);

                        return (
                          <div
                            key={sub.id}
                            onClick={() => handleSelectModule(sub.id)}
                            className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                              isSelected
                                ? "bg-[var(--accent-color)] text-white border-[var(--accent-color)] shadow-md font-bold scale-101"
                                : "bg-[var(--bg-secondary)]/50 border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-color)]/60 hover:bg-[var(--bg-secondary)] font-medium"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base shrink-0">{sub.icon}</span>
                              <div className="min-w-0">
                                <div className="text-xs truncate">{sub.label}</div>
                                <div
                                  className={`text-[9px] truncate ${
                                    isSelected ? "text-white/80" : "text-[var(--text-secondary)]"
                                  }`}
                                >
                                  {sub.groupTitle}
                                </div>
                              </div>
                            </div>

                            {isSaved && (
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                                  isSelected ? "bg-white/20 text-white" : "bg-emerald-500/15 text-emerald-600 border border-emerald-500/20"
                                }`}
                              >
                                ✓ {existingFlow?.levels.length} Lvl
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* RIGHT PANEL: Module Approval Level Canvas */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--accent-color)]/30 shadow-md space-y-5">
                    {/* Active Module Header */}
                    {(() => {
                      const activeSub = REAL_APPLICATION_SUBMENUS.find((s) => s.id === activeModuleKey) || {
                        id: activeModuleKey,
                        label: activeModuleKey,
                        groupTitle: "Application Sub-Menu",
                        icon: "⚙️",
                      };
                      return (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border-color)]">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-light)] text-[var(--accent-color)] text-xl flex items-center justify-center border border-[var(--accent-color)]/20 shadow-xs">
                              {activeSub.icon}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-black text-[var(--text-primary)]">
                                  {activeSub.label}
                                </h3>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                                  {activeSub.groupTitle}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                Sequential approval escalation pipeline for this sub-menu
                              </p>
                            </div>
                          </div>

                          <span className="text-xs font-bold px-3 py-1 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            {simpleNumLevels} {simpleNumLevels === 1 ? "Level" : "Levels"} Configured
                          </span>
                        </div>
                      );
                    })()}

                    {/* Levels List */}
                    <div className="space-y-3">
                      {Array.from({ length: simpleNumLevels }).map((_, idx) => {
                        const currentLevelNum = idx + 1;
                        const assignedUserId = simpleApproverIds[idx];
                        const assignedUser = assignedUserId ? users.find((u) => u.id === assignedUserId) : null;
                        const isLastLevel = idx === simpleNumLevels - 1;

                        // Real-time Next Level Approver indicator
                        let nextApproverDisplay = "Final Sign-Off Authorization";
                        if (!isLastLevel) {
                          const nextUserId = simpleApproverIds[idx + 1];
                          const nextUserObj = nextUserId ? users.find((u) => u.id === nextUserId) : null;
                          nextApproverDisplay = nextUserObj
                            ? `Level ${currentLevelNum + 1}: ${nextUserObj.full_name}`
                            : `Level ${currentLevelNum + 1} (Unassigned)`;
                        }

                        return (
                          <div
                            key={idx}
                            className="p-4 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] hover:border-[var(--accent-color)]/40 transition-all space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              {/* Level Badge & Assigned User Box */}
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="px-3 py-1.5 rounded-xl bg-[var(--accent-color)] text-white text-xs font-black shadow-xs shrink-0">
                                  Level {currentLevelNum}
                                </span>

                                {/* User details or Unassigned state */}
                                {assignedUser ? (
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-8 h-8 rounded-xl bg-[var(--accent-light)] text-[var(--accent-color)] font-bold text-xs flex items-center justify-center border border-[var(--accent-color)]/30 shrink-0">
                                      {assignedUser.full_name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-black text-[var(--text-primary)] truncate">
                                        {assignedUser.full_name}
                                      </div>
                                      <div className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1.5 truncate">
                                        <span className="px-1.5 py-0.2 rounded bg-[var(--bg-card)] border border-[var(--border-color)] font-mono text-[9px]">
                                          {assignedUser.role}
                                        </span>
                                        <span className="truncate">{assignedUser.email}</span>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>No user assigned yet</span>
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons: Delete (X) & Assign User (Popup trigger) */}
                              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                {/* Delete Level 'X' (enabled if more than 1 level exists) */}
                                {simpleNumLevels > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveLevelRow(idx)}
                                    className="w-8 h-8 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-rose-500/10 text-[var(--text-secondary)] hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer"
                                    title={`Delete Level ${currentLevelNum}`}
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}

                                {/* Assign User Button (Opens Popup) */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenAssignModal(idx)}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-bold shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>{assignedUser ? "Change User" : "Assign User"}</span>
                                </button>
                              </div>
                            </div>

                            {/* Sequential Next Level Callout */}
                            <div
                              className={`p-2 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${
                                isLastLevel
                                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-200"
                                  : "bg-blue-500/10 border-blue-500/25 text-blue-900 dark:text-blue-200"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 font-bold">
                                <span>{isLastLevel ? "🏁" : "➡️"}</span>
                                <span>{isLastLevel ? "Sign-Off:" : "Next Level Approver User:"}</span>
                                <span className="font-black underline">{nextApproverDisplay}</span>
                              </div>
                              <span className="text-[10px] opacity-75 hidden sm:inline">
                                {isLastLevel ? "Final sign-off" : `Escalates from Level ${currentLevelNum}`}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Add More Level Button */}
                      <button
                        type="button"
                        onClick={handleAddLevelRow}
                        className="w-full py-2.5 rounded-xl border-2 border-dashed border-[var(--border-color)] hover:border-[var(--accent-color)] hover:bg-[var(--accent-light)]/20 text-xs font-bold text-[var(--accent-color)] flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add More Level</span>
                      </button>
                    </div>

                    {/* Bottom Action Footer: Cancel & Submit */}
                    <div className="p-4 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4">
                      <button
                        type="button"
                        onClick={handleCloseFlowEditor}
                        className="px-5 py-2.5 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] text-xs font-bold transition-all cursor-pointer active:scale-95"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveSimpleFlow}
                        disabled={isSavingFlow}
                        className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                      >
                        <CheckCheck className="w-4 h-4" />
                        <span>{isSavingFlow ? "Submitting..." : "Submit Approval Flow"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* POPUP MODAL: Assign Approver User (with Close 'X', Search Bar & Remove Selected User) */}
      {assignUserModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-[var(--accent-color)] text-white flex items-center justify-center shadow-md">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--text-primary)]">
                    Assign Approver User — Level {assignUserModal.levelIndex + 1}
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Module: <strong className="text-[var(--text-primary)]">
                      {REAL_APPLICATION_SUBMENUS.find((s) => s.id === activeModuleKey)?.label || activeModuleKey || "Selected Module"}
                    </strong>
                  </p>
                </div>
              </div>

              {/* Close Button "X" */}
              <button
                type="button"
                onClick={() => setAssignUserModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-1.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Toolbar: Search Bar & Remove User Action */}
            <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-card)] space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={assignUserModal.searchQuery}
                  onChange={(e) =>
                    setAssignUserModal((prev) => ({ ...prev, searchQuery: e.target.value }))
                  }
                  placeholder="Search user by name, email, or role..."
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)] shadow-inner"
                  autoFocus
                />
                {assignUserModal.searchQuery && (
                  <button
                    type="button"
                    onClick={() => setAssignUserModal((prev) => ({ ...prev, searchQuery: "" }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Remove Selected User Button */}
              {simpleApproverIds[assignUserModal.levelIndex] && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Currently assigned:{" "}
                    <strong className="text-[var(--text-primary)]">
                      {users.find((u) => u.id === simpleApproverIds[assignUserModal.levelIndex])?.full_name}
                    </strong>
                  </span>

                  <button
                    type="button"
                    onClick={handleRemoveAssignedUser}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer active:scale-95"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Remove Selected User</span>
                  </button>
                </div>
              )}
            </div>

            {/* Scrollable User Directory List */}
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-2">
              {users
                .filter((u) => {
                  const q = assignUserModal.searchQuery.toLowerCase().trim();
                  if (!q) return true;
                  return (
                    u.full_name.toLowerCase().includes(q) ||
                    u.email.toLowerCase().includes(q) ||
                    u.role.toLowerCase().includes(q)
                  );
                })
                .map((u) => {
                  const isAssigned = simpleApproverIds[assignUserModal.levelIndex] === u.id;
                  return (
                    <div
                      key={u.id}
                      onClick={() => handleAssignUserToLevel(u.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isAssigned
                          ? "bg-[var(--accent-light)] border-[var(--accent-color)] shadow-xs ring-1 ring-[var(--accent-color)]"
                          : "bg-[var(--bg-secondary)]/40 border-[var(--border-color)] hover:border-[var(--accent-color)]/50 hover:bg-[var(--bg-secondary)]"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isAssigned
                              ? "bg-[var(--accent-color)] text-white shadow-xs"
                              : "bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
                          }`}
                        >
                          {u.full_name.charAt(0)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-[var(--text-primary)] truncate">
                              {u.full_name}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] font-mono">
                              {u.role}
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)] truncate">
                            {u.email}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isAssigned ? (
                          <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/25">
                            <Check className="w-3.5 h-3.5" />
                            <span>Assigned</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="px-3 py-1 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--accent-color)] hover:text-white border border-[var(--border-color)] text-xs font-bold transition-all"
                          >
                            Select
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

              {users.filter((u) => {
                const q = assignUserModal.searchQuery.toLowerCase().trim();
                if (!q) return true;
                return (
                  u.full_name.toLowerCase().includes(q) ||
                  u.email.toLowerCase().includes(q) ||
                  u.role.toLowerCase().includes(q)
                );
              }).length === 0 && (
                <div className="p-8 text-center text-xs text-[var(--text-secondary)] space-y-2">
                  <Search className="w-6 h-6 mx-auto opacity-40" />
                  <p>No portal users found matching &quot;{assignUserModal.searchQuery}&quot;</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/50 flex justify-end">
              <button
                type="button"
                onClick={() => setAssignUserModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-xs font-bold text-[var(--text-primary)] transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatched Notifications Confirmation Modal */}
      {dispatchedNotifsModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-[var(--border-color)] bg-emerald-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                  <CheckCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-emerald-800 dark:text-emerald-200">
                    Approval Flow Saved Successfully!
                  </h3>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Notifications automatically dispatched to {dispatchedNotifsModal.notifications.length} approver user{dispatchedNotifsModal.notifications.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDispatchedNotifsModal({ isOpen: false, flowName: "", notifications: [] })}
                className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-xs text-[var(--text-secondary)]">
                The following formal notifications with <strong className="text-[var(--text-primary)]">Approval Type</strong>, <strong className="text-[var(--text-primary)]">Approver Level</strong>, and <strong className="text-[var(--text-primary)]">Next Level Approver User</strong> were registered in the database:
              </div>

              <div className="space-y-2.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                {dispatchedNotifsModal.notifications.map((notif, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-[var(--accent-color)] text-white text-[11px] font-bold flex items-center justify-center">
                          {notif.approver_name.charAt(0)}
                        </div>
                        <span className="text-xs font-black text-[var(--text-primary)]">
                          {notif.approver_name}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        Delivered
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
                        <span className="text-[10px] text-[var(--text-secondary)] block">Approval Type:</span>
                        <span className="font-bold text-[var(--accent-color)]">{notif.approval_type}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
                        <span className="text-[10px] text-[var(--text-secondary)] block">Approver Level:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{notif.approver_level}</span>
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[11px]">
                      <span className="text-[10px] text-[var(--text-secondary)] block">Next Level Approver User:</span>
                      <span className="font-semibold text-[var(--text-primary)]">{notif.next_level_approver}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-[var(--accent-light)] text-[var(--text-primary)] text-xs flex items-center justify-between gap-2">
                <span>🔔 Approver users can view these notifications under the Bell icon in the header.</span>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/50 flex justify-end">
              <button
                type="button"
                onClick={() => setDispatchedNotifsModal({ isOpen: false, flowName: "", notifications: [] })}
                className="px-5 py-2 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom In-App Confirmation Modal (No browser popups) */}
      <ConfirmDialog
        isOpen={Boolean(confirmState)}
        title={confirmState?.title || "Confirm Action"}
        message={confirmState?.message || ""}
        confirmLabel={confirmState?.confirmLabel || "Delete"}
        isProcessing={isDeletingItem}
        onConfirm={async () => {
          if (!confirmState) return;
          setIsDeletingItem(true);
          try {
            await confirmState.onConfirm();
          } finally {
            setIsDeletingItem(false);
            setConfirmState(null);
          }
        }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
};
