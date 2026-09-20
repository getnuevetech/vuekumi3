# Rights operations SOP (staff)

Phase 51 / T2. Companion to [`07-TRUST-RIGHTS-COMPENSATION-COUNTRY-PLAN.md`](../07-TRUST-RIGHTS-COMPENSATION-COUNTRY-PLAN.md) §8.
Admin intake: `/admin/reports` (rights & safety) and `/admin/dmca` (copyright statutory only).

**Do not invent Dec-PayBase, biometric vendors, or entity forms in this runbook.**

---

## 1. Intake & category classification

1. Open `/admin/reports` (open queue). Safety (`urgent`) sorts first.
2. Confirm the category matches the public hub taxonomy:
   - Copyright → may also need a formal `/dmca` notice (separate form)
   - Likeness / unauthorized use → likeness track only
   - Fraudulent release → fraud / strikes track
   - Safety urgent → fast-path; do not park in ordinary copyright
   - Compensation dispute → freeze new sales; no fee invention
3. Set stage to **assessing** when a reviewer starts work (auto on freeze / preserve).

## 2. Urgency assessment

| Signal | Action |
| --- | --- |
| `urgent` / safety category | Fast-path; notify ops immediately; preserve evidence first |
| Ordinary copyright / likeness | Standard SLA; freeze if commercial risk |
| Immediate physical danger | Contact local emergency services; platform freeze is not a substitute |

## 3. Evidence preservation

Use **Preserve** on the report before major investigation edits:

- Timestamp + optional notes (`evidencePreservedAt` / `evidenceNotes`)
- Do not delete originals, listings, or audit rows to “tidy” a case
- Selfie / Stage 3 vision: Phase 28 discard-forever still applies until Dec-Bio

## 4. Licensing suspension / commercial freeze

- **Freeze** pauses new licences and quotes; the photograph stays visible
- Existing certificates are **not** revoked by freeze alone
- Earnings holds follow report reason (copyright / likeness / safety)

## 5. Investigation

- Move stage to **investigating** after preserve (or when staff notes first substantive review)
- Keep DMCA and likeness facts separate in notes
- Record findings in staff notes; every decide action writes an audit log

## 6. User notifications

Use **Notify** when the reporter (or other party) should be told of status.

- Sets `notifiedAt`; put email/channel detail in notes
- Prefer ops inbox / Resend when configured; do not invent legal letterhead

## 7. Escalation (legal / law enforcement)

Use **Escalate** with a target:

- `legal` / `counsel` — counsel review
- `law_enforcement` — only when appropriate; document jurisdiction in notes
- `other` — requires a note explaining the path

Escalation does **not** invent strikes. Strikes remain upheld-fraud only (`/admin/dmca` strike form).

## 8. DMCA counter-notice handling

- DMCA queue is **copyright only**
- Counter-notice starts a staff restore clock (default ~14 business days) — **restore is never automatic**
- A DMCA counter-notice **does not** clear likeness or safety holds on the same photo
- Admin **Unlock** on a rights report is blocked while an open DMCA notice still holds the photo

## 9. Repeat-infringer & serious-fraud decisions

- Strikes: fake release, fake photographer, false creation claim, upheld copyright/likeness fraud
- Threshold is Admin Settings (default 3); reaching it suspends the account
- A DMCA notice alone is not a strike

## 10. Closure & audit

- **Resolve** or **Dismiss** closes the report (`sopStage=closed`)
- Confirm freeze state matches outcome (unlock only when safe and no open DMCA hold)
- Audit log retains actor, action, report id, and notes

---

## Track separation (hard rules)

| Track | Surface | Clears likeness/safety? |
| --- | --- | --- |
| Rights report | `/admin/reports` | Own resolve/dismiss only |
| Holder review | `/rights` (Phase 52 / T4) | Guest/model approve/reject only |
| DMCA | `/admin/dmca` | **Never** |
| Strikes | `/admin/dmca` strike form | N/A — fraud only |
