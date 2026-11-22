"use client";

import React, { useState, useRef, useEffect } from "react";
import { KeyRound, Check, X, ShieldCheck } from "lucide-react";

interface PinSetupModalProps {
  isOpen: boolean;
  userName: string;
  onPinSaved: (pin: string, length: 4 | 6) => void;
  onSkip: () => void;
}

export const PinSetupModal: React.FC<PinSetupModalProps> = ({
  isOpen,
  userName,
  onPinSaved,
  onSkip,
}) => {
  const [pinLength, setPinLength] = useState<4 | 6>(4);
  const [pin, setPin] = useState<string>("");
  const [confirmPin, setConfirmPin] = useState<string>("");
  const [error, setError] = useState<string>("");

  const pinInputRef = useRef<HTMLInputElement>(null);
  const confirmInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => pinInputRef.current?.focus(), 60);
    }
  }, [isOpen, pinLength]);

  if (!isOpen) return null;

  const handlePinChange = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, pinLength);
    setPin(clean);
    setError("");
    if (clean.length === pinLength) {
      confirmInputRef.current?.focus();
    }
  };

  const handleConfirmChange = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, pinLength);
    setConfirmPin(clean);
    setError("");
    if (clean.length === pinLength) {
      if (pin.length === pinLength && clean === pin) {
        setTimeout(() => {
          onPinSaved(clean, pinLength);
        }, 150);
      } else if (pin.length === pinLength) {
        setError("PINs do not match. Please re-enter.");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== pinLength) {
      setError(`Please enter a full ${pinLength}-digit PIN.`);
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match. Please re-enter.");
      return;
    }
    onPinSaved(pin, pinLength);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn select-none">
      <div className="w-full max-w-md bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)] shadow-2xl overflow-hidden transition-all duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[var(--accent-color)]" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Set Up Quick Security PIN
            </h2>
          </div>
          <button
            onClick={onSkip}
            title="Skip PIN Setup"
            className="p-1 rounded-lg hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="text-center">
            <p className="text-xs text-[var(--text-secondary)]">
              Welcome, <strong className="text-[var(--text-primary)]">{userName}</strong>! Set up a rapid access PIN so you can log in directly next time without entering your full password.
            </p>
          </div>

          {/* PIN Length Selector */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-primary)] mb-2 text-center">
              Select PIN Length
            </label>
            <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
              <button
                type="button"
                onClick={() => {
                  setPinLength(4);
                  setPin("");
                  setConfirmPin("");
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  pinLength === 4
                    ? "border-[var(--accent-color)] bg-[var(--accent-light)] text-[var(--accent-color)] ring-2 ring-[var(--accent-ring)]"
                    : "border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                }`}
              >
                4 Digits (Standard)
              </button>

              <button
                type="button"
                onClick={() => {
                  setPinLength(6);
                  setPin("");
                  setConfirmPin("");
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  pinLength === 6
                    ? "border-[var(--accent-color)] bg-[var(--accent-light)] text-[var(--accent-color)] ring-2 ring-[var(--accent-ring)]"
                    : "border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                }`}
              >
                6 Digits (High Security)
              </button>
            </div>
          </div>

          {/* Enter PIN Inputs */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1 text-center">
                Enter {pinLength}-Digit PIN
              </label>
              <input
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={pinLength}
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                placeholder={"•".repeat(pinLength)}
                className="w-44 mx-auto block text-center tracking-[0.5em] text-lg font-mono font-bold py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1 text-center">
                Confirm PIN
              </label>
              <input
                ref={confirmInputRef}
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={pinLength}
                value={confirmPin}
                onChange={(e) => handleConfirmChange(e.target.value)}
                placeholder={"•".repeat(pinLength)}
                className="w-44 mx-auto block text-center tracking-[0.5em] text-lg font-mono font-bold py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
              />
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 text-center font-medium">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Save PIN & Enter Portal</span>
            </button>

            <button
              type="button"
              onClick={onSkip}
              className="w-full py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all text-center"
            >
              Skip PIN setup (Use password only)
            </button>
          </div>
        </form>

        <div className="px-6 py-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] text-center text-[10px] text-[var(--text-secondary)] flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Encrypted and saved to this browser session</span>
        </div>
      </div>
    </div>
  );
};
