# Mushafy (مصحفي) — Master Expert Guide

> **Purpose:** Everything an engineer (human or AI) needs to work on this codebase productively.
> Read this top-to-bottom once, then use it as a reference. Supplemental deep-dives are listed in §14.

---

## 1. What Is This App?

**Mushafy** is a multilingual (Arabic/English) Quran reading app built as a **PWA + native Android app (Capacitor)**. It renders the 604-page Madani Mushaf either as **page images** (3 image mushafs) or as **text lines** (2 text mushafs: tarteel/tajweed) using per-page custom fonts. Features: swipeable page navigation (single/double page spread), ayah-by-ayah audio recitation from two providers with follow-along highlighting and a memorization repeat engine, bookmarks, tafseer (20+ editions), word search, navigation by surah/juz/page/hizb/quarter/ayah, offline downloads, dark mode, and a memorization quiz (`/test`).

- **Repo/CDN trick:** Heavy assets (604 page images ×3 mushafs, fonts) live in `public/assets/` in this same repo and are served in production via jsDelivr CDN (`https://cdn.jsdelivr.net/gh/Armagdy/mushafy@master/public/assets`) — see `src/config/assets.ts`. A Vite plugin (`excludeMushafImagesPlugin` in `vite.config.ts`) deletes images/fonts from `dist/` after every build so they're downloaded on demand and cached, never bundled.

---

## 2. Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript, Vite 5 (SWC transpiler, port **8080**) |
| Styling | Tailwind CSS 3 + shadcn/ui (Radix primitives, in `src/components/ui/` — do not hand-edit) |
| Routing | React Router v6, `BrowserRouter` with `basename={import.meta.env.BASE_URL}` |
| State | React Context only (**no Redux/Zustand**) + TanStack Query provider mounted (barely used) |
| Animation | Framer Motion |
| Native | Capacitor 8 (Android only; appId `com.mushafy.quran`) |
| Audio | Plain `<audio>` element + Web Audio API for concatenation; MediaSession (web) + custom native plugin `QuranMediaSession` |
| PWA | Hand-written service worker `public/sw.js` (registered manually in `main.tsx`, NOT vite-plugin-pwa despite the dep) |
| Testing | Vitest + React Testing Library (minimal tests: `src/test/`) |

---

## 3. Commands

```sh
npm install            # deps (bun.lockb also present; npm is what scripts assume)
npm run dev            # dev server at http://localhost:8080
npm run build          # prod build to dist/ (mushaf images/fonts stripped from dist!)
npm run lint           # eslint
npm run test           # vitest run

# Native Android
npm run cap:sync       # build + npx cap sync android
npm run cap:run        # build + run on device/emulator
npm run cap:open       # open Android Studio

# Asset tooling (one-off maintenance)
npm run optimize-images / optimize:webp[:dry]
```

**Deployments:** push to `main` → GitHub Actions `.github/workflows/deploy.yml` builds & publishes GitHub Pages (`base` path handled via `VITE_BASE_PATH`). Vercel also configured (`vercel.json` SPA rewrite) and preferred for TWA builds.

---

## 4. Startup Flow

1. `src/main.tsx`
   - `preloadQuranData()` — fetch+cache `quran-meta-data.json`, `ayah-meta-data.json`, `reciters.json` into memory/persistent cache before first render.
   - `loadAllIconFonts()` — inject decorative icon fonts (surah-name headers etc.).
   - Registers `public/sw.js`; precaches app shell into `mushafy-shell-v1`.
2. `src/App.tsx` provider stack (order matters):
   ```
   QueryClientProvider → LanguageProvider → MushafProvider → DialogTextSizeProvider
     → DarkModeProvider → DownloadProvider → AppContent (TooltipProvider + toasters + Routes)
   ```
3. Route `/` renders **`Surah.tsx`**, which redirects to last-read page from `localStorage['quran-last-page']` if no `:page` param.

---

## 5. Routing

Defined in `src/App.tsx`. All reader routes render the same page:

| Path | Component | Notes |
|---|---|---|
| `/` , `/page/:page` | `Surah` | URL is source of truth for current page |
| `/surah/:id`, `/surah/:id/:page` | `Surah` | |
| `/test` | `Test` | Memorization quiz (hifz + tikrar modes) |
| `*` | `NotFound` | Redirects to `/` |

⚠️ New routes MUST be added above the catch-all. `Index.tsx` and `Configuration.tsx` exist but are **not routed (dead)**.

