import { randomBytes } from 'node:crypto'
import type { AgencyRole } from '@vuekumi/shared'
import type { CollectionDto } from '@vuekumi/shared'
import { roleAtLeast } from './agency.js'

export const MAX_COLLECTIONS = 50
export const MAX_COLLECTION_PHOTOS = 200

export class CollectionError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'CollectionError'
    this.statusCode = statusCode
  }
}

export function newShareToken() {
  return randomBytes(16).toString('hex')
}

export type CollectionAccess = {
  visibility: string
  ownerId: string
  agencyId: string | null
  shareToken: string
}

export type Viewer = {
  id?: string
  agencyId?: string | null
  agencyRole?: string | null
}

export function canViewCollection(collection: CollectionAccess, viewer: Viewer | null, token?: string) {
  if (collection.visibility === 'public') return true
  if (collection.visibility === 'unlisted' && token && token === collection.shareToken) return true
  if (viewer?.id && collection.ownerId === viewer.id) return true
  if (viewer?.id && collection.agencyId && viewer.agencyId === collection.agencyId) return true
  return false
}

export function canEditCollection(collection: Pick<CollectionAccess, 'ownerId' | 'agencyId'>, viewer: Viewer | null) {
  if (!viewer?.id) return false
  if (collection.ownerId === viewer.id) return true
  if (collection.agencyId && viewer.agencyId === collection.agencyId) {
    return roleAtLeast((viewer.agencyRole as AgencyRole) ?? 'viewer', 'member')
  }
  return false
}

export function coverSrc(photo: {
  id: string
  src: string
  storageKey: string | null
  processingStatus: string
} | null | undefined) {
  if (!photo) return null
  if (photo.storageKey && photo.processingStatus === 'ready') return `/api/media/${photo.id}/thumb`
  return photo.src
}

export function serializeCollection(
  collection: {
    id: string
    name: string
    description: string | null
    visibility: string
    shareToken: string
    ownerId: string
    agencyId: string | null
    createdAt: Date
    updatedAt: Date
    owner: { name: string }
    agency: { name: string } | null
    photos: { photo: { id: string; src: string; storageKey: string | null; processingStatus: string } }[]
    _count: { photos: number }
  },
  viewer: Viewer | null,
): CollectionDto {
  const canEdit = canEditCollection(collection, viewer)
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    visibility: collection.visibility as CollectionDto['visibility'],
    shareToken: canEdit ? collection.shareToken : undefined,
    ownerName: collection.owner.name,
    agencyId: collection.agencyId,
    agencyName: collection.agency?.name ?? null,
    photoCount: collection._count.photos,
    coverSrc: coverSrc(collection.photos[0]?.photo),
    mine: Boolean(viewer?.id && collection.ownerId === viewer.id),
    canEdit,
    createdAt: collection.createdAt.toISOString(),
    updatedAt: collection.updatedAt.toISOString(),
  }
}
