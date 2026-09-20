import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'
import {
  duplicateReportWhere,
  guestReportMissingContact,
  holdReasonForReport,
  nextReportStatus,
  normalizeReporterEmail,
  parseReportQueueStatus,
  reportQueueWhere,
} from '../src/lib/reports.js'
import {
  dmcaTrackBlockedForReason,
  reportIsUrgent,
  reportQueueForReason,
  RIGHTS_REPORT_REASONS,
} from '@vuekumi/shared'
import { COMMERCIAL_LOCK_REASON, isLicenseOffered } from '../src/lib/rights.js'
import { rightsReportOpsEmail } from '../src/lib/email.js'

const product = {
  id: 'commercial',
  type: 'commercial' as const,
  name: 'Commercial',
  description: '',
  defaultUsd: 48,
  points: [],
  commercialAllowed: true,
  requiresModelRelease: true,
  agencyPreferred: false,
  quoteOnly: false,
  exclusiveOptIn: false,
  sortOrder: 2,
  active: true,
}

const livePhoto = {
  licenseType: 'premium' as const,
  exclusiveAvailable: false,
  exclusiveSold: false,
  status: 'active' as const,
  commercialLocked: false,
  permissionState: 'commercial' as const,
  hasRecognizablePeople: false,
}

test('guest reports need an email; signed-in reports do not', () => {
  assert.equal(guestReportMissingContact({ email: '  Ada@Vuekumi.com ' }), false)
  assert.equal(guestReportMissingContact({ userId: 'usr_1' }), false)
  assert.equal(guestReportMissingContact({ email: '   ' }), true)
  assert.equal(guestReportMissingContact({}), true)
})

test('reporter emails are lowercased', () => {
  assert.equal(normalizeReporterEmail('  Ada@Vuekumi.com '), 'ada@vuekumi.com')
  assert.equal(normalizeReporterEmail(''), undefined)
})

test('staff actions move a report through reviewing, dismiss, and resolve', () => {
  assert.equal(nextReportStatus('lock', 'open'), 'reviewing')
  assert.equal(nextReportStatus('lock', 'reviewing'), 'reviewing')
  assert.equal(nextReportStatus('unlock', 'reviewing'), 'reviewing')
  assert.equal(nextReportStatus('dismiss', 'open'), 'dismissed')
  assert.equal(nextReportStatus('resolve', 'reviewing'), 'resolved')
})

test('queue filter is open plus reviewing; safety and category filters work', () => {
  assert.deepEqual(reportQueueWhere('queue'), { status: { in: ['open', 'reviewing'] } })
  assert.deepEqual(reportQueueWhere('open'), { status: 'open' })
  assert.equal(reportQueueWhere('all'), undefined)
  assert.equal(parseReportQueueStatus('nope'), undefined)
  assert.deepEqual(reportQueueWhere('safety'), { urgent: true, status: { in: ['open', 'reviewing'] } })
  assert.deepEqual(reportQueueWhere('dmca_copyright'), {
    queue: 'dmca_copyright',
    status: { in: ['open', 'reviewing'] },
  })
})

test('duplicate matching uses the reporter, email, or IP on an open case', () => {
  const where = duplicateReportWhere({
    photoId: 'afr-011',
    userId: 'usr_1',
    email: 'Ada@Vuekumi.com',
    ipAddress: '127.0.0.1',
  })
  assert.equal(where.photoId, 'afr-011')
  assert.deepEqual(where.status, { in: ['open', 'reviewing'] })
  const or = where.OR as { reporterUserId?: string; reporterEmail?: string; ipAddress?: string }[]
  assert.ok(or.some((clause) => clause.reporterUserId === 'usr_1'))
  assert.ok(or.some((clause) => clause.reporterEmail === 'ada@vuekumi.com'))
  assert.ok(or.some((clause) => clause.ipAddress === '127.0.0.1'))
})

test('commercial lock blocks every offered licence without delisting', () => {
  const open = isLicenseOffered(product, livePhoto)
  assert.equal(open.offered, true)
  const locked = isLicenseOffered(product, { ...livePhoto, commercialLocked: true })
  assert.equal(locked.offered, false)
  assert.equal(locked.reason, COMMERCIAL_LOCK_REASON)
  const stillVisible = isLicenseOffered(product, { ...livePhoto, status: 'active', commercialLocked: true })
  assert.equal(stillVisible.offered, false)
})

