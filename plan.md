# 📄 Candidate Evaluation System — Plan + UX/UI Specification

---

# 📌 plan.md

## 🎯 Project Goal

Build a **browser-based Candidate Evaluation System** for senior data engineer interviews using:

* **Google Apps Script (Frontend + Backend)**
* **Google Sheets (Database)**

The system ensures:

* Independent interviewer evaluations
* Secure access control
* Clear and fast decision-making via aggregated scores

---

## ✅ Progress Tracker

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0 — Dev Setup | ✅ Done | package.json, .env, clasp, npm scripts |
| Phase 1 — Data Foundation | ✅ Done | setupSchema() creates all 4 sheets with headers, validation, formatting |
| Phase 2 — Core Backend | ✅ Done | Auth.js, Candidates.js, Evaluations.js — 34 tests passing |
| Phase 3 — Web UI | ✅ Done | candidates.html, evaluation.html, summary.html |
| Phase 4 — Scoring Engine | ✅ Done | Summary.js: per-category averages, final score, recommendation |
| Phase 5 — Security Layer | ✅ Done | isAuthorised(), requireAuthorised(), row-level ownership on evaluations |
| Phase 6a — Hiring Recommendation | ✅ Done | Strong Hire / Hire / No Hire thresholds baked into Summary.js |
| Phase 6b — Weighted Scoring | ✅ Done | `SCORE_WEIGHTS` Script Property; weights editor in admin UI |
| Phase 6c — Export Report | ✅ Done | CSV export (all + per-candidate); print-to-PDF report page |
| Phase 6d — Audit Logs | ✅ Done | AuditLog.js + AuditLog sheet; logged in Code.js; admin UI tab |
| Phase 7 — UX Polish | ✅ Done | Search/filter done; auto-fill eval done; sortable table done; mobile CSS added |
| Phase 8 — Interviewers Admin UI | ✅ Done | admin.html: add/toggle interviewers, weights editor, audit log view |

---

## 🗺️ Implementation Plan

### Phase 1 — Data Foundation ✅

* Create Google Sheets:

  * `Candidates`
  * `Interviewers`
  * `Evaluations`
  * `Summary`
* Define schema and constraints → `src/Setup.js` (`setupSchema()`)
* Link Apps Script project → `.clasp.json` via `npm run setup:clasp`

---

### Phase 2 — Core Backend (Apps Script) ✅

* Implemented in `src/`:

  * `Config.js` — reads Script Properties (credentials)
  * `Auth.js` — Google account auth + Interviewers whitelist
  * `Candidates.js` — addCandidate, getAllCandidates, getCandidateById, updateCandidateStatus
  * `Evaluations.js` — submitEvaluation, getEvaluationsForCandidate, getEvaluationByInterviewer, updateEvaluation
* Enforced:

  * One evaluation per interviewer per candidate
  * Score validation (1–10)
  * 34 unit tests — all passing (`npm test`)

---

### Phase 3 — Web UI (Apps Script HTML Service) ✅

* `src/Code.js` — `doGet()` router + `google.script.run` handlers
* Pages built:

  * `src/html/candidates.html` — candidate list + Add Candidate modal (admin only)
  * `src/html/evaluation.html` — score sliders (1–10) + notes + submit
  * `src/html/summary.html` — aggregated scores table + recommendation badges

---

### Phase 4 — Scoring Engine ✅

* `src/Summary.js`:

  * Average per category (TechnicalSkills, ProblemSolving, Communication, SystemDesign, CultureFit)
  * Final score = mean of 5 category averages
  * Auto-triggered on every `submitEval` / `updateEval`
  * `refreshSummary(candidateId)` for manual refresh

---

### Phase 5 — Security Layer ✅

* `Interviewers` sheet whitelist — only listed + active users can log in
* `ADMIN_EMAILS` Script Property bypasses the whitelist
* Row-level ownership — users can only update their own evaluations
* `requireAuthorised()` called on every server-side function

---

### Phase 6 — Enhancements

#### 6b — Weighted Scoring ⬜

* Allow configurable per-category weights (e.g. Technical 30%, SystemDesign 25%, …)
* Store weights in Script Properties: `SCORE_WEIGHTS`
* Update `Summary.computeScores()` to apply weights
* Add weights editor in admin UI

#### 6c — Export Report ⬜

* `exportCandidatePdf(candidateId)` — returns a formatted PDF blob
* Button on Summary page: **Export PDF**
* Alternatively: CSV export of all evaluations for a candidate

#### 6d — Audit Logs ⬜

* New sheet: `AuditLog` — columns: Timestamp, UserEmail, Action, EntityType, EntityID, Detail
* Log every: candidate created, evaluation submitted/updated, status changed
* `src/AuditLog.js` — `logEvent(action, entityType, entityId, detail)`
* View-only tab in the web app for admins

---

### Phase 7 — UX Polish ⬜

* **Candidate list** — real-time search bar + status filter dropdown (per design spec)
* **Evaluation form** — auto-load existing evaluation if the current user already submitted one (pre-fill sliders + show Update button instead of Submit)
* **Summary table** — sortable columns (click header to sort by Final Score, Name, etc.)
* **Summary table** — highlight top candidates (e.g. green row for Strong Hire)
* **Mobile** — stack inputs vertically on small screens

