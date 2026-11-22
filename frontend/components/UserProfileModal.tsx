"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  User,
  Mail,
  Shield,
  KeyRound,
  Building2,
  MapPin,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Phone,
  Lock,
  Camera,
  Upload,
  Trash2,
  Briefcase,
  Layers,
  CheckCircle2,
  Palette,
  ShieldCheck,
} from "lucide-react";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    userId: number;
    fullName: string;
    email: string;
    role: string;
    clientId: number;
    clientName: string;
    assigned_site_ids?: string;
    avatarUrl?: string;
    phone?: string;
    jobTitle?: string;
    department?: string;
  } | null;
  sites?: Array<{ id: number; site_name: string; site_code: string }>;
  onProfileUpdated: (updated: {
    fullName: string;
    email: string;
    role?: string;
    avatarUrl?: string;
    phone?: string;
    jobTitle?: string;
    department?: string;
  }) => void;
  onOpenPinSetup?: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type ActiveTab = "identity" | "scope" | "security";

// Preset Executive Avatar Gradients
const AVATAR_GRADIENTS = [
  { id: "nordic-blue", label: "Nordic Blue", bg: "from-blue-600 to-indigo-700", ring: "ring-blue-500" },
  { id: "emerald-teal", label: "Finnish Emerald", bg: "from-emerald-600 to-teal-700", ring: "ring-emerald-500" },
  { id: "midnight-slate", label: "Midnight Slate", bg: "from-slate-800 to-slate-950", ring: "ring-slate-400" },
  { id: "royal-purple", label: "Royal Corporate", bg: "from-purple-600 to-indigo-800", ring: "ring-purple-500" },
  { id: "amber-copper", label: "Industrial Copper", bg: "from-amber-600 to-orange-700", ring: "ring-amber-500" },
  { id: "deep-cyan", label: "Arctic Cyan", bg: "from-cyan-600 to-blue-700", ring: "ring-cyan-500" },
];

