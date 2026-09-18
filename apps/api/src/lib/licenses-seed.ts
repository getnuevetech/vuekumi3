import {
  BUYER_LICENCE_AGREEMENT,
  COMMUNITY_CONTRIBUTOR_AGREEMENT,
  LICENSE_CATALOG,
  MODEL_UPLOADER_AGREEMENT,
  PHOTO_INFLUENCER_AGREEMENT,
  TERMS_AGREEMENT,
  VUEKUMI_AGREEMENT,
} from '../data/licenses.js'
import { prisma } from './prisma.js'

const STACK = [
  { ...VUEKUMI_AGREEMENT, kind: 'photographer', current: true, counselStatus: 'placeholder' },
  { ...COMMUNITY_CONTRIBUTOR_AGREEMENT, kind: 'community', current: false, counselStatus: 'placeholder' },
  { ...PHOTO_INFLUENCER_AGREEMENT, kind: 'photo_influencer', current: false, counselStatus: 'placeholder' },
  { ...MODEL_UPLOADER_AGREEMENT, kind: 'model', current: false, counselStatus: 'placeholder' },
  { ...TERMS_AGREEMENT, current: false },
  { ...BUYER_LICENCE_AGREEMENT, current: false },
] as const

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
  for (const row of STACK) {
    await prisma.agreementVersion.upsert({
      where: { version: row.version },
      create: {
        version: row.version,
        kind: row.kind,
        title: row.title,
        body: row.body,
        current: row.current,
        counselStatus: row.counselStatus,
      },
      update: {
        kind: row.kind,
        title: row.title,
        body: row.body,
        current: row.current,
        counselStatus: row.counselStatus,
      },
    })
  }
}
