import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { LogoMark } from '../components/shared';

type Mode = 'signin' | 'signup';
type Role = 'member' | 'contributor';

export default function Login() {
  const [mode, setMode] = useState<Mode>('signin');
  const [role, setRole] = useState<Role>('member');
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* form side */}
      <div className="flex items-center justify-center px-6 pt-28 pb-16 lg:pt-16">
        <div className="w-full max-w-md">
          <LogoMark />

          <h1 className="font-serif-display mt-10 text-4xl font-light tracking-tight">
            {mode === 'signin' ? 'Welcome back.' : 'Create your account.'}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {mode === 'signin'
              ? 'Sign in to download, upload and manage your account.'
              : 'Join the marketplace for African imagery.'}
          </p>

          {/* mode toggle */}
          <div className="mt-8 flex rounded-full border border-sand-soft bg-cream p-1">
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setSubmitted(false); }}
                className={`flex-1 rounded-full py-2 font-mono-tech text-[10px] uppercase tracking-[0.18em] transition-colors ${
                  mode === m ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {m === 'signin' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          {mode === 'signup' && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'member', label: 'Member', note: 'Download images' },
                  { id: 'contributor', label: 'Contributor', note: 'Sell your photos' },
                ] as { id: Role; label: string; note: string }[]
              ).map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    role === r.id ? 'border-terra bg-terra/5' : 'border-sand-soft hover:border-terra/50'
                  }`}
                >
                  <span className="block text-sm font-medium">{r.label}</span>
                  <span className="mt-0.5 block font-mono-tech text-[10px] text-ink-faint">{r.note}</span>
                </button>
              ))}
            </div>
          )}

          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
              setTimeout(() => navigate(role === 'contributor' ? '/contributor' : '/'), 1200);
            }}
          >
            {mode === 'signup' && (
              <input
                required
                placeholder="Full name"
                className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none placeholder:text-ink-faint focus:border-terra"
              />
            )}
            <input
              required
              type="email"
              placeholder="Email address"
              className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none placeholder:text-ink-faint focus:border-terra"
            />
            <input
              required
              type="password"
              placeholder="Password"
              className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none placeholder:text-ink-faint focus:border-terra"
            />
            <button
              type="submit"
              className="w-full rounded-full bg-ink py-3.5 font-mono-tech text-[11px] uppercase tracking-[0.2em] text-paper transition-colors hover:bg-terra"
            >
              {submitted
                ? 'Template UI — connect your auth'
                : mode === 'signin'
                  ? 'Sign in'
                  : role === 'contributor'
                    ? 'Create contributor account'
                    : 'Create account'}
            </button>
          </form>

          <div className="mt-5 flex items-center gap-3">
            <span className="hairline flex-1" />
            <span className="font-mono-tech text-[9px] uppercase tracking-[0.2em] text-ink-faint">or continue with</span>
            <span className="hairline flex-1" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {['Google', 'Apple'].map((p) => (
              <button
                key={p}
                onClick={() => setSubmitted(true)}
                className="rounded-full border border-sand-soft py-2.5 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink/30 hover:text-ink"
              >
                {p}
              </button>
            ))}
          </div>

          <p className="mt-6 text-center font-mono-tech text-[10px] leading-relaxed text-ink-faint">
            By continuing you agree to the Terms of Use and acknowledge the Privacy Policy.
            <br />
            Demo routes: <Link to="/contributor" className="text-terra underline underline-offset-2">contributor portal</Link> ·{' '}
            <Link to="/admin" className="text-terra underline underline-offset-2">admin portal</Link>
          </p>
        </div>
      </div>

      {/* image side */}
      <div className="relative hidden overflow-hidden bg-ink-deep lg:block">
        <img src="/images/photos/fashion-portrait.jpg" alt="" className="h-full w-full object-cover opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-deep/80 via-ink-deep/10 to-ink-deep/40" />
        <div className="absolute bottom-10 left-10 right-10">
          <p className="font-serif-display text-3xl font-light leading-snug text-paper">
            “My photographs of Dakar now pay my rent in Lagos.
            <em className="text-terra"> That's the point.”</em>
          </p>
          <p className="mt-4 font-mono-tech text-[10px] uppercase tracking-[0.25em] text-paper-faint">
            Adaeze O. — Contributor since 2024
          </p>
        </div>
      </div>
    </div>
  );
}
