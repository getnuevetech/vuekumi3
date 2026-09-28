/** Seed accounts and photo ids used by P1-H5 Playwright invariants. */

export const SEED = {
  admin: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  member: { email: 'member@vuekumi.demo', password: 'User12345!' },
  /** Photo Influencer account — upload people-prompt UI. */
  photoInfluencer: { email: 'amara-okafor@vuekumi.demo', password: 'User12345!' },
  photographer: { email: 'thandiwe-nkosi@vuekumi.demo', password: 'User12345!' },
  model: { email: 'ada@vuekumi.demo', password: 'User12345!' },
  /** Likeness invite reserved for Playwright (API suite uses seed-nomsa-model-invite). */
  rightsInviteToken: 'seed-e2e-rights-invite',
  /** People photo with claimed model (Ada) — compensation / Open gate tests. */
  openPeoplePhotoId: 'afr-001',
  /** Landscape / free inventory suitable for anonymous Open download after rights clear. */
  openLandscapeCandidates: ['afr-005', 'afr-006', 'afr-012', 'afr-014'] as const,
  /** Self-shot people photo (Kofi) — DMCA + likeness dual-hold without breaking Ada profile smoke. */
  dmcaPhotoId: 'afr-027',
  /** Photo used for likeness rights-report freeze (not Ada's public profile hero). */
  disputePhotoId: 'afr-027',
} as const

export const API_BASE = process.env.E2E_API_URL ?? 'http://127.0.0.1:3001'