---

## 6. Directory Map (what lives where)

```
src/
├── main.tsx                  # bootstrap: preload data, fonts, SW registration
├── App.tsx                   # providers + routes
├── pages/
│   ├── Surah.tsx             # ★ THE reader screen (~1500 ln). Owns nearly all state,
│   │                         #   wires useAudioPlayer ↔ UI ↔ ConfigOverlay (~60 props)
│   ├── Test.tsx              # memorization quiz (hifz/tikrar question generators)
│   ├── Index.tsx             # DEAD (unrouted)
│   └── NotFound.tsx
├── components/
│   ├── quran/                # reader chrome + page renderers
│   │   ├── SwiperPageDisplay.tsx   # ★ ACTIVE renderer: Swiper + Virtual slides (604)
│   │   ├── PageDisplay.tsx         # legacy renderer (unreachable; useSwiperMode=true)
│   │   ├── TartelPage.tsx          # text-mushaf page renderer (lines JSON + per-page font)
│   │   ├── CachedImage.tsx         # image loader w/ cache-first strategy
│   │   ├── TopBar.tsx / BottomBar.tsx / PlayBar.tsx / AudioProgressBar.tsx
│   │   ├── *Dialog.tsx             # LEGACY dialogs — dead/superseded (see §13)
│   │   └── TestSettingsDialog.tsx / TestViewSettings.tsx
│   ├── config/               # ★ view-based configuration system (replaces modals)
│   │   ├── ConfigOverlay.tsx       # full-screen overlay container; exports ConfigType
│   │   ├── SettingsView / StyleSettings / NavigationView / SearchView /
│   │   ├── ReciterView / RepeatView / AyahSelectorView / TafseerView /
│   │   └── BookmarksView / Download.tsx (offline manager)
│   ├── ui/                   # shadcn boilerplate — don't edit
│   └── Hero/SurahList/SurahCard/SurahReader/NavLink  # dead leftovers
├── contexts/
│   ├── LanguageContext.tsx   # ar/en, t(), isRTL, sets <html dir>
│   ├── MushafContext.tsx     # 5 mushaf types; getMushafPath()
│   ├── DarkModeContext.tsx   # de-facto theme provider (.dark class)
│   ├── DialogTextSizeContext.tsx
│   └── DownloadContext.tsx   # batch offline-download job runner (worker pool)
├── hooks/
│   ├── useAudioPlayer.ts     # ★★ ~3300 ln audio engine (see §10)
│   ├── useBookmarks.ts / useTafseer.ts / useQuranData.ts / useNetwork.ts
│   ├── useAppKeepAwake.ts / useThemeColor.ts / use-toast.ts / use-mobile.tsx
│   └── useNavigation.tsx     # search/nav helpers (currently unused)
├── lib/
│   ├── native-storage.ts     # ★ hybrid storage: Capacitor Filesystem ⇄ IndexedDB
│   ├── quran-data-service.ts # static JSON fetch-once-cache service
│   ├── quran-mapping.ts      # page↔surah↔ayah↔juz↔hizb math (pure fns)
│   ├── mp3quran-service.ts   # mp3quran.net API client (+timings)
│   ├── audio-cache.ts / asset-cache.ts / font-cache.ts / tafseer-cache.ts
│   ├── quran-media-session.ts / media-session-debug.ts
│   └── utils.ts              # cn() only
├── config/assets.ts          # ASSETS_BASE_URL / IMAGES_BASE_URL (CDN logic)
├── data/surahs.ts            # canonical 114-surah metadata (DO NOT EDIT)
└── i18n/translations.ts      # flat ar/en dictionaries + TranslationKey type
public/
├── assets/
│   ├── quran-meta-data.json      # pages[604]/juzs[30]/hizb_quarters[240] → [surah,ayah]
│   ├── ayah-meta-data.json       # all 6236 ayah texts + per-ayah juz/page/sajda (~3.3 MB)
│   ├── quran_pages_lines.json    # line-layout of every page for TEXT mushafs (~22 MB)
│   ├── reciters.json             # 293 reciters, mixed union of 2 shapes (see §9)
│   ├── mushuf_mwdoa_images/      # page_0001.webp … page_0604.webp  (typo intentional!)
│   ├── mushaf_tashel_pages/ , mushaf_madinah_images/
│   └── fonts/qpc_v2_font|qpc_v4_font/p{1..604}.woff + icon fonts
├── sw.js , manifest.json
android/                      # Capacitor Android project
scripts/                      # image optimization / icon / splash generators
```

