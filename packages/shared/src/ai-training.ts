import { z } from 'zod'

/**
 * Phase 34 — AI-training is a separate opt-in from RF / commercial / editorial grants.
 *
 * Dataset pricing remains undecided. VueKumi records consent; it does not sell
 * training access, invent a dataset SKU, or let partner APIs train on content.
 * Buyer licences never include AI training, even when both rights tracks opted in.
 */

export const AI_TRAINING_CONSENT_VERSION = '1.0-ai-training'

export const AI_TRAINING_AGREEMENT = {
  kind: 'ai_training' as const,
  version: AI_TRAINING_CONSENT_VERSION,
  title: 'VueKumi AI-training opt-in',
  counselStatus: 'placeholder' as const,
  body:
    'Placeholder (counsel-gated, not legal advice). AI-training use is a separate opt-in from royalty-free, commercial, extended, editorial, rights-managed, and exclusive licences. Opting in records consent on that rights track. VueKumi does not sell training datasets while pricing is undecided. Buyer certificates never include AI training. Minors are never included. A checkbox on a commercial approval is not this opt-in.',
}

export function datasetPricingDecided(): false {
  return false
}

export function aiTrainingAccessOffered(): false {
  return false
}

export function aiTrainingIncludedInBuyerLicence(): false {
  return false
}

export const AI_TRAINING_OPT_IN_COPY =
  'I separately opt in to AI-training use of this photograph. This is not included in royalty-free or commercial licences. VueKumi does not sell training datasets yet — dataset pricing is undecided.'

export const AI_TRAINING_BUYER_COPY =
  'AI-training use is not included in this licence. Dataset pricing is undecided, so VueKumi does not sell training access.'

export const AI_TRAINING_PRODUCT_COPY =
  'AI-training is a separate opt-in from stock licences. Consent can be recorded. VueKumi does not sell training access while dataset pricing is undecided. Partner APIs never grant training rights.'

export function aiTrainingProductRules() {
  return {
    separateOptIn: true as const,
    includedInBuyerLicences: false as const,
    datasetPricingDecided: false as const,
    accessOffered: false as const,
    copy: AI_TRAINING_PRODUCT_COPY,
    buyerCopy: AI_TRAINING_BUYER_COPY,
    optInCopy: AI_TRAINING_OPT_IN_COPY,
    version: AI_TRAINING_CONSENT_VERSION,
  }
}

export const patchAiTrainingSchema = z.object({
  copyrightAiTraining: z.boolean(),
})
export type PatchAiTrainingInput = z.infer<typeof patchAiTrainingSchema>

export function copyrightAiTrainingConsented(input: {
  copyrightAiTraining: boolean
  authorizations?: { status: string; aiTraining: boolean }[]
}): boolean {
  const rows = input.authorizations ?? []
  if (rows.length > 0) {
    return rows.some((row) => row.status === 'approved' && row.aiTraining)
  }
  return input.copyrightAiTraining
}

/**
 * Eligibility to *record* a complete AI-training consent — not an offer to sell.
 * Minors are a hard stop. Pending / revoked likeness is a stop. Commercial
 * approval does not imply this opt-in.
 */
export function aiTrainingEligibilityBlock(input: {
  copyrightAiTraining: boolean
  authorizations?: { status: string; aiTraining: boolean }[]
  hasRecognizablePeople: boolean
  appearances?: {
    status: string
    aiTraining?: boolean
    isMinor?: boolean
  }[]
}): string | null {
  if (!copyrightAiTrainingConsented(input)) {
    return 'AI-training needs a separate copyright opt-in'
  }
  const appearances = input.appearances ?? []
  if (appearances.some((row) => row.isMinor)) {
    return 'AI-training is not available for photographs of minors'
  }
  if (!input.hasRecognizablePeople && appearances.length === 0) return null

  const stillInFrame = appearances.filter((row) => row.status !== 'rejected' && row.status !== 'not_me')
  if (input.hasRecognizablePeople && stillInFrame.length === 0) {
    return 'Every depicted person must separately opt in to AI-training'
  }
  for (const row of stillInFrame) {
    if (row.status !== 'approved' || !row.aiTraining) {
      return 'Every depicted person must separately opt in to AI-training'
    }
  }
  return null
}

export function isAiTrainingEligible(input: Parameters<typeof aiTrainingEligibilityBlock>[0]): boolean {
  return aiTrainingEligibilityBlock(input) == null
}

/** Stock licence types never carry AI-training, regardless of consent. */
export function buyerGrantMustExcludeAiTraining<T extends Record<string, unknown>>(scope: T): T & {
  grant: 'usage_permission'
  ownership: false
  ai_training: false
} {
  return {
    ...scope,
    grant: 'usage_permission',
    ownership: false,
    ai_training: false,
  }
}

export function overlayCannotEnableAiTrainingSale(): string {
  return 'Country overlays cannot sell AI-training access. Dataset pricing is undecided.'
}
