# VueKumi — ops inventory (O0) and decision workshop brief

**Status: evidence + decision prompts only. Do not invent rates, vendors,
retention windows, or a VueQuatro entity form.** Companion to
[`05-POST-ARC-D-RECOMMENDATIONS.md`](./05-POST-ARC-D-RECOMMENDATIONS.md) and
[`03-PRODUCT-AND-RIGHTS.md`](./03-PRODUCT-AND-RIGHTS.md) §10.

Phase 46 ships this note. It does **not** close Track O2 (host SHA still
unverified) and does **not** close any Dec-* gate.

---

## 1. Track O0 — live inventory (19 September 2026)

Probed from outside the host against `http://vuekumi.com` (A record
`34.227.43.158`). No SSH, no AWS console. Git SHA on the instance was **not**
readable.

### 1.1 Scheme and cookies

| Check | Result |
| --- | --- |
| `https://vuekumi.com` | **Fails** — TLS handshake `SSL_ERROR_SYSCALL` (port 443 open, cert/handshake broken) |
| `http://vuekumi.com/api/health` | `200` `{"status":"ok","service":"vuekumi-api"}` |
| `http://vuekumi.com/api/ready` | `200` |
| Admin login over HTTP | `200`; `Set-Cookie` for access/refresh is `HttpOnly; SameSite=Lax` **without** `Secure` |

HTTP-only cookies match the cookie fix on `main` when `WEB_URL` is `http://…`.
Do **not** flip `WEB_URL` to `https://…` until TLS actually works, or admin
sessions will break again.

### 1.2 What appears already live (route/shape evidence)

Unauthenticated and authenticated probes (demo admin) show these surfaces
respond with real handlers — not nginx 404s:

| Surface | Evidence |
| --- | --- |
| Public home + featured slot shape | `GET /api/public/home` returns `featured.hero/edge/editorial/pricing/statsBackground` |
| Admin homepage pins (Phase 41) | `GET /api/admin/homepage` → capacities/pins/slots |
| Admin bookings / campaigns (Phase 42) | `200` with empty `items` |
| Admin representation (Phase 31) | `200` with empty `items` / `inquiries` |
| Partner keys (Phase 33) | One revoked key `vk_live_0a4c578…` named `AGTest` |
| Legal standard + DMCA (Phases 39–40) | Public `200` payloads |
| ACL capabilities | Super-admin includes `content.featured`, `bookings.list`, `campaigns.list`, `content.impersonate_creator`, `dmca.manage`, etc. |
| Contributor share config | `contributorShare: 0.5` (unchanged 50/50) |
| Commercial freeze honesty | People photos `afr-007` / `afr-001`: commercial `offered=false`; editorial still offered |

Rough live counts from admin overview: **15 users**, **6 contributors**,
**29 photos live**, **1 pending review**, **$0** month revenue.

### 1.3 Gaps vs current `main` (still open)

| Gap | Severity | Owner |
| --- | --- | --- |
| Host git SHA / migration head unknown (needs SSH) | High (ops truth) | O2 on-host |
| HTTPS broken while DNS points at the instance | **Critical** | O3 TLS |
| Demo admin `admin@vuekumi.com` / `Admin123!` still works | **Critical** | O3 rotate |
| Booking / campaign / representation queues empty (Phase 44 seed fixtures are local/CI only — correct for prod) | Info | — |
| No production partner live key (only revoked AGTest) | Info | Staff when a real partner needs access |
| Playwright smoke is CI-only; not a substitute for O4 on the live URL | Medium | O4 |

### 1.4 O0 conclusion

Production is **not** stuck on a pre–Rights-2.0 binary. Public and admin API
shapes for Phases 31–43 (and homepage pins) are responding on HTTP. The
remaining ops bottleneck is **TLS + secret hygiene + on-host SHA confirm**,
not missing feature code on the box.

Suggested next ops order (still needs host access for redeploy/TLS):

1. SSH → `git rev-parse --short HEAD` and compare to `main`
2. If behind: Catch-up redeploy (**no** `SEED_DEMO=1`)
3. Rotate demo admin password; confirm Admin Settings keys
4. Fix TLS (`ssl-init.sh` / certs) then set `WEB_URL=https://vuekumi.com` and redeploy
5. Sign O4 smoke on the live URL

Details: [`deploy/lightsail/README.md`](../deploy/lightsail/README.md) § O3/O4.

