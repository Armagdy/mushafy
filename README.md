# Mushafy - مصحفي

A modern, multilingual Quranic reading web application with comprehensive features for reading, listening, and studying the Holy Quran.

## ✨ Features

### 📖 Reading Experience
- **Multiple Mushaf Types**: Switch between three beautiful Mushaf styles:
  - Mwdoa (Colored Thematic) - موضوعى ملون
  - Tashel (Easy Memorization) - الحفظ الميسر
  - Madinah Mushaf - مصحف المدينة
- **Dual Page View**: Read with traditional book-like double-page layout on larger screens
- **Single Page Mode**: Optimized mobile reading experience
- **RTL/LTR Support**: Full Arabic and English language support with proper text direction

### 🎧 Audio Features
- **Multiple Reciters**: Choose from various renowned Quran reciters
- **Reciter Filters**: Filter by reciter name, reading type (Hafs/Warsh), style (Murattal/Mujawwad), and quality
- **Ayah-by-Ayah Playback**: Listen to individual verses with highlighting
- **Repeat Mode**: Configure custom repeat settings for memorization:
  - Repeat entire passages multiple times
  - Repeat each ayah individually
  - Set custom start and end points
- **⚡ Native Performance Optimization**: On Android, cached audio loads instantly (<100ms) using file URIs instead of loading into memory (50x faster than blob loading for large files)

### 🔖 Bookmark System
- **Multiple Bookmark Types**:
  - General bookmarks (amber)
  - Memorization bookmarks (green)
  - Reading bookmarks (blue)
- **Visual Indicators**: Color-coded bookmark icons on pages
- **Bookmark Management**: Add, remove, and organize bookmarks by type

### 📚 Tafseer
- **20+ Tafseer Sources**: Access comprehensive authentic Quran interpretations via Quran.com API:
  - **Arabic Tafseers**: التفسير الميسر, تفسير الجلالين, تفسير ابن كثير, تفسير الطبري, تفسير القرطبي, تفسير السعدي, تفسير البغوي, تفسير الوسيط لطنطاوي
  - **English Tafseers**: Arberry, Yusuf Ali, and more
  - **Additional Languages**: Bengali, Urdu, Russian, Turkish, Indonesian, and many others
- **Reliable Dual API System**: 
  - Primary: Quran.com API (HTTPS, 20+ tafseers)
  - Fallback: Original Tafseer API for reliability
  - Embedded static data for offline resilience
- **Easy Access**: View tafseer via:
  - Configuration page tafseer view
  - Ayah selector (legacy component with tafseer icons)
- **Language-Based Selection**: Auto-selects appropriate tafseer based on interface language
- **Persistent Selection**: Your tafseer choice is saved for future sessions
- **Rich Display**: Beautiful, readable tafseer presentation with:
  - Tafseer name and author
  - Book reference
  - Proper Arabic/English typography
  - Automatic HTML formatting support

### 🔍 Navigation
- **Quick Navigation**: Jump to any:
  - Surah (chapter)
  - Juz (part)
  - Page
  - Hizb (half-part)
  - Quarter
  - Specific Ayah
- **Word Search**: Search for specific words across the entire Quran
- **Ayah Selector**: Grid-based ayah selection with visual feedback

### ⚙️ Settings
- **View Mode Toggle**: Switch between single and double-page view
- **Bottom Bar Customization**: Show/hide text labels on bottom toolbar
- **Page Loading**: Configure number of pages to preload
- **Language Switch**: Toggle between Arabic and English interface
- **Mushaf Type Selection**: Change between different Mushaf styles

## ⚡ Performance & Optimization

### Native Android Optimizations
- **Instant Audio Loading**: Cached audio files (including large 32MB surahs) load in <100ms using native file URIs
- **Zero Memory Overhead**: Audio streams directly from disk without loading into RAM
- **50x Faster Seeking**: Progress bar dragging is instant compared to blob-based loading
- **Unlimited Storage**: Uses native filesystem instead of browser storage quotas
- **Image Caching**: Mushaf page images also benefit from file URI optimization
- **Chunked File Writing**: Large audio files (125MB+) written in 5MB chunks to prevent OutOfMemoryError on Android

