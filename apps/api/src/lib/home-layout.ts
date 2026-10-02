import type { Prisma } from '@prisma/client'
import type {
  HomeContributorPick,
  HomeLayoutDto,
  HomePeopleAdminDto,
  HomePeopleMode,
  HomePeopleRailDto,
  HomePeopleSlot,
  HomeStaticBannerDto,
  PatchHomeFeaturedInput,
  PhotographerDto,
  SectionFrame,
} from '@vuekumi/shared'
import {
  DEFAULT_CATEGORY_BANNER_FRAME,
  DEFAULT_PEOPLE_FRAME,
  HOME_BUILTIN_SECTIONS,
  HOME_PEOPLE_ACCOUNT,
  HOME_PEOPLE_LIMIT,
  HOME_PEOPLE_SLOT_LABEL,
  HOME_PEOPLE_SLOTS,
  homeBannerSectionKey,
  normalizeHiddenSections,
  normalizeHomeSectionOrder,
  normalizeSectionFrame,
} from '@vuekumi/shared'
import { accountTypesWithFeature } from './account-features.js'
import { PROFILE_PHOTO_FILTER } from './catalog.js'
import { contributorCardType, ensureDigitalIdCard } from './digital-id.js'
import { prisma } from './prisma.js'

function httpError(message: string, statusCode = 400) {
  const err = new Error(message) as Error & { statusCode?: number }
  err.statusCode = statusCode
  return err
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const current = next[i]!
    next[i] = next[j]!
    next[j] = current
  }
  return next
}

const userInclude = {
  contributorProfile: true,
  modelProfile: { select: { handle: true } },
  representation: { select: { status: true } },
  photos: { where: PROFILE_PHOTO_FILTER, select: { downloads: true } },
  _count: { select: { followers: true } },
} satisfies Prisma.UserInclude

type PeopleUser = Prisma.UserGetPayload<{ include: typeof userInclude }>

function toPerson(user: PeopleUser, hireable: boolean): PhotographerDto | null {
  if (!user.contributorProfile) return null
  const photosCount = user.photos.length
  const downloads = user.photos.reduce((sum, photo) => sum + photo.downloads, 0)
  const accountType = (user.accountType === 'contributor' || user.accountType === 'photo_influencer' || user.accountType === 'photographer')
    ? user.accountType
    : 'photographer'
  return {
    handle: user.contributorProfile.handle,
    name: user.name,
    avatarUrl: user.avatarUrl,
    location: user.contributorProfile.location,
    bio: user.contributorProfile.bio,
    creatorKind: user.contributorProfile.creatorKind,
    accountType,
    availability: hireable ? user.contributorProfile.availability : 'unavailable',
    dayRateUsd: hireable ? user.contributorProfile.dayRateUsd : null,
    represented: user.representation?.status === 'represented',
    photosCount,
    downloads,
    followers: user._count.followers,
    profileViews: user.contributorProfile.profileViews,
    modelHandle: user.modelProfile?.handle ?? null,
  }
}

async function withDigitalIds(users: PeopleUser[], people: PhotographerDto[]): Promise<PhotographerDto[]> {
  const byHandle = new Map(
    users
      .filter((user) => user.contributorProfile)
      .map((user) => [user.contributorProfile!.handle, user] as const),
  )
  return Promise.all(people.map(async (person) => {
    const user = byHandle.get(person.handle)
    if (!user?.contributorProfile) return person
    const cardType = contributorCardType(user.accountType, user.contributorProfile.creatorKind)
    const digitalId = await ensureDigitalIdCard({
      profileId: user.contributorProfile.id,
      cardType,
      handle: person.handle,
      preferredToken: `seed-${person.handle}-${cardType}-id`,
    })
    return { ...person, digitalId }
  }))
}

function toPick(user: { id: string; name: string; avatarUrl: string | null; accountType: string; contributorProfile: { handle: string; location: string | null } | null }): HomeContributorPick | null {
  if (!user.contributorProfile) return null
  return {
    id: user.id,
    name: user.name,
    handle: user.contributorProfile.handle,
    avatarUrl: user.avatarUrl,
    location: user.contributorProfile.location,
    accountType: user.accountType,
  }
}

export function resolvePeopleMode(config: { mode: string; contributorIds: string[] } | null | undefined): HomePeopleMode {
  if (!config) return 'downloads'
  if (config.mode === 'profiles' || config.mode === 'downloads' || config.mode === 'both') return config.mode
  if (config.mode === 'picked') return config.contributorIds.length ? 'profiles' : 'downloads'
  return 'downloads'
}

