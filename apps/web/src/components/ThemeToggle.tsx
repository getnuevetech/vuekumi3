import { useTheme, type ThemeChoice } from '../context/ThemeContext'

export function ThemeToggle({ tone = 'light' }: { tone?: 'dark' | 'light' }) {
  const { choice, setChoice } = useTheme()
  const idle = tone === 'dark'
    ? 'border-paper/30 text-paper-soft hover:border-paper hover:text-paper'
    : 'border-sand text-ink-soft hover:border-ink hover:text-ink'
  const on = tone === 'dark'
    ? 'border-terra bg-terra text-paper'
    : 'border-ink bg-ink text-paper'
  const button = (value: ThemeChoice, label: string) => (
    <button
      type="button"
      aria-pressed={choice === value}
      onClick={() => setChoice(value)}
      className={`px-2 py-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] ${choice === value ? on : idle}`}
    >
      {label}
    </button>
  )
  return (
    <div className="flex items-center" role="group" aria-label="Appearance">
      {button('light', 'Light')}
      {button('dark', 'Dark')}
    </div>
  )
}
