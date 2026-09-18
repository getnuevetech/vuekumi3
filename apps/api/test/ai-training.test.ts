import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  AI_TRAINING_AGREEMENT,
  aiTrainingAccessOffered,
  aiTrainingEligibilityBlock,
  aiTrainingIncludedInBuyerLicence,
  aiTrainingProductRules,
  buyerGrantMustExcludeAiTraining,
  datasetPricingDecided,
  isAiTrainingEligible,
  overlayCannotEnableAiTrainingSale,
} from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

async function login(app: Awaited<ReturnType<typeof buildApp>>, email: string, password: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })
  assert.equal(res.statusCode, 200, `login ${email}: ${res.body}`)
  return cookies(res)
}

test('AI-training is a separate opt-in; dataset pricing is undecided; buyer grants never include it', () => {
  assert.equal(datasetPricingDecided(), false)
  assert.equal(aiTrainingAccessOffered(), false)
  assert.equal(aiTrainingIncludedInBuyerLicence(), false)
  assert.match(overlayCannotEnableAiTrainingSale(), /Dataset pricing is undecided/)
  assert.equal(AI_TRAINING_AGREEMENT.kind, 'ai_training')

  assert.equal(isAiTrainingEligible({
    copyrightAiTraining: true,
    hasRecognizablePeople: false,
    appearances: [],
  }), true)
  assert.match(aiTrainingEligibilityBlock({
    copyrightAiTraining: false,
    hasRecognizablePeople: false,
  }) ?? '', /copyright opt-in/)
  assert.match(aiTrainingEligibilityBlock({
    copyrightAiTraining: true,
    hasRecognizablePeople: true,
    appearances: [{ status: 'approved', aiTraining: false }],
  }) ?? '', /depicted person/)
  assert.match(aiTrainingEligibilityBlock({
    copyrightAiTraining: true,
    hasRecognizablePeople: true,
    appearances: [{ status: 'approved', aiTraining: true, isMinor: true }],
  }) ?? '', /minors/)
  assert.equal(isAiTrainingEligible({
    copyrightAiTraining: true,
    hasRecognizablePeople: true,
    appearances: [{ status: 'approved', aiTraining: true }],
  }), true)
  assert.equal(isAiTrainingEligible({
    copyrightAiTraining: false,
    authorizations: [{ status: 'approved', aiTraining: true }],
    hasRecognizablePeople: false,
  }), true)

  const scope = buyerGrantMustExcludeAiTraining({ grant: 'usage_permission', ownership: true, ai_training: true, extra: 1 })
  assert.equal(scope.ai_training, false)
  assert.equal(scope.ownership, false)
  assert.equal(scope.extra, 1)

  const rules = aiTrainingProductRules()
  assert.equal(rules.accessOffered, false)
  assert.equal(rules.includedInBuyerLicences, false)
})

test('photographer can opt in copyright AI-training; RF grant still excludes training; partner API still forbids it', async () => {
  const app = await buildApp()
  const thandiwe = await login(app, 'thandiwe-nkosi@vuekumi.demo', 'User12345!')
  const member = await login(app, 'member@vuekumi.demo', 'User12345!')

  const landscape = await prisma.photo.findUniqueOrThrow({ where: { id: 'afr-012' } })
  assert.equal(landscape.hasRecognizablePeople, false)

  const opted = await app.inject({
    method: 'PATCH',
    url: '/api/contributor/photos/afr-012',
    headers: { cookie: thandiwe },
    payload: { copyrightAiTraining: true },
  })
  assert.equal(opted.statusCode, 200, opted.body)
  const optedBody = opted.json() as { photo: { rights?: { copyrightAiTraining?: boolean; aiTrainingEligible?: boolean } } }
  assert.equal(optedBody.photo.rights?.copyrightAiTraining, true)
  assert.equal(optedBody.photo.rights?.aiTrainingEligible, true)

  const amara = await login(app, 'amara-okafor@vuekumi.demo', 'User12345!')
  const influencer = await app.inject({
    method: 'PATCH',
    url: '/api/contributor/photos/afr-004',
    headers: { cookie: amara },
    payload: { copyrightAiTraining: true },
  })
  assert.equal(influencer.statusCode, 400, influencer.body)
  assert.match(influencer.json().error as string, /professional photographers|Dataset pricing/)

  const people = await app.inject({
    method: 'GET',
    url: '/api/photos/afr-001',
  })
  assert.equal(people.statusCode, 200)
  const peopleBody = people.json() as { rights?: { aiTrainingEligible?: boolean; aiTrainingBlock?: string | null } }
  assert.equal(peopleBody.rights?.aiTrainingEligible, false)
  assert.match(peopleBody.rights?.aiTrainingBlock ?? '', /copyright opt-in|depicted person/)

  const grant = await app.inject({
    method: 'POST',
    url: '/api/photos/afr-012/licenses',
    headers: { cookie: member },
    payload: { type: 'royalty_free' },
  })
  assert.equal(grant.statusCode, 200, grant.body)
  const grantBody = grant.json() as { grant: { scope: Record<string, unknown> } }
  assert.equal(grantBody.grant.scope.ai_training, false)
  assert.equal(grantBody.grant.scope.ownership, false)

  const standard = await app.inject({ method: 'GET', url: '/api/legal/standard' })
  assert.equal(standard.statusCode, 200)
  const legal = standard.json() as {
    aiTraining: { accessOffered: boolean; includedInBuyerLicences: boolean; datasetPricingDecided: boolean }
    agreementStack: { kind: string }[]
    rules: string[]
  }
  assert.equal(legal.aiTraining.accessOffered, false)
  assert.equal(legal.aiTraining.includedInBuyerLicences, false)
  assert.equal(legal.aiTraining.datasetPricingDecided, false)
  assert.ok(legal.agreementStack.some((row) => row.kind === 'ai_training'))
  assert.ok(legal.rules.some((rule) => /AI-training is a separate opt-in/.test(rule)))

  await app.close()
})

test('commercial likeness approval does not imply AI-training; explicit opt-in does', async () => {
  const app = await buildApp()
  const ada = await login(app, 'ada@vuekumi.demo', 'User12345!')
  const appearance = await prisma.photoAppearance.findFirstOrThrow({
    where: { photoId: 'afr-001', inviteEmail: 'ada@vuekumi.demo' },
  })

  const commercialOnly = await app.inject({
    method: 'POST',
    url: `/api/model/appearances/${appearance.id}/decide`,
    headers: { cookie: ada },
    payload: { confirmedLikeness: true, status: 'approved', usage: 'commercial' },
  })
  assert.equal(commercialOnly.statusCode, 200, commercialOnly.body)
  const afterCommercial = commercialOnly.json() as { appearance: { aiTraining?: boolean; usage: string } }
  assert.equal(afterCommercial.appearance.usage, 'commercial')
  assert.equal(afterCommercial.appearance.aiTraining, false)

  const withTraining = await app.inject({
    method: 'POST',
    url: `/api/model/appearances/${appearance.id}/decide`,
    headers: { cookie: ada },
    payload: { confirmedLikeness: true, status: 'approved', usage: 'commercial', aiTraining: true },
  })
  assert.equal(withTraining.statusCode, 200, withTraining.body)
  const afterOptIn = withTraining.json() as { appearance: { aiTraining?: boolean } }
  assert.equal(afterOptIn.appearance.aiTraining, true)

  await app.close()
})
