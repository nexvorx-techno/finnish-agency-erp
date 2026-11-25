"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Receipt,
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  Check,
  X,
  Send,
  Loader2,
  Search,
  RefreshCw,
} from "lucide-react";

export interface InvoiceItem {
  id: number;
  invoice_number: string;
  client_id: number;
  site_id: number | null;
  site_name: string;
  billing_period_start: string;
  billing_period_end: string;
  issue_date: string;
  due_date: string;
  total_regular_hours: number;
  total_overtime_hours: number;
  subtotal_eur: number;
  alv_percentage: number;
  alv_amount_eur: number;
  total_amount_eur: number;
  currency: string;
  agency_approval_status: string;
  client_status: "PENDING_INTERNAL_APPROVAL" | "RELEASED_TO_ACCOUNTS" | "PAID_SUBMITTED" | "SETTLED" | "DISPUTED";
  current_approval_step: number;
  total_approval_steps: number;
  current_approver_id?: number | null;
  current_approver_name?: string | null;
  approval_levels?: Array<{
    level: number;
    approver_id?: number | null;
    approver_name: string;
  }>;
  approval_history: Array<{
    step: number;
    action: string;
    approver_name?: string;
    role?: string;
    timestamp: string;
    notes?: string;
  }>;
  items_breakdown?: Array<{
    role: string;
    workers: number;
    hours: number;
    rate: number;
    total: number;
  }>;
  notes?: string;
  payment_date?: string | null;
  bank_name?: string | null;
  reference_number?: string | null;
  paid_amount_eur?: number | null;
  payment_receipt_url?: string | null;
  payment_confirmed_at?: string | null;
  created_at?: string;
}

interface InvoicesSettlementModuleProps {
  clientId: number;
  currentUserId?: number;
  companyName: string;
  userName: string;
  userRole?: string;
  selectedSite?: string;
  activeSubTab: "m1.6_invoices" | "m1.6_payments" | "m1.6_credit";
  onChangeSubTab: (tab: "m1.6_invoices" | "m1.6_payments" | "m1.6_credit") => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const InvoicesSettlementModule: React.FC<InvoicesSettlementModuleProps> = ({
  clientId,
  currentUserId,
  companyName,
  userName,
  userRole = "CLIENT_ADMIN",
  selectedSite = "all",
  activeSubTab,
  onChangeSubTab,
}) => {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);

