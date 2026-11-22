# Finnish Agency ERP — Master Architecture Blueprint & Progress Plan

**Session Date:** 2026-11-17 / 2026-11-18  
**Project:** Finnish Agency ERP (*Henkilöstövuokraus* Management System)  
**Workspace:** `Finnish_Agency_ERP`  
**Status:** Paused — Requirements Scoped & Logged (Ready to Resume)  

---

## 1. Executive Summary & Business Ecosystem
The system is built specifically for a **Finnish Recruitment & Staffing Agency** operating as the middleman between **Client Companies** and **Skilled Workers/Professionals** (both local and international recruits).

```
   ┌────────────────────────────────────────────────────────┐
   │                  AGENCY ADMIN PANEL                    │
   │  (Multi-Branch, Sourcing, Relocation, Approvals, ERP)  │
   └───────────────────▲─────────────────▲──────────────────┘
                       │                 │
            Biometric  │                 │  Timesheets,
            Rosters &  │                 │  OT & Advance
            Invoices   │                 │  Requests
                       ▼                 ▼
             ┌─────────────────┐ ┌─────────────────┐
             │  CLIENT PORTAL  │ │ EMPLOYEE PORTAL │
             │  (Multi-Site,   │ │ (Web & Mobile,  │
             │   HR, Accounts, │ │  Progressive    │
             │   Approvals)    │ │  Activation)    │
             └─────────────────┘ └─────────────────┘
```

---

## 2. Complete Approved Specifications Record

### Module A: Sourcing, Matching & Placement Pipeline
- **REQ-01: Taxonomy & Database**
  - Structured Master Job Profiles (e.g., CNC Machinist, Welder) mapped to granular skills, experience, and machine/controller types.
  - Candidate document vault (Passport, Certifications, CV) uploaded at self-registration.
  - Email invitation blaster to onboard existing offline talent pool.
- **REQ-02: Multi-Channel Job Sourcing**
  - **Invite from Database:** Dynamic Match % calculation and auto-invite dispatch.
  - **Post to Career Page:** 1-click publishing to public job board.
  - **Generate Social Graphic:** 1-click generation of branded LinkedIn/social banner.
  - Candidate views vacancy details page and clicks "Accept" to enter the interested pool.
- **REQ-03: Interview Coordination & Selection**
  - Top matches forwarded to Client Portal.
  - Client selects candidates and sets interview slots in-portal.
  - Agency dispatches meeting links (Meet/Teams/Zoom) + `.ics` calendar sync + automated reminders.
  - Fallback WhatsApp/SMS notification option for blue-collar candidate responsiveness.
  - Client marks "Selected" or "Rejected" (rejected candidates receive polite automated regret emails).
  - Agency issues **Offer Confirmation** or **Selection Confirmation**; acceptance triggers status change to "Offer Accepted".

### Module B: Progressive Mobile App Access & Relocation Hub
- **REQ-04: Progressive Mobile App Activation**
  - **Phase 1 (Pre-Offer):** Candidate interacts via Web portal only.
  - **Phase 2 (Offer Accepted):** Mobile App access unlocks, displaying Relocation/Visa milestones and After-Arrival Support details.
  - **Phase 3 (Status = Joined):** Generation of Employee Code unlocks all day-to-day operational modules.
- **REQ-05: Relocation & Onboarding Hub**
  - **International Track:** Contract Prepared $\rightarrow$ Visa/Permit Submitted $\rightarrow$ Approved $\rightarrow$ Flight Booked $\rightarrow$ Arrival Date $\rightarrow$ Reached $\rightarrow$ Joined.
  - **Domestic/EU Track:** Contract Prepared $\rightarrow$ Notice Period $\rightarrow$ Relocation $\rightarrow$ Reached $\rightarrow$ Joined.
  - **After-Arrival Support:** Dedicated tracker for DVV personal ID (HETU), Finnish Tax Card (*Verokortti*), Bank Account, and Kela with application IDs and statuses.

