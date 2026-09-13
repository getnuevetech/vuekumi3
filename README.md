# Vuekumi

**Vuekumi** — a stock image platform for authentic African photography. Free and premium
images shot by photographers across all 54 countries, with a contributor portal for
uploads and earnings, and an admin portal for moderation, users, and payouts.

This is a **frontend design template** built with React 19 + TypeScript + Vite + Tailwind
CSS. All data is mock data (`src/data/content.ts`) — wire it to your own API, auth, and
storage to go live.

## Highlights

- **Noir landing page** — full-screen crossfading hero slider with script accents, edge-to-edge
  image strips, marquee ticker, endless-scroll masonry feed (IntersectionObserver),
  circular progress-ring stats band, snap-scroll contributor rail, image-topped pricing cards
- **Photo detail pages** with license selection (Free / Premium / Extended)
- **Contributor portal** — dashboard, upload flow, portfolio grid, earnings & payout history
- **Admin portal** — overview stats, moderation queue (approve/reject), user management, payouts
- Fully responsive, dark noir theme with a warm terra accent

## Getting started

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
npm run preview  # preview the production build
```

## Deploying

The site is a static SPA. Deploy `dist/` to any static host (Netlify, Vercel, GitHub Pages).
If the host supports it, add an SPA fallback so all routes serve `index.html`.

## Structure

```
src/
  pages/        Home (Noir landing), Pricing, Login, PhotoDetail, Contributor*, Admin*
  components/   shared.tsx (header, photo cards, portal shell), ui/ (shadcn components)
  data/         content.ts — all mock data; replace with API calls
public/images/  demo photography (placeholder content)
```

---

*All photography is demo content. Replace with licensed images before production use.*
