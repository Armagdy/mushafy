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
  - Bottom bar tafseer button (shows tafseer for current page's first ayah)
  - Ayah selector dialog (hover over any ayah number to see tafseer icon)
  - Surah header tafseer button
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
```

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

## 📁 Project Structure

```
src/
├── components/
│   ├── quran/           # Quran-specific components
│   │   ├── TopBar.tsx
│   │   ├── BottomBar.tsx
│   │   ├── PageDisplay.tsx
│   │   ├── PlayBar.tsx
│   │   ├── TafseerDialog.tsx     # NEW: Tafseer display
│   │   ├── AyahSelectorDialog.tsx
│   │   ├── BookmarksDialog.tsx
│   │   ├── NavigationDialog.tsx
│   │   ├── ReciterDialog.tsx
│   │   ├── RepeatDialog.tsx
│   │   └── SettingsDialog.tsx
│   └── ui/              # shadcn/ui components (auto-generated)
├── contexts/
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

### Creating New Dialogs
**IMPORTANT**: All dialogs MUST be created as separate components in `src/components/` or `src/components/quran/`:

```typescript
// src/components/quran/MyDialog.tsx
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface MyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MyDialog({ open, onOpenChange }: MyDialogProps) {
  const { t, isRTL } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "sm:max-w-md max-w-[90vw] max-h-[85vh] overflow-y-auto",
        "rounded-xl border border-emerald-500",
        isRTL ? "rtl" : "ltr"
      )}>
        <DialogTitle>{t('myDialog')}</DialogTitle>
        {/* Content */}
      </DialogContent>
    </Dialog>
  );
}
```

## 📖 Usage Guide

### Viewing Tafseer

1. **From Bottom Bar**: Click the tafseer icon (📖) to view interpretation of the first ayah on the current page
2. **From Ayah Selector**: 
   - Open ayah selector (play control)
   - Click tafseer button next to surah name for first ayah
   - Hover over any ayah number and click the small tafseer icon
3. **Change Tafseer Source**: Use the dropdown in the tafseer dialog to select different interpretations
4. **Language Support**: The app automatically suggests tafseers in your selected language

### Audio Playback
1. Click the reciter icon to select a reciter
2. Use the ayah selector to choose which verse to play
3. Configure repeat settings for memorization practice
4. Use play/pause controls in the top bar

### Bookmarking
1. Click the bookmark icon in the bottom bar
2. Select bookmark type (general/memorization/reading)
3. Manage bookmarks from the bookmarks dialog
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