### Module C: Client Portal & Workforce Management
- **REQ-06: Multi-Location, Dynamic RBAC & User Assignment Hierarchy**
  - **Agency Super Admin:** Has full authority to assign users and admins across **both** the Agency Portal and Client Portal (creates Client Companies, Sites, and Client Admin accounts).
  - **Client Admin (in Client Portal):** Can create and assign **only operational users** inside the Client Portal (e.g., HR, Site Manager/Supervisor, Accounts, or custom operational roles).
  - **Site Scoping:** Users can be assigned to 1 site (auto-locked, no site dropdown shown) or multiple/all sites (site switcher shown only when assigned 2+ sites).
- **REQ-07: Client Dashboard & Today's Worker Strength (ERP Attendance Register Sync)**
  - **Dashboard Sections:** (1) Strength of Workers, (2) Active Worker Procurement, (3) New Invoices, (4) Approval Requests.
  - **Worker Strength Metrics (Current Date):** *Total Supplying Workers*, *Total On Duty*, *Present Employees*, and *Absent Employees* — fetched directly from the **Agency ERP Attendance Register** (which syncs attendance from biometric devices into the ERP).
- **REQ-08: Client Worker Actions & Roster Lifecycle**
  - Client can trigger **Worker Removal**, **Site Shifting**, or **Request Replacement** directly from a worker's profile card.
  - 1–5 star rating + feedback notes on worker profiles.
  - Direct incident & safety alert reporting to Agency HR.
  - Client builds shift rosters $\rightarrow$ Agency approves $\rightarrow$ push notification sent to employees.

### Module D: Employee Operations & Unified Requests
- **REQ-09: Home Dashboard & Shift State Machine**
  - Displays daily hours, days worked, real-time earned wages, and leave balances.
  - Shift widget shows **"Upcoming Schedule"** before shift starts; automatically shifts to **"Running Shift"** during active shift window.
  - Dedicated display for Overtime hours and pay calculation.
- **REQ-10: Unified Requests Tab**
  - **1. Salary Advance:** Earned wage access + extra advance limits set at joining.
  - **2. Leaves:** Filter history, check balances (Paid Sick Leave requires medical proof; Unpaid Leave proof optional).
  - **3. Work Schedule:** View roster and submit shift change requests.
  - **4. Overtime (OT):** Worker logs post-shift OT $\rightarrow$ Agency routes to Client $\rightarrow$ Client approves $\rightarrow$ Agency approves $\rightarrow$ Worker notified.

### Module E: Agency Operations, Payroll & Controlled Invoicing
- **REQ-11: Multi-Branch & Approval Matrix Engine**
  - Multi-branch agency management with dynamic internal roles.
  - Configurable approval matrix (levels and role hierarchies for Invoices, Salary Advances, Shifts).
  - Advance Salary Chain: Assigned Supervisor $\rightarrow$ CEO/Regional Manager $\rightarrow$ Accounts (releases payment & marks Settled).
- **REQ-12: 6-Step Employee Joining Wizard**
  - Steps: 1. Personal Details $\rightarrow$ 2. Client & Placement $\rightarrow$ 3. Internal Agency Staff Assigned $\rightarrow$ 4. Payroll Setup $\rightarrow$ 5. Banking & Tax (*Verokortti*) $\rightarrow$ 6. Review & Submit.
  - *New-to-Finland handling:* Marked *International Pending* with automated due-date reminders sent to both Employee & Agency.
  - Auto-generated printable Joining Report.
  - Dual document upload: Direct file upload or **QR code scan-to-upload** via mobile camera.
- **REQ-13: Finnish Statutory Payroll Engine**
  - Gross Pay: Base Hours + Finnish TES Surcharges (+ilta, +yö, +sunnuntai 100%) + Approved OT + Holiday compensation.
  - Net Pay: Deductions for Withholding Tax, Pension (TyEL), Unemployment, minus Approved Salary Advances.
