import { useTheme, type ThemeChoice } from '../context/ThemeContext'

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
    </svg>
  )
}

export function ThemeToggle({ tone = 'light' }: { tone?: 'dark' | 'light' }) {
  const { choice, setChoice } = useTheme()
  const appearance = choice ?? (tone === 'dark' ? 'dark' : 'light')
  const next: ThemeChoice = appearance === 'dark' ? 'light' : 'dark'
  const label = next === 'dark' ? 'Switch to dark' : 'Switch to light'
  const color = tone === 'dark'
    ? 'border-paper/40 text-paper hover:border-terra hover:text-terra'
    : 'border-sand text-ink hover:border-ink'
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => setChoice(next)}
      className={`flex h-9 w-9 items-center justify-center border ${color}`}
    >
      {appearance === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
