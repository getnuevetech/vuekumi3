# Vuekumi — planning documents

Read in this order:

0. **[13-V21-IMAGERY-CONCEPT-RECOMMENDATIONS-AND-EXECUTION-PLAN.md](./13-V21-IMAGERY-CONCEPT-RECOMMENDATIONS-AND-EXECUTION-PLAN.md)** —
   **Imagery Concept v2.1** recommendations + Free Contributor (FC) / V21-P2
   execution. Prefer over older “Photo Influencer” concept naming. Does not restart
   shipped Open/rights work in **`12`**.
1. **[12-V2-RECONCILIATION-EXECUTION-PLAN.md](./12-V2-RECONCILIATION-EXECUTION-PLAN.md)** —
   **Technical reconciliation status.** Imagery Concept v2.0/v2.1 rights stack:
   Dec-Bio / Dec-PayBase / Dec-Split / Dec-AfricaElig locked; P0–P2 foundations
   largely shipped; remaining activation is finance/counsel/vendor-gated.
2. **[11-SEP28-REVIEW-RECOMMENDATIONS-AND-PLAN.md](./11-SEP28-REVIEW-RECOMMENDATIONS-AND-PLAN.md)** —
   Sep 28 repo/app review (ops, hygiene, gated product). Sequencing for product
   foundation is superseded by **[12](./12-V2-RECONCILIATION-EXECUTION-PLAN.md)** /
   **[13](./13-V21-IMAGERY-CONCEPT-RECOMMENDATIONS-AND-EXECUTION-PLAN.md)**.
3. **[10-POST-REVIEW-EXECUTION-PLAN.md](./10-POST-REVIEW-EXECUTION-PLAN.md)** — product
   backlog after the 23 September 2026 review. Reconciles the Trust & Markets memo,
   the admin-portal spec, and the AI-pipeline request with Phases 49–61. Phases 62–65
   are shipped. T5 / Phase 60 architecture / T8 proceed under locked Dec-* in `12`;
   T6 ledger lines shipped (withdrawal finance-gated); T3 is counsel/deploy. Do not restart T1 or P0.
4. **[03-PRODUCT-AND-RIGHTS.md](./03-PRODUCT-AND-RIGHTS.md)** — recovered May 2026 concept
   (VueKumi marketplace vs VueQuatro rights/agency), the four rights layers, two-approval
   rule, invite-the-model, permission states, and what production actually implements today.
5. **[01-IMPLEMENTATION-PLAN.md](./01-IMPLEMENTATION-PLAN.md)** — living execution plan:
   shipped Phases 0–65 (Arcs A–D complete; through Phase 65 / model-upload prompt parity).
   Default next work: **[13](./13-V21-IMAGERY-CONCEPT-RECOMMENDATIONS-AND-EXECUTION-PLAN.md)**
   Free Contributor track after Dec-FC; technical gates stay in **[12](./12-V2-RECONCILIATION-EXECUTION-PLAN.md)**.
   Do not restart shipped T1/P0 work from older memos.
6. **[05-POST-ARC-D-RECOMMENDATIONS.md](./05-POST-ARC-D-RECOMMENDATIONS.md)** — post–Arc D
   review, recommendations, and ops/decision execution tracks (including Lightsail
   redeploy). Prefer **[13](./13-V21-IMAGERY-CONCEPT-RECOMMENDATIONS-AND-EXECUTION-PLAN.md)** /
   **[12](./12-V2-RECONCILIATION-EXECUTION-PLAN.md)** for current sequencing. Not a licence
   to start work without approval.
7. **[06-OPS-INVENTORY-AND-DECISION-BRIEF.md](./06-OPS-INVENTORY-AND-DECISION-BRIEF.md)** —
   O0 live probe and Dec-* workshop. **Locked:** Dec-Bio, Dec-PayBase, Dec-Split,
   Dec-AfricaElig (see `12`). Still pending: Dec-VQ, Dec-Fee, Dec-AI; plus Dec-FC /
   Dec-Upgrade / Dec-RolePay from **[13](./13-V21-IMAGERY-CONCEPT-RECOMMENDATIONS-AND-EXECUTION-PLAN.md)**.
8. **[07-TRUST-RIGHTS-COMPENSATION-COUNTRY-PLAN.md](./07-TRUST-RIGHTS-COMPENSATION-COUNTRY-PLAN.md)** —
   Trust & Markets plan: `/report-content`, `/rights`, DMCA/repeat ops, likeness
   compensation negotiation, Country Activation Matrix admin. T0–T2 + T4 + T7 foundations
   shipped (Phases 49–53); remainder plan until approved — payment base now locked in `12`.
9. **[08-ADMIN-PORTAL-ENGINEERING-SPEC.md](./08-ADMIN-PORTAL-ENGINEERING-SPEC.md)** —
   Engineering adoption of Admin Portal & Country Activation spec v1.2: three
   control layers, eight modules, Policy Decision Service, P0–P2 tranches.
   **P0 (Phase 49) shipped**; T1–T2 + T4 + T7 (Phases 50–53) shipped; Phase 54 PDS
   license.issue suspend enforcement shipped; Phase 57 quarantine reason codes shipped;
   P1 negotiation (T5/T6) may proceed under Dec-PayBase/Dec-Split in `12` (T6 still finance-gated).
10. **[09-AI-PIPELINE-MULTI-PROVIDER-AND-SUBJECT-DETECTION-PLAN.md](./09-AI-PIPELINE-MULTI-PROVIDER-AND-SUBJECT-DETECTION-PLAN.md)** —
   P1 "AI subjects" + "ID/face provider" made concrete: multi-provider AI
   registry (Phase 58, **shipped**), AI subject quarantine / auto-invite-or-block
   (Phase 59, **shipped**), ID/face verification (Phase 60 — **architecture unblocked
   under Dec-Bio; production activation still gated**), AI-assisted account/content
   approval (Phase 61, **shipped**), image enhancement + uploader recommendations
   (Phase 62, **shipped**, option A), AI analytics/reporting (Phase 63, **shipped**).
   Fail-closed detection (Phase 64) and model-upload parity (Phase 65) shipped — see `10`.
11. **[runbooks/rights-ops.md](./runbooks/rights-ops.md)** — staff rights-ops SOP
   (Phase 51 / T2). Public holder review: `/rights` (Phase 52 / T4).
12. **[04-ADMIN-ACL-AND-SYMMETRIC-RIGHTS.md](./04-ADMIN-ACL-AND-SYMMETRIC-RIGHTS.md)** —
   Arc D procedure (Phases 35–40 shipped). Historical gap tables may lag; prefer §0 locks
   and the shipped status header.
13. **[deploy/lightsail/README.md](../deploy/lightsail/README.md)** — how production is
   actually deployed (Docker on AWS Lightsail); O3/O4 checklists.
14. **[00-CODE-REVIEW.md](./00-CODE-REVIEW.md)** — **archive.** Inventory of the static Noir
   template before the backend existed.
15. **[02-DEPLOYMENT-LIGHTSAIL-DOCKER.md](./02-DEPLOYMENT-LIGHTSAIL-DOCKER.md)** — **archive.**
   Original NestJS/Lightsail sketch; superseded by the deploy README.

**Do not start a new implementation phase until it is explicitly approved.**
**Do not invent undecided Dec-Fee / Dec-VQ / Dec-AI / Dec-FC / Dec-Upgrade / Dec-RolePay
answers, a permanent platform commission rate, or activate biometrics in production
without vendor/DPA/counsel.**
