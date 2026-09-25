import type { Prisma, PrismaClient } from '@prisma/client'
import {
  applyShareFormula,
  DEFAULT_SHARE_FORMULA,
  fallbackShareFormula,
  isShareGroup,
  SHARE_GROUPS,
  type ShareFormulaInput,
  type ShareGroup,
} from '@vuekumi/shared'
import { prisma } from './prisma.js'
import { getContributorShare } from './payments-config.js'

type Db = Prisma.TransactionClient | PrismaClient

export async function ensureShareGroups(client: Db = prisma) {
  for (const groupKey of SHARE_GROUPS) {
    await client.shareFormula.upsert({
      where: { scope_groupKey: { scope: 'group', groupKey } },
      update: {},
      create: { scope: 'group', groupKey, ...DEFAULT_SHARE_FORMULA },
    })
  }
}

function asFormula(row: { mode: string; percent: number; fixedUsd: number }): ShareFormulaInput {
  const mode = row.mode === 'fixed' || row.mode === 'both' ? row.mode : 'percentage'
  return {
    mode,
    percent: Math.min(100, Math.max(0, row.percent)),
    fixedUsd: Math.max(0, row.fixedUsd),
  }
}

export async function resolveShareFormula(
  input: { userId: string; accountType: string },
  client: Db = prisma,
): Promise<ShareFormulaInput> {
  const personal = await client.shareFormula.findUnique({ where: { userId: input.userId } })
  if (personal && personal.scope === 'user') return asFormula(personal)
  if (isShareGroup(input.accountType)) {
    const group = await client.shareFormula.findUnique({
      where: { scope_groupKey: { scope: 'group', groupKey: input.accountType } },
    })
    if (group) return asFormula(group)
  }
  return fallbackShareFormula(await getContributorShare())
}

export async function contributorEarning(
  input: { userId: string; accountType: string; saleUsd: number },
  client: Db = prisma,
): Promise<number> {
  const formula = await resolveShareFormula(input, client)
  return applyShareFormula(input.saleUsd, formula)
}

export async function advertisedPhotographerShare(): Promise<number> {
  const group = await prisma.shareFormula.findUnique({
    where: { scope_groupKey: { scope: 'group', groupKey: 'photographer' } },
  })
  if (group && group.mode === 'percentage') {
    return Math.min(1, Math.max(0, group.percent / 100))
  }
  return getContributorShare()
}

export async function listShareAdmin() {
  await ensureShareGroups()
  const [groups, overrides] = await Promise.all([
    prisma.shareFormula.findMany({ where: { scope: 'group' }, orderBy: { groupKey: 'asc' } }),
    prisma.shareFormula.findMany({
      where: { scope: 'user' },
      include: { user: { include: { contributorProfile: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
  ])
  const byGroup = new Map(groups.map((row) => [row.groupKey, row]))
  return {
    groups: SHARE_GROUPS.map((groupKey) => {
      const row = byGroup.get(groupKey)
      const formula = row ? asFormula(row) : DEFAULT_SHARE_FORMULA
      return { groupKey, ...formula }
    }),
    overrides: overrides.flatMap((row) => {
      if (!row.user) return []
      return [{
        userId: row.user.id,
        email: row.user.email,
        name: row.user.name,
        accountType: row.user.accountType,
        handle: row.user.contributorProfile?.handle ?? null,
        ...asFormula(row),
      }]
    }),
  }
}

export async function saveGroupFormula(groupKey: ShareGroup, formula: ShareFormulaInput) {
  return prisma.shareFormula.upsert({
    where: { scope_groupKey: { scope: 'group', groupKey } },
    update: formula,
    create: { scope: 'group', groupKey, ...formula },
  })
}

export async function saveUserFormula(userId: string, formula: ShareFormulaInput) {
  return prisma.shareFormula.upsert({
    where: { userId },
    update: { ...formula, scope: 'user', groupKey: null },
    create: { scope: 'user', userId, groupKey: null, ...formula },
  })
}

export async function clearUserFormula(userId: string) {
  await prisma.shareFormula.deleteMany({ where: { userId, scope: 'user' } })
}
