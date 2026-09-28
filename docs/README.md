# Vuekumi — planning documents

Read in this order:

0. **[12-V2-RECONCILIATION-EXECUTION-PLAN.md](./12-V2-RECONCILIATION-EXECUTION-PLAN.md)** —
   **current next-build track.** Imagery Concept v2.0 reconciliation: locked
   Dec-Bio / Dec-PayBase / Dec-Split / Dec-AfricaElig; P0 foundation (H1, H3,
   RevenuePolicy, Photo Influencer + library tiers, Open download events, Rights
   alignment); then P1 (T5, Phase 60 schema flag-off, T8 waitlist, H4, H5). Do
   **not** implement full v2 UI before this foundation.
1. **[11-SEP28-REVIEW-RECOMMENDATIONS-AND-PLAN.md](./11-SEP28-REVIEW-RECOMMENDATIONS-AND-PLAN.md)** —
   Sep 28 repo/app review (ops, hygiene, gated product). Sequencing for product
   foundation is superseded by **[12](./12-V2-RECONCILIATION-EXECUTION-PLAN.md)**.
2. **[10-POST-REVIEW-EXECUTION-PLAN.md](./10-POST-REVIEW-EXECUTION-PLAN.md)** — product
   backlog after the 23 September 2026 review. Reconciles the Trust & Markets memo,
   the admin-portal spec, and the AI-pipeline request with Phases 49–61. Phases 62–65
   are shipped. T5 / Phase 60 architecture / T8 proceed under locked Dec-* in `12`;
   T6 remains finance-gated; T3 is counsel/deploy. Do not restart T1 or P0.
3. **[03-PRODUCT-AND-RIGHTS.md](./03-PRODUCT-AND-RIGHTS.md)** — recovered May 2026 concept
   (VueKumi marketplace vs VueQuatro rights/agency), the four rights layers, two-approval
   rule, invite-the-model, permission states, and what production actually implements today.
4. **[01-IMPLEMENTATION-PLAN.md](./01-IMPLEMENTATION-PLAN.md)** — living execution plan:
   shipped Phases 0–65 (Arcs A–D complete; through Phase 65 / model-upload prompt parity).
   Default next work: **[12](./12-V2-RECONCILIATION-EXECUTION-PLAN.md)** reconciliation,
   then gated slices from **[10](./10-POST-REVIEW-EXECUTION-PLAN.md)**. Do not restart shipped T1/P0 work from older memos.
5. **[05-POST-ARC-D-RECOMMENDATIONS.md](./05-POST-ARC-D-RECOMMENDATIONS.md)** — post–Arc D
   review, recommendations, and ops/decision execution tracks (including Lightsail
   redeploy). Prefer **[12](./12-V2-RECONCILIATION-EXECUTION-PLAN.md)** for current
   sequencing. Not a licence to start work without approval.
6. **[06-OPS-INVENTORY-AND-DECISION-BRIEF.md](./06-OPS-INVENTORY-AND-DECISION-BRIEF.md)** —
   O0 live probe and Dec-* workshop. **Locked:** Dec-Bio, Dec-PayBase, Dec-Split,
   Dec-AfricaElig (see `12`). Still pending: Dec-VQ, Dec-Fee, Dec-AI.
7. **[07-TRUST-RIGHTS-COMPENSATION-COUNTRY-PLAN.md](./07-TRUST-RIGHTS-COMPENSATION-COUNTRY-PLAN.md)** —
   Trust & Markets plan: `/report-content`, `/rights`, DMCA/repeat ops, likeness
   compensation negotiation, Country Activation Matrix admin. T0–T2 + T4 + T7 foundations
   shipped (Phases 49–53); remainder plan until approved — payment base now locked in `12`.
8. **[08-ADMIN-PORTAL-ENGINEERING-SPEC.md](./08-ADMIN-PORTAL-ENGINEERING-SPEC.md)** —
   Engineering adoption of Admin Portal & Country Activation spec v1.2: three
   control layers, eight modules, Policy Decision Service, P0–P2 tranches.
   **P0 (Phase 49) shipped**; T1–T2 + T4 + T7 (Phases 50–53) shipped; Phase 54 PDS
   license.issue suspend enforcement shipped; Phase 57 quarantine reason codes shipped;
   P1 negotiation (T5/T6) may proceed under Dec-PayBase/Dec-Split in `12` (T6 still finance-gated).
9. **[09-AI-PIPELINE-MULTI-PROVIDER-AND-SUBJECT-DETECTION-PLAN.md](./09-AI-PIPELINE-MULTI-PROVIDER-AND-SUBJECT-DETECTION-PLAN.md)** —
   P1 "AI subjects" + "ID/face provider" made concrete: multi-provider AI
   registry (Phase 58, **shipped**), AI subject quarantine / auto-invite-or-block
   (Phase 59, **shipped**), ID/face verification (Phase 60 — **architecture unblocked
   under Dec-Bio; production activation still gated**), AI-assisted account/content
   approval (Phase 61, **shipped**), image enhancement + uploader recommendations
   (Phase 62, **shipped**, option A), AI analytics/reporting (Phase 63, **shipped**).
   Fail-closed detection (Phase 64) and model-upload parity (Phase 65) shipped — see `10`.
10. **[runbooks/rights-ops.md](./runbooks/rights-ops.md)** — staff rights-ops SOP
   (Phase 51 / T2). Public holder review: `/rights` (Phase 52 / T4).
11. **[04-ADMIN-ACL-AND-SYMMETRIC-RIGHTS.md](./04-ADMIN-ACL-AND-SYMMETRIC-RIGHTS.md)** —
   Arc D procedure (Phases 35–40 shipped). Historical gap tables may lag; prefer §0 locks
   and the shipped status header.
12. **[deploy/lightsail/README.md](../deploy/lightsail/README.md)** — how production is
   actually deployed (Docker on AWS Lightsail); O3/O4 checklists.
13. **[00-CODE-REVIEW.md](./00-CODE-REVIEW.md)** — **archive.** Inventory of the static Noir
   template before the backend existed.
14. **[02-DEPLOYMENT-LIGHTSAIL-DOCKER.md](./02-DEPLOYMENT-LIGHTSAIL-DOCKER.md)** — **archive.**
   Original NestJS/Lightsail sketch; superseded by the deploy README.

**Do not start a new implementation phase until it is explicitly approved.**
**Do not invent undecided Dec-Fee / Dec-VQ / Dec-AI answers, a permanent platform
commission rate, or activate biometrics in production without vendor/DPA/counsel.**
