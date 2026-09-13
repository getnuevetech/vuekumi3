import { z } from 'zod'

export const photoListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  category: z.string().optional(),
  country: z.string().optional(),
  license: z.enum(['free', 'premium']).optional(),
  q: z.string().optional(),
})

export type PhotoListQuery = z.infer<typeof photoListQuerySchema>
