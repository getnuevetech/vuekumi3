import { isAiTrainingEligible } from '@vuekumi/shared'
import { prisma } from './prisma.js'

export async function syncAiTrainingEligible(photoId: string) {
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: { appearances: true, copyrightAuthorizations: true },
  })
  if (!photo) return false
  const eligible = isAiTrainingEligible({
    copyrightAiTraining: photo.copyrightAiTraining,
    authorizations: photo.copyrightAuthorizations,
    hasRecognizablePeople: photo.hasRecognizablePeople,
    appearances: photo.appearances,
  })
  if (photo.aiTrainingEligible !== eligible) {
    await prisma.photo.update({
      where: { id: photoId },
      data: { aiTrainingEligible: eligible },
    })
  }
  return eligible
}
