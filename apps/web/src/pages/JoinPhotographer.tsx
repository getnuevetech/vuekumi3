import { Navigate, useParams } from 'react-router'

/** Legacy invite URL → Phase 52 /rights hub. */
export default function JoinPhotographer() {
  const { token } = useParams()
  if (!token) return <Navigate to="/rights" replace />
  return <Navigate to={`/rights?token=${encodeURIComponent(token)}`} replace />
}
