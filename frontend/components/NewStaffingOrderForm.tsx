"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Calendar,
  MapPin,
  Clock,
  Euro,
  Globe2,
  ShieldCheck,
  Building2,
  Home,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  X,
  Sparkles,
  Plane,
  CreditCard,
  Languages,
  Briefcase
} from "lucide-react";
import { RequisitionItem } from "./TalentAcquisitionModule";

interface NewStaffingOrderFormProps {
  clientId: number;
  companyName: string;
  onCancel: () => void;
  onSubmitSuccess: (createdReq: RequisitionItem) => void;
  defaultSiteId?: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Rich Industry Domain dictionary with keywords & Finnish operational subtext
export interface IndustryDomainItem {
  id: string;
  label: string;
  sub: string;
  keywords: string[];
}

export const INDUSTRY_DOMAIN_SUGGESTIONS: IndustryDomainItem[] = [
  {
    id: "manufacturing",
    label: "Manufacturing Industry",
    sub: "Konepaja, kokoonpano, tuotanto",
    keywords: ["manufacturing", "manu", "production", "industry", "konepaja", "kokoonpano", "tuotanto", "factory", "assembly", "plant"],
  },
  {
    id: "cnc_machining",
    label: "CNC Machining & Tooling",
    sub: "CNC-koneistus, sorvaus, jyrsintä, CAM",
    keywords: ["cnc", "machining", "koneistus", "sorvaus", "jyrsintä", "milling", "lathe", "tooling", "fanuc", "heidenhain", "siemens"],
  },
  {
    id: "welding",
    label: "Welding & Steel Fabrication",
    sub: "Hitsaus (MIG/MAG, TIG), levysepät, teräsrakenteet",
    keywords: ["welding", "welder", "hitsaus", "hitsaaja", "mig", "mag", "tig", "steel", "teräs", "fabrication", "levyseppä"],
  },
  {
    id: "logistics",
    label: "Logistics & Supply Chain",
    sub: "Varasto, trukkityö, keräily, terminaali",
    keywords: ["logistics", "supply chain", "warehouse", "varasto", "trukki", "forklift", "keräily", "picking", "dispatch"],
  },
  {
    id: "maintenance",
    label: "Maintenance & Industrial Automation",
    sub: "Kunnossapito, sähkö, automaatio, mekatroniikka",
    keywords: ["maintenance", "kunnossapito", "sähkö", "electrical", "automation", "automaatio", "repair", "service", "mekatroniikka"],
  },
  {
    id: "construction",
    label: "Construction & Civil Engineering",
    sub: "Rakennus, muuraus, raudoitus, purkutyö",
    keywords: ["construction", "building", "rakennus", "rakennustyö", "civil", "muuraus", "raudoitus", "purku", "kirvesmies"],
  },
  {
    id: "engineering",
    label: "Engineering, R&D & Tech / ICT",
    sub: "Suunnittelu, mekaniikka, ohjelmointi, sulautetut",
    keywords: ["engineering", "tech", "ict", "suunnittelu", "software", "cad", "solidworks", "it", "kehitys"],
  },
  {
    id: "cleanroom",
    label: "Cleanroom & High-Tech Manufacturing",
    sub: "Puhdastila, elektroniikka, puolijohde, optiikka",
    keywords: ["cleanroom", "puhdastila", "electronics", "elektroniikka", "semiconductor", "micro", "high-tech"],
  },
  {
    id: "food_industry",
    label: "Food Industry & Processing",
    sub: "Elintarviketeollisuus, leipomo, pakkaus, hygienia",
    keywords: ["food", "elintarvike", "leipomo", "processing", "hygienia", "hygieniapassi", "packaging", "pakkaus"],
  },
  {
    id: "hospitality",
    label: "Hospitality & Catering Services",
    sub: "Ravintola, kokki, tarjoilu, suurtalouskeittiö",
    keywords: ["hospitality", "restaurant", "catering", "ravintola", "kokki", "chef", "tarjoilu", "keittiö", "hotel"],
  },
  {
    id: "healthcare",
    label: "Healthcare & Social Care",
    sub: "Hoiva, sairaanhoito, vanhustenhoito, Valvira",
    keywords: ["healthcare", "hoiva", "sairaanhoito", "nursing", "nurse", "care", "valvira", "lähihoitaja", "sairaanhoitaja"],
  },
  {
    id: "facility_services",
    label: "Facility Management & Industrial Cleaning",
    sub: "Kiinteistöpalvelut, teollisuussiivous, huolto",
    keywords: ["facility", "cleaning", "siivous", "kiinteistö", "huolto", "teollisuussiivous", "property", "maintenance"],
  },
  {
    id: "commercial_sales",
    label: "Commercial, Purchasing & Office",
    sub: "Myynti, tekninen kauppa, hankinta, hallinto",
    keywords: ["commercial", "office", "sales", "myynti", "purchasing", "hankinta", "toimisto", "admin", "b2b"],
  },
  {
    id: "energy_environmental",
    label: "Energy & Environmental Tech",
    sub: "Energia, tuulivoima, aurinko, kierrätys",
    keywords: ["energy", "energia", "wind", "tuulivoima", "solar", "aurinko", "recycling", "kierrätys", "environmental"],
  },
];

// Staffing Contract Model dictionary with Finnish operational models
export interface StaffingModelOption {
  id: string;
  label: string;
  sub: string;
  keywords: string[];
}

export const STAFFING_MODEL_SUGGESTIONS: StaffingModelOption[] = [
  {
    id: "temp_agency",
    label: "Vuokratyö (Agency Staffing)",
    sub: "Joustava henkilöstövuokraus tuotantohuippuihin",
    keywords: ["vuokratyö", "agency", "temp", "vuokra", "staffing", "henkilöstövuokraus"]
  },
  {
    id: "temp_to_perm",
    label: "Temp-to-Perm (6m Trial Hire)",
    sub: "Vuokratyö kokeilujaksolla, optio vakinaistamiseen",
    keywords: ["temp-to-perm", "trial", "kokeilu", "vakinaistaminen", "perm", "koe"]
  },
  {
    id: "direct_hire",
    label: "Direct Hire (Permanent Sourcing)",
    sub: "Suorarekrytointi suoraan asiakasyrityksen kirjoille",
    keywords: ["direct", "hire", "suora", "rekrytointi", "permanent", "vakituinen"]
  },
  {
    id: "fixed_term",
    label: "Määräaikainen (Fixed-Term Project)",
    sub: "Sesonkityö, projekti tai määräaikainen tilauskanta",
    keywords: ["määräaikainen", "fixed", "term", "projekti", "sesonki", "kausi"]
  },
  {
    id: "part_time",
    label: "Part-Time / Osa-aikainen",
    sub: "Osa-aikainen työsuhde (20–30h / viikko)",
    keywords: ["part-time", "osa-aika", "osa-aikainen", "tunnit", "keikkatyö"]
  },
  {
    id: "summer",
    label: "Summer Trainee / Kesätyö",
    sub: "Kesätyöntekijä tai opiskelijaharjoittelu",
    keywords: ["summer", "kesätyö", "harjoittelu", "trainee", "kesä"]
  },
  {
    id: "subcontract",
    label: "Subcontracting / Alihankinta",
    sub: "Laskutussopimus tai erikoisurakointi",
    keywords: ["subcontracting", "alihankinta", "urakka", "laskutus", "b2b"]
  }
];

export const STAFFING_MODEL_CHIPS = [
  { id: "vuokra", name: "Vuokratyö", fi: "Agency Staffing", full: "Vuokratyö (Agency Staffing)" },
  { id: "trial", name: "Temp-to-Perm", fi: "6m Trial Hire", full: "Temp-to-Perm (6m Trial Hire)" },
  { id: "direct", name: "Direct Hire", fi: "Permanent", full: "Direct Hire (Permanent Sourcing)" },
  { id: "fixed", name: "Määräaikainen", fi: "Fixed-Term", full: "Määräaikainen (Fixed-Term Project)" },
  { id: "part", name: "Osa-aikainen", fi: "Part-Time", full: "Part-Time / Osa-aikainen" }
];

// Common global & European languages in Finnish industry
export const COMMON_LANGUAGES = [
  "English",
  "Finnish",
  "Swedish",
  "Estonian",
  "Polish",
  "Ukrainian",
  "German",
  "Spanish",
  "Russian",
  "Romanian",
  "French",
  "Italian",
  "Tagalog",
  "Hindi",
  "Vietnamese",
  "Turkish",
  "Arabic",
  "Portuguese"
];

// Proficiency levels for language requirements
export interface ProficiencyLevel {
  id: string;
  title: string;
  fi: string;
  desc: string;
}

export const PROFICIENCY_LEVELS: ProficiencyLevel[] = [
  { id: "native", title: "Native / Mother Tongue", fi: "Äidinkieli / Kaksikielinen", desc: "First language proficiency" },
  { id: "fluent", title: "Fluent / Professional (C1/C2)", fi: "Sujuva ammattitaito", desc: "Full workplace & technical fluency" },
  { id: "conversational", title: "Conversational / Working (B1/B2)", fi: "Kohtalainen työkieli", desc: "Sufficient for daily shopfloor coordination" },
  { id: "basic", title: "Basic / Beginner (A1/A2)", fi: "Alkeet / Perustaso", desc: "Basic phrases and safety instructions" },
  { id: "english_ok", title: "Plant Standard / English OK", fi: "Tehdasstandardi", desc: "English sufficient, Finnish not mandatory" }
];

// Sponsored Global Relocation Benefits
export const SPONSORED_BENEFITS_CATALOG = [
  {
    id: "housing",
    title: "On-Arrival Furnished Accommodation",
    sub: "Sponsored apartment for 1–3 months upon arrival",
    icon: Home
  },
  {
    id: "visa",
    title: "Migri Visa & Residence Permit Fees",
    sub: "Direct payment of official Migri fast-track D-visa fees",
    icon: ShieldCheck
  },
  {
    id: "flight",
    title: "Flight Ticket & Arrival Airport Pickup",
    sub: "Sponsored flight to Helsinki/Tampere & plant transit",
    icon: Plane
  },
  {
    id: "dvv",
    title: "DVV & Finnish Tax Card Registration",
    sub: "Expedited personal identity code & Vero tax card setup",
    icon: Building2
  },
  {
    id: "banking",
    title: "Finnish Bank Account Concierge",
    sub: "Local branch bank appointment and account opening",
    icon: CreditCard
  },
  {
    id: "integration",
    title: "Workplace Finnish & Integration Training",
    sub: "Safety Finnish terminology & orientation course",
    icon: Languages
  }
];

// Finnish statutory occupational cards
const STATUTORY_CARDS = [
  { id: "safety", label: "Työturvallisuuskortti", sub: "Green Safety Card" },
  { id: "hotwork", label: "Tulityökortti", sub: "Hot Work Card" },
  { id: "forklift", label: "Trukkikortti", sub: "Forklift License" },
  { id: "crane", label: "Siltanosturi", sub: "Overhead Crane" },
  { id: "firstaid", label: "Ensiapu EA1", sub: "First Aid License" },
  { id: "electrical", label: "SFS 6002", sub: "Electrical Safety" }
];

export const NewStaffingOrderForm: React.FC<NewStaffingOrderFormProps> = ({
  clientId,
  companyName,
  onCancel,
  onSubmitSuccess,
  defaultSiteId = 1,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // =========================================================================
  // STATE: CORE POSITION & NEED
  // =========================================================================
  const [roleTitle, setRoleTitle] = useState("");
  const [sector, setSector] = useState("");
  const [isSectorDropdownOpen, setIsSectorDropdownOpen] = useState(false);
  const sectorDropdownRef = useRef<HTMLDivElement>(null);

  // Filter job category based on input keyword (only when user has typed something)
  const filteredSectors = useMemo(() => {
    const query = sector.trim().toLowerCase();
    if (!query) return [];
    return INDUSTRY_DOMAIN_SUGGESTIONS.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.sub.toLowerCase().includes(query) ||
        item.keywords.some((kw) => kw.toLowerCase().includes(query))
    );
  }, [sector]);

  // Available Positions & Joining Period
  const [vacancies, setVacancies] = useState<number>(1);
  const [joiningPeriod, setJoiningPeriod] = useState("");

  // Staffing Contract Model text input + suggestions
  const [staffingModel, setStaffingModel] = useState("Vuokratyö (Agency Staffing)");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const filteredModels = useMemo(() => {
    const query = staffingModel.trim().toLowerCase();
    if (!query) return STAFFING_MODEL_SUGGESTIONS;
    return STAFFING_MODEL_SUGGESTIONS.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.sub.toLowerCase().includes(query) ||
        item.keywords.some((kw) => kw.toLowerCase().includes(query))
    );
  }, [staffingModel]);

