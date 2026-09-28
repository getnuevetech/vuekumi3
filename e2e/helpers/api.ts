import { expect, type APIRequestContext } from '@playwright/test'
import { API_BASE, SEED } from './fixtures'
import { apiLogin } from './auth'
import { prisma } from './db'

async function readJson<T>(res: { ok: () => boolean; status: () => number; text: () => Promise<string> }, label: string): Promise<T> {
  const body = await res.text()
  expect(res.ok(), `${label} → ${res.status()}: ${body}`).toBeTruthy()
  return JSON.parse(body) as T
}

export async function openDownload(request: APIRequestContext, photoId: string) {
  return request.post(`${API_BASE}/api/open/${photoId}/download`, {
    data: { fileVariant: 'preview', source: 'e2e', anonymousSessionId: `e2e-${Date.now()}` },
  })
}

export async function publicHome(request: APIRequestContext) {
  const res = await request.get(`${API_BASE}/api/public/home`)
  return readJson<{ layout?: { order: string[] } }>(res, 'public home')
}

export async function putHomepage(request: APIRequestContext, cookie: string, body: Record<string, unknown>) {
  const res = await request.put(`${API_BASE}/api/admin/homepage`, {
    headers: { cookie },
    data: body,
  })
  return readJson<{ layoutOrder: string[] }>(res, 'admin homepage put')
}

export async function submitContributorPhoto(request: APIRequestContext, cookie: string, body: Record<string, unknown>) {
  const res = await request.post(`${API_BASE}/api/contributor/photos`, {
    headers: { cookie },
    data: body,
  })
  return readJson<{
    photo: {
      id: string
      status: string
      hasRecognizablePeople: boolean
      libraryTier?: string
      commercialStatus?: string
      rights?: { commercialEligible?: boolean; screeningKind?: string | null }
    }
  }>(res, 'contributor upload')
}

/** Mirror compensation.test.ts prep so Open / compensation gates are deterministic. */
export async function prepareOpenPeoplePhoto(photoId = SEED.openPeoplePhotoId) {
  const appearance = await prisma.photoAppearance.findFirst({
    where: { photoId, modelUserId: { not: null } },
    include: { modelUser: true },
  })
  expect(appearance?.modelUserId, `seed appearance on ${photoId}`).toBeTruthy()

  await prisma.photo.update({
    where: { id: photoId },
    data: { libraryTier: 'OPEN', commercialStatus: 'ENABLED', commercialLocked: false, commercialLockReason: null },
  })
  await prisma.rightsRecord.updateMany({
    where: { photoId },
    data: { copyrightStatus: 'verified', modelConsentStatus: 'approved', commercialEligible: true },
  })
  await prisma.photoAppearance.updateMany({
    where: { photoId },
    data: {
      consentQuality: 'verified',
      verificationLevel: 'vuekumi_verified',
      consentStatus: 'approved',
      status: 'approved',
      decisionKind: 'approved',
      confirmedLikeness: true,
    },
  })
  await prisma.compensationProposal.deleteMany({ where: { photoId } })
  return appearance!
}

/** Undo e2e mutations on a claimed-model photo so later smoke specs stay green. */
export async function restoreSeedPeoplePhoto(photoId = SEED.openPeoplePhotoId) {
  await prepareOpenPeoplePhoto(photoId)
  await prisma.dmcaNotice.deleteMany({ where: { photoId, claimantEmail: { startsWith: 'e2e-dmca-' } } })
  await prisma.rightsReport.deleteMany({ where: { photoId, reporterEmail: { startsWith: 'e2e-rights-' } } })
}

export async function prepareOpenLandscape(photoId: string) {
  await prisma.photo.update({
    where: { id: photoId },
    data: {
      status: 'active',
      libraryTier: 'OPEN',
      commercialStatus: 'ENABLED',
      commercialLocked: false,
      commercialLockReason: null,
      hasRecognizablePeople: false,
      permissionState: 'commercial',
    },
  })
  await prisma.rightsRecord.upsert({
    where: { photoId },
    create: {
      photoId,
      copyrightStatus: 'verified',
      modelConsentStatus: 'not_required',
      commercialEligible: true,
      copyrightVerified: true,
      platformRightsOk: true,
      modelReleaseRequired: false,
      modelReleaseStatus: 'not_required',
    },
    update: {
      copyrightStatus: 'verified',
      modelConsentStatus: 'not_required',
      commercialEligible: true,
      copyrightVerified: true,
    },
  })
  await prisma.compensationProposal.deleteMany({ where: { photoId } })
}

export async function proposeCompensation(
  request: APIRequestContext,
  cookie: string,
  appearanceId: string,
  body: { mode: string; percent: number; fixedUsd: number },
) {
  const res = await request.post(`${API_BASE}/api/appearances/${appearanceId}/compensation`, {
    headers: { cookie },
    data: body,
  })
  return readJson<{ proposal: { id: string; status: string } }>(res, 'propose compensation')
}

export async function declineCompensation(request: APIRequestContext, cookie: string, proposalId: string) {
  const res = await request.post(`${API_BASE}/api/compensation/${proposalId}/decline`, { headers: { cookie } })
  expect(res.ok(), await res.text()).toBeTruthy()
}

export async function acceptCompensation(request: APIRequestContext, cookie: string, proposalId: string) {
  const res = await request.post(`${API_BASE}/api/compensation/${proposalId}/accept`, { headers: { cookie } })
  return readJson<{ proposal: { id: string; status: string } }>(res, 'accept compensation')
}

export async function activateCompensation(request: APIRequestContext, cookie: string, proposalId: string) {
  const res = await request.post(`${API_BASE}/api/compensation/${proposalId}/activate`, { headers: { cookie } })
  return readJson<{ proposal: { id: string; status: string } }>(res, 'activate compensation')
}

