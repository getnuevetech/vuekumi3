/**
 * D-R2 marketplace chrome — shared discovery shell for home, library, category, and image detail.
 * Header/footer/search stay implemented in `shared.tsx` and are re-exported here so
 * public pages import from one marketplace surface.
 */
export { SiteHeader, PublicFooter, SearchForm, PhotoCard, PhotoMasonry, LogoMark, AccountMenu } from '../shared'
export { PhotoTile, PhotoTileMasonry, type PhotoDensity } from './PhotoTile'
export { FilterOption, LibraryFilterPanel, type FacetRow } from './FilterPanel'