  // Workplace Location
  const [workplaceAddress, setWorkplaceAddress] = useState("Lentokentänkatu 11");
  const [city, setCity] = useState("Tampere");
  const [targetStartDate, setTargetStartDate] = useState("2026-12-01");

  // Multi-Select Shift Schedule Models
  const [selectedShifts, setSelectedShifts] = useState<string[]>(["day", "2shift"]);
  const [customHours, setCustomHours] = useState("");

  const toggleShift = (shiftId: string) => {
    setSelectedShifts((prev) =>
      prev.includes(shiftId)
        ? prev.length > 1
          ? prev.filter((s) => s !== shiftId)
          : prev // keep at least one
        : [...prev, shiftId]
    );
  };

  // Compensation: Hourly vs Monthly
  const [salaryType, setSalaryType] = useState<"hourly" | "monthly">("hourly");
  const [rateMin, setRateMin] = useState<number>(17.50);
  const [rateMax, setRateMax] = useState<number>(21.00);
  const [hasTesAllowance, setHasTesAllowance] = useState(true);

  const [monthlyMin, setMonthlyMin] = useState<number>(2800);
  const [monthlyMax, setMonthlyMax] = useState<number>(3400);
  const [monthlyHours, setMonthlyHours] = useState<string>("37.5");

  // Experience & Safety Cards
  const [experienceLevel, setExperienceLevel] = useState<"junior" | "mid" | "senior" | "lead">("mid");
  const [selectedCards, setSelectedCards] = useState<string[]>(["safety"]);