- **REQ-14: Controlled Invoicing Workflow & Tax Compliance**
  - Standard Finnish VAT of **25.5% ALV** applied by default; supports **0% VAT (EU Reverse Charge)** for cross-border EU clients.
  - Client approves timesheet $\rightarrow$ Agency clicks "Auto-Generate Invoice" $\rightarrow$ Popup with Invoice Number & Review/Close.
  - Agency reviews/edits line items $\rightarrow$ internal approval $\rightarrow$ permanently locked (read-only) $\rightarrow$ "Send to Client".
  - **Invoice Delivery Channels:** 1. In-Portal Client Process, 2. Direct Print, 3. PDF Export, 4. Share via Email & WhatsApp.
  - **Automated Due-Date & Overdue Alerts:** Automated polite alerts sent via Email/WhatsApp if payment is pending past terms.
  - **Invoice Activity Timeline:** Real-time audit log tracking generation, internal approval, client view, and settlement.
  - Client review: HR reviews $\rightarrow$ Manager approves $\rightarrow$ Accounts pays & submits UTR/Bank Reference $\rightarrow$ Agency notified and marks Settled.
- **REQ-15: Void & Re-issue vs. Dedicated Credit Notes Module**
  - **Void & Re-issue (on Invoice Screen):** Used for fundamental errors; marks invoice as "Voided" with documented reason and allows generating a fresh replacement.
  - **Credit Notes (Dedicated Module):** Raised *against* a specific invoice for partial dispute adjustments (e.g., €100 credit on a €2,000 invoice); recalculates net balance due and supports PDF export/sharing.
- **REQ-16: After-Arrival Data Entry & Real-Time Sync**
  - Agency relocation officer enters received Finnish official details (DVV/HETU, Tax Card percentage, Bank IBAN/BIC) directly into the ERP.
  - Automatically updates the candidate's master data / payroll profile and syncs live application status & details to the Employee Mobile App.

### Module F: Master Module, Administration & Company Setup
- **REQ-17: Master Configuration Hub**
  - Foundational administrative menus driving system dropdowns and business rules:
    1. *Master Job Taxonomy:* Master Job Profiles, granular skills, controller & machinery types.
    2. *Master Finnish TES (Collective Agreements):* TES definitions and standard shift surcharge rates (+ilta, +yö, +sunnuntai).
    3. *Master Shifts:* Shift types (Morning, Evening, Night, Rotational) and work hour windows.
    4. *Master Leave Types:* Annual leave (*Vuosiloma*), Paid Sick leave (*Sairausloma*), Unpaid leave, and policy rules.
    5. *Master Branches:* Agency branch offices and regional locations (Helsinki, Tampere, etc.).
    6. *Master Tax & Currency:* Finnish ALV rates (standard 25.5%, etc.) and EUR (€) base currency.
    7. *Master Notification Templates:* Configurable templates for job invites, interview links, offers, regret emails, and invoice alerts.
  - *Fixed Document Slots:* Master Document Types menu is excluded; built-in/fixed upload slots are provided across registration, joining wizard, and worker profiles.
- **REQ-18: Agency Company Creation & Super Admin Rights**
  - At system implementation, Agency Company Entity is created (Company Name, Finnish Business ID / *Y-tunnus*, VAT registration, registered address, primary contact info).
  - Editing and reconfiguration rights strictly restricted to **Super Admin**.
  - *(License-based restrictions explicitly excluded for now).*
- **REQ-19: Unified Enterprise UI/UX Design System (Maintained Across All 3 Web Portals)**
  - **Shared Architecture:** Maintained identically across Agency Admin Panel, Client Portal, and Candidate Web Portal.
  - **3-Pane Layout:** Collapsible Categorized Sidebar + Top Action Bar with Multi-Tab navigation + Main Content Canvas + Contextual Right Rail (Weekly Calendar, Spotlight Cards, Upcoming Tasks).
  - **Global Equalizer Bar Page Loader:** Full-page animated 6-bar vertical bouncing equalizer loader with live status messages for initial loads and async transitions.
  - **Profile > Preferences Menu:** Decluttered top header; appearance customization lives strictly inside the User Profile dropdown under *Preferences*:
    - **4 Selectable Theme Modes:**
      1. *Light Mode:* Pure Swiss Minimalist Clean (snow white `#f8fafc`, crisp slate borders `#e2e8f0`).
      2. *Dark Mode:* Obsidian Midnight Enterprise (`#090d16` canvas, `#111827` surface, deep borders).
      3. *Colour Full Mode:* Vibrant Pastel Rainbow & Gradient Mesh, individually pastel-tinted KPI cards (Cyan, Mint, Violet, Amber).
      4. *Classic Mode:* Tally Prime Style (signature navy sidebar `#002b49`, sharp rectangular borders, Tally gold `#ffb703` active highlights).
    - **Live Typography Switcher:** Dynamic font selection (*Plus Jakarta Sans, Inter, Outfit, Poppins, JetBrains Mono*).
  - **Mobile App UI:** Excluded from current scope; will be finalized in a later dedicated phase.

