"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Briefcase,
  Users,
  CalendarCheck2,
  UserCheck,
  Plus,
  CheckCircle2,
  Clock,
  MapPin,
  ExternalLink,
  Star,
  ChevronRight,
  ShieldCheck,
  Award,
  Video,
  X,
  ArrowLeft,
  Eye,
  Sparkles,
  Building2,
  Globe,
  Euro,
  FileText,
  Check
} from "lucide-react";
import { NewStaffingOrderForm } from "./NewStaffingOrderForm";
import { SiteItem } from "../app/page";

export interface RequisitionItem {
  id: number;
  req_code: string;
  client_id: number;
  site_id: number;
  site_name: string;
  site_code: string;
  role_title: string;
  tes_category: string;
  vacancies_count: number;
  fulfilled_count: number;
  experience_years_required: number;
  required_certifications: string;
  shift_pattern: string;
  salary_range_eur_hr: string;
  start_date: string;
  notes?: string;
  status: string;
  current_approval_step?: number;
  total_approval_steps?: number;
  current_approver_id?: number | null;
  current_approver_name?: string | null;
  current_approver_role?: string | null;
  approval_levels?: Array<{
    level: number;
    approver_id?: number | null;
    approver_name: string;
    approver_role?: string;
  }>;
  approval_history?: Array<{
    step: number;
    action: string;
    approver_name?: string;
    role?: string;
    timestamp: string;
    notes?: string;
  }>;
  released_to_agency_at?: string | null;
  created_by_user_id?: number | null;
  created_by_name?: string;
  candidates_count: number;
  created_at: string;
}

interface CandidateItem {
  id: number;
  requisition_id: number;
  candidate_id: number;
  full_name: string;
  current_location: string;
  nationality: string;
  experience_years: number;
  match_percentage: number;
  tes_grade: string;
  certifications: string;
  language_skills: string;
  status: string;
  summary: string;
  interviews: Array<{
    id: number;
    scheduled_at: string;
    meeting_link: string;
    interviewer_name: string;
    status: string;
    client_rating: number | null;
    client_feedback: string | null;
    decision: string;
  }>;
}

interface InterviewItem {
  id: number;
  shortlist_id: number;
  candidate_name: string;
  role_title: string;
  scheduled_at: string;
  meeting_link: string;
  interviewer_name: string;
  status: string;
  client_rating: number | null;
  client_feedback: string | null;
  decision: string;
}

interface RelocationItem {
  id: number;
  candidate_id: number;
  candidate_name: string;
  role_title: string;
  origin_country: string;
  destination_city: string;
  migri_permit_status: string;
  dvv_registered: boolean;
  tax_card_obtained: boolean;
  bank_account_opened: boolean;
  housing_arranged: boolean;
  target_arrival_date: string;
  plant_start_date: string;
  current_phase: string;
}

