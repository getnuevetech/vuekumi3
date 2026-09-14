import { useEffect, useState, type DragEvent } from 'react';
import { Link } from 'react-router';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { toast } from 'sonner';
import type { PhotoDto } from '@vuekumi/shared';
import { PortalShell, StatCard, SectionHead, StatusPill, type PortalLink } from '../components/shared';
import {
  contributorStats, earningsSeries, fmt, money, payoutHistory, photoById, photographerOf, photos,
} from '../data/content';
import { api, ApiError } from '../api/client';

const ME = 'amara-okafor';

const icons = {
  dash: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  upload: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 16V4m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" strokeLinecap="round" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="1" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  ),
  money: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v10M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 .9-3 2.2c0 3 6 1.5 6 4.6 0 1.3-1.3 2.2-3 2.2s-3-1.1-3-2.5" strokeLinecap="round" />
    </svg>
  ),
};

export const contributorLinks: PortalLink[] = [
  { to: '/contributor', label: 'Dashboard', icon: icons.dash },
  { to: '/contributor/upload', label: 'Upload', icon: icons.upload },
  { to: '/contributor/portfolio', label: 'Portfolio', icon: icons.grid },
  { to: '/contributor/earnings', label: 'Earnings', icon: icons.money },
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell title="Contributor portal" subtitle="Template UI — wire to your API, auth & storage." links={contributorLinks}>
      {children}
    </PortalShell>
  );
}

/* ---------------- dashboard ---------------- */

