import type { FastifyInstance } from 'fastify'
import {
  type ContributorGate,
  type PermissionState,
  type RemediationProposal,
  z,
  PLACEHOLDER_SRC,
  photoInclude,
  assertUploadForContributor,
  CONSENT_VERSION,
  applyScreeningToPeopleFlag,
  commercialInventoryBlocked,
  declareSubjectAgeSchema,
  identifyAppearanceSchema,
  isAiTrainingEligible,
  isCommerciallyEligible,
  isCommunityContributor,
  isCreatorWorkspaceAccount,
  isNonCommercialCreator,
  MODEL_RELEASE_ATTESTATION,
  authorizeGuardianSchema,
  nonCommercialCreatorBlocksState,
  presignUploadSchema,
  selfShotAppearanceSchema,
  submitPhotoSchema,
  twoPartyCommercialCleared,
  updatePhotoSchema,
  uploadSignedReleaseSchema,
  accountHasFeature,
  allowsCommercialStock,
  writeAuditLog,
  syncAiTrainingEligible,
  isImpersonatingStaff,
  resolveCreatorWorkspaceId,
  prisma,
  processPhotoAssets,
  contributorHasAgreement,
  serializePhoto,
  resolveLibraryTierForWrite,
  syncCommercialStatus,
  approvalRate,
  payoutQuoteForContributor,
  earningsMonthSeries,
  PhotoEditError,
  assertContributorStatusChange,
  assertExclusiveEdit,
  assertPeopleFlagEdit,
  nextLicensePrice,
  nextModelReleaseFields,
  assertPermissionStateChange,
  permissionWriteData,
  resolvePermissionState,
  appearanceInclude,
  appearanceUnclaimed,
  decideAppearanceBlocked,
  ensureModelProfile,
  ModelError,
  modelAccountBlocked,
  ownEmailInviteBlocked,
  serializeAppearance,
  syncPermissionToTwoParty,
  syncVerifiedRightsRecord,
  appendRightsLedgerEvent,
  loadRightsLedger,
  issueAppearanceInvite,
  loadOriginalBytes,
  screenImageForRights,
  screeningWriteData,
  applyPreviewAdjustment,
  enhanceLowResolution,
  proposeRemediation,
  narrateCatalogEngagement,
  reportingProviderKind,
  evaluateContentApproval,
  ALLOWED_IMAGE_TYPES,
  assertOwnedOriginalKey,
  extensionFor,
  derivativeKey,
  getObjectBuffer,
  objectExists,
  originalKeyFor,
  putObject,
  presignPut,
  verifyLocalToken,
  writeLocalUpload,
} from './shared.js'

