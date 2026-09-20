import type {
  AgreementDto,
  AuthUser,
  AgencyDto,
  AgencyInviteDto,
  AgencyInvitePreviewDto,
  AgencyMemberDto,
  LicenseGrantDto,
  LicenseProductDto,
  LicenseQuoteDto,
  PaginatedPhotos,
  PaymentDto,
  PaymentMethodsDto,
  PhotoDto,
  PhotographerDto,
  PhotographerProfileDto,
  ModelPublicDto,
  ModelPublicProfileDto,
  FavoriteResult,
  FollowResult,
  ContributorStatsDto,
  CollectionDto,
  CollectionDetailDto,
  CollectionMembershipDto,
  CreateCollectionInput,
  UpdateCollectionInput,
  PurchaseLicenseResult,
  AiSuggestionDto,
  AiStatusDto,
  PublicConfigDto,
  HomePageDto,
  AdminOverviewDto,
  AdminAccountDto,
  EarningsSummaryDto,
  PayoutDto,
  PayoutMethodDto,
  PayoutMethodInput,
  SessionDto,
  SubscriptionStatusDto,
  SubscriptionDto,
  SubscriptionCheckoutDto,
  RightsReportDto,
  PublicReportResult,
  CreateRightsReportInput,
  CreateDmcaNoticeInput,
  CreateDmcaCounterNoticeInput,
  DmcaNoticeDto,
  DmcaPublicPageDto,
  LegalOverlayDto,
  LegalStandardDto,
  PatchLegalOverlayInput,
  RightsStrikeDto,
  EarningsHoldDto,
  PhotoAppearanceDto,
  ModelInvitePreviewDto,
  IdentifyAppearanceInput,
  SelfShotAppearanceInput,
  DecideAppearanceInput,
  AcceptModelInviteInput,
  VerifyLikenessInput,
  BookingDto,
  BookingAdminDto,
  CreateBookingInput,
  BookingQuoteInput,
  RepresentationDto,
  RepresentationAdminDto,
  RepresentationInquiryDto,
  RequestRepresentationInput,
  DecideRepresentationInput,
  CreateInquiryInput,
  DecideInquiryInput,
  CampaignDto,
  CampaignAdminDto,
  CampaignPitchDto,
  CreateCampaignInput,
  CreatePitchInput,
  PartnerKeyDto,
  CreatePartnerKeyInput,
} from '@vuekumi/shared'
import { firstAdminPath } from '@vuekumi/shared'
import type { AccountType, AgencyRole, LoginInput, OAuthDevInput, RegisterInput, SubmitPhotoInput, UpdatePhotoInput, UpdateProfileInput, ChangePasswordInput } from '@vuekumi/shared'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

/** Phase 43 — staff act-as target (sessionStorage). Staff JWT stays; APIs get ?userId=. */
const ACT_AS_KEY = 'vuekumi.actAsCreatorId'
const ACT_AS_LABEL_KEY = 'vuekumi.actAsCreatorLabel'

export function getActAsCreatorId(): string | null {
  try {
    return sessionStorage.getItem(ACT_AS_KEY)
  } catch {
    return null
  }
}

export function getActAsCreatorLabel(): string | null {
  try {
    return sessionStorage.getItem(ACT_AS_LABEL_KEY)
  } catch {
    return null
  }
}

export function setActAsCreator(target: { id: string; label: string } | null) {
  try {
    if (!target) {
      sessionStorage.removeItem(ACT_AS_KEY)
      sessionStorage.removeItem(ACT_AS_LABEL_KEY)
      return
    }
    sessionStorage.setItem(ACT_AS_KEY, target.id)
    sessionStorage.setItem(ACT_AS_LABEL_KEY, target.label)
  } catch {
    /* ignore */
  }
}