---

## 7. Core Domain Model

### 7.1 Pages (604) and mapping
- The Madani mushaf has **604 pages**; page N's image file = `getPageImageFilename(N)` → **`page_XXXX.webp`** (zero-padded 4 digits) inside the mushaf folder.
- `src/lib/quran-mapping.ts` is pure math over `pages[604]` / `juzs[30]` / `hizb_quarters[240]` arrays (each entry `[surahId, ayah]`):
  - `getAyahPage(surah, ayah)` — which page contains an ayah (handles shared pages).
  - `getSurahFirstPage(surahId)` / alias `getPageOfSurahFirstAyah(surahId)` — **always use these for surah navigation**; many pages contain multiple surahs (e.g., surah 70 starts mid-page 568). Naive arithmetic is wrong.
  - `getPageJuzNumber`, `getJuzFirstPage`, `getPageSurahInfo`, `getSurahHizbQuarters`, etc.
- Absolute ayah indexing (6,236 total) comes from `startingAyah` field in `src/data/surahs.ts`.
- ⚠️ Dead/wrong: `generateSurahImageMap`/`getSurahImageMap` produce `.jpg` names with an off-by-one — never used, never fix-and-use without checking assets.

### 7.2 Mushaf types (`MushafContext`)
```ts
type MushafType = 'mwdoa' | 'tashel' | 'madinah' | 'tarteel' | 'tajweed';
```
- **Image mushafs** (mwdoa/tashel/madinah): folders under `IMAGES_BASE_URL`; note the historical typo folder **`mushuf_mwdoa_images`** (kept everywhere on purpose — renaming breaks URLs). Default type: `'tarteel'`.
- **Text mushafs** (tarteel→QPC v2 font, tajweed→QPC v4 font): rendered by `TartelPage.tsx` from `quran_pages_lines.json` (fetched ad-hoc there, module-level memory cache, no persistent layer!). Each page needs its own per-page `.woff` loaded via `font-cache` before render (offline + uncached ⇒ error card).
- `getMushafPath()` returns the image base URL, or `''` for text mushafs.

### 7.3 ConfigOverlay — view-based settings (the standard pattern)
All configuration UI is full-screen views inside `ConfigOverlay` (NOT modal dialogs):
```ts
export type ConfigType = 'settings'|'bookmarks'|'navigation'|'reciter'|'tafseer'
                       |'repeat'|'search'|'ayahselector';
```
- `Surah.tsx` holds `configOverlayType` state; BottomBar buttons set it; overlay's own bottom bar switches views via `onChangeView` without closing.
- Handles Android hardware back (`App.addListener('backButton')`) and ESC with in-view history.
- Views read/write settings via localStorage + `window.dispatchEvent(new CustomEvent('quran-setting-changed'))`, which `Surah.tsx` listens to for live updates.
- **To add a view:** create component in `src/components/config/`, add to `ConfigType`, add to the switch in `renderView()`, trigger from BottomBar. Follow conventions: `useLanguage()` for `t/isRTL`, emerald theme, `DialogTextSizeContext`, `cn()`.

### 7.4 Page navigation mechanics (active path)
- `useSwiperMode = true` hardcoded in `Surah.tsx` ⇒ `SwiperPageDisplay` is the renderer; `PageDisplay` is legacy/unreachable.
- Swiper v12 with **Virtual module**: 604 virtual slides, only neighbors mount; own `loadedPages` Set gates actual content (current ±2 single-mode; spread ±1 double-mode).
- Single vs double: `slidesPerView/slidesPerGroup = viewMode==='double' && !isMobile ? 2 : 1`; double mode forces odd page numbers (redirect in Surah.tsx); mobile (<768px via resize listener) forces single.
- Swipe → `onSlideChange` → `onPageChange(page)` → `Surah` does `navigate('/page/N', {replace:true})` + reloads page metadata.
- Programmatic navigation: `navigateToPage` is injected back from SwiperPageDisplay via `onSwiperReady` (stored in state, wraps `slideTo(n-1)`); used by audio-follow, navigation view, bookmarks.
- Click page image = toggle fullscreen chrome; long-press (500ms) = toast hint / ayah selection on text mushafs (with haptics).

