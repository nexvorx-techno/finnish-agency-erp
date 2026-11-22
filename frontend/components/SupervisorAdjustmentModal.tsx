"use client";

import React, { useState } from "react";
import { X, Clock, AlertCircle, CheckCircle2 } from "lucide-react";

interface SupervisorAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftData: {
    shiftId: number;
    workerName: string;
    siteName: string;
    currentHours: number;
    breakMinutes: number;
  } | null;
  onConfirm: (shiftId: number, adjustedHours: number, breakMinutes: number, reason: string) => Promise<void>;
}

export const SupervisorAdjustmentModal: React.FC<SupervisorAdjustmentModalProps> = ({
  isOpen,
  onClose,
  shiftData,
  onConfirm,
}) => {
  const [adjustedHours, setAdjustedHours] = useState<number>(shiftData?.currentHours || 8.0);
  const [breakMinutes, setBreakMinutes] = useState<number>(shiftData?.breakMinutes || 30);
  const [reason, setReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  if (!isOpen || !shiftData) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || reason.trim().length < 5) {
      setError("Mandatory audit reason must be at least 5 characters (e.g. terminal offline, forgotten badge).");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await onConfirm(shiftData.shiftId, Number(adjustedHours), Number(breakMinutes), reason.trim());
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update shift hours.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-2xl overflow-hidden transition-all duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[var(--accent-color)]" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Supervisor Shift Adjustment
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
            <div className="text-xs text-[var(--text-secondary)]">Worker & Location</div>
            <div className="text-sm font-bold text-[var(--text-primary)]">{shiftData.workerName}</div>
            <div className="text-xs text-[var(--accent-color)] mt-0.5">{shiftData.siteName}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                Regular Hours Worked
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                max="24"
                value={adjustedHours}
                onChange={(e) => setAdjustedHours(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                Unpaid Break (Minutes)
              </label>
              <input
                type="number"
                step="5"
                min="0"
                max="120"
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
              Audit Justification Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g., Worker badge forgotten at gate; supervisor personally confirmed shift commencement at 07:00."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
            />
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
              Logged immutably to client timesheet audit ledger per Finnish Työaikalaki compliance.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] rounded-xl transition-all disabled:opacity-50 shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? "Saving..." : "Save Audit Adjustment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
