"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  SlidersHorizontal,
  Globe2,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Building2,
  CheckCircle2
} from "lucide-react";
import { GlobalLoader } from "./GlobalLoader";

interface ClientLoginProps {
  onLoginSuccess: (userData: {
    userId: number;
    fullName: string;
    username?: string;
    email: string;
    role: string;
    clientId: number;
    clientName: string;
    avatarUrl?: string;
    assigned_site_ids?: string;
    mustChangePassword?: boolean;
    modulePermissions?: string;
    token: string;
  }) => void;
  onOpenPreferences: () => void;
  savedPinData: {
    userId?: number;
    pin: string;
    length: 4 | 6;
    userEmail: string;
    userName: string;
    avatarUrl?: string;
    role?: string;
    assigned_site_ids?: string;
    modulePermissions?: string;
  } | null;
}

interface CompanyData {
  id: number;
  name: string;
  business_id: string;
  logo_url: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const ClientLogin: React.FC<ClientLoginProps> = ({
  onLoginSuccess,
  onOpenPreferences,
  savedPinData,
}) => {
  const [loginMode, setLoginMode] = useState<"password" | "pin">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Dynamically fetched company creation data for left column
  const [company, setCompany] = useState<CompanyData>({
    id: 1,
    name: "Valmet Technologies Oy",
    business_id: "2516487-1",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Valmet_Logo.svg/512px-Valmet_Logo.svg.png",
  });

  // Fetch actual company creation data from backend
  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/client/1/companies`);
        if (res.ok) {
          const data = await res.json();
          setCompany({
            id: data.id,
            name: data.name,
            business_id: data.business_id,
            logo_url: data.logo_url,
          });
        }
      } catch {}
    };
    fetchCompanyData();
  }, []);

  useEffect(() => {
    if (savedPinData?.pin) {
      setLoginMode("pin");
      setEmail(savedPinData.userEmail);
    }
  }, [savedPinData]);

  // Main login executor (strictly manual submit against FastAPI backend)
  const executeLogin = useCallback(async (loginEmail: string, loginPassword: string) => {
    const targetEmail = (loginEmail || "").trim().toLowerCase();
    const targetPassword = (loginPassword || "").trim();

    if (!targetEmail || !targetPassword) {
      setErrorMessage("Please enter both your User ID (email) and password.");
      return;
    }

    setErrorMessage("");
    setIsLoading(true);
    const startTime = Date.now();

    try {
      const res = await fetch(`${API_BASE}/api/client/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPassword }),
      });

      const elapsed = Date.now() - startTime;
      const minDuration = 600;
      const remainingTime = Math.max(minDuration - elapsed, 0);

      if (res.ok) {
        const data = await res.json();
        setTimeout(() => {
          onLoginSuccess({
            userId: data.user_id,
            fullName: data.full_name,
            username: data.username || (data.email ? data.email.split("@")[0] : ""),
            email: data.email,
            role: data.role,
            clientId: data.client_id,
            clientName: data.client_name,
            avatarUrl: data.avatar_url || localStorage.getItem(`erp_user_avatar_${data.user_id}`) || "",
            assigned_site_ids: data.assigned_site_ids,
            mustChangePassword: Boolean(data.must_change_password),
            modulePermissions: data.module_permissions || "{}",
            token: data.token,
          });
        }, remainingTime);
      } else {
        const err = await res.json().catch(() => ({ detail: "Invalid ID or password." }));
        setTimeout(() => {
          setIsLoading(false);
          setIsPasswordVerified(false);
          setErrorMessage(err.detail || "Invalid ID or password.");
        }, remainingTime);
      }
    } catch {
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(600 - elapsed, 0);
      setTimeout(() => {
        setIsLoading(false);
        setIsPasswordVerified(false);
        setErrorMessage("Unable to connect to authentication server. Please try again.");
      }, remainingTime);
    }
  }, [onLoginSuccess]);

  // Handle manual submit
  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    executeLogin(email, password);
  };

  // Watch for PIN entry (only if user explicitly configured a PIN previously)
  useEffect(() => {
    if (loginMode !== "pin" || !savedPinData) return;
    if (enteredPin.length === savedPinData.length) {
      if (enteredPin === savedPinData.pin) {
        setIsPasswordVerified(true);
        setErrorMessage("");
        setIsLoading(true);
        const timer = setTimeout(() => {
          const resolvedUserId =
            savedPinData.userId ||
            (savedPinData.userEmail.toLowerCase().includes("developer") || savedPinData.userEmail.toLowerCase().includes("rishikesh") ? 3 :
             savedPinData.userEmail.toLowerCase().includes("heikki") ? 2 : 1);
          onLoginSuccess({
            userId: resolvedUserId,
            fullName: savedPinData.userName || (resolvedUserId === 3 ? "Rishikesh" : "Client User"),
            email: savedPinData.userEmail,
            role: savedPinData.role || (resolvedUserId === 1 ? "CLIENT_ADMIN" : "SITE_MANAGER"),
            clientId: company.id,
            clientName: company.name,
            avatarUrl: savedPinData.avatarUrl || localStorage.getItem(`erp_user_avatar_${resolvedUserId}`) || "",
            assigned_site_ids: savedPinData.assigned_site_ids || "*",
            modulePermissions: savedPinData.modulePermissions || "{}",
            token: `pin_session_${Date.now()}`,
          });
        }, 600);
        return () => clearTimeout(timer);
      } else {
        setErrorMessage("Incorrect Security PIN. Please try again.");
      }
    }
  }, [enteredPin, loginMode, savedPinData, company.id, company.name, onLoginSuccess]);

  // Handle PIN manual submit
  const handlePinLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedPinData) {
      setErrorMessage("No PIN configured. Please sign in with password.");
      return;
    }
    if (enteredPin !== savedPinData.pin) {
      setErrorMessage("Incorrect Security PIN. Please try again.");
      return;
    }
    setIsPasswordVerified(true);
    setErrorMessage("");
    setIsLoading(true);
    setTimeout(() => {
      const resolvedUserId =
        savedPinData.userId ||
        (savedPinData.userEmail.toLowerCase().includes("developer") || savedPinData.userEmail.toLowerCase().includes("rishikesh") ? 3 :
         savedPinData.userEmail.toLowerCase().includes("heikki") ? 2 : 1);
      onLoginSuccess({
        userId: resolvedUserId,
        fullName: savedPinData.userName || (resolvedUserId === 3 ? "Rishikesh" : "Client User"),
        email: savedPinData.userEmail,
        role: savedPinData.role || (resolvedUserId === 1 ? "CLIENT_ADMIN" : "SITE_MANAGER"),
        clientId: company.id,
        clientName: company.name,
        avatarUrl: savedPinData.avatarUrl || localStorage.getItem(`erp_user_avatar_${resolvedUserId}`) || "",
        assigned_site_ids: savedPinData.assigned_site_ids || "*",
        modulePermissions: savedPinData.modulePermissions || "{}",
        token: `pin_session_${Date.now()}`,
      });
    }, 600);
  };

  return (
    <div className="min-h-screen w-full flex bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors select-none relative">
      {/* Global Animated Glow Loader Overlay */}
      <GlobalLoader isLoading={isLoading} />

      {/* LEFT COLUMN: JUST THE ACTUAL CLIENT COMPANY LOGO & NAME */}
      <div className="hidden lg:flex lg:w-1/2 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] p-12 flex-col justify-center items-center relative overflow-hidden">
        {/* Subtle Nordic ambient glow */}
        <div className="absolute w-[420px] h-[420px] rounded-full bg-[var(--accent-color)] opacity-5 blur-3xl pointer-events-none"></div>

        <div className="flex flex-col items-center text-center max-w-md z-10 space-y-6">
          {/* Company Logo Container */}
          <div className="w-36 h-36 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl p-5 flex items-center justify-center transition-all hover:scale-105 duration-300">
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt={`${company.name} Logo`}
                className="max-h-full max-w-full object-contain filter drop-shadow-sm"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                  const fallback = document.getElementById("company-fallback-logo");
                  if (fallback) fallback.style.display = "flex";
                }}
              />
            ) : null}
            <div
              id="company-fallback-logo"
              style={{ display: company.logo_url ? "none" : "flex" }}
              className="w-full h-full items-center justify-center flex-col"
            >
              <svg viewBox="0 0 120 40" fill="none" className="w-28 h-auto">
                <path d="M8 8 L24 20 L8 32 L16 32 L32 20 L16 8 Z" fill="#009E44" />
                <path d="M20 8 L36 20 L20 32 L28 32 L44 20 L28 8 Z" fill="#007A33" opacity="0.8" />
                <text x="48" y="26" fill="currentColor" fontWeight="800" fontSize="20" letterSpacing="-0.5px">
                  Valmet
                </text>
              </svg>
            </div>
          </div>

          {/* Company Name Only */}
          <div>
            <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
              {company.name}
            </h1>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: The Login Screen */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-12 overflow-y-auto">
        {/* Top Header Controls */}
        <div className="flex items-center justify-between w-full">
          {/* Mobile Company Name & Logo for small screens */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] p-1 flex items-center justify-center">
              {company.logo_url ? (
                <img src={company.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <Building2 className="w-4 h-4 text-[var(--accent-color)]" />
              )}
            </div>
            <span className="text-xs font-bold text-[var(--text-primary)] truncate max-w-[180px]">
              {company.name}
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              title="Kieli / Language"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all"
            >
              <Globe2 className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <span>FI | EN</span>
            </button>

            <button
              onClick={onOpenPreferences}
              title="UI Theme & Typography Preferences"
              className="p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Login Box */}
        <div className="w-full max-w-md mx-auto my-auto py-8">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <img
                src="/rekrysilta-logo.png?v=2"
                alt="RekrySilta Logo"
                className="h-24 sm:h-28 w-auto object-contain drop-shadow-md transition-transform duration-300 hover:scale-105"
              />
            </div>
            <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
              {loginMode === "pin" ? "Quick PIN Sign-In" : "Client Portal Sign-In"}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {loginMode === "pin"
                ? `Enter your ${savedPinData?.length || 4}-digit security PIN`
                : "Authorized access for Client HR, Site Supervisors & Finance"}
            </p>
          </div>

          {/* MODE 1: QUICK PIN LOGIN */}
          {loginMode === "pin" && savedPinData ? (
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="flex items-center justify-center gap-2.5 mb-6 p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                <div className="w-8 h-8 rounded-full bg-[var(--accent-color)] text-white font-bold text-xs flex items-center justify-center">
                  {savedPinData.userName ? savedPinData.userName[0] : "U"}
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-[var(--text-primary)]">
                    {savedPinData.userName || "Client User"}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] truncate">
                    {savedPinData.userEmail}
                  </div>
                </div>
              </div>

              <form onSubmit={handlePinLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-2 text-center">
                    Enter {savedPinData.length}-Digit PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoFocus
                    maxLength={savedPinData.length}
                    value={enteredPin}
                    onChange={(e) => {
                      setEnteredPin(e.target.value.replace(/\D/g, "").slice(0, savedPinData.length));
                      setErrorMessage("");
                    }}
                    placeholder={"•".repeat(savedPinData.length)}
                    className="w-48 mx-auto block text-center tracking-[0.6em] text-xl font-mono font-bold py-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
                  />
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* If PIN verified, button is NOT required */}
                {isPasswordVerified ? (
                  <div className="w-full py-3 px-4 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-pulse" />
                    <span>PIN Verified • Unlocking Workspace...</span>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={isLoading || enteredPin.length !== savedPinData.length}
                    className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span>Unlock Client Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMode("password");
                      setErrorMessage("");
                      setIsPasswordVerified(false);
                    }}
                    className="text-xs font-semibold text-[var(--accent-color)] hover:underline"
                  >
                    Use Work Email & Password instead
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* MODE 2: STANDARD EMAIL & PASSWORD LOGIN (No Auto-Fill / No Demo Users) */
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 shadow-xl">
              {/* Form */}
              <form onSubmit={handlePasswordLogin} autoComplete="off" className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5 flex items-center justify-between">
                    <span>User ID / Work Email</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">Sign in with User ID or Email</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      placeholder="e.g. mikkov or mikko@valmet.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrorMessage("");
                      }}
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-[var(--text-primary)]">
                      Password
                    </label>
                    <span className="text-[10px] text-[var(--accent-color)] hover:underline cursor-pointer">
                      Forgot Password?
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMessage("");
                      }}
                      className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !email || !password}
                  className="w-full mt-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <span>{isLoading ? "Signing In..." : "Sign In to Client Workspace"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {savedPinData && (
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginMode("pin");
                        setErrorMessage("");
                        setIsPasswordVerified(false);
                      }}
                      className="text-xs font-semibold text-[var(--accent-color)] hover:underline flex items-center justify-center gap-1 mx-auto"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Switch to Quick PIN Sign-In</span>
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>

        {/* Bottom Security Footer */}
        <div className="text-center text-[10px] text-[var(--text-secondary)] pt-4 border-t border-[var(--border-color)] flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>RekrySilta ERP • Encrypted TLS Session • Työaikalaki & ALV 25.5% Compliant</span>
        </div>
      </div>
    </div>
  );
};