### 7.5 i18n & numbers
- Never hardcode strings: `const { t, isRTL } = useLanguage();` — add keys to **both** `ar` and `en` in `src/i18n/translations.ts`.
- Arabic UI uses Eastern-Arabic numerals via local `formatNumber` helpers (duplicated across several files).

### 7.6 Chrome theme: `green` | `glass` (header/footer skins)
User-selectable skin for ALL header/footer chrome (main bars + fullscreen overlay cards). Persisted in `localStorage['quran-chrome-theme']` (default `'green'`); live-updated via the `quran-setting-changed` event (`key: 'quran-chrome-theme'`).
- **Picker:** Settings → العرض (Style) → `StyleSettings.tsx` row "Bar Theme / سمة الشريط" (Green أخضر / Glass زجاجي buttons).
- **Owner:** `Surah.tsx` holds `chromeTheme` state, listens for the setting event, passes `theme` prop down.
- **`green` (default):** classic look — TopBar/bottom-stack emerald gradients (`from-emerald-800 to-emerald-600`, `bg-emerald-950` dark); fullscreen cards get emerald-tinted glass (`bg-emerald-600/10` + `border-emerald-800/15`).
- **`glass`:** frosted translucent bars — TopBar `bg-[#E7E6E2]/60 backdrop-blur-md` (light) / `bg-black/40 backdrop-blur-xl` (dark) with hairline borders; text flips cream→`emerald-800` in light mode (BottomBar icons/labels likewise); fullscreen cards use pale-gray glass (`bg-[#E7E6E2]/30` + `border-[#8A8578]/25`).
- **Frosted-card layer:** `.liquid-glass-backdrop` (src/index.css) — absolutely-positioned blur+tint child (green OR glass cards both use it); cards need `relative isolate` + `-z-10` on the layer. (`.liquid-glass-edge` / `.liquid-glass-glow` were removed — edge thickness 0, no glow.)

---

## 8. Storage Architecture (know this cold)

### 8.1 Hybrid foundation: `lib/native-storage.ts`
`class NativeStorage(storeName)` — one abstraction, two backends chosen automatically:
- **Native (Capacitor):** `Directory.Data` files. `{key}.meta.json` + `{key}.blob` (base64; >5 MB written in 5MB chunks via appendFile to avoid Android OOM) or `{key}.txt`. Fast path `getFileUri(key)` + `convertFileSrc()` gives WebView-streamable `file://` URIs (no blob loading into RAM).
- **Web:** IndexedDB DB named after storeName, object store `'storage'`.
Keys are sanitized (illegal chars → `_`). Instances used:

| Store name | Used by | Content |
|---|---|---|
| `quran-data-storage` | quran-data-service | the 3 static JSONs |
| `quran-audio-cache` | audio-cache | audio blobs + timing JSONs |
| `quran-asset-cache` | asset-cache | any URL (mushaf images) keyed by sanitized URL |
| `quran-font-cache` | font-cache | per-page woffs + icon fonts |
| `quran-reciters-storage` | mp3quran-service | reciter lists per language |
| `quran-tafseer-cache` | tafseer-cache | **IndexedDB even on native** (exception!) |

### 8.2 Cache-first loading chains (memorize these patterns)
- Images (`CachedImage`): native URI → cached blob → network → cache.
- Fonts: injected `@font-face` style tags; throws `FONT_NOT_CACHED_OFFLINE` when offline+missing; `preloadAdjacentFonts(page)` warms neighbors.
- Static JSON: memory → persistent store → network (promise deduped).
- Audio: see §10.

### 8.3 localStorage keys (settings/bookmarks — small stuff)
`quran-app-language`, `quran-app-mushaf`, `quran-dark-mode`, `quran-view-mode`,
`quran-chrome-theme` (`'green'|'glass'` header/footer skin — §7.6),
`quran-dialog-text-size`, `quran-last-page`, `quran-last-reciter`,
`quran-last-mp3quran-moshaf`, `quran-audio-source`,
`quran-bookmark-bookmarks` / `quran-memorization-bookmarks` / `quran-reading-bookmarks`
(+ `-surahs|-ayahs|-surah-ids|-timestamps…` metadata twins),
`quran-selected-tafseer-id`, `quran-tafseer-surah|-ayah`.

Cross-instance sync: `useBookmarks` broadcasts `window` event **`quran-bookmarks-changed`**.

---

## 9. External Data Sources

