import { PrismaClient } from '@prisma/client'
import { PRESET_CAPABILITIES } from '@vuekumi/shared'
import bcrypt from 'bcryptjs'
import { randomBytes, createHash } from 'node:crypto'
import { photos, photographers } from './seed-data.js'

/** Production image ships `dist/`; local `tsx prisma/seed.ts` uses `src/`. */
async function importApp(rel: string) {
  const candidates = [
    new URL(`../src/${rel}`, import.meta.url).href,
    new URL(`../dist/${rel}`, import.meta.url).href,
  ]
  let last: unknown
  for (const href of candidates) {
    try {
      return await import(href)
    } catch (err) {
      last = err
    }
  }
  throw last
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const adminPassword = await hashPassword('Admin123!')
  const userPassword = await hashPassword('User12345!')

  await prisma.auditLog.deleteMany()
  await prisma.payout.deleteMany()
  await prisma.payoutMethod.deleteMany()
  await prisma.earningsLedger.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.licenseGrant.deleteMany()
  await prisma.licenseQuote.deleteMany()
  await prisma.agencyInvite.deleteMany()
  await prisma.likenessCheck.deleteMany()
  await prisma.photoAppearance.deleteMany()
  await prisma.modelProfile.deleteMany()
  await prisma.modelRelease.deleteMany()
  await prisma.moderationItem.deleteMany()
  await prisma.rightsReport.deleteMany()
  await prisma.photoFavorite.deleteMany()
  await prisma.photographerFollow.deleteMany()
  await prisma.collectionPhoto.deleteMany()
  await prisma.collection.deleteMany()
  await prisma.photoTag.deleteMany()
  await prisma.rightsRecord.deleteMany()
  await prisma.photo.deleteMany()
  await prisma.photoShoot.deleteMany()
  await prisma.platformAgreement.deleteMany()
  await prisma.agencyMember.deleteMany()
  await prisma.agency.deleteMany()
  await prisma.contributorProfile.deleteMany()
  await prisma.subscription.deleteMany()
  await prisma.userProfile.deleteMany()
  await prisma.adminProfile.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.passwordResetToken.deleteMany()
  await prisma.emailVerificationToken.deleteMany()
  await prisma.oAuthAccount.deleteMany()
  await prisma.user.deleteMany()

  const admin = await prisma.user.create({
    data: {
      email: 'admin@vuekumi.com',
      passwordHash: adminPassword,
      name: 'Vuekumi Admin',
      accountType: 'admin',
      country: 'KE',
      emailVerifiedAt: new Date(),
      adminProfile: { create: { adminRole: 'super_admin' } },
    },
  })

  for (const staff of [
    { email: 'support@vuekumi.demo', name: 'Support Staff', role: 'support' as const },
    { email: 'moderator@vuekumi.demo', name: 'Moderator Staff', role: 'moderator' as const },
    { email: 'finance@vuekumi.demo', name: 'Finance Staff', role: 'finance' as const },
  ]) {
    await prisma.user.create({
      data: {
        email: staff.email,
        passwordHash: userPassword,
        name: staff.name,
        accountType: 'admin',
        country: 'KE',
        emailVerifiedAt: new Date(),
        adminProfile: {
          create: {
            adminRole: staff.role,
            capabilities: [...PRESET_CAPABILITIES[staff.role]],
            capabilitiesCustomized: false,
          },
        },
      },
    })
  }

  const contributorUsers = new Map<string, string>()

  for (const ph of photographers) {
    const user = await prisma.user.create({
      data: {
        email: `${ph.handle}@vuekumi.demo`,
        passwordHash: userPassword,
        name: ph.name,
        accountType: ph.creatorKind === 'photo_influencer' ? 'photo_influencer' : 'photographer',
        country: ({ Nigeria: 'NG', 'South Africa': 'ZA', Ghana: 'GH', Ethiopia: 'ET', Kenya: 'KE' } as Record<string, string>)[ph.location.split(', ').pop() ?? ''] ?? 'NG',
        avatarUrl: ph.avatar,
        emailVerifiedAt: new Date(),
        contributorProfile: {
          create: {
            handle: ph.handle,
            creatorKind: ph.creatorKind ?? 'photographer',
            location: ph.location,
            photosCount: ph.photos,
            downloads: ph.downloads,
            earnings: ph.earnings,
            approvalRate: 94,
          },
        },
        platformAgreements: {
          create: { version: ph.creatorKind === 'photo_influencer' ? '1.0-photo-influencer' : '1.0' },
        },
      },
    })
    contributorUsers.set(ph.handle, user.id)
  }

  const member = await prisma.user.create({
    data: {
      email: 'member@vuekumi.demo',
      passwordHash: userPassword,
      name: 'Zuri Hassan',
      accountType: 'user',
      country: 'TZ',
      emailVerifiedAt: new Date(),
      userProfile: { create: { subscriptionPlan: 'free' } },
    },
  })

  await prisma.user.create({
    data: {
      email: 'community@vuekumi.demo',
      passwordHash: userPassword,
      name: 'Imani Okonkwo',
      accountType: 'contributor',
      country: 'NG',
      emailVerifiedAt: new Date(),
      contributorProfile: {
        create: {
          handle: 'imani-okonkwo',
          location: 'Enugu, Nigeria',
          bio: 'Community contributor — portfolio and editorial sharing, not commercial stock.',
        },
      },
      platformAgreements: { create: { version: '1.0-community' } },
    },
  })

  const agencyOwner = await prisma.user.create({
    data: {
      email: 'agency@vuekumi.demo',
      passwordHash: userPassword,
      name: 'DDB Lagos',
      accountType: 'agency',
      country: 'NG',
      emailVerifiedAt: new Date(),
      status: 'active',
      userProfile: { create: { subscriptionPlan: 'free' } },
    },
  })

  const agency = await prisma.agency.create({
    data: {
      name: 'DDB Lagos',
      slug: 'ddb-lagos',
      ownerUserId: agencyOwner.id,
      status: 'active',
      billingEmail: 'agency@vuekumi.demo',
      members: {
        create: { userId: agencyOwner.id, agencyRole: 'owner' },
      },
    },
  })

  const agencyManager = await prisma.user.create({
    data: {
      email: 'kemi@vuekumi.demo',
      passwordHash: userPassword,
      name: 'Kemi Adeyemi',
      accountType: 'agency',
      country: 'NG',
      emailVerifiedAt: new Date(),
      status: 'active',
      userProfile: { create: { subscriptionPlan: 'free' } },
    },
  })
  await prisma.agencyMember.create({
    data: { agencyId: agency.id, userId: agencyManager.id, agencyRole: 'manager' },
  })

  const peopleCategories = new Set(['People', 'Fashion'])
  const peopleTags = new Set(['portrait', 'model', 'woman', 'man', 'dance', 'maasai'])

  for (const p of photos) {
    const contributorId = contributorUsers.get(p.photographer)
    if (!contributorId) continue

    const hasPeople = peopleCategories.has(p.category) || p.tags.some((t) => peopleTags.has(t))
    const photographer = photographers.find((ph) => ph.handle === p.photographer)
    const exclusive = p.id === 'afr-011'
    const permissionState =
      p.id === 'afr-008'
        ? 'portfolio'
        : p.id === 'afr-001'
          ? 'editorial'
          : p.id === 'afr-027'
            ? 'commercial'
          : exclusive
            ? 'exclusive'
            : hasPeople
              ? 'editorial'
              : 'commercial'

    await prisma.photo.create({
      data: {
        id: p.id,
        contributorId,
        uploadedById: contributorId,
        creationClaim: 'self_created',
        title: p.title,
        category: p.category,
        country: p.country,
        licenseType: p.license,
        price: p.price,
        status: 'active',
        src: p.src,
        downloads: p.downloads,
        views: p.views,
        likes: p.likes,
        hasRecognizablePeople: hasPeople,
        exclusiveAvailable: exclusive,
        permissionState,
        restrictionNotes: p.id === 'afr-001' ? 'Editorial demo — not for advertising.' : undefined,
        publishedAt: new Date(),
        tags: { create: p.tags.map((tag) => ({ tag })) },
        rightsRecord: {
          create: {
            copyrightVerified: true,
            copyrightStatus: 'verified',
            copyrightAttestedAt: new Date(),
            copyrightHolder: photographer?.name ?? 'Photographer',
            platformRightsOk: true,
            modelReleaseRequired: hasPeople,
            modelReleaseStatus: hasPeople
              ? p.id === 'afr-007'
                ? 'verified'
                : 'pending'
              : 'not_required',
            modelConsentStatus: hasPeople ? 'required' : 'not_required',
            commercialEligible: !hasPeople,
          },
        },
        ...(hasPeople
          ? {
              modelReleases: {
                create: {
                  fileName: `${p.id}-model-release.pdf`,
                  notes:
                    p.id === 'afr-007'
                      ? 'Seeded supporting PDF — verifying a file does not grant commercial rights'
                      : 'Supporting PDF on file — two-party approval is the commercial path',
                  status: p.id === 'afr-007' ? 'verified' : 'pending',
                  verifiedById: p.id === 'afr-007' ? admin.id : undefined,
                  verifiedAt: p.id === 'afr-007' ? new Date() : undefined,
                },
              },
            }
          : {}),
      },
    })
  }

  const pendingContributor = contributorUsers.get('amara-okafor')
  if (pendingContributor) {
    await prisma.photo.create({
      data: {
        id: 'afr-pend-1',
        contributorId: pendingContributor,
        uploadedById: pendingContributor,
        creationClaim: 'self_created',
        title: 'Studio Sitting, Unreleased',
        description: 'Pending rights review — recognisable person, model release uploaded.',
        category: 'People',
        country: 'Nigeria',
        licenseType: 'premium',
        price: 14,
        status: 'pending',
        src: '/images/photos/fashion-portrait.jpg',
        hasRecognizablePeople: true,
        exclusiveAvailable: false,
        permissionState: 'private',
        restrictionNotes: 'Unreleased studio sitting — private until rights clear.',
        tags: { create: [{ tag: 'portrait' }, { tag: 'studio' }] },
        rightsRecord: {
          create: {
            copyrightVerified: true,
            copyrightStatus: 'claimed',
            copyrightAttestedAt: new Date(),
            copyrightHolder: 'Amara Okafor',
            platformRightsOk: true,
            modelReleaseRequired: true,
            modelReleaseStatus: 'pending',
            modelConsentStatus: 'required',
            commercialEligible: false,
          },
        },
        modelReleases: {
          create: {
            fileName: 'amara-studio-release.pdf',
            notes: 'Awaiting admin verification',
            status: 'pending',
          },
        },
        moderationItems: {
          create: {
            flag: 'copyright check',
            submittedBy: 'amara-okafor',
            status: 'pending',
          },
        },
      },
    })
  }

  const { ALL_COUNTRIES, DEFAULT_GATEWAYS, DEFAULT_AI_PROVIDERS } = await importApp(
    'data/countries.js',
  ) as typeof import('../src/data/countries.js')
  const { syncExchangeRates } = await importApp('lib/fx.js') as typeof import('../src/lib/fx.js')
  const { seedLicenseCatalog } = await importApp(
    'lib/licenses-seed.js',
  ) as typeof import('../src/lib/licenses-seed.js')
  await seedLicenseCatalog()

  for (const c of ALL_COUNTRIES) {
    await prisma.country.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        name: c.name,
        currency: c.currency,
        currencyName: c.currencyName,
        region: c.region,
        contributorEligible: c.contributorEligible,
        sortOrder: c.sortOrder ?? (c.region === 'africa' ? 10 : 50),
      },
      update: {
        name: c.name,
        currency: c.currency,
        currencyName: c.currencyName,
        region: c.region,
        contributorEligible: c.contributorEligible,
      },
    })
  }

  for (const g of DEFAULT_GATEWAYS) {
    await prisma.paymentGateway.upsert({
      where: { slug: g.slug },
      create: g,
      update: { name: g.name, kind: g.kind, countries: g.countries, currencies: g.currencies, notes: g.notes },
    })
  }

  for (const p of DEFAULT_AI_PROVIDERS) {
    await prisma.aiProvider.upsert({
      where: { slug: p.slug },
      create: p,
      update: { name: p.name, purpose: p.purpose, apiBaseUrl: p.apiBaseUrl, notes: p.notes },
    })
  }

  try {
    const fx = await syncExchangeRates()
    console.log(`Exchange rates synced: ${fx.updated} currencies`)
  } catch (err) {
    console.warn('Exchange rate sync skipped:', err)
    await prisma.exchangeRate.upsert({
      where: { currency: 'USD' },
      create: { currency: 'USD', rateToUsd: 1, source: 'auto', fetchedAt: new Date() },
      update: { rateToUsd: 1 },
    })
  }

  const amaraId = contributorUsers.get('amara-okafor')
  if (amaraId) {
    await prisma.payoutMethod.create({
      data: {
        userId: amaraId,
        kind: 'mobile_money',
        label: 'MTN MoMo',
        accountName: 'Amara Okafor',
        accountRef: '08031234567',
        country: 'NG',
        isDefault: true,
      },
    })
    await prisma.earningsLedger.createMany({
      data: [
        { contributorId: amaraId, photoId: 'afr-011', source: 'licence_sale', amountUsd: 48, status: 'available' },
        { contributorId: amaraId, photoId: 'afr-009', source: 'licence_sale', amountUsd: 24, status: 'available' },
        { contributorId: amaraId, photoId: 'afr-023', source: 'licence_sale', amountUsd: 18, status: 'available' },
      ],
    })
    await prisma.contributorProfile.update({
      where: { userId: amaraId },
      data: { payoutMethod: 'Mobile money (MTN MoMo)', earnings: 90 },
    })
  }

  const thandiweId = contributorUsers.get('thandiwe-nkosi')
  const nomsaInviteToken = 'seed-nomsa-model-invite'
  const ada = await prisma.user.create({
    data: {
      email: 'ada@vuekumi.demo',
      passwordHash: userPassword,
      name: 'Ada Molefe',
      accountType: 'model',
      country: 'BW',
      avatarUrl: '/images/avatars/portrait-botswana.jpg',
      emailVerifiedAt: new Date(),
      modelProfile: { create: { handle: 'ada-molefe', location: 'Gaborone, Botswana' } },
      platformAgreements: { create: { version: '1.0-model' } },
    },
  })
  if (thandiweId) {
    await prisma.photoAppearance.create({
      data: {
        photoId: 'afr-001',
        displayName: 'Ada Molefe',
        inviteEmail: 'ada@vuekumi.demo',
        modelUserId: ada.id,
        invitedById: thandiweId,
        status: 'approved',
        consentStatus: 'approved',
        decisionKind: 'approved',
        verificationLevel: 'vuekumi_verified',
        consentQuality: 'verified',
        ageClass: 'adult',
        usage: 'editorial',
        confirmedLikeness: true,
        consentVersion: '1.0',
        invitedAt: new Date(),
        claimedAt: new Date(),
        decidedAt: new Date(),
      },
    })
  }
  if (amaraId) {
    await prisma.photoAppearance.create({
      data: {
        photoId: 'afr-011',
        displayName: 'Nomsa Dlamini',
        inviteEmail: 'nomsa@vuekumi.demo',
        invitedById: amaraId,
        status: 'invited',
        consentStatus: 'invitation_sent',
        ageClass: 'adult',
        usage: 'none',
        inviteTokenHash: createHash('sha256').update(nomsaInviteToken).digest('hex'),
        inviteExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        invitedAt: new Date(),
      },
    })
  }

  const kofiId = contributorUsers.get('kofi-mensah')
  if (kofiId) {
    await prisma.modelProfile.create({
      data: {
        userId: kofiId,
        handle: 'kofi-mensah',
        location: 'Accra, Ghana',
      },
    })
    await prisma.photoAppearance.create({
      data: {
        photoId: 'afr-027',
        displayName: 'Kofi Mensah',
        inviteEmail: 'kofi-mensah@vuekumi.demo',
        modelUserId: kofiId,
        invitedById: kofiId,
        status: 'approved',
        consentStatus: 'approved',
        decisionKind: 'approved',
        verificationLevel: 'vuekumi_verified',
        consentQuality: 'verified',
        ageClass: 'adult',
        usage: 'commercial',
        confirmedLikeness: true,
        selfShot: true,
        consentVersion: '1.0',
        claimedAt: new Date(),
        decidedAt: new Date(),
      },
    })
  }

  await prisma.rightsRecord.update({
    where: { photoId: 'afr-001' },
    data: { modelConsentStatus: 'approved', commercialEligible: false },
  })
  await prisma.rightsRecord.update({
    where: { photoId: 'afr-027' },
    data: { modelConsentStatus: 'approved', commercialEligible: true },
  })
  await prisma.rightsRecord.update({
    where: { photoId: 'afr-011' },
    data: { modelConsentStatus: 'invitation_sent', commercialEligible: false },
  })

  const lenaInviteToken = 'seed-lena-photographer-invite'
  await prisma.photo.create({
    data: {
      id: 'mdl-pending-copy',
      contributorId: ada.id,
      uploadedById: ada.id,
      creationClaim: 'photographer_took',
      title: 'Studio portrait awaiting photographer',
      description: 'Ada uploaded this. VueKumi contacted the photographer. Commercial stays locked.',
      category: 'People',
      country: 'Botswana',
      licenseType: 'free',
      price: 0,
      status: 'active',
      src: '/images/photos/fashion-portrait.jpg',
      hasRecognizablePeople: true,
      exclusiveAvailable: false,
      permissionState: 'portfolio',
      publishedAt: new Date(),
      tags: { create: [{ tag: 'model-upload' }] },
      rightsRecord: {
        create: {
          copyrightVerified: false,
          copyrightStatus: 'claimed',
          copyrightMethod: 'attestation',
          copyrightAttestedAt: new Date(),
          copyrightHolder: 'Lena Khumalo',
          platformRightsOk: true,
          modelReleaseRequired: true,
          modelReleaseStatus: 'pending',
          modelConsentStatus: 'approved',
          commercialEligible: false,
        },
      },
      appearances: {
        create: {
          displayName: 'Ada Molefe',
          inviteEmail: 'ada@vuekumi.demo',
          modelUserId: ada.id,
          invitedById: ada.id,
          status: 'approved',
          consentStatus: 'approved',
          decisionKind: 'approved',
          verificationLevel: 'vuekumi_verified',
          consentQuality: 'verified',
          ageClass: 'adult',
          usage: 'editorial',
          confirmedLikeness: true,
          selfShot: true,
          consentVersion: '1.0',
          claimedAt: new Date(),
          decidedAt: new Date(),
        },
      },
      copyrightAuthorizations: {
        create: {
          displayName: 'Lena Khumalo',
          inviteEmail: 'lena-rights@vuekumi.demo',
          inviteMobile: '+26771100000',
          invitedById: ada.id,
          status: 'invited',
          quality: 'claimed',
          inviteTokenHash: createHash('sha256').update(lenaInviteToken).digest('hex'),
          inviteExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          invitedAt: new Date(),
        },
      },
      ledgerEvents: {
        create: {
          action: 'copyright.attested',
          actorId: ada.id,
          actorKind: 'user',
          nextCopyright: 'claimed',
          nextLikeness: 'approved',
          commercialEligible: false,
        },
      },
    },
  })

  const zuri = await prisma.user.create({
    data: {
      email: 'zuri-adewale@vuekumi.demo',
      passwordHash: userPassword,
      name: 'Zuri Adewale',
      accountType: 'model',
      country: 'NG',
      avatarUrl: '/images/avatars/portrait-nigeria.jpg',
      emailVerifiedAt: new Date(),
      modelProfile: { create: { handle: 'zuri-adewale', location: 'Lagos, Nigeria' } },
      contributorProfile: {
        create: { handle: 'zuri-adewale-photo', location: 'NG', creatorKind: 'photographer' },
      },
      platformAgreements: {
        create: [{ version: '1.0-model' }, { version: '1.0' }],
      },
    },
  })
  await prisma.photo.create({
    data: {
      id: 'mdl-self-shot',
      contributorId: zuri.id,
      uploadedById: zuri.id,
      creationClaim: 'self_created',
      title: 'Self-shot dual-role portrait',
      description: 'Zuri took this herself and accepted the photographer agreement. Account type stays model.',
      category: 'People',
      country: 'Nigeria',
      licenseType: 'premium',
      price: 12,
      status: 'active',
      src: '/images/photos/fashion-portrait.jpg',
      hasRecognizablePeople: true,
      exclusiveAvailable: false,
      permissionState: 'commercial',
      publishedAt: new Date(),
      tags: { create: [{ tag: 'self-shot' }] },
      rightsRecord: {
        create: {
          copyrightVerified: true,
          copyrightStatus: 'claimed',
          copyrightMethod: 'attestation',
          copyrightAttestedAt: new Date(),
          copyrightHolder: 'Zuri Adewale',
          platformRightsOk: true,
          modelReleaseRequired: true,
          modelReleaseStatus: 'verified',
          modelConsentStatus: 'approved',
          commercialEligible: true,
        },
      },
      appearances: {
        create: {
          displayName: 'Zuri Adewale',
          inviteEmail: 'zuri-adewale@vuekumi.demo',
          modelUserId: zuri.id,
          invitedById: zuri.id,
          status: 'approved',
          consentStatus: 'approved',
          decisionKind: 'approved',
          verificationLevel: 'vuekumi_verified',
          consentQuality: 'verified',
          ageClass: 'adult',
          usage: 'commercial',
          confirmedLikeness: true,
          selfShot: true,
          consentVersion: '1.0',
          claimedAt: new Date(),
          decidedAt: new Date(),
        },
      },
      ledgerEvents: {
        create: {
          action: 'copyright.attested',
          actorId: zuri.id,
          actorKind: 'user',
          agreementVersion: '1.0',
          nextCopyright: 'claimed',
          nextLikeness: 'approved',
          commercialEligible: true,
        },
      },
    },
  })

  if (pendingContributor) {
    await prisma.photo.create({
      data: {
        id: 'afr-third-party',
        contributorId: pendingContributor,
        uploadedById: pendingContributor,
        creationClaim: 'photographer_took',
        title: 'Commissioned studio still',
        description: 'Another photographer took this. Claimed copyright must not unlock commercial.',
        category: 'People',
        country: 'Nigeria',
        licenseType: 'premium',
        price: 18,
        status: 'active',
        src: '/images/photos/fashion-portrait.jpg',
        hasRecognizablePeople: false,
        exclusiveAvailable: false,
        permissionState: 'portfolio',
        publishedAt: new Date(),
        tags: { create: [{ tag: 'commission' }] },
        rightsRecord: {
          create: {
            copyrightVerified: false,
            copyrightStatus: 'claimed',
            copyrightMethod: 'attestation',
            copyrightAttestedAt: new Date(),
            copyrightHolder: 'Amara Okafor',
            platformRightsOk: true,
            modelReleaseRequired: false,
            modelReleaseStatus: 'not_required',
            modelConsentStatus: 'not_required',
            commercialEligible: false,
          },
        },
        ledgerEvents: {
          create: {
            action: 'copyright.attested',
            actorId: pendingContributor,
            actorKind: 'user',
            nextCopyright: 'claimed',
            nextLikeness: 'not_required',
            commercialEligible: false,
          },
        },
      },
    })
  }

  const favoriteIds = ['afr-011', 'afr-008', 'afr-020']
  await prisma.photoFavorite.createMany({
    data: favoriteIds.map((photoId) => ({ userId: member.id, photoId })),
  })
  for (const photoId of favoriteIds) {
    await prisma.photo.update({ where: { id: photoId }, data: { likes: { increment: 1 } } })
  }

  await prisma.collection.create({
    data: {
      ownerId: member.id,
      name: 'West Africa campaign',
      description: 'Cast and colour for a Q4 social set.',
      visibility: 'private',
      shareToken: randomBytes(16).toString('hex'),
      photos: {
        create: [
          { photoId: 'afr-011', addedById: member.id },
          { photoId: 'afr-004', addedById: member.id },
          { photoId: 'afr-009', addedById: member.id },
        ],
      },
    },
  })

  await prisma.collection.create({
    data: {
      ownerId: agencyOwner.id,
      agencyId: agency.id,
      name: 'Lagos pitch',
      description: 'Shared lightbox for the DDB Lagos team.',
      visibility: 'unlisted',
      shareToken: randomBytes(16).toString('hex'),
      photos: {
        create: [
          { photoId: 'afr-004', addedById: agencyOwner.id },
          { photoId: 'afr-023', addedById: agencyOwner.id },
        ],
      },
    },
  })

  const amaraUserId = contributorUsers.get('amara-okafor')
  const thandiweUserId = contributorUsers.get('thandiwe-nkosi')
  const kofiUserId = contributorUsers.get('kofi-mensah')
  if (amaraUserId && thandiweUserId) {
    await prisma.photographerFollow.createMany({
      data: [
        { followerId: member.id, photographerId: amaraUserId },
        { followerId: member.id, photographerId: thandiweUserId },
        { followerId: agencyOwner.id, photographerId: amaraUserId },
        ...(kofiUserId ? [{ followerId: kofiUserId, photographerId: amaraUserId }] : []),
      ],
    })
    await prisma.contributorProfile.update({
      where: { userId: amaraUserId },
      data: { profileViews: 128 },
    })
  }

  console.log('Seed complete.')
  console.log('Admin: admin@vuekumi.com / Admin123!')
  console.log('Support: support@vuekumi.demo / User12345!')
  console.log('Moderator: moderator@vuekumi.demo / User12345!')
  console.log('Finance: finance@vuekumi.demo / User12345!')
  console.log('Contributor: amara-okafor@vuekumi.demo / User12345!')
  console.log('Member: member@vuekumi.demo / User12345!')
  console.log('Contributor (self-shot dual role): kofi-mensah@vuekumi.demo / User12345!')
  console.log('Model (claimed): ada@vuekumi.demo / User12345!')
  console.log('Model invite: nomsa@vuekumi.demo → /invite/model/seed-nomsa-model-invite')
  console.log('Agency: agency@vuekumi.demo / User12345!')
  console.log('Agency manager: kemi@vuekumi.demo / User12345!')
  console.log('Agency ID:', agency.id)
  console.log('Admin ID:', admin.id)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
