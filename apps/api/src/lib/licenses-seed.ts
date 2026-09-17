import { COMMUNITY_CONTRIBUTOR_AGREEMENT, LICENSE_CATALOG, VUEKUMI_AGREEMENT } from '../data/licenses.js'
import { prisma } from './prisma.js'

export async function seedLicenseCatalog() {
  for (const item of LICENSE_CATALOG) {
    await prisma.licenseProduct.upsert({
      where: { id: item.id },
      create: item,
      update: {
        name: item.name,
        description: item.description,
        defaultUsd: item.defaultUsd,
        points: item.points,
        commercialAllowed: item.commercialAllowed,
        requiresModelRelease: item.requiresModelRelease,
        agencyPreferred: item.agencyPreferred,
        quoteOnly: item.quoteOnly,
        exclusiveOptIn: item.exclusiveOptIn,
        sortOrder: item.sortOrder,
        active: item.active,
      },
    })
  }

  await prisma.agreementVersion.updateMany({ data: { current: false } })
  await prisma.agreementVersion.upsert({
    where: { version: VUEKUMI_AGREEMENT.version },
    create: { ...VUEKUMI_AGREEMENT, current: true },
    update: {
      title: VUEKUMI_AGREEMENT.title,
      body: VUEKUMI_AGREEMENT.body,
      current: true,
    },
  })
  await prisma.agreementVersion.upsert({
    where: { version: COMMUNITY_CONTRIBUTOR_AGREEMENT.version },
    create: { ...COMMUNITY_CONTRIBUTOR_AGREEMENT, current: false },
    update: {
      title: COMMUNITY_CONTRIBUTOR_AGREEMENT.title,
      body: COMMUNITY_CONTRIBUTOR_AGREEMENT.body,
      current: false,
    },
  })
}