test('T1 taxonomy maps categories to queues; safety is urgent', () => {
  assert.equal(RIGHTS_REPORT_REASONS.length, 7)
  assert.equal(reportQueueForReason('copyright'), 'dmca_copyright')
  assert.equal(reportQueueForReason('likeness'), 'likeness_consent')
  assert.equal(reportQueueForReason('fraudulent_release'), 'fraud_strikes')
  assert.equal(reportQueueForReason('safety_urgent'), 'safety')
  assert.equal(reportQueueForReason('compensation_dispute'), 'commercial_dispute')
  assert.equal(reportIsUrgent('safety_urgent'), true)
  assert.equal(reportIsUrgent('copyright'), false)
  assert.equal(holdReasonForReport('safety_urgent'), 'safety_urgent')
  assert.equal(holdReasonForReport('likeness'), 'likeness_dispute')
  assert.equal(dmcaTrackBlockedForReason('likeness'), 'DMCA is copyright only. Keep likeness, safety, fraud, and compensation on the rights-report track.')
  assert.equal(dmcaTrackBlockedForReason('copyright'), null)
})

test('parsePhotoRef accepts page links and bare ids', async () => {
  const { parsePhotoRef, resolveReportPhotoId } = await import('@vuekumi/shared')
  assert.equal(parsePhotoRef('afr-001'), 'afr-001')
  assert.equal(parsePhotoRef('/photo/afr-001'), 'afr-001')
  assert.equal(parsePhotoRef('https://vuekumi.com/photo/afr-001'), 'afr-001')
  assert.equal(parsePhotoRef('https://vuekumi.com/photo/afr-001?x=1'), 'afr-001')
  assert.equal(parsePhotoRef('https://vuekumi.com/report-content?photoId=afr-002'), 'afr-002')
  assert.equal(resolveReportPhotoId({ photoUrl: '/photo/afr-003' }), 'afr-003')
  assert.equal(resolveReportPhotoId({ photoId: 'afr-004' }), 'afr-004')
  assert.equal(parsePhotoRef('not a link'), null)
})

test('guest hub accepts photograph page URL, not only bare id', async () => {
  const app = await buildApp()
  const live = await app.inject({ method: 'GET', url: '/api/photos/afr-002' })
  if (live.statusCode !== 200) {
    await app.close()
    return
  }

  const byUrl = await app.inject({
    method: 'POST',
    url: '/api/report-content',
    payload: {
      photoUrl: 'https://vuekumi.com/photo/afr-002',
      reason: 'copyright',
      details: 'This photograph was uploaded without my permission as the copyright holder.',
      reporterEmail: 'link-guest@example.com',
    },
  })
  assert.equal(byUrl.statusCode, 200, byUrl.body)
  assert.equal((byUrl.json() as { ok: boolean }).ok, true)

  const byPath = await app.inject({
    method: 'POST',
    url: '/api/report-content',
    payload: {
      photoUrl: '/photo/afr-002',
      reason: 'copyright',
      details: 'Duplicate path-based report should return alreadyReported for same guest.',
      reporterEmail: 'link-guest@example.com',
    },
  })
  assert.equal(byPath.statusCode, 200, byPath.body)
  assert.equal((byPath.json() as { alreadyReported?: boolean }).alreadyReported, true)
  await app.close()
})

test('guest hub POST /report-content files a safety report onto the fast-path', async () => {
  const app = await buildApp()
  const live = await app.inject({ method: 'GET', url: '/api/photos/afr-001' })
  if (live.statusCode !== 200) {
    await app.close()
    return
  }

  const missingPhoto = await app.inject({
    method: 'POST',
    url: '/api/report-content',
    payload: {
      reason: 'safety_urgent',
      details: 'This listing appears to involve a minor in an unsafe context and needs urgent review.',
      reporterEmail: 'safety-guest@example.com',
    },
  })
  assert.equal(missingPhoto.statusCode, 400)

  const filed = await app.inject({
    method: 'POST',
    url: '/api/report-content',
    payload: {
      photoUrl: '/photo/afr-001',
      reason: 'safety_urgent',
      details: 'This listing appears to involve a minor in an unsafe context and needs urgent review.',
      reporterEmail: 'safety-guest@example.com',
    },
  })
  assert.equal(filed.statusCode, 200, filed.body)
  const body = filed.json() as { ok: boolean; urgent?: boolean; queue?: string }
  assert.equal(body.ok, true)
  assert.equal(body.urgent, true)
  assert.equal(body.queue, 'safety')

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  assert.equal(login.statusCode, 200)
  const raw = login.headers['set-cookie']
  const cookie = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')

  const safety = await app.inject({
    method: 'GET',
    url: '/api/admin/reports?status=safety',
    headers: { cookie },
  })
  assert.equal(safety.statusCode, 200)
  const items = (safety.json() as { items: { photoId: string; urgent: boolean; queue: string }[] }).items
  assert.ok(items.some((row) => row.photoId === 'afr-001' && row.urgent && row.queue === 'safety'))
  await app.close()
})