| Source | URL | Used for |
|---|---|---|
| jsDelivr over this repo | `https://cdn.jsdelivr.net/gh/Armagdy/mushafy@master/public/assets` | page images, fonts (prod web + native) |
| EveryAyah | `https://everyayah.com/data/{folder}/{SSS}{AAA}.mp3` | per-ayah audio (source `everyayah`) |
| MP3Quran API | `https://mp3quran.net/api/v3/reciters`, `…/ayat_timing?surah=X&read=Y` | whole-surah MP3 servers `{server}{NNN}.mp3` + ms timings |
| Quran.com API v4 | `https://api.quran.com/api/v4` (`/tafsirs/{id}/by_ayah/{s}:{a}`) | primary tafseer |
| Quran-Tafseer API | `http://api.quran-tafseer.com` (HTTP!) | tafseer fallback |
| Tanzil-derived JSONs | bundled `/assets/*.json` | quran structure/text |

Reciter union schema in `reciters.json`:
- everyayah item: `{ name, nameAr, folder, quality, baseUrl, urlPattern, style, reading, source:'everyayah' }`
- mp3quran item: `{ id, name, nameAr, moshaf:[{ id, name, server, moshaf_type, surah_list }], source:'mp3quran' }`

---

## 10. Audio System (`hooks/useAudioPlayer.ts` ≈ 3,300 ln — the hardest file)

Two selectable sources, persisted in `localStorage['quran-audio-source']`, **default `'mp3quran'`**:

### A) MP3Quran mode (default) — one continuous MP3 per surah
Load tiers: ① native cached **file URI** (instant, streams from disk) → ② web cached blob URL → ③ direct network stream (`preload='metadata'`, "YouTube Music style").
Ayah positioning = seek to ms offsets from `ayat_timing` API (cached as `timing-{moshafId}-{surah}` blobs, fetched ahead-of-time). Auto-next surah if listed in `moshaf.surah_list`, else stop + notify. Default reciter id 112 / moshaf 11.

### B) EveryAyah mode — per-ayah files concatenated on the fly
Downloads missing ayahs `{SSSAAA}.mp3` (caching each individually), concatenates blobs (no re-encode) into one blob, computes `ayahTimestamps[]` by duration-probing each file. On native the concatenation is persisted (`{folder}-{surah}` key) for instant reuse. Seeking/highlighting via timestamps.

### Cross-cutting
- **Follow-along:** `timeupdate` handlers (throttled 250ms) map currentTime → ayah → if its page ≠ current page, navigate (`isAyahNavigationRef` guards loops).
- **Repeat engine (memorization):** `startRepeat()` pre-builds a fully concatenated audio with repeats baked in (everyayah: Web Audio decode → mono WAV, OOM-guarded; mp3quran: passage/range concat when timings exist). Segment tracking drives highlighting; legacy event-driven fallback exists behind `isRepeatConcatenatedMode`.
- **Media Session:** web `navigator.mediaSession` AND custom Capacitor plugin (`lib/quran-media-session.ts`, JS side `updateMetadata/updatePlaybackState`, events play/pause/next/prev/seek/stop).
- **Wake Lock** held during playback (reacquired on visibilitychange); hidden `<audio>` kept in DOM for Android notifications.
- Error mapping → `onSurahUnavailable('network-error'|'unavailable')` toasts.

### Known mismatch ⚠️
`DownloadContext` caches downloaded audio through **asset-cache (URL-keyed)** while the player reads **audio-cache (folder/id-keyed)** — audio downloaded via the Downloads view may not be found by the player (duplicate bytes). Reconcile before touching either.

---

## 11. Tafseer

`useTafseer` + `TafseerView`: primary quran.com HTTPS → fallback quran-tafseer HTTP → embedded static data. Text cached in IndexedDB (`quran-tafseer-cache`, key `{tafseerId}-{surah}-{ayah}`, HTML stripped). Edition choice persisted (`quran-selected-tafseer-id`); auto-suggested by UI language. Opened via ConfigOverlay `tafseer` view (initial surah/ayah passed via localStorage `quran-tafseer-surah/-ayah`).

---

## 12. Offline Downloads (`components/config/Download.tsx` + `DownloadContext`)

Job types: `pages` (images) | `everyayah` | `mp3quran` | `tafseer`. Parallel worker pool (concurrency: 10 imgs/fonts, 8 ayahs/tafseer, 5 MP3s), skips already-cached items (`isAssetCached/isFontCached/isTafseerCached`), progress/cancel surfaced as a single active `DownloadJob` in context. Network gate: `checkNetworkBeforeDownload()` throws `NETWORK_OFFLINE` (from `useNetwork`).

