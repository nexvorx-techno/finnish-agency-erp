"use client";

import React, { useEffect, useState } from "react";
import { Check, X, Palette, Type, Sparkles, Sun, Moon, Briefcase, PanelLeft, PanelBottom, LayoutTemplate, Timer } from "lucide-react";

export type ThemeType = "light" | "dark" | "colourful" | "classic";
export type FontType =
  | "plus-jakarta-sans"
  | "inter"
  | "outfit"
  | "poppins"
  | "jetbrains-mono";
export type MenuPositionType = "left" | "bottom";

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuPosition?: MenuPositionType;
  onMenuPositionChange?: (pos: MenuPositionType) => void;
  sessionTimeoutSec?: number;
  onSessionTimeoutChange?: (sec: number) => void;
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  isOpen,
  onClose,
  menuPosition = "left",
  onMenuPositionChange,
  sessionTimeoutSec = 180,
  onSessionTimeoutChange,
}) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeType>("light");
  const [currentFont, setCurrentFont] = useState<FontType>("plus-jakarta-sans");
  const [currentMenuPos, setCurrentMenuPos] = useState<MenuPositionType>(menuPosition);
  const [currentTimeout, setCurrentTimeout] = useState<number>(sessionTimeoutSec);

  useEffect(() => {
    const savedTheme = (localStorage.getItem("erp_theme") as ThemeType) || "light";
    const savedFont = (localStorage.getItem("erp_font") as FontType) || "plus-jakarta-sans";
    const savedMenuPos = (localStorage.getItem("erp_menu_position") as MenuPositionType) || "left";
    const savedTimeout = Number(localStorage.getItem("erp_session_timeout_sec")) || 180;
    setCurrentTheme(savedTheme);
    setCurrentFont(savedFont);
    setCurrentMenuPos(savedMenuPos);
    setCurrentTimeout(savedTimeout >= 30 ? savedTimeout : 180);
  }, [isOpen]);

  const handleTimeoutChange = (sec: number) => {
    const clamped = Math.max(30, Math.min(3600, Math.round(sec) || 180));
    setCurrentTimeout(clamped);
    localStorage.setItem("erp_session_timeout_sec", String(clamped));
    if (onSessionTimeoutChange) {
      onSessionTimeoutChange(clamped);
    }
  };

  const handleThemeChange = (theme: ThemeType) => {
    setCurrentTheme(theme);
    localStorage.setItem("erp_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  };

  const handleFontChange = (font: FontType) => {
    setCurrentFont(font);
    localStorage.setItem("erp_font", font);
    document.documentElement.setAttribute("data-font", font);
  };

  const handleMenuPosChange = (pos: MenuPositionType) => {
    setCurrentMenuPos(pos);
    localStorage.setItem("erp_menu_position", pos);
    if (onMenuPositionChange) {
      onMenuPositionChange(pos);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-2xl overflow-hidden transition-all duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-[var(--accent-color)]" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Profile Preferences & UI Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Theme Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Palette className="w-4 h-4 text-[var(--accent-color)]" />
                Color Mode
              </label>
              <span className="text-xs text-[var(--text-secondary)]">
                Active: {currentTheme.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Light Mode */}
              <button
                onClick={() => handleThemeChange("light")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  currentTheme === "light"
                    ? "border-[var(--accent-color)] bg-[var(--accent-light)] ring-2 ring-[var(--accent-ring)]"
                    : "border-[var(--border-color)] hover:border-[var(--text-secondary)] bg-[var(--bg-primary)]"
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-2 text-blue-600">
                  <Sun className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Light
                </span>
                <span className="text-[10px] text-[var(--text-secondary)]">
                  Swiss Clean
                </span>
              </button>

              {/* Dark Mode */}
              <button
                onClick={() => handleThemeChange("dark")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  currentTheme === "dark"
                    ? "border-[var(--accent-color)] bg-[var(--accent-light)] ring-2 ring-[var(--accent-ring)]"
                    : "border-[var(--border-color)] hover:border-[var(--text-secondary)] bg-[var(--bg-primary)]"
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 shadow-sm flex items-center justify-center mb-2 text-blue-400">
                  <Moon className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Dark
                </span>
                <span className="text-[10px] text-[var(--text-secondary)]">
                  Obsidian
                </span>
              </button>

              {/* Colour Full Mode */}
              <button
                onClick={() => handleThemeChange("colourful")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  currentTheme === "colourful"
                    ? "border-[var(--accent-color)] bg-[var(--accent-light)] ring-2 ring-[var(--accent-ring)]"
                    : "border-[var(--border-color)] hover:border-[var(--text-secondary)] bg-[var(--bg-primary)]"
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 shadow-sm flex items-center justify-center mb-2 text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Colour Full
                </span>
                <span className="text-[10px] text-[var(--text-secondary)]">
                  Vibrant Pastel
                </span>
              </button>

              {/* Classic Mode */}
              <button
                onClick={() => handleThemeChange("classic")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  currentTheme === "classic"
                    ? "border-[var(--accent-color)] bg-[var(--accent-light)] ring-2 ring-[var(--accent-ring)]"
                    : "border-[var(--border-color)] hover:border-[var(--text-secondary)] bg-[var(--bg-primary)]"
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-[#004030] border border-amber-500/50 shadow-sm flex items-center justify-center mb-2 text-amber-400">
                  <Briefcase className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Classic
                </span>
                <span className="text-[10px] text-[var(--text-secondary)]">
                  Tally Prime
                </span>
              </button>
            </div>
          </div>

          {/* Typography Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Type className="w-4 h-4 text-[var(--accent-color)]" />
                Font Family
              </label>
              <span className="text-xs text-[var(--text-secondary)]">
                Active: {currentFont}
              </span>
            </div>

            <div className="space-y-2">
              {[
                { id: "plus-jakarta-sans", name: "Plus Jakarta Sans", desc: "Modern & Geometric (Default)" },
                { id: "inter", name: "Inter", desc: "High legibility UI font" },
                { id: "outfit", name: "Outfit", desc: "Clean rounded European display" },
                { id: "poppins", name: "Poppins", desc: "Friendly & balanced contemporary" },
                { id: "jetbrains-mono", name: "JetBrains Mono", desc: "Technical & Developer monospaced" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleFontChange(f.id as FontType)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-left transition-all ${
                    currentFont === f.id
                      ? "border-[var(--accent-color)] bg-[var(--accent-light)] text-[var(--text-primary)]"
                      : "border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                  }`}
                  style={{ fontFamily: f.id === "jetbrains-mono" ? "monospace" : f.name }}
                >
                  <div>
                    <span className="text-sm font-medium">{f.name}</span>
                    <span className="ml-3 text-xs opacity-75">{f.desc}</span>
                  </div>
                  {currentFont === f.id && (
                    <Check className="w-4 h-4 text-[var(--accent-color)]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Bar Layout & Position Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4 text-[var(--accent-color)]" />
                Menu Bar Position
              </label>
              <span className="text-xs text-[var(--text-secondary)]">
                Active: {currentMenuPos === "left" ? "Left Side Bar" : "Floating Bottom Bar"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Left Side Bar */}
              <button
                type="button"
                onClick={() => handleMenuPosChange("left")}
                className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  currentMenuPos === "left"
                    ? "border-[var(--accent-color)] bg-[var(--accent-light)] ring-2 ring-[var(--accent-ring)]"
                    : "border-[var(--border-color)] hover:border-[var(--text-secondary)] bg-[var(--bg-primary)]"
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                  <PanelLeft className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      1. Left Side Bar
                    </span>
                    {currentMenuPos === "left" && (
                      <Check className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 leading-tight">
                    Vertical enterprise sidebar with collapsible categories & accordion navigation.
                  </p>
                </div>
              </button>

              {/* Option 2: Floating Bottom Bar */}
              <button
                type="button"
                onClick={() => handleMenuPosChange("bottom")}
                className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  currentMenuPos === "bottom"
                    ? "border-[var(--accent-color)] bg-[var(--accent-light)] ring-2 ring-[var(--accent-ring)]"
                    : "border-[var(--border-color)] hover:border-[var(--text-secondary)] bg-[var(--bg-primary)]"
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                  <PanelBottom className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      2. Floating Bottom Bar
                    </span>
                    {currentMenuPos === "bottom" && (
                      <Check className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 leading-tight">
                    Floating dock navigation pill. On click menu, shows the floating popup submenu.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Session Standby Auto-Timeout */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Timer className="w-4 h-4 text-[var(--accent-color)]" />
                Auto Session Timeout (Standby)
              </label>
              <span className="text-xs font-mono font-bold text-[var(--accent-color)]">
                {currentTimeout}s ({Math.floor(currentTimeout / 60)}m {currentTimeout % 60}s)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              {[
                { sec: 60, label: "60s" },
                { sec: 180, label: "180s (Default)" },
                { sec: 300, label: "300s (5m)" },
                { sec: 600, label: "600s (10m)" },
                { sec: 900, label: "900s (15m)" },
              ].map((opt) => (
                <button
                  key={opt.sec}
                  type="button"
                  onClick={() => handleTimeoutChange(opt.sec)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    currentTimeout === opt.sec
                      ? "border-[var(--accent-color)] bg-[var(--accent-light)] text-[var(--accent-color)]"
                      : "border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)]">Custom (seconds):</span>
              <input
                type="number"
                min={30}
                max={3600}
                value={currentTimeout}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v)) {
                    setCurrentTimeout(v);
                    if (v >= 30 && v <= 3600) {
                      localStorage.setItem("erp_session_timeout_sec", String(v));
                      if (onSessionTimeoutChange) onSessionTimeoutChange(v);
                    }
                  }
                }}
                onBlur={() => handleTimeoutChange(currentTimeout)}
                className="w-24 px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-xs font-mono font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
              />
              <span className="text-[11px] text-[var(--text-secondary)]">
                Auto signs out after standby inactivity (min 30s).
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex justify-between items-center">
          <span className="text-xs text-[var(--text-secondary)]">
            Persisted to your browser profile
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] rounded-xl transition-all shadow-sm"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