---

## 2. Decision workshop brief (Track Decision)

Fill one row per decision in a product/counsel meeting. **Leave Chosen blank
until a human signs it.** Do not treat seed copy, README demos, or this file as
a decision.

Optional meeting order (from `05` R4): Dec-VQ → Dec-Split → Dec-Fee → Dec-Bio →
Dec-AI.

### Dec-VQ — VueQuatro form

| | |
| --- | --- |
| **Question** | Is VueQuatro staff mode only, a legal contracting entity, or a separate public app? |
| **Shipped today** | Phase 31 **staff mode** only (`/admin/representation`). No second brand, no public VueQuatro app, **zero** representation fee. |
| **Options (pick one)** | (A) Confirm staff-mode-only for the foreseeable product. (B) Legal entity / DBA for contracts while UI stays staff mode. (C) Separate public app (requires brand + auth + counsel plan). |
| **Unblocks** | Contracts, counsel filing, marketing, representation billing shape |
| **Chosen** | _pending_ |
| **Signed by / date** | |

### Dec-Split — model party-to-sale revenue

| | |
| --- | --- |
| **Question** | When a model is party to a sale, do models earn — and if so, how does photographer / model / platform split? |
| **Shipped today** | Models **do not earn**. Photographer **50%** of paid licences; platform 50%. Ledger unchanged. |
| **Options (pick one)** | (A) Confirm models never earn (update marketing only). (B) Introduce a model share — **write the three percentages; they must sum to 100%**. (C) Defer with an explicit “revisit when…” trigger. |
| **Unblocks** | `EarningsLedger`, payouts UI, contributor/model copy |
| **Chosen** | _pending_ |
| **Signed by / date** | |

### Dec-Fee — booking / production / representation commission

| | |
| --- | --- |
| **Question** | Platform fee on bookings, brand campaigns, and representation — or forever-zero + off-platform settlement? |
| **Shipped today** | Phases 30 / 31 / 32: **zero** fee; settlement off-platform; money never touches the earnings ledger; accept does **not** grant a licence. |
| **Options (pick one)** | (A) Confirm forever-zero + off-platform. (B) Record-only invoicing (still no ledger payout). (C) Platform fee — **write the rate(s) per product; do not leave blank**. |
| **Unblocks** | Payment rails, invoices, agency billing |
| **Chosen** | _pending_ |
| **Signed by / date** | |

### Dec-Bio — biometric vendor + retention

| | |
| --- | --- |
| **Question** | Dedicated biometric vendor and numbered selfie retention, or keep discard-forever Stage 3? |
| **Shipped today** | Phase 28: voluntary check, **result only**, selfie discarded immediately; OpenAI vision when configured. Similarity ≠ release. No public face DB. |
| **Options (pick one)** | (A) Confirm discard-forever + current vision path. (B) Named vendor + retention days (both required). (C) Disable Stage 3 until counsel signs a vendor. |
| **Unblocks** | Phase 28 hardening / vendor swap / embedding store |
| **Chosen** | _pending_ |
| **Signed by / date** | |

### Dec-AI — dataset pricing / sell training access

| | |
| --- | --- |
| **Question** | Sell AI-training access as a SKU, and at what price / terms? |
| **Shipped today** | Phase 34 consent engine only; **not sold**; buyer grants stamp `ai_training: false`; partner API forbids training; minors never eligible. |
| **Options (pick one)** | (A) Confirm not sold until further notice. (B) Sell — **write price, grant shape, partner terms change**. (C) Defer until consent volume threshold X (define X). |
| **Unblocks** | Dataset SKU, grant flags, partner terms |
| **Chosen** | _pending_ |
| **Signed by / date** | |

### Workshop output rule

After the meeting, paste Chosen + signer into this file (or link a counsel memo)
and only then promote related Track E work into
[`01-IMPLEMENTATION-PLAN.md`](./01-IMPLEMENTATION-PLAN.md) as a numbered phase.
Until then, keep 50/50, zero booking/campaign/representation fees, discard-selfie
Stage 3, and VueQuatro as staff mode in product UI and marketing.

---

## 3. Explicit non-goals of Phase 46

- Inventing any undecided rate, vendor, retention window, or entity form
- Rotating production secrets from this document alone (human ops on the host)
- Claiming O2 closed without an on-host `git rev-parse` match to `main`
- Running `SEED_DEMO=1` on production
