import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import type { CommercialLockReasonCode, PermissionState, RightsLedgerDto } from '@vuekumi/shared'
import {
  COMMERCIAL_LOCK_REASON_CODES,
  COMMERCIAL_LOCK_REASON_LABEL,
  MODEL_APPEARANCE_LABEL,
  LIKENESS_CHECK_LABEL,
} from '@vuekumi/shared'
import { StatusPill } from '../components/shared'
import { PermissionStateField } from '../components/PermissionStateField'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { api, ApiError, type AdminContentDetail, type AdminContentRow } from '../api/client'
import { AiSuggestPanel } from '../components/AiSuggestPanel'
import { AdminShell } from './Admin'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell subtitle="Content library and four-layer rights.">
      {children}
    </AdminShell>
  )
}

export function AdminContent() {
  const [params] = useSearchParams()
  const category = params.get('category') ?? ''
  const [q, setQ] = useState('')
  const [lockedOnly, setLockedOnly] = useState(false)
  const [items, setItems] = useState<AdminContentRow[]>([])
  const [total, setTotal] = useState(0)
  const [detail, setDetail] = useState<AdminContentDetail | null>(null)
  const [ledger, setLedger] = useState<RightsLedgerDto | null>(null)
  const [quoteUsd, setQuoteUsd] = useState('')
  const [restrictionNotes, setRestrictionNotes] = useState('')
  const [lockReason, setLockReason] = useState<CommercialLockReasonCode>('staff_quarantine')

  const load = () => {
    api.adminContent({ q, locked: lockedOnly || undefined, category: category || undefined }).then((d) => {
      setItems(d.items)
      setTotal(d.total)
    }).catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load'))
  }

  useEffect(() => { load() }, [q, lockedOnly, category])

  const open = (id: string) => {
    api.adminContentDetail(id).then((next) => {
      setDetail(next)
      setRestrictionNotes(next.photo.restrictionNotes ?? '')
      const existing = next.photo.commercialLockReason
      if (existing && (COMMERCIAL_LOCK_REASON_CODES as readonly string[]).includes(existing)) {
        setLockReason(existing as CommercialLockReasonCode)
      } else {
        setLockReason('staff_quarantine')
      }
    }).catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed'))
    api.adminRightsLedger(id)
      .then((next) => setLedger(next.ledger))
      .catch(() => setLedger(null))
  }

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">{category || 'Content'}</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">{category ? `${category}.` : 'Library & rights.'}</h1>
      <p className="mt-1 text-sm text-ink-soft">{total} photographs{category ? ` in ${category}` : ''}. Click a row for the rights panel.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, country, id…"
          className="w-full max-w-xs rounded-full border border-sand-soft bg-white px-4 py-2 text-sm outline-none focus:border-terra"
        />
        <label className="flex items-center gap-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft">
          <input
            type="checkbox"
            checked={lockedOnly}
            onChange={(e) => setLockedOnly(e.target.checked)}
            className="accent-terra"
          />
          Quarantine only
        </label>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-sand-soft bg-white">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr className="border-b border-sand-soft font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">
              {['Image', 'Licence', 'Permission', 'People', 'Two-party', 'Copyright', 'Platform', 'Status'].map((c) => (
                <th key={c} className="px-4 py-3 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} onClick={() => open(p.id)} className="cursor-pointer border-b border-sand-soft last:border-0 hover:bg-cream/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img src={p.src} alt="" className="h-11 w-14 rounded-lg object-cover" />
                    <div>
                      <p className="font-medium">{p.title}</p>
                      <p className="font-mono-tech text-[10px] text-ink-faint">{p.id} · @{p.photographer}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><StatusPill status={p.license} /></td>
                <td className="px-4 py-3"><StatusPill status={p.permissionState ?? (p.exclusiveAvailable ? 'exclusive' : 'commercial')} /></td>
                <td className="px-4 py-3">{p.hasRecognizablePeople ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3">
                  <StatusPill
                    status={
                      !p.hasRecognizablePeople
                        ? 'not_required'
                        : p.rights?.twoPartyCleared
                          ? 'cleared'
                          : 'waiting'
                    }
                  />
                </td>
                <td className="px-4 py-3">{p.rights?.copyrightVerified ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3">{p.rights?.platformRightsOk ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <StatusPill status={p.status} />
                    {p.commercialLocked && <StatusPill status="locked" />}
                  </div>
                  {p.commercialLocked && p.commercialLockReason && (
                    <p className="mt-1 font-mono-tech text-[10px] text-ink-faint">
                      {(COMMERCIAL_LOCK_REASON_LABEL as Record<string, string>)[p.commercialLockReason]
                        ?? p.commercialLockReason}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null) }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.photo.title}</SheetTitle>
              </SheetHeader>
              <img src={detail.photo.src} alt="" className="mt-4 h-40 w-full rounded-xl object-cover" />
              <div className="mt-4">
                <AiSuggestPanel
                  photoId={detail.photo.id}
                  onApplied={() => { open(detail.photo.id); load() }}
                />
              </div>
              <p className="mt-3 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                {detail.photo.id} · @{detail.photo.photographer}
              </p>

              <div className="mt-4 space-y-2 text-sm">
                <p><span className="text-ink-soft">Copyright holder</span> · {detail.photo.rights?.copyrightHolder ?? '—'}</p>
                <p><span className="text-ink-soft">Copyright quality</span> · {detail.photo.rights?.copyrightStatus ?? '—'}</p>
                <p><span className="text-ink-soft">Who took this</span> · {(detail.photo.rights?.creationClaim ?? 'self_created').replaceAll('_', ' ')}</p>
                <p><span className="text-ink-soft">Commercial</span> · {detail.photo.rights?.commercialEligible ? 'Eligible' : 'Locked'}</p>
                <p><span className="text-ink-soft">AI-training consent</span> · {detail.photo.rights?.aiTrainingEligible ? 'Recorded (not sold)' : (detail.photo.rights?.aiTrainingBlock ?? 'Not opted in')}</p>
                <p><span className="text-ink-soft">Public mark</span> · {detail.photo.rights?.rightsVerified ? 'Rights Verified ✓' : 'None'}</p>
                <p><span className="text-ink-soft">Live ready</span> · {detail.photo.rights?.liveReady ? 'Yes' : (detail.photo.rights?.liveBlockers ?? []).join('; ') || 'No'}</p>
                <p>
                  <span className="text-ink-soft">Two-party commercial</span>
                  {' · '}
                  {detail.photo.rights?.twoPartyCleared
                    ? `Cleared${detail.photo.rights.processVerifiedAt ? ' · process verified' : ''}`
                    : detail.photo.rights?.twoPartyBlocker ?? 'Waiting on photographer and model approval'}
                </p>
                {detail.photo.commercialLocked && (
                  <p>
                    <span className="text-ink-soft">Quarantine</span>
                    {' · '}
                    {(COMMERCIAL_LOCK_REASON_LABEL as Record<string, string>)[detail.photo.commercialLockReason ?? '']
                      ?? detail.photo.commercialLockReason
                      ?? 'Frozen'}
                  </p>
                )}
              </div>

              <div className="mt-4">
                <PermissionStateField
                  actor="admin"
                  value={detail.photo.permissionState ?? 'commercial'}
                  notes={restrictionNotes}
                  onNotes={setRestrictionNotes}
                  onChange={(state: PermissionState) => {
                    api.patchRights(detail.photo.id, {
                      permissionState: state,
                      exclusiveAvailable: state === 'exclusive',
                      restrictionNotes: state === 'restricted' ? restrictionNotes || null : restrictionNotes || null,
                    }).then(() => { open(detail.photo.id); load() })
                      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not update permission'))
                  }}
                />
                {detail.photo.permissionState === 'restricted' && (
                  <button
                    type="button"
                    onClick={() => {
                      api.patchRights(detail.photo.id, { restrictionNotes: restrictionNotes || null })
                        .then(() => {
                          toast.success('Restriction notes saved')
                          open(detail.photo.id)
                          load()
                        })
                        .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not save notes'))
                    }}
                    className="mt-2 rounded-full border border-sand px-4 py-1.5 font-mono-tech text-[10px] uppercase"
                  >
                    Save restriction notes
                  </button>
                )}
              </div>

              {!detail.photo.commercialLocked && (
                <div className="mt-4">
                  <label className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                    Quarantine reason
                  </label>
                  <select
                    value={lockReason}
                    onChange={(e) => setLockReason(e.target.value as CommercialLockReasonCode)}
                    className="mt-1 w-full border border-sand bg-white px-3 py-2 text-sm"
                  >
                    {COMMERCIAL_LOCK_REASON_CODES.map((code) => (
                      <option key={code} value={code}>{COMMERCIAL_LOCK_REASON_LABEL[code]}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => api.patchRights(detail.photo.id, { copyrightVerified: !detail.photo.rights?.copyrightVerified }).then(() => open(detail.photo.id)).then(load)}
                  className="rounded-full border border-sand px-4 py-1.5 font-mono-tech text-[10px] uppercase"
                >
                  Toggle copyright
                </button>
                <button
                  type="button"
                  onClick={() => api.patchRights(detail.photo.id, { exclusiveAvailable: !detail.photo.exclusiveAvailable }).then(() => open(detail.photo.id)).then(load)}
                  className="rounded-full border border-sand px-4 py-1.5 font-mono-tech text-[10px] uppercase"
                >
                  Toggle exclusive opt-in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const locked = !detail.photo.commercialLocked
                    api.setCommercialLock(detail.photo.id, locked, locked ? { reason: lockReason } : undefined)
                      .then(() => {
                        toast.success(locked ? 'Licensing frozen' : 'Licensing restored')
                        open(detail.photo.id)
                        load()
                      })
                      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not update lock'))
                  }}
                  className="rounded-full border border-sand px-4 py-1.5 font-mono-tech text-[10px] uppercase"
                >
                  {detail.photo.commercialLocked ? 'Unlock licensing' : 'Freeze licensing'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    api.verifyTwoPartyProcess(detail.photo.id)
                      .then(() => {
                        toast.success('Two-party process verified')
                        open(detail.photo.id)
                        load()
                      })
                      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not verify process'))
                  }}
                  className="rounded-full border border-sand px-4 py-1.5 font-mono-tech text-[10px] uppercase"
                >
                  Verify two-party process
                </button>
              </div>

              <h3 className="mt-6 font-serif-display text-lg">People identified</h3>
              <p className="mt-1 text-sm text-ink-soft">
                Staff verify that photographer and model approval happened. A PDF is supporting evidence, not a commercial unlock.
                A visual likeness check is extra evidence only — similarity cannot grant rights.
              </p>
              <div className="mt-2 space-y-2">
                {(detail.photo.appearances ?? []).length === 0 && (
                  <p className="text-sm text-ink-soft">No model invites on this photograph yet.</p>
                )}
                {(detail.photo.appearances ?? []).map((row) => (
                  <div key={row.id} className="border border-sand-soft p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{row.displayName}</p>
                      <StatusPill status={MODEL_APPEARANCE_LABEL[row.status]} />
                    </div>
                    <p className="mt-1 font-mono-tech text-[10px] text-ink-faint">
                      {row.inviteEmail ?? 'email hidden'}
                      {row.modelHandle ? ` · @${row.modelHandle}` : ''}
                      {row.selfShot ? ' · self-shot' : ''}
                      {row.usage !== 'none' ? ` · ${row.usage}` : ''}
                      {row.consentQuality ? ` · ${row.consentQuality}` : ''}
                      {row.isMinor ? (row.guardianAuthorized ? ' · guardian authorized' : ' · minor — guardian pending') : ''}
                    </p>
                    {row.isMinor && !row.guardianAuthorized && (
                      <button
                        type="button"
                        onClick={() => {
                          api.authorizeGuardian(detail.photo.id, row.id)
                            .then(() => {
                              toast.success('Guardian authorization recorded')
                              open(detail.photo.id)
                              load()
                            })
                            .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not authorize guardian'))
                        }}
                        className="mt-2 rounded-full border border-sand px-3 py-1 font-mono-tech text-[10px] uppercase"
                      >
                        Record guardian authorization
                      </button>
                    )}
                    {row.verification && (
                      <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                        Visual check: {LIKENESS_CHECK_LABEL[row.verification.status]}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <h3 className="mt-6 font-serif-display text-lg">Supporting PDFs</h3>
              <p className="mt-1 text-sm text-ink-soft">
                Verifying a filename does not grant commercial rights. Two-party approval does.
              </p>
              <div className="mt-2 space-y-2">
                {detail.modelReleases.length === 0 && <p className="text-sm text-ink-soft">None on file.</p>}
                {detail.modelReleases.map((r) => (
                  <div key={r.id} className="border border-sand-soft p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm">{r.fileName}</p>
                      <StatusPill status={r.status} />
                    </div>
                    {r.notes && <p className="mt-1 text-[13px] text-ink-soft">{r.notes}</p>}
                    {r.status === 'pending' && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => api.reviewModelRelease(r.id, 'verified').then(() => { toast.success('Release verified'); open(detail.photo.id); load() })}
                          className="rounded-full bg-ink px-3 py-1 font-mono-tech text-[10px] uppercase text-paper"
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={() => api.reviewModelRelease(r.id, 'rejected').then(() => { toast.success('Release rejected'); open(detail.photo.id); load() })}
                          className="rounded-full border border-sand px-3 py-1 font-mono-tech text-[10px] uppercase"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <h3 className="mt-6 font-serif-display text-lg">Rights ledger</h3>
              <p className="mt-1 text-sm text-ink-soft">
                Append-only. Claimed is not documented, and documented is not VueKumi-verified.
                A third-party copyright declaration never unlocks commercial licensing.
              </p>
              {ledger && (
                <div className="mt-2 space-y-2">
                  {ledger.events.length === 0 && <p className="text-sm text-ink-soft">No ledger events yet.</p>}
                  {ledger.events.map((event) => (
                    <div key={event.id} className="border border-sand-soft p-3 text-sm">
                      <p className="font-medium">{event.action.replaceAll('.', ' ')}</p>
                      <p className="mt-1 font-mono-tech text-[10px] text-ink-faint">
                        {event.actorName ?? event.actorKind} · {event.createdAt.slice(0, 16).replace('T', ' ')}
                        {event.nextCopyright ? ` · copyright ${event.nextCopyright}` : ''}
                        {event.nextLikeness ? ` · likeness ${event.nextLikeness}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <h3 className="mt-6 font-serif-display text-lg">Rights reports</h3>
              <div className="mt-2 space-y-2">
                {detail.reports.length === 0 && <p className="text-sm text-ink-soft">None filed.</p>}
                {detail.reports.map((report) => (
                  <div key={report.id} className="border border-sand-soft p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{report.reason.replaceAll('_', ' ')}</p>
                      <StatusPill status={report.status} />
                    </div>
                    <p className="mt-1 text-ink-soft">{report.details}</p>
                    <p className="mt-1 font-mono-tech text-[10px] text-ink-faint">{report.reporterEmail} · {report.createdAt.slice(0, 10)}</p>
                  </div>
                ))}
              </div>

              <h3 className="mt-6 font-serif-display text-lg">Quotes</h3>
              <div className="mt-2 space-y-2">
                {detail.quotes.length === 0 && <p className="text-sm text-ink-soft">No RM quotes.</p>}
                {detail.quotes.map((quote) => (
                  <div key={quote.id} className="border border-sand-soft p-3 text-sm">
                    <p>{quote.territory} · {quote.duration} · {quote.channels}</p>
                    <p className="font-mono-tech text-[10px] text-ink-faint">{quote.requesterEmail} · {quote.status}</p>
                    {quote.status === 'pending' && (
                      <div className="mt-2 flex gap-2">
                        <input
                          value={quoteUsd}
                          onChange={(e) => setQuoteUsd(e.target.value)}
                          placeholder="USD quote"
                          className="w-28 border border-sand px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => api.priceQuote(quote.id, Number(quoteUsd)).then(() => { toast.success('Quoted'); open(detail.photo.id) })}
                          className="rounded-full bg-ink px-3 py-1 font-mono-tech text-[10px] uppercase text-paper"
                        >
                          Send quote
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <h3 className="mt-6 font-serif-display text-lg">Grants</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {detail.grants.map((g) => (
                  <li key={g.id}>{g.licenseName} · {g.certificateCode} · {g.buyerEmail}</li>
                ))}
                {detail.grants.length === 0 && <li className="text-ink-soft">None yet.</li>}
              </ul>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Shell>
  )
}