test('T2 SOP: preserve / notify / escalate update stage; unlock blocked by open DMCA', async () => {
  const app = await buildApp()
  const live = await app.inject({ method: 'GET', url: '/api/photos/afr-003' })
  if (live.statusCode !== 200) {
    await app.close()
    return
  }

  const filed = await app.inject({
    method: 'POST',
    url: '/api/report-content',
    payload: {
      photoUrl: '/photo/afr-003',
      reason: 'likeness',
      details: 'I am depicted and did not consent; staff must preserve evidence before contact.',
      reporterEmail: 'sop-guest@example.com',
    },
  })
  assert.equal(filed.statusCode, 200, filed.body)

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  assert.equal(login.statusCode, 200)
  const raw = login.headers['set-cookie']
  const cookie = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')

  const queue = await app.inject({
    method: 'GET',
    url: '/api/admin/reports?status=likeness_consent',
    headers: { cookie },
  })
  assert.equal(queue.statusCode, 200)
  const items = (queue.json() as { items: { id: string; photoId: string; sopStage: string }[] }).items
  const report = items.find((row) => row.photoId === 'afr-003')
  assert.ok(report)

  const preserved = await app.inject({
    method: 'POST',
    url: `/api/admin/reports/${report.id}/decide`,
    headers: { cookie },
    payload: { action: 'preserve', notes: 'Screenshot + original listing captured' },
  })
  assert.equal(preserved.statusCode, 200, preserved.body)
  const preservedBody = preserved.json() as { report: { sopStage: string; evidencePreservedAt: string | null } }
  assert.equal(preservedBody.report.sopStage, 'preserving')
  assert.ok(preservedBody.report.evidencePreservedAt)

  const notified = await app.inject({
    method: 'POST',
    url: `/api/admin/reports/${report.id}/decide`,
    headers: { cookie },
    payload: { action: 'notify', notes: 'Emailed reporter via ops inbox' },
  })
  assert.equal(notified.statusCode, 200)
  assert.ok((notified.json() as { report: { notifiedAt: string | null } }).report.notifiedAt)

  const escalated = await app.inject({
    method: 'POST',
    url: `/api/admin/reports/${report.id}/decide`,
    headers: { cookie },
    payload: { action: 'escalate', escalateTo: 'counsel', notes: 'Likeness counsel review' },
  })
  assert.equal(escalated.statusCode, 200, escalated.body)
  const esc = escalated.json() as { report: { sopStage: string; escalateTo: string } }
  assert.equal(esc.report.sopStage, 'escalated')
  assert.equal(esc.report.escalateTo, 'counsel')

  // Seed an open DMCA hold on the same photo and ensure unlock is blocked
  const notice = await prisma.dmcaNotice.create({
    data: {
      photoId: 'afr-003',
      claimantName: 'Test Claimant',
      claimantEmail: 'claimant@example.com',
      claimantAddress: '123 Test Street, City, ST 00000',
      workDescription: 'Copyrighted work described for SOP unlock block test case.',
      originalLocation: 'https://example.com/original',
      infringingLocation: 'https://vuekumi.com/photo/afr-003',
      signature: 'Test Claimant',
      status: 'processing',
    },
  })

  try {
    const unlock = await app.inject({
      method: 'POST',
      url: `/api/admin/reports/${report.id}/decide`,
      headers: { cookie },
      payload: { action: 'unlock', notes: 'Should fail' },
    })
    assert.equal(unlock.statusCode, 400)
    assert.match(unlock.json().error ?? '', /DMCA/)
  } finally {
    await prisma.dmcaNotice.delete({ where: { id: notice.id } }).catch(() => undefined)
    await prisma.rightsReport.update({
      where: { id: report.id },
      data: { status: 'resolved', sopStage: 'closed' },
    }).catch(() => undefined)
    await prisma.photo.update({
      where: { id: 'afr-003' },
      data: { commercialLocked: false, commercialLockedAt: null, commercialLockedById: null },
    }).catch(() => undefined)
    await app.close()
  }
})

