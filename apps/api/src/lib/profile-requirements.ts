import { DEFAULT_PROFILE_REQUIREMENTS, PROFILE_FIELD_KEYS, type ProfileFieldKey } from '@vuekumi/shared'
import { prisma } from './prisma.js'

export async function loadProfileRequirements() {
  const count = await prisma.profileRequirement.count()
  if (count === 0) {
    await prisma.profileRequirement.createMany({
      data: Object.entries(DEFAULT_PROFILE_REQUIREMENTS).map(([accountType, fields]) => ({ accountType, fields })),
    })
  }
  const rows = await prisma.profileRequirement.findMany({ orderBy: { accountType: 'asc' } })
  return {
    items: rows.map((row) => ({
      accountType: row.accountType,
      fields: row.fields.filter((field): field is ProfileFieldKey => (PROFILE_FIELD_KEYS as readonly string[]).includes(field)),
    })),
  }
}

export async function saveProfileRequirements(items: { accountType: string; fields: ProfileFieldKey[] }[]) {
  await prisma.$transaction(items.map((item) => prisma.profileRequirement.upsert({
    where: { accountType: item.accountType },
    create: { accountType: item.accountType, fields: item.fields },
    update: { fields: item.fields },
  })))
  return loadProfileRequirements()
}

export async function requiredProfileFields(accountType: string) {
  const page = await loadProfileRequirements()
  return page.items.find((row) => row.accountType === accountType)?.fields ?? DEFAULT_PROFILE_REQUIREMENTS[accountType] ?? []
}
