import { Link, useNavigate } from 'react-router'
import type { FollowResult } from '@vuekumi/shared'
import { useAuth } from '../context/AuthContext'
import { api, ApiError } from '../api/client'
import { toast } from 'sonner'

export function FollowButton({
  handle,
  following,
  onChange,
  mine,
  redirectTo,
}: {
  handle: string
  following?: boolean
  onChange?: (result: FollowResult) => void
  mine?: boolean
  redirectTo: string
}) {
  const { user } = useAuth()
  const navigate = useNavigate()

  if (mine) return null

  if (!user) {
    return (
      <Link
        to={`/login?redirect=${encodeURIComponent(redirectTo)}`}
        className="border border-ink px-5 py-2.5 font-mono-tech text-[10px] uppercase tracking-[0.18em] hover:bg-ink hover:text-paper"
      >
        Follow
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          const result = await api.toggleFollow(handle)
          onChange?.(result)
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : 'Could not update follow')
        }
      }}
      className={`px-5 py-2.5 font-mono-tech text-[10px] uppercase tracking-[0.18em] ${
        following
          ? 'border border-sand bg-white hover:border-ink'
          : 'border border-ink hover:bg-ink hover:text-paper'
      }`}
      aria-pressed={Boolean(following)}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
