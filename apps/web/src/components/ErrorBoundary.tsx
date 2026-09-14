import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { LogoMark } from './shared'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Vuekumi UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
        <div className="w-full max-w-md text-center">
          <LogoMark />
          <h1 className="font-serif-display mt-10 text-4xl font-light tracking-tight">Something broke.</h1>
          <p className="mt-3 text-sm text-ink-soft">Reload the page, or go back to the library.</p>
          <div className="mt-8 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-full border border-sand px-5 py-2.5 font-mono-tech text-[10px] uppercase tracking-[0.18em]"
            >
              Try again
            </button>
            <Link
              to="/"
              className="rounded-full bg-ink px-5 py-2.5 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper"
            >
              Library
            </Link>
          </div>
        </div>
      </div>
    )
  }
}