### Technical Details
- **File URI System**: Uses Capacitor's `Filesystem.getUri()` and `convertFileSrc()` for WebView-compatible direct file access
- **Chunked Blob Processing**: Splits large blobs into 5MB chunks during base64 conversion to stay within 256MB heap limit
- **Dual-Mode Architecture**: Automatically uses file URIs on native platforms, falls back to blob loading on web
- **Smart Caching**: Separate caching strategies for audio (individual ayahs) and images (mushaf pages)

*See [INDIVIDUAL_AYAH_PLAYBACK.md](INDIVIDUAL_AYAH_PLAYBACK.md) for detailed technical documentation*

## 🎨 View-Based Configuration Architecture

### Overview
The application uses a **View-based architecture** instead of traditional modal dialogs for all configuration screens. This provides:
- ✅ **Consistent UX**: Full-screen immersive experience on mobile devices
- ✅ **Better Performance**: No backdrop/overlay rendering overhead
- ✅ **Seamless Navigation**: Built-in bottom bar for switching between views
- ✅ **Maintainability**: Each view is a self-contained component
- ✅ **Mobile-First**: Optimized for touch interactions and small screens

### Architecture Components

#### ConfigOverlay (`src/components/config/ConfigOverlay.tsx`)
The main container that manages all configuration views:
- **Full-screen overlay**: Covers the entire viewport without changing the URL
- **Persistent header**: Consistent emerald gradient header with back button
- **Bottom navigation bar**: Quick access to all configuration views
- **View switching**: Seamlessly transitions between different views
- **State preservation**: Maintains parent state while switching views

#### View Components (`src/components/config/`)
Modular, self-contained configuration panels:

| View Component | Purpose | Key Features |
|---------------|---------|--------------|
| **SettingsView** | App settings & preferences | Language, Mushaf type, view mode, page loading |
| **BookmarksView** | Bookmark management | Three bookmark types (general, memorization, reading), color-coded tabs |
| **NavigationView** | Jump to location | Navigate by Surah, Juz, Page, Hizb, Quarter, or specific Ayah |
| **SearchView** | Word search | Search Quran text with highlighting and results list |
| **ReciterView** | Audio settings | Choose reciter, filter by reading/style/quality, audio source selection |
| **TafseerView** | Tafseer settings | Select from 20+ tafseer sources in multiple languages |
| **RepeatView** | Repeat configuration | Set passage/ayah repeat counts for memorization |

### Design Principles

#### 1. No Modal Dialogs for Configuration
❌ **Old Approach** (Deprecated):
```tsx
// Legacy Dialog components (no longer used)
<NavigationDialog open={open} onOpenChange={setOpen} />
<SettingsDialog open={open} onOpenChange={setOpen} />
```

✅ **New Approach** (Current):
```tsx
// ConfigOverlay with View components
<ConfigOverlay
  type="navigation"  // or 'settings', 'bookmarks', etc.
  onClose={() => setConfigOverlayType(null)}
  onChangeView={(view) => setConfigOverlayType(view)}
/>
```

#### 2. Consistent Styling
All view components follow standardized styling patterns:
- **Colors**: Emerald theme (`emerald-700`, `emerald-800`) with cream text (`#F2E3BB`)
- **Typography**: Responsive text sizing via `DialogTextSizeContext` (`text-base md:text-xl`)
- **Spacing**: Consistent padding (`p-4`) and vertical spacing (`space-y-2 sm:space-y-3`)
- **Buttons**: Solid emerald background with rounded corners and shadows
- **Tabs**: Emerald background with active state highlighting
- **Inputs**: Emerald borders with focus ring states

#### 3. RTL/LTR Support
All views automatically adapt to language direction:
```tsx
const { t, isRTL } = useLanguage();
<div className={cn("space-y-3", isRTL ? "rtl" : "ltr")}>
```

#### 4. Responsive Text Sizing
Views use centralized text sizing for consistency:
```tsx
const { dialogTextSize } = useDialogTextSize();
const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
<Label className={textSizeClasses.label}>{t('label')}</Label>
```

### Usage Example

