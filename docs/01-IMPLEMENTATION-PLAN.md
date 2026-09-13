# Vuekumi — Full-Stack Implementation Plan

Companion documents: `00-CODE-REVIEW.md` (what exists and what is broken today) and
`02-DEPLOYMENT-LIGHTSAIL-DOCKER.md` (Docker + AWS Lightsail deployment).

**Status: plan only. No implementation work starts until explicitly approved.**

---

## 1. Objective

Turn the existing static "Noir" template into a production marketplace with three real
audiences — buyers/members, contributors, and staff/admins — keeping the current design
language and information architecture intact. The existing React app becomes the real
frontend (refactored, not rewritten); a new API, database, object storage, payments, and
payouts layer is built behind it; everything runs in Docker and deploys to AWS Lightsail.

Guiding constraints:

1. **Reuse the design.** The palette, typography, motion, and page structure stay. Work is
   refactoring plus new screens in the same visual language.
2. **Contract first.** Frontend and backend are decoupled by an OpenAPI contract plus shared
   TypeScript/Zod types, so the two can progress in parallel and the UI can run against
   mocks until the API lands.
3. **Never regress the demo.** The site must remain runnable and demo-able at every phase;
   `content.ts` is converted into a database seed rather than deleted.
4. **Ship in vertical slices.** Each phase delivers a working end-to-end capability
   (schema → API → UI → tests), not a horizontal layer.

---

## 2. Recommended stack

| Concern | Choice | Why |
| --- | --- | --- |
| Frontend | Keep Vite + React 19 + TS + Tailwind 3 + shadcn/ui | Already built; no reason to migrate |
| Server state | TanStack Query v5 | Caching, cursor pagination for the endless feed, optimistic updates for likes/moderation |
| Forms | react-hook-form + Zod (already installed, unused) | Same schemas reused server-side |
| Routing | react-router 7 with route-level `React.lazy` | Splits Recharts and both portals out of the landing bundle |
| Backend | **NestJS 11 (Node 22, TypeScript)** | One language across the stack, shares Zod schemas and DTOs with the web app, first-class DI/modules that map onto the domains below, mature ecosystem for queues/payments |
| ORM / DB | Prisma + **PostgreSQL 16** | Typed queries, migrations, and Postgres full-text (`tsvector` + `pg_trgm`) is enough for launch-scale search |
| Cache / queues | Redis 7 + BullMQ | Image derivatives, payout batches, emails, analytics rollups, rate limiting |
| Object storage | S3-compatible (AWS S3 or Lightsail bucket; MinIO locally) | Presigned direct uploads, private originals, public derivatives |
| Image pipeline | `sharp` in a worker | AVIF/WebP/JPEG derivatives, watermarked previews, blurhash |
| Search | Postgres FTS at launch; Meilisearch behind an interface if/when facets outgrow it | Avoids a second datastore on day one |
| Auth | Argon2id passwords, short-lived JWT access + rotating refresh token in an httpOnly cookie, optional Google/Apple OAuth, TOTP 2FA required for staff | Matches the login UI already designed |
| Payments (in) | Stripe (cards/subscriptions, international) + Paystack **or** Flutterwave (African cards, bank transfer, mobile money) | The UI already promises mobile money |
| Payouts (out) | Flutterwave/Paystack transfers, M-Pesa, bank transfer — behind one `PayoutProvider` interface | Matches the contributor/admin payout UI |
| Email | Resend or AWS SES; Mailpit locally | Verification, receipts, moderation decisions, payout notices |
| Observability | pino → stdout, Sentry (web + api), `/healthz` + `/readyz`, Prometheus-format `/metrics` | Required before go-live |
| Testing | Vitest + React Testing Library (web), Jest/Vitest + Supertest + Testcontainers (api), Playwright (E2E) | |
| CI/CD | GitHub Actions → build/push images → deploy to Lightsail | See deployment doc |

**Alternative considered:** FastAPI + SQLAlchemy for the API. Equally capable, and preferable
if the team is Python-first, but it loses shared types with the frontend and forces a second
validation implementation. Decision needed at Phase 0 — everything after that assumes NestJS.

---

## 3. Target repository layout

Move to npm workspaces (or pnpm) with Turborepo for task orchestration:

