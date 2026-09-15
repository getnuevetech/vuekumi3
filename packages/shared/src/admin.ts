export interface AdminOverviewStatsDto {
  users: number
  contributors: number
  photosLive: number
  pendingReview: number
  revenueMonthUsd: number
  downloads: number
  monthLabel: string
}

export interface AdminRevenuePointDto {
  month: string
  revenue: number
  payouts: number
}

export interface AdminOverviewDto {
  stats: AdminOverviewStatsDto
  series: AdminRevenuePointDto[]
}