---

> ### ⚠️ MASTER STATUTORY DIRECTIVE
> **Every form, data model, calculation engine, and document across all modules must strictly adhere to Finnish Laws & Regulations:**
> - Employment Contracts Act (*Työsopimuslaki*)
> - Working Hours Act (*Työaikalaki*)
> - Annual Holidays Act (*Vuosilomalaki*)
> - Finnish Tax Administration (*Verohallinto / Verokortti*)
> - Finnish Value Added Tax (*Arvonlisäverolaki / ALV 25.5%*)

---

## 3. Approved Technical Architecture & Technology Stack

| Layer | Technology | Key Capabilities & Rationale |
|---|---|---|
| **Backend API** | **Python (FastAPI)** | High performance, async REST APIs, auto-generated OpenAPI/Swagger documentation, ideal for Finnish TES/payroll calculation engines and candidate Match % algorithms. |
| **Database** | **Cloud SQL (PostgreSQL)** | Enterprise relational database with strict ACID compliance for financial ledgers, audit logs, and multi-branch tenancy. |
| **Web Portals** | **Next.js (React) + Tailwind CSS + PWA** | Unified web frontend for Agency, Client, and Candidate portals. PWA mode enables standalone desktop/tablet installation. |
| **Mobile App** | **Flutter (Dart)** | Single native codebase for Android & iOS with smooth 60fps UI, native camera QR code scanning, and push notification services. |
| **Integrations** | **REST / Webhooks** | Biometric hardware API ingest, WhatsApp/Email alert services, Google Meet/Teams/Zoom calendar links. |

---

## 5. Module-by-Module Database Schema & Integration Record

> As each module completes, its database schema is logged here and integrated into the system.

### Phase 1: Client Portal Schema Record

| Sub-Module | Scope & Purpose | Associated Tables & Core Fields | Database Integration Status |
|---|---|---|---|
| **M1.1: Multi-Site & Live Biometrics** | Client company profile, multiple site locations, client users (HR, Accounts, Admin), and real-time biometric feeds. | • `client_companies` (id, name, y_tunnus, vat_id, billing_address)<br>• `client_sites` (id, client_id, site_name, city, address, biometric_terminal_id)<br>• `client_users` (id, client_id, site_id, name, email, role, is_active)<br>• `worker_deployments` (id, client_id, site_id, employee_id, job_role, bill_rate)<br>• `biometric_logs` (id, site_id, employee_id, timestamp, event_type, terminal_sync_status)<br>• `timesheet_shifts` (id, worker_id, site_id, clock_in, clock_out, regular_hours, break_min, status, supervisor_override) | **Completed & Live** (Backend API + Database + Frontend UI) |
| **M1.2: Job Requisitions & Interviews** | Creating staffing orders, reviewing matched/shortlisted candidates, booking interview video slots, and live relocation tracking for international recruits. | • `job_requisitions` (id, req_code, client_id, site_id, role_title, tes_category, vacancies, status)<br>• `candidate_shortlists` (id, requisition_id, full_name, match_percentage, tes_grade, status)<br>• `interview_slots` (id, shortlist_id, scheduled_at, meeting_link, client_rating, decision)<br>• `relocation_milestones` (id, candidate_id, migri_permit_status, dvv_registered, tax_card_obtained, bank_account_opened) | **Completed & Live** (Backend API + Database + Frontend UI) |
| **M1.3: Client Roster Builder** | Weekly/monthly shift scheduling across sites and dispatch to Agency for approval. | • `shift_rosters` (id, client_id, site_id, period_start, period_end, status)<br>• `roster_shifts` (id, roster_id, shift_type, start_time, end_time)<br>• `roster_assignments` (id, shift_id, employee_id, date, status) | **Completed & Live** (Backend API + Database + Frontend UI) |
| **M1.4: Client Approvals (Leaves & Timesheets)** | 1st-stage leave review and biometric timesheet sign-offs. | • `leave_requests` (id, employee_id, client_id, leave_type, start_date, end_date, proof_url, client_status, agency_status)<br>• `timesheet_batches` (id, client_id, site_id, period_start, period_end, total_hours, client_status)<br>• `timesheet_entries` (id, batch_id, employee_id, date, regular_hours, evening_hours, night_hours, ot_hours, total_pay) | Pending M1.3 |
| **M1.5: Worker Actions & Incident Reporting** | Request worker replacement, site shifting, removal, and reporting safety/discipline alerts. | • `worker_action_tickets` (id, client_id, employee_id, action_type, reason, status, agency_notes)<br>• `site_incidents` (id, client_id, site_id, employee_id, incident_type, description, reported_by, reported_at) | Pending M1.4 |
| **M1.6: Invoicing & Payment Settlement** | In-portal invoice review, approval, payment marking with UTR/bank reference, and credit note offsets. | • `invoices` (id, invoice_number, client_id, subtotal, vat_rate_25_5, total_amount, due_date, status)<br>• `invoice_line_items` (id, invoice_id, employee_id, description, hours, rate, line_total)<br>• `payment_records` (id, invoice_id, utr_reference, payment_date, amount, settled_by)<br>• `credit_notes` (id, original_invoice_id, amount, reason, status) | Pending M1.5 |
| **M1.8: Internal Portal Chat (Right Rail)** | Strictly isolated internal portal messaging system for plant operations: `#general` team channel + 1-on-1 direct user messaging with real-time polling and unread badges. | • `internal_chat_messages` (id, client_id, portal_type, channel_type, sender_id, sender_name, sender_role, recipient_id, recipient_name, content, created_at, is_read) | **Completed & Live** (Backend API + Database + Frontend UI) |


