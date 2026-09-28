import { expect, test } from '@playwright/test'
import { apiLogin, browserApiLogin, clearApiLoginCache } from './helpers/auth'
import {
  acceptCompensation,
  activateCompensation,
  completeDevPayment,
  declineCompensation,
  downloadCertificate,
  fileDmcaCounter,
  fileDmcaNotice,
  fileRightsReport,
  lockLatestReport,
  openDownload,
  photoLicenses,
  prepareOpenLandscape,
  prepareOpenPeoplePhoto,
  proposeCompensation,
  prisma,
  publicHome,
  purchaseLicense,
  putHomepage,
  restoreDmcaAfterWait,
  restoreSeedPeoplePhoto,
  rightsSnapshot,
  setLikenessHold,
  submitContributorPhoto,
} from './helpers/api'
import { SEED } from './helpers/fixtures'

test.describe('P1-H5 marketplace invariants', () => {
  test.beforeAll(() => {
    clearApiLoginCache()
  })
  test.afterAll(async () => {
    await restoreSeedPeoplePhoto(SEED.openPeoplePhotoId).catch(() => undefined)
    await restoreSeedPeoplePhoto(SEED.dmcaPhotoId).catch(() => undefined)
    await prisma.$disconnect()
  })

  test('1. Photo Influencer upload with person / no release → Open blocked', async ({ request }) => {
    const cookie = await apiLogin(request, SEED.photoInfluencer.email, SEED.photoInfluencer.password)
    const uploaded = await submitContributorPhoto(request, cookie, {
      title: `E2E people upload ${Date.now()}`,
      category: 'People',
      country: 'Nigeria',
      licenseType: 'free',
      hasRecognizablePeople: true,
      copyrightHolder: 'Amara Okafor',
      copyrightAttested: true,
      permissionState: 'editorial',
    })
    expect(uploaded.photo.hasRecognizablePeople).toBe(true)
    expect(uploaded.photo.rights?.commercialEligible ?? false).toBe(false)

    // Force Open tier so the download gate is about rights, not tier.
    await prisma.photo.update({
      where: { id: uploaded.photo.id },
      data: { libraryTier: 'OPEN', status: 'active', commercialStatus: 'ENABLED', commercialLocked: false },
    })

    const denied = await openDownload(request, uploaded.photo.id)
    expect(denied.status()).toBe(403)
    const body = await denied.json() as { reason?: string; error?: string }
    expect(body.reason ?? body.error ?? '').toMatch(/rights_incomplete|rights_blocked|Open/i)
  })

  test('2–3. Zero-fee Open enables download; 20% ask blocks Open then Licensed path remains', async ({ request }) => {
    const appearance = await prepareOpenPeoplePhoto()
    const photographerCookie = await apiLogin(request, SEED.photographer.email, SEED.photographer.password)
    const modelEmail = appearance.modelUser?.email
    expect(modelEmail).toBeTruthy()

    const revenueAsk = await proposeCompensation(request, photographerCookie, appearance.id, {
      mode: 'percentage',
      percent: 20,
      fixedUsd: 0,
    })
    const blocked = await openDownload(request, appearance.photoId)
    expect(blocked.status()).toBe(403)
    expect(((await blocked.json()) as { reason?: string }).reason ?? '').toMatch(/compensation_requested/)

    // Licensed / RF offers should still be listable (may be offered or not depending on commercial gates).
    const licensesWhileBlocked = await photoLicenses(request, appearance.photoId)
    expect(licensesWhileBlocked.items.length).toBeGreaterThan(0)
    expect(licensesWhileBlocked.items.some((row) => /license|royalty|extended|editorial/i.test(row.type) || row.name.length > 0)).toBe(true)

    await declineCompensation(request, photographerCookie, revenueAsk.proposal.id)

    const zero = await proposeCompensation(request, photographerCookie, appearance.id, {
      mode: 'zero',
      percent: 0,
      fixedUsd: 0,
    })
    const modelCookie = await apiLogin(request, modelEmail!, SEED.model.password)
    await acceptCompensation(request, modelCookie, zero.proposal.id)
    const activated = await activateCompensation(request, photographerCookie, zero.proposal.id)
    expect(activated.proposal.status).toBe('activated')

    const allowed = await openDownload(request, appearance.photoId)
    expect(allowed.status()).toBe(200)
    const openBody = await allowed.json() as { openLicenseVersion?: string; anonymousSessionId?: string }
    expect(openBody.openLicenseVersion).toBeTruthy()
    expect(openBody.anonymousSessionId).toBeTruthy()
  })

  test('4. Anonymous visitor downloads Open image without an account', async ({ request }) => {
    const photoId = SEED.openLandscapeCandidates[0]
    await prepareOpenLandscape(photoId)
    const res = await openDownload(request, photoId)
    expect(res.status()).toBe(200)
    const body = await res.json() as { downloadId?: string; openLicenseVersion?: string; anonymousSessionId?: string; url?: string }
    expect(body.downloadId).toBeTruthy()
    expect(body.openLicenseVersion).toBeTruthy()
    expect(body.anonymousSessionId).toBeTruthy()
    expect(body.url).toBeTruthy()
    // No auth cookie was sent — anonymousSessionId proves the audit trail without a user.
  })

  test('5. Authenticated checkout issues a license certificate (no economics on certificate)', async ({ request, page }) => {
    const photoId = SEED.openLandscapeCandidates[1] ?? 'afr-006'
    await prepareOpenLandscape(photoId)
    // Prefer a paid path when available; fall back to free RF grant.
    const memberCookie = await apiLogin(request, SEED.member.email, SEED.member.password)
    const licenses = await photoLicenses(request, photoId)
    const offered = licenses.items.find((row) => row.offered)
    expect(offered, 'at least one offered licence').toBeTruthy()

    const purchase = await purchaseLicense(request, memberCookie, photoId, offered!.type)
    let grant = purchase.grant
    if (!grant && purchase.payment?.id) {
      const completed = await completeDevPayment(request, memberCookie, purchase.payment.id)
      grant = completed.grant
    }
    expect(grant?.certificateCode).toBeTruthy()
    expect(grant?.id).toBeTruthy()

    const cert = await downloadCertificate(request, memberCookie, grant!.id)
    expect(cert.contentType).toMatch(/pdf|octet-stream|application/i)
    expect(cert.bytes.byteLength).toBeGreaterThan(100)
    const text = Buffer.from(cert.bytes).toString('latin1')
    // Certificate must not expose model/photographer economics.
    expect(text).not.toMatch(/model share|photographer share|contributor pool|50%|percent to model/i)

    // Thin UI check: licenses page shows the certificate code after session cookie apply.
    await browserApiLogin(page, SEED.member.email, SEED.member.password)
    await page.goto('/licenses')
    await expect(page.getByText(grant!.certificateCode)).toBeVisible()
  })

  test('6. Rights dispute suspends commercial licensing', async ({ request, page }) => {
    const photoId = SEED.disputePhotoId
    await prepareOpenPeoplePhoto(photoId)
    await fileRightsReport(request, photoId)
    const locked = await lockLatestReport(request, photoId)
    expect(locked.report.commercialLocked).toBe(true)
    expect(locked.report.commercialLockReason).toMatch(/likeness|rights/i)

    const licenses = await photoLicenses(request, photoId)
    expect(licenses.items.every((row) => row.offered === false)).toBe(true)

    await page.goto(`/photo/${photoId}`)
    await expect(page.getByText(/New licensing is paused while staff review a rights report/i).first()).toBeVisible()
  })

  test('7. DMCA counter restore clears copyright hold; likeness hold remains', async ({ request }) => {
    const photoId = SEED.dmcaPhotoId
    await setLikenessHold(photoId)
    const before = await rightsSnapshot(photoId)
    expect(before.modelConsentStatus).toBe('disputed')

    const notice = await fileDmcaNotice(request, photoId)
    expect(notice.notice.photoId).toBe(photoId)
    // Re-assert likeness after DMCA notice sync (rollup must keep appearance dispute).
    await setLikenessHold(photoId)
    const mid = await rightsSnapshot(photoId)
    expect(mid.copyrightStatus).toBe('disputed')
    expect(mid.commercialLocked).toBe(true)
    expect(mid.modelConsentStatus).toBe('disputed')

    await fileDmcaCounter(request, notice.notice.id)
    await restoreDmcaAfterWait(request, notice.notice.id)

    const after = await rightsSnapshot(photoId)
    expect(after.copyrightStatus).not.toBe('disputed')
    expect(after.modelConsentStatus).toBe('disputed')
  })
})

