import { PHOTO_CATEGORIES } from '@vuekumi/shared'

export function categorySlug(category: string) {
  return category
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const BY_SLUG = new Map(PHOTO_CATEGORIES.map((category) => [categorySlug(category), category]))

export function categoryFromSlug(slug: string) {
  return BY_SLUG.get(slug.toLowerCase()) ?? null
}

/** Public page for one photograph category. Model uses /models. */
export function categoryPath(category: string) {
  if (category === 'Model') return '/models'
  return `/category/${categorySlug(category)}`
}

export const CATEGORY_PAGES = PHOTO_CATEGORIES.map((category) => ({
  category,
  path: categoryPath(category),
}))
