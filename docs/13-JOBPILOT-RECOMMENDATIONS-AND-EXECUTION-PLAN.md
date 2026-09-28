# JobPilot — recommendations & execution plan

**Status: plan only. Do not start numbered build phases until explicitly approved.**  
Source: *AI Job Application Platform — Product, Workflow & Multi-AI Development Specification* v1.2 (uploaded review copy).  
Companion next-tech doc still required per Spec §Appendix A (schemas, orchestrator state machine, JSON contracts).

This plan converts the product specification into a sequenced engineering track. It is **not** a VueKumi Imagery v2.0 slice. JobPilot is a separate product: an **AI Job Application Manager** (profile → match → tailor → apply → track → learn), not a job board and not a resume rewriter.

---

## 1. Verdict

| Dimension | Assessment |
| --- | --- |
| Product direction | **Strong.** Quality-over-volume, Fact Ledger, non-fabrication, multi-AI produce/review, and Auto Apply as opt-in/rules-gated are the right core bets. |
| Spec completeness | **Product-complete, engineering-incomplete.** Appendix A correctly calls for DB/API/orchestrator/JSON contracts before heavy build. |
| Phase 1 size | **Too large as a single “MVP”.** Spec Phase 1 includes onboarding + Fact Ledger + Resume Upscale + job ingestion + seven AI roles + job-specific resume + Q&A + tracker. Treat Spec Phase 1 as a **release train**, not one sprint. |
| Fit with this repo (`vuekumi3`) | **Do not bolt JobPilot onto VueKumi.** VueKumi is a rights-cleared stock marketplace. Shared patterns (provider registry, flag-gated activation, counsel-gated legal copy) may be **copied as practice**, not as a monorepo feature dump. Prefer a **new JobPilot codebase** (or a clearly separated monorepo workspace) with its own schema, auth, billing, and deploy. |

---

## 2. Recommendations (lock these before coding)

### R1 — Product identity
- Market and build as **AI Job Application Manager**, not “AI resume builder.”
- Primary conversion action: **resume upload**, not email/password signup.
- Optimize for **application quality** (fit, honesty, review gates), not application volume.

### R2 — Source of truth
- **Fact Ledger** is canonical. Generated resumes are derived artifacts with provenance.
- AI may rewrite presentation; AI **must not** invent employers, dates, credentials, skills, or metrics.
- Clarifications become ledger facts only after **user confirmation**.

### R3 — Multi-AI from day one (thin, not theatrical)
- Ship a **provider-agnostic orchestrator** + purpose→model routing config in Phase 0.
- For high-impact outputs (extraction, tailored resume), use **produce + independent review** (second provider when available).
- Use **deterministic code** for dates, salary thresholds, eligibility, status machines, and score aggregation.
- Require **structured JSON** between stages; reject/repair invalid AI payloads in code.

### R4 — Jobs data strategy
- Do **not** found the business on uncontrolled scraping.
- Prefer: licensed job APIs → public ATS/employer feeds → partnerships → browser-assisted capture.
- Ingest → normalize → dedupe → requirement extract → match. Keep raw job payload versioned.

### R5 — Apply automation sequencing
- **Assisted Apply** (human reviews before submit) before **Controlled Auto Apply**.
- Auto Apply: **OFF by default**, separate affirmative consent, user rules + caps, hard stop on sensitive/legal/EEO/medical/attestation fields and any unverified answer.
- Log every automated submission (job, employer, time, resume version, material answers, status).

### R6 — Legal / privacy (counsel-gated)
- Spec’s legal pack (2026-09-27 drafts) needs **counsel review** before public launch.
- Prefer **two public docs** (Terms; Privacy & Data Use) + **just-in-time UI notices** (resume upload, Auto Apply enablement, recurring billing) rather than a stack of footer policies.
- Production resume upload requires **HTTPS**, encryption at rest, least-privilege admin access, deletion propagation to object storage/indexes/subprocessors.

### R7 — Commercial
- Spec subscription bands (Free / Starter / Pro / Autopilot) are a **hypothesis**. Do not hardcode permanent economics; meter AI cost before locking prices.
- Autopilot features stay behind Phase 3 + Auto Apply authorization.

### R8 — Repo / delivery topology
| Option | Recommendation |
| --- | --- |
| Build inside VueKumi app tree | **Reject** — contaminates rights/marketplace domain and ACL. |
| New `jobpilot` repo (or `apps/jobpilot-*` sibling with isolated Prisma schema) | **Prefer** |
| Reuse VueKumi AI admin registry ideas | **Yes, as patterns** (purpose keys, failover, cost routing) — reimplement for JobPilot purposes |

---

## 3. Explicit non-goals (until unlocked)