```tsx
// In parent component (e.g., Surah.tsx)
const [configOverlayType, setConfigOverlayType] = useState<ConfigType | null>(null);

// Trigger view from bottom bar
<BottomBar
  onSettingsClick={() => setConfigOverlayType('settings')}
  onBookmarkClick={() => setConfigOverlayType('bookmarks')}
  onGoToClick={() => setConfigOverlayType('navigation')}
/>

// Render overlay conditionally
{configOverlayType && (
  <ConfigOverlay
    type={configOverlayType}
    onClose={() => setConfigOverlayType(null)}
    onChangeView={(view) => setConfigOverlayType(view)}
    // ... other props
  />
)}
```

### Migration from Dialogs

**Legacy Dialog components** (in `src/components/quran/`) are deprecated and should not be used for new features:
- ❌ `NavigationDialog.tsx`
- ❌ `SettingsDialog.tsx`
- ❌ `BookmarksDialog.tsx`
- ❌ `ReciterDialog.tsx`
- ❌ `TafseerDialog.tsx`

**Why the migration?**
- Dialogs felt cramped on mobile devices
- Modal backdrops reduced visibility of Quran pages
- No easy way to switch between related configuration screens
- Inconsistent UX across different settings
- Difficult to maintain state when switching between dialogs

**View components** (in `src/components/config/`) are the current standard:
- ✅ Full-screen immersive experience
- ✅ Integrated navigation between views
- ✅ Consistent styling and behavior
- ✅ Better mobile UX

### Adding a New View

To add a new configuration view:

1. **Create view component** in `src/components/config/NewFeatureView.tsx`:
```tsx
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { cn } from "@/lib/utils";

interface NewFeatureViewProps {
  onClose: () => void;
  // ... other props
}

export default function NewFeatureView({ onClose }: NewFeatureViewProps) {
  const { t, isRTL } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  
  return (
    <div className={cn("p-4 space-y-2 sm:space-y-3", isRTL ? "rtl" : "ltr")}>
      {/* View content */}
    </div>
  );
}
```

2. **Add to ConfigType** in `ConfigOverlay.tsx`:
```tsx
export type ConfigType = 'settings' | 'bookmarks' | 'navigation' | 'newfeature';
```

3. **Add to renderView()** switch statement:
```tsx
case 'newfeature':
  return <NewFeatureView onClose={onClose} />;
```

4. **Add button to BottomBar** or other trigger point:
```tsx
<Button onClick={() => setConfigOverlayType('newfeature')}>
  {t('newFeature')}
</Button>
```

📚 **Full documentation**: See [VIEW_ARCHITECTURE.md](./VIEW_ARCHITECTURE.md) for complete technical details, migration guide, and best practices.

## 🛠️ Technical Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with SWC transpiler
- **Styling**: Tailwind CSS + shadcn/ui components (Radix primitives)
- **Routing**: React Router v6
- **State Management**: React Context API (Language & Mushaf contexts)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Testing**: Vitest + React Testing Library
- **PWA Support**: Offline-capable Progressive Web App
- **Configuration UI**: View-based architecture (not modal dialogs)

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or bun

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd mushafy

# Install dependencies
npm install
# or
bun install

# Start development server
npm run dev
# or
bun run dev
```

The application will be available at `http://localhost:8080`

### Available Scripts

```sh
npm run dev          # Start development server with HMR
npm run build        # Production build to dist/
npm run build:dev    # Development build with source maps
npm run lint         # Run ESLint
npm run test         # Run Vitest once
npm run test:watch   # Run Vitest in watch mode
npm run preview      # Preview production build
npm run deploy       # Deploy to GitHub Pages (requires gh-pages package)

# Capacitor (Native Android App)
npm run cap:sync     # Sync web assets to native platform
npm run cap:run      # Build and run on Android device
npm run cap:open     # Open Android project in Android Studio
```

## 📱 Native Android App (NEW!)

This PWA can now be built as a **native Android app** using Capacitor, giving you:

- ✅ **Unlimited storage** (no browser quotas)
- ✅ **Native filesystem** (faster than IndexedDB)
- ✅ **Google Play Store distribution**
- ✅ **Better offline performance**
- ✅ **Background audio support**

### Quick Start

```bash
# Build web assets
npm run build

# Sync to Android project
npm run cap:sync

# Open in Android Studio
npm run cap:open
```