  // Payment Form Modal state (for Accounts desk)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().split("T")[0],
    bank_name: "Nordea Corporate Bank",
    reference_number: "",
    paid_amount_eur: 0,
    notes: "",
  });
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Approval Action state
  const [isApproving, setIsApproving] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"APPROVE" | "REJECT">("APPROVE");

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentUserId) params.set("user_id", String(currentUserId));
      if (selectedSite && selectedSite !== "all") params.set("site_id", selectedSite);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${API_BASE}/api/client/${clientId}/invoices${qs}`);
      if (res.ok) {
        const data = await res.json();
        const list: InvoiceItem[] = data.invoices || [];
        setInvoices(list);
        setSelectedInvoice((prev) =>
          prev ? list.find((inv) => inv.id === prev.id) || null : null
        );
      }
    } catch (err) {
      console.error("Error fetching invoices:", err);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, currentUserId, selectedSite]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    const handleJump = (ev: Event) => {
      const detail = (ev as CustomEvent<{ module?: string; referenceId?: number | null }>).detail;
      if (detail?.module === "m1.6_invoices" && detail.referenceId) {
        const found = invoices.find((inv) => inv.id === detail.referenceId);
        if (found) setSelectedInvoice(found);
      }
    };
    window.addEventListener("open-approval-target", handleJump);
    return () => window.removeEventListener("open-approval-target", handleJump);
  }, [invoices]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== "ALL" && inv.client_status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = inv.invoice_number.toLowerCase().includes(q);
        const matchRef = (inv.reference_number || "").toLowerCase().includes(q);
        const matchSite = (inv.site_name || "").toLowerCase().includes(q);
        if (!matchNum && !matchRef && !matchSite) return false;
      }
      return true;
    });
  }, [invoices, statusFilter, searchQuery]);

  // Statistics KPIs
  const stats = useMemo(() => {
    const totalInvoiced = invoices.reduce((sum, i) => sum + i.total_amount_eur, 0);
    const pendingApproval = invoices.filter((i) => i.client_status === "PENDING_INTERNAL_APPROVAL");
    const pendingApprovalAmt = pendingApproval.reduce((sum, i) => sum + i.total_amount_eur, 0);
    const inAccounts = invoices.filter((i) => i.client_status === "RELEASED_TO_ACCOUNTS");
    const inAccountsAmt = inAccounts.reduce((sum, i) => sum + i.total_amount_eur, 0);
    const settled = invoices.filter((i) => i.client_status === "SETTLED" || i.client_status === "PAID_SUBMITTED");
    const settledAmt = settled.reduce((sum, i) => sum + (i.paid_amount_eur || i.total_amount_eur), 0);

    return {
      totalInvoiced,
      pendingApprovalCount: pendingApproval.length,
      pendingApprovalAmt,
      inAccountsCount: inAccounts.length,
      inAccountsAmt,
      settledCount: settled.length,
      settledAmt,
    };
  }, [invoices]);

  // Handle Manager Internal Approval Decision (Strict Sequential Level Check)
  const [approvalError, setApprovalError] = useState("");
  const handleDecisionSubmit = async () => {
    if (!selectedInvoice) return;
    setIsApproving(true);
    setApprovalError("");
    try {
      const res = await fetch(`${API_BASE}/api/client/invoices/${selectedInvoice.id}/approval-decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: pendingAction,
          approver_user_id: currentUserId,
          approver_name: userName || "Manager",
          approver_role: userRole || "PLANT_MANAGER",
          notes: approvalNotes.trim() || undefined,
        }),
      });
      if (res.ok) {
        setIsApprovalModalOpen(false);
        setApprovalNotes("");
        await fetchInvoices();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("refresh-notifications"));
        }
      } else {
        const errBody = await res.json().catch(() => ({}));
        setApprovalError(errBody.detail || "Sequential approval locked for this level.");
      }
    } catch (err) {
      console.error("Decision submit failed:", err);
      setApprovalError("Network error while submitting invoice decision.");
    } finally {
      setIsApproving(false);
    }
  };

  // Handle Accounts Desk Payment Details Submission
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setIsSubmittingPayment(true);
    try {
      const res = await fetch(`${API_BASE}/api/client/invoices/${selectedInvoice.id}/submit-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_date: paymentForm.payment_date,
          bank_name: paymentForm.bank_name,
          reference_number: paymentForm.reference_number,
          paid_amount_eur: paymentForm.paid_amount_eur,
          notes: paymentForm.notes.trim() || undefined,
          submitted_by_name: userName || "Client Accounts Desk",
        }),
      });
      if (res.ok) {
        setIsPaymentModalOpen(false);
        await fetchInvoices();
        setSelectedInvoice((prev) =>
          prev
            ? {
                ...prev,
                client_status: "PAID_SUBMITTED",
                reference_number: paymentForm.reference_number,
                payment_date: paymentForm.payment_date,
                paid_amount_eur: paymentForm.paid_amount_eur,
              }
            : null
        );
      }
    } catch (err) {
      console.error("Payment submit failed:", err);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const getStatusBadge = (status: InvoiceItem["client_status"]) => {
    switch (status) {
      case "PENDING_INTERNAL_APPROVAL":
        return {
          label: "Awaiting Internal Approval",
          classes: "bg-amber-500/10 text-amber-600 border-amber-500/20",
          dot: "bg-amber-500",
        };
      case "RELEASED_TO_ACCOUNTS":
        return {
          label: "Approved • Ready in Accounts",
          classes: "bg-blue-500/10 text-blue-600 border-blue-500/20 font-bold",
          dot: "bg-blue-500",
        };
      case "PAID_SUBMITTED":
        return {
          label: "Payment Submitted to Agency",
          classes: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
          dot: "bg-emerald-500",
        };
      case "SETTLED":
        return {
          label: "Fully Settled & Confirmed",
          classes: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-bold",
          dot: "bg-emerald-600",
        };
      case "DISPUTED":
        return {
          label: "Disputed by Client",
          classes: "bg-rose-500/10 text-rose-600 border-rose-500/20",
          dot: "bg-rose-500",
        };
      default:
        return {
          label: status,
          classes: "bg-slate-100 text-slate-600 border-slate-200",
          dot: "bg-slate-400",
        };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                Invoices & Settlement Hub
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                Finnish ALV 25.5%
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Corporate billing for <strong className="text-[var(--text-primary)]">{companyName}</strong> &bull; Review agency billing, release internal plant approvals, and execute SEPA payment settlement
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Subtabs switcher */}
          <div className="flex items-center gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)]">
            <button
              type="button"
              onClick={() => onChangeSubTab("m1.6_invoices")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === "m1.6_invoices"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Invoices
            </button>
            <button
              type="button"
              onClick={() => onChangeSubTab("m1.6_payments")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === "m1.6_payments"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Settlement Desk
            </button>
          </div>
          <button
            type="button"
            onClick={fetchInvoices}
            className="px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh Invoices"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* 2. Enterprise Workflow Visual Flow Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/5 via-[var(--bg-card)] to-emerald-500/5 border border-[var(--border-color)]">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>Statutory 2-Sided Settlement Lifecycle</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Step 1 • Agency Side</div>
            <div className="font-bold text-[var(--text-primary)]">Invoice Issued</div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-tight">
              Agency prepares invoice from biometric timesheets + TES + ALV 25.5%
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-1">
            <div className="text-[10px] font-bold text-amber-500 uppercase">Step 2 • Client Management</div>
            <div className="font-bold text-[var(--text-primary)]">Internal Approval</div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-tight">
              Site Manager & Plant Director verify hours and release sign-off
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-1">
            <div className="text-[10px] font-bold text-blue-500 uppercase">Step 3 • Client Accounts</div>
            <div className="font-bold text-[var(--text-primary)]">Bank Wire Payment</div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-tight">
              Accounts dispatches wire with Finnish Viitenumero and submits proof
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-1">
            <div className="text-[10px] font-bold text-emerald-600 uppercase">Step 4 • Settlement</div>
            <div className="font-bold text-[var(--text-primary)]">Agency Confirmation</div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-tight">
              Agency acknowledges incoming payment and marks invoice Settled
            </p>
          </div>
        </div>
      </div>

      {/* 3. KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xs">
          <div className="text-[11px] font-medium text-[var(--text-secondary)]">Total Invoiced (Gross)</div>
          <div className="text-base sm:text-xl font-bold text-[var(--text-primary)] mt-1">
            €{stats.totalInvoiced.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] mt-1">Includes 25.5% ALV</div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-amber-500/20 shadow-2xs bg-amber-500/5">
          <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center justify-between">
            <span>Awaiting Approvals</span>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          </div>
          <div className="text-base sm:text-xl font-bold text-[var(--text-primary)] mt-1">
            €{stats.pendingApprovalAmt.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-amber-600 mt-1 font-semibold">
            {stats.pendingApprovalCount} invoice{stats.pendingApprovalCount === 1 ? "" : "s"} in review
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-blue-500/20 shadow-2xs bg-blue-500/5">
          <div className="text-[11px] font-medium text-blue-600 dark:text-blue-400 flex items-center justify-between">
            <span>Ready in Accounts</span>
            <span className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
          <div className="text-base sm:text-xl font-bold text-[var(--text-primary)] mt-1">
            €{stats.inAccountsAmt.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-blue-600 mt-1 font-semibold">
            {stats.inAccountsCount} pending bank wire
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-emerald-500/20 shadow-2xs bg-emerald-500/5">
          <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
            <span>Settled & Paid</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-base sm:text-xl font-bold text-[var(--text-primary)] mt-1">
            €{stats.settledAmt.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-600 mt-1 font-semibold">
            {stats.settledCount} invoice{stats.settledCount === 1 ? "" : "s"} settled
          </div>
        </div>
      </div>

      {/* 4. Controls: Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
          {[
            { id: "ALL", label: "All Invoices" },
            { id: "PENDING_INTERNAL_APPROVAL", label: "Needs Approval" },
            { id: "RELEASED_TO_ACCOUNTS", label: "Ready to Pay (Accounts)" },
            { id: "PAID_SUBMITTED", label: "Payment Submitted" },
            { id: "SETTLED", label: "Settled" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-[var(--accent-color)] text-white shadow-xs"
                  : "bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice or viitenumero..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
          />
        </div>
      </div>

      {/* 5. Invoices Table & Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Invoices List Table */}
        <div className={`${selectedInvoice ? "lg:col-span-7" : "lg:col-span-12"} transition-all duration-200`}>
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg-secondary)]/70 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                  <tr>
                    <th className="py-3 px-4">Invoice / Period</th>
                    <th className="py-3 px-3">Hours</th>
                    <th className="py-3 px-3">Subtotal</th>
                    <th className="py-3 px-3">Total (ALV 25.5%)</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[var(--text-secondary)]">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                        Loading invoices...
                      </td>
                    </tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[var(--text-secondary)]">
                        No invoices found for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const badge = getStatusBadge(inv.client_status);
                      const isSelected = selectedInvoice?.id === inv.id;
                      return (
                        <tr
                          key={inv.id}
                          onClick={() => setSelectedInvoice(inv)}
                          className={`hover:bg-[var(--bg-secondary)]/50 transition-colors cursor-pointer ${
                            isSelected ? "bg-blue-500/5 ring-1 ring-blue-500/30" : ""
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                              <span>{inv.invoice_number}</span>
                            </div>
                            <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                              {inv.billing_period_start} → {inv.billing_period_end}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-[var(--text-primary)]">
                              {inv.total_regular_hours} h
                            </div>
                            {inv.total_overtime_hours > 0 && (
                              <div className="text-[10px] text-amber-600">
                                +{inv.total_overtime_hours}h OT
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-[var(--text-secondary)] font-medium">
                            €{inv.subtotal_eur.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-[var(--text-primary)]">
                              €{inv.total_amount_eur.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-[9px] text-[var(--text-secondary)]">
                              ALV €{inv.alv_amount_eur.toFixed(2)}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${badge.classes}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedInvoice(inv);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] text-[11px] font-semibold text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Selected Invoice Details & Interactive Action Drawer */}
        {selectedInvoice && (
          <div className="lg:col-span-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-5 shadow-lg flex flex-col space-y-4 animate-in fade-in slide-in-from-right-3 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[var(--border-color)] pb-3">
              <div>
                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                  Payment Request Overview
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)] mt-0.5">
                  {selectedInvoice.invoice_number}
                </h3>
                <div className="text-xs text-[var(--text-secondary)]">
                  Issued: {selectedInvoice.issue_date} • Due: {selectedInvoice.due_date}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Financial Summary with ALV 25.5% */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)]/60 border border-[var(--border-color)] space-y-2">
              <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                <span>Net Total (Excl. Tax)</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  €{selectedInvoice.subtotal_eur.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                <span>Finnish VAT (ALV 25.5%)</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  €{selectedInvoice.alv_amount_eur.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="pt-2 border-t border-[var(--border-color)] flex justify-between text-sm font-bold text-[var(--text-primary)]">
                <span>Invoice Total (Gross)</span>
                <span className="text-blue-600 dark:text-blue-400">
                  €{selectedInvoice.total_amount_eur.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Itemized Hours Breakdown */}
            {selectedInvoice.items_breakdown && selectedInvoice.items_breakdown.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Timesheet Line Items
                </div>
                <div className="space-y-1">
                  {selectedInvoice.items_breakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-[var(--bg-secondary)]/40 border border-[var(--border-color)] flex justify-between items-center text-xs"
                    >
                      <div>
                        <div className="font-semibold text-[var(--text-primary)]">{item.role}</div>
                        <div className="text-[10px] text-[var(--text-secondary)]">
                          {item.workers} workers • {item.hours} hrs @ €{item.rate.toFixed(2)}/h
                        </div>
                      </div>
                      <div className="font-bold text-[var(--text-primary)]">€{item.total.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approval Audit Trail */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center justify-between">
                <span>Audit & Approval Trail</span>
                <span className="text-[9px] font-normal lowercase">statutory verification</span>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                {selectedInvoice.approval_history.map((h, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-[var(--bg-secondary)]/40 border border-[var(--border-color)] text-[11px] space-y-0.5"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-[var(--text-primary)]">
                        {h.approver_name || "System"} ({h.role || "Approver"})
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          h.action === "APPROVED" || h.action === "SETTLED"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : h.action === "PAYMENT_SUBMITTED"
                            ? "bg-blue-500/10 text-blue-600"
                            : h.action === "DISPUTED"
                            ? "bg-rose-500/10 text-rose-600"
                            : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {h.action}
                      </span>
                    </div>
                    {h.notes && <p className="text-[10px] text-[var(--text-secondary)]">{h.notes}</p>}
                    <div className="text-[9px] text-[var(--text-secondary)] opacity-70">
                      {new Date(h.timestamp).toLocaleString("fi-FI")}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Details Box (If Paid/Settled) */}
            {selectedInvoice.reference_number && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                <div className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Finnish Banking Settlement Details</span>
                </div>
                <div className="text-[11px] text-[var(--text-primary)]">
                  <span className="font-semibold">Viitenumero (Ref):</span>{" "}
                  <span className="font-mono font-bold">{selectedInvoice.reference_number}</span>
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  Bank: {selectedInvoice.bank_name || "Nordea"} • Paid on: {selectedInvoice.payment_date}
                </div>
                {selectedInvoice.paid_amount_eur && (
                  <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    Settled Amount: €{selectedInvoice.paid_amount_eur.toFixed(2)}
                  </div>
                )}
              </div>
            )}

            {/* ACTION FOOTER BASED ON ROLE & WORKFLOW STATE */}
            <div className="pt-3 border-t border-[var(--border-color)] flex flex-wrap gap-2">
              {/* Scenario 1: Awaiting Client Internal Approval (Strict Sequential Level Lock) */}
              {selectedInvoice.client_status === "PENDING_INTERNAL_APPROVAL" && (() => {
                const designatedId = selectedInvoice.current_approver_id;
                const designatedName =
                  selectedInvoice.current_approver_name ||
                  `Level ${selectedInvoice.current_approval_step} Approver`;
                const canApprove =
                  designatedId != null ? Number(currentUserId) === Number(designatedId) : true;
                return canApprove ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setApprovalError("");
                        setPendingAction("APPROVE");
                        setIsApprovalModalOpen(true);
                      }}
                      className="flex-1 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {selectedInvoice.current_approval_step >= selectedInvoice.total_approval_steps
                          ? "Approve & Release"
                          : `Approve Level ${selectedInvoice.current_approval_step}`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setApprovalError("");
                        setPendingAction("REJECT");
                        setIsApprovalModalOpen(true);
                      }}
                      className="px-3 py-2 rounded-xl border border-rose-500/30 text-rose-600 hover:bg-rose-500/10 text-xs font-semibold transition-all cursor-pointer"
                    >
                      Dispute
                    </button>
                  </>
                ) : (
                  <div className="w-full p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold text-center">
                    Locked — Awaiting Level {selectedInvoice.current_approval_step} ({designatedName})
                  </div>
                );
              })()}

              {/* Scenario 2: Released to Accounts -> Ready for Bank Payment */}
              {selectedInvoice.client_status === "RELEASED_TO_ACCOUNTS" && (
                <button
                  type="button"
                  onClick={() => {
                    setPaymentForm({
                      payment_date: new Date().toISOString().split("T")[0],
                      bank_name: "Nordea Corporate Bank",
                      reference_number: `2849${selectedInvoice.id}91823`,
                      paid_amount_eur: selectedInvoice.total_amount_eur,
                      notes: "",
                    });
                    setIsPaymentModalOpen(true);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Update & Submit Payment Details</span>
                </button>
              )}

              {/* Scenario 3: Paid Submitted / Settled */}
              {(selectedInvoice.client_status === "PAID_SUBMITTED" ||
                selectedInvoice.client_status === "SETTLED") && (
                <div className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-[var(--border-color)] text-center text-xs text-[var(--text-secondary)]">
                  Payment confirmation transmitted to Agency Portal.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 6. MODAL: CLIENT INTERNAL APPROVAL DECISION */}
      {isApprovalModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  {pendingAction === "APPROVE" ? "Confirm Internal Sign-Off" : "Dispute Invoice"}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  {selectedInvoice.invoice_number} (Step {selectedInvoice.current_approval_step} of{" "}
                  {selectedInvoice.total_approval_steps})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsApprovalModalOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {pendingAction === "APPROVE"
                ? `You are confirming hours and TES surcharges for ${selectedInvoice.invoice_number}. Once all internal levels approve, the invoice automatically releases to the Client Accounts desk for payment execution.`
                : "Specify the reason for disputing this billing invoice with the agency (e.g. incorrect hours, wrong shift premium, worker absence)."}
            </p>

            <div>
              <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                Approval Notes / Audit Remark
              </label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="e.g. Production line punches verified against shift rosters."
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
              />
            </div>

            {approvalError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 text-xs font-semibold">
                {approvalError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => setIsApprovalModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isApproving}
                onClick={handleDecisionSubmit}
                className={`px-4 py-1.5 rounded-lg text-white text-xs font-bold cursor-pointer disabled:opacity-60 ${
                  pendingAction === "APPROVE" ? "bg-blue-600 hover:bg-blue-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {isApproving ? "Recording..." : pendingAction === "APPROVE" ? "Confirm & Advance" : "Submit Dispute"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: CLIENT ACCOUNTS DESK PAYMENT SUBMISSION */}
      {isPaymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Submit Bank Payment Details
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Transmits bank settlement receipt to Agency Portal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-4 space-y-3.5">
              <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-between text-xs">
                <div>
                  <div className="text-[10px] text-[var(--text-secondary)] uppercase">Invoice Number</div>
                  <div className="font-bold text-[var(--text-primary)]">{selectedInvoice.invoice_number}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[var(--text-secondary)] uppercase">Gross Total with ALV 25.5%</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    €{selectedInvoice.total_amount_eur.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Payment Execution Date *
                  </label>
                  <input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, payment_date: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Corporate Bank Name *
                  </label>
                  <select
                    value={paymentForm.bank_name}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, bank_name: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                    required
                  >
                    <option value="Nordea Corporate Bank">Nordea Corporate Bank</option>
                    <option value="OP Osuuspankki">OP Osuuspankki</option>
                    <option value="Danske Bank Finland">Danske Bank Finland</option>
                    <option value="Handelsbanken">Handelsbanken</option>
                    <option value="S-Pankki">S-Pankki</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Finnish Viitenumero (Bank Ref) *
                  </label>
                  <input
                    type="text"
                    value={paymentForm.reference_number}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, reference_number: e.target.value }))}
                    placeholder="e.g. 284910248102941"
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-mono font-bold text-[var(--text-primary)]"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Paid Amount (EUR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentForm.paid_amount_eur}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, paid_amount_eur: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-primary)]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Accounts Remark (Optional)
                </label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. SEPA corporate wire dispatched; statement ref #9412"
                  className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60 flex items-center gap-1.5 shadow-sm"
                >
                  {isSubmittingPayment ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Payment to Agency</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