  // Candidate Origin & Sponsored Global Benefits
  const [candidateOrigin, setCandidateOrigin] = useState<"global_fast_track" | "eu_local_only">(
    "global_fast_track"
  );
  const [sponsoredBenefits, setSponsoredBenefits] = useState<string[]>([
    "On-Arrival Furnished Accommodation",
    "Migri Visa & Residence Permit Fees",
    "Flight Ticket & Arrival Airport Pickup",
    "DVV & Finnish Tax Card Registration"
  ]);
  const [customBenefitInput, setCustomBenefitInput] = useState("");

  const toggleBenefit = (benefitTitle: string) => {
    setSponsoredBenefits((prev) =>
      prev.includes(benefitTitle)
        ? prev.filter((b) => b !== benefitTitle)
        : [...prev, benefitTitle]
    );
  };

  const addCustomBenefit = () => {
    if (!customBenefitInput.trim()) return;
    if (!sponsoredBenefits.includes(customBenefitInput.trim())) {
      setSponsoredBenefits((prev) => [...prev, customBenefitInput.trim()]);
    }
    setCustomBenefitInput("");
  };

  const [housingRequired, setHousingRequired] = useState(true);

  // Multi-Language with Expertise Level Popup
  interface LanguageItem {
    id: string;
    language: string;
    level: string;
  }
  const [languages, setLanguages] = useState<LanguageItem[]>([
    { id: "lang-1", language: "English", level: "Fluent / Professional (C1/C2)" },
    { id: "lang-2", language: "Finnish", level: "Conversational / Working (B1/B2)" }
  ]);
  const [langInput, setLangInput] = useState("");
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<string | null>(null);
  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  const filteredLanguages = useMemo(() => {
    const q = langInput.trim().toLowerCase();
    if (!q) return COMMON_LANGUAGES;
    return COMMON_LANGUAGES.filter((l) => l.toLowerCase().includes(q));
  }, [langInput]);

  const handleStartAddLanguage = (langName: string) => {
    setPendingLanguage(langName);
    setIsLevelModalOpen(true);
    setIsLangDropdownOpen(false);
  };

  const handleConfirmLanguageLevel = (levelTitle: string) => {
    if (!pendingLanguage) return;
    const existingIndex = languages.findIndex(
      (l) => l.language.toLowerCase() === pendingLanguage.toLowerCase()
    );
    if (existingIndex >= 0) {
      setLanguages((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex ? { ...item, level: levelTitle } : item
        )
      );
    } else {
      setLanguages((prev) => [
        ...prev,
        { id: `lang-${Date.now()}`, language: pendingLanguage, level: levelTitle }
      ]);
    }
    setPendingLanguage(null);
    setIsLevelModalOpen(false);
    setLangInput("");
  };