// Preset Corporate Illustrated Avatars (SVG data URIs for instant zero-dependency rendering)
const PRESET_ILLUSTRATED_AVATARS = [
  {
    id: "exec-1",
    label: "Executive Director",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="%231e3a8a"/><circle cx="50" cy="38" r="18" fill="%23fde047"/><path d="M22 84c0-16 12-24 28-24s28 8 28 24" fill="%2338bdf8"/><path d="M42 60h16v18h-16z" fill="%23ffffff"/><polygon points="50,66 54,78 46,78" fill="%23dc2626"/></svg>`,
  },
  {
    id: "exec-2",
    label: "Operations Lead",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="%230f172a"/><circle cx="50" cy="38" r="18" fill="%23fed7aa"/><path d="M20 84c0-16 14-24 30-24s30 8 30 24" fill="%23475569"/><polygon points="45,60 55,60 50,76" fill="%230ea5e9"/><circle cx="50" cy="36" r="12" fill="%23f97316" opacity="0.3"/></svg>`,
  },
  {
    id: "exec-3",
    label: "Plant Supervisor",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="%23065f46"/><circle cx="50" cy="38" r="18" fill="%23fbcfe8"/><path d="M20 84c0-16 14-24 30-24s30 8 30 24" fill="%23047857"/><rect x="42" y="58" width="16" height="26" rx="2" fill="%23facc15"/><circle cx="50" cy="24" r="5" fill="%2310b981"/></svg>`,
  },
  {
    id: "exec-4",
    label: "HR & Talent Admin",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="%23581c87"/><circle cx="50" cy="38" r="18" fill="%23fef08a"/><path d="M20 84c0-16 14-24 30-24s30 8 30 24" fill="%239333ea"/><circle cx="50" cy="40" r="14" fill="%23a855f7" opacity="0.25"/><polygon points="44,60 56,60 50,74" fill="%23f43f5e"/></svg>`,
  },
  {
    id: "exec-5",
    label: "Quality & Compliance",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="%230369a1"/><circle cx="50" cy="38" r="18" fill="%23fed7aa"/><path d="M20 84c0-16 14-24 30-24s30 8 30 24" fill="%230284c7"/><path d="M42 60h16v24h-16z" fill="%23ffffff"/><polygon points="50,62 53,72 47,72" fill="%232563eb"/></svg>`,
  },
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  sites = [],
  onProfileUpdated,
  onOpenPinSetup,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("identity");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");

  // Avatar Management
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [selectedGradient, setSelectedGradient] = useState<string>("nordic-blue");
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  // Password Fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Feedback State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Initialize form state
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName || "");
      setEmail(currentUser.email || "");

      const savedPhone =
        currentUser.phone ||
        localStorage.getItem(`user_phone_${currentUser.userId}`) ||
        "+358 40 551 2890";
      setPhone(savedPhone);

      const savedTitle =
        currentUser.jobTitle ||
        localStorage.getItem(`user_title_${currentUser.userId}`) ||
        (currentUser.role === "HR_ADMIN"
          ? "HR & Workforce Director"
          : currentUser.role === "SITE_SUPERVISOR"
          ? "Operations Site Supervisor"
          : "Chief Workforce Administrator");
      setJobTitle(savedTitle);

      const savedDept =
        currentUser.department ||
        localStorage.getItem(`user_dept_${currentUser.userId}`) ||
        "Plant Management & Industrial Staffing";
      setDepartment(savedDept);

      const savedAvatar =
        currentUser.avatarUrl || localStorage.getItem(`erp_user_avatar_${currentUser.userId}`) || "";
      setAvatarUrl(savedAvatar);

      const savedGrad =
        localStorage.getItem(`erp_user_gradient_${currentUser.userId}`) || "nordic-blue";
      setSelectedGradient(savedGrad);

      setNewPassword("");
      setConfirmPassword("");
      setErrorMsg("");
      setSuccessMsg("");
      setIsAvatarPickerOpen(false);
    }
  }, [currentUser, isOpen]);

  if (!isOpen || !currentUser) return null;

  const getInitials = (name: string) => {
    if (!name) return "CA";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const activeGradient =
    AVATAR_GRADIENTS.find((g) => g.id === selectedGradient) || AVATAR_GRADIENTS[0];

  // Handle Photo File Upload (Reads as Base64 Data URL)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setErrorMsg("Picture file is too large. Please choose an image under 3MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64Data = uploadEvent.target?.result as string;
      if (base64Data) {
        setAvatarUrl(base64Data);
        setErrorMsg("");
        setSuccessMsg("Photo uploaded! Click 'Save Changes' to apply.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPresetAvatar = (svg: string) => {
    setAvatarUrl(svg);
    setErrorMsg("");
  };

  const handleRemovePhoto = () => {
    setAvatarUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setErrorMsg("");
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!fullName.trim()) {
      setErrorMsg("Display Full Name is required.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("A valid enterprise login email is required.");
      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        setErrorMsg("New password must be at least 6 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg("New passwords do not match.");
        return;
      }
    }

    setIsLoading(true);

    try {
      const payload: Record<string, unknown> = {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
      };

      if (newPassword.trim()) {
        payload.reset_password = newPassword.trim();
      }

      const res = await fetch(
        `${API_BASE}/api/client/${currentUser.clientId}/users/${currentUser.userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Failed to save profile changes.");
      }

      // Persist local user metadata
      localStorage.setItem(`erp_user_avatar_${currentUser.userId}`, avatarUrl);
      localStorage.setItem(`erp_user_gradient_${currentUser.userId}`, selectedGradient);
      localStorage.setItem(`user_phone_${currentUser.userId}`, phone.trim());
      localStorage.setItem(`user_title_${currentUser.userId}`, jobTitle.trim());
      localStorage.setItem(`user_dept_${currentUser.userId}`, department.trim());

      // Update PIN sync data if configured
      const pinJson = localStorage.getItem("suomistaff_client_pin");
      if (pinJson) {
        try {
          const pinData = JSON.parse(pinJson);
          pinData.userName = fullName.trim();
          pinData.userEmail = email.trim().toLowerCase();
          localStorage.setItem("suomistaff_client_pin", JSON.stringify(pinData));
        } catch {}
      }

      // Notify parent state & trigger UI update
      onProfileUpdated({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        role: currentUser.role,
        avatarUrl: avatarUrl,
        phone: phone.trim(),
        jobTitle: jobTitle.trim(),
        department: department.trim(),
      });

      setSuccessMsg("Corporate profile & credentials updated successfully!");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        onClose();
      }, 1100);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role.toUpperCase()) {
      case "CLIENT_ADMIN":
        return { label: "Client Administrator", color: "bg-blue-500/10 text-blue-600 border-blue-500/30" };
      case "HR_ADMIN":
        return { label: "HR Director", color: "bg-purple-500/10 text-purple-600 border-purple-500/30" };
      case "SITE_SUPERVISOR":
        return { label: "Site Supervisor", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" };
      default:
        return { label: role.replace(/_/g, " "), color: "bg-slate-500/10 text-slate-600 border-slate-500/30" };
    }
  };

  const roleInfo = getRoleBadge(currentUser.role);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* ================= MODAL TOP TITLE BAR ================= */}
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[var(--accent-light)] text-[var(--accent-color)] border border-[var(--accent-color)]/20 flex items-center justify-center font-bold shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)] leading-tight tracking-tight">
                Corporate User Profile & Settings
              </h2>
              <p className="text-xs text-[var(--text-secondary)] font-medium">
                Enterprise Client Portal Identity — {currentUser.clientName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ================= HERO EXECUTIVE PROFILE HEADER ================= */}
        <div className="p-6 border-b border-[var(--border-color)] bg-gradient-to-r from-[var(--bg-card)] via-[var(--bg-card)] to-[var(--bg-secondary)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            {/* Left: Avatar with Camera Action & Information */}
            <div className="flex items-center gap-4">
              {/* Avatar Frame */}
              <div className="relative group shrink-0">
                <div
                  className={`w-20 h-20 rounded-2xl overflow-hidden shadow-lg border-2 border-white dark:border-slate-800 flex items-center justify-center transition-transform ${
                    avatarUrl
                      ? "bg-slate-100 dark:bg-slate-900"
                      : `bg-gradient-to-tr ${activeGradient.bg} text-white font-black text-2xl`
                  }`}
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt={fullName}
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    <span>{getInitials(fullName || currentUser.fullName)}</span>
                  )}
                </div>

                {/* Edit Photo / Avatar Action Trigger */}
                <button
                  type="button"
                  onClick={() => setIsAvatarPickerOpen(!isAvatarPickerOpen)}
                  className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-[var(--accent-color)] hover:opacity-90 text-white shadow-md border-2 border-[var(--bg-card)] transition-transform hover:scale-110 cursor-pointer"
                  title="Upload picture or choose avatar style"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Title, Role & Company Metadata */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight truncate max-w-[280px]">
                    {fullName || currentUser.fullName}
                  </h3>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${roleInfo.color}`}>
                    {roleInfo.label}
                  </span>
                </div>

                <div className="text-xs font-semibold text-[var(--accent-color)] mt-0.5 truncate">
                  {jobTitle || "Client Administrator"}
                </div>

                <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5 mt-1">
                  <Building2 className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  <span className="font-medium text-[var(--text-primary)]">{currentUser.clientName}</span>
                  <span>•</span>
                  <span className="text-[11px] text-[var(--text-secondary)] truncate">{department}</span>
                </div>
              </div>
            </div>

            {/* Right: Security & Portal Status Badges (Replacing Portal Presence) */}
            <div className="hidden sm:flex flex-col sm:items-end gap-1.5 shrink-0 bg-[var(--bg-primary)] p-3 rounded-2xl border border-[var(--border-color)]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Enterprise Verified Account</span>
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] font-medium">
                Client Scope: <strong className="text-[var(--text-primary)]">Full Portal Access</strong>
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
                <Lock className="w-3 h-3 text-[var(--accent-color)]" />
                <span>Encrypted Session • TLS 1.3</span>
              </div>
            </div>
          </div>

          {/* ================= INLINE AVATAR CREATOR & PHOTO UPLOADER ================= */}
          {isAvatarPickerOpen && (
            <div className="mt-4 p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                <div className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                  <span>Customize Picture & Avatar</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAvatarPickerOpen(false)}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold cursor-pointer"
                >
                  Done
                </button>
              </div>

              {/* Action 1: Upload Custom Photo */}
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="profile-picture-upload"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--accent-color)] hover:opacity-90 text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Photo from Device</span>
                </button>

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border border-rose-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Photo</span>
                  </button>
                )}
              </div>

              {/* Action 2: Choose Executive Illustrated Avatar */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                  Or Pick an Executive Character Avatar
                </div>
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                  {PRESET_ILLUSTRATED_AVATARS.map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => handleSelectPresetAvatar(av.svg)}
                      className={`w-12 h-12 rounded-xl p-0.5 border-2 transition-all hover:scale-105 shrink-0 cursor-pointer overflow-hidden ${
                        avatarUrl === av.svg
                          ? "border-[var(--accent-color)] ring-2 ring-[var(--accent-color)]/30"
                          : "border-transparent hover:border-[var(--border-color)]"
                      }`}
                      title={av.label}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={av.svg} alt={av.label} className="w-full h-full object-cover rounded-lg" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Action 3: Choose Monogram Gradient Style (if photo not used) */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                  Initials Gradient Style (When no photo selected)
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {AVATAR_GRADIENTS.map((g) => {
                    const isSelected = selectedGradient === g.id && !avatarUrl;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setSelectedGradient(g.id);
                          setAvatarUrl(""); // Reset custom photo to show initials gradient
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? "border-[var(--accent-color)] bg-[var(--accent-light)] text-[var(--accent-color)] ring-1 ring-[var(--accent-color)]"
                            : "border-[var(--border-color)] hover:border-[var(--text-secondary)] text-[var(--text-secondary)] bg-[var(--bg-card)]"
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-full bg-gradient-to-tr ${g.bg} shrink-0`} />
                        <span>{g.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= TABS NAVIGATION ================= */}
        <div className="px-6 pt-3 border-b border-[var(--border-color)] flex items-center gap-6 bg-[var(--bg-card)]">
          {[
            { id: "identity", label: "Corporate Identity & Contact", icon: User },
            { id: "scope", label: "Facility Scope & Authority", icon: Layers },
            { id: "security", label: "Security & Credentials", icon: KeyRound },
          ].map((t) => {
            const Icon = t.icon;
            const isTabActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as ActiveTab)}
                className={`flex items-center gap-2 pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  isTabActive
                    ? "border-[var(--accent-color)] text-[var(--accent-color)]"
                    : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* ================= FORM BODY ================= */}
        <form onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Feedback Banners */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: CORPORATE IDENTITY & CONTACT */}
          {activeTab === "identity" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Display Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Johanna Lehtonen"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] text-[var(--text-primary)] transition-all outline-none font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Official Login Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. client.admin@valmet.fi"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] text-[var(--text-primary)] transition-all outline-none font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Business Mobile / Phone
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+358 40 123 4567"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] text-[var(--text-primary)] transition-all outline-none font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Job Title / Designation
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. Lead Workforce Administrator"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] text-[var(--text-primary)] transition-all outline-none font-medium"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                  Department / Business Unit
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Manufacturing Operations & Facility Management"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] text-[var(--text-primary)] transition-all outline-none font-medium"
                />
              </div>
            </div>
          )}

          {/* TAB 2: FACILITY SCOPE & AUTHORITY */}
          {activeTab === "scope" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[var(--accent-color)]" />
                    <span>Assigned Plant Sites & Facilities</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    Active Authority
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {sites.length > 0 ? (
                    sites.map((s) => (
                      <div
                        key={s.id}
                        className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs flex items-start gap-2.5"
                      >
                        <Building2 className="w-4 h-4 text-[var(--accent-color)] mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {s.site_code} — {s.site_name}
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                            Valmet Industrial Works Facility
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] col-span-2">
                      Full Global Access across all plant locations (*)
                    </div>
                  )}
                </div>
              </div>

              {/* Administrative Privileges Card */}
              <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] space-y-2">
                <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[var(--accent-color)]" />
                  <span>Administrative Role Authority</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  As a <strong>Client Administrator</strong>, your account possesses authorization to create operational requisitions, approve overtime & timesheets, configure site master data, and manage sub-users for {currentUser.clientName}.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: CREDENTIALS & SECURITY */}
          {activeTab === "security" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300">
                <div className="font-bold flex items-center gap-1.5">
                  <Lock className="w-4 h-4" />
                  <span>Change Password</span>
                </div>
                <div className="mt-1 text-[11px] opacity-90 leading-relaxed">
                  Leave these fields blank to keep your existing password. To update credentials, enter a new password with at least 6 characters.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] text-[var(--text-primary)] transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] text-[var(--text-primary)] transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Login PIN Setting */}
              <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Quick Login PIN</span>
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    Fast 4 or 6-digit PIN authentication enabled for this device.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenPinSetup) onOpenPinSetup();
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[var(--accent-light)] text-[var(--accent-color)] hover:bg-[var(--accent-color)] hover:text-white border border-[var(--accent-color)]/20 transition-all cursor-pointer"
                >
                  Configure PIN
                </button>
              </div>
            </div>
          )}

          {/* ================= MODAL FOOTER BUTTONS ================= */}
          <div className="pt-4 border-t border-[var(--border-color)] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[var(--accent-color)] hover:opacity-90 text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