export async function fileRightsReport(request: APIRequestContext, photoId: string) {
  const res = await request.post(`${API_BASE}/api/report-content`, {
    data: {
      photoUrl: `/photo/${photoId}`,
      reason: 'likeness',
      details: 'E2E likeness dispute — depicted person did not consent to commercial licensing.',
      reporterEmail: `e2e-rights-${Date.now()}@example.com`,
      reporterName: 'E2E Reporter',
    },
  })
  return readJson<{ ok: boolean }>(res, 'file rights report')
}

export async function lockLatestReport(request: APIRequestContext, photoId: string) {
  const admin = await apiLogin(request, SEED.admin.email, SEED.admin.password)
  const queue = await request.get(`${API_BASE}/api/admin/reports?status=queue`, { headers: { cookie: admin } })
  const body = await readJson<{ items: { id: string; photoId: string }[] }>(queue, 'admin reports queue')
  const report = body.items.find((row) => row.photoId === photoId)
  expect(report, `report for ${photoId}`).toBeTruthy()
  const locked = await request.post(`${API_BASE}/api/admin/reports/${report!.id}/decide`, {
    headers: { cookie: admin },
    data: { action: 'lock', notes: 'E2E commercial freeze' },
  })
  return readJson<{ report: { commercialLocked: boolean; commercialLockReason?: string | null } }>(locked, 'lock report')
}

export async function photoLicenses(request: APIRequestContext, photoId: string) {
  const res = await request.get(`${API_BASE}/api/photos/${photoId}/licenses`)
  return readJson<{ items: { type: string; offered: boolean; name: string }[] }>(res, 'photo licenses')
}

export async function purchaseLicense(request: APIRequestContext, cookie: string, photoId: string, type: string) {
  const res = await request.post(`${API_BASE}/api/photos/${photoId}/licenses`, {
    headers: { cookie },
    data: { type },
  })
  return readJson<{
    grant?: { id: string; certificateCode: string; amountUsd: number }
    payment?: { id: string }
    existing?: boolean
  }>(res, 'purchase license')
}

export async function completeDevPayment(request: APIRequestContext, cookie: string, paymentId: string) {
  const res = await request.post(`${API_BASE}/api/payments/${paymentId}/complete-dev`, {
    headers: { cookie },
    data: {},
  })
  return readJson<{ grant: { id: string; certificateCode: string; amountUsd: number } }>(res, 'complete-dev payment')
}

export async function downloadCertificate(request: APIRequestContext, cookie: string, grantId: string) {
  const res = await request.get(`${API_BASE}/api/licenses/grants/${grantId}/certificate`, {
    headers: { cookie },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  return { contentType: res.headers()['content-type'] ?? '', bytes: await res.body() }
}

export async function fileDmcaNotice(request: APIRequestContext, photoId: string) {
  const res = await request.post(`${API_BASE}/api/dmca/notices`, {
    data: {
      photoId,
      claimantName: 'E2E Claimant',
      claimantEmail: `e2e-dmca-${Date.now()}@example.com`,
      claimantAddress: 'Accra, Ghana',
      workDescription: 'E2E original work description for DMCA counter/restore invariant.',
      originalLocation: 'Photographer archive',
      infringingLocation: `https://vuekumi.demo/photo/${photoId}`,
      goodFaith: true,
      perjury: true,
      signature: 'E2E Claimant',
    },
  })
  return readJson<{ notice: { id: string; status: string; photoId: string } }>(res, 'file DMCA')
}

export async function fileDmcaCounter(request: APIRequestContext, noticeId: string) {
  const res = await request.post(`${API_BASE}/api/dmca/notices/${noticeId}/counter`, {
    data: {
      senderName: 'Thandiwe Nkosi',
      senderEmail: SEED.photographer.email,
      senderAddress: 'Johannesburg, South Africa',
      statement: 'E2E counter-notice: this listing is the original photograph.',
      consentToJurisdiction: true,
      perjury: true,
      signature: 'Thandiwe Nkosi',
    },
  })
  return readJson<{ notice: { id: string; status: string } }>(res, 'file DMCA counter')
}

export async function restoreDmcaAfterWait(request: APIRequestContext, noticeId: string) {
  await prisma.dmcaNotice.update({
    where: { id: noticeId },
    data: { restoreEligibleAt: new Date(Date.now() - 60_000), status: 'waiting_restore' },
  })
  const admin = await apiLogin(request, SEED.admin.email, SEED.admin.password)
  const res = await request.post(`${API_BASE}/api/admin/dmca/${noticeId}/decide`, {
    headers: { cookie: admin },
    data: { action: 'restore', notes: 'E2E restore after counter — statutory wait elapsed' },
  })
  return readJson<{ notice: { status: string } }>(res, 'restore DMCA')
}

export async function setLikenessHold(photoId: string) {
  await prisma.photoAppearance.updateMany({
    where: { photoId },
    data: { consentStatus: 'disputed', status: 'rejected', decisionKind: 'unauthorized' },
  })
  await prisma.rightsRecord.updateMany({
    where: { photoId },
    data: { modelConsentStatus: 'disputed', commercialEligible: false },
  })
}

export async function rightsSnapshot(photoId: string) {
  const photo = await prisma.photo.findUniqueOrThrow({
    where: { id: photoId },
    include: { rightsRecord: true },
  })
  return {
    commercialLocked: photo.commercialLocked,
    commercialLockReason: photo.commercialLockReason,
    copyrightStatus: photo.rightsRecord?.copyrightStatus ?? null,
    modelConsentStatus: photo.rightsRecord?.modelConsentStatus ?? null,
  }
}

export { API_BASE, prisma }