export function ContributorDashboard() {
  const mine = photos.filter((p) => p.photographer === ME);
  const top = [...mine].sort((a, b) => b.downloads - a.downloads).slice(0, 4);
  const me = photographerOf(ME);
  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Dashboard</p>
          <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">
            Habari, {me.name.split(' ')[0]}.
          </h1>
          <p className="mt-1 text-sm text-ink-soft">Here's how your work is performing.</p>
        </div>
        <Link
          to="/contributor/upload"
          className="rounded-full bg-ink px-6 py-3 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-terra"
        >
          + Upload images
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total earnings" value={money(contributorStats.totalEarnings)} sub={`${money(contributorStats.thisMonth)} this month`} />
        <StatCard label="Downloads" value={fmt(contributorStats.downloads)} sub="+8.2% vs last month" />
        <StatCard label="Profile views" value={fmt(contributorStats.views)} sub={`${fmt(contributorStats.followers)} followers`} />
        <StatCard label="Approval rate" value={`${contributorStats.approvalRate}%`} sub="last 90 days" />
      </div>

      <div className="mt-10">
        <SectionHead kicker="Performance" title="Earnings, last 6 months" />
        <div className="rounded-2xl border border-sand-soft bg-white p-5">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={earningsSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#bc773f" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#bc773f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#efe4da" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8a7f76' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8a7f76' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => [money(v), 'Earnings']}
                  contentStyle={{ border: '1px solid #dec9b8', borderRadius: 12, fontSize: 12, background: '#faf6f3' }}
                />
                <Area type="monotone" dataKey="earnings" stroke="#bc773f" strokeWidth={2} fill="url(#eg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <SectionHead
          kicker="Top images"
          title="Best performers"
          right={<Link to="/contributor/portfolio" className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra hover:text-ink">View all →</Link>}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {top.map((p) => (
            <Link key={p.id} to={`/photo/${p.id}`} className="group overflow-hidden rounded-2xl border border-sand-soft bg-white">
              <div className="aspect-[4/3] overflow-hidden">
                <img src={p.src} alt={p.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <StatusPill status={p.license} />
                </div>
                <p className="mt-1.5 font-mono-tech text-[10px] text-ink-faint">
                  {fmt(p.downloads)} downloads · {fmt(p.views)} views
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Shell>
  );
}

/* ---------------- upload ---------------- */

export function ContributorUpload() {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Landscape');
  const [country, setCountry] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [licenseType, setLicenseType] = useState<'free' | 'premium'>('free');
  const [people, setPeople] = useState(false);
  const [exclusive, setExclusive] = useState(false);
  const [copyrightHolder, setCopyrightHolder] = useState('');
  const [releaseName, setReleaseName] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const addFiles = (incoming: File[]) => {
    const images = incoming.filter((f) => f.type.startsWith('image/'));
    setFiles((prev) => [...prev, ...images]);
    if (images[0] && !releaseName) setReleaseName(images[0].name);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Upload</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Add new work.</h1>
      <p className="mt-1 max-w-xl text-sm text-ink-soft">
        You keep full copyright — Vuekumi only licenses usage rights. Photos go live after moderation
        and required rights (copyright, model release, platform agreement).
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-8 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-16 text-center transition-colors ${
          dragging ? 'border-terra bg-terra/5' : 'border-sand bg-white'
        }`}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cream text-terra">
          {icons.upload}
        </div>
        <p className="mt-4 text-sm font-medium">Drag &amp; drop your images here</p>
        <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">or</p>
        <label className="mt-3 cursor-pointer rounded-full bg-ink px-6 py-2.5 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-terra">
          Browse files
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
          />
        </label>
        <p className="mt-4 font-mono-tech text-[10px] text-ink-faint">
          JPEG, PNG, WebP or TIFF · up to 50 MB · originals stay private
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-6 rounded-2xl border border-sand-soft bg-white">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center justify-between border-b border-sand-soft px-5 py-3 last:border-0">
              <span className="truncate text-sm">{f.name}</span>
              <span className="font-mono-tech text-[10px] text-ink-faint">{Math.round(f.size / 1024)} KB</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        <form
          className="space-y-4 rounded-2xl border border-sand-soft bg-white p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!attested) {
              toast.error('Confirm you hold copyright');
              return;
            }
            if (files.length === 0) {
              toast.error('Add at least one image file');
              return;
            }
            setBusy(true);
            try {
              let lastId = '';
              for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setProgress(`Uploading ${i + 1} of ${files.length}`);
                const signed = await api.presignUpload(file.name, file.type || 'image/jpeg');
                await api.putUpload(signed.uploadUrl, file, signed.headers);
                setProgress(`Processing ${i + 1} of ${files.length}`);
                const photo = await api.submitPhoto({
                  title: files.length === 1 ? title : `${title || file.name.replace(/\.[^.]+$/, '')} ${i + 1}`,
                  description,
                  category,
                  country,
                  tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
                  licenseType,
                  hasRecognizablePeople: people,
                  exclusiveAvailable: exclusive,
                  copyrightHolder,
                  copyrightAttested: true,
                  modelReleaseFileName: people ? (releaseName || file.name) : undefined,
                  modelReleaseNotes: releaseNotes || undefined,
                  originalKey: signed.key,
                });
                lastId = photo.photo.id;
              }
              toast.success(files.length === 1 ? `Submitted ${lastId} for review` : `Submitted ${files.length} images for review`);
              setTitle('');
              setFiles([]);
              setProgress('');
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : 'Submit failed');
            } finally {
              setBusy(false);
              setProgress('');
            }
          }}
        >
          <h2 className="font-serif-display text-xl font-light">Image details & rights</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-sand-soft bg-white px-4 py-2.5 text-sm outline-none focus:border-terra">
              {['People', 'Wildlife', 'Landscape', 'Urban', 'Culture', 'Food & Craft', 'Coast', 'Fashion', 'Architecture'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input required value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className="rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra" />
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma separated)" className="rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra" />
          </div>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description — what's the story of this image?"
            className="w-full rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
          <input
            required
            value={copyrightHolder}
            onChange={(e) => setCopyrightHolder(e.target.value)}
            placeholder="Copyright holder (your name or studio)"
            className="w-full rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
          <fieldset className="grid gap-2 sm:grid-cols-2">
            {[
              { v: 'free' as const, t: 'Free collection', d: 'Royalty-free grant at $0' },
              { v: 'premium' as const, t: 'Premium collection', d: 'Commercial licence, 50% to you' },
            ].map((o) => (
              <label key={o.v} className="flex cursor-pointer gap-3 rounded-xl border border-sand-soft p-4 transition-colors has-checked:border-terra has-checked:bg-terra/5">
                <input type="radio" name="license" checked={licenseType === o.v} onChange={() => setLicenseType(o.v)} className="mt-1 accent-[#bc773f]" />
                <span>
                  <span className="block text-sm font-medium">{o.t}</span>
                  <span className="mt-0.5 block font-mono-tech text-[10px] text-ink-faint">{o.d}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <label className="flex items-start gap-2.5 text-[13px] text-ink-soft">
            <input type="checkbox" checked={people} onChange={(e) => setPeople(e.target.checked)} className="mt-0.5 accent-[#bc773f]" />
            This photograph shows a recognisable person (model release required for commercial licences)
          </label>
          {people && (
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={releaseName} onChange={(e) => setReleaseName(e.target.value)} placeholder="Model release file name" className="rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra" />
              <input value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} placeholder="Release notes" className="rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra" />
            </div>
          )}
          <label className="flex items-start gap-2.5 text-[13px] text-ink-soft">
            <input type="checkbox" checked={exclusive} onChange={(e) => setExclusive(e.target.checked)} className="mt-0.5 accent-[#bc773f]" />
            Opt this photo into exclusive sale (delisted after one exclusive grant)
          </label>
          <label className="flex items-start gap-2.5 text-[13px] text-ink-soft">
            <input type="checkbox" required checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-0.5 accent-[#bc773f]" />
            I confirm I own the copyright. Vuekumi receives a platform licence to sublicense usage rights, not ownership.
          </label>
          <button disabled={busy} className="rounded-full bg-ink px-8 py-3 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-terra disabled:opacity-50">
            {busy ? (progress || 'Submitting…') : 'Submit for review'}
          </button>
        </form>

        <aside className="h-fit rounded-2xl bg-cream p-6">
          <h3 className="font-serif-display text-lg font-light">Four rights layers</h3>
          <ul className="mt-4 space-y-3">
            {[
              'Photographer copyright (you keep it)',
              'Model rights for recognisable people',
              'VueKumi platform agreement — not ownership',
              'Buyer licence grant + certificate',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-[13px] text-ink-soft">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-terra" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </Shell>
  );
}

/* ---------------- portfolio ---------------- */

export function ContributorPortfolio() {
  const [mine, setMine] = useState<PhotoDto[]>([]);
  const [tab, setTab] = useState<'all' | 'free' | 'premium'>('all');
  useEffect(() => {
    api.contributorPhotos().then((d) => setMine(d.items)).catch(() => setMine([]));
  }, []);
  const shown = tab === 'all' ? mine : mine.filter((p) => p.license === tab);

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Portfolio</p>
          <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Your images.</h1>
          <p className="mt-1 text-sm text-ink-soft">{mine.length} in your library · licences & rights</p>
        </div>
        <div className="flex rounded-full border border-sand-soft bg-cream p-1">
          {(['all', 'free', 'premium'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.15em] transition-colors ${
                tab === t ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-sand-soft bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-sand-soft font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">
              <th className="px-4 py-3 font-medium">Image</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Licence</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Downloads</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Model</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} className="border-b border-sand-soft last:border-0 hover:bg-cream/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img src={p.thumbSrc ?? p.src} alt="" className="h-11 w-14 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.title}</p>
                      <p className="font-mono-tech text-[10px] text-ink-faint">{p.country} · {p.category}</p>
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-3 md:table-cell"><StatusPill status={p.license} /></td>
                <td className="hidden px-4 py-3 sm:table-cell">{fmt(p.downloads)}</td>
                <td className="hidden px-4 py-3 lg:table-cell"><StatusPill status={p.rights?.modelReleaseStatus ?? 'not_required'} /></td>
                <td className="px-4 py-3"><StatusPill status={p.status} /></td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/photo/${p.id}`} className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-terra hover:text-ink">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

/* ---------------- earnings ---------------- */

export function ContributorEarnings() {
  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Earnings</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Your income.</h1>
      <p className="mt-1 text-sm text-ink-soft">Paid monthly via mobile money or bank transfer.</p>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Available balance" value={money(612.8)} sub="payout Oct 1" />
        <StatCard label="This month" value={money(contributorStats.thisMonth)} sub="+9.3% vs Jul" />
        <StatCard label="All time" value={money(contributorStats.totalEarnings)} sub="since Feb 2023" />
        <StatCard label="Next payout method" value="MTN MoMo" sub="··· 4821" />
      </div>

      <div className="mt-10">
        <SectionHead kicker="Trend" title="Earnings vs downloads" />
        <div className="rounded-2xl border border-sand-soft bg-white p-5">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={earningsSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="eg2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#bc773f" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#bc773f" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3c3835" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#3c3835" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#efe4da" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8a7f76' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" tick={{ fontSize: 11, fill: '#8a7f76' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: '#c2b4a6' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmt(v)} />
                <Tooltip
                  contentStyle={{ border: '1px solid #dec9b8', borderRadius: 12, fontSize: 12, background: '#faf6f3' }}
                  formatter={(v: number, name: string) => [name === 'earnings' ? money(v) : fmt(v), name === 'earnings' ? 'Earnings' : 'Downloads']}
                />
                <Area yAxisId="l" type="monotone" dataKey="earnings" stroke="#bc773f" strokeWidth={2} fill="url(#eg2)" />
                <Area yAxisId="r" type="monotone" dataKey="downloads" stroke="#3c3835" strokeWidth={1.5} strokeDasharray="4 4" fill="url(#dg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <SectionHead kicker="History" title="Payouts" />
        <div className="overflow-hidden rounded-2xl border border-sand-soft bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-sand-soft font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">
                <th className="px-4 py-3 font-medium">Payout</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Method</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {payoutHistory.map((p) => (
                <tr key={p.id} className="border-b border-sand-soft last:border-0 hover:bg-cream/50">
                  <td className="px-4 py-3 font-mono-tech text-xs">{p.id}</td>
                  <td className="px-4 py-3">{p.date}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">{p.method}</td>
                  <td className="px-4 py-3 text-right font-medium">{money(p.amount)}</td>
                  <td className="px-4 py-3 text-right"><StatusPill status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

export function usePhotoById(id: string) {
  return photoById(id);
}