---

## 13. Dead Code & Gotchas (don't be fooled)

**Dead / superseded (safe to ignore, candidates for deletion):**
- Legacy dialogs in `src/components/quran/`: `NavigationDialog`, `SettingsDialog`, `BookmarksDialog`, `ReciterDialog`, `TafseerDialog`, `RepeatDialog`, `AyahSelectorDialog` — replaced by ConfigOverlay views. Several are still *rendered* in Surah.tsx but their open-state can never become true.
- Unrouted pages: `Index.tsx`, `Configuration.tsx` (+ `layout/FullPageLayout.tsx`); unused components `Hero/SurahList/SurahCard/SurahReader/NavLink`; duplicate `config/TestViewSettings.tsx`; empty `BackgroundDownloadIndicator.tsx`; unused hook `useNavigation.tsx`; unused singleton export in `native-storage.ts`.
- In `Test.tsx`, `TestSettingsDialog` can never open (gear button resets instead).

**Behavioral gotchas:**
1. `StyleSettings`' view-mode toggle writes `quran-view-mode`, but Surah.tsx initializes `viewMode` from window size and never reads that key — setting appears inert (BottomBar toggle works because it calls `setViewMode` directly).
2. Folder typo `mushuf_mwdoa_images` is load-bearing.
3. `mushafy.jpeg` referenced in favicon logic + SW but only `mushafy.png` exists (404).
4. Audio download key mismatch (§10).
5. `quran_pages_lines.json` bypasses `quran-data-service` (own fetch/cache in TartelPage) and has **no persistent/offline caching**.
6. `tafseer-cache` ignores the hybrid strategy (IndexedDB-only even on native).
7. Verbose `console.log` in hot paths (Surah render block, PlayBar props, CachedImage) — noise in production.
8. Dark-mode flip remounts the whole Swiper (`key={swiper-${isFullscreenDarkMode}}` in SwiperPageDisplay).
9. `formatNumber` and Arabic normalization duplicated across ≥6 files.
10. ConfigOverlay receives ~60 props from Surah.tsx — biggest refactor pressure point; prefer consuming hooks/contexts directly in views going forward.
11. Vite build strips images/fonts from `dist/` — don't expect them in preview/prod bundles; they load from CDN (dev serves locally).
12. PWA: `vite-plugin-pwa` is installed but unused; SW is hand-rolled in `public/sw.js` + manual registration in `main.tsx`.

---

## 14. Common Change Recipes

| Task | Where |
|---|---|
| Add UI string | `src/i18n/translations.ts` (both `ar` + `en`) |
| Add/alter a settings view | new file in `src/components/config/`, register in `ConfigOverlay.tsx` (`ConfigType` + `renderView` switch), trigger via `BottomBar` |
| Change page↔surah/juz math | `src/lib/quran-mapping.ts` (pure functions; respect multi-surah pages) |
| Add reciters | update `public/assets/reciters.json` (union schema §9); API lists override via mp3quran-service |
| Change chrome skin (green/glass) | `StyleSettings.tsx` picker → `quran-chrome-theme` → `Surah.tsx` `chromeTheme` → `theme` props on `TopBar`/`BottomBar` + `chromeCardClass` (§7.6) |
| Change default audio/reciter | `useAudioPlayer.ts` (~L2827 defaults; `quran-audio-source`, `quran-last-*` keys) |
| Touch caching | stores table §8.1; keep native chunked-write (>5MB) behavior intact |
| Build for Android | `npm run cap:sync && npm run cap:open` (see CAPACITOR_SETUP.md) |
| Asset URLs/CDN | `src/config/assets.ts` |

## 15. Further Reading (repo docs)

- `VIEW_ARCHITECTURE.md` — config-overlay system in depth
- `INDIVIDUAL_AYAH_PLAYBACK.md` — audio concatenation details
- `CAPACITOR_SETUP.md` / `CAPACITOR_QUICK_REF.md` — native build & publishing (incl. TWA/assetlinks)
- `STORAGE_MIGRATION.md` — hybrid storage rationale
- `TAFSEER_IMPLEMENTATION.md` — dual-API tafseer design
- `.github/copilot-instructions.md` — original AI coding conventions (two-context era; partially outdated re: mushaf types/dialogs)