test('ops email for a rights report points at the staff queue', () => {
  const html = rightsReportOpsEmail({
    photoTitle: 'Knit Study, No. 4',
    reason: 'likeness',
    reporterEmail: 'member@vuekumi.demo',
    queueUrl: 'http://localhost:3000/admin/reports',
  })
  assert.match(html, /Knit Study, No. 4/)
  assert.match(html, /likeness/)
  assert.match(html, /member@vuekumi.demo/)
  assert.match(html, /\/admin\/reports/)
  assert.match(html, /freeze new licensing/)
})

test('public report validates details before looking up the photograph', async () => {
  const app = await buildApp()
  const short = await app.inject({
    method: 'POST',
    url: '/api/photos/afr-011/report',
    payload: { reason: 'copyright', details: 'too short' },
  })
  assert.equal(short.statusCode, 400)

  const missing = await app.inject({
    method: 'POST',
    url: '/api/photos/does-not-exist/report',
    payload: {
      reason: 'likeness',
      details: 'I am the person in this photograph and I did not consent to commercial use.',
      reporterEmail: 'guest@example.com',
    },
  })
  assert.equal(missing.statusCode, 404)
  await app.close()
})

test('staff report queue requires an admin session', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/admin/reports' })
  assert.equal(res.statusCode, 401)
  const lock = await app.inject({
    method: 'POST',
    url: '/api/admin/content/afr-011/commercial-lock',
    payload: { locked: true },
  })
  assert.equal(lock.statusCode, 401)
  await app.close()
})

test('a public report can freeze licensing on a live photograph', async () => {
  const app = await buildApp()
  const live = await app.inject({ method: 'GET', url: '/api/photos/afr-011' })
  if (live.statusCode !== 200) {
    await app.close()
    return
  }

  const filed = await app.inject({
    method: 'POST',
    url: '/api/photos/afr-011/report',
    payload: {
      reason: 'likeness',
      details: 'I am depicted in this photograph and did not agree to commercial licensing.',
      reporterEmail: 'rights-phase22@example.com',
      reporterName: 'Phase 22',
    },
  })
  assert.equal(filed.statusCode, 200)
  const filedBody = filed.json() as { ok?: boolean }
  assert.equal(filedBody.ok, true)

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  if (login.statusCode !== 200) {
    await app.close()
    return
  }
  const raw = login.headers['set-cookie']
  const cookie = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')

  const queue = await app.inject({ method: 'GET', url: '/api/admin/reports?status=queue', headers: { cookie } })
  assert.equal(queue.statusCode, 200)
  const items = (queue.json() as { items: { id: string; photoId: string }[] }).items
  const report = items.find((row) => row.photoId === 'afr-011')
  assert.ok(report)

  const locked = await app.inject({
    method: 'POST',
    url: `/api/admin/reports/${report.id}/decide`,
    headers: { cookie },
    payload: { action: 'lock', notes: 'Temporary commercial freeze for Phase 22 test' },
  })
  assert.equal(locked.statusCode, 200)
  assert.equal((locked.json() as { report: { commercialLocked: boolean; status: string } }).report.commercialLocked, true)

  const licenses = await app.inject({ method: 'GET', url: '/api/photos/afr-011/licenses' })
  const offered = (licenses.json() as { items: { offered: boolean }[] }).items
  assert.equal(offered.every((item) => item.offered === false), true)

  const unlocked = await app.inject({
    method: 'POST',
    url: `/api/admin/reports/${report.id}/decide`,
    headers: { cookie },
    payload: { action: 'unlock', notes: 'Restore after Phase 22 test' },
  })
  assert.equal(unlocked.statusCode, 200)
  assert.equal((unlocked.json() as { report: { commercialLocked: boolean } }).report.commercialLocked, false)

  await app.inject({
    method: 'POST',
    url: `/api/admin/reports/${report.id}/decide`,
    headers: { cookie },
    payload: { action: 'dismiss', notes: 'Test cleanup' },
  })
  await app.close()
})