- Uncontrolled web scraping as primary job inventory
- Fabricating candidate history to raise match scores
- Auto Apply without separate consent and rule engine
- Auto-answering EEO / disability / medical / background-check / contractual attestations
- Training foundation models on user resumes without separate counsel-approved program
- Employer marketplace (employer accounts, candidate search, job posting) before Phase 3
- Hardcoding Spec subscription prices as permanent platform truth

---

## 4. Architecture to implement (from Spec §50, tightened)

```
Frontend (web + later extension)
        │
     API Layer
        │
 ┌──────┼──────────────┐
 ▼      ▼              ▼
Candidate   Job      Application
Service   Service     Service
        │
        ▼
  AI Orchestrator ──► Provider adapters (A/B/C)
        │
        ▼
  Validation / Policy engine
        │
        ▼
  Fact Ledger + Output store + Audit log
```

**Must-have platform primitives (Phase 0):**
1. Prompt Registry (versioned prompts + model routing JSON)
2. AI run audit log (purpose, provider, model, latency, cost estimate, input/output hashes, prompt version)
3. Fact Ledger entities + provenance links to source resume/parse run
4. Consent events (Terms/Privacy, AI processing, Auto Apply, billing)
5. Job source connector interface (ingest → normalize → store)

---

## 5. Execution plan — phased builds

Treat Spec Phases 1–3 as **product eras**. Engineering uses **JP0 → JP3** below. Do not start JP1 until JP0 contracts exist.

### JP0 — Technical contracts & skeleton (unblock everything)

**Done when:** Appendix A checklist is answered in-repo with schemas and stubs; no public marketing launch required.

| ID | Work | Done when |
| --- | --- | --- |
| **JP0-1** | Domain model: User (draft→active), ResumeAsset, ParseRun, FactLedgerEntry, CareerProfile, JobPosting, JobRequirementSet, MatchResult, ResumeVersion, Application, ApplicationEvent, AiRun, PromptVersion, ConsentEvent | Prisma (or equivalent) migration + ERD in docs |
| **JP0-2** | API surface map (OpenAPI or shared Zod DTOs) for auth, profile, jobs, match, resumes, applications, AI status | Contracts compile; empty handlers return 501/empty where not implemented |
| **JP0-3** | AI Orchestrator interface: `run(purpose, input) → { json, provenance }` + routing config + failover hooks | Unit tests with fake providers; no vendor hard-coded in product code |
| **JP0-4** | JSON schemas for extraction, review, job requirements, match explanation, resume strategy/writer/validator | Golden fixtures (minimal) under `fixtures/jobpilot/` |
| **JP0-5** | Legal/consent event model + feature flags: `auto_apply_enabled` default false; AI purposes gated | Flags OFF by default in seed |
| **JP0-6** | Deploy skeleton: web + API + object storage for resumes (HTTPS-only prod path documented) | Local compose up; resume upload stores encrypted blob metadata |

**Exit gate:** Review JP0 contracts against Spec §51 Development Rules; freeze Fact Ledger field vocabulary v1.

---

### JP1A — Resume-first activation (Spec §3–5, §12 partial)

**Done when:** User uploads resume → draft account → OTP/magic-link confirm → consent → missing-preferences interview → active account with Master Career Profile + Fact Ledger (reviewed).

| ID | Work |
| --- | --- |
| **JP1A-1** | Landing: hero upload CTA (Spec §53) — privacy strip adjacent to upload |
| **JP1A-2** | Document parse (PDF/DOCX) → text/blocks |
| **JP1A-3** | Pipeline 1: Extractor AI → Fact Reviewer AI → clarification queue |
| **JP1A-4** | Draft account from extracted email; OTP/magic link; Terms + Privacy + AI-processing consent |
| **JP1A-5** | Dynamic missing-data interview (salary, remote/hybrid, locations, work auth/sponsorship, target titles) |
| **JP1A-6** | Account activation; profile summary screen (“career profile ready”) |

**Non-goals in JP1A:** job inventory, apply flows, Auto Apply, paid plans.

---

### JP1B — Resume Upscale on verified facts (Spec §13)

| ID | Work |
| --- | --- |
| **JP1B-1** | Resume Upscale pipeline (strategy → writer → validator) using Fact Ledger only |
| **JP1B-2** | Before/after UI emphasizing unchanged facts; clarification loops write to ledger after confirm |
| **JP1B-3** | Resume Version Control (Spec §40): version pin, provenance to ledger revision |

---

### JP1C — Jobs + matching (Spec §14–17, §42)

| ID | Work |
| --- | --- |
| **JP1C-1** | First **licensed/public** job connector (one real source); normalize + store |
| **JP1C-2** | Requirement extraction AI + deterministic parse fallbacks |
| **JP1C-3** | Match scoring (deterministic weights + Match Analyst explanation AI) |
| **JP1C-4** | Job search + recommendations; Job Detail with match / gaps / salary-location alignment |
| **JP1C-5** | Dedup keys + basic job quality flags (fraud pipeline can be stubbed with rules) |

