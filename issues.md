# Frontend Issues

Found by analyzing `src/app/page.tsx`, `src/app/dashboard/DashboardClient.tsx`, `src/components/*`, and related files.

---

## 1. Homepage Content — Repetitive Buzzwords, No Narrative

**Files:** `src/app/page.tsx` (998 lines)

**Problems:**
- Each section re-explains the same concepts from scratch (graph intelligence, Neo4j, MCP, polyglot, typed links — each mentioned 5-7 times across the page)
- No narrative arc: Problem → Access → Architecture → Capabilities → CTA
- Architecture section belongs in `/docs`, not the landing page
- Zero social proof (no testimonials, logos, usage stats, case studies)
- Features section is 4 product specs (search pipeline, graph, intelligence, enrichment) rather than customer benefits
- No code highlighting in code samples

**Fix:** Rewrite the homepage. Each section should build on the previous one. Cut technical jargon by 60%. Add social proof. Move the Architecture section to `/docs`. Use a markdown renderer with code highlighting for code blocks.

---

## 2. Monolithic DashboardClient (1,175 lines)

**Files:** `src/app/dashboard/DashboardClient.tsx`

**Problems:**
- 20+ `useState` hooks, 7+ `useEffect` hooks, all in one file
- Handles: search, page CRUD, stats, API key management, Slack integration, GitHub integration, brain seeding, activity feed, members/invites, SSE live status, natural language Q&A, toast notifications, modals, header menus — all in one component
- Direct `fetch` calls everywhere with duplicated error handling
- No Suspense boundaries — loading states are manual booleans
- Page is `force-dynamic` so no Server Components for data fetching

**Fix:** Split into focused modules:
- `SearchPanel.tsx` — search input, results list, page detail
- `IntegrationsPanel.tsx` — Slack + GitHub forms
- `BrainControls.tsx` — seed, API key, settings
- Keep stats/activity/members as separate dashboard sections

---

## 3. No Shared Component Library

**Files:** All `src/app/*/page.tsx` and `src/components/*`

**Problems:**
- Buttons, Cards, Inputs, Modals, Toasts are re-invented in every file with inline Tailwind classes
- Slight inconsistencies: some buttons use `rounded-xl`, others `rounded-md`; some modals use `rounded-2xl`, others `rounded-xl`
- ~80% of the Tailwind class repetition across 20+ files could be eliminated

**Fix:** Extract shared primitives:
- `Button.tsx` — variants (primary, secondary, ghost), sizes, loading state
- `Card.tsx` — base card with optional header/footer
- `Input.tsx` — styled input with label, error state
- `Modal.tsx` — portal-based modal with backdrop, keyboard dismiss
- `Toast.tsx` — notification system (replace the inline toast in DashboardClient)

---

## 4. Inline SVG Icons Everywhere

**Files:** All `src/app/*/page.tsx` and `src/components/*`

**Problems:**
- 30+ hand-coded `<svg>` paths scattered across files, each adding 10-30 lines of boilerplate
- No icon library — icons for search, close, menu, sun, moon, arrow, check, etc. are duplicated

**Fix:** Add `lucide-react` (it's already in the ecosystem and tiny) and replace all inline SVGs with one-liners like `<Search className="w-4 h-4" />`.

---

## 5. No API Client Abstraction

**Files:** `src/app/dashboard/DashboardClient.tsx`, all `*Client.tsx` files

**Problems:**
- Every data fetch uses raw `fetch("/api/...")` with duplicated boilerplate:
  ```tsx
  const r = await fetch(...);
  const data = await r.json();
  if (data.status === "ok") { ... }
  ```
- Error handling is inconsistent (some `.catch()`, some try/catch, some ignore)
- No typed response wrappers
- Auth header handling is ad-hoc
- SWR is only used in `src/app/eval/` — everywhere else uses manual state

**Fix:** Create `src/lib/api-client.ts` with a `useApi` hook or wrapper:
- Typed request/response
- Automatic error handling and toast on failure
- Consistent loading/error states
- Auth header injection

---

## 6. ThemeProvider Flash

**File:** `src/components/ThemeProvider.tsx` (lines 88-93)

**Problems:**
- Hides ALL children with `visibility: hidden` until mounted
- Hurts perceived performance — every page loads invisible then pops in

**Fix:** Remove the `mounted` guard. The inline `<script>` in `src/app/layout.tsx` already sets `data-theme` before React hydrates, so there's no FOUC to prevent.

---

## 7. Docs Page Is a Monolithic Template Literal

**File:** `src/app/docs/page.tsx` (916 lines)

**Problems:**
- All markdown content is a single template literal string rendered as raw HTML
- No markdown parser — headings, code blocks, tables are hand-written JSX
- No syntax highlighting in code blocks
- No mobile-responsive sidebar (sidebar is `hidden lg:block`)

**Fix:** Use `react-markdown` with `rehype-highlight` or `rehype-prism` for code highlighting. Add a mobile drawer for the sidebar TOC. Add active-section tracking via IntersectionObserver.

---

## 8. Duplicated and Heavy 3D Rendering

**Files:** `src/components/BrainGalaxy.tsx` (633 lines), `src/app/demo/page.tsx` (637 lines), `src/components/D3CanvasGraph.tsx` (384 lines)

**Problems:**
- Three.js + D3.js both included in the bundle — heavy for pages that don't use them
- Demo page has its own independent Three.js scene duplicating what BrainGalaxy already does
- No dynamic imports — these are eagerly loaded even when not visible

**Fix:** Dynamic import both 3D components:
```tsx
const BrainGalaxy = dynamic(() => import("@/components/BrainGalaxy"), { ssr: false });
```
Consider merging the demo scene into BrainGalaxy with a `demo` prop instead of maintaining two separate Three.js scenes.

---

## 9. Image Optimization

**Files:** `src/app/layout.tsx`, `src/components/Nav.tsx`

**Problems:**
- `brainbaseLogo.png` is 1160×1127 PNG used as a 22×22 nav icon and OG image
- No WebP or SVG format
- No proper `sizes` attribute for responsive image

**Fix:** Convert to SVG. Set proper dimensions in metadata:
```tsx
icon: [{ url: "/brainbase-logo.svg", type: "image/svg+xml" }]
```

---

## 10. No Bundle Analysis

**Problems:**
- No `@next/bundle-analyzer` configured
- Unknown JS payload size per page
- No visibility into Three.js + D3.js + Clerk + Convex bundle impact

**Fix:** Add `@next/bundle-analyzer` to `next.config.ts` and document current bundle sizes before optimizing.