async function rankedPeople(accountType: string, exclude: string[], hireable: boolean): Promise<PhotographerDto[]> {
  const users = await prisma.user.findMany({
    where: {
      status: 'active',
      accountType: accountType as PeopleUser['accountType'],
      contributorProfile: { isNot: null },
      photos: { some: PROFILE_PHOTO_FILTER },
      ...(exclude.length ? { id: { notIn: exclude } } : {}),
    },
    include: userInclude,
  })
  const people = users
    .map((user) => toPerson(user, hireable))
    .filter((row): row is PhotographerDto => Boolean(row))
    .sort((a, b) => b.downloads - a.downloads || a.name.localeCompare(b.name))
    .slice(0, HOME_PEOPLE_LIMIT)
  return withDigitalIds(users, people)
}

async function peopleByIds(ids: string[], accountType: string, hireable: boolean): Promise<PhotographerDto[]> {
  if (!ids.length) return []
  const users = await prisma.user.findMany({
    where: {
      id: { in: ids },
      status: 'active',
      accountType: accountType as PeopleUser['accountType'],
      contributorProfile: { isNot: null },
    },
    include: userInclude,
  })
  const byId = new Map(users.map((user) => [user.id, user]))
  const people = ids.flatMap((id) => {
    const user = byId.get(id)
    const person = user ? toPerson(user, hireable) : null
    return person ? [person] : []
  })
  return withDigitalIds(users, people)
}

async function loadPeopleRail(
  slot: HomePeopleSlot,
  config: { mode: string; contributorIds: string[]; randomize: boolean; widthVw: number | null; heightVw: number | null } | null,
  hireableTypes: Set<string>,
): Promise<HomePeopleRailDto> {
  const accountType = HOME_PEOPLE_ACCOUNT[slot]
  const mode = resolvePeopleMode(config)
  const hireable = hireableTypes.has(accountType)
  const frame = normalizeSectionFrame(config, DEFAULT_PEOPLE_FRAME)
  const ids = config?.contributorIds ?? []
  if (mode === 'downloads') {
    return { mode, frame, people: await rankedPeople(accountType, [], hireable) }
  }
  const picked = await peopleByIds(ids, accountType, hireable)
  const ordered = config?.randomize ? shuffle(picked) : picked
  if (mode === 'profiles') return { mode, frame, people: ordered }
  const fill = await rankedPeople(accountType, ids, hireable)
  return { mode, frame, people: [...ordered, ...fill].slice(0, HOME_PEOPLE_LIMIT) }
}

export async function loadHomeLayout(): Promise<HomeLayoutDto> {
  const [configs, layout, banners, hireable] = await Promise.all([
    prisma.homeSectionConfig.findMany({
      where: { slot: { in: [...HOME_PEOPLE_SLOTS, 'category_banners'] } },
    }),
    prisma.homeLayout.findUnique({ where: { id: 'public' } }),
    prisma.homeStaticBanner.findMany({
      include: { images: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
    accountTypesWithFeature('receive_bookings'),
  ])
  const bySlot = new Map(configs.map((row) => [row.slot, row]))
  const hireableTypes = new Set(hireable)
  const people = {} as Record<HomePeopleSlot, HomePeopleRailDto>
  for (const slot of HOME_PEOPLE_SLOTS) {
    people[slot] = await loadPeopleRail(slot, bySlot.get(slot) ?? null, hireableTypes)
  }
  const bannerIds = banners.map((banner) => banner.id)
  const arranged = arrangeSections(layout, bannerIds)
  return {
    order: arranged.order.filter((key) => !arranged.hidden.includes(key)),
    hidden: arranged.hidden,
    people,
    categoryBannerFrame: normalizeSectionFrame(bySlot.get('category_banners'), DEFAULT_CATEGORY_BANNER_FRAME),
    staticBanners: banners.map(toBannerDto),
  }
}

function toBannerDto(banner: {
  id: string
  title: string
  columns: number
  rows: number
  widthVw: number
  heightVw: number
  images: { imageSrc: string }[]
}): HomeStaticBannerDto {
  return {
    id: banner.id,
    title: banner.title,
    columns: banner.columns,
    rows: banner.rows,
    widthVw: banner.widthVw,
    heightVw: banner.heightVw,
    images: banner.images.map((image) => image.imageSrc),
  }
}

async function loadPeopleAdmin(slot: HomePeopleSlot): Promise<HomePeopleAdminDto> {
  const config = await prisma.homeSectionConfig.findUnique({ where: { slot } })
  const ids = config?.contributorIds ?? []
  const users = ids.length
    ? await prisma.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          accountType: true,
          contributorProfile: { select: { handle: true, location: true } },
        },
      })
    : []
  const byId = new Map(users.map((user) => [user.id, user]))
  return {
    mode: resolvePeopleMode(config),
    ids,
    randomize: config?.randomize ?? false,
    frame: normalizeSectionFrame(config, DEFAULT_PEOPLE_FRAME),
    people: ids.flatMap((id) => {
      const person = toPick(byId.get(id) ?? { id, name: '', avatarUrl: null, accountType: '', contributorProfile: null })
      return person ? [person] : []
    }),
  }
}

