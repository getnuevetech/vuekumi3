import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { photos, photographers } from './seed-data.js'

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const adminPassword = await hashPassword('Admin123!')
  const userPassword = await hashPassword('User12345!')

  await prisma.auditLog.deleteMany()
  await prisma.moderationItem.deleteMany()
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

  await prisma.user.create({
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

  for (const p of photos) {
    const contributorId = contributorUsers.get(p.photographer)
    if (!contributorId) continue

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
        publishedAt: new Date(),
        tags: { create: p.tags.map((tag) => ({ tag })) },
        rightsRecord: {
          create: {
            copyrightVerified: true,
            platformRightsOk: true,
            modelReleaseRequired: p.category === 'People',
            modelReleaseStatus: p.category === 'People' ? 'verified' : 'not_required',
          },
        },
      },
    })
  }

  const { ALL_COUNTRIES, DEFAULT_GATEWAYS, DEFAULT_AI_PROVIDERS } = await import('../src/data/countries.js')
  const { syncExchangeRates } = await import('../src/lib/fx.js')

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

  console.log('Seed complete.')
  console.log('Admin: admin@vuekumi.com / Admin123!')
  console.log('Contributor: amara-okafor@vuekumi.demo / User12345!')
  console.log('Member: member@vuekumi.demo / User12345!')
  console.log('Agency: agency@vuekumi.demo / User12345!')
  console.log('Agency ID:', agency.id)
  console.log('Admin ID:', admin.id)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