```
vuekumi/
  apps/
    web/                      # the current Vite app, moved from the repo root
    api/                      # NestJS HTTP API
    worker/                   # BullMQ consumers (images, payouts, email, rollups)
  packages/
    shared/                   # Zod schemas, DTO types, enums, currency/format helpers
    config/                   # eslint, tsconfig, tailwind preset shared by apps
  infra/
    docker/                   # Dockerfiles, nginx.conf, Caddyfile, entrypoints
    lightsail/                # container-service json, user-data, deploy scripts
    db/                       # seed + backup/restore scripts
  docs/
  .github/workflows/
```

`money()`/`fmt()` from `src/data/content.ts` and the domain enums (license, role, status)
move into `packages/shared` so the API and UI cannot drift.

**Lower-churn alternative** if the workspace move is unwanted: keep the web app at the repo
root and add `server/` + `shared/` directories. Same architecture, less path churn, worse
tooling ergonomics. Decision needed at Phase 0.

---

## 4. Domain model

Postgres, `snake_case` tables, UUID v7 primary keys, `created_at`/`updated_at` everywhere,
soft delete (`deleted_at`) on user-generated content.

**Identity & access**
`users` (email, email_verified_at, password_hash, display_name, avatar_asset_id, country,
locale, currency, status: active|suspended|deleted, last_login_at) ·
`refresh_tokens` (user_id, token_hash, device, ip, expires_at, revoked_at) ·
`oauth_accounts` (provider, provider_user_id) · `mfa_secrets` ·
`roles` / `permissions` / `role_permissions` / `user_roles` — roles: `member`,
`contributor`, `moderator`, `finance`, `admin`, `superadmin` ·
`audit_logs` (actor_user_id, action, subject_type, subject_id, before, after, ip, ua).

**Contributors**
`contributor_profiles` (user_id, handle, bio, location, website, socials, royalty_rate,
status: pending|approved|rejected|suspended, approved_at) ·
`kyc_submissions` (type, document_asset_id, status, reviewed_by, notes) ·
`payout_methods` (user_id, provider, type: bank|mobile_money, masked_account, currency,
is_default, verified_at).

**Catalog**
`photos` (id, slug, contributor_id, title, description, country_code, category_id,
license: free|premium, price_cents, currency, status: draft|pending|approved|rejected|
unpublished, published_at, width, height, orientation, dominant_color, blurhash,
exif jsonb, ai_generated bool, editorial_only bool, view_count, download_count, like_count,
search_vector tsvector) ·
`photo_assets` (photo_id, kind: original|preview|watermarked|thumb|avif|webp, s3_key, bytes,
width, height, checksum) — originals are **never** publicly readable ·
`categories` (slug, name, position) · `tags` / `photo_tags` · `countries` (iso2, name, region) ·
`model_releases` (photo_id, asset_id, signer_name, verified_by) ·
`collections` / `collection_photos` (curated + user lightboxes, `is_public`) ·
`favorites` (user_id, photo_id) · `follows` (follower_id, contributor_id).

**Commerce**
`license_types` (key: free|premium|extended, name, terms_url, price_cents or price_source,
max_print_run, resale_allowed, indemnified) ·
`subscription_plans` (key: free|plus, price_cents, interval, seats, daily_download_limit,
provider_price_id) · `subscriptions` (user_id, plan_id, provider, provider_subscription_id,
status, current_period_end, cancel_at) ·
`carts` / `cart_items` · `orders` (user_id, status, subtotal_cents, tax_cents, total_cents,
currency, provider, provider_payment_intent_id, invoice_number) ·
`order_items` (order_id, photo_id, license_type_id, unit_price_cents, royalty_cents) ·
`payments` (order_id, provider, provider_ref, amount_cents, status, raw jsonb) ·
`refunds` · `coupons` / `coupon_redemptions` · `invoices` (pdf_asset_id, tax fields) ·
`downloads` (user_id, photo_id, license_type_id, order_item_id nullable, license_certificate_id,
ip, ua, created_at) — the authoritative record of "who may hold this file and under what terms" ·
`license_certificates` (number, pdf_asset_id, issued_to, terms_snapshot jsonb) ·
`webhook_events` (provider, provider_event_id UNIQUE, payload, processed_at) — idempotency.

**Earnings & payouts**
`earnings_ledger` (contributor_id, source: premium_sale|free_pool|bonus|adjustment,
order_item_id nullable, download_id nullable, amount_cents, currency, available_at,
status: pending|available|paid|reversed) — append-only, the single source of truth for
"total earnings", "this month", and "available balance", replacing today's client-side math ·
`payout_batches` (period, status, total_cents, approved_by, executed_at) ·
`payouts` (contributor_id, batch_id, payout_method_id, amount_cents, fee_cents, currency,
fx_rate, provider, provider_ref, status: requested|approved|processing|paid|failed,
failure_reason) · `payout_ledger_entries` (payout_id, earnings_ledger_id).

