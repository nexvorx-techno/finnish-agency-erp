"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserPlus,
  ShieldCheck,
  Lock,
  Building2,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  Mail,
  UserCog,
  Briefcase,
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  Sliders,
} from "lucide-react";
import { SiteItem } from "../app/page";
import { ConfirmDialog } from "./ConfirmDialog";

export type UserMgmtSubTab = "m1.9_user_list" | "m1.9_create_user";

export interface ModulePermSet {
  view: boolean;
  create: boolean;
  edit: boolean;
  approve: boolean;
}

export type PermissionsMap = Record<string, ModulePermSet>;

interface ClientUserRecord {
  id: number;
  client_id: number;
  full_name: string;
  username?: string;
  email: string;
  role: string;
  assigned_site_ids: string;
  must_change_password?: boolean;
  module_permissions?: string;
  is_active: boolean;
  is_client_admin: boolean;
  assigned_by: string;
}

interface ClientUserManagementProps {
  clientId: number;
  companyName: string;
  currentUserRole: string;
  sites: SiteItem[];
  activeSubTab: UserMgmtSubTab;
  onChangeSubTab: (tab: UserMgmtSubTab) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const DEFAULT_CLIENT_JOB_ROLES = [
  "HR Head",
  "HR Manager",
  "HR Coordinator",
  "Plant Director",
  "Site Manager",
  "Shift Supervisor",
  "Accounts Manager",
  "Accounts Executive",
  "HSE / Safety Officer",
];

const PORTAL_MODULES = [
  { key: "dashboard", label: "Dashboard Overview", desc: "Worker strength, orders, invoices & approvals" },
  { key: "workforce", label: "Workforce & Attendance", desc: "Attendance register & plant facilities" },
  { key: "talent", label: "Talent Acquisition", desc: "Job requisitions, candidates & interviews" },
  { key: "rosters", label: "Shift Planning & Rosters", desc: "Roster builder & shift allocations" },
  { key: "approvals", label: "Approvals & Timesheets", desc: "Leave sign-offs, overtime & timesheets" },
  { key: "operations", label: "Worker Operations & Safety", desc: "Worker desk & safety incident logs" },
  { key: "invoices", label: "Invoices & Settlement", desc: "Invoices (ALV 25.5%), payments & credit notes" },
  { key: "master_data", label: "Master Data", desc: "Site, Job Role & Shift master configuration" },
];

const generateDefaultPassword = () => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `Suomi@${num}`;
};

const emptyPerm = (): ModulePermSet => ({
  view: false,
  create: false,
  edit: false,
  approve: false,
});

const buildRolePresetPermissions = (roleName: string): PermissionsMap => {
  const r = (roleName || "").toLowerCase();
  const map: PermissionsMap = {};
  for (const m of PORTAL_MODULES) {
    map[m.key] = emptyPerm();
  }
  map.dashboard = { view: true, create: false, edit: false, approve: false };

  if (r.includes("hr")) {
    map.workforce = { view: true, create: false, edit: false, approve: false };
    map.talent = { view: true, create: true, edit: true, approve: true };
    map.approvals = { view: true, create: false, edit: true, approve: true };
    map.invoices = { view: true, create: false, edit: false, approve: false };
  } else if (r.includes("account") || r.includes("finance")) {
    map.invoices = { view: true, create: true, edit: true, approve: true };
    map.approvals = { view: true, create: false, edit: false, approve: false };
  } else if (r.includes("safety") || r.includes("hse")) {
    map.workforce = { view: true, create: false, edit: false, approve: false };
    map.operations = { view: true, create: true, edit: true, approve: true };
  } else {
    // Plant Director, Site Manager, Shift Supervisor
    map.workforce = { view: true, create: false, edit: true, approve: false };
    map.rosters = { view: true, create: true, edit: true, approve: true };
    map.approvals = { view: true, create: false, edit: true, approve: true };
    map.operations = { view: true, create: true, edit: true, approve: false };
  }
  return map;
};