📚 **Full documentation**: See [CAPACITOR_SETUP.md](./CAPACITOR_SETUP.md) for complete setup, configuration, and publishing guide.

### Platform Detection

The app automatically detects whether it's running as:
- Native Android app → Uses native filesystem
- Web browser → Falls back to IndexedDB

No code changes needed - storage switches automatically!

## 🚀 Deployment

### GitHub Pages

This project is configured for automatic deployment to GitHub Pages. The site is available at: **https://armagdy.github.io/mushafy/**

#### Automatic Deployment

Every push to the `main` branch automatically triggers a GitHub Actions workflow that:
1. Builds the project
2. Deploys it to GitHub Pages

No manual intervention is needed!

#### Manual Deployment

If you prefer to deploy manually:

1. Install gh-pages package:
```sh
npm install --save-dev gh-pages
```

2. Run the deploy command:
```sh
npm run deploy
```

#### Configuration

The following files configure GitHub Pages deployment:

- **vite.config.ts**: Sets `base: "/mushafy/"` for correct asset paths
- **.github/workflows/deploy.yml**: GitHub Actions workflow for automatic deployment
- **public/.nojekyll**: Prevents GitHub from processing the site with Jekyll

#### Enabling GitHub Pages

If this is a new repository, enable GitHub Pages:

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Pages**
3. Under **Source**, select **GitHub Actions**
4. The site will be deployed automatically on the next push

### Vercel Deployment (Recommended for Android TWA)

For Android Trusted Web Activity (TWA) apps, **Vercel is recommended** over GitHub Pages because:
- GitHub Pages serves projects at subdirectories (e.g., `username.github.io/repo/`)
- Android Digital Asset Links verification requires `assetlinks.json` at the **domain root** (`/.well-known/assetlinks.json`)
- Vercel serves your app at the root domain, making TWA verification work seamlessly

#### Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Deploy (Vercel auto-detects Vite configuration)
4. Your app will be available at `https://your-project.vercel.app/`

### Android TWA (Trusted Web Activity)

To create an Android APK that runs your PWA without the browser URL bar:

#### Step 1: Generate APK with PWABuilder

1. Go to [PWABuilder.com](https://pwabuilder.com)
2. Enter your Vercel URL (e.g., `https://mushafy-beryl.vercel.app/`)
3. Click **"Package for Stores"** → **"Android"**
4. Download the package (contains APK and `assetlinks.json`)
5. **Save the `signing.keystore` file** - you need it for future builds to keep the same fingerprint

#### Step 2: Configure Digital Asset Links

1. Extract `assetlinks.json` from the downloaded package
2. Copy it to your project: `public/.well-known/assetlinks.json`
3. The file contains your app's package name and signing certificate fingerprint:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "app.vercel.your_project.twa",
    "sha256_cert_fingerprints": ["YOUR:FINGERPRINT:HERE"]
  }
}]
```

4. Deploy to Vercel
5. Verify the file is accessible: `https://your-domain/.well-known/assetlinks.json`

#### Step 3: Install and Test

1. **Uninstall** any previous version of the app
2. Install the new APK on your Android device
3. Open the app and wait 10-15 seconds (Android verifies the Digital Asset Link)
4. The URL bar should now be hidden!

#### Troubleshooting TWA (Removing Browser Address Bar)