**Moderation & trust**
`moderation_items` (photo_id, flag: new_submission|quality_review|copyright_check|reported,
priority, assigned_to, sla_due_at, status: open|approved|rejected|escalated) ·
`moderation_decisions` (item_id, moderator_id, decision, reason_code, notes, created_at) ·
`reports` (reporter, subject_type, subject_id, reason, status) ·
`takedown_requests` (DMCA: claimant, contact, statement, status, resolution).

**Platform**
`settings` (key, value jsonb — platform fee, royalty rate, free-pool budget, upload limits,
enabled currencies, feature flags) · `notifications` (user_id, type, payload, read_at) ·
`email_templates` · `pages` (CMS for Terms/Privacy/License/About) ·
`featured_slots` (hero slides, edge strip, curated rails — makes the hardcoded homepage
content admin-editable) · `analytics_daily` (date, metric, dimensions jsonb, value) for the
dashboard charts, populated by a nightly rollup job.

Seed script imports the existing `src/data/content.ts` records (5 photographers, 29 photos,
moderation queue, payouts, users) so local and staging environments look exactly like the
current demo.

---

## 5. API surface

REST, `/api/v1`, JSON, cursor pagination (`?cursor=&limit=`), `ETag`/`Cache-Control` on
public reads, per-IP and per-user rate limits, OpenAPI 3.1 published at `/api/docs`.

**Auth** — `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` ·
`POST /auth/logout` · `POST /auth/verify-email` · `POST /auth/resend-verification` ·
`POST /auth/forgot-password` · `POST /auth/reset-password` · `GET /auth/oauth/:provider` +
`/callback` · `POST /auth/mfa/enroll|verify` · `GET /auth/sessions` · `DELETE /auth/sessions/:id`.

**Public catalog** — `GET /photos` (q, category, country, tags, license, orientation, color,
sort=trending|newest|downloads, cursor) · `GET /photos/:slug` · `GET /photos/:id/related` ·
`GET /categories` · `GET /countries` · `GET /tags/popular` ·
`GET /photographers/:handle` (+ `/photos`) · `GET /featured/:slot` · `GET /plans` ·
`GET /pages/:slug`.

**Member** — `GET/PATCH /me` · `POST /me/avatar` · `PATCH /me/password` ·
`GET /me/downloads` · `GET /me/licenses/:id/certificate` ·
`GET/POST/DELETE /me/favorites` · CRUD `/me/collections` · `POST/DELETE /photos/:id/like` ·
`POST/DELETE /photographers/:handle/follow` · `GET /me/notifications` ·
`POST /photos/:id/download` → signed, expiring URL (enforces plan/daily quota, writes
`downloads` + issues a licence certificate) · `GET /me/subscription` ·
`POST /me/subscription/cancel` · `GET /me/invoices`.

**Checkout** — `GET/POST/DELETE /cart/items` · `POST /checkout/session` (Stripe or
Paystack/Flutterwave) · `POST /checkout/subscribe` · `GET /orders` · `GET /orders/:id` ·
`POST /webhooks/stripe` · `POST /webhooks/paystack` · `POST /webhooks/flutterwave`
(signature-verified, idempotent via `webhook_events`).

**Contributor** — `POST /contributor/apply` · `GET/PATCH /contributor/profile` ·
`POST /contributor/uploads/presign` (batch) · `POST /contributor/photos` (create draft from
uploaded asset) · `PATCH /contributor/photos/:id` · `POST /contributor/photos/:id/submit` ·
`POST /contributor/photos/:id/unpublish` · `DELETE /contributor/photos/:id` ·
`GET /contributor/photos` (status filters, pagination — replaces the portfolio table's
client-side filtering) · `GET /contributor/stats` · `GET /contributor/earnings` (series +
ledger) · `GET/POST /contributor/payout-methods` · `POST /contributor/payouts/request` ·
`GET /contributor/payouts` · `POST /contributor/kyc`.