export async function loadHomeLayoutAdmin() {
  const [layout, peopleList, bannerFrame, banners] = await Promise.all([
    prisma.homeLayout.findUnique({ where: { id: 'public' } }),
    Promise.all(HOME_PEOPLE_SLOTS.map(async (slot) => [slot, await loadPeopleAdmin(slot)] as const)),
    prisma.homeSectionConfig.findUnique({ where: { slot: 'category_banners' } }),
    prisma.homeStaticBanner.findMany({
      include: { images: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  const people = Object.fromEntries(peopleList) as Record<HomePeopleSlot, HomePeopleAdminDto>
  const bannerIds = banners.map((banner) => banner.id)
  const arranged = arrangeSections(layout, bannerIds)
  return {
    layoutOrder: arranged.order,
    layoutHidden: arranged.hidden,
    people,
    categoryBannerFrame: normalizeSectionFrame(bannerFrame, DEFAULT_CATEGORY_BANNER_FRAME),
    staticBanners: banners.map(toBannerDto),
  }
}

function arrangeSections(
  layout: { order: string[]; hidden: string[] } | null,
  bannerIds: string[],
): { order: string[]; hidden: string[] } {
  const order = normalizeHomeSectionOrder(layout ? layout.order : null, bannerIds, { fillMissing: !layout })
  return { order, hidden: normalizeHiddenSections(layout?.hidden, order) }
}

type LayoutPlan = {
  people: Partial<Record<HomePeopleSlot, { mode: HomePeopleMode; ids: string[]; randomize: boolean; frame: SectionFrame }>>
  categoryBannerFrame?: SectionFrame
  hidden: string[] | null
  banners?: {
    removeIds: string[]
    updates: { id: string; title: string; columns: number; rows: number; widthVw: number; heightVw: number; images: string[] }[]
    creates: { title: string; columns: number; rows: number; widthVw: number; heightVw: number; images: string[] }[]
  }
  order: string[] | null
}

function assertBannerImages(title: string, rows: number, columns: number, images: string[]) {
  const cap = rows * columns
  if (images.length > cap) throw httpError(`${title} holds ${cap} images.`)
  for (const src of images) {
    if (!src.startsWith('/api/media/site/banners/')) throw httpError(`Upload the images for ${title} from this page.`)
  }
}

export async function planHomeLayout(input: PatchHomeFeaturedInput): Promise<LayoutPlan | null> {
  const legacy = input.contributors && !input.people?.contributors
    ? {
        mode: (input.contributors.ids.length ? 'profiles' : 'downloads') as HomePeopleMode,
        ids: [...new Set(input.contributors.ids)],
        randomize: input.contributors.randomize,
        frame: null as SectionFrame | null,
      }
    : null
  const peopleInput = input.people ?? {}
  const touched = Boolean(
    input.layoutOrder || input.layoutHidden || input.categoryBannerFrame || input.staticBanners || legacy || peopleInput.photographers || peopleInput.photo_influencers || peopleInput.contributors,
  )
  if (!touched) return null

  const people: LayoutPlan['people'] = {}
  for (const slot of HOME_PEOPLE_SLOTS) {
    const patch = peopleInput[slot]
    if (!patch && !(slot === 'contributors' && legacy)) continue
    const ids = [...new Set(patch?.ids ?? legacy?.ids ?? [])]
    const accountType = HOME_PEOPLE_ACCOUNT[slot]
    if (ids.length) {
      const found = await prisma.user.findMany({
        where: { id: { in: ids }, status: 'active', accountType, contributorProfile: { isNot: null } },
        select: { id: true },
      })
      if (found.length !== ids.length) throw httpError(`Choose active ${HOME_PEOPLE_SLOT_LABEL[slot].toLowerCase()}.`)
    }
    const current = patch?.frame ? null : await prisma.homeSectionConfig.findUnique({ where: { slot } })
    people[slot] = {
      mode: patch?.mode ?? legacy?.mode ?? 'downloads',
      ids,
      randomize: patch?.randomize ?? legacy?.randomize ?? false,
      frame: patch?.frame ?? normalizeSectionFrame(current, DEFAULT_PEOPLE_FRAME),
    }
  }

  let banners: LayoutPlan['banners']
  if (input.staticBanners) {
    const existing = await prisma.homeStaticBanner.findMany({ select: { id: true } })
    const known = new Set(existing.map((row) => row.id))
    const updates = []
    const creates = []
    const keep = new Set<string>()
    for (const banner of input.staticBanners) {
      assertBannerImages(banner.title, banner.rows, banner.columns, banner.images)
      const row = {
        title: banner.title,
        columns: banner.columns,
        rows: banner.rows,
        widthVw: banner.frame.widthVw,
        heightVw: banner.frame.heightVw,
        images: banner.images,
      }
      if (banner.id) {
        if (!known.has(banner.id)) throw httpError('That banner section was not found.')
        if (keep.has(banner.id)) throw httpError('Each banner section can be saved once.')
        keep.add(banner.id)
        updates.push({ id: banner.id, ...row })
      } else {
        creates.push(row)
      }
    }
    banners = {
      removeIds: existing.filter((row) => !keep.has(row.id)).map((row) => row.id),
      updates,
      creates,
    }
  }

  const knownBannerIds = banners
    ? banners.updates.map((row) => row.id)
    : (await prisma.homeStaticBanner.findMany({ select: { id: true } })).map((row) => row.id)
  const allowed = new Set<string>([...HOME_BUILTIN_SECTIONS, ...knownBannerIds.map(homeBannerSectionKey)])
  const checkKeys = (keys: string[]) => {
    const seen = new Set<string>()
    for (const key of keys) {
      if (!allowed.has(key)) throw httpError('Choose a homepage section from the list.')
      if (seen.has(key)) throw httpError('Each homepage section can appear once.')
      seen.add(key)
    }
  }
  if (input.layoutOrder) checkKeys(input.layoutOrder)
  if (input.layoutHidden) checkKeys(input.layoutHidden)

  return {
    people,
    categoryBannerFrame: input.categoryBannerFrame,
    banners,
    hidden: input.layoutHidden ?? null,
    order: input.layoutOrder ?? null,
  }
}

export async function writeHomeLayout(tx: Prisma.TransactionClient, plan: LayoutPlan) {
  for (const slot of HOME_PEOPLE_SLOTS) {
    const row = plan.people[slot]
    if (!row) continue
    await tx.homeSectionConfig.upsert({
      where: { slot },
      create: {
        slot,
        mode: row.mode,
        contributorIds: row.ids,
        randomize: row.randomize,
        widthVw: row.frame.widthVw,
        heightVw: row.frame.heightVw,
      },
      update: {
        mode: row.mode,
        contributorIds: row.ids,
        randomize: row.randomize,
        widthVw: row.frame.widthVw,
        heightVw: row.frame.heightVw,
      },
    })
  }
  if (plan.categoryBannerFrame) {
    await tx.homeSectionConfig.upsert({
      where: { slot: 'category_banners' },
      create: {
        slot: 'category_banners',
        mode: 'size',
        widthVw: plan.categoryBannerFrame.widthVw,
        heightVw: plan.categoryBannerFrame.heightVw,
      },
      update: {
        widthVw: plan.categoryBannerFrame.widthVw,
        heightVw: plan.categoryBannerFrame.heightVw,
      },
    })
  }

  const createdIds: string[] = []
  if (plan.banners) {
    if (plan.banners.removeIds.length) {
      await tx.homeStaticBanner.deleteMany({ where: { id: { in: plan.banners.removeIds } } })
    }
    for (const banner of plan.banners.updates) {
      await tx.homeStaticBanner.update({
        where: { id: banner.id },
        data: {
          title: banner.title,
          columns: banner.columns,
          rows: banner.rows,
          widthVw: banner.widthVw,
          heightVw: banner.heightVw,
        },
      })
      await tx.homeStaticBannerImage.deleteMany({ where: { bannerId: banner.id } })
      if (banner.images.length) {
        await tx.homeStaticBannerImage.createMany({
          data: banner.images.map((imageSrc, position) => ({ bannerId: banner.id, position, imageSrc })),
        })
      }
    }
    for (const banner of plan.banners.creates) {
      const created = await tx.homeStaticBanner.create({
        data: {
          title: banner.title,
          columns: banner.columns,
          rows: banner.rows,
          widthVw: banner.widthVw,
          heightVw: banner.heightVw,
          images: {
            create: banner.images.map((imageSrc, position) => ({ position, imageSrc })),
          },
        },
        select: { id: true },
      })
      createdIds.push(created.id)
    }
  }

  if (plan.order || plan.hidden || plan.banners) {
    const current = await tx.homeLayout.findUnique({ where: { id: 'public' } })
    const remaining = await tx.homeStaticBanner.findMany({ select: { id: true }, orderBy: { createdAt: 'asc' } })
    const bannerIds = remaining.map((row) => row.id)
    const base = plan.order ?? current?.order ?? null
    const order = normalizeHomeSectionOrder(base, bannerIds, { fillMissing: !current && plan.order == null })
    for (const id of createdIds) {
      const key = homeBannerSectionKey(id)
      if (!order.includes(key)) order.push(key)
    }
    const hidden = normalizeHiddenSections(plan.hidden ?? current?.hidden ?? [], order)
    await tx.homeLayout.upsert({
      where: { id: 'public' },
      create: { id: 'public', order, hidden },
      update: { order, hidden },
    })
  }
}
