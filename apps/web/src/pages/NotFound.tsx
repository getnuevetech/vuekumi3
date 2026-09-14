import { Link } from 'react-router'
import { LogoMark } from '../components/shared'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-md text-center">
        <LogoMark />
        <p className="mt-10 font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">404</p>
        <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Page not found.</h1>
        <p className="mt-3 text-sm text-ink-soft">That route is not part of the Vuekumi library or portals.</p>
        <Link
          to="/"
          className="mt-8 inline-block rounded-full bg-ink px-6 py-3 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper hover:bg-terra"
        >
          Back to the library
        </Link>
      </div>
    </div>
  )
}
