# Quran Explorer - AI Coding Guide

## Project Overview
A modern, multilingual Quranic reading web application built with Vite, React, TypeScript, and Tailwind CSS. The app features Arabic/English language switching, Surah browsing, search functionality, and offline-capable PWA support.

**Key Tech Stack:**
- **Frontend:** React 18, TypeScript, Vite (SWC transpiler)
- **Styling:** Tailwind CSS + shadcn/ui component library
- **Routing:** React Router v6
- **State Management:** React Context (Language), TanStack React Query
- **Testing:** Vitest with React Testing Library
- **Build:** Vite with PWA plugin for offline support

## Architecture Patterns

### 1. **Context-Based Language System** (`src/contexts/LanguageContext.tsx`)
- Single source of truth for all i18n: `useLanguage()` hook provides `t()` translation function, `isRTL` flag, and language state
- Persists to `localStorage` and synchronizes `document.dir` and `document.lang`
- **Pattern:** Always use `useLanguage()` in components; never hardcode text strings
- **Example:** `const { t, isRTL } = useLanguage(); <h2>{t('surahs')}</h2>`
- Add new translations to [src/i18n/translations.ts](src/i18n/translations.ts) (both `ar` and `en` objects required)
- **Numbers:** Display numbers in language-appropriate format:
  - Arabic (ar): Use Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩) via `.toLocaleString('ar-SA')`
  - English (en): Use Western Arabic numerals (0123456789) via `.toLocaleString('en-US')`
  - Create utility function or use language state to format all displayed numbers consistently

### 2. **Component Layer Architecture**
- **Page Components:** [src/pages/](src/pages/) handle routing (Index, NotFound)
- **Feature Components:** [src/components/](src/components/) (SurahList, SurahCard, SurahReader, Hero, Header, Footer)
- **UI Components:** [src/components/ui/](src/components/ui/) are shadcn/ui primitives—treat as read-only (auto-generated via CLI)
- **Data Layer:** [src/data/surahs.ts](src/data/surahs.ts) exports static Surah array; immutable reference data

### 3. **Styling & Responsive Design**
- Tailwind CSS with HSL CSS variables for theming (defined in generated CSS)
- Dark mode support via `darkMode: ["class"]` in [tailwind.config.ts](tailwind.config.ts)
- RTL-aware layouts: use `cn()` utility from [src/lib/utils.ts](src/lib/utils.ts) to conditionally apply RTL-specific classes
- Example: `cn("text-left", isRTL && "text-right")`

### 4. **Animation & Motion**
- Framer Motion for entrance/viewport animations (see [src/components/SurahList.tsx](src/components/SurahList.tsx) for `motion.div` + `whileInView` pattern)
- Use `once: true` in viewport to prevent re-animation on scroll

### 5. **Shadcn/UI Integration**
- Components are generated from shadcn registry—do NOT edit directly
- All components in [src/components/ui/](src/components/ui/) use Radix UI primitives
- Add new UI components via shadcn CLI: `npx shadcn-ui@latest add <component-name>`

## Developer Workflows

### Local Development
```bash
npm install          # Install dependencies (or `bun install`)
npm run dev          # Start Vite dev server on :8080 with HMR
npm run build        # Production build to dist/
npm run build:dev    # Development build with source maps
npm run lint         # Run ESLint across entire project
npm run test         # Run Vitest once
npm run test:watch   # Watch mode for development
npm run preview      # Preview production build locally
```

### Build System
- **Vite dev server:** Configured on `[::]:8080` with componentTagger plugin in development (Lovable integration)
- **Path alias:** `@` resolves to `src/` directory
- **Lazy loading:** React Router supports automatic code-splitting with lazy routes

## Project-Specific Conventions

### 1. **Naming Conventions**
- Components: PascalCase (e.g., `SurahCard.tsx`)
- Utility functions: camelCase (e.g., `useLanguage.ts`)
- Hooks: `use` prefix required (e.g., [src/hooks/use-toast.ts](src/hooks/use-toast.ts))
- Translation keys: camelCase in both `ar` and `en` objects

### 2. **File Structure by Feature**
- Keep related files co-located: component + its CSS/hooks in [src/components/](src/components/)
- Custom hooks in [src/hooks/](src/hooks/)
- Global utilities in [src/lib/utils.ts](src/lib/utils.ts)
- Static data in [src/data/](src/data/)

