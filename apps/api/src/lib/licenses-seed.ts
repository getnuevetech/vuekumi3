import { LICENSE_CATALOG, VUEKUMI_AGREEMENT } from '../data/licenses.js'
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

  await prisma.agreementVersion.upsert({
    where: { version: VUEKUMI_AGREEMENT.version },
    create: VUEKUMI_AGREEMENT,
    update: {
      title: VUEKUMI_AGREEMENT.title,
      body: VUEKUMI_AGREEMENT.body,
      current: true,
    },
  })
}