  const removeLanguage = (id: string) => {
    setLanguages((prev) => prev.filter((l) => l.id !== id));
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (sectorDropdownRef.current && !sectorDropdownRef.current.contains(target)) {
        setIsSectorDropdownOpen(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(target)) {
        setIsModelDropdownOpen(false);
      }
      if (langDropdownRef.current && !langDropdownRef.current.contains(target)) {
        setIsLangDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Responsibilities & Skills Tags
  const [responsibilities, setResponsibilities] = useState<string[]>([
    "Execute daily production tasks in accordance with plant quality guidelines",
    "Perform dimension verification and safety checks",
    "Maintain workstation 5S cleanliness and routine maintenance"
  ]);
  const [newRespInput, setNewRespInput] = useState("");

  const [skillTags, setSkillTags] = useState<string[]>(["Technical Drawings", "Tool Setup", "Quality Control"]);
  const [newSkillInput, setNewSkillInput] = useState("");

  // Handlers
  const toggleCard = (cardId: string) => {
    setSelectedCards((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  const addResponsibility = () => {
    if (!newRespInput.trim()) return;
    setResponsibilities((prev) => [...prev, newRespInput.trim()]);
    setNewRespInput("");
  };

  const removeResponsibility = (idx: number) => {
    setResponsibilities((prev) => prev.filter((_, i) => i !== idx));
  };

  const addSkillTag = () => {
    if (!newSkillInput.trim()) return;
    if (!skillTags.includes(newSkillInput.trim())) {
      setSkillTags((prev) => [...prev, newSkillInput.trim()]);
    }
    setNewSkillInput("");
  };

  const removeSkillTag = (tag: string) => {
    setSkillTags((prev) => prev.filter((t) => t !== tag));
  };

  // Submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTitle.trim()) {
      setErrorMsg("Please enter the Job Title / Role you wish to recruit.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const shiftDescriptions: Record<string, string> = {
        day: "Day Shift (37.5h, 07:00–15:30)",
        "2shift": "2-Shift (40h/w: A/I-Vuoro)",
        "3shift": "3-Shift (114.75h/3w: A/I/Y-Vuoro)",
        flexible: "Flexible Hours (Liukuva työaika)"
      };

      const resolvedShiftPattern = selectedShifts
        .map((s) => shiftDescriptions[s] || s)
        .join(" + ") + (customHours ? ` [Custom Hours: ${customHours}]` : "");

      const resolvedSalaryText =
        salaryType === "hourly"
          ? `${rateMin.toFixed(2)} - ${rateMax.toFixed(2)} €/h`
          : `${monthlyMin} - ${monthlyMax} €/mo (${monthlyHours}h/wk)`;

      const originText =
        candidateOrigin === "global_fast_track"
          ? `Global Fast-Track (Sponsored Benefits: ${sponsoredBenefits.join(", ")})`
          : "EU/EEA & Local Residents Only";

      const languageText = languages.map((l) => `${l.language} (${l.level})`).join(", ");

      const comprehensiveNotes = [
        `Joining Period: ${joiningPeriod || "Standard (30 days)"}`,
        `Model: ${staffingModel}`,
        `Location: ${workplaceAddress}, ${city}`,
        `Compensation: ${resolvedSalaryText} ${salaryType === "hourly" && hasTesAllowance ? "(+ TES Shift Allowances)" : ""}`,
        `Shifts: ${resolvedShiftPattern}`,
        `Experience: ${experienceLevel.toUpperCase()}`,
        `Languages: ${languageText}`,
        `Housing: ${housingRequired ? "Furnished Company Housing Required" : "By Candidate"}`,
        `Candidate Origin: ${originText}`,
        `Certifications: ${selectedCards.join(", ")}`,
        `Must-have Skills: ${skillTags.join(", ")}`,
        `Key Tasks: ${responsibilities.join("; ")}`
      ].join(" | ");

      const payload = {
        client_id: clientId,
        site_id: defaultSiteId,
        role_title: roleTitle.trim(),
        tes_category: sector,
        vacancies_count: vacancies,
        experience_years_required: experienceLevel === "junior" ? 1 : experienceLevel === "mid" ? 3 : 5,
        required_certifications: selectedCards.join(", "),
        shift_pattern: resolvedShiftPattern,
        salary_range_eur_hr: resolvedSalaryText,
        start_date: targetStartDate || new Date().toISOString().split("T")[0],
        notes: comprehensiveNotes
      };

      const res = await fetch(`${API_BASE}/api/client/requisitions/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Failed to dispatch staffing order (HTTP ${res.status})`);
      }

      const resData = await res.json();
      const created = resData.requisition || {};

      const formattedRequisition: RequisitionItem = {
        id: created.id || Date.now(),
        req_code: created.req_code || `REQ-${Date.now().toString().slice(-4)}`,
        client_id: clientId,
        site_id: defaultSiteId,
        site_name: `${workplaceAddress}, ${city}`,
        site_code: city.slice(0, 3).toUpperCase(),
        role_title: roleTitle.trim(),
        tes_category: sector,
        vacancies_count: vacancies,
        fulfilled_count: 0,
        experience_years_required: experienceLevel === "junior" ? 1 : experienceLevel === "mid" ? 3 : 5,
        required_certifications: selectedCards.join(", "),
        shift_pattern: resolvedShiftPattern,
        salary_range_eur_hr: resolvedSalaryText,
        start_date: targetStartDate || new Date().toISOString().split("T")[0],
        notes: comprehensiveNotes,
        status: created.status || (created.released_to_agency_at ? "RELEASED_TO_AGENCY" : "PENDING_INTERNAL_APPROVAL"),
        current_approval_step: created.current_approval_step || 1,
        total_approval_steps: created.total_approval_steps || 1,
        approval_history: created.approval_history || [],
        candidates_count: 0,
        created_at: created.created_at || new Date().toISOString()
      };

      onSubmitSuccess(formattedRequisition);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error dispatching staffing request";
      setErrorMsg(msg);
      setIsSubmitting(false);
    }
  };

  // Estimated Client Invoice Multipliers (hourly & monthly)
  const estClientBillingRate = Math.round(((rateMin + rateMax) / 2) * 1.78 * 10) / 10;
  const estMonthlyBillingRate = Math.round(((monthlyMin + monthlyMax) / 2) * 1.78);

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[1440px] mx-auto space-y-5 pb-32 px-1 sm:px-3">
      {/* 1. TOP EXECUTIVE LANDSCAPE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onCancel}
            className="p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:border-blue-400 transition-all shrink-0"
            title="Return to Requisitions"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Client Staffing Order
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Landscape Tiled View
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Specify your manpower requirement. Pre-screened candidates dispatched within 48 hours under Nordic SLA.
            </p>
          </div>
        </div>

        {/* Company Context Card */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs self-start md:self-auto">
          <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <div>
            <span className="font-bold text-slate-900 dark:text-white block">{companyName}</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Client Workspace • Y-tunnus: 2516487-1</span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* =========================================================================
          2. LANDSCAPE BENTO-GRID TILED LAYOUT (Fully Responsive: Mobile -> Tablet -> Desktop)
         ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* =======================================================================
            TILE 1: ROLE TITLE & INDUSTRY SECTOR (Col 7 on Desktop)
           ======================================================================= */}
        <div className="lg:col-span-7 p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Target Position & Sector
                </h2>
              </div>
              <span className="text-[10px] font-bold text-rose-500">* Mandatory</span>
            </div>

            {/* Role Title Input */}
            <div className="mt-4">
              <label htmlFor="roleTitleInput" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Job Title / Role to Recruit <span className="text-rose-500">*</span>
              </label>
              <input
                id="roleTitleInput"
                type="text"
                required
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. CNC Machinist, Industrial Welder, Warehouse Specialist, Maintenance Electrician..."
                className="w-full px-4 py-3 text-sm font-bold rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0f172a] text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-normal focus:bg-white dark:focus:bg-[#0f172a] focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Job Category with Keyword Matching & Live Suggestions Dropdown (Only shown when typing) */}
          <div className="relative" ref={sectorDropdownRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="sectorInput" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Job Category <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                Type keywords to see matching categories
              </span>
            </div>

            {/* Text Input with Search Icon and Clear button */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Building2 className="w-4 h-4 text-blue-500" />
              </div>
              <input
                id="sectorInput"
                type="text"
                required
                value={sector}
                onFocus={() => {
                  if (sector.trim().length > 0) setIsSectorDropdownOpen(true);
                }}
                onChange={(e) => {
                  setSector(e.target.value);
                  setIsSectorDropdownOpen(e.target.value.trim().length > 0);
                }}
                placeholder="Type job category (e.g. Manu, Logistics, CNC, Welding, Sähkö...)"
                className="w-full pl-10 pr-10 py-3 text-sm font-semibold rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0f172a] text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-normal focus:bg-white dark:focus:bg-[#0f172a] focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
              />
              {sector && (
                <button
                  type="button"
                  onClick={() => {
                    setSector("");
                    setIsSectorDropdownOpen(false);
                  }}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  title="Clear input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Live Autocomplete Suggestion Dropdown - ONLY shown when user started typing */}
            {isSectorDropdownOpen && sector.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.7)] p-2 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5">
                <div className="px-3 py-1.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    <span>
                      {filteredSectors.length > 0
                        ? `${filteredSectors.length} MATCHING CATEGORIES`
                        : "NO PRESET MATCH FOUND"}
                    </span>
                  </span>
                  <span>Click to apply</span>
                </div>

                <div className="mt-1 space-y-1">
                  {filteredSectors.map((s) => {
                    const isSelected = sector.trim().toLowerCase() === s.label.toLowerCase();
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSector(s.label);
                          setIsSectorDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between group ${
                          isSelected
                            ? "bg-blue-600 text-white font-bold shadow-sm"
                            : "hover:bg-blue-50 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                            <span>{s.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white inline" />}
                          </div>
                          <div
                            className={`text-[10px] mt-0.5 truncate ${
                              isSelected ? "text-blue-100" : "text-slate-400 dark:text-slate-400"
                            }`}
                          >
                            {s.sub}
                          </div>
                        </div>

                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 group-hover:text-blue-600"
                          }`}
                        >
                          Select
                        </span>
                      </button>
                    );
                  })}

                  {/* Option for custom entered text */}
                  {sector.trim() &&
                    !filteredSectors.some((s) => s.label.toLowerCase() === sector.trim().toLowerCase()) && (
                      <div className="p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/40 mt-1">
                        <div className="text-xs font-bold text-blue-700 dark:text-blue-300">
                          Custom Category: &quot;{sector.trim()}&quot;
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          This custom job category will be recorded on your staffing order.
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =======================================================================
            TILE 2: AVAILABLE POSITIONS, JOINING PERIOD & STAFFING MODEL (Col 5 on Desktop)
           ======================================================================= */}
        <div className="lg:col-span-5 p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Headcount & Model
                </h2>
              </div>
              <span className="text-[10px] font-bold text-rose-500">* Mandatory</span>
            </div>

            {/* Available Positions Stepper & Joining Period text input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Available Positions <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1">
                    <button
                      type="button"
                      onClick={() => setVacancies(Math.max(1, vacancies - 1))}
                      className="w-7 h-7 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-white font-bold flex items-center justify-center shadow-sm"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-sm font-black text-slate-900 dark:text-white">
                      {vacancies}
                    </span>
                    <button
                      type="button"
                      onClick={() => setVacancies(vacancies + 1)}
                      className="w-7 h-7 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-white font-bold flex items-center justify-center shadow-sm"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 5, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setVacancies(num)}
                        className={`px-2 py-1 rounded-xl text-xs font-bold transition-all ${
                          vacancies === num
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Joining Period Text Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Joining Period <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <input
                    type="text"
                    required
                    value={joiningPeriod}
                    onChange={(e) => setJoiningPeriod(e.target.value)}
                    placeholder="e.g. Immediate (<14d), Within 30d, Next month..."
                    className="w-full pl-9 pr-3 py-2 text-xs font-bold rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0f172a] text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-[#0f172a] focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Staffing Model: Text Input with Live Keyword Match Suggestions */}
          <div className="relative mt-2" ref={modelDropdownRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="staffingModelInput" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Staffing Contract Model <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                Type keywords or select below
              </span>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Briefcase className="w-4 h-4 text-blue-500" />
              </div>
              <input
                id="staffingModelInput"
                type="text"
                required
                value={staffingModel}
                onFocus={() => setIsModelDropdownOpen(true)}
                onChange={(e) => {
                  setStaffingModel(e.target.value);
                  setIsModelDropdownOpen(true);
                }}
                placeholder="e.g. Vuokratyö, Temp-to-Perm, Direct Hire, Fixed-Term, Part-time..."
                className="w-full pl-10 pr-10 py-2.5 text-xs font-bold rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0f172a] text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-[#0f172a] focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
              />
              {staffingModel && (
                <button
                  type="button"
                  onClick={() => {
                    setStaffingModel("");
                    setIsModelDropdownOpen(true);
                  }}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  title="Clear input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Live Autocomplete Dropdown for Contract Model */}
            {isModelDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.7)] p-2 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5">
                <div className="px-3 py-1.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400">
                  <span>{filteredModels.length} CONTRACT MODELS</span>
                  <span>Click to select</span>
                </div>
                <div className="mt-1 space-y-1">
                  {filteredModels.map((m) => {
                    const isSelected = staffingModel.trim().toLowerCase() === m.label.toLowerCase();
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setStaffingModel(m.label);
                          setIsModelDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl transition-all flex items-center justify-between group ${
                          isSelected
                            ? "bg-blue-600 text-white font-bold shadow-sm"
                            : "hover:bg-blue-50 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                            <span>{m.label}</span>
                            {isSelected && <Check className="w-3 h-3 text-white inline" />}
                          </div>
                          <div
                            className={`text-[10px] mt-0.5 truncate ${
                              isSelected ? "text-blue-100" : "text-slate-400"
                            }`}
                          >
                            {m.sub}
                          </div>
                        </div>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600"
                          }`}
                        >
                          Select
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick 1-Click Model Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {STAFFING_MODEL_CHIPS.map((chip) => {
                const isSelected = staffingModel.toLowerCase().includes(chip.name.toLowerCase());
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      setStaffingModel(chip.full);
                      setIsModelDropdownOpen(false);
                    }}
                    className={`text-xs px-2.5 py-1 rounded-xl border transition-all flex items-center gap-1 ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs font-bold"
                        : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:text-blue-600"
                    }`}
                  >
                    <span>{chip.name}</span>
                    <span className={`text-[9px] ${isSelected ? "text-blue-200" : "text-slate-400"}`}>
                      ({chip.fi})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* =======================================================================
            TILE 3: WORKPLACE LOCATION & SHIFT (Col 6 on Desktop)
           ======================================================================= */}
        <div className="lg:col-span-6 p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Workplace Location & Start Date
              </h2>
            </div>
            <span className="text-[10px] font-bold text-rose-500">* Mandatory</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <span>Workplace Address</span> <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={workplaceAddress}
                onChange={(e) => setWorkplaceAddress(e.target.value)}
                placeholder="e.g. Lentokentänkatu 11..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                City / Municipality <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Tampere, Jyväskylä..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Start Date & Multi-Select Shift pattern */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Target Joining Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={targetStartDate}
                  onChange={(e) => setTargetStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Shift Schedule Model <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                  (Multi-Select)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "day", label: "Day (37.5h)", tip: "07:00–15:30" },
                  { id: "2shift", label: "2-Shift", tip: "A/I-Vuoro" },
                  { id: "3shift", label: "3-Shift", tip: "A/I/Y-Vuoro" },
                  { id: "flexible", label: "Flexible", tip: "Liukuva" }
                ].map((p) => {
                  const isSelected = selectedShifts.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleShift(p.id)}
                      className={`p-2 rounded-xl text-left border transition-all flex items-center justify-between ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div>
                        <div className="text-[11px] font-bold leading-tight">{p.label}</div>
                        <div className={`text-[9px] ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                          {p.tip}
                        </div>
                      </div>
                      <div
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-white text-blue-600 border-white" : "border-slate-300 dark:border-slate-600"
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Optional custom hours text */}
              <div className="mt-2">
                <input
                  type="text"
                  value={customHours}
                  onChange={(e) => setCustomHours(e.target.value)}
                  placeholder="Optional custom shift hours / notes (e.g. 06:00-14:30 & 14:30-23:00)..."
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0f172a] text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* =======================================================================
            TILE 4: COMPENSATION & LIVE BILLING RATE (Col 6 on Desktop)
           ======================================================================= */}
        <div className="lg:col-span-6 p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                4
              </div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Worker Wage & Billing Structure
              </h2>
            </div>

            {/* Salary Mode Selector (Hourly vs Monthly) */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSalaryType("hourly")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  salaryType === "hourly"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                }`}
              >
                Hourly (€/h)
              </button>
              <button
                type="button"
                onClick={() => setSalaryType("monthly")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  salaryType === "monthly"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                }`}
              >
                Monthly Fixed (€/mo)
              </button>
            </div>
          </div>

          {/* Conditional Inputs: Hourly vs Monthly */}
          {salaryType === "hourly" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Worker Base Pay Min (€/h) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.25"
                    min="12.00"
                    max="50.00"
                    value={rateMin}
                    onChange={(e) => setRateMin(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white outline-none pl-7"
                  />
                  <Euro className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Worker Base Pay Max (€/h) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.25"
                    min={rateMin}
                    max="65.00"
                    value={rateMax}
                    onChange={(e) => setRateMax(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white outline-none pl-7"
                  />
                  <Euro className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Monthly Salary Min (€) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="50"
                    min="1800"
                    max="10000"
                    value={monthlyMin}
                    onChange={(e) => setMonthlyMin(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white outline-none pl-7"
                  />
                  <Euro className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Monthly Salary Max (€) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="50"
                    min={monthlyMin}
                    max="15000"
                    value={monthlyMax}
                    onChange={(e) => setMonthlyMax(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white outline-none pl-7"
                  />
                  <Euro className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contract Hours / Wk
                </label>
                <select
                  value={monthlyHours}
                  onChange={(e) => setMonthlyHours(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white outline-none"
                >
                  <option value="37.5">37.5 h / week (Standard)</option>
                  <option value="40.0">40.0 h / week (Industrial)</option>
                  <option value="30.0">30.0 h / week (Part-time)</option>
                  <option value="20.0">20.0 h / week (Half-time)</option>
                </select>
              </div>
            </div>
          )}

          {/* Live estimated agency billing card */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Estimated Client Invoice Rate (~1.78x Standard Factor)
              </span>
              <span className="text-base font-black text-slate-900 dark:text-white">
                {salaryType === "hourly"
                  ? `~${estClientBillingRate} € / hour`
                  : `~${estMonthlyBillingRate.toLocaleString()} € / month`}
              </span>
              <span className="text-[10px] text-slate-500 block">
                Includes TyEL pension, social costs, holiday accrual, and liability insurance
              </span>
            </div>

            <div className="text-right">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasTesAllowance}
                  onChange={(e) => setHasTesAllowance(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  {salaryType === "hourly" ? "+ TES Shift Allowances" : "+ Holiday / Bonus Provision"}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* =======================================================================
            TILE 5: CANDIDATE PROFILE, SAFETY CARDS & MOBILITY (Col 7 on Desktop)
           ======================================================================= */}
        <div className="lg:col-span-7 p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">
                5
              </div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Candidate Origin, Benefits & Languages
              </h2>
            </div>
            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">Match Criteria</span>
          </div>

          {/* Seniority Pills */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Experience Seniority Level
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "junior", label: "Entry / Junior", desc: "1–2 years" },
                { id: "mid", label: "Professional", desc: "3–5 years" },
                { id: "senior", label: "Senior Expert", desc: "5–8 years" },
                { id: "lead", label: "Lead Specialist", desc: "8+ years" }
              ].map((lvl) => {
                const isSelected = experienceLevel === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setExperienceLevel(lvl.id as "junior" | "mid" | "senior" | "lead")}
                    className={`p-2 rounded-xl text-left border transition-all ${
                      isSelected
                        ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold">{lvl.label}</div>
                    <div className={`text-[10px] ${isSelected ? "text-purple-100" : "text-slate-400"}`}>
                      {lvl.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Finnish Statutory Work Cards (Grid) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Finnish Occupational Safety Cards & Licenses
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STATUTORY_CARDS.map((card) => {
                const isChecked = selectedCards.includes(card.id);
                return (
                  <div
                    key={card.id}
                    onClick={() => toggleCard(card.id)}
                    className={`p-2.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-2 ${
                      isChecked
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-slate-900 dark:text-white"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        isChecked ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300"
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3" />}
                    </div>
                    <div className="truncate">
                      <div className="text-[11px] font-bold truncate">{card.label}</div>
                      <div className="text-[9px] text-slate-400 truncate">{card.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Candidate Origin Selection */}
          <div className="pt-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
              <Globe2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Candidate Origin & Mobility</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "global_fast_track", title: "Global & EU (Migri Fast-Track)", tip: "International recruiting with relocation sponsorship" },
                { id: "eu_local_only", title: "EU / Local (Residents Only)", tip: "Finnish & EU residents with local work permits" }
              ].map((o) => {
                const isSelected = candidateOrigin === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setCandidateOrigin(o.id as "global_fast_track" | "eu_local_only")}
                    className={`p-3 rounded-2xl text-left border transition-all ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-xs font-bold">{o.title}</div>
                    <div className={`text-[10px] mt-0.5 ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                      {o.tip}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sponsored Benefits (Shown when Candidate Origin is Global) */}
          {candidateOrigin === "global_fast_track" && (
            <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Sponsored Global Relocation Benefits</span>
                </span>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                  Select all provided benefits
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SPONSORED_BENEFITS_CATALOG.map((b) => {
                  const isChecked = sponsoredBenefits.includes(b.title);
                  const IconComp = b.icon;
                  return (
                    <div
                      key={b.id}
                      onClick={() => toggleBenefit(b.title)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-2.5 ${
                        isChecked
                          ? "bg-white dark:bg-slate-900 border-blue-500 shadow-xs"
                          : "bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-blue-300"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isChecked ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300"
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3" />}
                      </div>
                      <IconComp className={`w-4 h-4 shrink-0 ${isChecked ? "text-blue-600" : "text-slate-400"}`} />
                      <div className="truncate">
                        <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                          {b.title}
                        </div>
                        <div className="text-[9px] text-slate-400 truncate">{b.sub}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add custom sponsored benefit */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={customBenefitInput}
                  onChange={(e) => setCustomBenefitInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomBenefit();
                    }
                  }}
                  placeholder="Add custom sponsored benefit (e.g. Winter clothing allowance, Commuter pass)..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={addCustomBenefit}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          )}

          {/* Multi-Language Requirements with Autocomplete & Proficiency Level Popup */}
          <div className="relative pt-1" ref={langDropdownRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Languages className="w-3.5 h-3.5 text-purple-600" />
                <span>Required Languages & Proficiency</span>
              </label>
              <span className="text-[10px] text-slate-400">
                Type language & choose level
              </span>
            </div>

            {/* Language Text Input with Autocomplete */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Languages className="w-3.5 h-3.5 text-purple-500" />
              </div>
              <input
                type="text"
                value={langInput}
                onFocus={() => setIsLangDropdownOpen(true)}
                onChange={(e) => {
                  setLangInput(e.target.value);
                  setIsLangDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && langInput.trim()) {
                    e.preventDefault();
                    handleStartAddLanguage(langInput.trim());
                  }
                }}
                placeholder="Type language (e.g. English, Finnish, Swedish, Polish, Ukrainian...) and press Enter or select below"
                className="w-full pl-9 pr-16 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-purple-500 outline-none"
              />
              {langInput && (
                <button
                  type="button"
                  onClick={() => handleStartAddLanguage(langInput.trim())}
                  className="absolute inset-y-0 right-1 px-2.5 my-1 rounded-lg bg-purple-600 text-white text-[11px] font-bold flex items-center gap-1"
                >
                  <span>Set Level</span>
                </button>
              )}
            </div>

            {/* Language suggestions dropdown */}
            {isLangDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-2 max-h-48 overflow-y-auto ring-1 ring-black/5">
                <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
                  Click language to set proficiency level:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {filteredLanguages.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => handleStartAddLanguage(lang)}
                      className="px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 text-slate-700 dark:text-slate-200 flex items-center justify-between"
                    >
                      <span>{lang}</span>
                      <Plus className="w-3 h-3 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Language Pills with Proficiency Badges */}
            <div className="flex flex-wrap gap-2 mt-2.5">
              {languages.map((l) => (
                <div
                  key={l.id}
                  className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center gap-2"
                >
                  <div>
                    <span className="text-xs font-bold text-purple-900 dark:text-purple-200 mr-1.5">
                      {l.language}
                    </span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-purple-200/60 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200">
                      {l.level}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLanguage(l.id)}
                    className="w-4 h-4 rounded-full text-purple-400 hover:text-purple-700 hover:bg-purple-200 flex items-center justify-center text-xs"
                    title="Remove language"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Expertise Level Popup Modal */}
            {isLevelModalOpen && pendingLanguage && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
                <div className="w-full max-w-md bg-white dark:bg-[#0f172a] rounded-3xl p-5 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Required Level for {pendingLanguage}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Select minimum proficiency required on the plant shopfloor:
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsLevelModalOpen(false);
                        setPendingLanguage(null);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {PROFICIENCY_LEVELS.map((level) => (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => handleConfirmLanguageLevel(level.title)}
                        className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-purple-600">
                            {level.title}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {level.fi} &bull; {level.desc}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          Select
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Furnished Housing Checkbox */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={housingRequired}
                onChange={(e) => setHousingRequired(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-blue-600" />
                <span>Agency to arrange furnished accommodation for relocating staff</span>
              </span>
            </label>
            <span className="text-[10px] text-blue-600 font-bold">Standard</span>
          </div>
        </div>

        {/* =======================================================================
            TILE 6: KEY RESPONSIBILITIES & MUST-HAVE SKILLS (Col 5 on Desktop)
           ======================================================================= */}
        <div className="lg:col-span-5 p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                  6
                </div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Key Tasks & Skill Tags
                </h2>
              </div>
              <span className="text-[10px] text-slate-400">Interactive Tags</span>
            </div>

            {/* Responsibilities list */}
            <div className="space-y-1.5 mt-3 max-h-44 overflow-y-auto pr-1">
              {responsibilities.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200"
                >
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">{r}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeResponsibility(i)}
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add responsibility input */}
            <div className="flex items-center gap-1.5 pt-2">
              <input
                type="text"
                placeholder="+ Add specific key task..."
                value={newRespInput}
                onChange={(e) => setNewRespInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addResponsibility();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white outline-none"
              />
              <button
                type="button"
                onClick={addResponsibility}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 text-xs font-bold transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Skill Tag Cloud */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Must-Have Technical Skills
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {skillTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold flex items-center gap-1"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeSkillTag(tag)}
                    className="hover:text-rose-500 transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Type skill & press Enter..."
                value={newSkillInput}
                onChange={(e) => setNewSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkillTag();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white outline-none"
              />
              <button
                type="button"
                onClick={addSkillTag}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 text-xs font-bold transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* =======================================================================
            TILE 7: EXECUTIVE DISPATCH & 48H SLA ACTION BANNER (Full Col 12 on Desktop)
           ======================================================================= */}
        <div className="lg:col-span-12 p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5">
          {/* Left summary metrics */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                {vacancies}x
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Requisition Summary
                </span>
                <span className="text-base font-black text-slate-900 dark:text-white">
                  {roleTitle || "Untitled Role"}
                </span>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 block font-semibold">
                  {city} • {sector}
                </span>
              </div>
            </div>

            <div className="hidden sm:block h-10 w-px bg-slate-200 dark:bg-slate-800" />

            <div className="flex items-center gap-5">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">Worker Wage</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {salaryType === "hourly"
                    ? `${rateMin.toFixed(2)}€ – ${rateMax.toFixed(2)}€/h`
                    : `${monthlyMin.toLocaleString()}€ – ${monthlyMax.toLocaleString()}€/mo`}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">Client Rate</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {salaryType === "hourly"
                    ? `~${estClientBillingRate} €/h`
                    : `~${estMonthlyBillingRate.toLocaleString()} €/mo`}
                </span>
              </div>
              <div className="hidden md:block">
                <span className="text-[10px] text-slate-400 block font-bold">Joining / Start</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {joiningPeriod || targetStartDate}
                </span>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-[11px] font-bold text-blue-700 dark:text-blue-300">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>48h SLA Matching Guarantee</span>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-xs font-bold transition-all"
            >
              Cancel & Return
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-7 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Dispatching Order...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Publish Staffing Order ({vacancies})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