**Admin** (all require role + 2FA; every mutation writes an `audit_log`) —
`GET /admin/metrics/overview` · `GET /admin/metrics/revenue` ·
`GET /admin/moderation` (filters, assignment) · `POST /admin/moderation/:id/decision`
(approve | reject + reason_code | escalate) · `POST /admin/moderation/bulk` ·
`GET/PATCH /admin/users/:id` (role, status) · `POST /admin/users/:id/suspend|reinstate` ·
`POST /admin/users/invite` · `GET /admin/photos` + `PATCH /admin/photos/:id`
(metadata, price, license, feature) · CRUD `/admin/categories`, `/admin/tags`,
`/admin/collections`, `/admin/featured/:slot`, `/admin/plans`, `/admin/license-types`,
`/admin/coupons`, `/admin/pages` · `GET /admin/orders` + `POST /admin/orders/:id/refund` ·
`GET /admin/payouts` · `POST /admin/payout-batches` ·
`POST /admin/payout-batches/:id/approve|execute` · `POST /admin/payouts/:id/mark-paid|retry` ·
`GET /admin/reports` + `POST /admin/reports/:id/resolve` · `GET/POST /admin/takedowns` ·
`GET/PATCH /admin/settings` · `GET /admin/audit-logs` · `POST /admin/exports/:kind`.

---

## 6. Phased execution plan

Each phase is a reviewable PR series with its own acceptance criteria. Sequencing reflects
dependencies, not calendar time.

### Phase 0 — Decisions and scaffolding (blocking)
Confirm: backend language (NestJS assumed), monorepo vs `server/` layout, payment providers
per market, primary AWS region (`af-south-1` Cape Town for latency vs `eu-west-1` for the
widest service availability — note Lightsail container services are **not** available in
every region, verify before committing), domain names, revenue-share model (reconcile the
50%/32%/50% inconsistency), and whether SEO needs SSR (Next.js migration) or
prerendering is sufficient.
Deliverables: signed-off ADRs in `docs/adr/`, `.env.example`, issue/epic breakdown.

### Phase 1 — Frontend hardening (no backend dependency)
Fix everything in `00-CODE-REVIEW.md` §3 and prepare the app to talk to an API.
- Regenerate `package-lock.json` against `https://registry.npmjs.org` — the committed lockfile has 125 entries resolving to a private mirror (`npm.mirrors.msh.team`) and `npm ci` fails outside that network, which would break CI and every Docker build.
- Fix `w-13`, `has-checked:` → `has-[:checked]:`, `bg-noir-soft/90`; consolidate the whole palette (including `-soft`/`-faint` variants) into `tailwind.config.js` and delete the duplicated literal utilities from `index.css`.
- Fix the "AfriStock" footer wordmark; unify plan naming between the landing page and `/pricing`; remove all "Template UI — wire to…" placeholder copy as features land.
- Merge `NoirHeader` and `SiteHeader` into one auth-aware `<SiteHeader variant="noir|paper">`; remove `/admin` and `/contributor` from public navigation; add a real user menu.
- Add `ErrorBoundary`, a proper 404 route, loading skeletons, empty states, and `sonner` toasts.
- Make `photographerOf` return `undefined`-safe; add `StatusPill` styles for `approved`/`rejected`; delete dead code (`usePhotoById`, unused `categories` export, `dark` StatCard prop, orphan CSS).
- Move `kimi-plugin-inspect-react` behind `mode === 'development'`.
- Introduce `src/lib/env.ts` (typed `import.meta.env`), route-level code splitting, and self-hosted fonts.
- Accessibility pass: real `<label>`s, focus-visible styles, `aria-current`, table semantics, contrast fixes, reduced-motion coverage.
- Add Vitest + RTL with smoke tests per route, and a GitHub Actions job running typecheck + lint + test + build.
Acceptance: `npm ci && npm run build && npm run lint && npm test` green on a clean machine; Lighthouse a11y ≥ 95 on `/`, `/pricing`, `/photo/:id`.

### Phase 2 — Contract and mock layer
Write the OpenAPI 3.1 spec and the `packages/shared` Zod schemas; generate the typed client;
stand up MSW handlers backed by the existing mock records; refactor every page to read
through TanStack Query hooks (`usePhotos`, `usePhoto`, `useContributorStats`, …) instead of
importing `content.ts` directly. Convert `InfiniteFeed` to real `useInfiniteQuery` cursor
pagination and add the search/filter UI (`/search` with facets, sortable, URL-synced) plus
category/country/tag browse pages and public photographer profiles.
Acceptance: no page imports `content.ts`; the app runs identically against MSW; toggling
`VITE_API_URL` switches to a real backend with no component changes.

