/**
 * Idempotent insert for the category demo photographs (afr-030 … afr-039).
 * Full seed wipes the database, so existing environments should run this instead.
 */
import { PrismaClient } from '@prisma/client'
import { photos } from './seed-data.js'

const prisma = new PrismaClient()
const peopleCategories = new Set(['People', 'Model', 'Fashion'])
const peopleTags = new Set(['portrait', 'model', 'woman', 'man', 'dance', 'maasai'])

async function main() {
  const demos = photos.filter((photo) => /^afr-03[0-9]$/.test(photo.id))
  for (const photo of demos) {
    const contributor = await prisma.contributorProfile.findUnique({
      where: { handle: photo.photographer },
      include: { user: true },
    })
    if (!contributor) {
      console.log(`skip ${photo.id}: no contributor @${photo.photographer}`)
      continue
    }
    const hasPeople = peopleCategories.has(photo.category) || photo.tags.some((tag) => peopleTags.has(tag))
    await prisma.photo.upsert({
      where: { id: photo.id },
      update: {
        title: photo.title,
        category: photo.category,
        country: photo.country,
        src: photo.src,
        hasRecognizablePeople: hasPeople,
      },
      create: {
        id: photo.id,
        contributorId: contributor.userId,
        uploadedById: contributor.userId,
        creationClaim: 'self_created',
        title: photo.title,
        category: photo.category,
        country: photo.country,
        licenseType: photo.license,
        price: photo.price,
        status: 'active',
        src: photo.src,
        downloads: photo.downloads,
        views: photo.views,
        likes: photo.likes,
        hasRecognizablePeople: hasPeople,
        permissionState: hasPeople ? 'editorial' : 'commercial',
        publishedAt: new Date(),
        tags: { create: photo.tags.map((tag) => ({ tag })) },
        rightsRecord: {
          create: {
            copyrightVerified: true,
            copyrightStatus: 'verified',
            copyrightAttestedAt: new Date(),
            copyrightHolder: contributor.user.name,
            platformRightsOk: true,
            modelReleaseRequired: hasPeople,
            modelReleaseStatus: hasPeople ? 'pending' : 'not_required',
            modelConsentStatus: hasPeople ? 'required' : 'not_required',
            commercialEligible: !hasPeople,
          },
        },
      },
    })
    console.log(`upserted ${photo.id} ${photo.category}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