const parsePermissionsJson = (raw?: string): PermissionsMap => {
  const base: PermissionsMap = {};
  for (const m of PORTAL_MODULES) base[m.key] = emptyPerm();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if (parsed.all === true) {
        for (const m of PORTAL_MODULES) {
          base[m.key] = { view: true, create: true, edit: true, approve: true };
        }
        return base;
      }
      for (const m of PORTAL_MODULES) {
        if (parsed[m.key]) {
          base[m.key] = {
            view: Boolean(parsed[m.key].view),
            create: Boolean(parsed[m.key].create),
            edit: Boolean(parsed[m.key].edit),
            approve: Boolean(parsed[m.key].approve),
          };
        }
      }
    }
  } catch {}
  return base;
};

export const ClientUserManagement: React.FC<ClientUserManagementProps> = ({
  clientId,
  companyName,
  currentUserRole,
  sites,
  activeSubTab,
  onChangeSubTab,
}) => {
  const isClientAdmin = ["HR_ADMIN", "CLIENT_ADMIN", "SUPER_ADMIN", "ADMIN"].includes(
    (currentUserRole || "").toUpperCase()
  );

  const [users, setUsers] = useState<ClientUserRecord[]>([]);
  const [masterJobRoles, setMasterJobRoles] = useState<string[]>(DEFAULT_CLIENT_JOB_ROLES);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    username: string;
    email: string;
    password: string;
  } | null>(null);
  const [copiedPwd, setCopiedPwd] = useState(false);

  // Edit modal & Create form state
  const [editingUser, setEditingUser] = useState<ClientUserRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("HR Manager");
  const [defaultPassword, setDefaultPassword] = useState(() => generateDefaultPassword());
  const [resetPassword, setResetPassword] = useState("");
  const [allSitesSelected, setAllSitesSelected] = useState(false);
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>(
    sites[0] ? [sites[0].id.toString()] : ["1"]
  );
  const [permissions, setPermissions] = useState<PermissionsMap>(() =>
    buildRolePresetPermissions("HR Manager")
  );
  const [isSaving, setIsSaving] = useState(false);
  const [userPendingDelete, setUserPendingDelete] = useState<ClientUserRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsersAndRoles = useCallback(async () => {
    setIsLoading(true);
    try {
      const [uRes, mdRes] = await Promise.all([
        fetch(`${API_BASE}/api/client/${clientId}/users`),
        fetch(`${API_BASE}/api/client/${clientId}/master-data`),
      ]);
      if (uRes.ok) {
        const data = await uRes.json();
        setUsers(data.users || []);
      }
      if (mdRes.ok) {
        const md = await mdRes.json();
        const custom = md.master_data?.client_job_roles || [];
        setMasterJobRoles(Array.from(new Set([...DEFAULT_CLIENT_JOB_ROLES, ...custom])));
      }
    } catch {
      setErrorMsg("Unable to load client users from ERP backend.");
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchUsersAndRoles();
  }, [fetchUsersAndRoles]);

  const resetForm = () => {
    setEditingUser(null);
    setFullName("");
    setUsername("");
    setEmail("");
    const initialRole = masterJobRoles[1] || "HR Manager";
    setSelectedRole(initialRole);
    setDefaultPassword(generateDefaultPassword());
    setResetPassword("");
    setAllSitesSelected(false);
    setSelectedSiteIds(sites[0] ? [sites[0].id.toString()] : ["1"]);
    setPermissions(buildRolePresetPermissions(initialRole));
    setErrorMsg("");
  };

  const openEditModal = (u: ClientUserRecord) => {
    setEditingUser(u);
    setFullName(u.full_name);
    setUsername(u.username || u.email.split("@")[0] || "");
    setEmail(u.email);
    const displayRole = u.role.replace(/_/g, " ");
    const matched = masterJobRoles.find(
      (r) => r.toLowerCase() === displayRole.toLowerCase()
    );
    setSelectedRole(matched || displayRole);
    setResetPassword("");

    const rawSites = (u.assigned_site_ids || "").trim();
    if (rawSites === "*" || rawSites.toLowerCase() === "all") {
      setAllSitesSelected(true);
      setSelectedSiteIds(sites.map((s) => s.id.toString()));
    } else {
      setAllSitesSelected(false);
      setSelectedSiteIds(
        rawSites
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      );
    }

    setPermissions(parsePermissionsJson(u.module_permissions));
    setErrorMsg("");
    setIsEditModalOpen(true);
  };

  const toggleSiteSelection = (siteId: string) => {
    setAllSitesSelected(false);
    setSelectedSiteIds((prev) => {
      if (prev.includes(siteId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== siteId);
      }
      return [...prev, siteId];
    });
  };

  const toggleModuleAll = (modKey: string, checked: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [modKey]: {
        view: checked,
        create: checked,
        edit: checked,
        approve: checked,
      },
    }));
  };

  const togglePermFlag = (modKey: string, flag: keyof ModulePermSet) => {
    setPermissions((prev) => {
      const cur = prev[modKey] || emptyPerm();
      const nextVal = !cur[flag];
      return {
        ...prev,
        [modKey]: {
          ...cur,
          [flag]: nextVal,
          // Turning on Create/Edit/Approve automatically enables View
          view: flag !== "view" && nextVal ? true : flag === "view" ? nextVal : cur.view,
          // Turning off View disables Create/Edit/Approve
          ...(flag === "view" && !nextVal ? { create: false, edit: false, approve: false } : {}),
        },
      };
    });
  };

  const handleCopyPassword = (pwd: string) => {
    try {
      navigator.clipboard.writeText(pwd);
      setCopiedPwd(true);
      setTimeout(() => setCopiedPwd(false), 1800);
    } catch {}
  };

  const handleSaveUser = async (e: React.FormEvent, isEdit: boolean) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const roleCode = selectedRole.trim().toUpperCase().replace(/\s+/g, "_");
    if (!fullName.trim() || (!isEdit && !email.trim()) || !roleCode) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    const assignedStr = allSitesSelected
      ? "*"
      : selectedSiteIds.length > 0
      ? selectedSiteIds.join(",")
      : sites[0]?.id.toString() || "1";

    const permsJson = JSON.stringify(permissions);

    setIsSaving(true);
    try {
      const url =
        isEdit && editingUser
          ? `${API_BASE}/api/client/${clientId}/users/${editingUser.id}`
          : `${API_BASE}/api/client/${clientId}/users`;
      const method = isEdit ? "PATCH" : "POST";

      const finalUsername = (username || "").trim().toLowerCase() || email.trim().toLowerCase().split("@")[0];

      const payload = isEdit
        ? editingUser?.is_client_admin
          ? {
              full_name: fullName.trim(),
              username: finalUsername,
              email: email.trim().toLowerCase(),
              ...(resetPassword.trim() ? { reset_password: resetPassword.trim() } : {}),
            }
          : {
              full_name: fullName.trim(),
              username: finalUsername,
              email: email.trim().toLowerCase(),
              role: roleCode,
              assigned_site_ids: assignedStr,
              module_permissions: permsJson,
              ...(resetPassword.trim() ? { reset_password: resetPassword.trim() } : {}),
            }
        : {
            full_name: fullName.trim(),
            username: finalUsername,
            email: email.trim().toLowerCase(),
            role: roleCode,
            assigned_site_ids: assignedStr,
            default_password: defaultPassword.trim() || generateDefaultPassword(),
            module_permissions: permsJson,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to save user." }));
        setErrorMsg(err.detail || "Failed to save user.");
        return;
      }

      const data = await res.json();
      const savedName = fullName.trim();
      setIsEditModalOpen(false);

      if (!isEdit) {
        setCreatedCredentials({
          name: savedName,
          username: data.username || finalUsername,
          email: data.email || email.trim().toLowerCase(),
          password: data.default_password || defaultPassword,
        });
        setSuccessMsg(`Created operational user "${savedName}" with mandatory first-login password change. Login credentials sent to ${data.email || email}.`);
        resetForm();
        await fetchUsersAndRoles();
        onChangeSubTab("m1.9_user_list");
      } else {
        setSuccessMsg(`Updated operational user "${savedName}" and permissions.`);
        resetForm();
        await fetchUsersAndRoles();
      }
    } catch {
      setErrorMsg("Network error while saving user.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (u: ClientUserRecord) => {
    if (u.is_client_admin) return;
    try {
      const res = await fetch(`${API_BASE}/api/client/${clientId}/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !u.is_active }),
      });
      if (res.ok) await fetchUsersAndRoles();
    } catch {}
  };

  const handleDeleteUser = (u: ClientUserRecord) => {
    if (u.is_client_admin) return;
    setUserPendingDelete(u);
  };

  const confirmDeleteUser = async () => {
    if (!userPendingDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/client/${clientId}/users/${userPendingDelete.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSuccessMsg(`Removed operational user "${userPendingDelete.full_name}".`);
        setUserPendingDelete(null);
        await fetchUsersAndRoles();
      }
    } catch {} finally {
      setIsDeleting(false);
    }
  };

  const renderSiteBadges = (assigned: string) => {
    const raw = (assigned || "*").trim();
    if (raw === "*" || raw.toLowerCase() === "all") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20">
          <Building2 className="w-3 h-3" />
          All Sites
        </span>
      );
    }
    const ids = raw.split(",").map((s) => s.trim());
    return (
      <div className="flex flex-wrap gap-1">
        {ids.map((id) => {
          const site = sites.find((s) => s.id.toString() === id);
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)]"
            >
              <Building2 className="w-2.5 h-2.5 text-[var(--accent-color)]" />
              {site ? `${site.site_code} — ${site.city}` : `Site #${id}`}
              {ids.length === 1 && (
                <span className="text-[9px] text-[var(--text-secondary)] font-normal">(Locked)</span>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  const renderAssignedModulesSummary = (u: ClientUserRecord) => {
    if (u.is_client_admin) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600">
          Full Portal Access
        </span>
      );
    }
    const parsed = parsePermissionsJson(u.module_permissions);
    const activeMods = PORTAL_MODULES.filter((m) => parsed[m.key]?.view);
    if (activeMods.length === 0) {
      return (
        <span className="text-[10px] text-amber-600 font-semibold">No modules assigned</span>
      );
    }
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {activeMods.map((m) => (
          <span
            key={m.key}
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)]"
          >
            {m.label.split(" ")[0]}
          </span>
        ))}
      </div>
    );
  };

  const renderUserFormFields = (isEdit: boolean) => (
    <div className="space-y-5">
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. Identity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
            Full Name *
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Mikko Virtanen"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
            User ID (Login Username) *
          </label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
            placeholder="e.g. mikkov or EMP-1042"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent-color)]"
          />
          <span className="text-[10px] text-[var(--text-secondary)] mt-0.5 block">Unique ID used to log in</span>
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--text-primary)] mb-1 flex items-center justify-between">
            <span>Work Email ID *</span>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <Mail className="w-2.5 h-2.5" /> Email Credentials
            </span>
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. mikko.virtanen@valmet.com"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
          />
          <span className="text-[10px] text-[var(--text-secondary)] mt-0.5 block">Login details will be emailed here</span>
        </div>
      </div>

      {/* 2. Default Password / Reset Password */}
      {!isEdit ? (
        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/25 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
              <span>System Default Temporary Password *</span>
            </label>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
              Mandatory Reset on 1st Login
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              required
              value={defaultPassword}
              onChange={(e) => setDefaultPassword(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] font-mono text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
            />
            <button
              type="button"
              onClick={() => setDefaultPassword(generateDefaultPassword())}
              className="px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--accent-color)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
              title="Generate New Default Password"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Regenerate</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopyPassword(defaultPassword)}
              className="px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--accent-color)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
              title="Copy Password"
            >
              {copiedPwd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPwd ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Share this temporary password with the user. On their first sign-in, the system will require them to create a personal new password before accessing the portal.
          </p>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-1.5">
          <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
            <span>Reset Password (Optional)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Leave blank to keep existing password"
              className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)]"
            />
            <button
              type="button"
              onClick={() => setResetPassword(generateDefaultPassword())}
              className="px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Generate Temp
            </button>
          </div>
          <p className="text-[10px] text-[var(--text-secondary)]">
            Entering a temporary password will force the user to change it on their next login.
          </p>
        </div>
      )}

      {!(isEdit && editingUser?.is_client_admin) ? (
      <>
      {/* 3. Internal Job Role (Synced from Job Role Master) */}
      <div>
        <label className="block text-xs font-bold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
          <Briefcase className="w-3.5 h-3.5 text-[var(--accent-color)]" />
          <span>Internal Job Role (from Job Role Master) *</span>
        </label>
        <select
          value={selectedRole}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedRole(val);
            if (!isEdit) {
              setPermissions(buildRolePresetPermissions(val));
            }
          }}
          className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)] cursor-pointer"
        >
          {masterJobRoles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-[var(--text-secondary)] mt-1">
          Operational roles only. Selecting a role applies recommended module permissions below (customizable).
        </p>
      </div>

      {/* 4. Plant Site Assignment */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-[var(--text-primary)]">
            Assigned Plant Site(s) *
          </label>
          <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={allSitesSelected}
              onChange={(e) => {
                setAllSitesSelected(e.target.checked);
                if (e.target.checked) {
                  setSelectedSiteIds(sites.map((s) => s.id.toString()));
                } else if (sites[0]) {
                  setSelectedSiteIds([sites[0].id.toString()]);
                }
              }}
              className="rounded"
            />
            <span>All Sites</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {sites.map((s) => {
            const checked = allSitesSelected || selectedSiteIds.includes(s.id.toString());
            return (
              <label
                key={s.id}
                className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 cursor-pointer transition-all ${
                  checked
                    ? "border-[var(--accent-color)] bg-[var(--accent-color)]/10"
                    : "border-[var(--border-color)] bg-[var(--bg-secondary)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSiteSelection(s.id.toString())}
                  className="rounded"
                />
                <div className="min-w-0">
                  <div className="font-bold text-[var(--text-primary)] truncate">
                    {s.site_code} — {s.city}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] truncate">
                    {s.site_name}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* 5. Module Access & Granular Permissions Matrix */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-[var(--accent-color)]" />
            <span>Assign Module Access & Permissions *</span>
          </label>
          <div className="flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => {
                const all: PermissionsMap = {};
                for (const m of PORTAL_MODULES) {
                  all[m.key] = { view: true, create: true, edit: true, approve: true };
                }
                setPermissions(all);
              }}
              className="text-[var(--accent-color)] font-bold hover:underline cursor-pointer"
            >
              Grant All
            </button>
            <span className="text-[var(--text-secondary)]">•</span>
            <button
              type="button"
              onClick={() => {
                const viewOnly: PermissionsMap = {};
                for (const m of PORTAL_MODULES) {
                  viewOnly[m.key] = { view: true, create: false, edit: false, approve: false };
                }
                setPermissions(viewOnly);
              }}
              className="text-[var(--text-secondary)] font-semibold hover:text-[var(--text-primary)] cursor-pointer"
            >
              View Only
            </button>
            <span className="text-[var(--text-secondary)]">•</span>
            <button
              type="button"
              onClick={() => {
                const cleared: PermissionsMap = {};
                for (const m of PORTAL_MODULES) cleared[m.key] = emptyPerm();
                setPermissions(cleared);
              }}
              className="text-rose-600 font-semibold hover:underline cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-color)] overflow-x-auto bg-[var(--bg-secondary)]/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-secondary)] text-[10px] font-bold uppercase text-[var(--text-secondary)] border-b border-[var(--border-color)]">
              <tr>
                <th className="px-3.5 py-2.5">Module</th>
                <th className="px-2 py-2.5 text-center">View</th>
                <th className="px-2 py-2.5 text-center">Create</th>
                <th className="px-2 py-2.5 text-center">Edit</th>
                <th className="px-2 py-2.5 text-center">Approve</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {PORTAL_MODULES.map((m) => {
                const p = permissions[m.key] || emptyPerm();
                const allChecked = p.view && p.create && p.edit && p.approve;
                return (
                  <tr key={m.key} className="hover:bg-[var(--bg-secondary)]/60">
                    <td className="px-3.5 py-2.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={p.view}
                          onChange={(e) => toggleModuleAll(m.key, !allChecked && e.target.checked)}
                          className="rounded"
                        />
                        <div>
                          <div className="font-bold text-[var(--text-primary)]">{m.label}</div>
                          <div className="text-[10px] text-[var(--text-secondary)]">{m.desc}</div>
                        </div>
                      </label>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={p.view}
                        onChange={() => togglePermFlag(m.key, "view")}
                        className="rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={p.create}
                        onChange={() => togglePermFlag(m.key, "create")}
                        className="rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={p.edit}
                        onChange={() => togglePermFlag(m.key, "edit")}
                        className="rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={p.approve}
                        onChange={() => togglePermFlag(m.key, "approve")}
                        className="rounded cursor-pointer"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>
      ) : (
        <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300">
          <strong>Client Admin Role & Scope:</strong> Full Portal Access across All Sites (assigned by Agency Super Admin). You can update display name, login username, or password above.
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 w-full">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-[var(--accent-light)] text-[var(--accent-color)] uppercase tracking-wider">
              User Management
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]">
              Client Operational Users
            </span>
          </div>
          <h1 className="text-xl font-black text-[var(--text-primary)] mt-1.5 flex items-center gap-2">
            <UserCog className="w-5 h-5 text-[var(--accent-color)]" />
            <span>Client Portal User Management</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Create operational users, assign default passwords, plant sites, and module permissions for{" "}
            <strong className="text-[var(--text-primary)]">{companyName}</strong>.
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setErrorMsg("");
              onChangeSubTab("m1.9_user_list");
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === "m1.9_user_list"
                ? "bg-[var(--accent-color)] text-white shadow-sm"
                : "bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Directory</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{users.length}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              resetForm();
              onChangeSubTab("m1.9_create_user");
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === "m1.9_create_user"
                ? "bg-[var(--accent-color)] text-white shadow-sm"
                : "bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create New User</span>
          </button>
        </div>
      </div>

      {/* Role Hierarchy Info Strip */}
      <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start sm:items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 sm:mt-0" />
          <div className="text-[var(--text-secondary)]">
            <strong className="text-[var(--text-primary)]">Governance:</strong>{" "}
            <strong>Agency Super Admin</strong> assigns Client Admin accounts & sites.{" "}
            <strong>Client Admin</strong> assigns operational users, module permissions, and temporary passwords (mandatory reset on 1st login).
          </div>
        </div>
        {!isClientAdmin && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 font-bold text-[11px] shrink-0">
            <Lock className="w-3 h-3" />
            Read-Only
          </span>
        )}
      </div>

      {/* Created User Default Credentials Card */}
      {createdCredentials && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Operational User Created — Share Temporary Login Credentials</span>
            </div>
            <button
              type="button"
              onClick={() => setCreatedCredentials(null)}
              className="text-emerald-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs bg-[var(--bg-card)] p-3 rounded-xl border border-emerald-500/20">
            <div>
              <span className="text-[10px] text-[var(--text-secondary)] block">User ID (Login ID)</span>
              <strong className="font-mono text-[var(--text-primary)]">{createdCredentials.username}</strong>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-secondary)] block">Work Email ID</span>
              <strong className="font-mono text-[var(--text-primary)]">{createdCredentials.email}</strong>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-secondary)] block">Default Temporary Password</span>
              <strong className="font-mono text-emerald-600">{createdCredentials.password}</strong>
            </div>
            <div className="flex items-center sm:justify-end">
              <button
                type="button"
                onClick={() =>
                  handleCopyPassword(
                    `User ID: ${createdCredentials.username}\nWork Email: ${createdCredentials.email}\nTemporary Password: ${createdCredentials.password}`
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {copiedPwd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPwd ? "Copied!" : "Copy Credentials"}</span>
              </button>
            </div>
          </div>
          <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
            Login details have been dispatched to <strong>{createdCredentials.email}</strong>. On first login, <strong>{createdCredentials.name}</strong> will be required to create a new password before entering the portal.
          </p>
        </div>
      )}

      {/* Generic Success Banner */}
      {successMsg && !createdCredentials && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {successMsg}
          </span>
          <button type="button" onClick={() => setSuccessMsg("")} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SUB-VIEW 1: USER DIRECTORY */}
      {activeSubTab === "m1.9_user_list" && (
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--accent-color)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                Active & Registered Users ({users.length})
              </h2>
            </div>
            <span className="text-[11px] text-[var(--text-secondary)]">
              {users.filter((u) => !u.is_client_admin).length} Operational •{" "}
              {users.filter((u) => u.is_client_admin).length} Client Admin
            </span>
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-xs text-[var(--text-secondary)]">
              Loading client portal users...
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-color)]">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="p-4 sm:px-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[var(--bg-secondary)]/40 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        u.is_client_admin
                          ? "bg-indigo-600 text-white"
                          : "bg-[var(--accent-color)]/15 text-[var(--accent-color)]"
                      }`}
                    >
                      {u.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          {u.full_name}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                            u.is_client_admin
                              ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                              : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                          }`}
                        >
                          {u.is_client_admin ? "Client Admin" : u.role.replace(/_/g, " ")}
                        </span>
                        {u.must_change_password && !u.is_client_admin && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            Pending 1st Login Reset
                          </span>
                        )}
                        {!u.is_active && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                            Disabled
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
                        <span className="flex items-center gap-1 font-mono font-bold text-[var(--text-primary)]">
                          <UserCog className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                          ID: {u.username || u.email.split("@")[0]}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono">
                          <Mail className="w-3 h-3 opacity-70" />
                          {u.email}
                        </span>
                        <span>•</span>
                        <span className="text-[11px]">
                          Assigned by:{" "}
                          <strong className="text-[var(--text-primary)]">{u.assigned_by}</strong>
                        </span>
                      </div>

                      <div>{renderAssignedModulesSummary(u)}</div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:shrink-0">
                    <div>{renderSiteBadges(u.assigned_site_ids)}</div>

                    {u.is_client_admin ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[11px] font-semibold text-[var(--text-secondary)]">
                          <Lock className="w-3 h-3" />
                          Agency Managed
                        </span>
                        {isClientAdmin && (
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--accent-color)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1 cursor-pointer transition-all"
                            title="Edit Admin Profile / Password"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                    ) : isClientAdmin ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(u)}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                            u.is_active
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                              : "border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20"
                          }`}
                        >
                          {u.is_active ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> Disabled
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--accent-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-all"
                          title="Edit User, Modules & Permissions"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-rose-500 text-[var(--text-secondary)] hover:text-rose-600 cursor-pointer transition-all"
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 2: CREATE NEW USER */}
      {activeSubTab === "m1.9_create_user" && (
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm p-5 sm:p-6 max-w-4xl">
          {!isClientAdmin ? (
            <div className="p-6 text-center space-y-2">
              <Lock className="w-8 h-8 text-amber-500 mx-auto" />
              <h3 className="text-sm font-black text-[var(--text-primary)]">
                Client Admin Access Required
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Only the Client Admin can create new operational users for {companyName}.
              </p>
            </div>
          ) : (
            <form onSubmit={(e) => handleSaveUser(e, false)} className="space-y-5">
              <div className="border-b border-[var(--border-color)] pb-3">
                <h2 className="text-base font-black text-[var(--text-primary)] flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[var(--accent-color)]" />
                  <span>Create New Operational User</span>
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Configure user identity, default temporary password, site access, and module permissions.
                </p>
              </div>

              {renderUserFormFields(false)}

              <div className="pt-4 border-t border-[var(--border-color)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onChangeSubTab("m1.9_user_list")}
                  className="px-4 py-2 rounded-xl border border-[var(--border-color)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? "Creating User..." : "Create Operational User"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
              <h3 className="text-base font-black text-[var(--text-primary)]">
                Edit Operational User & Permissions
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => handleSaveUser(e, true)}
              className="p-5 space-y-4 overflow-y-auto"
            >
              {renderUserFormFields(true)}
              <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--border-color)] text-xs font-bold text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(userPendingDelete)}
        title="Remove Operational User"
        message={
          userPendingDelete
            ? `Are you sure you want to permanently remove "${userPendingDelete.full_name}" (${userPendingDelete.email}) from the Client Portal?`
            : ""
        }
        confirmLabel="Remove User"
        isProcessing={isDeleting}
        onConfirm={confirmDeleteUser}
        onCancel={() => setUserPendingDelete(null)}
      />
    </div>
  );
};
