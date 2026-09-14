import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
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
  await prisma.modelRelease.deleteMany()
  await prisma.moderationItem.deleteMany()
  await prisma.photoFavorite.deleteMany()
  await prisma.collectionPhoto.deleteMany()
  await prisma.collection.deleteMany()
  await prisma.photoTag.deleteMany()
  await prisma.rightsRecord.deleteMany()
  await prisma.photo.deleteMany()
  await prisma.platformAgreement.deleteMany()
  await prisma.agencyMember.deleteMany()
  await prisma.agency.deleteMany()
  await prisma.contributorProfile.deleteMany()
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

  const contributorUsers = new Map<string, string>()

  for (const ph of photographers) {
    const user = await prisma.user.create({
      data: {
        email: `${ph.handle}@vuekumi.demo`,
        passwordHash: userPassword,
        name: ph.name,
        accountType: 'contributor',
        country: ({ Nigeria: 'NG', 'South Africa': 'ZA', Ghana: 'GH', Ethiopia: 'ET', Kenya: 'KE' } as Record<string, string>)[ph.location.split(', ').pop() ?? ''] ?? 'NG',
        avatarUrl: ph.avatar,
        emailVerifiedAt: new Date(),
        contributorProfile: {
          create: {
            handle: ph.handle,
            location: ph.location,
            photosCount: ph.photos,
            downloads: ph.downloads,
            earnings: ph.earnings,
            approvalRate: 94,
          },
        },
        platformAgreements: {
          create: { version: '1.0' },
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

  const agencyOwner = await prisma.user.create({
    data: {
      email: 'agency@vuekumi.demo',
      passwordHash: userPassword,
      name: 'DDB Lagos',
      accountType: 'agency',
      country: 'NG',
      emailVerifiedAt: new Date(),
      status: 'active',
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

    await prisma.photo.create({
      data: {
        id: p.id,
        contributorId,
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
        exclusiveAvailable: p.id === 'afr-011',
        publishedAt: new Date(),
        tags: { create: p.tags.map((tag) => ({ tag })) },
        rightsRecord: {
          create: {
            copyrightVerified: true,
            copyrightHolder: photographer?.name ?? 'Contributor',
            platformRightsOk: true,
            modelReleaseRequired: hasPeople,
            modelReleaseStatus: hasPeople ? 'verified' : 'not_required',
          },
        },
        ...(hasPeople
          ? {
              modelReleases: {
                create: {
                  fileName: `${p.id}-model-release.pdf`,
                  notes: 'Seeded verified release',
                  status: 'verified',
                  verifiedById: admin.id,
                  verifiedAt: new Date(),
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
        title: 'Studio Sitting, Unreleased',
        description: 'Pending rights review — recognisable person, model release uploaded.',
        category: 'People',
        country: 'Nigeria',
        licenseType: 'premium',
        price: 14,
        status: 'pending',
        src: '/images/photos/fashion-portrait.jpg',
        hasRecognizablePeople: true,
        exclusiveAvailable: true,
        tags: { create: [{ tag: 'portrait' }, { tag: 'studio' }] },
        rightsRecord: {
          create: {
            copyrightVerified: true,
            copyrightHolder: 'Amara Okafor',
            platformRightsOk: true,
            modelReleaseRequired: true,
            modelReleaseStatus: 'pending',
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

  console.log('Seed complete.')
  console.log('Admin: admin@vuekumi.com / Admin123!')
  console.log('Contributor: amara-okafor@vuekumi.demo / User12345!')
  console.log('Member: member@vuekumi.demo / User12345!')
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
