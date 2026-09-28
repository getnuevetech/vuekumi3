import { PrismaClient } from '@prisma/client'

/** Shared Prisma client for e2e prep that has no public HTTP equivalent (Open gate fixtures, DMCA wait). */
export const prisma = new PrismaClient()