## 4. Implementation Roadmap (Portal-by-Portal Delivery)

```
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: CLIENT PORTAL (End-to-End)                                    │
│ • Client Multi-Site Workforce Dashboard & Biometric Attendance Monitor │
│ • Job Requisition Posting & Taxonomy Selection (Skills/Experience)     │
│ • Candidate Shortlisting & Interview Slot Assignment Calendar          │
│ • Live Relocation Tracker for Selected Workers                         │
│ • Roster Builder & Publishing to Agency                                │
│ • 1st-Stage Leave Approvals & Timesheet Verification                   │
│ • Worker Profile Actions: Replacement, Site Shifting, Removal          │
│ • Invoice Review, Approval & Payment Marking with UTR/Bank Reference   │
│ • UI System: 4 Themes, Font Switcher & Global Equalizer Loader         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ PHASE 2: AGENCY PORTAL (Operations, Sourcing & Financial ERP)          │
│ • Multi-Branch Operations & Agency RBAC Matrix                         │
│ • Master Configuration Hub (Taxonomy, TES, Shifts, Leaves, Branches)   │
│ • Sourcing Engine, Auto-Match % & Interview Link Dispatch              │
│ • Relocation Kanban & After-Arrival Support Tracker (DVV/Tax/Bank)     │
│ • 6-Step Employee Joining Wizard with QR Scan & Printable Dossier      │
│ • Multi-Level Approvals (Leaves, OT, Advance Salary, Rosters)          │
│ • Controlled Invoicing (ALV 25.5%, Review/Edit, Internal Lock, Credit) │
│ • Finnish Statutory Payroll Engine (TES surcharges, TyEL, Net Pay)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ PHASE 3: EMPLOYEE WEB + MOBILE APP (Flutter for iOS & Android)         │
│ • Progressive Activation Gate (Offer Accepted -> Joined)               │
│ • Pre-Joined: Relocation Milestones & After-Arrival Status Tracker     │
│ • Post-Joined: Daily Hours, Working Days, Real-time Earned Wages       │
│ • Running Shift vs Upcoming Schedule Widget State Machine              │
│ • Unified Requests Desk: Advance Salary, Leaves (Proof upload), OT,    │
│   and Shift Change Requests                                            │
└────────────────────────────────────────────────────────────────────────┘
```
