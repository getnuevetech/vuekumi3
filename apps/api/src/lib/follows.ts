export function followBlocked(opts: {
  followerId: string
  photographer: { id: string; accountType: string; status: string } | null
}): { status: number; error: string } | null {
  if (!opts.photographer || (opts.photographer.accountType !== 'photographer' && opts.photographer.accountType !== 'photo_influencer' && opts.photographer.accountType !== 'contributor') || opts.photographer.status !== 'active') {
    return { status: 404, error: 'Photographer not found' }
  }
  if (opts.followerId === opts.photographer.id) {
    return { status: 400, error: 'You cannot follow yourself' }
  }
  return null
}

export function approvalRate(active: number, rejected: number): number {
  const decided = active + rejected
  if (decided <= 0) return 0
  return Math.round((active / decided) * 100)
}