export async function registerContributorPhotoRoutes(app: FastifyInstance, gate: ContributorGate) {
  app.get('/contributor/photos', gate, async (request, reply) => {
    const contributorId = await resolveCreatorWorkspaceId(request, reply)
    if (!contributorId) return

    const photos = await prisma.photo.findMany({
      where: { contributorId },
      include: {
        tags: true,
        rightsRecord: true,
        appearances: true,
        contributor: { include: { contributorProfile: true, platformAgreements: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return {
      items: photos.map((p) =>
        serializePhoto(
          p,
          p.contributor.contributorProfile?.handle ?? p.contributorId,
          p.contributor.platformAgreements.some((a) => a.status === 'accepted'),
        ),
      ),
    }
  })

  app.get('/contributor/photos/:id', gate, async (request, reply) => {
    const { id } = request.params as { id: string }
    const photo = await prisma.photo.findUnique({ where: { id }, include: photoInclude })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    if (!isImpersonatingStaff(request.authUser) && photo.contributorId !== request.userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    const appearances = await prisma.photoAppearance.findMany({
      where: { photoId: id },
      include: {
        photo: { include: { contributor: true } },
        modelUser: { include: { modelProfile: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    return {
      photo: serializePhoto(
        photo,
        photo.contributor.contributorProfile?.handle ?? photo.contributorId,
        photo.contributor.platformAgreements.some((a) => a.status === 'accepted'),
        { appearances: appearances.map((row) => serializeAppearance(row, { includeEmail: true, includeMobile: true })) },
      ),
    }
  })

  app.post('/contributor/photos', gate, async (request, reply) => {
    const accountType = request.authUser?.accountType
    if (!isCreatorWorkspaceAccount(accountType) && !isImpersonatingStaff(request.authUser)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    if (request.authUser?.status === 'pending' && !isImpersonatingStaff(request.authUser)) {
      return reply.code(403).send({ error: 'Your account is pending staff review before you can upload' })
    }

    const contributorId = await resolveCreatorWorkspaceId(request, reply)
    if (!contributorId) return
    if (!(await assertUploadForContributor(contributorId, reply))) return

    const body = submitPhotoSchema.parse(request.body)
    const target = await prisma.user.findUnique({
      where: { id: contributorId },
      select: { accountType: true },
    })
    const targetAccountType = target?.accountType ?? accountType
    const hasAgreement = await contributorHasAgreement(contributorId)
    if (!hasAgreement) {
      return reply.code(400).send({
        error: isCommunityContributor(targetAccountType)
          ? 'Accept the VueKumi community contributor terms before submitting'
          : isNonCommercialCreator(targetAccountType)
            ? 'Accept the VueKumi photo influencer terms before submitting'
            : 'Accept the current VueKumi photographer licensing agreement before submitting',
      })
    }

    if (body.originalKey) {
      try {
        assertOwnedOriginalKey(body.originalKey, contributorId)
      } catch {
        return reply.code(400).send({ error: 'Invalid original storage key' })
      }
      if (!(await objectExists(body.originalKey))) {
        return reply.code(400).send({ error: 'Upload the image file before submitting' })
      }
    }

    const image = await loadOriginalBytes(body.originalKey)
    const screening = await screenImageForRights({
      title: body.title,
      category: body.category,
      filename: body.originalKey,
      declaredPeople: body.hasRecognizablePeople,
      image,
    })
    const people = applyScreeningToPeopleFlag({ declaredPeople: body.hasRecognizablePeople, screening })
    const commercialUploader = await allowsCommercialStock(targetAccountType ?? 'user')
    if (!commercialUploader && (body.licenseType === 'premium' || body.permissionState === 'commercial' || body.permissionState === 'exclusive')) {
      return reply.code(400).send({
        error: commercialInventoryBlocked(targetAccountType)
          ?? 'This account type cannot enter commercial inventory.',
      })
    }
    const requestedPermission = commercialUploader
      ? body.permissionState
      : (body.permissionState && ['private', 'portfolio', 'editorial'].includes(body.permissionState)
          ? body.permissionState
          : 'portfolio')
    const modelReleaseAttached = Boolean(body.modelReleaseFileName)
    const id = `sub-${Date.now().toString(36)}`
    const processingStatus = body.originalKey ? 'pending' : 'ready'
    const permissionState = resolvePermissionState({
      requested: requestedPermission,
      exclusiveAvailable: commercialUploader ? body.exclusiveAvailable : false,
      hasRecognizablePeople: people,
    })
    const communityBlock = nonCommercialCreatorBlocksState(targetAccountType, permissionState)
    if (communityBlock) {
      return reply.code(400).send({ error: communityBlock })
    }
    try {
      assertPermissionStateChange({
        next: permissionState,
        exclusiveSold: false,
        commercialLocked: false,
        hasRecognizablePeople: people,
        twoPartyCleared: false,
        actor: isImpersonatingStaff(request.authUser) ? 'admin' : 'contributor',
      })
    } catch (err) {
      if (err instanceof PhotoEditError) {
        return reply.code(err.statusCode).send({ error: err.message })
      }
      throw err
    }
    const permission = permissionWriteData(permissionState, false, body.restrictionNotes)
    const now = new Date()
    const modelConsentStatus = people ? 'required' : 'not_required'
    const copyrightStatus = 'claimed' as const
    const commercialEligible = isCommerciallyEligible({
      copyrightStatus,
      modelConsentStatus,
      creationClaim: 'self_created',
    })
    const licenseType = commercialUploader ? body.licenseType : 'free'
    const libraryTier = resolveLibraryTierForWrite({
      licenseType,
      permissionState: permission.permissionState,
      accountType: targetAccountType,
    })

    let shootId: string | undefined
    if (body.shootTitle && commercialUploader) {
      const shoot = await prisma.photoShoot.create({
        data: {
          photographerId: contributorId,
          title: body.shootTitle,
          shotOn: body.shotOn ? new Date(body.shotOn) : null,
        },
      })
      shootId = shoot.id
    }

    let photo = await prisma.$transaction(async (tx) => {
      const created = await tx.photo.create({
        data: {
          id,
          contributorId,
          uploadedById: contributorId,
          creationClaim: 'self_created',
          title: body.title,
          description: body.description,
          category: body.category,
          country: body.country,
          licenseType,
          libraryTier,
          commercialStatus: syncCommercialStatus(false),
          price: commercialUploader && body.licenseType === 'premium' ? (body.price ?? 12) : 0,
          status: 'pending',
          src: body.src || PLACEHOLDER_SRC,
          storageKey: body.originalKey,
          processingStatus,
          hasRecognizablePeople: people,
          exclusiveAvailable: commercialUploader ? permission.exclusiveAvailable : false,
          permissionState: permission.permissionState,
          restrictionNotes: permission.restrictionNotes,
          shootId,
          ...screeningWriteData(screening),
          tags: body.tags?.length ? { create: body.tags.map((tag) => ({ tag })) } : undefined,
          assets: body.originalKey
            ? {
                create: {
                  kind: 'original',
                  storageKey: body.originalKey,
                  mimeType: 'application/octet-stream',
                },
              }
            : undefined,
          rightsRecord: {
            create: {
              copyrightVerified: true,
              copyrightStatus,
              copyrightAttestedAt: now,
              copyrightHolder: body.copyrightHolder,
              modelReleaseRequired: people,
              modelReleaseStatus: people ? 'pending' : 'not_required',
              modelConsentStatus,
              commercialEligible,
              platformRightsOk: true,
            },
          },
          moderationItems: {
            create: {
              flag: people ? 'copyright check' : 'new submission',
              submittedBy: request.authUser?.contributorHandle ?? request.authUser?.email ?? contributorId,
              status: 'pending',
            },
          },
        },
        include: photoInclude,
      })

      if (people && modelReleaseAttached && commercialUploader) {
        await tx.modelRelease.create({
          data: {
            photoId: created.id,
            photographerId: contributorId,
            fileName: body.modelReleaseFileName!,
            notes: body.modelReleaseNotes,
            status: 'pending',
            verificationLevel: 'photographer_provided',
            attestedGenuine: true,
            attestedAt: now,
          },
        })
      }

      await tx.contributorProfile.updateMany({
        where: { userId: contributorId },
        data: { photosCount: { increment: 1 } },
      })

      return created
    })

    if (body.originalKey) {
      try {
        await processPhotoAssets(photo.id)
        const reloaded = await prisma.photo.findUnique({
          where: { id: photo.id },
          include: photoInclude,
        })
        if (reloaded) photo = reloaded
      } catch (err) {
        request.log.warn({ err, photoId: photo.id }, 'inline derivative processing failed')
      }
    }

    // Phase 62 / FC1-6 — Free Library low-res: enhance then re-check; quarantine if still unusable.
    let remediation: RemediationProposal | null = null
    if (image) {
      let working = image
      if (libraryTier === 'OPEN' && body.originalKey) {
        const enhanced = await enhanceLowResolution(working, 800, 600)
        if (enhanced.enhanced) {
          await putObject(body.originalKey, enhanced.buffer, 'image/jpeg')
          working = enhanced.buffer
          await prisma.photo.update({
            where: { id: photo.id },
            data: { width: enhanced.width, height: enhanced.height },
          })
          try {
            await processPhotoAssets(photo.id)
          } catch (err) {
            request.log.warn({ err, photoId: photo.id }, 'reprocess after Free Library enhance failed')
          }
        }
      }
      remediation = await proposeRemediation(working)
      if (
        libraryTier === 'OPEN' &&
        remediation.decision !== 'quarantine' &&
        ((photo.width != null && photo.width < 800) || (photo.height != null && photo.height < 600))
      ) {
        const meta = await enhanceLowResolution(working, 800, 600)
        if (!meta.enhanced || meta.width < 800 || meta.height < 600) {
          remediation = {
            ...remediation,
            decision: 'quarantine',
            notes: [
              `low_resolution: Free Library requires at least 800×600 after enhancement (${meta.width}×${meta.height}).`,
              ...remediation.notes,
            ],
          }
        }
      }
      const duplicate = remediation.contentHash
        ? await prisma.photo.findFirst({
            where: {
              contentHash: remediation.contentHash,
              NOT: { id: photo.id },
              status: 'active',
            },
            select: { id: true, title: true },
          })
        : null
      if (duplicate) {
        remediation = {
          ...remediation,
          decision: 'quarantine',
          notes: [
            `This file matches live photograph ${duplicate.id} (${duplicate.title}). It stays in review. The original was not altered.`,
            ...remediation.notes,
          ],
        }
      }
      await prisma.photo.update({
        where: { id: photo.id },
        data: { contentHash: remediation.contentHash },
      })
      if (remediation.decision === 'quarantine') {
        await prisma.moderationItem.updateMany({
          where: { photoId: photo.id, status: 'pending' },
          data: { notes: `Quarantine: ${remediation.notes.join(' ')}`.slice(0, 500) },
        })
      }
    }

    // Phase 61 — second, independent signal alongside the existing manual
    // moderation queue. Never touches the Phase 49 country gate or rights
    // engine; "not auto-approved" just means today's unchanged pending state.
    if (photo.status === 'pending' && remediation?.decision !== 'quarantine') {
      const approval = await evaluateContentApproval({
        screening: {
          possibleMinor: photo.possibleMinor,
          potentiallySensitive: photo.potentiallySensitive,
          uncertainHumanDetection: photo.uncertainHumanDetection,
        },
        title: photo.title,
        category: photo.category,
        country: photo.country,
        width: photo.width,
        height: photo.height,
      })
      if (approval.decision === 'active') {
        const pendingModeration = await prisma.moderationItem.findFirst({
          where: { photoId: photo.id, status: 'pending' },
        })
        await prisma.$transaction([
          prisma.photo.update({
            where: { id: photo.id },
            data: { status: 'active', publishedAt: new Date() },
          }),
          ...(pendingModeration
            ? [
                prisma.moderationItem.update({
                  where: { id: pendingModeration.id },
                  data: {
                    status: 'approved',
                    decidedAt: new Date(),
                    notes: `Auto-approved by AI criteria: ${approval.reasons.join(', ')}`,
                  },
                }),
              ]
            : []),
        ])
        await writeAuditLog({
          actorId: request.userId,
          action: 'moderation.content_auto_approved',
          entityType: 'photo',
          entityId: photo.id,
          metadata: { reasons: approval.reasons },
          ipAddress: request.ip,
        })
        const reloaded = await prisma.photo.findUnique({ where: { id: photo.id }, include: photoInclude })
        if (reloaded) photo = reloaded
      }
    }

    await writeAuditLog({
      actorId: request.userId,
      action: 'contributor.submit_photo',
      entityType: 'photo',
      entityId: photo.id,
      metadata: {
        hasRecognizablePeople: people,
        exclusiveAvailable: permission.exclusiveAvailable,
        permissionState: permission.permissionState,
        originalKey: Boolean(body.originalKey),
      },
      ipAddress: request.ip,
    })
    await appendRightsLedgerEvent({
      photoId: photo.id,
      action: 'copyright.attested',
      actorId: request.userId,
      actorKind: 'user',
      agreementVersion: commercialUploader ? 'photographer' : 'community',
      nextCopyright: copyrightStatus,
      nextLikeness: modelConsentStatus,
      commercialEligible,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    })

    return {
      photo: serializePhoto(photo, photo.contributor.contributorProfile?.handle ?? contributorId, true),
      remediation,
    }
  })

  app.post('/contributor/photos/:id/remediation', gate, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = z.object({ action: z.enum(['brighten', 'crop']) }).parse(request.body)
    const photo = await prisma.photo.findUnique({
      where: { id },
      include: { assets: true },
    })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    if (!isImpersonatingStaff(request.authUser) && photo.contributorId !== request.userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    const original = photo.assets.find((asset) => asset.kind === 'original')
    if (!original) return reply.code(400).send({ error: 'Upload the original before applying a preview adjustment' })
    const bytes = await getObjectBuffer(original.storageKey)
    const adjusted = await applyPreviewAdjustment(bytes, body.action)
    const previewKey = derivativeKey(original.storageKey, 'preview')
    const stored = await putObject(previewKey, adjusted, 'image/jpeg')
    await prisma.photoAsset.upsert({
      where: { photoId_kind: { photoId: id, kind: 'preview' } },
      create: { photoId: id, kind: 'preview', storageKey: stored.key, bytes: stored.bytes, mimeType: 'image/jpeg' },
      update: { storageKey: stored.key, bytes: stored.bytes, mimeType: 'image/jpeg' },
    })
    await writeAuditLog({
      actorId: request.userId,
      action: 'photo.remediation_preview',
      entityType: 'photo',
      entityId: id,
      metadata: { action: body.action, originalUntouched: true },
      ipAddress: request.ip,
    })
    return { ok: true, action: body.action, originalUntouched: true }
  })

  app.patch('/contributor/photos/:id', gate, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updatePhotoSchema.parse(request.body)
    const existing = await prisma.photo.findUnique({
      where: { id },
      include: { rightsRecord: true, appearances: true, contributor: { include: { contributorProfile: true } } },
    })
    if (!existing) return reply.code(404).send({ error: 'Photo not found' })
    if (!isImpersonatingStaff(request.authUser) && existing.contributorId !== request.userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    if (!isImpersonatingStaff(request.authUser) && !(await accountHasFeature(request.authUser?.accountType ?? '', 'ai_training_opt_in')) && body.copyrightAiTraining) {
      return reply.code(400).send({
        error: 'AI-training opt-in is for professional photographers. Dataset pricing is undecided.',
      })
    }

    const people = body.hasRecognizablePeople
    const nextPeople = people ?? existing.hasRecognizablePeople
    const permissionState = resolvePermissionState({
      requested: body.permissionState,
      exclusiveAvailable: body.exclusiveAvailable,
      current: existing.permissionState as PermissionState,
      hasRecognizablePeople: nextPeople,
    })
    const actor = isImpersonatingStaff(request.authUser) ? 'admin' : 'contributor'
    const inventoryBlock = !isImpersonatingStaff(request.authUser)
      ? nonCommercialCreatorBlocksState(request.authUser?.accountType, permissionState)
      : undefined
    if (inventoryBlock) {
      return reply.code(400).send({ error: inventoryBlock })
    }
    if (!isImpersonatingStaff(request.authUser) && !(await allowsCommercialStock(request.authUser?.accountType ?? '')) && body.licenseType === 'premium') {
      return reply.code(400).send({
        error: commercialInventoryBlocked(request.authUser?.accountType)
          ?? 'This account type cannot enter commercial inventory.',
      })
    }

    try {
      if (body.status) {
        assertContributorStatusChange({
          current: existing.status,
          next: body.status,
          exclusiveSold: existing.exclusiveSold,
        })
      }
      assertExclusiveEdit({
        exclusiveSold: existing.exclusiveSold,
        exclusiveAvailable: body.exclusiveAvailable,
      })
      assertPeopleFlagEdit({
        requested: body.hasRecognizablePeople,
        currentlyRequired: existing.hasRecognizablePeople || Boolean(existing.rightsRecord?.modelReleaseRequired),
      })
      assertPermissionStateChange({
        next: permissionState,
        current: existing.permissionState as PermissionState,
        exclusiveSold: existing.exclusiveSold,
        commercialLocked: existing.commercialLocked,
        hasRecognizablePeople: nextPeople,
        twoPartyCleared: twoPartyCommercialCleared({
          hasRecognizablePeople: nextPeople,
          appearances: existing.appearances,
        }),
        actor,
      })
    } catch (err) {
      if (err instanceof PhotoEditError) {
        return reply.code(err.statusCode).send({ error: err.message })
      }
      throw err
    }

    const licenseType = body.licenseType ?? existing.licenseType
    const price = body.licenseType || body.price != null
      ? nextLicensePrice({
          licenseType,
          price: body.price,
          currentPrice: existing.price,
        })
      : undefined
    const releaseFields =
      people === undefined
        ? null
        : nextModelReleaseFields({
            hasRecognizablePeople: people,
            current: existing.rightsRecord?.modelReleaseStatus ?? null,
          })
    const permission = permissionWriteData(
      permissionState,
      existing.exclusiveSold,
      body.restrictionNotes,
    )
    const nextLibraryTier =
      body.licenseType || body.permissionState || body.exclusiveAvailable !== undefined
        ? resolveLibraryTierForWrite({
            licenseType,
            permissionState: permission.permissionState,
            accountType: request.authUser?.accountType,
          })
        : undefined

    const photo = await prisma.$transaction(async (tx) => {
      if (body.tags) {
        await tx.photoTag.deleteMany({ where: { photoId: id } })
        if (body.tags.length) {
          await tx.photoTag.createMany({ data: body.tags.map((tag) => ({ photoId: id, tag })) })
        }
      }

      await tx.photo.update({
        where: { id },
        data: {
          ...(body.title ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.category ? { category: body.category } : {}),
          ...(body.country ? { country: body.country } : {}),
          ...(people !== undefined ? { hasRecognizablePeople: people } : {}),
          ...(body.licenseType ? { licenseType: body.licenseType } : {}),
          ...(nextLibraryTier ? { libraryTier: nextLibraryTier } : {}),
          ...(price !== undefined ? { price } : {}),
          ...(body.exclusiveAvailable !== undefined || body.permissionState
            ? { exclusiveAvailable: permission.exclusiveAvailable }
            : {}),
          ...(body.permissionState || body.exclusiveAvailable !== undefined
            ? { permissionState: permission.permissionState }
            : {}),
          ...(body.restrictionNotes !== undefined ? { restrictionNotes: permission.restrictionNotes } : {}),
          ...(body.status ? { status: body.status } : {}),
          ...(body.copyrightAiTraining !== undefined ? { copyrightAiTraining: body.copyrightAiTraining } : {}),
        },
      })

      if (releaseFields || body.copyrightHolder) {
        await tx.rightsRecord.upsert({
          where: { photoId: id },
          create: {
            photoId: id,
            copyrightVerified: true,
            copyrightHolder: body.copyrightHolder ?? existing.rightsRecord?.copyrightHolder,
            platformRightsOk: true,
            modelReleaseRequired: releaseFields?.modelReleaseRequired ?? false,
            modelReleaseStatus: releaseFields?.modelReleaseStatus ?? 'not_required',
          },
          update: {
            ...(body.copyrightHolder ? { copyrightHolder: body.copyrightHolder } : {}),
            ...(releaseFields
              ? {
                  modelReleaseRequired: releaseFields.modelReleaseRequired,
                  modelReleaseStatus: releaseFields.modelReleaseStatus,
                }
              : {}),
          },
        })
      }

      if (people && body.modelReleaseFileName) {
        await tx.modelRelease.create({
          data: {
            photoId: id,
            fileName: body.modelReleaseFileName,
            notes: body.modelReleaseNotes,
            status: 'pending',
          },
        })
      }

      if (body.status === 'delisted' && existing.status === 'pending') {
        await tx.moderationItem.updateMany({
          where: { photoId: id, status: 'pending' },
          data: { status: 'withdrawn', notes: 'Withdrawn by contributor', decidedAt: new Date() },
        })
      }

      if (body.status === 'pending' && existing.status !== 'pending') {
        await tx.moderationItem.create({
          data: {
            photoId: id,
            flag: (people ?? existing.hasRecognizablePeople) ? 'copyright check' : 'new submission',
            submittedBy:
              request.authUser?.contributorHandle ?? request.authUser?.email ?? existing.contributorId,
            status: 'pending',
          },
        })
      }

      return tx.photo.findUniqueOrThrow({ where: { id }, include: photoInclude })
    })

    await syncAiTrainingEligible(id)
    if (body.copyrightAiTraining !== undefined) {
      photo.copyrightAiTraining = body.copyrightAiTraining
    }
    photo.aiTrainingEligible = isAiTrainingEligible({
      copyrightAiTraining: photo.copyrightAiTraining,
      hasRecognizablePeople: photo.hasRecognizablePeople,
      appearances: photo.appearances,
    })
    if (body.copyrightAiTraining !== undefined) {
      await appendRightsLedgerEvent({
        photoId: id,
        action: body.copyrightAiTraining ? 'ai_training.copyright_opt_in' : 'ai_training.copyright_opt_out',
        actorId: request.userId,
        actorKind: 'user',
        agreementVersion: body.copyrightAiTraining ? '1.0-ai-training' : undefined,
        scopes: { ai_training: body.copyrightAiTraining },
      })
    }

    await writeAuditLog({
      actorId: request.userId,
      action: 'contributor.update_photo',
      entityType: 'photo',
      entityId: id,
      metadata: {
        status: body.status ?? existing.status,
        licenseType,
        exclusiveAvailable: permission.exclusiveAvailable,
        permissionState: permission.permissionState,
        hasRecognizablePeople: people,
      },
      ipAddress: request.ip,
    })

    return {
      photo: serializePhoto(
        photo,
        photo.contributor.contributorProfile?.handle ?? photo.contributorId,
        photo.contributor.platformAgreements.some((a) => a.status === 'accepted'),
        { appearances: photo.appearances.map((row) => serializeAppearance(row, { includeEmail: true })) },
      ),
    }
  })

}
