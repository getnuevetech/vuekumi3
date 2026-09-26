import { CATEGORY_PAGES } from './categories'

export type MenuPathOption = { label: string; path: string }
export type MenuPathGroup = { label: string; options: MenuPathOption[] }

/** Pages an admin can attach to a header, account, or footer link. */
export const MENU_PATH_GROUPS: MenuPathGroup[] = [
  {
    label: 'Photograph categories',
    options: CATEGORY_PAGES.map((row) => ({ label: row.category, path: row.path })),
  },
  {
    label: 'Library and public pages',
    options: [
      { label: 'Home', path: '/' },
      { label: 'Library', path: '/search' },
      { label: 'Creators', path: '/creators' },
      { label: 'License and pricing', path: '/pricing' },
      { label: 'DMCA', path: '/dmca' },
      { label: 'Your rights', path: '/rights' },
      { label: 'Report content', path: '/report-content' },
      { label: 'Legal', path: '/legal' },
      { label: 'Log in', path: '/login' },
    ],
  },
  {
    label: 'Account',
    options: [
      { label: 'Account', path: '/account' },
      { label: 'Collections', path: '/collections' },
      { label: 'Licences', path: '/licenses' },
      { label: 'Favorites', path: '/favorites' },
      { label: 'Following', path: '/following' },
      { label: 'Bookings', path: '/bookings' },
      { label: 'Campaigns', path: '/campaigns' },
    ],
  },
  {
    label: 'Contributor, model, and agency',
    options: [
      { label: 'Upload a photograph', path: '/contributor/upload' },
      { label: 'Contributor home', path: '/contributor' },
      { label: 'Contributor portfolio', path: '/contributor/portfolio' },
      { label: 'Contributor earnings', path: '/contributor/earnings' },
      { label: 'Model portal', path: '/model' },
      { label: 'Model upload', path: '/model/upload' },
      { label: 'Agency', path: '/agency' },
      { label: 'Agency team', path: '/agency/team' },
      { label: 'Admin', path: '/admin' },
    ],
  },
  {
    label: 'Actions',
    options: [
      { label: 'Log out', path: '#logout' },
      { label: 'Become a contributor', path: '/login?redirect=/contributor/upload&signup=photographer' },
    ],
  },
]

const KNOWN_PATHS = new Set(MENU_PATH_GROUPS.flatMap((group) => group.options.map((option) => option.path)))

/** Keep a saved custom path visible so an existing menu does not lose it. */
export function menuPathChoices(current: string): MenuPathGroup[] {
  if (KNOWN_PATHS.has(current)) return MENU_PATH_GROUPS
  return [{ label: 'Saved path', options: [{ label: current, path: current }] }, ...MENU_PATH_GROUPS]
}

export function menuPathLabel(option: MenuPathOption) {
  if (option.label === option.path) return option.path
  return `${option.label} — ${option.path}`
}