### 3. **Type Safety**
- All components must be typed (no `any` unless unavoidable)
- Export interfaces for component props in same file (e.g., `interface SurahCardProps`)
- Use TypeScript's `type` keyword for unions; `interface` for object shapes

### 4. **Search & Filtering Pattern**
- Use `useMemo` to avoid re-filtering on every render (see [src/components/SurahList.tsx](src/components/SurahList.tsx))
- Support searching by Arabic name, English name, translation, and ID

### 5. **Widget/Dialog Styling Pattern**
- **Dialog Container:** Use `DialogContent` with `sm:max-w-md max-w-[90vw] max-h-[85vh] overflow-y-auto rounded-xl border border-emerald-500` for responsive modal dialogs
- **Dialog Title:** Use `text-base sm:text-lg font-bold bg-gradient-to-r from-emerald-800 to-emerald-600 bg-clip-text text-transparent` for gradient-styled headers
- **Settings Container:** Use `space-y-2 sm:space-y-3` for vertical spacing between setting items
- **Setting Items:** Use `flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800` for individual setting containers
- **RTL Support:** Always include `${isRTL ? 'rtl' : 'ltr'}` in dialog className for proper text direction
- **Tabs Container:** Use `Tabs` with `TabsList className="grid w-full grid-cols-2"` for two-tab layouts, and `TabsContent` for tab content areas

### 6. **Bottom Bar Styling Pattern**
- **Bottom Bar Icons:** Use `w-7 h-7 md:w-8 md:h-8` for icon size without `strokeWidth` (use default stroke width, not bold)
- **Bottom Bar Text:** Use `text-base md:text-xl font-medium` for bottom bar button labels
- **Bottom Bar Container:** Use `py-2 md:py-3` for normal padding, or `py-0.5 md:py-1` when text is shown

## Integration Points

### External Dependencies
- **@radix-ui/react-\*:** Low-level accessible component primitives
- **shadcn/ui:** High-level composable components built on Radix
- **framer-motion:** Smooth animations with Tailwind integration
- **lucide-react:** Icon library (SVG-based, tree-shakable)
- **react-hook-form + zod:** Form validation (available but not currently used—follow this pattern for forms)

### Router Configuration
- Single route tree in [src/App.tsx](src/App.tsx)
- Always add custom routes **before** the catch-all `Route path="*"` (NotFound)
- Lazy load page components for code-splitting

### Data Flow
1. Static data → [src/data/surahs.ts](src/data/surahs.ts)
2. Fetch/Query logic → TanStack React Query (not currently active; ready for API integration)
3. Global state → Context API ([src/contexts/LanguageContext.tsx](src/contexts/LanguageContext.tsx))
4. Component state → `useState` for local UI state

## Testing

- **Framework:** Vitest with React Testing Library
- **Setup:** [src/test/setup.ts](src/test/setup.ts) configures testing environment
- **Patterns:** Render components, query by role/text, assert on DOM
- Run tests: `npm run test` or `npm run test:watch`

## Performance Considerations

- Surah list (~114 items) is memoized via `useMemo` with search filter
- Framer Motion animations use `once: true` viewport to prevent layout thrashing
- Dynamic imports for routes reduce initial bundle size
- PWA support (Vite PWA plugin) enables offline-first caching

## Common Tasks

| Task | How |
|------|-----|
| Add new Surah metadata | Edit [src/data/surahs.ts](src/data/surahs.ts) array |
| Add translation strings | Add keys to both `ar` and `en` in [src/i18n/translations.ts](src/i18n/translations.ts), use `useLanguage()` to access |
| Add new page/route | Create component in [src/pages/](src/pages/), add `<Route>` in [src/App.tsx](src/App.tsx) **before** catch-all |
| Style RTL-aware component | Use `const { isRTL } = useLanguage()` and conditionally apply Tailwind classes |
| Add UI component | Run `npx shadcn-ui@latest add <name>` to scaffold from registry |
| Update theme colors | Modify CSS variables in generated theme file (Tailwind extends from `hsl(var(...))`) |

## Lovable-Specific Notes

- Project uses **Lovable** for AI-assisted development ([Lovable.dev](https://lovable.dev/))
- Component Tagger plugin active in dev mode (auto-tags UI components)
- GitHub integration: changes push automatically; manual edits sync back
- Always test locally with `npm run dev` before committing
