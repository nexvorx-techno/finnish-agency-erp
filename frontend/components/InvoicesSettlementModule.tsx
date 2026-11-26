"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Receipt,
  CreditCard,
  CheckCircle2,
  Check,
  X,
  Send,
  Loader2,
  Search,
  RefreshCw,
  FileText,
  Printer,
  PlusCircle,
  Coins,
  FileSpreadsheet,
  CheckCheck,
  Download,
  ShieldCheck,
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

export interface CreditNoteItem {
  id: number;
  credit_note_number: string;
  invoice_id?: number | null;
  invoice_number?: string;
  client_id: number;
  site_id?: number | null;
  site_name: string;
  issue_date: string;
  reason: string;
  subtotal_eur: number;
  alv_percentage: number;
  alv_amount_eur: number;
  total_amount_eur: number;
  status: string;
  notes?: string;
  created_at: string;
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
  // State: Invoices & Credit Notes
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNoteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCN, setIsLoadingCN] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);

  // Finnish Lasku PDF / Print Modal
  const [laskuInvoice, setLaskuInvoice] = useState<InvoiceItem | null>(null);

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
  const [approvalError, setApprovalError] = useState("");

  // Create Credit Note Modal
  const [isCreditNoteModalOpen, setIsCreditNoteModalOpen] = useState(false);
  const [cnForm, setCnForm] = useState({
    invoice_id: 0,
    reason: "",
    subtotal_eur: 0,
    notes: "",
  });
  const [isSubmittingCN, setIsSubmittingCN] = useState(false);

  // Settlement confirmation feedback
  const [settlingInvoiceId, setSettlingInvoiceId] = useState<number | null>(null);

  // Receive Invoice from Agency Portal (Simulation / Live Trigger)
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveForm, setReceiveForm] = useState({
    site_id: 1,
    billing_period_start: new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0],
    billing_period_end: new Date().toISOString().split("T")[0],
    total_regular_hours: 160.0,
    total_overtime_hours: 8.0,
    hourly_rate: 27.0,
    role: "Certified Production Operative",
    notes: "",
  });
  const [isReceivingInvoice, setIsReceivingInvoice] = useState(false);

  // Fetch Invoices
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

  // Fetch Credit Notes
  const fetchCreditNotes = useCallback(async () => {
    setIsLoadingCN(true);
    try {
      const params = new URLSearchParams();
      if (currentUserId) params.set("user_id", String(currentUserId));
      if (selectedSite && selectedSite !== "all") params.set("site_id", selectedSite);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${API_BASE}/api/client/${clientId}/credit-notes${qs}`);
      if (res.ok) {
        const data = await res.json();
        setCreditNotes(data.credit_notes || []);
      }
    } catch (err) {
      console.error("Error fetching credit notes:", err);
    } finally {
      setIsLoadingCN(false);
    }
  }, [clientId, currentUserId, selectedSite]);

  useEffect(() => {
    fetchInvoices();
    fetchCreditNotes();
  }, [fetchInvoices, fetchCreditNotes]);

  // Handle jump event from notifications
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

  // Filtered invoices for Invoices tab
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

  // Filtered lists for Settlement Desk
  const pendingDisbursementInvoices = useMemo(() => {
    return invoices.filter((i) => i.client_status === "RELEASED_TO_ACCOUNTS");
  }, [invoices]);

  const awaitingReconciliationInvoices = useMemo(() => {
    return invoices.filter((i) => i.client_status === "PAID_SUBMITTED");
  }, [invoices]);

  const fullySettledInvoices = useMemo(() => {
    return invoices.filter((i) => i.client_status === "SETTLED");
  }, [invoices]);

  // Overall Statistics KPIs
  const stats = useMemo(() => {
    const totalInvoiced = invoices.reduce((sum, i) => sum + i.total_amount_eur, 0);
    const pendingApproval = invoices.filter((i) => i.client_status === "PENDING_INTERNAL_APPROVAL");
    const pendingApprovalAmt = pendingApproval.reduce((sum, i) => sum + i.total_amount_eur, 0);
    const inAccounts = invoices.filter((i) => i.client_status === "RELEASED_TO_ACCOUNTS");
    const inAccountsAmt = inAccounts.reduce((sum, i) => sum + i.total_amount_eur, 0);
    const inReconciliation = invoices.filter((i) => i.client_status === "PAID_SUBMITTED");
    const inReconciliationAmt = inReconciliation.reduce((sum, i) => sum + (i.paid_amount_eur || i.total_amount_eur), 0);
    const settled = invoices.filter((i) => i.client_status === "SETTLED");
    const settledAmt = settled.reduce((sum, i) => sum + (i.paid_amount_eur || i.total_amount_eur), 0);
    const totalCreditNotesAmt = creditNotes.reduce((sum, cn) => sum + cn.total_amount_eur, 0);
    const totalAlvAmt = invoices.reduce((sum, i) => sum + i.alv_amount_eur, 0);

    return {
      totalInvoiced,
      pendingApprovalCount: pendingApproval.length,
      pendingApprovalAmt,
      inAccountsCount: inAccounts.length,
      inAccountsAmt,
      inReconciliationCount: inReconciliation.length,
      inReconciliationAmt,
      settledCount: settled.length,
      settledAmt,
      totalCreditNotesAmt,
      totalAlvAmt,
      netPayable: totalInvoiced - totalCreditNotesAmt,
    };
  }, [invoices, creditNotes]);

  // Handle Internal Sequential Approval Decision
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
      }
    } catch (err) {
      console.error("Payment submit failed:", err);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Handle Agency Bank Reconciliation & Settlement Trigger
  const handleAgencyConfirmSettlement = async (invoiceId: number) => {
    setSettlingInvoiceId(invoiceId);
    try {
      const res = await fetch(`${API_BASE}/api/client/invoices/${invoiceId}/agency-confirm`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchInvoices();
      }
    } catch (err) {
      console.error("Agency confirm error:", err);
    } finally {
      setSettlingInvoiceId(null);
    }
  };

  // Handle Create Credit Note
  const handleCreateCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cnForm.subtotal_eur <= 0 || !cnForm.reason.trim()) return;
    setIsSubmittingCN(true);
    try {
      const res = await fetch(`${API_BASE}/api/client/${clientId}/credit-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: cnForm.invoice_id > 0 ? cnForm.invoice_id : null,
          reason: cnForm.reason,
          subtotal_eur: cnForm.subtotal_eur,
          notes: cnForm.notes,
        }),
      });
      if (res.ok) {
        setIsCreditNoteModalOpen(false);
        setCnForm({ invoice_id: 0, reason: "", subtotal_eur: 0, notes: "" });
        await fetchCreditNotes();
      }
    } catch (err) {
      console.error("Failed to create credit note:", err);
    } finally {
      setIsSubmittingCN(false);
    }
  };

  // Export SEPA / CSV Batch
  const handleExportSepaBatch = () => {
    const rows = pendingDisbursementInvoices.map((inv) => ({
      Invoice: inv.invoice_number,
      Site: inv.site_name,
      Viitenumero: inv.reference_number || `2849${inv.id}91823`,
      IBAN: "FI42 1234 5678 9012 34",
      BIC: "NDEADBH",
      Beneficiary: "Suomen Henkilöstöpalvelu Oy",
      Amount_EUR: inv.total_amount_eur.toFixed(2),
      DueDate: inv.due_date,
    }));

    if (rows.length === 0) {
      alert("No pending invoices in Accounts ready for disbursement.");
      return;
    }

    const headers = Object.keys(rows[0]).join(",");
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows.map((r) => Object.values(r).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SEPA_Nordic_Payroll_Batch_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Receiving / Simulating Agency Invoice Transmission
  const handleReceiveFromAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsReceivingInvoice(true);
    try {
      const regTotal = receiveForm.total_regular_hours * receiveForm.hourly_rate;
      const otTotal = receiveForm.total_overtime_hours * (receiveForm.hourly_rate * 1.5);
      const subtotal = Math.round((regTotal + otTotal) * 100) / 100;

      const res = await fetch(`${API_BASE}/api/client/${clientId}/invoices/receive-from-agency`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: Number(receiveForm.site_id) || undefined,
          billing_period_start: receiveForm.billing_period_start,
          billing_period_end: receiveForm.billing_period_end,
          total_regular_hours: receiveForm.total_regular_hours,
          total_overtime_hours: receiveForm.total_overtime_hours,
          subtotal_eur: subtotal,
          alv_percentage: 25.5,
          items_breakdown: [
            {
              role: receiveForm.role,
              workers: 2,
              hours: receiveForm.total_regular_hours,
              rate: receiveForm.hourly_rate,
              total: regTotal,
            },
            ...(receiveForm.total_overtime_hours > 0
              ? [
                  {
                    role: "Approved TES 50% Overtime Premium",
                    workers: 2,
                    hours: receiveForm.total_overtime_hours,
                    rate: receiveForm.hourly_rate * 1.5,
                    total: otTotal,
                  },
                ]
              : []),
          ],
          notes: receiveForm.notes || undefined,
        }),
      });
      if (res.ok) {
        setIsReceiveModalOpen(false);
        await fetchInvoices();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("refresh-notifications"));
        }
      }
    } catch (err) {
      console.error("Receive invoice error:", err);
    } finally {
      setIsReceivingInvoice(false);
    }
  };

  const getStatusBadge = (status: InvoiceItem["client_status"]) => {
    switch (status) {
      case "PENDING_INTERNAL_APPROVAL":
        return {
          label: "Awaiting Internal Approval",
          classes: "bg-amber-500/10 text-amber-600 border-amber-500/25",
          dot: "bg-amber-500",
        };
      case "RELEASED_TO_ACCOUNTS":
        return {
          label: "Approved • Ready in Accounts",
          classes: "bg-blue-500/10 text-blue-600 border-blue-500/25 font-bold",
          dot: "bg-blue-500",
        };
      case "PAID_SUBMITTED":
        return {
          label: "Wire Dispatched • Awaiting Agency Reconciliation",
          classes: "bg-purple-500/10 text-purple-600 border-purple-500/25 font-semibold",
          dot: "bg-purple-500",
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
          classes: "bg-rose-500/10 text-rose-600 border-rose-500/25",
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
      {/* 1. Header Banner & Subtab Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                Agency Invoices & Settlement Hub
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                Finnish ALV 25.5%
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Incoming staffing invoices received from <strong className="text-[var(--text-primary)]">Suomen Henkilöstöpalvelu Oy (Agency Portal)</strong> for <strong className="text-[var(--text-primary)]">{companyName}</strong> &bull; Verification, internal sign-off & Accounts SEPA wire payment
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Subtabs switcher */}
          <div className="flex items-center gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)]">
            <button
              type="button"
              onClick={() => onChangeSubTab("m1.6_invoices")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === "m1.6_invoices"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Received Invoices</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-500/10 text-blue-600 font-bold">
                {invoices.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onChangeSubTab("m1.6_payments")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === "m1.6_payments"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Payment & Settlement Desk</span>
              {stats.inAccountsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/15 text-emerald-600 font-bold">
                  {stats.inAccountsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onChangeSubTab("m1.6_credit")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === "m1.6_credit"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Agency Credit Notes</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/10 text-purple-600 font-bold">
                {creditNotes.length}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsReceiveModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            title="Receive / Transmit a new staffing invoice from Agency Portal"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Receive Agency Invoice</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchInvoices();
              fetchCreditNotes();
            }}
            className="px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh Invoices & Balances"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isLoadingCN ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* 2. Executive KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xs">
          <div className="text-[11px] font-medium text-[var(--text-secondary)]">Total Invoiced (Gross)</div>
          <div className="text-base sm:text-xl font-bold text-[var(--text-primary)] mt-1">
            €{stats.totalInvoiced.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] mt-1">Includes €{stats.totalAlvAmt.toFixed(2)} ALV (25.5%)</div>
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
            <span>Settled & Reconciled</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-base sm:text-xl font-bold text-[var(--text-primary)] mt-1">
            €{stats.settledAmt.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-600 mt-1 font-semibold">
            {stats.settledCount} invoice{stats.settledCount === 1 ? "" : "s"} reconciled
          </div>
        </div>
      </div>

      {/* 3. Statutory 2-Sided Lifecycle Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/5 via-[var(--bg-card)] to-emerald-500/5 border border-[var(--border-color)]">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2.5 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span className="text-[var(--text-primary)]">2-Sided Agency Billing & Settlement Lifecycle</span>
          </div>
          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
            Agency Transmitter: Suomen Henkilöstöpalvelu Oy (Y-2839102-4)
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
              <span>Stage 1 &bull; Agency Portal</span>
              <span className="text-[9px] text-blue-600 font-bold">Transmitter</span>
            </div>
            <div className="font-bold text-[var(--text-primary)]">Issued by Agency</div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-tight">
              Agency compiles verified biometric timesheets + TES collective rates + ALV 25.5% and transmits to Client.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-amber-500/20 bg-amber-500/5 space-y-1">
            <div className="text-[10px] font-bold text-amber-600 uppercase flex items-center justify-between">
              <span>Stage 2 &bull; Client Portal</span>
              <span className="text-[9px] text-amber-600 font-bold">Verification</span>
            </div>
            <div className="font-bold text-[var(--text-primary)]">Internal Approval Sign-Off</div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-tight">
              Site Manager verifies machine punches & rosters; Client Admin authorizes release to Accounts.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-blue-500/20 bg-blue-500/5 space-y-1">
            <div className="text-[10px] font-bold text-blue-600 uppercase flex items-center justify-between">
              <span>Stage 3 &bull; Client Accounts</span>
              <span className="text-[9px] text-blue-600 font-bold">Disbursement</span>
            </div>
            <div className="font-bold text-[var(--text-primary)]">SEPA Wire Payment</div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-tight">
              Accounts executes bank transfer using Agency&apos;s Finnish Viitenumero and transmits wire confirmation.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-emerald-500/20 bg-emerald-500/5 space-y-1">
            <div className="text-[10px] font-bold text-emerald-600 uppercase flex items-center justify-between">
              <span>Stage 4 &bull; Agency Portal</span>
              <span className="text-[9px] text-emerald-600 font-bold">Reconciliation</span>
            </div>
            <div className="font-bold text-[var(--text-primary)]">Agency Settlement</div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-tight">
              Agency bank statement clears payment and marks the billing invoice fully settled & archived.
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* VIEW 1: INVOICES & STATUTORY ALV 25.5% (m1.6_invoices)        */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === "m1.6_invoices" && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Controls: Search & Status Filters */}
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

          {/* Invoices Table & Detail Drawer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Invoices List Table */}
            <div className={`${selectedInvoice ? "lg:col-span-7" : "lg:col-span-12"} transition-all duration-200`}>
              <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--bg-secondary)]/70 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                      <tr>
                        <th className="py-3 px-4">Invoice / Billing Period</th>
                        <th className="py-3 px-3">Site</th>
                        <th className="py-3 px-3">Hours</th>
                        <th className="py-3 px-3">Net Subtotal</th>
                        <th className="py-3 px-3">Gross (ALV 25.5%)</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]">
                      {isLoading ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-[var(--text-secondary)]">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                            Loading statutory invoices...
                          </td>
                        </tr>
                      ) : filteredInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-[var(--text-secondary)]">
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
                              <td className="py-3 px-3 text-[var(--text-secondary)] font-medium">
                                {inv.site_name}
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
                                <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => setLaskuInvoice(inv)}
                                    title="View Printable Finnish Lasku"
                                    className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-blue-600 transition-colors cursor-pointer"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedInvoice(inv)}
                                    className="px-2.5 py-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] text-[11px] font-semibold text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
                                  >
                                    Review
                                  </button>
                                </div>
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
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setLaskuInvoice(selectedInvoice)}
                      title="View Official Finnish Lasku"
                      className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedInvoice(null)}
                      className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
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

                {/* Audit & Approval Trail */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center justify-between">
                    <span>Audit & Approval Trail</span>
                    <span className="text-[9px] font-normal lowercase">statutory verification</span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
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

                {/* ACTION FOOTER */}
                <div className="pt-3 border-t border-[var(--border-color)] flex flex-wrap gap-2">
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
                              ? "Approve & Release to Accounts"
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

                  {selectedInvoice.client_status === "RELEASED_TO_ACCOUNTS" && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentForm({
                          payment_date: new Date().toISOString().split("T")[0],
                          bank_name: "Nordea Corporate Bank",
                          reference_number: selectedInvoice.reference_number || `2849${selectedInvoice.id}91823`,
                          paid_amount_eur: selectedInvoice.total_amount_eur,
                          notes: "",
                        });
                        setIsPaymentModalOpen(true);
                      }}
                      className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Execute Bank Wire Disbursement</span>
                    </button>
                  )}

                  {selectedInvoice.client_status === "PAID_SUBMITTED" && (
                    <div className="w-full space-y-2">
                      <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-700 dark:text-purple-300 text-xs font-semibold text-center">
                        Payment wire dispatched &bull; Awaiting bank settlement reconciliation
                      </div>
                      <button
                        type="button"
                        disabled={settlingInvoiceId === selectedInvoice.id}
                        onClick={() => handleAgencyConfirmSettlement(selectedInvoice.id)}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <CheckCheck className="w-4 h-4" />
                        <span>Reconcile & Settle Now (Agency Confirm)</span>
                      </button>
                    </div>
                  )}

                  {selectedInvoice.client_status === "SETTLED" && (
                    <div className="w-full p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-center text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Settled & Reconciled with Agency</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 2: SETTLEMENT DESK & PAYMENT RECONCILIATION              */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === "m1.6_payments" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Settlement Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-[var(--bg-card)] to-blue-500/10 border border-[var(--border-color)]">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>Treasury Disbursement & Settlement Ledger</span>
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Execute approved SEPA wire payments, generate ISO 11649 Finnish Viitenumero references, and reconcile bank transfers.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportSepaBatch}
                className="px-3.5 py-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export SEPA Batch ({pendingDisbursementInvoices.length})</span>
              </button>
            </div>
          </div>

          {/* Section 1: Ready for Payment Disbursement (Approved by Plant) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  1. Ready for Bank Disbursement ({pendingDisbursementInvoices.length})
                </h3>
              </div>
              <span className="text-xs text-[var(--text-secondary)]">
                Total Payable: €{stats.inAccountsAmt.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg-secondary)]/70 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-3">Site</th>
                    <th className="py-3 px-3">Due Date</th>
                    <th className="py-3 px-3">Gross Amount (ALV 25.5%)</th>
                    <th className="py-3 px-3">Finnish Viitenumero</th>
                    <th className="py-3 px-3 text-right">Disburse Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {pendingDisbursementInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-secondary)]">
                        No invoices currently awaiting Accounts bank disbursement. All released invoices are processed.
                      </td>
                    </tr>
                  ) : (
                    pendingDisbursementInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-[var(--bg-secondary)]/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-[var(--text-primary)]">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3 px-3 text-[var(--text-secondary)]">{inv.site_name}</td>
                        <td className="py-3 px-3 text-[var(--text-secondary)]">{inv.due_date}</td>
                        <td className="py-3 px-3 font-bold text-blue-600 dark:text-blue-400">
                          €{inv.total_amount_eur.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-[var(--text-primary)]">
                          {inv.reference_number || `2849${inv.id}91823`}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setPaymentForm({
                                payment_date: new Date().toISOString().split("T")[0],
                                bank_name: "Nordea Corporate Bank",
                                reference_number: inv.reference_number || `2849${inv.id}91823`,
                                paid_amount_eur: inv.total_amount_eur,
                                notes: "",
                              });
                              setIsPaymentModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ml-auto cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>Dispatch Wire</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Payments Dispatched & Awaiting Reconciliation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  2. Dispatched Payments & Reconciliation Queue ({awaitingReconciliationInvoices.length})
                </h3>
              </div>
              <span className="text-xs text-[var(--text-secondary)]">
                In Clearing: €{stats.inReconciliationAmt.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg-secondary)]/70 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-3">Wire Executed</th>
                    <th className="py-3 px-3">Bank & Reference</th>
                    <th className="py-3 px-3">Settled Amount</th>
                    <th className="py-3 px-3">Reconciliation Status</th>
                    <th className="py-3 px-3 text-right">Confirm Settlement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {awaitingReconciliationInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-secondary)]">
                        No payments currently in the clearing queue.
                      </td>
                    </tr>
                  ) : (
                    awaitingReconciliationInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-[var(--bg-secondary)]/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-[var(--text-primary)]">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3 px-3 text-[var(--text-secondary)]">{inv.payment_date || "Today"}</td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-[var(--text-primary)]">{inv.bank_name || "Nordea"}</div>
                          <div className="text-[10px] font-mono text-[var(--text-secondary)]">{inv.reference_number}</div>
                        </td>
                        <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                          €{(inv.paid_amount_eur || inv.total_amount_eur).toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-purple-500/10 text-purple-600 font-bold border border-purple-500/20">
                            Bank Wire Sent • Awaiting Confirmation
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            disabled={settlingInvoiceId === inv.id}
                            onClick={() => handleAgencyConfirmSettlement(inv.id)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ml-auto cursor-pointer disabled:opacity-60"
                          >
                            {settlingInvoiceId === inv.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>Reconcile & Settle</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Reconciled & Fully Settled Ledger */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  3. Reconciled & Settled Invoices ({fullySettledInvoices.length})
                </h3>
              </div>
              <span className="text-xs text-emerald-600 font-bold">
                Total Settled: €{stats.settledAmt.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg-secondary)]/70 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-3">Site</th>
                    <th className="py-3 px-3">Paid Date</th>
                    <th className="py-3 px-3">Bank Viitenumero</th>
                    <th className="py-3 px-3">Gross Total Settled</th>
                    <th className="py-3 px-3 text-right">Statutory Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {fullySettledInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[var(--bg-secondary)]/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-[var(--text-primary)]">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3 px-3 text-[var(--text-secondary)]">{inv.site_name}</td>
                      <td className="py-3 px-3 text-[var(--text-secondary)]">{inv.payment_date || "Settled"}</td>
                      <td className="py-3 px-3 font-mono font-semibold text-[var(--text-primary)]">
                        {inv.reference_number || "—"}
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                        €{inv.total_amount_eur.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setLaskuInvoice(inv)}
                          className="px-2.5 py-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] text-[11px] font-semibold text-[var(--text-primary)] transition-colors cursor-pointer"
                        >
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 3: CREDIT NOTES & ADJUSTMENTS (m1.6_credit)             */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === "m1.6_credit" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 via-[var(--bg-card)] to-blue-500/10 border border-[var(--border-color)]">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-purple-600" />
                <span>Statutory Credit Notes & Shift Adjustments (Hyvityslaskut)</span>
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Issue adjustments for worker absences, cancelled production runs, or punch discrepancies with statutory ALV 25.5% refund.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCnForm({
                  invoice_id: invoices[0]?.id || 0,
                  reason: "",
                  subtotal_eur: 0,
                  notes: "",
                });
                setIsCreditNoteModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Issue Credit Note Request</span>
            </button>
          </div>

          {/* Credit Notes KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
              <div className="text-[11px] font-medium text-[var(--text-secondary)]">Total Credits Applied</div>
              <div className="text-lg sm:text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                -€{stats.totalCreditNotesAmt.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] mt-1">{creditNotes.length} active credit notes</div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
              <div className="text-[11px] font-medium text-[var(--text-secondary)]">ALV 25.5% Reclaimed</div>
              <div className="text-lg sm:text-xl font-bold text-[var(--text-primary)] mt-1">
                -€{(stats.totalCreditNotesAmt * 0.255 / 1.255).toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] mt-1">Statutory Finnish Tax deduction</div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
              <div className="text-[11px] font-medium text-[var(--text-secondary)]">Net Payable to Agency</div>
              <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                €{stats.netPayable.toLocaleString("fi-FI", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] mt-1">Gross Invoiced minus Approved Credits</div>
            </div>
          </div>

          {/* Credit Notes Table */}
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-secondary)]/70 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                <tr>
                  <th className="py-3 px-4">Credit Note #</th>
                  <th className="py-3 px-3">Linked Invoice</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Reason / Description</th>
                  <th className="py-3 px-3">Net Deduction</th>
                  <th className="py-3 px-3">Total Credit (ALV 25.5%)</th>
                  <th className="py-3 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {isLoadingCN ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[var(--text-secondary)]">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-600" />
                      Loading credit notes...
                    </td>
                  </tr>
                ) : creditNotes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[var(--text-secondary)]">
                      No credit notes on record.
                    </td>
                  </tr>
                ) : (
                  creditNotes.map((cn) => (
                    <tr key={cn.id} className="hover:bg-[var(--bg-secondary)]/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-purple-600 dark:text-purple-400">
                        {cn.credit_note_number}
                      </td>
                      <td className="py-3 px-3 font-medium text-[var(--text-primary)]">
                        {cn.invoice_number}
                      </td>
                      <td className="py-3 px-3 text-[var(--text-secondary)]">{cn.issue_date}</td>
                      <td className="py-3 px-3 max-w-xs truncate text-[var(--text-primary)]" title={cn.reason}>
                        {cn.reason}
                      </td>
                      <td className="py-3 px-3 text-[var(--text-secondary)]">
                        -€{cn.subtotal_eur.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 font-bold text-purple-600 dark:text-purple-400">
                        -€{cn.total_amount_eur.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-purple-500/10 text-purple-600 font-bold border border-purple-500/20">
                          Applied
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. OFFICIAL FINNISH LASKU PDF / PRINT MODAL                    */}
      {/* ------------------------------------------------------------- */}
      {laskuInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-white text-slate-900 shadow-2xl overflow-hidden my-auto border border-slate-300">
            {/* Modal Top Control Bar */}
            <div className="p-3 bg-slate-100 border-b border-slate-300 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-800">
                  Finnish Statutory Lasku &bull; {laskuInvoice.invoice_number}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLaskuInvoice(null)}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Area */}
            <div className="p-6 sm:p-10 font-sans space-y-6 text-xs text-slate-800 bg-white">
              {/* Document Header: Seller & Buyer Details */}
              <div className="flex flex-col sm:flex-row justify-between gap-6 border-b border-slate-200 pb-6">
                <div>
                  <div className="text-base font-black text-slate-900 tracking-tight">
                    SUOMEN HENKILÖSTÖPALVELU OY
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Mannerheimintie 12 B, 00100 Helsinki, Finland<br />
                    Y-tunnus: <strong>2839102-4</strong> &bull; ALV-rekisteröity<br />
                    Kotipaikka: Helsinki &bull; Puh: +358 9 123 4567<br />
                    Laskutus: billing@henkilostopalvelu.fi
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div className="text-xs uppercase font-bold text-slate-500">Laskutettava Yritys (Ostaja)</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{companyName}</div>
                  <div className="text-[11px] text-slate-600 leading-relaxed">
                    Teollisuuskatu 8, 33100 Tampere, Finland<br />
                    Y-tunnus: <strong>1928374-1</strong> &bull; Toimipaikka: {laskuInvoice.site_name}<br />
                    Asiakasnumero: <strong>ASI-10492</strong>
                  </div>
                </div>
              </div>

              {/* Invoice Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Laskun Numero</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{laskuInvoice.invoice_number}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Päiväys / Issue Date</span>
                  <span className="font-semibold text-slate-900">{laskuInvoice.issue_date}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Eräpäivä / Due Date</span>
                  <span className="font-bold text-rose-600">{laskuInvoice.due_date}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Maksuehto</span>
                  <span className="font-semibold text-slate-900">14 pv netto</span>
                </div>
              </div>

              {/* Itemized Services Specification */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Laskutettavat Suoritteet & Työaikakirjaukset ({laskuInvoice.billing_period_start} – {laskuInvoice.billing_period_end})
                </h4>
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Kuvaus / Ammattiryhmä</th>
                      <th className="py-2 px-2 text-center">Tekijät</th>
                      <th className="py-2 px-2 text-right">Tunnit (h)</th>
                      <th className="py-2 px-2 text-right">Yksikköhinta (€/h)</th>
                      <th className="py-2 px-3 text-right">Yhteensä (€)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {laskuInvoice.items_breakdown && laskuInvoice.items_breakdown.length > 0 ? (
                      laskuInvoice.items_breakdown.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-semibold text-slate-900">{item.role}</td>
                          <td className="py-2 px-2 text-center">{item.workers}</td>
                          <td className="py-2 px-2 text-right font-medium">{item.hours.toFixed(1)}</td>
                          <td className="py-2 px-2 text-right">€{item.rate.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">€{item.total.toFixed(2)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-2 px-3 font-semibold text-slate-900">Tuotannon henkilöstöpalvelut & TES-korvaukset</td>
                        <td className="py-2 px-2 text-center">4</td>
                        <td className="py-2 px-2 text-right font-medium">{laskuInvoice.total_regular_hours}</td>
                        <td className="py-2 px-2 text-right">€{(laskuInvoice.subtotal_eur / laskuInvoice.total_regular_hours).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">€{laskuInvoice.subtotal_eur.toFixed(2)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Statutory ALV 25.5% Tax Specification */}
              <div className="flex justify-end">
                <div className="w-full sm:w-72 space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Veroton hinta (Net Total):</span>
                    <span className="font-semibold text-slate-900">€{laskuInvoice.subtotal_eur.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>ALV 25.5% (Finnish VAT):</span>
                    <span className="font-semibold text-slate-900">€{laskuInvoice.alv_amount_eur.toFixed(2)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-300 flex justify-between text-sm font-black text-slate-950">
                    <span>Yhteensä Maksettava:</span>
                    <span className="text-blue-700">€{laskuInvoice.total_amount_eur.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Finnish Bank Giro Slip (Tilisiirto) */}
              <div className="pt-4 border-t-2 border-dashed border-slate-300 space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tilisiirto &bull; Giro Slip &bull; SEPA Payment Specification
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-3.5 rounded-xl bg-slate-100 border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Saaja / Payee</span>
                    <span className="font-bold text-slate-900">Suomen Henkilöstöpalvelu Oy</span>
                    <div className="text-[11px] text-slate-600 mt-1">
                      Pankki: <strong>Nordea Bank Oyj</strong> &bull; BIC: <strong>NDEADBH</strong>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">IBAN Tilinumero</span>
                    <span className="font-mono font-black text-slate-900 text-sm">FI42 1234 5678 9012 34</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Viitenumero (ISO 11649 Ref)</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {laskuInvoice.reference_number || `2849${laskuInvoice.id}91823`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Maksettava Summa</span>
                    <span className="font-black text-slate-950 text-base">€{laskuInvoice.total_amount_eur.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. MODAL: CLIENT INTERNAL APPROVAL DECISION                    */}
      {/* ------------------------------------------------------------- */}
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

      {/* ------------------------------------------------------------- */}
      {/* 6. MODAL: CLIENT ACCOUNTS DESK PAYMENT SUBMISSION             */}
      {/* ------------------------------------------------------------- */}
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

      {/* ------------------------------------------------------------- */}
      {/* 7. MODAL: ISSUE CREDIT NOTE REQUEST (m1.6_credit)             */}
      {/* ------------------------------------------------------------- */}
      {isCreditNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Issue Credit Note Request (Hyvityslasku)
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Applies statutory ALV 25.5% refund against invoice balance
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreditNoteModalOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCreditNote} className="p-4 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Target Agency Invoice *
                </label>
                <select
                  value={cnForm.invoice_id}
                  onChange={(e) => setCnForm((prev) => ({ ...prev, invoice_id: Number(e.target.value) }))}
                  className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                >
                  <option value={0}>General Account Credit (No specific invoice)</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.site_name} (€{inv.total_amount_eur.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Credit Reason / Adjustment Explanation *
                </label>
                <input
                  type="text"
                  value={cnForm.reason}
                  onChange={(e) => setCnForm((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Worker absent without replacement on 2026-10-14, 8h day shift"
                  className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Net Refund Amount (€ excl. VAT) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={cnForm.subtotal_eur || ""}
                    onChange={(e) =>
                      setCnForm((prev) => ({ ...prev, subtotal_eur: parseFloat(e.target.value) || 0 }))
                    }
                    placeholder="e.g. 240.00"
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-primary)]"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] uppercase block mb-1 font-bold">
                    Total Credit with ALV 25.5%
                  </label>
                  <div className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-bold text-purple-600 dark:text-purple-400">
                    €{(cnForm.subtotal_eur * 1.255).toFixed(2)}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Internal Remarks / Documentation (Optional)
                </label>
                <textarea
                  value={cnForm.notes}
                  onChange={(e) => setCnForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Approved by Plant Director as per shift log dispute resolution."
                  rows={2}
                  className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setIsCreditNoteModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCN}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60 flex items-center gap-1.5 shadow-sm"
                >
                  {isSubmittingCN ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Issue & Apply Credit Note</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 8. MODAL: RECEIVE INVOICE FROM AGENCY PORTAL */}
      {isReceiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)] bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Receive Invoice from Agency Portal
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Simulates Suomen Henkilöstöpalvelu Oy transmitting verified biometric billing
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReceiveModalOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReceiveFromAgency} className="p-4 space-y-3.5">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-1">
                <div className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Two-Sided Agency Transmission</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  The invoice will be received by <strong>{companyName}</strong> in status <code className="px-1 py-0.5 rounded bg-amber-500/15 text-amber-600 font-bold">Awaiting Internal Approval</code>. An instant notification will be delivered to the Level 1 Approver.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Staffing Role / Trade *
                  </label>
                  <select
                    value={receiveForm.role}
                    onChange={(e) => setReceiveForm((prev) => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                  >
                    <option value="Certified CNC Machinist (Fanuc)">CNC Machinist (Fanuc)</option>
                    <option value="MIG/MAG Welder (ISO 9606-1)">MIG/MAG Welder (ISO 9606-1)</option>
                    <option value="Production Line Operative">Production Line Operative</option>
                    <option value="Heavy Industrial Assembler">Heavy Industrial Assembler</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Agreed TES Rate (€/h) *
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    value={receiveForm.hourly_rate}
                    onChange={(e) =>
                      setReceiveForm((prev) => ({ ...prev, hourly_rate: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-primary)]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Billing Period Start *
                  </label>
                  <input
                    type="date"
                    value={receiveForm.billing_period_start}
                    onChange={(e) => setReceiveForm((prev) => ({ ...prev, billing_period_start: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Billing Period End *
                  </label>
                  <input
                    type="date"
                    value={receiveForm.billing_period_end}
                    onChange={(e) => setReceiveForm((prev) => ({ ...prev, billing_period_end: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Biometric Regular Hours *
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={receiveForm.total_regular_hours}
                    onChange={(e) =>
                      setReceiveForm((prev) => ({ ...prev, total_regular_hours: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-primary)]"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    Approved Overtime Hours (TES +50%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={receiveForm.total_overtime_hours}
                    onChange={(e) =>
                      setReceiveForm((prev) => ({ ...prev, total_overtime_hours: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {/* Total Calculation Preview */}
              <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-1 text-xs">
                {(() => {
                  const reg = receiveForm.total_regular_hours * receiveForm.hourly_rate;
                  const ot = receiveForm.total_overtime_hours * (receiveForm.hourly_rate * 1.5);
                  const sub = Math.round((reg + ot) * 100) / 100;
                  const vat = Math.round(sub * 0.255 * 100) / 100;
                  const gross = Math.round((sub + vat) * 100) / 100;
                  return (
                    <>
                      <div className="flex justify-between text-[var(--text-secondary)]">
                        <span>Net Staffing Subtotal:</span>
                        <span className="font-semibold text-[var(--text-primary)]">€{sub.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[var(--text-secondary)]">
                        <span>Finnish ALV 25.5%:</span>
                        <span className="font-semibold text-[var(--text-primary)]">€{vat.toFixed(2)}</span>
                      </div>
                      <div className="pt-1 border-t border-[var(--border-color)] flex justify-between text-sm font-bold text-[var(--text-primary)]">
                        <span>Gross Invoiced Payable:</span>
                        <span className="text-blue-600 dark:text-blue-400">€{gross.toFixed(2)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Agency Billing Note (Optional)
                </label>
                <input
                  type="text"
                  value={receiveForm.notes}
                  onChange={(e) => setReceiveForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Biometric timesheet export from Tampere Plant Turnstile #2"
                  className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setIsReceiveModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReceivingInvoice}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60 flex items-center gap-1.5 shadow-sm"
                >
                  {isReceivingInvoice ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Transmitting...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Transmit Invoice to Client</span>
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
