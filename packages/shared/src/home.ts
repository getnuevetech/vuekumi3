import type { PhotoDto } from './types.js'

export interface HomeCategoryShare {
  value: string
  count: number
  sharePct: number
}

export interface PublicStatsDto {
  photosLive: number
  contributors: number
  countries: number
  downloads: number
  categories: HomeCategoryShare[]
}

export interface HomeFeaturedDto {
  hero: PhotoDto[]
  edge: PhotoDto[]
  editorial: PhotoDto[]
  pricing: PhotoDto[]
  statsBackground: PhotoDto | null
}

export interface HomePageDto {
  stats: PublicStatsDto
  featured: HomeFeaturedDto
}