---

### Phase 8 — Interviewers Admin UI ⬜

* Admin-only page: `/admin`
* Add interviewer (Email, Name, Role)
* Deactivate / reactivate interviewer (toggle Active)
* Currently interviewers must be managed directly in the Google Sheet

---

## 🔧 Dev Commands

```bash
npm test                 # Run 34 unit tests
npm run setup:clasp      # Generate .clasp.json from .env
npm run set-properties   # Generate bootstrap GAS file → then clasp push → run setScriptProperties
npm run clean-properties # Remove bootstrap file after properties are set
clasp push               # Deploy source to Apps Script
clasp deploy             # Publish a new web app version
```

---

# 🎨 design.md (UX/UI Specification)

## 🧭 Design Principles

* **Simple first** → Minimal steps to submit evaluation
* **Clarity** → Clear scores, clear decisions
* **Speed** → ≤ 3 clicks to evaluate a candidate
* **Isolation** → Users only see/edit their own inputs
* **Consistency** → Same layout patterns across pages

---

## 🗂️ Information Architecture

```id="ux-arch"
Home (Candidate List)
 ├── Evaluate Candidate (Form)
 └── View Summary Dashboard
```

---

## 🖥️ Page 1: Candidate List

### 🎯 Purpose

* Entry point for interviewers
* View all candidates
* Start evaluation

### 📐 Layout

```id="candidate-list-layout"
--------------------------------------------------
| Header: "Candidate Evaluation System"           |
| Logged in as: user@email.com                    |
--------------------------------------------------
| Search [__________]   Filter: [Status ▼]        |
--------------------------------------------------
| Table:                                          |
| ID   | Name     | Position     | Status | Action|
| C001 | John Doe | Data Eng     | Pending| [Eval]|
--------------------------------------------------
```

### ⚙️ Components

* **Search Bar**
* **Status Filter Dropdown**
* **Table**
* **Evaluate Button**

### 🔄 Interactions

* Click **Evaluate** → Navigate to Evaluation Form
* Search → Filter table in real-time

---

## 📝 Page 2: Evaluation Form

### 🎯 Purpose

* Allow interviewer to submit/update evaluation

---

### 📐 Layout

```id="evaluation-layout"
----------------------------------------
| Candidate: John Doe                  |
| Position: Data Engineer             |
----------------------------------------
| Technical Skills     [ 8 ] (1–10)    |
| Leadership           [ 7 ]           |
| Stakeholder Comm     [ 9 ]           |
----------------------------------------
| Comment:                              |
| [______________________________]      |
----------------------------------------
| [ Submit ]   [ Update ]               |
----------------------------------------
```

---

### ⚙️ Components

* Read-only:

  * Candidate Name
  * Position
* Inputs:

  * Technical (number)
  * Leadership (number)
  * Stakeholder (number)
* Comment box
* Buttons:

  * Submit (new)
  * Update (existing)

---

### 🔄 Interactions

* Auto-fill existing evaluation (if exists)
* Validate:

  * Range (1–10)
  * Required fields
* Submit:

  * Save to `Evaluations`
  * Trigger summary update
* Show success message:

  * ✅ “Evaluation saved”

---

### 🚫 Error States

* ❌ Invalid score → “Score must be between 1–10”
* ❌ Unauthorized → “You are not allowed”

---

## 📊 Page 3: Summary Dashboard

### 🎯 Purpose

* Provide decision-making overview

---

### 📐 Layout

```id="summary-layout"
--------------------------------------------------------
| Candidate | Tech Avg | Lead Avg | Stake Avg | Final   |
--------------------------------------------------------
| John Doe  | 8.2      | 7.5      | 8.8       | 8.16    |
--------------------------------------------------------
```

---

### ⚙️ Components

* Table with aggregated scores
* Sortable columns
* Highlight top candidates

---

### 🔄 Interactions

* Auto-refresh after evaluation
* Optional:

  * Sort by Final Score
  * Filter by threshold

---

## 🎯 UX Flow

### 🧑‍💻 Evaluation Flow

```id="ux-flow"
Login → Candidate List → Click Evaluate
     → Fill Form → Submit
     → System updates summary
     → User sees success message
```

---

## 🔐 UX for Security

* Show logged-in user email clearly
* Disable editing others’ evaluations
* Hide unauthorized actions

---

## 📱 Responsiveness

* Mobile-friendly:

  * Stack inputs vertically
  * Scrollable tables
* Desktop:

  * Table-focused layout

---

## 🎨 Visual Style

### Colors

* Primary: Blue (actions)
* Success: Green
* Error: Red
* Neutral: Light gray background

### Typography

* Header: Bold
* Table: Clean and readable
* Inputs: Clear labels

---

## ⚡ UX Enhancements (Optional)

* ⭐ Star-based scoring UI instead of numbers
* 🟡 Progress indicator (evaluation completion)
* 📌 Sticky header for long tables
* 📤 Export summary button

---

## ✅ Final Summary

This UX/UI design ensures:

* Fast evaluation workflow
* Clear separation of responsibilities
* Strong data integrity
* Easy adoption (no training required)

---

If you want next step, I can help you:

* Build **Apps Script HTML UI code**
* Or generate **full working MVP (copy-paste ready)**