**Gate:** No scraping-only inventory for launch.

---

### JP1D — Application preparation & tracker (Spec §18–21, §23)

| ID | Work |
| --- | --- |
| **JP1D-1** | Job-specific resume generation (produce + validate against ledger) |
| **JP1D-2** | Application Q&A assistant — never auto-submit sensitive categories |
| **JP1D-3** | Application Readiness Engine (checklist: fit threshold, resume ready, unanswered sensitive fields) |
| **JP1D-4** | Assisted Apply workflow (prepare → user review → mark submitted / export package) |
| **JP1D-5** | Application Tracker (status, resume version used, events timeline) |

**Exit for “Spec Phase 1 MVP”:** JP1A–JP1D green with one job source, produce/review on extraction + tailored resume, Assisted Apply only.

---

### JP2 — Extension, coaching, intelligence (Spec §45)

| ID | Work |
| --- | --- |
| **JP2-1** | Browser extension: capture JD, import job, prepare application package |
| **JP2-2** | Assisted autofill on supported ATS hosts (allowlist); never fill sensitive categories without prompt |
| **JP2-3** | Career Intelligence + Job Coach surfaces (gap skills, next actions) |
| **JP2-4** | Interview prep pipeline (Spec §26) — study guides from JD + ledger |
| **JP2-5** | Follow-up reminders; richer job verification / duplicate detection |
| **JP2-6** | Outcome learning hooks (interview/offer/rejection) into analytics (no dark-pattern spam) |

---

### JP3 — Controlled automation & two-sided (Spec §46)

| ID | Work |
| --- | --- |
| **JP3-1** | Controlled Auto Apply: consent UX, rule DSL, caps, kill switch, audit log |
| **JP3-2** | AI Career Agent orchestration across match→prepare→queue |
| **JP3-3** | Voice interview simulation / salary negotiation / recruiter outreach assistants (optional modules) |
| **JP3-4** | Employer accounts, job posting, candidate search — **separate product surface**; requires new privacy review (Spec §43) |

---

## 6. Suggested build order (first 8 engineering slices)

Concrete “next” queue after plan approval:

1. **JP0-1 + JP0-2** — schema + API contracts  
2. **JP0-3 + JP0-4** — orchestrator + JSON contracts + fixtures  
3. **JP1A-1..2** — landing upload + document parse  
4. **JP1A-3..6** — extract/review/OTP/consent/activation  
5. **JP1B** — Resume Upscale + versions  
6. **JP1C-1..4** — first job source + match UI  
7. **JP1D** — tailored resume + Assisted Apply + tracker  
8. **Billing skeleton** (feature-gated) only after AI unit-cost telemetry exists  

Do **not** start browser extension or Auto Apply before Assisted Apply is stable.

---

## 7. Decision gates (human / counsel / ops)

| Gate | Blocks | Owner |
| --- | --- | --- |
| **Dec-JP-Repo** | Whether JobPilot is a new repo vs isolated monorepo apps | Eng lead |
| **Dec-JP-Jobs** | First licensed job data source / ATS partnership | Product + BD |
| **Dec-JP-Legal** | Counsel sign-off on Terms/Privacy + JIT notices | Counsel |
| **Dec-JP-AI** | Approved providers, DPAs, data-retention for resume content to vendors | Counsel + Eng |
| **Dec-JP-Price** | Validated subscription prices vs AI+job-data cost | Finance + Product |
| **Dec-JP-AutoApply** | Jurisdiction-specific rules for automated submissions | Counsel + Product |

---

## 8. Relationship to VueKumi docs

| Doc | Relevance |
| --- | --- |
| `12` / `10` / `01` (VueKumi) | **Unrelated product track.** Do not sequence JobPilot behind VueKumi T3/T6/T9 gates except for shared org counsel capacity. |
| VueKumi AI provider registry (`09`, Phase 58+) | Useful **pattern reference** for purpose-based routing and admin configuration. |
| This document (`13`) | **Current JobPilot planning authority** until a technical contract doc (`14`) lands. |

---

## 9. Immediate next actions

1. Approve **Dec-JP-Repo** (recommend: new JobPilot repo).  
2. Commission **Technical Specification** (Spec Appendix A) as `docs/14-JOBPILOT-TECHNICAL-CONTRACTS.md` (or JobPilot repo equivalent).  
3. Approve **JP0** skeleton start.  
4. Start counsel review of legal pack + resume-upload JIT notice.  
5. Select **one** job inventory source for JP1C (licensed API preferred).

Until (1)–(3) are approved, treat JobPilot as **plan-only** — same discipline as VueKumi gated tracks: no invented vendors, no Auto Apply by default, no fabricated candidate facts.