function withActAs(path: string): string {
  if (!path.startsWith('/api/contributor')) return path
  const id = getActAsCreatorId()
  if (!id) return path
  if (/[?&]userId=/.test(path)) return path
  return `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(id)}`
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function shouldRefreshOn401(path: string): boolean {
  return !path.startsWith('/api/auth/login')
    && !path.startsWith('/api/auth/register')
    && !path.startsWith('/api/auth/refresh')
    && !path.startsWith('/api/auth/logout')
}

let refreshInFlight: Promise<boolean> | null = null

function refreshAccessCookie(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((res) => res.ok)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

async function request<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const resolved = withActAs(path)
  const res = await fetch(`${API_BASE}${resolved}`, {
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (res.status === 401 && !retried && shouldRefreshOn401(path)) {
    const refreshed = await refreshAccessCookie()
    if (refreshed) return request<T>(path, init, true)
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error ?? res.statusText, res.status)
  }
  return data as T
}

export const api = {
  health: () => request<{ status: string }>('/api/health'),

  publicConfig: () => request<PublicConfigDto>('/api/public/config'),

  home: () => request<HomePageDto>('/api/public/home'),

  adminHomepage: () => request<import('@vuekumi/shared').HomeFeaturedAdminDto>('/api/admin/homepage'),

  saveHomepage: (body: import('@vuekumi/shared').PatchHomeFeaturedInput) =>
    request<import('@vuekumi/shared').HomeFeaturedAdminDto>('/api/admin/homepage', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  adminOverview: () => request<AdminOverviewDto>('/api/admin/metrics/overview'),

  me: () => request<{ user: AuthUser }>('/api/auth/me'),

  updateMe: (body: UpdateProfileInput) =>
    request<{ user: AuthUser }>('/api/auth/me', { method: 'PATCH', body: JSON.stringify(body) }),

  bookings: () => request<{ items: BookingDto[] }>('/api/bookings'),

  createBooking: (body: CreateBookingInput) =>
    request<{ booking: BookingDto }>('/api/bookings', { method: 'POST', body: JSON.stringify(body) }),

  quoteBooking: (id: string, body: BookingQuoteInput) =>
    request<{ booking: BookingDto }>(`/api/bookings/${id}/quote`, { method: 'POST', body: JSON.stringify(body) }),

  bookingAction: (id: string, action: 'accept' | 'decline' | 'withdraw') =>
    request<{ booking: BookingDto }>(`/api/bookings/${id}/${action}`, { method: 'POST', body: JSON.stringify({}) }),

  representation: () => request<{ representation: RepresentationDto | null }>('/api/representation'),

  requestRepresentation: (body: RequestRepresentationInput) =>
    request<{ representation: RepresentationDto }>('/api/representation', { method: 'POST', body: JSON.stringify(body) }),

  withdrawRepresentation: () =>
    request<{ representation: RepresentationDto }>('/api/representation/withdraw', { method: 'POST', body: JSON.stringify({}) }),

  endRepresentation: () =>
    request<{ representation: RepresentationDto; revertedPhotos: number }>('/api/representation/end', { method: 'POST', body: JSON.stringify({}) }),

  photoInquiry: (photoId: string, body: CreateInquiryInput) =>
    request<{ ok: true }>(`/api/photos/${photoId}/inquiry`, { method: 'POST', body: JSON.stringify(body) }),

  adminRepresentation: () =>
    request<{ items: RepresentationAdminDto[]; inquiries: RepresentationInquiryDto[] }>('/api/admin/representation'),

  decideRepresentation: (id: string, body: DecideRepresentationInput) =>
    request<{ representation: RepresentationDto; revertedPhotos: number }>(`/api/admin/representation/${id}/decide`, { method: 'POST', body: JSON.stringify(body) }),

  decideInquiry: (id: string, body: DecideInquiryInput) =>
    request<{ ok: true }>(`/api/admin/inquiries/${id}`, { method: 'POST', body: JSON.stringify(body) }),

  adminBookings: () => request<{ items: BookingAdminDto[] }>('/api/admin/bookings'),

  adminCampaigns: () => request<{ items: CampaignAdminDto[] }>('/api/admin/campaigns'),

  adminCampaignPitches: (id: string) =>
    request<{ items: CampaignPitchDto[] }>(`/api/admin/campaigns/${id}/pitches`),

  adminCloseCampaign: (id: string) =>
    request<{ campaign: CampaignAdminDto }>(`/api/admin/campaigns/${id}/close`, { method: 'POST', body: JSON.stringify({}) }),

  campaigns: () => request<{ items: CampaignDto[] }>('/api/campaigns'),

  createCampaign: (body: CreateCampaignInput) =>
    request<{ campaign: CampaignDto }>('/api/campaigns', { method: 'POST', body: JSON.stringify(body) }),

  closeCampaign: (id: string) =>
    request<{ campaign: CampaignDto }>(`/api/campaigns/${id}/close`, { method: 'POST', body: JSON.stringify({}) }),

  campaignPitches: (id: string) =>
    request<{ items: CampaignPitchDto[] }>(`/api/campaigns/${id}/pitches`),

  pitchCampaign: (id: string, body: CreatePitchInput) =>
    request<{ pitch: CampaignPitchDto }>(`/api/campaigns/${id}/pitch`, { method: 'POST', body: JSON.stringify(body) }),

  pitchAction: (id: string, action: 'accept' | 'decline' | 'withdraw') =>
    request<{ pitch: CampaignPitchDto }>(`/api/campaigns/pitches/${id}/${action}`, { method: 'POST', body: JSON.stringify({}) }),

  adminPartnerKeys: () => request<{ items: PartnerKeyDto[] }>('/api/admin/partner-keys'),

  createPartnerKey: (body: CreatePartnerKeyInput) =>
    request<{ key: string; partnerKey: PartnerKeyDto }>('/api/admin/partner-keys', { method: 'POST', body: JSON.stringify(body) }),

  revokePartnerKey: (id: string) =>
    request<{ partnerKey: PartnerKeyDto }>(`/api/admin/partner-keys/${id}/revoke`, { method: 'POST', body: JSON.stringify({}) }),

  changePassword: (body: ChangePasswordInput) =>
    request<{ user: AuthUser }>('/api/auth/me/password', { method: 'PATCH', body: JSON.stringify(body) }),

  sessions: () => request<{ items: SessionDto[] }>('/api/auth/sessions'),

  revokeOtherSessions: () =>
    request<{ ok: boolean; revoked: number }>('/api/auth/sessions/revoke-others', { method: 'POST', body: JSON.stringify({}) }),

  revokeSession: (id: string) =>
    request<{ ok: boolean; current: boolean }>(`/api/auth/sessions/${id}`, { method: 'DELETE' }),

  oauthDev: (body: OAuthDevInput) =>
    request<{ user: AuthUser }>('/api/auth/oauth/dev', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: LoginInput) =>
    request<{ user: AuthUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  register: (body: RegisterInput) =>
    request<{ user: AuthUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  forgotPassword: (email: string) =>
    request<{ ok: boolean }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (token: string, password: string) =>
    request<{ ok: boolean }>(`/api/auth/reset-password/${token}`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  verifyEmail: (token: string) => request<{ ok: boolean }>(`/api/auth/verify-email/${token}`),

  photos: (params?: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) qs.set(k, String(v))
      })
    }
    const query = qs.toString()
    return request<PaginatedPhotos>(`/api/photos${query ? `?${query}` : ''}`)
  },

  photo: (id: string) => request<PhotoDto>(`/api/photos/${id}`),

  relatedPhotos: (id: string) => request<{ items: PhotoDto[] }>(`/api/photos/${id}/related`),

  toggleFavorite: (id: string) =>
    request<FavoriteResult>(`/api/photos/${id}/favorite`, { method: 'POST', body: JSON.stringify({}) }),

  favorites: (params?: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) qs.set(k, String(v))
      })
    }
    const query = qs.toString()
    return request<PaginatedPhotos>(`/api/favorites${query ? `?${query}` : ''}`)
  },

  photographers: (params?: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) qs.set(k, String(v))
      })
    }
    const query = qs.toString()
    return request<{ items: PhotographerDto[]; page: number; limit: number; total: number; hasMore: boolean }>(
      `/api/photographers${query ? `?${query}` : ''}`,
    )
  },

  photographer: (handle: string, params?: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) qs.set(k, String(v))
      })
    }
    const query = qs.toString()
    return request<PhotographerProfileDto>(`/api/photographers/${encodeURIComponent(handle)}${query ? `?${query}` : ''}`)
  },

  models: (params?: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) qs.set(k, String(v))
      })
    }
    const query = qs.toString()
    return request<{ items: ModelPublicDto[]; page: number; limit: number; total: number; hasMore: boolean }>(
      `/api/models${query ? `?${query}` : ''}`,
    )
  },

  modelPublic: (handle: string, params?: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) qs.set(k, String(v))
      })
    }
    const query = qs.toString()
    return request<ModelPublicProfileDto>(`/api/models/${encodeURIComponent(handle)}${query ? `?${query}` : ''}`)
  },

  toggleFollow: (handle: string) =>
    request<FollowResult>(`/api/photographers/${encodeURIComponent(handle)}/follow`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  following: (params?: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) qs.set(k, String(v))
      })
    }
    const query = qs.toString()
    return request<{ items: PhotographerDto[]; page: number; limit: number; total: number; hasMore: boolean }>(
      `/api/following${query ? `?${query}` : ''}`,
    )
  },

  collections: () => request<{ items: CollectionDto[] }>('/api/collections'),

  createCollection: (body: CreateCollectionInput) =>
    request<{ collection: CollectionDto }>('/api/collections', { method: 'POST', body: JSON.stringify(body) }),

  collection: (id: string, params?: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) qs.set(k, String(v))
      })
    }
    const query = qs.toString()
    return request<CollectionDetailDto>(`/api/collections/${id}${query ? `?${query}` : ''}`)
  },

  updateCollection: (id: string, body: UpdateCollectionInput) =>
    request<{ collection: CollectionDto }>(`/api/collections/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  deleteCollection: (id: string) =>
    request<{ ok: boolean }>(`/api/collections/${id}`, { method: 'DELETE' }),

  photoCollections: (photoId: string) =>
    request<{ items: CollectionMembershipDto[] }>(`/api/photos/${photoId}/collections`),

  addToCollection: (collectionId: string, photoId: string) =>
    request<{ added: boolean; photoId: string }>(`/api/collections/${collectionId}/photos`, {
      method: 'POST',
      body: JSON.stringify({ photoId }),
    }),

  removeFromCollection: (collectionId: string, photoId: string) =>
    request<{ ok: boolean }>(`/api/collections/${collectionId}/photos/${photoId}`, { method: 'DELETE' }),

  agreement: (kind?: 'photographer' | 'contributor' | 'photo_influencer' | 'model') =>
    request<AgreementDto>(`/api/agreements/current${kind ? `?kind=${kind}` : ''}`),

  licenses: () => request<{ items: LicenseProductDto[] }>('/api/licenses'),

  photoLicenses: (id: string) => request<{ items: LicenseProductDto[] }>(`/api/photos/${id}/licenses`),

  reportPhoto: (id: string, body: CreateRightsReportInput) =>
    request<PublicReportResult>(`/api/photos/${id}/report`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  reportContent: (body: CreateRightsReportInput & { photoUrl?: string; photoId?: string }) =>
    request<PublicReportResult>('/api/report-content', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  dmcaPage: () => request<DmcaPublicPageDto>('/api/dmca'),

  legalStandard: () => request<LegalStandardDto>('/api/legal/standard'),
  legalOverlay: (code: string) => request<{ overlay: LegalOverlayDto }>(`/api/legal/overlays/${code}`),
  adminLegalOverlays: (kind?: string) =>
    request<{ standard: LegalStandardDto; items: LegalOverlayDto[] }>(
      `/api/admin/legal/overlays${kind && kind !== 'all' ? `?kind=${encodeURIComponent(kind)}` : ''}`,
    ),
  patchLegalOverlay: (code: string, body: PatchLegalOverlayInput) =>
    request<{ overlay: LegalOverlayDto }>(`/api/admin/legal/overlays/${code}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  fileDmcaNotice: (body: CreateDmcaNoticeInput) =>
    request<{ notice: DmcaNoticeDto }>('/api/dmca/notices', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  dmcaNotice: (id: string) => request<{ notice: DmcaNoticeDto }>(`/api/dmca/notices/${id}`),

  fileDmcaCounter: (id: string, body: CreateDmcaCounterNoticeInput) =>
    request<{ notice: DmcaNoticeDto }>(`/api/dmca/notices/${id}/counter`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  purchaseLicense: (photoId: string, type: string, provider?: 'stripe' | 'flutterwave') =>
    request<PurchaseLicenseResult>(`/api/photos/${photoId}/licenses`, {
      method: 'POST',
      body: JSON.stringify({ type, provider }),
    }),

  requestQuote: (photoId: string, body: { territory: string; duration: string; channels: string; notes?: string }) =>
    request<{ quote: LicenseQuoteDto }>(`/api/photos/${photoId}/quotes`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  myGrants: () => request<{ items: LicenseGrantDto[] }>('/api/licenses/grants'),
  myQuotes: () => request<{ items: LicenseQuoteDto[] }>('/api/licenses/quotes'),
  acceptQuote: (id: string, provider?: 'stripe' | 'flutterwave') =>
    request<PurchaseLicenseResult>(`/api/licenses/quotes/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ provider }),
    }),

  agency: () =>
    request<{ agency: AgencyDto; recentGrants: LicenseGrantDto[]; recentQuotes: LicenseQuoteDto[] }>('/api/agency'),

  agencyMembers: () =>
    request<{ items: AgencyMemberDto[]; invites: AgencyInviteDto[]; seatLimit: number; seatsUsed: number }>(
      '/api/agency/members',
    ),

  inviteAgencyMember: (email: string, role: Exclude<AgencyRole, 'owner'>) =>
    request<{
      member?: AgencyMemberDto
      invite?: AgencyInviteDto
      joinUrl?: string
      immediate: boolean
    }>('/api/agency/members', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),

  updateAgencyMemberRole: (userId: string, role: Exclude<AgencyRole, 'owner'>) =>
    request<{ member: AgencyMemberDto }>(`/api/agency/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  removeAgencyMember: (userId: string) =>
    request<{ ok: boolean }>(`/api/agency/members/${userId}`, { method: 'DELETE' }),

  revokeAgencyInvite: (id: string) =>
    request<{ ok: boolean }>(`/api/agency/invites/${id}`, { method: 'DELETE' }),

  agencyInvitePreview: (token: string) =>
    request<{ invite: AgencyInvitePreviewDto }>(`/api/agency/join/${token}`),

  acceptAgencyInvite: (token: string, body?: { name?: string; password?: string; country?: string }) =>
    request<{ user: AuthUser; member: AgencyMemberDto }>(`/api/agency/join/${token}`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),

  paymentMethods: () => request<PaymentMethodsDto>('/api/payments/methods'),

  payment: (id: string) => request<{ payment: PaymentDto; grant: LicenseGrantDto | null }>(`/api/payments/${id}`),

  verifyPayment: (id: string) =>
    request<{ grant: LicenseGrantDto }>(`/api/payments/${id}/verify`, { method: 'POST', body: JSON.stringify({}) }),

  completeDevPayment: (id: string) =>
    request<{ grant: LicenseGrantDto }>(`/api/payments/${id}/complete-dev`, { method: 'POST', body: JSON.stringify({}) }),

  subscription: () => request<SubscriptionStatusDto>('/api/subscriptions'),

  startPlusCheckout: (provider?: 'stripe' | 'flutterwave') =>
    request<{ checkout: SubscriptionCheckoutDto }>('/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    }),

  subscriptionById: (id: string) =>
    request<{ subscription: SubscriptionDto }>(`/api/subscriptions/${id}`),

  verifySubscription: (id: string) =>
    request<{ subscription: SubscriptionDto }>(`/api/subscriptions/${id}/verify`, { method: 'POST', body: JSON.stringify({}) }),

  completeDevSubscription: (id: string) =>
    request<{ subscription: SubscriptionDto }>(`/api/subscriptions/${id}/complete-dev`, { method: 'POST', body: JSON.stringify({}) }),

  cancelSubscription: (id: string) =>
    request<{ subscription: SubscriptionDto }>(`/api/subscriptions/${id}/cancel`, { method: 'POST', body: JSON.stringify({}) }),

  contributorStats: () => request<ContributorStatsDto>('/api/contributor/stats'),

  contributorEarnings: () => request<EarningsSummaryDto>('/api/contributor/earnings'),

  addPayoutMethod: (body: PayoutMethodInput) =>
    request<{ method: PayoutMethodDto }>('/api/contributor/payout-methods', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  defaultPayoutMethod: (id: string) =>
    request<{ methods: PayoutMethodDto[] }>(`/api/contributor/payout-methods/${id}/default`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  deletePayoutMethod: (id: string) =>
    request<{ ok: boolean }>(`/api/contributor/payout-methods/${id}`, { method: 'DELETE' }),

  requestPayout: (methodId?: string) =>
    request<{ payout: PayoutDto }>('/api/contributor/payouts', {
      method: 'POST',
      body: JSON.stringify(methodId ? { methodId } : {}),
    }),

  adminPayouts: (status?: string) =>
    request<{ pendingCount: number; pendingTotalUsd: number; items: PayoutDto[] }>(
      `/api/admin/payouts${status ? `?status=${status}` : ''}`,
    ),

  payPayout: (id: string, notes?: string) =>
    request<{ payout: PayoutDto }>(`/api/admin/payouts/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),

  rejectPayout: (id: string, notes?: string) =>
    request<{ payout: PayoutDto }>(`/api/admin/payouts/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),

  async downloadCertificate(grantId: string) {
    const res = await fetch(`${API_BASE}/api/licenses/grants/${grantId}/certificate`, { credentials: 'include' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new ApiError((data as { error?: string }).error ?? res.statusText, res.status)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vuekumi-license-${grantId}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  },

  presignUpload: (filename: string, contentType: string) =>
    request<{
      driver: 's3' | 'local'
      key: string
      uploadUrl: string
      method: 'PUT'
      headers: Record<string, string>
    }>('/api/contributor/uploads/presign', {
      method: 'POST',
      body: JSON.stringify({ filename, contentType }),
    }),

  async putUpload(uploadUrl: string, file: File, headers: Record<string, string>) {
    const pathOrUrl = uploadUrl.startsWith('http') ? uploadUrl : withActAs(uploadUrl)
    const target = pathOrUrl.startsWith('http') ? pathOrUrl : `${API_BASE}${pathOrUrl}`
    const res = await fetch(target, {
      method: 'PUT',
      headers,
      body: file,
      credentials: uploadUrl.startsWith('http') ? 'omit' : 'include',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new ApiError((data as { error?: string }).error ?? 'Upload failed', res.status)
    }
  },

  submitPhoto: (body: SubmitPhotoInput) =>
    request<{ photo: PhotoDto }>('/api/contributor/photos', { method: 'POST', body: JSON.stringify(body) }),

  contributorPhoto: (id: string) => request<{ photo: PhotoDto }>(`/api/contributor/photos/${id}`),

  identifyAppearance: (photoId: string, body: IdentifyAppearanceInput) =>
    request<{ appearance: PhotoAppearanceDto; joinUrl: string }>(`/api/contributor/photos/${photoId}/appearances`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  uploadSignedRelease: (photoId: string, body: import('@vuekumi/shared').UploadSignedReleaseInput) =>
    request<{ appearance: PhotoAppearanceDto; release: { id: string; verificationLevel: string }; joinUrl?: string }>(
      `/api/contributor/photos/${photoId}/releases`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  selfShotAppearance: (photoId: string, body: SelfShotAppearanceInput) =>
    request<{ appearance: PhotoAppearanceDto }>(`/api/contributor/photos/${photoId}/appearances/self`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  resendAppearanceInvite: (photoId: string, appearanceId: string) =>
    request<{ appearance: PhotoAppearanceDto; joinUrl: string }>(
      `/api/contributor/photos/${photoId}/appearances/${appearanceId}/resend`,
      { method: 'POST', body: JSON.stringify({}) },
    ),

  declareSubjectAge: (photoId: string, appearanceId: string, body: import('@vuekumi/shared').DeclareSubjectAgeInput) =>
    request<{ appearance: PhotoAppearanceDto }>(
      `/api/contributor/photos/${photoId}/appearances/${appearanceId}/age`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  removeAppearance: (photoId: string, appearanceId: string) =>
    request<{ ok: boolean }>(`/api/contributor/photos/${photoId}/appearances/${appearanceId}`, { method: 'DELETE' }),

  modelInvitePreview: (token: string) =>
    request<{ invite: ModelInvitePreviewDto }>(`/api/model/invite/${token}`),

  rightsPreview: (token: string) =>
    request<import('@vuekumi/shared').RightsPreviewDto>(`/api/rights/preview/${encodeURIComponent(token)}`),

  acceptModelInvite: (token: string, body?: AcceptModelInviteInput) =>
    request<{ user: AuthUser }>(`/api/model/invite/${token}`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),

  guestModelConsent: (token: string, body: import('@vuekumi/shared').GuestConsentInput) =>
    request<{ appearances: PhotoAppearanceDto[] }>(`/api/model/invite/${token}/decide`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  modelPortal: () =>
    request<{
      handle: string | null
      location: string | null
      bio: string | null
      earns: false
      hasPhotographerAgreement?: boolean
      photosCount?: number
      counts: { invited: number; claimed: number; approved: number; rejected: number; total: number }
    }>('/api/model'),

  modelAppearances: () => request<{ items: PhotoAppearanceDto[] }>('/api/model/appearances'),

  modelPhotos: () => request<{ items: PhotoDto[] }>('/api/model/photos'),

  modelPhoto: (id: string) => request<{ photo: PhotoDto }>(`/api/model/photos/${id}`),

  submitModelPhoto: (body: import('@vuekumi/shared').SubmitModelPhotoInput) =>
    request<{ photo: PhotoDto }>('/api/model/photos', { method: 'POST', body: JSON.stringify(body) }),

  updateModelPhoto: (id: string, body: UpdatePhotoInput) =>
    request<{ photo: PhotoDto }>(`/api/model/photos/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  identifyCopyrightHolder: (photoId: string, body: import('@vuekumi/shared').IdentifyCopyrightHolderInput) =>
    request<{ authorization: import('@vuekumi/shared').CopyrightAuthorizationDto; joinUrl: string }>(
      `/api/model/photos/${photoId}/copyright-holder`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  acceptPhotographerAgreement: (body: import('@vuekumi/shared').AcceptPhotographerAgreementInput) =>
    request<{ user: AuthUser }>('/api/model/photographer-agreement', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  presignModelUpload: (filename: string, contentType: string) =>
    request<{
      driver: 's3' | 'local'
      key: string
      uploadUrl: string
      method: 'PUT'
      headers: Record<string, string>
    }>('/api/model/uploads/presign', {
      method: 'POST',
      body: JSON.stringify({ filename, contentType }),
    }),

  copyrightInvitePreview: (token: string) =>
    request<{ invite: import('@vuekumi/shared').CopyrightInvitePreviewDto }>(`/api/copyright/invite/${token}`),

  guestCopyrightConsent: (token: string, body: import('@vuekumi/shared').GuestCopyrightConsentInput) =>
    request<{ authorizations: import('@vuekumi/shared').CopyrightAuthorizationDto[] }>(
      `/api/copyright/invite/${token}/decide`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  decideAppearance: (id: string, body: DecideAppearanceInput) =>
    request<{ appearance: PhotoAppearanceDto }>(`/api/model/appearances/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  verifyLikeness: (id: string, body: VerifyLikenessInput) =>
    request<{ appearance: PhotoAppearanceDto }>(`/api/model/appearances/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updatePhoto: (id: string, body: UpdatePhotoInput) =>
    request<{ photo: PhotoDto }>(`/api/contributor/photos/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  aiStatus: () => request<AiStatusDto>('/api/ai/status'),

  suggestFile: (body: { imageBase64: string; mimeType: string; filename?: string; title?: string; country?: string; category?: string }) =>
    request<{ suggestion: AiSuggestionDto }>('/api/ai/suggest-file', { method: 'POST', body: JSON.stringify(body) }),

  suggestPhoto: (id: string) =>
    request<{ suggestion: AiSuggestionDto }>(`/api/photos/${id}/ai/suggest`, { method: 'POST', body: JSON.stringify({}) }),

  applySuggestion: (photoId: string, suggestionId: string, fields: string[]) =>
    request<{ photo: PhotoDto }>(`/api/photos/${photoId}/ai/suggestions/${suggestionId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ fields }),
    }),

  async downloadOriginal(photoId: string) {
    const res = await fetch(`${API_BASE}/api/media/${photoId}/original`, { credentials: 'include' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new ApiError((data as { error?: string }).error ?? res.statusText, res.status)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${photoId}-original.jpg`
    a.click()
    URL.revokeObjectURL(url)
  },

  async downloadGrantFile(grantId: string) {
    const res = await fetch(`${API_BASE}/api/licenses/grants/${grantId}/file`, { credentials: 'include' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new ApiError((data as { error?: string }).error ?? res.statusText, res.status)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vuekumi-${grantId}.jpg`
    a.click()
    URL.revokeObjectURL(url)
  },

  contributorPhotos: () => request<{ items: PhotoDto[] }>('/api/contributor/photos'),

  adminContent: (params?: { q?: string; status?: string; page?: number; locked?: boolean }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.status) qs.set('status', params.status)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.locked) qs.set('locked', '1')
    const q = qs.toString()
    return request<{ items: AdminContentRow[]; total: number }>(`/api/admin/content${q ? `?${q}` : ''}`)
  },

  adminContentDetail: (id: string) => request<AdminContentDetail>(`/api/admin/content/${id}`),

  patchRights: (id: string, body: Record<string, unknown>) =>
    request<{ photo: PhotoDto }>(`/api/admin/content/${id}/rights`, { method: 'PATCH', body: JSON.stringify(body) }),

  verifyTwoPartyProcess: (id: string) =>
    request<{ ok: boolean; consentVersion: string }>(`/api/admin/content/${id}/verify-process`, { method: 'POST', body: '{}' }),

  adminRightsLedger: (id: string) =>
    request<{ ledger: import('@vuekumi/shared').RightsLedgerDto }>(`/api/admin/content/${id}/rights-ledger`),

  authorizeGuardian: (photoId: string, appearanceId: string) =>
    request<{ appearance: import('@vuekumi/shared').PhotoAppearanceDto }>(
      `/api/admin/content/${photoId}/appearances/${appearanceId}/guardian`,
      { method: 'POST', body: JSON.stringify({ authorized: true }) },
    ),

  reviewModelRelease: (id: string, status: 'verified' | 'rejected', notes?: string) =>
    request<{ ok: boolean }>(`/api/admin/model-releases/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    }),

  adminModeration: () => request<{ items: AdminModerationRow[] }>('/api/admin/moderation'),

  adminReports: (status?: string) =>
    request<{ items: RightsReportDto[] }>(`/api/admin/reports${status ? `?status=${encodeURIComponent(status)}` : ''}`),

  decideRightsReport: (
    id: string,
    action: 'lock' | 'unlock' | 'dismiss' | 'resolve' | 'preserve' | 'notify' | 'escalate',
    notes?: string,
    escalateTo?: 'legal' | 'law_enforcement' | 'counsel' | 'other',
  ) =>
    request<{ report: RightsReportDto }>(`/api/admin/reports/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ action, notes, escalateTo }),
    }),

  adminDmca: (status?: string) =>
    request<{ items: DmcaNoticeDto[] }>(`/api/admin/dmca${status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''}`),

  decideDmcaNotice: (id: string, action: 'process' | 'reject' | 'close' | 'restore', notes?: string) =>
    request<{ notice: DmcaNoticeDto }>(`/api/admin/dmca/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ action, notes }),
    }),

  adminStrikes: (userId?: string) =>
    request<{ items: RightsStrikeDto[] }>(`/api/admin/strikes${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`),

  createRightsStrike: (body: { userId: string; reason: RightsStrikeDto['reason']; notes: string; photoId?: string; noticeId?: string }) =>
    request<{ strike: RightsStrikeDto }>('/api/admin/strikes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  adminEarningsHolds: () => request<{ totalUsd: number; items: EarningsHoldDto[] }>('/api/admin/earnings/holds'),

  releaseEarningsHold: (id: string, notes?: string) =>
    request<{ ok: boolean; status: string }>(`/api/admin/earnings/holds/${id}/release`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),

  setCommercialLock: (
    photoId: string,
    locked: boolean,
    opts?: { notes?: string; reason?: import('@vuekumi/shared').CommercialLockReasonCode },
  ) =>
    request<{ ok: boolean; commercialLocked: boolean; commercialLockReason: string | null }>(
      `/api/admin/content/${photoId}/commercial-lock`,
      {
        method: 'POST',
        body: JSON.stringify({
          locked,
          notes: opts?.notes,
          reason: opts?.reason,
        }),
      },
    ),

  decideModeration: (id: string, action: 'approve' | 'reject', notes?: string) =>
    request<{ ok: boolean }>(`/api/admin/moderation/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ action, notes }),
    }),

  adminQuotes: (status?: string) =>
    request<{ items: LicenseQuoteDto[] }>(`/api/licenses/quotes${status ? `?status=${encodeURIComponent(status)}` : ''}`),

  priceQuote: (id: string, quoteUsd: number) =>
    request<{ quote: LicenseQuoteDto }>(`/api/admin/quotes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ quoteUsd, status: 'quoted' }),
    }),

  declineQuote: (id: string) =>
    request<{ quote: LicenseQuoteDto }>(`/api/admin/quotes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'declined' }),
    }),

  sendPasswordReset: (userId: string) =>
    request<{ ok: boolean }>(`/api/auth/admin/send-password-reset/${userId}`, { method: 'POST' }),

  adminSettings: () =>
    request<{ settings: AdminSetting[] }>('/api/admin/settings'),

  updateAdminSettings: (settings: { key: string; value: string }[]) =>
    request<{ settings: AdminSetting[] }>('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    }),

  testEmail: () =>
    request<{ ok: boolean; delivered: boolean; id?: string }>('/api/admin/email/test', { method: 'POST' }),

  countries: (contributorsOnly?: boolean) =>
    request<{ countries: GeoCountry[] }>(`/api/geo/countries${contributorsOnly ? '?contributors=1' : ''}`),

  pricing: (country?: string) =>
    request<PricingQuote>(`/api/geo/pricing${country ? `?country=${country}` : ''}`),

  adminAccounts: (type: 'users' | 'contributors' | 'photographers' | 'influencers' | 'agencies' | 'admins' | 'models', params?: { q?: string; page?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.page) qs.set('page', String(params.page))
    const q = qs.toString()
    return request<{ items: AdminAccount[]; total: number }>(`/api/admin/${type}${q ? `?${q}` : ''}`)
  },

  adminAccount: (id: string) =>
    request<{ user: AdminAccount }>(`/api/admin/accounts/${id}`),

  createAccount: (body: {
    email: string
    name: string
    accountType: 'user' | 'photographer' | 'photo_influencer' | 'contributor' | 'agency' | 'model'
    password: string
    country?: string
  }) =>
    request<{ user: AdminAccount }>('/api/admin/accounts', { method: 'POST', body: JSON.stringify(body) }),

  patchAccount: (id: string, body: Partial<Pick<AdminAccount, 'name' | 'email' | 'country' | 'status'>>) =>
    request<{ user: AdminAccount }>(`/api/admin/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  createAdmin: (body: {
    email: string
    name: string
    password: string
    country?: string
    preset: 'super_admin' | 'moderator' | 'finance' | 'support'
    capabilities?: string[]
  }) =>
    request<{ user: AdminAccount }>('/api/admin/admins', { method: 'POST', body: JSON.stringify(body) }),

  patchAdmin: (id: string, body: {
    preset?: 'super_admin' | 'moderator' | 'finance' | 'support'
    capabilities?: string[]
  }) =>
    request<{ user: AdminAccount }>(`/api/admin/admins/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  setAgencyStatus: (agencyId: string, status: 'pending' | 'active' | 'suspended') =>
    request<{ agency: { id: string; name: string; status: string }; user: AdminAccount }>(
      `/api/admin/agencies/${agencyId}/status`,
      { method: 'POST', body: JSON.stringify({ status }) },
    ),

  adminCountries: () => request<{ countries: GeoCountry[] }>('/api/admin/countries'),
  upsertCountry: (body: Partial<GeoCountry> & { code: string; name: string; currency: string; currencyName: string; region: string }) =>
    request<{ country: GeoCountry }>('/api/admin/countries', { method: 'POST', body: JSON.stringify(body) }),
  patchCountry: (code: string, body: Partial<GeoCountry>) =>
    request<{ country: GeoCountry }>(`/api/admin/countries/${code}`, { method: 'PATCH', body: JSON.stringify(body) }),

  adminCountryActivation: () =>
    request<{ countries: CountryActivationRow[] }>('/api/admin/countries/activation'),
  seedCountryPolicyHold: () =>
    request<{ ok: boolean; countries: number; created: number }>('/api/admin/countries/activation/seed-hold', { method: 'POST' }),
  adminCountryActivationDetail: (code: string) =>
    request<{ country: GeoCountry; policy: CountryPolicyDetail }>(`/api/admin/countries/${code}/activation`),
  patchCountryGate: (gateId: string, body: { status?: string; rationale?: string | null; evidence?: { label: string; url?: string; notes?: string } }) =>
    request<{ policy: CountryPolicyDetail | null }>(`/api/admin/countries/activation/gates/${gateId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  patchCountryFeatureScope: (
    policyId: string,
    action: string,
    body: { state: string; notes?: string | null },
  ) =>
    request<{ policy: CountryPolicyDetail | null }>(
      `/api/admin/countries/activation/${policyId}/scopes/${encodeURIComponent(action)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  submitCountryPolicy: (policyId: string, notes?: string) =>
    request<{ policyId: string; status: string }>(`/api/admin/countries/activation/${policyId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
  activateCountryPolicy: (policyId: string, notes?: string) =>
    request<{ policyId: string; status: string }>(`/api/admin/countries/activation/${policyId}/activate`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
  suspendCountryPolicy: (policyId: string, notes?: string) =>
    request<{ policyId: string; status: string }>(`/api/admin/countries/activation/${policyId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
  policyEvaluate: (body: { action: string; countryCode?: string; role?: string }) =>
    request<{
      decision: string
      reasonCodes: string[]
      policyVersion: string | null
      expiresAt: string | null
      evidenceRequired: string[]
    }>('/api/policy/evaluate', { method: 'POST', body: JSON.stringify(body) }),

  adminRates: () => request<{ rates: FxRate[] }>('/api/admin/exchange-rates'),
  syncRates: () => request<{ updated: number; currencies: string[] }>('/api/admin/exchange-rates/sync', { method: 'POST' }),
  overrideRate: (currency: string, overrideRate: number | null) =>
    request<{ rate: FxRate }>(`/api/admin/exchange-rates/${currency}`, {
      method: 'PATCH',
      body: JSON.stringify({ overrideRate }),
    }),

  adminGateways: () => request<{ gateways: PaymentGateway[] }>('/api/admin/gateways'),
  createGateway: (body: Record<string, unknown>) =>
    request<{ gateway: PaymentGateway }>('/api/admin/gateways', { method: 'POST', body: JSON.stringify(body) }),
  patchGateway: (id: string, body: Record<string, unknown>) =>
    request<{ gateway: PaymentGateway }>(`/api/admin/gateways/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteGateway: (id: string) => request<{ ok: boolean }>(`/api/admin/gateways/${id}`, { method: 'DELETE' }),

  adminAiProviders: () => request<{ providers: AiProvider[] }>('/api/admin/ai-providers'),
  createAiProvider: (body: Record<string, unknown>) =>
    request<{ provider: AiProvider }>('/api/admin/ai-providers', { method: 'POST', body: JSON.stringify(body) }),
  patchAiProvider: (id: string, body: Record<string, unknown>) =>
    request<{ provider: AiProvider }>(`/api/admin/ai-providers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAiProvider: (id: string) => request<{ ok: boolean }>(`/api/admin/ai-providers/${id}`, { method: 'DELETE' }),
}

export interface GeoCountry {
  code: string
  name: string
  currency: string
  currencyName: string
  region: string
  contributorEligible: boolean
  enabled: boolean
  overlayKind?: string | null
  biometricForbidden?: boolean
  counselStatus?: string
}

export interface CountryActivationRow {
  code: string
  name: string
  region: string
  contributorEligible: boolean
  enabled: boolean
  overlayKind: string | null
  counselStatus: string
  policy: {
    id: string
    version: number
    status: string
    preparedById: string | null
    publishedAt: string | null
    gatesReady: boolean
    gatesMissing: string[]
    gateCounts: {
      total: number
      approved: number
      notApplicable: number
      blocked: number
      open: number
    }
    lastTransitionKind: string | null
  } | null
}

export interface CountryPolicyDetail {
  id: string
  countryCode: string
  version: number
  status: string
  preparedById: string | null
  publishedAt: string | null
  effectiveFrom: string | null
  effectiveTo: string | null
  notes: string | null
  gates: Array<{
    id: string
    code: string
    title: string
    status: string
    rationale: string | null
    evidence: Array<{ id: string; label: string; url: string | null; notes: string | null; createdAt: string }>
    approvals: Array<{ id: string; approverId: string; decision: string; createdAt: string }>
  }>
  featureScopes: Array<{ action: string; state: string; notes: string | null }>
  transitions: Array<{
    id: string
    kind: string
    fromStatus: string
    toStatus: string
    actorId: string
    authorizeId: string | null
    notes: string | null
    createdAt: string
  }>
}

export interface PricingQuote {
  countryCode: string | null
  countryName: string | null
  currency: string
  currencyName: string
  rateToUsd: number
  source: 'auto' | 'override' | 'default'
  fetchedAt: string | null
}

export type AdminAccount = AdminAccountDto

export interface FxRate {
  currency: string
  rateToUsd: number
  overrideRate: number | null
  source: string
  fetchedAt: string | null
  effectiveRate: number
  effectiveSource: string
}

export interface PaymentGateway {
  id: string
  name: string
  slug: string
  kind: string
  countries: string[]
  currencies: string[]
  publicKey: string | null
  notes: string | null
  enabled: boolean
  hasSecret: boolean
  secretMasked?: string
}

export interface AiProvider {
  id: string
  name: string
  slug: string
  purpose: string
  apiBaseUrl: string | null
  notes: string | null
  enabled: boolean
  hasKey: boolean
  keyMasked?: string
}

export interface AdminContentRow extends PhotoDto {
  modelReleases?: { id: string; fileName: string; status: string; notes: string | null }[]
  grantsCount?: number
}

export interface AdminContentDetail {
  photo: PhotoDto
  modelReleases: { id: string; fileName: string; status: string; notes: string | null }[]
  grants: {
    id: string
    licenseType: string
    licenseName: string
    certificateCode: string
    buyerEmail: string
    amountUsd: number
    createdAt: string
  }[]
  quotes: LicenseQuoteDto[]
  moderation: { id: string; flag: string; status: string; notes: string | null }[]
  reports: RightsReportDto[]
}

export interface AdminModerationRow {
  id: string
  flag: string
  status: string
  submittedBy: string
  createdAt: string
  liveReady: boolean
  liveBlockers: string[]
  photo: PhotoDto
}

export interface AdminSetting {
  key: string
  label: string
  group: string
  secret: boolean
  placeholder?: string
  configured: boolean
  value: string
  masked?: string
}

export function homeForAccountType(accountType: AccountType): string {
  switch (accountType) {
    case 'admin':
      return '/admin'
    case 'photographer':
      return '/contributor'
    case 'photo_influencer':
      return '/contributor'
    case 'contributor':
      return '/contributor'
    case 'agency':
      return '/agency'
    case 'model':
      return '/model'
    default:
      return '/'
  }
}

export function homeForUser(user: Pick<AuthUser, 'accountType' | 'agencyId' | 'adminRole' | 'adminCapabilities' | 'adminCapabilitiesCustomized'>): string {
  if (user.accountType === 'admin') return firstAdminPath(user as AuthUser)
  if (user.agencyId) return '/agency'
  return homeForAccountType(user.accountType)
}
