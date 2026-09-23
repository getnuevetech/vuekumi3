import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'
import { evaluateAccountApproval, evaluateContentApproval } from '../src/lib/moderation.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

async function setModerationSetting(key: string, value: string | null) {
  if (value === null) {
    await prisma.platformSetting.deleteMany({ where: { key } })
    return
  }
  await prisma.platformSetting.upsert({
    where: { key },
    create: { key, value, secret: false, label: key, group: 'Moderation' },
    update: { value },
  })
}

const CLEAN_SCREENING = { possibleMinor: false, potentiallySensitive: false, uncertainHumanDetection: false }

test('evaluateContentApproval: safety-floor flags force review regardless of the auto-approve toggle', async () => {
  await setModerationSetting('moderation.ai_auto_approve_content', 'true')
  try {
    const minor = await evaluateContentApproval({
      screening: { ...CLEAN_SCREENING, possibleMinor: true },
      title: 't', category: 'People', country: 'NG',
    })
    assert.equal(minor.decision, 'pending')
    assert.ok(minor.reasons.includes('possible_minor'))

    const sensitive = await evaluateContentApproval({
      screening: { ...CLEAN_SCREENING, potentiallySensitive: true },
      title: 't', category: 'People', country: 'NG',
    })
    assert.equal(sensitive.decision, 'pending')

    const uncertain = await evaluateContentApproval({
      screening: { ...CLEAN_SCREENING, uncertainHumanDetection: true },
      title: 't', category: 'People', country: 'NG',
    })
    assert.equal(uncertain.decision, 'pending')
  } finally {
    await setModerationSetting('moderation.ai_auto_approve_content', null)
  }
})

test('evaluateContentApproval: clean submission auto-approves by default; toggle off keeps it pending', async () => {
  await setModerationSetting('moderation.ai_auto_approve_content', null)
  const clean = await evaluateContentApproval({
    screening: CLEAN_SCREENING,
    title: 'Market scene', category: 'Landscape', country: 'NG',
  })
  assert.equal(clean.decision, 'active')

  await setModerationSetting('moderation.ai_auto_approve_content', 'false')
  try {
    const disabled = await evaluateContentApproval({
      screening: CLEAN_SCREENING,
      title: 'Market scene', category: 'Landscape', country: 'NG',
    })
    assert.equal(disabled.decision, 'pending')
    assert.ok(disabled.reasons.includes('auto_approve_disabled'))
  } finally {
    await setModerationSetting('moderation.ai_auto_approve_content', null)
  }
})

test('evaluateContentApproval: incomplete metadata and below-minimum resolution stay pending', async () => {
  await setModerationSetting('moderation.ai_auto_approve_content', 'true')
  try {
    const noTitle = await evaluateContentApproval({
      screening: CLEAN_SCREENING,
      title: '', category: 'Landscape', country: 'NG',
    })
    assert.equal(noTitle.decision, 'pending')
    assert.ok(noTitle.reasons.includes('incomplete_metadata'))

    const tooSmall = await evaluateContentApproval({
      screening: CLEAN_SCREENING,
      title: 'x', category: 'Landscape', country: 'NG', width: 100, height: 100,
    })
    assert.equal(tooSmall.decision, 'pending')
    assert.ok(tooSmall.reasons.some((r) => r.startsWith('width_below_minimum')))
  } finally {
    await setModerationSetting('moderation.ai_auto_approve_content', null)
  }
})

test('evaluateAccountApproval: disposable email domain always goes to review; clean email auto-approves by default', async () => {
  const disposable = await evaluateAccountApproval({ email: 'someone@mailinator.com' })
  assert.equal(disposable.decision, 'pending')
  assert.ok(disposable.reasons.some((r) => r.startsWith('disposable_email_domain')))

  const clean = await evaluateAccountApproval({ email: `clean-${Date.now()}@vuekumi.demo` })
  assert.equal(clean.decision, 'active')

  await setModerationSetting('moderation.ai_auto_approve_accounts', 'false')
  try {
    const disabled = await evaluateAccountApproval({ email: `clean-${Date.now()}@vuekumi.demo` })
    assert.equal(disabled.decision, 'pending')
  } finally {
    await setModerationSetting('moderation.ai_auto_approve_accounts', null)
  }
})

test('registration: disposable email keeps a photographer pending and blocks upload; clean signup uploads straight to active', async () => {
  const app = await buildApp()
  try {
    const flagged = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `flagged-${Date.now()}@mailinator.com`,
        password: 'User12345!',
        name: 'Flagged Photographer',
        accountType: 'photographer',
        country: 'NG',
        acceptAgreement: true,
      },
    })
    assert.equal(flagged.statusCode, 200, flagged.body)
    assert.equal((flagged.json() as { user: { status: string } }).user.status, 'pending')
    const flaggedCookie = cookies(flagged)
    const blocked = await app.inject({
      method: 'POST',
      url: '/api/contributor/photos',
      headers: { cookie: flaggedCookie },
      payload: {
        title: 'Should be blocked',
        category: 'Landscape',
        country: 'Nigeria',
        licenseType: 'free',
        hasRecognizablePeople: false,
        copyrightHolder: 'Flagged Photographer',
        copyrightAttested: true,
        permissionState: 'portfolio',
      },
    })
    assert.equal(blocked.statusCode, 403, blocked.body)

    const clean = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `clean-${Date.now()}@vuekumi.demo`,
        password: 'User12345!',
        name: 'Clean Photographer',
        accountType: 'photographer',
        country: 'NG',
        acceptAgreement: true,
      },
    })
    assert.equal(clean.statusCode, 200, clean.body)
    assert.equal((clean.json() as { user: { status: string } }).user.status, 'active')
    const cleanCookie = cookies(clean)
    const uploaded = await app.inject({
      method: 'POST',
      url: '/api/contributor/photos',
      headers: { cookie: cleanCookie },
      payload: {
        title: 'Sunset over Lagos',
        category: 'Landscape',
        country: 'Nigeria',
        licenseType: 'free',
        hasRecognizablePeople: false,
        copyrightHolder: 'Clean Photographer',
        copyrightAttested: true,
        permissionState: 'portfolio',
      },
    })
    assert.equal(uploaded.statusCode, 200, uploaded.body)
    const uploadedPhoto = (uploaded.json() as {
      photo: { status: string; hasRecognizablePeople: boolean; rights?: { screeningKind?: string | null; commercialEligible?: boolean } }
    }).photo
    // Phase 64 — CI has no vision provider, so this landscape upload stays pending.
    assert.equal(uploadedPhoto.rights?.screeningKind, 'uncertain_human_detection')
    assert.equal(uploadedPhoto.hasRecognizablePeople, true)
    assert.equal(uploadedPhoto.rights?.commercialEligible, false)
    assert.equal(uploadedPhoto.status, 'pending')
  } finally {
    await app.close()
  }
})
