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
  PhotoAppearanceDto,
  ModelInvitePreviewDto,
  IdentifyAppearanceInput,
  SelfShotAppearanceInput,
  DecideAppearanceInput,
  AcceptModelInviteInput,
} from '@vuekumi/shared'
import type { AccountType, AgencyRole, LoginInput, OAuthDevInput, RegisterInput, SubmitPhotoInput, UpdatePhotoInput, UpdateProfileInput, ChangePasswordInput } from '@vuekumi/shared'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

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
  const res = await fetch(`${API_BASE}${path}`, {
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

  adminOverview: () => request<AdminOverviewDto>('/api/admin/metrics/overview'),

  me: () => request<{ user: AuthUser }>('/api/auth/me'),

  updateMe: (body: UpdateProfileInput) =>
    request<{ user: AuthUser }>('/api/auth/me', { method: 'PATCH', body: JSON.stringify(body) }),

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

  agreement: () => request<AgreementDto>('/api/agreements/current'),

  licenses: () => request<{ items: LicenseProductDto[] }>('/api/licenses'),

  photoLicenses: (id: string) => request<{ items: LicenseProductDto[] }>(`/api/photos/${id}/licenses`),

  reportPhoto: (id: string, body: CreateRightsReportInput) =>
    request<PublicReportResult>(`/api/photos/${id}/report`, {
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
    const target = uploadUrl.startsWith('http') ? uploadUrl : `${API_BASE}${uploadUrl}`
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

  removeAppearance: (photoId: string, appearanceId: string) =>
    request<{ ok: boolean }>(`/api/contributor/photos/${photoId}/appearances/${appearanceId}`, { method: 'DELETE' }),

  modelInvitePreview: (token: string) =>
    request<{ invite: ModelInvitePreviewDto }>(`/api/model/invite/${token}`),

  acceptModelInvite: (token: string, body?: AcceptModelInviteInput) =>
    request<{ user: AuthUser }>(`/api/model/invite/${token}`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),

  modelPortal: () =>
    request<{
      handle: string | null
      location: string | null
      bio: string | null
      earns: false
      counts: { invited: number; claimed: number; approved: number; rejected: number; total: number }
    }>('/api/model'),

  modelAppearances: () => request<{ items: PhotoAppearanceDto[] }>('/api/model/appearances'),

  decideAppearance: (id: string, body: DecideAppearanceInput) =>
    request<{ appearance: PhotoAppearanceDto }>(`/api/model/appearances/${id}/decide`, {
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

  adminContent: (params?: { q?: string; status?: string; page?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.status) qs.set('status', params.status)
    if (params?.page) qs.set('page', String(params.page))
    const q = qs.toString()
    return request<{ items: AdminContentRow[]; total: number }>(`/api/admin/content${q ? `?${q}` : ''}`)
  },

  adminContentDetail: (id: string) => request<AdminContentDetail>(`/api/admin/content/${id}`),

  patchRights: (id: string, body: Record<string, unknown>) =>
    request<{ photo: PhotoDto }>(`/api/admin/content/${id}/rights`, { method: 'PATCH', body: JSON.stringify(body) }),

  verifyTwoPartyProcess: (id: string) =>
    request<{ ok: boolean; consentVersion: string }>(`/api/admin/content/${id}/verify-process`, { method: 'POST', body: '{}' }),

  reviewModelRelease: (id: string, status: 'verified' | 'rejected', notes?: string) =>
    request<{ ok: boolean }>(`/api/admin/model-releases/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    }),

  adminModeration: () => request<{ items: AdminModerationRow[] }>('/api/admin/moderation'),

  adminReports: (status?: string) =>
    request<{ items: RightsReportDto[] }>(`/api/admin/reports${status ? `?status=${encodeURIComponent(status)}` : ''}`),

  decideRightsReport: (id: string, action: 'lock' | 'unlock' | 'dismiss' | 'resolve', notes?: string) =>
    request<{ report: RightsReportDto }>(`/api/admin/reports/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ action, notes }),
    }),

  setCommercialLock: (photoId: string, locked: boolean, notes?: string) =>
    request<{ ok: boolean; commercialLocked: boolean }>(`/api/admin/content/${photoId}/commercial-lock`, {
      method: 'POST',
      body: JSON.stringify({ locked, notes }),
    }),

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

  adminAccounts: (type: 'users' | 'contributors' | 'agencies' | 'admins' | 'models', params?: { q?: string; page?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.page) qs.set('page', String(params.page))
    const q = qs.toString()
    return request<{ items: AdminAccount[]; total: number }>(`/api/admin/${type}${q ? `?${q}` : ''}`)
  },

  patchAccount: (id: string, body: Partial<AdminAccount>) =>
    request<{ user: AdminAccount }>(`/api/admin/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  adminCountries: () => request<{ countries: GeoCountry[] }>('/api/admin/countries'),
  upsertCountry: (body: Partial<GeoCountry> & { code: string; name: string; currency: string; currencyName: string; region: string }) =>
    request<{ country: GeoCountry }>('/api/admin/countries', { method: 'POST', body: JSON.stringify(body) }),
  patchCountry: (code: string, body: Partial<GeoCountry>) =>
    request<{ country: GeoCountry }>(`/api/admin/countries/${code}`, { method: 'PATCH', body: JSON.stringify(body) }),

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

export interface AdminAccount {
  id: string
  email: string
  name: string
  accountType: string
  status: string
  country: string | null
  joined: string
  emailVerified: boolean
  handle: string | null
  photos: number
  earnings: number
  downloads: number
  plan: string | null
  adminRole: string | null
  agencyName: string | null
  agencyStatus: string | null
  appearances?: number
  dualRole?: boolean
}

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

export function homeForUser(user: Pick<AuthUser, 'accountType' | 'agencyId'>): string {
  if (user.agencyId) return '/agency'
  return homeForAccountType(user.accountType)
}
