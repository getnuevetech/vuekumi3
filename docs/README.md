# Vuekumi — planning documents

Read in this order:

0. **[10-POST-REVIEW-EXECUTION-PLAN.md](./10-POST-REVIEW-EXECUTION-PLAN.md)** — current
   backlog after the 23 September 2026 review. Reconciles the Trust & Markets memo,
   the admin-portal spec, and the AI-pipeline request with Phases 49–61. Next build,
   is Phase 63 (analytics reporting). Phases 62, 64, and 65 are shipped. Do not restart T1 or P0.
1. **[03-PRODUCT-AND-RIGHTS.md](./03-PRODUCT-AND-RIGHTS.md)** — recovered May 2026 concept
   (VueKumi marketplace vs VueQuatro rights/agency), the four rights layers, two-approval
   rule, invite-the-model, permission states, and what production actually implements today.
2. **[01-IMPLEMENTATION-PLAN.md](./01-IMPLEMENTATION-PLAN.md)** — living execution plan:
   shipped Phases 0–61 (Arcs A–D complete; through Phase 61 / AI account+content approval).
   Default next slice: **[10-POST-REVIEW-EXECUTION-PLAN.md](./10-POST-REVIEW-EXECUTION-PLAN.md)**
   (Phase 64 when approved). Do not restart shipped T1/P0 work from older memos.
3. **[05-POST-ARC-D-RECOMMENDATIONS.md](./05-POST-ARC-D-RECOMMENDATIONS.md)** — post–Arc D
   review, recommendations, and ops/decision execution tracks (including Lightsail
   redeploy). Not a licence to start work without approval.
4. **[06-OPS-INVENTORY-AND-DECISION-BRIEF.md](./06-OPS-INVENTORY-AND-DECISION-BRIEF.md)** —
   O0 live probe and Dec-* workshop blanks (no invented answers).
5. **[07-TRUST-RIGHTS-COMPENSATION-COUNTRY-PLAN.md](./07-TRUST-RIGHTS-COMPENSATION-COUNTRY-PLAN.md)** —
   Trust & Markets plan: `/report-content`, `/rights`, DMCA/repeat ops, likeness
   compensation negotiation, Country Activation Matrix admin. T0–T2 + T4 + T7 foundations
   shipped (Phases 49–53); remainder plan until approved.
6. **[08-ADMIN-PORTAL-ENGINEERING-SPEC.md](./08-ADMIN-PORTAL-ENGINEERING-SPEC.md)** —
   Engineering adoption of Admin Portal & Country Activation spec v1.2: three
   control layers, eight modules, Policy Decision Service, P0–P2 tranches.
   **P0 (Phase 49) shipped**; T1–T2 + T4 + T7 (Phases 50–53) shipped; Phase 54 PDS
   license.issue suspend enforcement shipped; Phase 57 quarantine reason codes shipped;
   P1 negotiation (T5/T6) remain plan until Dec-PayBase.
12. **[09-AI-PIPELINE-MULTI-PROVIDER-AND-SUBJECT-DETECTION-PLAN.md](./09-AI-PIPELINE-MULTI-PROVIDER-AND-SUBJECT-DETECTION-PLAN.md)** —
   P1 "AI subjects" + "ID/face provider" made concrete: multi-provider AI
   registry (Phase 58, **shipped**), AI subject quarantine / auto-invite-or-block
   (Phase 59, **shipped**), ID/face verification (Phase 60, **blocked on Dec-Bio**),
   AI-assisted account/content approval (Phase 61, **shipped**), image
   enhancement + uploader recommendations (Phase 62, **shipped**, option A), AI analytics/reporting
   (Phase 63).
11. **[runbooks/rights-ops.md](./runbooks/rights-ops.md)** — staff rights-ops SOP
   (Phase 51 / T2). Public holder review: `/rights` (Phase 52 / T4).
7. **[04-ADMIN-ACL-AND-SYMMETRIC-RIGHTS.md](./04-ADMIN-ACL-AND-SYMMETRIC-RIGHTS.md)** —
   Arc D procedure (Phases 35–40 shipped). Historical gap tables may lag; prefer §0 locks
   and the shipped status header.
8. **[deploy/lightsail/README.md](../deploy/lightsail/README.md)** — how production is
   actually deployed (Docker on AWS Lightsail); O3/O4 checklists.
9. **[00-CODE-REVIEW.md](./00-CODE-REVIEW.md)** — **archive.** Inventory of the static Noir
   template before the backend existed.
10. **[02-DEPLOYMENT-LIGHTSAIL-DOCKER.md](./02-DEPLOYMENT-LIGHTSAIL-DOCKER.md)** — **archive.**
   Original NestJS/Lightsail sketch; superseded by the deploy README.

**Do not start a new implementation phase until it is explicitly approved.**
**Do not invent undecided economics, biometric vendors/retention, or a VueQuatro entity form.**