If you're seeing a browser address bar in your PWA Android app, follow these steps based on [PWABuilder's Asset Links FAQ](https://docs.pwabuilder.com/#/builder/asset-links-faq):

> **Note:** A "Chrome is in use" banner on first run is expected and doesn't indicate broken asset links. The issue is only when the browser address bar persists.

##### 1. Validate Location

Your `assetlinks.json` must be at the **domain root**, not the app root:
- ✅ Correct: `https://your-domain/.well-known/assetlinks.json`
- ❌ Wrong: `https://your-domain/app-path/.well-known/assetlinks.json`

##### 2. Add Google Play's Production Fingerprint

When publishing to Google Play, add their signing fingerprint to your `assetlinks.json`:

1. Login to [Google Play Console](https://developer.android.com/distribute/console)
2. Select your app → **Setup** → **App integrity**
3. Copy the **SHA-256 fingerprint**
4. Add it to your `assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "app.vercel.your_project.twa",
    "sha256_cert_fingerprints": [
      "YOUR:ORIGINAL:FINGERPRINT:HERE",
      "GOOGLE:PLAY:FINGERPRINT:HERE"
    ]
  }
}]
```

##### 3. Fix Incorrect Fingerprints with Asset Links Tool

If the address bar persists, Android may have different fingerprints than your file:

1. Install your app on an Android device/emulator
2. Install the [Asset Links Tool](https://play.google.com/store/apps/details?id=dev.conn.assetlinkstool) from Google Play
3. Run the tool and search for your package ID (e.g., `app.vercel.mushafy_beryl.twa`)
4. Tap your app to view its asset links, then tap **Copy Signature**
5. Paste the fingerprint into your `assetlinks.json`

> **Important:** Ensure fingerprints are comma-separated. [Validate your JSON](https://jsonformatter.curiousconcept.com/) before deploying.

##### 4. Check Redirects

Redirects across origins break asset link verification:

- If `https://myapp.com` redirects to `https://www.myapp.com`, generate your APK using the **final redirect URL** (`www.myapp.com`)
- Use the canonical URL that users land on after all redirects

##### 5. Clear Browser Cache

If you previously installed the PWA, the old `assetlinks.json` may be cached:

1. **Uninstall** the app completely
2. Go to **Settings** → **Apps** → **Chrome** → **Clear Cache**
3. Reinstall the app

##### Additional Resources

- **Verify Configuration**: [Google's Digital Asset Links Tool](https://developers.google.com/digital-asset-links/tools/generator)
- **PWABuilder Docs**: [Asset Links FAQ](https://docs.pwabuilder.com/#/builder/asset-links-faq)
- **Debug Issue**: [Bubblewrap GitHub Issue #310](https://github.com/GoogleChromeLabs/bubblewrap/issues/310#issuecomment-685505871)

## 📁 Project Structure

```
src/
├── components/
│   ├── config/          # Configuration view components
│   │   ├── BookmarksView.tsx
│   │   ├── NavigationView.tsx
│   │   ├── ReciterView.tsx
│   │   ├── RepeatView.tsx
│   │   ├── SettingsView.tsx
│   │   └── TafseerView.tsx
│   ├── quran/           # Quran-specific components
│   │   ├── TopBar.tsx
│   │   ├── BottomBar.tsx
│   │   ├── PageDisplay.tsx
│   │   ├── PlayBar.tsx
│   │   └── AyahSelectorDialog.tsx  # Legacy dialog (use Views for new features)
│   └── ui/              # shadcn/ui components (auto-generated)
├── contexts/
│   ├── DialogTextSizeContext.tsx
│   ├── LanguageContext.tsx
│   └── MushafContext.tsx
├── hooks/
│   ├── useAudioPlayer.ts
│   ├── useBookmarks.ts
│   ├── useQuranData.ts
│   ├── useTafseer.ts         # NEW: Tafseer data management
│   └── useNavigation.tsx
├── data/
│   └── surahs.ts          # Static Surah metadata
├── i18n/
│   └── translations.ts    # Arabic/English translations
├── lib/
│   ├── quran-mapping.ts   # Page/Surah/Ayah mapping utilities
│   └── utils.ts          # General utilities
└── pages/
    ├── Index.tsx
    ├── Surah.tsx          # Main Quran reader page
    └── NotFound.tsx
```

## 🌐 API Integration

### Tafseer API
This application uses a **dual API strategy** for maximum reliability and content:

#### Primary API: Quran.com
- **Base URL**: `https://api.quran.com/api/v4`
- **Features**: 20+ tafseers, HTTPS, multiple languages (Arabic, English, Bengali, Urdu, Russian, Turkish, Indonesian, etc.)
- **Endpoints**:
  - `GET /resources/tafsirs?language={language}` - List available tafseers by language
  - `GET /tafsirs/{tafseer_id}/by_ayah/{surah}:{ayah}` - Get tafseer for specific ayah
- **Documentation**: [Quran.com API Docs](https://api-docs.quran.com/)

#### Fallback API: Quran Tafseer API
- **Base URL**: `http://api.quran-tafseer.com`
- **Features**: 10+ core tafseers, HTTP-only
- **GitHub**: [Quran-Tafseer/tafseer_api](https://github.com/Quran-Tafseer/tafseer_api)
- **Endpoints**:
  - `GET /tafseer` - List available tafseers
  - `GET /tafseer/{tafseer_id}/{surah}/{ayah}` - Get tafseer for specific ayah

#### Fallback Strategy
1. **First Attempt**: Quran.com API (HTTPS, more content)
2. **Fallback**: Original Tafseer API (HTTP)
3. **Final Fallback**: Embedded static data (10 core tafseers)

## 🎨 Customization

### Adding New Translations
Edit `src/i18n/translations.ts`:
```typescript
export const translations = {
  ar: {
    // Add Arabic keys
  },
  en: {
    // Add English keys
  }
};
```

### Creating New Views
**IMPORTANT**: All views MUST be created as separate components in `src/components/config/`:

```typescript
// src/components/config/MyView.tsx
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { cn } from "@/lib/utils";

interface MyViewProps {
  // Props for data and callbacks
}

export default function MyView(props: MyViewProps) {
  const { t, isRTL } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  
  return (
    <div className={cn(
      "p-4 space-y-2 sm:space-y-3",
      isRTL ? "rtl" : "ltr"
    )}>
      {/* View content - uses Tabs, forms, lists, etc. */}
    </div>
  );
}
```

**Note**: Legacy Dialog components exist in `src/components/quran/` but new features should use View components.

## � Technical Documentation

Comprehensive technical documentation is available for key architectural components:

| Document | Description |
|----------|-------------|
| [VIEW_ARCHITECTURE.md](VIEW_ARCHITECTURE.md) | **View-based configuration system** - Complete guide to the overlay architecture that replaces modal dialogs, including component structure, styling standards, and migration guide |
| [INDIVIDUAL_AYAH_PLAYBACK.md](INDIVIDUAL_AYAH_PLAYBACK.md) | **Audio concatenation strategy** - Technical details on how individual ayah files are concatenated for seamless playback and mobile optimization |
| [CAPACITOR_SETUP.md](CAPACITOR_SETUP.md) | **Native Android app setup** - Complete guide for building and deploying the app as a native Android application using Capacitor |
| [CAPACITOR_QUICK_REF.md](CAPACITOR_QUICK_REF.md) | **Capacitor command reference** - Quick reference for common Capacitor development commands |
| [STORAGE_MIGRATION.md](STORAGE_MIGRATION.md) | **Native storage migration** - Details on the hybrid storage system that uses native filesystem on Android and IndexedDB on web |
| [TAFSEER_IMPLEMENTATION.md](TAFSEER_IMPLEMENTATION.md) | **Tafseer system** - Implementation details for the dual-API tafseer system with 20+ sources |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | **AI coding guide** - Comprehensive project guidelines for AI-assisted development, architectural patterns, and code standards |

## �📖 Usage Guide

### Viewing Tafseer

1. **From Configuration**: Navigate to tafseer view to browse interpretations by surah and ayah
2. **Change Tafseer Source**: Use the dropdown in the tafseer view to select different interpretations
3. **Language Support**: The app automatically suggests tafseers in your selected language

### Audio Playback
1. Click the reciter icon to select a reciter
2. Use the ayah selector to choose which verse to play
3. Configure repeat settings for memorization practice
4. Use play/pause controls in the top bar

### Bookmarking
1. Click the bookmark icon in the bottom bar
2. Select bookmark type (general/memorization/reading)
3. Manage bookmarks from the configuration page
4. Visual indicators appear on bookmarked pages

## 🤝 Contributing

This project follows strict architectural guidelines. Please review `copilot-instructions.md` before contributing.

## 📄 License

[Add your license here]

## 🙏 Acknowledgments

- Quran text and metadata from Tanzil.net
- Primary tafseer data from [Quran.com API](https://quran.com)
- Fallback tafseer data from [Quran Tafseer API](https://github.com/Quran-Tafseer/tafseer_api)
- Audio from EveryAyah.com
- Mushaf images from various authentic sources

## 📞 Support

For issues and feature requests, please use the GitHub issue tracker.

---

Made with ❤️ for القرآن الكريم
