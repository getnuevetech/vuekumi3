import { z } from 'zod'
import { isCreatorAccount } from './accounts.js'
import { hasModelAccess } from './models.js'

/**
 * Public site words, menu, and logo. Images in the homepage slots stay on
 * the featured-pin editor. Live counts, prices, and the contributor share
 * stay on their own records and are filled in with {tokens}.
 */

export const HOME_ICON_KEYS = ['frame', 'shield', 'plus', 'camera', 'globe', 'star'] as const
export type HomeIconKey = (typeof HOME_ICON_KEYS)[number]

export const SITE_MENU_AUDIENCES = [
  'always',
  'signed_out',
  'signed_in',
  'buyer',
  'creator',
  'model',
  'agency',
  'admin',
] as const
export type SiteMenuAudience = (typeof SITE_MENU_AUDIENCES)[number]

const sitePath = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^(?:\/(?!\/)[A-Za-z0-9/_\-?=&%.]*|#[A-Za-z0-9_-]+)$/, 'Links must be a path on this site')

const line = (max: number) => z.string().trim().min(1).max(max)
const note = (max: number) => z.string().trim().min(1).max(max)

const menuSort = z.number().int().min(0).max(999).optional()

export const siteMenuLinkSchema = z.object({
  label: line(40),
  to: sitePath,
  audience: z.enum(SITE_MENU_AUDIENCES),
  sort: menuSort,
})
export type SiteMenuLink = z.infer<typeof siteMenuLinkSchema>

export const siteFooterLinkSchema = z.object({
  label: line(40),
  to: sitePath,
  sort: menuSort,
})
export type SiteFooterLink = z.infer<typeof siteFooterLinkSchema>

/** Lower numbers appear first. A missing number keeps the link in its current place. Ties keep that order. */
export function sortMenuLinks<T extends { sort?: number }>(links: T[]): Array<T & { sort: number }> {
  return links
    .map((link, index) => ({ link, index, sort: typeof link.sort === 'number' && Number.isFinite(link.sort) ? link.sort : index + 1 }))
    .sort((a, b) => a.sort - b.sort || a.index - b.index)
    .map(({ link, sort }) => ({ ...link, sort }))
}

export const MENU_FONTS = ['condensed', 'serif', 'mono'] as const
export type MenuFont = (typeof MENU_FONTS)[number]

export const siteMenuStyleSchema = z.object({
  font: z.enum(MENU_FONTS),
  sizePx: z.number().int().min(8).max(18),
})
export type SiteMenuStyle = z.infer<typeof siteMenuStyleSchema>

export function menuTypeClass(font: MenuFont): string {
  if (font === 'serif') return 'font-serif-display'
  if (font === 'mono') return 'font-mono-tech'
  return 'font-condensed'
}

export const siteContentSchema = z.object({
  brand: z.object({
    name: line(40),
    accent: z.string().trim().max(20),
    logoRef: z.string().trim().max(500).nullable(),
  }),
  searchPlaceholder: line(60),
  menu: z.array(siteMenuLinkSchema).min(1).max(24),
  accountMenu: z.array(siteMenuLinkSchema).min(1).max(16),
  menuStyle: siteMenuStyleSchema,
  actions: z.object({
    login: line(40),
    logout: line(40),
    sell: line(40),
  }),
  footer: z.object({
    blurb: note(400),
    copyright: line(160),
    links: z.array(siteFooterLinkSchema).min(1).max(16),
  }),
  home: z.object({
    hero: z.object({
      slides: z.array(z.object({
        script: line(40),
        title: line(40),
        sub: note(240),
      })).min(1).max(3),
      primaryLabel: line(40),
      primaryTo: sitePath,
      secondaryLabel: line(40),
      secondaryTo: sitePath,
    }),
    marqueeFallback: z.array(line(40)).min(1).max(12),
    messages: z.array(z.object({
      icon: z.enum(HOME_ICON_KEYS),
      title: line(40),
      text: note(280),
    })).min(1).max(6),
    categories: z.object({ kicker: line(40), title: line(60) }),
    cta: z.object({
      text: note(180),
      emphasis: line(80),
    }),
    feed: z.object({
      kicker: line(40),
      title: line(40),
      titleAccent: line(40),
      browseLabel: line(80),
      loading: line(80),
      end: line(120),
    }),
    editorial: z.object({
      side: line(80),
      kicker: line(40),
      title: line(80),
      body: note(500),
      royaltyLabel: line(40),
      photosLabel: line(40),
      countriesLabel: line(40),
      cta: line(40),
    }),
    statsCaption: note(160),
    contributors: z.object({
      kicker: line(40),
      title: line(60),
      linkLabel: line(40),
      joinScript: line(20),
      joinLabel: line(40),
    }),
    models: z.object({
      kicker: line(40),
      title: line(60),
      linkLabel: line(40),
      note: note(160),
    }),
    pricingCta: line(40),
  }),
  pages: z.object({
    pricing: z.object({
      kicker: line(40),
      title: line(80),
      titleEmphasis: line(80),
      intro: note(500),
      licenceKicker: line(40),
      licenceTitle: line(80),
      licences: z.array(z.object({ name: line(40), note: note(240) })).min(1).max(8),
      contributorKicker: line(40),
      contributorTitle: line(80),
      contributorBody: note(500),
      faqs: z.array(z.object({ q: line(120), a: note(500) })).min(1).max(8),
    }),
    creators: z.object({ kicker: line(40), title: line(80), intro: note(500) }),
    models: z.object({ kicker: line(40), title: line(80), intro: note(500) }),
    search: z.object({ kicker: line(40), title: line(80), intro: note(240) }),
    legal: z.object({ kicker: line(40), title: line(80) }),
    rights: z.object({ kicker: line(40), title: line(80), intro: note(500) }),
    dmca: z.object({ kicker: line(40), title: line(80), intro: note(500) }),
    report: z.object({ kicker: line(40), title: line(80), intro: note(500) }),
  }),
})

export type SiteContent = z.infer<typeof siteContentSchema>

export interface SiteFacts {
  photographerPct: number
  payoutMinimumUsd: number
}

export interface SitePublicDto {
  content: SiteContent
  logoUrl: string | null
  facts: SiteFacts
}

export const DEFAULT_SITE_CONTENT: SiteContent = {
  brand: { name: 'Vuekumi', accent: 'kumi', logoRef: null },
  searchPlaceholder: 'Search Africa…',
  menu: [
    { label: 'Library', to: '/search', audience: 'always' },
    { label: 'Creators', to: '/creators', audience: 'always' },
    { label: 'Models', to: '/models', audience: 'always' },
    { label: 'License & Pricing', to: '/pricing', audience: 'always' },
    { label: 'Bookings', to: '/bookings', audience: 'signed_in' },
    { label: 'Campaigns', to: '/campaigns', audience: 'buyer' },
    { label: 'Favorites', to: '/favorites', audience: 'buyer' },
    { label: 'Following', to: '/following', audience: 'buyer' },
    { label: 'Collections', to: '/collections', audience: 'buyer' },
    { label: 'Account', to: '/account', audience: 'signed_in' },
    { label: 'Licences', to: '/licenses', audience: 'buyer' },
    { label: 'Agency', to: '/agency', audience: 'agency' },
    { label: 'Model', to: '/model', audience: 'model' },
    { label: 'Contributor', to: '/contributor', audience: 'creator' },
    { label: 'Admin', to: '/admin', audience: 'admin' },
  ],
  accountMenu: [
    { label: 'Account', to: '/account', audience: 'signed_in', sort: 1 },
    { label: 'Upload', to: '/contributor/upload', audience: 'creator', sort: 2 },
    { label: 'Collections', to: '/collections', audience: 'signed_in', sort: 3 },
    { label: 'Licences', to: '/licenses', audience: 'buyer', sort: 4 },
    { label: 'Favorites', to: '/favorites', audience: 'buyer', sort: 5 },
    { label: 'Admin', to: '/admin', audience: 'admin', sort: 6 },
    { label: 'Log out', to: '#logout', audience: 'signed_in', sort: 7 },
  ],
  menuStyle: { font: 'condensed', sizePx: 10 },
  actions: { login: 'Log in', logout: 'Log out', sell: 'Sell your photos' },
  footer: {
    blurb: "The stock image platform for authentic African photography. Free and premium images, licensed directly from the continent's photographers.",
    copyright: '© 2026 Vuekumi — usage permission, never ownership',
    links: [
      { label: 'Library', to: '/search' },
      { label: 'Creators', to: '/creators' },
      { label: 'Models', to: '/models' },
      { label: 'License & Pricing', to: '/pricing' },
      { label: 'DMCA', to: '/dmca' },
      { label: 'Your rights', to: '/rights' },
      { label: 'Report content', to: '/report-content' },
      { label: 'Legal', to: '/legal' },
      { label: 'Contribute', to: '/login?redirect=/contributor/upload&signup=photographer' },
      { label: 'Account', to: '/account' },
    ],
  },
  home: {
    hero: {
      slides: [
        {
          script: 'the real',
          title: 'AFRICA',
          sub: 'Unfiltered light, colour and story — shot by the people who live it.',
        },
        {
          script: 'in every',
          title: 'FRAME',
          sub: '{photos} authentic images from {countries} {countryWord}. Free and premium.',
        },
        {
          script: 'your next',
          title: 'STORY',
          sub: 'License instantly. Photographers keep copyright — and {share} of paid licences.',
        },
      ],
      primaryLabel: 'Explore the library',
      primaryTo: '#feed',
      secondaryLabel: 'License & pricing',
      secondaryTo: '/pricing',
    },
    marqueeFallback: ['People', 'Model', 'Wildlife', 'Landscape', 'Urban', 'Culture', 'Food & Craft', 'Coast', 'Fashion', 'Architecture'],
    messages: [
      {
        icon: 'frame',
        title: 'Staff featured',
        text: 'Homepage highlights are staff-pinned live stock; empty slots follow ranking. Featuring is not a licence — commercial sales still need cleared rights.',
      },
      {
        icon: 'shield',
        title: 'Copyright protected',
        text: 'Photographers keep 100% of their copyright. Licences are issued per image, on record.',
      },
      {
        icon: 'plus',
        title: 'Instant licence',
        text: 'Free downloads with attribution, or premium and extended licences bought in one click.',
      },
    ],
    categories: { kicker: 'browse by', title: 'Categories' },
    cta: {
      text: 'Your work deserves an audience of the whole world — ',
      emphasis: 'and a fair cut of it.',
    },
    feed: {
      kicker: 'the library',
      title: 'Endless',
      titleAccent: ' Scroll',
      browseLabel: 'search the catalog →',
      loading: 'Loading more from the continent',
      end: 'That is the live library',
    },
    editorial: {
      side: 'Shot by the continent — Est. 2026',
      kicker: 'our promise',
      title: 'Paid licences pay their maker',
      body: 'Vuekumi is built backwards from the contributor: {share} of every paid licence, copyright stays with the photographer, and payouts over bank transfer or mobile money when you request them — ${minimum} minimum. Free-collection downloads are a $0 grant.',
      royaltyLabel: 'royalty on premium',
      photosLabel: 'photographs live',
      countriesLabel: 'countries in the library',
      cta: 'Start uploading',
    },
    statsCaption: 'Share of the live library by genre',
    contributors: {
      kicker: 'the makers',
      title: 'Contributors',
      linkLabel: 'Browse creators →',
      joinScript: 'you?',
      joinLabel: 'Become a contributor',
    },
    models: {
      kicker: 'the people',
      title: 'In the photographs',
      linkLabel: 'Browse models →',
      note: 'Likeness permission — copyright stays with the photographer',
    },
    pricingCta: 'View more',
  },
  pages: {
    pricing: {
      kicker: 'Licence & pricing',
      title: 'Simple plans,',
      titleEmphasis: 'fair for everyone.',
      intro: 'Free for discovery, paid licences for creators. Every paid sale splits {photographerPct}/{platformPct} between the photographer and Vuekumi. Vuekumi+ lifts your daily royalty-free quota — it is not a contributor download pool.',
      licenceKicker: 'Licence types',
      licenceTitle: 'Permission, not ownership.',
      licences: [
        { name: 'Royalty-Free', note: 'Free collection. $0 grant. 50 downloads / UTC day on Free; unlimited on Vuekumi+. Does not pay the photographer.' },
        { name: 'Commercial', note: 'Premium collection at the photo price. Full resolution. {share} to the photographer.' },
        { name: 'Extended Commercial', note: '$49. Merchandise, unlimited print, broadcast. {share} to the photographer.' },
        { name: 'Editorial', note: 'News and commentary only. Model release not required. Paid sale, same split.' },
        { name: 'Rights-Managed', note: 'Quoted by territory, duration and channels. Not a fixed price. Paid sale, same split.' },
        { name: 'Exclusive', note: 'Contributor opt-in per photo. Sale delists the image. Paid sale, same split.' },
      ],
      contributorKicker: 'For contributors',
      contributorTitle: 'Where the money goes.',
      contributorBody: 'Paid licences split {photographerPct}/{platformPct} after payment clears — the same split written to the earnings ledger. Royalty-free downloads from the free collection are a $0 grant. Vuekumi+ only raises a buyer’s daily quota; it does not fund a per-download pool.',
      faqs: [
        {
          q: 'What is the standard license?',
          a: 'Use images in websites, social, presentations and editorial — free for commercial and personal work. Resale of the unmodified image itself is not allowed.',
        },
        {
          q: 'What does Vuekumi+ include?',
          a: 'Plus is the buyer plan saved in admin. Premium, extended, editorial, rights-managed and exclusive licences are still billed per image. Photographers keep {share} of those paid sales. Plus does not pay contributors for free-collection downloads.',
        },
        {
          q: 'How do contributors earn?',
          a: 'Paid licences split {photographerPct}/{platformPct} with the photographer after payment clears. Royalty-free grants from the free collection are $0 and do not credit the earnings ledger. Payouts are requested from the contributor portal once the available balance is at least ${minimum}, over mobile money or bank transfer.',
        },
        {
          q: 'Can I use images for client work?',
          a: 'Yes — both the standard and Vuekumi+ royalty-free grants cover client projects. Only merchandise/resale use requires an Extended license.',
        },
        {
          q: 'Who owns the copyright?',
          a: 'The photographer, always. Vuekumi licenses usage rights; copyright stays with the contributor.',
        },
      ],
    },
    creators: {
      kicker: 'The makers',
      title: 'Creators.',
      intro: 'Photographers and photo influencers are different account types. Every creator keeps copyright; Vuekumi sells usage permission, not ownership. Photographers license commercial stock. Photo influencers are discovery creators, not commercial inventory.',
    },
    models: {
      kicker: 'People',
      title: 'Models.',
      intro: 'Public portfolios assembled from photographs a model approved. Copyright stays with the photographer. Vuekumi sells usage permission, not ownership. Models do not earn from licences. Open a portfolio to book when the model is available — settlement is off-platform and Vuekumi takes no booking commission.',
    },
    search: {
      kicker: 'Catalog',
      title: 'The library',
      intro: '{count} photographs from African contributors.',
    },
    legal: { kicker: 'Product engine', title: 'Global Rights Standard.' },
    rights: {
      kicker: 'Rights',
      title: 'Your rights.',
      intro: 'Review likeness or copyright invites, approve or reject usage, without inventing fees. Compensation negotiation is not on this hub yet.',
    },
    dmca: {
      kicker: 'Copyright',
      title: 'DMCA notices.',
      intro: 'This form is for copyright claims only. Likeness, privacy, and contract complaints use the photograph page report, not DMCA. Vuekumi sells usage permission, not ownership. Existing licence certificates are not silently voided.',
    },
    report: {
      kicker: 'Trust',
      title: 'Report content.',
      intro: 'Paste the photograph page link, then choose a category. Guests welcome. Statutory copyright takedown is a separate DMCA notice — not for likeness, privacy, or safety.',
    },
  },
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function deepMerge(base: unknown, patch: unknown): unknown {
  if (patch === undefined || patch === null) return base
  if (Array.isArray(base)) return Array.isArray(patch) ? patch : base
  if (isPlainObject(base) && isPlainObject(patch)) {
    const out: Record<string, unknown> = { ...base }
    for (const key of Object.keys(patch)) {
      out[key] = key in base ? deepMerge((base as Record<string, unknown>)[key], patch[key]) : patch[key]
    }
    return out
  }
  return patch === undefined ? base : patch
}

export function normalizeSiteContent(content: SiteContent): SiteContent {
  return {
    ...content,
    menu: sortMenuLinks(content.menu),
    accountMenu: sortMenuLinks(content.accountMenu),
    footer: { ...content.footer, links: sortMenuLinks(content.footer.links) },
  }
}

export function mergeSiteContent(stored: unknown): SiteContent {
  const parsed = siteContentSchema.safeParse(deepMerge(DEFAULT_SITE_CONTENT, stored))
  return parsed.success ? normalizeSiteContent(parsed.data) : DEFAULT_SITE_CONTENT
}

export function fillSiteTokens(text: string, tokens: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (
    Object.prototype.hasOwnProperty.call(tokens, key) ? String(tokens[key]) : match
  ))
}

export type MenuViewer = {
  accountType?: string | null
  agencyId?: string | null
  hasModelProfile?: boolean | null
} | null

export function menuLinkVisible(link: SiteMenuLink, user: MenuViewer): boolean {
  switch (link.audience) {
    case 'always':
      return true
    case 'signed_out':
      return !user
    case 'signed_in':
      return Boolean(user)
    case 'buyer':
      return Boolean(user && user.accountType !== 'model')
    case 'creator':
      return Boolean(user && isCreatorAccount(user.accountType))
    case 'model':
      return Boolean(user?.accountType && hasModelAccess({ accountType: user.accountType, hasModelProfile: user.hasModelProfile }))
    case 'agency':
      return Boolean(user && (user.accountType === 'agency' || user.agencyId))
    case 'admin':
      return user?.accountType === 'admin'
    default:
      return false
  }
}
