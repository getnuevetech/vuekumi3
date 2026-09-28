import {
  ACCOUNT_TYPE_LABEL,
  CONFIGURABLE_ACCOUNT_TYPES,
  defaultAccountFeatures,
  isAccountFeatureKey,
  type AccountFeatureKey,
  type AccountTypeConfigDto,
  type ConfigurableAccountType,
  type PatchAccountTypesInput,
} from '@vuekumi/shared'
import { prisma } from './prisma.js'

function storedFeatures(features: readonly string[]): AccountFeatureKey[] {
  return features.filter(isAccountFeatureKey)
}

export async function loadAccountTypeConfigs(): Promise<AccountTypeConfigDto[]> {
  const count = await prisma.accountTypeConfig.count()
  if (count === 0) {
    await prisma.accountTypeConfig.createMany({
      data: CONFIGURABLE_ACCOUNT_TYPES.map((accountType) => ({
        accountType,
        enabled: true,
        features: defaultAccountFeatures(accountType),
      })),
    })
  } else {
    // Dec-TierMap: legacy COMMUNITY contributor rows lacked commercial_stock.
    const contributor = await prisma.accountTypeConfig.findUnique({ where: { accountType: 'contributor' } })
    if (contributor) {
      const features = storedFeatures(contributor.features)
      if (!features.includes('commercial_stock')) {
        const next = [...new Set([...features, 'commercial_stock', 'ai_training_opt_in' as AccountFeatureKey])]
        await prisma.accountTypeConfig.update({
          where: { accountType: 'contributor' },
          data: { features: next },
        })
      }
    }
  }
  const rows = await prisma.accountTypeConfig.findMany()
  const byType = new Map(rows.map((row) => [row.accountType, row]))
  return CONFIGURABLE_ACCOUNT_TYPES.map((accountType) => {
    const row = byType.get(accountType)
    return {
      accountType,
      label: ACCOUNT_TYPE_LABEL[accountType],
      enabled: row?.enabled ?? true,
      features: row ? storedFeatures(row.features) : defaultAccountFeatures(accountType),
    }
  })
}

export async function saveAccountTypeConfigs(items: PatchAccountTypesInput['items']): Promise<AccountTypeConfigDto[]> {
  await prisma.$transaction(items.map((item) => prisma.accountTypeConfig.upsert({
    where: { accountType: item.accountType },
    create: { accountType: item.accountType, enabled: item.enabled, features: item.features },
    update: { enabled: item.enabled, features: item.features },
  })))
  return loadAccountTypeConfigs()
}

export async function accountTypeEnabled(accountType: string): Promise<boolean> {
  if (!(CONFIGURABLE_ACCOUNT_TYPES as readonly string[]).includes(accountType)) return accountType === 'admin'
  const rows = await loadAccountTypeConfigs()
  return rows.find((row) => row.accountType === accountType)?.enabled ?? true
}

export async function accountHasFeature(accountType: string, feature: AccountFeatureKey): Promise<boolean> {
  if (accountType === 'admin') return true
  const rows = await loadAccountTypeConfigs()
  const row = rows.find((item) => item.accountType === accountType)
  return row?.features.includes(feature) ?? defaultAccountFeatures(accountType).includes(feature)
}

export async function accountTypesWithFeature(feature: AccountFeatureKey): Promise<ConfigurableAccountType[]> {
  const rows = await loadAccountTypeConfigs()
  return rows.filter((row) => row.enabled && row.features.includes(feature)).map((row) => row.accountType)
}

export async function allowsCommercialStock(
  accountType: string,
  opts?: { hasPhotographerAgreement?: boolean | null },
): Promise<boolean> {
  if (accountType === 'admin') return true
  if (accountType === 'model' && opts?.hasPhotographerAgreement) return true
  return accountHasFeature(accountType, 'commercial_stock')
}