interface TalentAcquisitionModuleProps {
  clientId: number;
  currentUserId?: number;
  userRole?: string;
  allowedSites?: SiteItem[];
  selectedSubTab: "m1.2_req" | "m1.2_shortlist" | "m1.2_interviews" | "m1.2_relocation";
  onChangeSubTab: (tab: "m1.2_req" | "m1.2_shortlist" | "m1.2_interviews" | "m1.2_relocation") => void;
  selectedSite: string;
  userName: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const TalentAcquisitionModule: React.FC<TalentAcquisitionModuleProps> = ({
  clientId,
  currentUserId,
  userRole = "SITE_MANAGER",
  allowedSites = [],
  selectedSubTab,
  onChangeSubTab,
  selectedSite,
  userName,
}) => {
  // State
  const [requisitions, setRequisitions] = useState<RequisitionItem[]>([]);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [relocations, setRelocations] = useState<RelocationItem[]>([]);
  const [selectedReqForCandidates, setSelectedReqForCandidates] = useState<number | null>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [viewingRequisition, setViewingRequisition] = useState<RequisitionItem | null>(null);

  const getCountryFlag = (nationality: string) => {
    const n = (nationality || "").toLowerCase();
    if (n.includes("finnish") || n.includes("finland")) return "🇫🇮";
    if (n.includes("filipino") || n.includes("philippines")) return "🇵🇭";
    if (n.includes("polish") || n.includes("poland")) return "🇵🇱";
    if (n.includes("estonian") || n.includes("estonia")) return "🇪🇪";
    if (n.includes("indian") || n.includes("india")) return "🇮🇳";
    if (n.includes("ukrainian") || n.includes("ukraine")) return "🇺🇦";
    if (n.includes("german") || n.includes("germany")) return "🇩🇪";
    if (n.includes("spanish") || n.includes("spain")) return "🇪🇸";
    return "🌐";
  };

  const getReqBadge = (status: string, currentStep?: number, totalSteps?: number) => {
    switch (status) {
      case "PENDING_INTERNAL_APPROVAL":
        return {
          label: `Pending Approval (${currentStep || 1}/${totalSteps || 1})`,
          classes: "bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold",
        };
      case "RELEASED_TO_AGENCY":
        return {
          label: "Released to Agency",
          classes: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold",
        };
      case "IN_SOURCING":
      case "AGENCY_PROCURING":
        return {
          label: "Agency Procuring",
          classes: "bg-blue-500/10 text-blue-600 border border-blue-500/20 font-bold",
        };
      case "INTERVIEWING":
        return {
          label: "Interviews Active",
          classes: "bg-purple-500/10 text-purple-600 border border-purple-500/20 font-bold",
        };
      case "FULFILLED":
        return {
          label: "Fulfilled",
          classes: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 font-bold",
        };
      case "REJECTED_INTERNAL":
        return {
          label: "Rejected Internally",
          classes: "bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold",
        };
      default:
        return {
          label: status,
          classes: "bg-slate-100 text-slate-600 border border-slate-200",
        };
    }
  };

  const calculateBillingEstimate = (salaryRange: string) => {
    const matches = (salaryRange || "").match(/[\d.]+/g);
    if (matches && matches.length >= 2) {
      const min = parseFloat(matches[0]);
      const max = parseFloat(matches[1]);
      const billMin = (min * 1.78).toFixed(2);
      const billMax = (max * 1.78).toFixed(2);
      return `~${billMin} - ${billMax} €/h`;
    } else if (matches && matches.length === 1) {
      const val = parseFloat(matches[0]);
      return `~${(val * 1.78).toFixed(2)} €/h`;
    }
    return "~36.50 - 42.70 €/h";
  };

  const handleOpenDetails = (req: RequisitionItem) => {
    setViewingRequisition(req);
    setSelectedReqForCandidates(req.id);
    fetchCandidates(req.id);
  };

  // Modals & Page View
  const [isOrderPageOpen, setIsOrderPageOpen] = useState(false);
  const [isCreateReqOpen, setIsCreateReqOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Form states
  const [candidateToSchedule, setCandidateToSchedule] = useState<CandidateItem | null>(null);
  const [slotToReview, setSlotToReview] = useState<InterviewItem | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [feedbackText, setFeedbackText] = useState("");
  const [decision, setDecision] = useState("RECOMMEND_HIRE");

  // New Requisition Form state
  const [newReq, setNewReq] = useState({
    role_title: "5-Axis CNC Machinist (Koneistaja)",
    site_id: 1,
    tes_category: "Teknologiateollisuus TVR 4",
    vacancies_count: 2,
    experience_years_required: 3,
    required_certifications: "Työturvallisuuskortti",
    shift_pattern: "2-vuorotyö (Day/Evening)",
    salary_range_eur_hr: "20.00 - 23.50 €/h",
    start_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    notes: "",
  });

  // Schedule Interview Form state
  const [schedDate, setSchedDate] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  );
  const [interviewerName, setInterviewerName] = useState(userName || "Tapio Saarinen");

  // Fetch Requisitions (strictly scoped by currentUserId & selectedSite)
  const fetchRequisitions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (currentUserId) params.set("user_id", String(currentUserId));
      if (selectedSite !== "all") params.set("site_id", selectedSite);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${API_BASE}/api/client/${clientId}/requisitions${qs}`);
      if (res.ok) {
        const data = await res.json();
        setRequisitions(data.requisitions || []);
      }
    } catch {}
  }, [clientId, currentUserId, selectedSite]);

  // Fetch Candidates for Selected Requisition
  const fetchCandidates = useCallback(
    async (reqId: number) => {
      try {
        const qs = currentUserId ? `?user_id=${currentUserId}` : "";
        const res = await fetch(`${API_BASE}/api/client/requisitions/${reqId}/candidates${qs}`);
        if (res.ok) {
          const data = await res.json();
          setCandidates(data.candidates || []);
        }
      } catch {}
    },
    [currentUserId]
  );

  // Fetch Interviews
  const fetchInterviews = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (currentUserId) params.set("user_id", String(currentUserId));
      if (selectedSite !== "all") params.set("site_id", selectedSite);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${API_BASE}/api/client/${clientId}/interviews${qs}`);
      if (res.ok) {
        const data = await res.json();
        setInterviews(data || []);
      }
    } catch {}
  }, [clientId, currentUserId, selectedSite]);

  // Fetch Relocations
  const fetchRelocations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (currentUserId) params.set("user_id", String(currentUserId));
      if (selectedSite !== "all") params.set("site_id", selectedSite);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${API_BASE}/api/client/${clientId}/relocation-tracker${qs}`);
      if (res.ok) {
        const data = await res.json();
        setRelocations(data || []);
      }
    } catch {}
  }, [clientId, currentUserId, selectedSite]);

  useEffect(() => {
    fetchRequisitions();
    fetchInterviews();
    fetchRelocations();
  }, [fetchRequisitions, fetchInterviews, fetchRelocations]);

  // Listen for direct notification jump ("open-approval-target")
  useEffect(() => {
    const handleJump = (ev: Event) => {
      const detail = (ev as CustomEvent<{ module?: string; referenceId?: number | null }>).detail;
      if (detail?.module === "m1.2_req") {
        if (detail.referenceId) {
          const found = requisitions.find((r) => r.id === detail.referenceId);
          if (found) {
            setViewingRequisition(found);
            setSelectedReqForCandidates(found.id);
            fetchCandidates(found.id);
          } else {
            fetchRequisitions();
          }
        } else {
          setViewingRequisition(null);
        }
      }
    };
    window.addEventListener("open-approval-target", handleJump);
    return () => window.removeEventListener("open-approval-target", handleJump);
  }, [requisitions, fetchCandidates, fetchRequisitions]);

  useEffect(() => {
    if (selectedReqForCandidates) {
      fetchCandidates(selectedReqForCandidates);
    }
  }, [selectedReqForCandidates, fetchCandidates]);

  useEffect(() => {
    if (viewingRequisition) {
      const updated = requisitions.find((r) => r.id === viewingRequisition.id);
      if (
        updated &&
        (updated.candidates_count !== viewingRequisition.candidates_count ||
          updated.status !== viewingRequisition.status ||
          updated.current_approval_step !== viewingRequisition.current_approval_step ||
          updated.current_approver_id !== viewingRequisition.current_approver_id ||
          updated.fulfilled_count !== viewingRequisition.fulfilled_count)
      ) {
        setViewingRequisition(updated);
      }
    }
  }, [requisitions, viewingRequisition]);

  // Sync modal default site_id whenever allowedSites / selectedSite changes
  useEffect(() => {
    if (selectedSite !== "all") {
      setNewReq((prev) => ({ ...prev, site_id: Number(selectedSite) }));
    } else if (allowedSites.length > 0) {
      setNewReq((prev) => ({ ...prev, site_id: allowedSites[0].id }));
    }
  }, [selectedSite, allowedSites]);

  // Handle Create Requisition
  const handleCreateRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const targetSiteId =
        allowedSites.length === 1 ? allowedSites[0].id : newReq.site_id;
      const res = await fetch(`${API_BASE}/api/client/requisitions/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          ...newReq,
          site_id: targetSiteId,
          created_by_user_id: currentUserId,
          created_by_name: userName || "Client User",
        }),
      });
      if (res.ok) {
        setIsCreateReqOpen(false);
        await fetchRequisitions();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("refresh-notifications"));
        }
      }
    } catch {} finally {
      setIsLoading(false);
    }
  };

  // Handle Schedule Interview
  const handleScheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateToSchedule) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/client/interviews/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shortlist_id: candidateToSchedule.id,
          candidate_name: candidateToSchedule.full_name,
          role_title: candidateToSchedule.tes_grade,
          scheduled_at: new Date(schedDate).toISOString(),
          interviewer_name: interviewerName,
          meeting_link: "https://teams.microsoft.com/l/meetup-join/valmet-interview",
        }),
      });
      if (res.ok) {
        setIsScheduleOpen(false);
        if (selectedReqForCandidates) fetchCandidates(selectedReqForCandidates);
        fetchInterviews();
        onChangeSubTab("m1.2_interviews");
      }
    } catch {} finally {
      setIsLoading(false);
    }
  };

  // Handle Submit Feedback
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotToReview) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/client/interviews/${slotToReview.id}/feedback`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slot_id: slotToReview.id,
            client_rating: rating,
            client_feedback: feedbackText,
            decision: decision,
          }),
        }
      );
      if (res.ok) {
        setIsFeedbackOpen(false);
        fetchInterviews();
        fetchRequisitions();
      }
    } catch {} finally {
      setIsLoading(false);
    }
  };

  // Handle Requisition Approval Decision (Strict Sequential Level Check)
  const [isApprovingReq, setIsApprovingReq] = useState(false);
  const [approvalError, setApprovalError] = useState<string>("");
  const handleRequisitionDecision = async (reqId: number, decision: "APPROVE" | "REJECT") => {
    setIsApprovingReq(true);
    setApprovalError("");
    try {
      const res = await fetch(`${API_BASE}/api/client/requisitions/${reqId}/approval-decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          approver_user_id: currentUserId,
          approver_name: userName || "Approver",
          approver_role: userRole || "SITE_MANAGER",
          notes:
            decision === "APPROVE"
              ? "Approved in sequential review."
              : "Requirement rejected in internal review.",
        }),
      });
      if (res.ok) {
        await fetchRequisitions();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("refresh-notifications"));
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setApprovalError(
          errData.detail || "You are not authorized to approve at the current sequential level."
        );
      }
    } catch (err) {
      console.error("Requisition approval failed:", err);
      setApprovalError("Network error while submitting approval decision.");
    } finally {
      setIsApprovingReq(false);
    }
  };

  // Render dedicated full-page New Staffing Order Form if active
  if (isOrderPageOpen) {
    const resolvedDefaultSiteId =
      selectedSite !== "all"
        ? Number(selectedSite)
        : allowedSites[0]?.id || 1;
    return (
      <div className="w-full">
        <NewStaffingOrderForm
          clientId={clientId}
          currentUserId={currentUserId}
          userName={userName}
          companyName="Valmet Technologies Oy"
          allowedSites={allowedSites}
          defaultSiteId={resolvedDefaultSiteId}
          onCancel={() => setIsOrderPageOpen(false)}
          onSubmitSuccess={async (createdReq) => {
            setRequisitions((prev) => [createdReq, ...prev]);
            await fetchRequisitions();
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("refresh-notifications"));
            }
            setIsOrderPageOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* 1. TOP HEADER & SUB-MODULE TABS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
        <div className="flex items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--accent-light)] text-[var(--accent-color)] uppercase tracking-wider">
                Talent Acquisition
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                Recruitment & Placement Engine
              </span>
            </div>
            <h1 className="text-xl font-black text-[var(--text-primary)] mt-1 tracking-tight">
              Workforce Sourcing & Candidate Matching
            </h1>
          </div>
        </div>

        {/* Action Button: Opens Full-Page Wizard */}
        <button
          type="button"
          onClick={() => setIsOrderPageOpen(true)}
          className="px-4 py-2 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs flex items-center gap-2 transition-all shadow-sm shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Staffing Order</span>
        </button>
      </div>

      {/* 2. SUB-NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => onChangeSubTab("m1.2_req")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            selectedSubTab === "m1.2_req"
              ? "bg-[var(--accent-color)] text-white shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Job Requisitions</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
            {requisitions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChangeSubTab("m1.2_shortlist")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            selectedSubTab === "m1.2_shortlist"
              ? "bg-[var(--accent-color)] text-white shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Candidate Matches</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
            {candidates.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChangeSubTab("m1.2_interviews")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            selectedSubTab === "m1.2_interviews"
              ? "bg-[var(--accent-color)] text-white shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
          }`}
        >
          <CalendarCheck2 className="w-3.5 h-3.5" />
          <span>Interview Schedule</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
            {interviews.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChangeSubTab("m1.2_relocation")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            selectedSubTab === "m1.2_relocation"
              ? "bg-[var(--accent-color)] text-white shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>New Joining Status</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-600 font-bold">
            {relocations.length} Active
          </span>
        </button>
      </div>

      {/* 3. SUB-VIEW: 1. JOB REQUISITIONS */}
      {selectedSubTab === "m1.2_req" && (
        viewingRequisition ? (
          <div className="space-y-6">
            {/* Top Navigation & Context Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewingRequisition(null)}
                  className="px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--accent-color)] hover:text-white text-[var(--text-secondary)] transition-all cursor-pointer flex items-center gap-2 text-xs font-bold shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Requisitions</span>
                </button>

                <div className="h-6 w-px bg-[var(--border-color)] hidden sm:block" />

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--accent-color)] border border-[var(--border-color)]">
                      {viewingRequisition.req_code}
                    </span>
                    {(() => {
                      const badge = getReqBadge(
                        viewingRequisition.status,
                        viewingRequisition.current_approval_step,
                        viewingRequisition.total_approval_steps
                      );
                      return (
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${badge.classes}`}>
                          {badge.label}
                        </span>
                      );
                    })()}
                  </div>
                  <h2 className="text-lg font-black text-[var(--text-primary)] mt-0.5">
                    {viewingRequisition.role_title}
                  </h2>
                </div>
              </div>

              {/* Quick Requisition Switcher */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-xs font-medium text-[var(--text-secondary)] whitespace-nowrap mr-1">Switch:</span>
                {requisitions.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleOpenDetails(r)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      viewingRequisition.id === r.id
                        ? "bg-[var(--accent-color)] text-white shadow-sm"
                        : "bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {r.req_code}
                  </button>
                ))}
              </div>
            </div>

            {/* Enterprise Requisition Sequential Multi-Level Approval Gate Banner */}
            {viewingRequisition.status === "PENDING_INTERNAL_APPROVAL" && (() => {
              const curStep = viewingRequisition.current_approval_step || 1;
              const totSteps = viewingRequisition.total_approval_steps || 1;
              const designatedId = viewingRequisition.current_approver_id;
              const designatedName = viewingRequisition.current_approver_name || `Level ${curStep} Approver`;
              const canCurrentUserApprove =
                designatedId != null ? Number(currentUserId) === Number(designatedId) : true;
              const isFinalStep = curStep >= totSteps;

              return (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                        {curStep}/{totSteps}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[var(--text-primary)]">
                          Sequential Approval — Level {curStep} of {totSteps} ({designatedName})
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                          {isFinalStep
                            ? "Final approval step before releasing requirement to Agency Portal."
                            : `After Level ${curStep} approves, notification will be sent to Level ${curStep + 1}.`}
                        </p>
                      </div>
                    </div>

                    {canCurrentUserApprove ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={isApprovingReq}
                          onClick={() => handleRequisitionDecision(viewingRequisition.id, "APPROVE")}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60 transition-all"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isFinalStep ? "Approve & Release" : `Approve Level ${curStep}`}</span>
                        </button>
                        <button
                          type="button"
                          disabled={isApprovingReq}
                          onClick={() => handleRequisitionDecision(viewingRequisition.id, "REJECT")}
                          className="px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-600 hover:bg-rose-500/10 text-xs font-semibold cursor-pointer disabled:opacity-60 transition-all"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-bold shrink-0">
                        Locked — Awaiting Level {curStep} ({designatedName})
                      </div>
                    )}
                  </div>

                  {viewingRequisition.approval_levels && viewingRequisition.approval_levels.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-amber-500/20 text-[11px]">
                      {viewingRequisition.approval_levels.map((lvl, i) => {
                        const done = lvl.level < curStep;
                        const active = lvl.level === curStep;
                        return (
                          <React.Fragment key={lvl.level}>
                            <span
                              className={`px-2 py-0.5 rounded-lg font-semibold border ${
                                done
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                  : active
                                  ? "bg-amber-500 text-white border-amber-500 font-bold"
                                  : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)]"
                              }`}
                            >
                              L{lvl.level}: {lvl.approver_name} {done ? "✓" : ""}
                            </span>
                            {i < viewingRequisition.approval_levels!.length - 1 && (
                              <span className="text-[var(--text-secondary)]">→</span>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}

                  {approvalError && (
                    <div className="text-xs font-semibold text-rose-600 bg-rose-500/10 px-3 py-1.5 rounded-lg">
                      {approvalError}
                    </div>
                  )}
                </div>
              );
            })()}

            {viewingRequisition.status === "RELEASED_TO_AGENCY" && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>
                  All client internal approvals verified. Released to Agency Portal for candidate matching and procurement.
                </span>
              </div>
            )}

            {/* Main 2-Column Responsive Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT COLUMN: Detailed Recruitment Specifications (7 of 12 cols) */}
              <div className="lg:col-span-7 space-y-4">
                {/* Card 1: Facility Location & Headcount Goal */}
                <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[var(--accent-color)]" />
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        Plant Facility & Headcount Goal
                      </h3>
                    </div>
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      Created {viewingRequisition.created_at ? new Date(viewingRequisition.created_at).toLocaleDateString("en-GB") : "Recently"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-1">
                      <span className="text-[var(--text-secondary)]">Operating Facility:</span>
                      <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />
                        <span>{viewingRequisition.site_code} — {viewingRequisition.site_name}</span>
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        {viewingRequisition.site_code.startsWith("TMP") ? "Automaatiokatu 1, 33720 Tampere" : "Valimotie 4, 40100 Jyväskylä"}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-1">
                      <span className="text-[var(--text-secondary)]">Target Joining Date:</span>
                      <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>
                          {viewingRequisition.start_date
                            ? new Date(viewingRequisition.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                            : "Immediate (Asap)"}
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-600 font-semibold">
                        Recruitment Priority: Urgent Fill
                      </div>
                    </div>
                  </div>

                  {/* Fulfillment Progress Bar */}
                  <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[var(--text-secondary)]">
                        Fulfillment Status
                      </span>
                      <span className="font-black text-[var(--text-primary)]">
                        {viewingRequisition.fulfilled_count} of {viewingRequisition.vacancies_count} Positions Filled ({Math.round((viewingRequisition.fulfilled_count / viewingRequisition.vacancies_count) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{
                          width: `${Math.round((viewingRequisition.fulfilled_count / viewingRequisition.vacancies_count) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] pt-1">
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        {viewingRequisition.fulfilled_count} Contract Signed
                      </span>
                      <span>
                        {viewingRequisition.vacancies_count - viewingRequisition.fulfilled_count} Remaining in Pipeline
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: TES Collective Agreement & Estimated Client Billing Rate */}
                <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                    <div className="flex items-center gap-2">
                      <Euro className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        TES Collective Agreement & Estimated Billing Rate
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Finnish TES Compliant
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-1.5">
                      <span className="text-[var(--text-secondary)] font-medium">TES Collective Agreement & Grade:</span>
                      <div className="text-sm font-black text-[var(--text-primary)]">
                        {viewingRequisition.tes_category}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        Teknologiateollisuus Työehtosopimus (Metalli)
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-1.5">
                      <span className="text-[var(--text-secondary)] font-medium">Worker Base Hourly Pay:</span>
                      <div className="text-sm font-black text-emerald-600">
                        {viewingRequisition.salary_range_eur_hr}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        Guaranteed base wage according to TVR classification
                      </div>
                    </div>
                  </div>

                  {/* Estimated Client Billing Rate Highlight */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 via-emerald-500/10 to-blue-500/10 border border-blue-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text-secondary)]">
                        ESTIMATED CLIENT INVOICE RATE (~1.78x Multiplier)
                      </span>
                      <span className="text-base font-black text-[var(--text-primary)]">
                        {calculateBillingEstimate(viewingRequisition.salary_range_eur_hr)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                      Includes TyEL statutory pension (17.3%), social security insurance, holiday accrual reserve (9-11.5%), occupational healthcare, and agency third-party liability insurance.
                    </p>
                    <div className="pt-2 border-t border-[var(--border-color)]/50 flex flex-wrap gap-2 text-[10px] text-[var(--text-secondary)]">
                      <span className="px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] font-medium">
                        + Iltavuorolisä (Evening Shift): ~1.28 €/h
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] font-medium">
                        + Yövuorolisä (Night Shift): ~2.35 €/h
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] font-medium">
                        + Sunnuntailisä (Sunday Work): 100% Base
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Shift Schedule & Staffing Contract Model */}
                <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-600" />
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        Working Hours & Staffing Contract Model
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 border border-purple-500/20">
                      Flexible Allocation
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-1">
                      <span className="text-[var(--text-secondary)]">Shift Schedule Model:</span>
                      <div className="font-bold text-[var(--text-primary)]">
                        {viewingRequisition.shift_pattern}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        Regular 37.5 h / week standard roster
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-1">
                      <span className="text-[var(--text-secondary)]">Staffing Contract Model:</span>
                      <div className="font-bold text-[var(--text-primary)]">
                        Vuokratyö (Agency Staffing)
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        Option for direct client hiring after 6 months trial
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 4: Mandatory Safety Qualifications & Occupational Cards */}
                <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        Mandatory Finnish Occupational Safety Cards & Qualifications
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                      Min. {viewingRequisition.experience_years_required}+ Years Experience
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(viewingRequisition.required_certifications || "Työturvallisuuskortti")
                      .split(",")
                      .map((cert, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-700 dark:text-emerald-400"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{cert.trim()} (Green Card Verified)</span>
                        </div>
                      ))}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-primary)]">
                      <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                      <span>Teknologiateollisuus Industry Standards</span>
                    </div>
                  </div>
                </div>

                {/* Card 5: Candidate Origin & Sponsored Relocation Benefits */}
                <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-600" />
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        Candidate Origin & Sponsored Relocation Benefits
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">
                      Migri Fast-Track
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    For global candidates sourced outside Finland, RekrySilta manages all logistics and relocation requirements:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-xs">
                        🏠
                      </div>
                      <div>
                        <div className="font-bold text-[var(--text-primary)]">Furnished Accommodation</div>
                        <div className="text-[10px] text-[var(--text-secondary)]">Pre-arranged 1-3 months transition flat</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
                        ✈️
                      </div>
                      <div>
                        <div className="font-bold text-[var(--text-primary)]">Flight & Arrival Transport</div>
                        <div className="text-[10px] text-[var(--text-secondary)]">Direct booking and airport greeting</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold text-xs">
                        🛂
                      </div>
                      <div>
                        <div className="font-bold text-[var(--text-primary)]">Migri Fast-Track Permit</div>
                        <div className="text-[10px] text-[var(--text-secondary)]">Specialist visa approval within 14 days</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xs">
                        🏛️
                      </div>
                      <div>
                        <div className="font-bold text-[var(--text-primary)]">DVV & Tax Card Setup</div>
                        <div className="text-[10px] text-[var(--text-secondary)]">Personal ID code, Verokortti & bank</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 6: Languages & Operational Notes */}
                <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-3">
                  <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
                    <FileText className="w-4 h-4 text-[var(--accent-color)]" />
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      Language Requirements & Operational Notes
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-[var(--text-secondary)]">Languages:</span>
                    <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-secondary)] font-bold text-[var(--text-primary)] border border-[var(--border-color)]">
                      English (Plant Standard B2+)
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-secondary)] font-bold text-[var(--text-secondary)] border border-[var(--border-color)]">
                      Finnish (Basic A1/A2 or company training)
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] leading-relaxed">
                    <span className="font-bold text-[var(--text-primary)] block mb-1">Requisition Notes:</span>
                    {viewingRequisition.notes || "Urgent replacement for Tampere turbine impeller milling cell. Heidenhain/Siemens 840D experience essential."}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Matching Candidates List (5 of 12 cols, sticky) */}
              <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
                <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[var(--accent-color)]" />
                        <h3 className="text-base font-black text-[var(--text-primary)]">
                          Matching Candidates
                        </h3>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        AI-ranked shortlist for {viewingRequisition.req_code}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20">
                      {candidates.length} Matched
                    </span>
                  </div>

                  {/* Candidates Stack */}
                  {candidates.length > 0 ? (
                    <div className="space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                      {candidates.map((cand) => (
                        <div
                          key={cand.id}
                          className="p-4 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] hover:border-[var(--accent-color)] transition-all space-y-3"
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-full bg-[var(--accent-color)] text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                                {cand.full_name.split(" ").map((n) => n[0]).join("")}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                                    {cand.full_name}
                                  </h4>
                                  <span className="text-sm" title={cand.nationality}>
                                    {getCountryFlag(cand.nationality)}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[var(--text-secondary)]">
                                  {cand.current_location}
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                <Award className="w-3 h-3" />
                                <span>{cand.match_percentage}% Match</span>
                              </div>
                            </div>
                          </div>

                          {/* Stats pills */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] font-semibold text-[var(--text-primary)]">
                              {cand.tes_grade}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                              {cand.experience_years} yrs exp
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                                cand.status === "OFFER_ACCEPTED"
                                  ? "bg-purple-500/10 text-purple-600"
                                  : cand.status === "INTERVIEW_SCHEDULED"
                                  ? "bg-blue-500/10 text-blue-600"
                                  : "bg-amber-500/10 text-amber-600"
                              }`}
                            >
                              {cand.status.replace("_", " ")}
                            </span>
                          </div>

                          {/* Summary */}
                          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                            {cand.summary}
                          </p>

                          {/* Skills & Badges */}
                          <div className="flex flex-wrap gap-1.5">
                            {cand.certifications.split(",").map((cert, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] flex items-center gap-1"
                              >
                                <ShieldCheck className="w-3 h-3 text-[var(--accent-color)]" />
                                <span>{cert.trim()}</span>
                              </span>
                            ))}
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[var(--bg-card)] text-[var(--text-secondary)]">
                              {cand.language_skills}
                            </span>
                          </div>

                          {/* Scheduled interview info if exists */}
                          {cand.interviews && cand.interviews.length > 0 && (
                            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 space-y-1">
                              <div className="font-bold flex items-center gap-1.5">
                                <Video className="w-3.5 h-3.5" />
                                <span>Interview Scheduled: {new Date(cand.interviews[0].scheduled_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at {new Date(cand.interviews[0].scheduled_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                              {cand.interviews[0].meeting_link && (
                                <a
                                  href={cand.interviews[0].meeting_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline pt-0.5"
                                >
                                  <span>Open Video Meeting</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          )}

                          {/* Action button */}
                          <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between">
                            <span className="text-[11px] text-[var(--text-secondary)]">
                              Shortlisted by RekrySilta
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setCandidateToSchedule(cand);
                                setIsScheduleOpen(true);
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                            >
                              <CalendarCheck2 className="w-3.5 h-3.5" />
                              <span>Schedule Interview</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center rounded-xl bg-[var(--bg-secondary)]/40 border border-dashed border-[var(--border-color)] space-y-2">
                      <Users className="w-8 h-8 text-[var(--text-secondary)] mx-auto opacity-50" />
                      <h4 className="text-sm font-bold text-[var(--text-primary)]">
                        Active Sourcing in Progress
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
                        Our recruitment team is screening candidates matching the TES {viewingRequisition.tes_category} grade and safety card specifications.
                      </p>
                      <div className="pt-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          <Clock className="w-3 h-3" />
                          <span>Expected shortlist: 24 - 48 Hours</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {requisitions.map((req) => {
                const percent = Math.round((req.fulfilled_count / req.vacancies_count) * 100);
                const isSelected = selectedReqForCandidates === req.id;

                return (
                  <div
                    key={req.id}
                    onClick={() => handleOpenDetails(req)}
                    className={`p-5 rounded-2xl bg-[var(--bg-card)] border cursor-pointer transition-all flex flex-col justify-between hover:shadow-md hover:border-[var(--accent-color)] ${
                      isSelected
                        ? "border-[var(--accent-color)] shadow-sm ring-1 ring-[var(--accent-ring)]"
                        : "border-[var(--border-color)]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-bold">
                          {req.req_code}
                        </span>
                        {(() => {
                          const badge = getReqBadge(req.status, req.current_approval_step, req.total_approval_steps);
                          return (
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${badge.classes}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </div>

                      <h3 className="text-sm font-bold text-[var(--text-primary)] mt-3 line-clamp-1">
                        {req.role_title}
                      </h3>

                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mt-1">
                        <MapPin className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                        <span>{req.site_code} — {req.site_name.split(" ")[0]}</span>
                      </div>

                      <div className="text-[11px] text-[var(--text-secondary)] mt-3 space-y-1">
                        <div>TES: <strong className="text-[var(--text-primary)]">{req.tes_category}</strong></div>
                        <div>Shift: {req.shift_pattern}</div>
                        <div>Rate: {req.salary_range_eur_hr}</div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-[var(--text-secondary)]">Fulfillment</span>
                        <span className="font-bold text-[var(--text-primary)]">
                          {req.fulfilled_count} / {req.vacancies_count} Vacancies
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between mt-3 text-xs gap-2">
                        <span className="text-xs font-semibold text-[var(--accent-color)] flex items-center gap-1">
                          <span>{req.candidates_count} Matches</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetails(req);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                            req.status === "PENDING_INTERNAL_APPROVAL"
                              ? "bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-500/25"
                              : "bg-[var(--accent-color)] hover:bg-[var(--accent-hover)]"
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{req.status === "PENDING_INTERNAL_APPROVAL" ? "Review & Authorize" : "View Details"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* 4. SUB-VIEW: 2. CANDIDATE MATCHES */}
      {selectedSubTab === "m1.2_shortlist" && (
        <div className="space-y-4">
          {/* Requisition Scope Selector */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[var(--text-secondary)]">Requisition:</span>
              <select
                value={selectedReqForCandidates || 1}
                onChange={(e) => setSelectedReqForCandidates(Number(e.target.value))}
                className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] focus:outline-none"
              >
                {requisitions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.req_code} — {r.role_title} ({r.site_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-[var(--text-secondary)]">
              Showing candidates shortlisted by RekrySilta agency algorithm
            </div>
          </div>

          {/* Candidate Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {candidates.map((cand) => (
              <div
                key={cand.id}
                className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col justify-between space-y-4 hover:border-[var(--accent-color)] transition-all"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--accent-color)] text-white font-bold flex items-center justify-center text-sm shadow-sm">
                        {cand.full_name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">
                          {cand.full_name}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                          <span>{cand.nationality}</span>
                          <span>•</span>
                          <span>{cand.current_location}</span>
                        </div>
                      </div>
                    </div>

                    {/* Finnish AI Match Score Badge */}
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        <Award className="w-3.5 h-3.5" />
                        <span>{cand.match_percentage}% Match</span>
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                        {cand.tes_grade}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] mt-3 leading-relaxed">
                    {cand.summary}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {cand.certifications.split(",").map((cert, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] flex items-center gap-1"
                      >
                        <ShieldCheck className="w-3 h-3 text-[var(--accent-color)]" />
                        <span>{cert.trim()}</span>
                      </span>
                    ))}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                      {cand.language_skills}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      cand.status === "OFFER_ACCEPTED"
                        ? "bg-purple-500/10 text-purple-600"
                        : cand.status === "INTERVIEW_SCHEDULED"
                        ? "bg-blue-500/10 text-blue-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {cand.status.replace("_", " ")}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setCandidateToSchedule(cand);
                      setIsScheduleOpen(true);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <CalendarCheck2 className="w-3.5 h-3.5" />
                    <span>Schedule Interview</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. SUB-VIEW: 3. INTERVIEW SCHEDULE */}
      {selectedSubTab === "m1.2_interviews" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {interviews.map((slot) => {
              const dt = new Date(slot.scheduled_at);
              const formattedDate = dt.toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const formattedTime = dt.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={slot.id}
                  className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          Online Video Interview
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          slot.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-blue-500/10 text-blue-600"
                        }`}
                      >
                        {slot.status}
                      </span>
                    </div>

                    <div className="mt-3">
                      <h4 className="text-base font-bold text-[var(--text-primary)]">
                        {slot.candidate_name}
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {slot.role_title}
                      </p>
                    </div>

                    <div className="mt-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-secondary)]">Time Slot:</span>
                        <strong className="text-[var(--text-primary)]">
                          {formattedDate} at {formattedTime}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-secondary)]">Interviewer:</span>
                        <span className="text-[var(--text-primary)] font-medium">
                          {slot.interviewer_name}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                    <a
                      href={slot.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl border border-[var(--border-color)] hover:border-[var(--accent-color)] text-xs font-semibold text-[var(--accent-color)] flex items-center gap-1.5 transition-all"
                    >
                      <span>Join Meeting Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setSlotToReview(slot);
                        setRating(slot.client_rating || 5);
                        setFeedbackText(slot.client_feedback || "");
                        setDecision(slot.decision || "RECOMMEND_HIRE");
                        setIsFeedbackOpen(true);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-[var(--accent-color)] text-white text-xs font-bold hover:bg-[var(--accent-hover)] transition-all shadow-sm"
                    >
                      {slot.status === "COMPLETED" ? "Edit Feedback" : "Submit Rating & Decision"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. SUB-VIEW: 4. NEW JOINING STATUS */}
      {selectedSubTab === "m1.2_relocation" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>
                RekrySilta handles end-to-end relocation and onboarding for new recruits: Migri Fast-Track, Finnish DVV identity registration, Tax cards (*Verohallinto*), and furnished company housing.
              </span>
            </div>
            <span className="font-bold underline cursor-pointer">Nordic Onboarding SLA: 21 Days</span>
          </div>

          <div className="space-y-4">
            {relocations.map((relo) => (
              <div
                key={relo.id}
                className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-[var(--text-primary)]">
                      {relo.candidate_name}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {relo.role_title} • Relocating from <strong>{relo.origin_country}</strong> to <strong>{relo.destination_city}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      {relo.current_phase.replace("_", " ")}
                    </span>
                    <div className="text-right text-xs">
                      <div className="text-[var(--text-secondary)]">Target Start:</div>
                      <div className="font-bold text-[var(--text-primary)]">{relo.plant_start_date}</div>
                    </div>
                  </div>
                </div>

                {/* 5-Step Finnish Relocation Stepper */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
                  {/* Step 1: Migri */}
                  <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                        1. Migri Permit
                      </span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {relo.migri_permit_status}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)]">Specialist fast-track</div>
                  </div>

                  {/* Step 2: DVV Identity */}
                  <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                        2. DVV Registration
                      </span>
                      {relo.dvv_registered ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {relo.dvv_registered ? "Registered (HETU)" : "Booked in Tampere"}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)]">Municipality of residence</div>
                  </div>

                  {/* Step 3: Tax Card */}
                  <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                        3. Verohallinto
                      </span>
                      {relo.tax_card_obtained ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {relo.tax_card_obtained ? "Tax Card Active" : "In Processing"}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)]">Withholding tax grade</div>
                  </div>

                  {/* Step 4: Bank Account */}
                  <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                        4. Finnish Bank
                      </span>
                      {relo.bank_account_opened ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {relo.bank_account_opened ? "OP / Nordea Active" : "Appointment Set"}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)]">Strong e-identification</div>
                  </div>

                  {/* Step 5: Housing & Induction */}
                  <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                        5. Housing & Site
                      </span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {relo.housing_arranged ? "Apartment Ready" : "Arranging"}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)]">Tampere center flat</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE REQUISITION */}
      {isCreateReqOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[var(--accent-color)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Create New Staffing Order
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateReqOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRequisition} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-[var(--text-primary)] block mb-1">
                    Job Role / Taxonomy Title *
                  </label>
                  <select
                    value={newReq.role_title}
                    onChange={(e) => setNewReq({ ...newReq, role_title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] font-medium focus:outline-none"
                  >
                    <option value="5-Axis CNC Machinist (Koneistaja)">5-Axis CNC Machinist (Koneistaja)</option>
                    <option value="MIG/MAG & TIG Welder (Hitsaaja)">MIG/MAG & TIG Welder (Hitsaaja)</option>
                    <option value="Industrial Electrician (Automaatioasentaja)">Industrial Electrician (Automaatioasentaja)</option>
                    <option value="Heavy Foundry Technician (Valimotyöntekijä)">Heavy Foundry Technician (Valimotyöntekijä)</option>
                    <option value="Hydraulics Maintenance Tech (Kunnossapito)">Hydraulics Maintenance Tech (Kunnossapito)</option>
                    <option value="Logistics & Forklift (Varastotyöntekijä)">Logistics & Forklift (Varastotyöntekijä)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[var(--text-primary)] block mb-1">
                    Target Plant Facility *
                  </label>
                  <select
                    value={allowedSites.length === 1 ? allowedSites[0].id : newReq.site_id}
                    disabled={allowedSites.length === 1}
                    onChange={(e) => setNewReq({ ...newReq, site_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] font-medium focus:outline-none disabled:opacity-75"
                  >
                    {allowedSites.length > 0 ? (
                      allowedSites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.site_code} — {s.site_name}
                        </option>
                      ))
                    ) : (
                      <option value={1}>TMP-01 — Tampere Heavy Machinery</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="font-bold text-[var(--text-primary)] block mb-1">
                    Finnish TES Grade *
                  </label>
                  <select
                    value={newReq.tes_category}
                    onChange={(e) => setNewReq({ ...newReq, tes_category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] font-medium focus:outline-none"
                  >
                    <option value="Teknologiateollisuus TVR 2">TVR 2 (Entry/Helper)</option>
                    <option value="Teknologiateollisuus TVR 3">TVR 3 (Skilled Trades)</option>
                    <option value="Teknologiateollisuus TVR 4">TVR 4 (Senior Specialist)</option>
                    <option value="Teknologiateollisuus TVR 5">TVR 5 (Master / Specialist)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[var(--text-primary)] block mb-1">
                    Headcount Vacancies *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={newReq.vacancies_count}
                    onChange={(e) => setNewReq({ ...newReq, vacancies_count: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] font-medium focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-[var(--text-primary)] block mb-1">
                    Target Start Date *
                  </label>
                  <input
                    type="date"
                    value={newReq.start_date}
                    onChange={(e) => setNewReq({ ...newReq, start_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] font-medium focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-[var(--text-primary)] block mb-1">
                    Certifications Required
                  </label>
                  <input
                    type="text"
                    value={newReq.required_certifications}
                    onChange={(e) => setNewReq({ ...newReq, required_certifications: e.target.value })}
                    placeholder="e.g. Työturvallisuuskortti, Tulityökortti"
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] font-medium focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-[var(--text-primary)] block mb-1">
                    Shift Pattern
                  </label>
                  <select
                    value={newReq.shift_pattern}
                    onChange={(e) => setNewReq({ ...newReq, shift_pattern: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] font-medium focus:outline-none"
                  >
                    <option value="Päivätyö (Day Shift)">Päivätyö (Day Shift)</option>
                    <option value="2-vuorotyö (Day/Evening)">2-vuorotyö (Day/Evening)</option>
                    <option value="3-vuorotyö (Continuous)">3-vuorotyö (Continuous)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-[var(--text-primary)] block mb-1">
                  Specific Requirements & Plant Cell Details
                </label>
                <textarea
                  rows={3}
                  value={newReq.notes}
                  onChange={(e) => setNewReq({ ...newReq, notes: e.target.value })}
                  placeholder="Specify machinery, CAM software, safety equipment, or specific plant shift timings..."
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] font-medium focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[var(--border-color)] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateReqOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] font-bold hover:bg-[var(--bg-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 rounded-xl bg-[var(--accent-color)] text-white font-bold hover:bg-[var(--accent-hover)] shadow-sm"
                >
                  {isLoading ? "Posting Order..." : "Submit Staffing Requisition"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SCHEDULE INTERVIEW */}
      {isScheduleOpen && candidateToSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarCheck2 className="w-5 h-5 text-[var(--accent-color)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Schedule Video Interview
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleScheduleInterview} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                <div className="font-bold text-[var(--text-primary)]">
                  {candidateToSchedule.full_name}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  {candidateToSchedule.tes_grade} • {candidateToSchedule.match_percentage}% Match
                </div>
              </div>

              <div>
                <label className="font-bold text-[var(--text-primary)] block mb-1">
                  Interview Date & Time *
                </label>
                <input
                  type="datetime-local"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-[var(--text-primary)] block mb-1">
                  Interviewer Name *
                </label>
                <input
                  type="text"
                  value={interviewerName}
                  onChange={(e) => setInterviewerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] font-medium focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 text-[11px]">
                A secure Microsoft Teams / Google Meet link will be automatically generated and sent to both the client interviewer and candidate.
              </div>

              <div className="pt-3 border-t border-[var(--border-color)] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsScheduleOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] font-bold hover:bg-[var(--bg-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 rounded-xl bg-[var(--accent-color)] text-white font-bold hover:bg-[var(--accent-hover)] shadow-sm"
                >
                  {isLoading ? "Booking..." : "Confirm & Send Invites"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SUBMIT FEEDBACK & DECISION */}
      {isFeedbackOpen && slotToReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Interview Evaluation & Decision
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFeedbackOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitFeedback} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                <div className="font-bold text-[var(--text-primary)]">
                  {slotToReview.candidate_name}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  {slotToReview.role_title}
                </div>
              </div>

              {/* Star Rating */}
              <div>
                <label className="font-bold text-[var(--text-primary)] block mb-1">
                  Client Technical Rating
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 text-amber-500 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= rating ? "fill-amber-500 text-amber-500" : "text-slate-300"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="font-bold text-[var(--text-primary)] ml-2">
                    {rating} / 5 Stars
                  </span>
                </div>
              </div>

              {/* Hiring Decision */}
              <div>
                <label className="font-bold text-[var(--text-primary)] block mb-1">
                  Hiring Decision *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecision("RECOMMEND_HIRE")}
                    className={`py-2 px-2 rounded-xl font-bold border transition-all text-center ${
                      decision === "RECOMMEND_HIRE"
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-600"
                        : "border-[var(--border-color)] text-[var(--text-secondary)]"
                    }`}
                  >
                    Recommend Hire
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision("SECOND_ROUND")}
                    className={`py-2 px-2 rounded-xl font-bold border transition-all text-center ${
                      decision === "SECOND_ROUND"
                        ? "bg-blue-500/15 border-blue-500 text-blue-600"
                        : "border-[var(--border-color)] text-[var(--text-secondary)]"
                    }`}
                  >
                    2nd Round
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision("DECLINE")}
                    className={`py-2 px-2 rounded-xl font-bold border transition-all text-center ${
                      decision === "DECLINE"
                        ? "bg-rose-500/15 border-rose-500 text-rose-600"
                        : "border-[var(--border-color)] text-[var(--text-secondary)]"
                    }`}
                  >
                    Decline
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="font-bold text-[var(--text-primary)] block mb-1">
                  Supervisor Assessment Notes
                </label>
                <textarea
                  rows={3}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Evaluate technical precision, drawings reading, Finnish/English proficiency, and culture fit..."
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] font-medium focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[var(--border-color)] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFeedbackOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] font-bold hover:bg-[var(--bg-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 rounded-xl bg-[var(--accent-color)] text-white font-bold hover:bg-[var(--accent-hover)] shadow-sm"
                >
                  {isLoading ? "Saving..." : "Submit Evaluation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
