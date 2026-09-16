import { z } from 'zod'

export const photoSortSchema = z.enum(['newest', 'downloads', 'views', 'likes'])

export const photoListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  category: z.string().optional(),
  country: z.string().optional(),
  license: z.enum(['free', 'premium']).optional(),
  q: z.string().optional(),
  tag: z.string().optional(),
  photographer: z.string().optional(),
  sort: photoSortSchema.default('newest'),
  facets: z.enum(['0', '1']).optional(),
})

export const photographerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().optional(),
})

export const modelListQuerySchema = photographerListQuerySchema

export type PhotoSort = z.infer<typeof photoSortSchema>
export type PhotoListQuery = z.infer<typeof photoListQuerySchema>
export type PhotographerListQuery = z.infer<typeof photographerListQuerySchema>
export type ModelListQuery = z.infer<typeof modelListQuerySchema>