test.describe('P1-H5 UI footholds (docs/11)', () => {
  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('contributor upload shows people / release clearance path', async ({ page }) => {
    await browserApiLogin(page, SEED.photoInfluencer.email, SEED.photoInfluencer.password)
    await page.goto('/contributor/upload')
    await expect(page.getByRole('heading', { name: 'Add new work.' })).toBeVisible()
    await page.locator('label').filter({ hasText: /recognisable person/i }).locator('input[type="checkbox"]').check()
    await expect(page.getByPlaceholder('Model release file name')).toBeVisible()
  })

  test('admin homepage section reorder is reflected on public home', async ({ page, request }) => {
    const adminCookie = await apiLogin(request, SEED.admin.email, SEED.admin.password)
    const before = await publicHome(request)
    const order = before.layout?.order ?? []
    expect(order.length).toBeGreaterThan(1)
    const swapped = [...order]
    const tmp = swapped[0]!
    swapped[0] = swapped[1]!
    swapped[1] = tmp

    await putHomepage(request, adminCookie, { pins: {}, layoutOrder: swapped })
    const afterApi = await publicHome(request)
    expect(afterApi.layout?.order?.[0]).toBe(swapped[0])
    expect(afterApi.layout?.order?.[1]).toBe(swapped[1])

    await browserApiLogin(page, SEED.admin.email, SEED.admin.password)
    await page.goto('/admin/homepage')
    await expect(page.getByRole('heading', { name: 'Section arrangement' })).toBeVisible()
    // Move the first section down via UI and save, then confirm public order flips again.
    const firstLabel = page.locator('ol li').first()
    await firstLabel.getByRole('button', { name: /Move .* down/i }).click()
    await page.getByRole('button', { name: 'Save sections' }).click()

    await expect.poll(async () => (await publicHome(request)).layout?.order?.[0]).toBe(swapped[1])
    const final = await publicHome(request)
    expect(final.layout?.order?.[1]).toBe(swapped[0])
  })
})