### Phase 3 — Backend foundation
Monorepo migration, NestJS app skeleton, Prisma schema + first migration for identity/access,
Argon2id auth with refresh rotation, email verification and password reset, RBAC guards,
`/healthz`, structured logging, error envelope, rate limiting, OpenAPI generation from the
same Zod schemas, seed script from `content.ts`, and `docker-compose.dev.yml`
(postgres + redis + minio + mailpit + api + web).
Acceptance: `docker compose up` gives a working login/register/me flow against Postgres;
Supertest suite covers the auth matrix; frontend auth screens work against the real API with
guarded routes and role-aware navigation.

### Phase 4 — Media pipeline
Presigned multipart uploads, `sharp` worker producing thumb/preview/watermarked/AVIF/WebP
derivatives + blurhash, EXIF/IPTC extraction, perceptual-hash duplicate detection, private
originals with signed time-limited download URLs, quota enforcement, virus/content scanning
hook, and the real contributor upload flow (per-file progress, per-file metadata, drafts).
Acceptance: an image uploaded through the UI appears with derivatives in storage; the
original is unreachable without a signed URL; premium previews are watermarked.

### Phase 5 — Catalog and search
Photos CRUD + lifecycle (draft → pending → approved/rejected → published/unpublished),
taxonomy, Postgres FTS with facets and trigram fuzzy matching, trending/newest/downloads
sorts, related-photo query, favourites, collections/lightboxes, follows, view/download
counters (buffered through Redis), sitemap + per-photo meta/OG/JSON-LD, and prerender or SSR
for public routes per the Phase 0 decision.
Acceptance: search returns correct facet counts under seeded data; the endless feed paginates
without duplicates; a photo page renders crawlable metadata.

### Phase 6 — Commerce
License types, cart, Stripe + Paystack/Flutterwave checkout, subscriptions with plan limits
and daily download quotas, signature-verified idempotent webhooks, orders/invoices/receipts,
licence certificate PDFs, refunds, coupons, and the member "downloads & licenses" area.
Every completed sale writes an `earnings_ledger` row.
Acceptance: end-to-end purchase in provider sandboxes for card, bank transfer, and mobile
money; replayed webhooks are no-ops; refund reverses the ledger entry.

### Phase 7 — Contributor economics
Application/onboarding, KYC, payout methods, real earnings aggregation from the ledger
(replacing every hardcoded figure and client-side multiplier), payout requests, statement
export, and per-image analytics.
Acceptance: the contributor dashboard/earnings figures reconcile exactly with ledger sums;
a payout request appears in the admin queue.

### Phase 8 — Admin platform (largest phase)
Staff login with mandatory 2FA and RBAC; moderation workflow with assignment, SLA,
reason codes, notes, bulk actions, full-size inspection, EXIF/duplicate panels, and
notification emails; user management with detail view, role editing, invitations, suspension,
and activity history; content management (metadata, pricing, featuring, curated collections,
homepage hero/strip slots); taxonomy, plans, license types, and coupon management; orders and
refunds; payout batching with dual-control approval and provider execution; reports and DMCA
takedowns; settings; CMS pages; audit log viewer; CSV/XLSX exports; dashboards driven by the
`analytics_daily` rollups.
Acceptance: every action in the current admin UI performs a real, audited state change; no
privileged route is reachable without the right role; a moderator cannot execute payouts.

### Phase 9 — Integration, QA, and cutover
Delete MSW from production paths, replace all remaining mock data, Playwright E2E for the
critical journeys (browse → licence → pay → download; upload → moderate → publish → earn →
payout), load test the feed and search, accessibility and security audits (OWASP ASVS L2
checklist, dependency scan, secret scan), performance budgets, and error-budget/alerting setup.

### Phase 10 — Deployment and go-live
Per `02-DEPLOYMENT-LIGHTSAIL-DOCKER.md`: staging on Lightsail, then production, with TLS,
backups, monitoring, runbooks, and a go-live checklist (licensed imagery replacing the demo
photos, legal pages published, payment providers in live mode, DNS/email deliverability).

---

## 7. Cross-cutting requirements

**Security.** Argon2id; JWT access ≤15 min with rotating refresh tokens bound to device and
revocable; httpOnly/Secure/SameSite cookies; CSRF protection on cookie-authed mutations;
strict CSP plus HSTS, `X-Content-Type-Options`, `Referrer-Policy`, and
`Permissions-Policy`; per-route rate limits and bot protection on auth and download
endpoints; input validation on every boundary via shared Zod schemas; signed, short-lived,
single-use download URLs; hotlink protection; secrets only via environment/parameter store,
never in the repo; dependency and container scanning in CI; audit logging on every
privileged action; PII minimisation and a documented retention policy; PCI scope kept at
SAQ-A by never touching card data.

**Performance.** Route-level code splitting (Recharts and both portals out of the initial
bundle); AVIF/WebP with `srcset`/`sizes` and blurhash placeholders; CDN in front of
derivatives; HTTP caching plus ETags on public reads; Redis caching for hot queries;
buffered counters; DB indexes on every filter/sort path (including a GIN index on
`search_vector`); budgets — LCP < 2.5 s on 4G, initial JS < 200 KB gzip for the landing page.

**Testing.** Unit (Vitest/Jest) for domain logic — pricing, royalty split, quotas, ledger;
integration (Supertest + Testcontainers) for every endpoint including auth and webhooks;
component tests for forms and tables; Playwright for the two critical journeys; contract
tests asserting the implementation matches OpenAPI. Target ≥80% coverage on
commerce/earnings/auth modules; CI blocks merge on failure.

**Data and compliance.** Copyright and model-release records per photo; DMCA process;
GDPR-style data export and deletion; consent/cookie banner; tax handling (VAT/withholding)
decided with finance; contributor agreement versioning with re-acceptance on change.

**Operations.** Migrations run as a separate step, never on container start in production;
zero-downtime deploys with health-gated rollover; nightly logical backups plus snapshots with
a *tested* restore; runbooks for failed payouts, webhook replay, stuck image jobs, and
rollback; on-call alerting on error rate, queue depth, payment failures, and disk.

---

## 8. Key risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Committed lockfile resolves to a private npm mirror | Docker/CI builds fail outside that network | Regenerate the lockfile in Phase 1 and pin the public registry in `.npmrc` |
| Payments/payouts across many African rails | High complexity, real money | Abstract behind provider interfaces; launch with one in-provider and one out-provider; sandbox-first; dual-control on payouts |
| SEO for a stock library on a client-only SPA | Organic discovery is the main acquisition channel | Decide SSR vs prerender at Phase 0, before catalog work |
| Premium originals leaking | Direct revenue loss | Private buckets, signed single-use URLs, watermarked previews, hotlink protection, download audit |
| Single-instance Lightsail deployment | Downtime, data loss | Managed database + object storage from the start; documented scale-out path; tested restores |
| Scope of the admin phase | Schedule risk | Sequence admin work by dependency: moderation and payouts first (they exist in the UI), CMS/exports last |
| Mock-shaped UI misleading the schema | Rework | Contract-first Phase 2 with review by both sides before backend build |

---

## 9. Baseline verification

Measured on a clean checkout of this branch (Node 22.14, npm 10.9):

- `npm ci` **fails**. 125 lockfile entries resolve to `https://npm.mirrors.msh.team/...`, which does not resolve outside that network (`ENOTFOUND`), and npm aborts with "Exit handler never called". Regenerating the lockfile against the public registry (`npm install --registry=https://registry.npmjs.org`) succeeds in ~20 s / 469 packages. Phase 1 must fix this first — every Docker build and CI job depends on `npm ci`.
- `npm run build` (`tsc -b && vite build`) **passes**: 665 modules, `dist` = 774 KB JS (217 KB gzip) + 86 KB CSS (15 KB gzip). Vite warns that the single chunk exceeds 500 KB — this is the code-splitting item in Phase 1, and it will get worse once TanStack Query and the new screens land.
- `npx eslint .` **fails with 10 errors**, all pre-existing:
  - 7 × `react-refresh/only-export-components` — `src/pages/Admin.tsx:36` (`adminLinks`), `src/pages/Contributor.tsx:38` (`contributorLinks`) and `:416` (`usePhotoById`), plus 5 shadcn files (`badge`, `button`, `button-group`, `form`, `navigation-menu`) that export variance helpers alongside components.
  - 2 × `react-hooks/set-state-in-effect` — `src/hooks/use-mobile.ts:14` and `src/components/ui/carousel.tsx:96`.
  - 1 further error in the same families.
  Fix by moving the exported constants/hooks into sibling modules (`admin.links.ts`, `contributor.links.ts`) or by deleting the dead ones, and by deriving initial state instead of setting it in an effect. Lint must be green before it becomes a CI gate.

These three results are the acceptance baseline for the first PR: `npm ci`, `npm run build`,
and `npm run lint` all green on a machine with no prior state.
