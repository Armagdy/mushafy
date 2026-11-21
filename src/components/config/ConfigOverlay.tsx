import { useLanguage } from "@/contexts/LanguageContext";
import { useDarkMode } from "@/contexts/DarkModeContext";
import { useBookmarks } from "@/hooks/useBookmarks";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from "framer-motion";
import { useViewSwipe } from "@/hooks/useViewSwipe";

// Import different configuration views
import SettingsView from "@/components/config/SettingsView";
import BookmarksView from "@/components/config/BookmarksView";
import NavigationView from "@/components/config/NavigationView";
import ReciterView from "@/components/config/ReciterView";
import TafseerView from "@/components/config/TafseerView";
import RepeatView from "@/components/config/RepeatView";
import SearchView from "@/components/config/SearchView";
import AyahSelectorView from "@/components/config/AyahSelectorView";
import { BottomBar } from "@/components/quran/BottomBar";

export type ConfigType = 'settings' | 'bookmarks' | 'navigation' | 'reciter' | 'tafseer' | 'repeat' | 'search' | 'ayahselector';

/**
 * Visual order of the bottom-bar views - used to pick the horizontal
 * slide direction when switching between them (ViewPager-style).
 */
const VIEW_ORDER: ConfigType[] = [
  'navigation', 'search', 'tafseer', 'bookmarks', 'settings',
  'reciter', 'repeat', 'ayahselector',
];

/** Views reachable by swiping - the five bottom-bar destinations. */
const BAR_VIEWS: ConfigType[] = ['navigation', 'search', 'tafseer', 'bookmarks', 'settings'];

/** Horizontal slide variants - "enter" comes from the side we move toward.
 *  Exiting views get pointer-events: none so a lingering/interrupted exit
 *  can never swallow taps meant for the incoming view. */
const viewVariants = {
  enter: (dir: number) => ({
    x: dir === 0 ? '0%' : `${dir * 100}%`,
    opacity: dir === 0 ? 0 : 1,
  }),
  center: { x: '0%', opacity: 1 },
  exit: (dir: number) => ({
    x: dir === 0 ? '0%' : `${-dir * 100}%`,
    opacity: dir === 0 ? 0 : 1,
    pointerEvents: 'none',
  }),
};

interface ConfigOverlayProps {
  type: ConfigType;
  onClose: () => void;
  /**
   * Desktop chrome width (px) — the SAME measured width the reader's
   * top/bottom bars use (width occupied by the displayed pages, two-page
   * spread at most). The overlay's header panel, content column, and
   * bottom bar all use it so the settings sheet matches the default page
   * exactly. Undefined on phones (full width, as before).
   */
  chromeMaxWidthPx?: number;
  currentPage: number;
  currentSurahId: number;
  currentPlayingAyah: { surah: number; ayah: number } | null;
  onNavigate: (page: number, ayah?: { surah: number; ayah: number }) => void;
  viewMode: 'single' | 'double';
  onViewModeToggle: () => void;
  showBottomBarText: boolean;
  isMobile: boolean;
  initialNavigationType?: 'surah' | 'juz' | 'page';
  initialNavigationSurah?: number;
  initialNavigationJuz?: number;
  initialNavigationPage?: number;
  initialBookmarkCategory?: string | null;
  
  // Audio player props for ReciterView
  audioSource: 'everyayah' | 'mp3quran';
  onAudioSourceChange: (source: 'everyayah' | 'mp3quran') => void;
  selectedReciter: any;
  filteredReciters: any[];
  uniqueReciterNames: any[];
  filterReciterName: string;
  filterReading: string;
  filterStyle: string;
  filterQuality: string;
  availableReadings: string[];
  availableStyles: string[];
  availableQualities: string[];
  onFilterReciterNameChange: (value: string) => void;
  onFilterReadingChange: (value: string) => void;
  onFilterStyleChange: (value: string) => void;
  onFilterQualityChange: (value: string) => void;
  mp3QuranReciters: any[];
  mp3QuranRecitersAr: any[];
  selectedMp3QuranReciter: any;
  selectedMoshaf: any;
  onMp3QuranReciterChange: (reciter: any) => void;
  onMoshafChange: (moshaf: any) => void;
  onReciterListen: () => void;
  onReciterNavigateToSurah: (surahId: number) => Promise<void>;
  onStopAudio: () => void;
  
  // Repeat props
  ayahData: any[];
  repeatStartSurah: number;
  repeatStartAyah: number;
  repeatEndSurah: number;
  repeatEndAyah: number;
  repeatPassageCount: number;
  repeatAyahCount: number;
  hasAyahTimings?: boolean;
  onRepeatStartSurahChange: (value: number) => void;
  onRepeatStartAyahChange: (value: number) => void;
  onRepeatEndSurahChange: (value: number) => void;
  onRepeatEndAyahChange: (value: number) => void;
  onRepeatPassageCountChange: (value: number) => void;
  onRepeatAyahCountChange: (value: number) => void;
  onStartRepeat: () => void;
  
  // Ayah selector props
  secondPageNum: number;
  isAyahNavigationRef: React.MutableRefObject<boolean>;
  onPlayAyah: (surahNum: number, ayahNum: number) => void;
  onSetCurrentPlayingAyah: (ayah: { surah: number; ayah: number }) => void;
  onSeekToAyahPosition: (surahNum: number, ayahNum: number) => void;
}

/**
 * ConfigOverlay - Full-screen overlay for all configuration views
 * Appears on top of the Surah view without changing the URL
 */
export default function ConfigOverlay({
  type,
  onClose,
  chromeMaxWidthPx,
  currentPage,
  currentSurahId,
  currentPlayingAyah,
  onNavigate,
  viewMode,
  onViewModeToggle,
  showBottomBarText,
  isMobile,
  initialNavigationType,
  initialNavigationSurah,
  initialNavigationJuz,
  initialNavigationPage,
  initialBookmarkCategory,
  audioSource,
  onAudioSourceChange,
  selectedReciter,
  filteredReciters,
  uniqueReciterNames,
  filterReciterName,
  filterReading,
  filterStyle,
  filterQuality,
  availableReadings,
  availableStyles,
  availableQualities,
  onFilterReciterNameChange,
  onFilterReadingChange,
  onFilterStyleChange,
  onFilterQualityChange,
  mp3QuranReciters,
  mp3QuranRecitersAr,
  selectedMp3QuranReciter,
  selectedMoshaf,
  onMp3QuranReciterChange,
  onMoshafChange,
  onReciterListen,
  onReciterNavigateToSurah,
  onStopAudio,
  ayahData,
  repeatStartSurah,
  repeatStartAyah,
  repeatEndSurah,
  repeatEndAyah,
  repeatPassageCount,
  repeatAyahCount,
  hasAyahTimings,
  onRepeatStartSurahChange,
  onRepeatStartAyahChange,
  onRepeatEndSurahChange,
  onRepeatEndAyahChange,
  onRepeatPassageCountChange,
  onRepeatAyahCountChange,
  onStartRepeat,
  secondPageNum,
  isAyahNavigationRef,
  onPlayAyah,
  onSetCurrentPlayingAyah,
  onSeekToAyahPosition,
}: ConfigOverlayProps) {
  const { t, language, isRTL } = useLanguage();
  const { isDarkMode } = useDarkMode();
  const [searchParams, setSearchParams] = useSearchParams();

  // The overlay owns the active view while it is open. Switching views
  // (bottom-bar taps and swipes) only updates this local state, so the
  // heavy Surah page behind this overlay never re-renders mid-slide —
  // that full-tree re-render (mushaf Swiper, TopBar, PlayBar...) was the
  // main cause of the view-switch jank on Android. The `type` prop seeds
  // this state when the parent opens the overlay; the parent only ever
  // needs to know whether the overlay is open, not which view shows.
  const [activeView, setActiveView] = useState<ConfigType>(type);
  useEffect(() => {
    setActiveView(type);
  }, [type]);

  // Track the previous view to compute the horizontal slide direction.
  // Moving forward through the bottom bar slides content in from the end
  // side (mirrored in RTL); same/unknown pairs just cross-fade.
  const prevTypeRef = useRef<ConfigType>(activeView);
  const computeSlideDirection = (next: ConfigType, prev: ConfigType): number => {
    const nextIdx = VIEW_ORDER.indexOf(next);
    const prevIdx = VIEW_ORDER.indexOf(prev);
    if (nextIdx === -1 || prevIdx === -1 || nextIdx === prevIdx) return 0;
    const forward = nextIdx > prevIdx ? 1 : -1;
    return isRTL ? -forward : forward;
  };
  const slideDirection = computeSlideDirection(activeView, prevTypeRef.current);
  prevTypeRef.current = activeView;

  // Swipe between bottom-bar views (ViewPager gesture).
  // Disabled while a sub-screen is open (settings category, bookmarks
  // add/update, navigation type...) so scrolling inside those screens
  // can never be mistaken for a view switch. Tafseer is excluded too:
  // its ayah cards already own a horizontal drag.
  const hasActiveSubView = (): boolean => {
    if (activeView === 'settings' && searchParams.get('category')) return true;
    if (activeView === 'navigation' && searchParams.get('type')) return true;
    if (activeView === 'bookmarks' && searchParams.get('category')) return true;
    return false;
  };
  const swipeHandlers = useViewSwipe((dir) => {
    if (hasActiveSubView() || activeView === 'tafseer' || !BAR_VIEWS.includes(activeView)) return;
    const idx = BAR_VIEWS.indexOf(activeView);
    // Forward = next item in the bar; physical direction mirrors in RTL
    const forward = isRTL ? dir === 'right' : dir === 'left';
    const nextIdx = forward ? idx + 1 : idx - 1;
    if (nextIdx >= 0 && nextIdx < BAR_VIEWS.length) {
      setActiveView(BAR_VIEWS[nextIdx]);
    }
  });

  // Chrome theme ('green' | 'glass') — read on mount, live-updated from settings
  const [chromeTheme, setChromeTheme] = useState<'green' | 'glass'>(() => {
    const saved = localStorage.getItem('quran-chrome-theme');
    return saved === 'glass' ? 'glass' : 'green';
  });

  useEffect(() => {
    const handleSettingChange = (event: Event) => {
      const { key, value } = (event as CustomEvent).detail || {};
      if (key === 'quran-chrome-theme') {
        setChromeTheme(value === 'glass' ? 'glass' : 'green');
      }
    };
    window.addEventListener('quran-setting-changed', handleSettingChange);
    return () => {
      window.removeEventListener('quran-setting-changed', handleSettingChange);
    };
  }, []);

  const isGlassLight = chromeTheme === 'glass' && !isDarkMode;
  
  // Get bookmarks data
  const {
    bookmarks,
    memorizationBookmarks,
    readingBookmarks,
    bookmarkPageSurahs,
    bookmarkPageAyahs,
    bookmarkPageSurahIds,
    bookmarkTimestamps,
    memorizationTimestamps,
    readingTimestamps,
    toggleBookmark,
    removeMemorizationBookmark,
    removeReadingBookmark,
    addBookmarkByType,
    updateBookmark,
    touchBookmark,
    getTotalBookmarks,
  } = useBookmarks(language);
  
  // Returns true if the current view has an active sub-page, and clears it
  const goBackInView = (): boolean => {
    if (activeView === 'settings' && searchParams.get('category')) {
      setSearchParams({});
      return true;
    }
    if (activeView === 'navigation' && searchParams.get('type')) {
      setSearchParams({});
      return true;
    }
    if (activeView === 'bookmarks' && searchParams.get('category')) {
      setSearchParams({});
      return true;
    }
    return false;
  };

  // Tapping the bottom-bar button of the view you're already in closes the
  // whole overlay — even from a sub-screen (settings category, navigation
  // type, bookmarks add/update...) — instead of reopening the view's
  // default page. Tapping another bar button switches views locally (no
  // parent re-render), clearing any sub-screen URL params so the incoming
  // view never inherits a stale `category`/`type` param.
  const closeIfActive = (view: ConfigType): (() => void) => () => {
    const hasStaleParams = !!(searchParams.get('category') || searchParams.get('type'));
    if (hasStaleParams) setSearchParams({});
    if (activeView !== view) {
      setActiveView(view);
      return;
    }
    onClose();
  };

  // Handle Android hardware back button
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const handleBackButton = App.addListener('backButton', () => {
        if (!goBackInView()) {
          onClose();
        }
      });
      
      return () => {
        handleBackButton.then(listener => listener.remove());
      };
    }
  }, [onClose, activeView, searchParams, setSearchParams]);
  
  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!goBackInView()) {
          onClose();
        }
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, activeView, searchParams, setSearchParams]);
  
  // Get page title based on type
  const getTitle = (): string => {
    switch (activeView) {
      case 'settings':
        return t('settings');
      case 'bookmarks':
        return t('bookmarks');
      case 'navigation':
        return isRTL ? 'انتقل' : 'Navigate';
      case 'search':
        return t('search');
      case 'reciter':
        return t('audio');
      case 'tafseer':
        return t('tafseer');
      case 'repeat':
        return t('repeatSettings');
      case 'ayahselector':
        return t('selectAyahToPlay');
      default:
        return '';
    }
  };
  
  // Render appropriate view based on type
  const renderView = () => {
    switch (activeView) {
      case 'settings':
        return (
          <SettingsView
            currentPage={currentPage}
            onNavigateToPage={onNavigate}
          />
        );
      case 'bookmarks':
        return (
          <BookmarksView
            bookmarks={bookmarks}
            memorizationBookmarks={memorizationBookmarks}
            readingBookmarks={readingBookmarks}
            bookmarkPageSurahs={bookmarkPageSurahs}
            bookmarkPageAyahs={bookmarkPageAyahs}
            bookmarkPageSurahIds={bookmarkPageSurahIds}
            bookmarkTimestamps={bookmarkTimestamps}
            memorizationTimestamps={memorizationTimestamps}
            readingTimestamps={readingTimestamps}
            currentSurahId={currentSurahId}
            currentPage={currentPage}
            currentPlayingAyah={currentPlayingAyah}
            onNavigate={(page, surahId, ayahNum) => {
              // Forward the bookmark's surah/ayah so the parent can seek the
              // surah audio to it when ayah timing data is available
              onNavigate(page, surahId && ayahNum ? { surah: surahId, ayah: ayahNum } : undefined);
              onClose();
            }}
            onToggleBookmark={toggleBookmark}
            onRemoveMemorizationBookmark={removeMemorizationBookmark}
            onRemoveReadingBookmark={removeReadingBookmark}
            onAddBookmarkByType={addBookmarkByType}
            onUpdateBookmark={updateBookmark}
            onTouchBookmark={touchBookmark}
            initialCategory={initialBookmarkCategory}
          />
        );
      case 'navigation':
        return (
          <NavigationView 
            onNavigate={onNavigate} 
            onClose={onClose} 
            initialType={initialNavigationType}
            initialSurah={initialNavigationSurah}
            initialJuz={initialNavigationJuz}
            initialPage={initialNavigationPage}
            audioSource={audioSource}
            hasAyahTimings={hasAyahTimings}
          />
        );
      case 'search':
        return <SearchView onNavigate={onNavigate} onClose={onClose} />;
      case 'reciter':
        return (
          <ReciterView
            audioSource={audioSource}
            onAudioSourceChange={onAudioSourceChange}
            selectedReciter={selectedReciter}
            filteredReciters={filteredReciters}
            uniqueReciterNames={uniqueReciterNames}
            filterReciterName={filterReciterName}
            filterReading={filterReading}
            filterStyle={filterStyle}
            filterQuality={filterQuality}
            availableReadings={availableReadings}
            availableStyles={availableStyles}
            availableQualities={availableQualities}
            onFilterReciterNameChange={onFilterReciterNameChange}
            onFilterReadingChange={onFilterReadingChange}
            onFilterStyleChange={onFilterStyleChange}
            onFilterQualityChange={onFilterQualityChange}
            mp3QuranReciters={mp3QuranReciters}
            mp3QuranRecitersAr={mp3QuranRecitersAr}
            selectedMp3QuranReciter={selectedMp3QuranReciter}
            selectedMoshaf={selectedMoshaf}
            onMp3QuranReciterChange={onMp3QuranReciterChange}
            onMoshafChange={onMoshafChange}
            currentPlayingAyah={currentPlayingAyah}
            currentSurahId={currentSurahId}
            onListen={onReciterListen}
            onNavigateToSurah={onReciterNavigateToSurah}
          />
        );
      case 'tafseer':
        return <TafseerView />;
      case 'repeat':
        return (
          <RepeatView
            ayahData={ayahData}
            repeatStartSurah={repeatStartSurah}
            repeatStartAyah={repeatStartAyah}
            repeatEndSurah={repeatEndSurah}
            repeatEndAyah={repeatEndAyah}
            repeatPassageCount={repeatPassageCount}
            repeatAyahCount={repeatAyahCount}
            audioSource={audioSource}
            hasAyahTimings={hasAyahTimings}
            onRepeatStartSurahChange={onRepeatStartSurahChange}
            onRepeatStartAyahChange={onRepeatStartAyahChange}
            onRepeatEndSurahChange={onRepeatEndSurahChange}
            onRepeatEndAyahChange={onRepeatEndAyahChange}
            onRepeatPassageCountChange={onRepeatPassageCountChange}
            onRepeatAyahCountChange={onRepeatAyahCountChange}
            onStartRepeat={onStartRepeat}
            onClose={onClose}
          />
        );
      case 'ayahselector':
        return (
          <AyahSelectorView
            onClose={onClose}
            onNavigate={onNavigate}
            ayahData={ayahData}
            currentPageNum={currentPage}
            secondPageNum={secondPageNum}
            currentSurahId={currentSurahId}
            currentPlayingAyah={currentPlayingAyah}
            viewMode={viewMode}
            isMobile={isMobile}
            isAyahNavigationRef={isAyahNavigationRef}
            audioSource={audioSource}
            onPlayAyah={onPlayAyah}
            onSetCurrentPlayingAyah={onSetCurrentPlayingAyah}
            onSeekToAyahPosition={onSeekToAyahPosition}
            onStopAudio={onStopAudio}
          />
        );
      default:
        return null;
    }
  };
  
  return (
    <motion.div
      /* Active chrome theme on the overlay root — scoped CSS (index.css,
         "Glass chrome theme" section) lightens the solid green buttons when
         the 'glass' bar theme is selected. Green theme is unaffected. */
      data-chrome-theme={chromeTheme}
      className="fixed inset-0 z-[100] flex flex-col bg-[#FBF9F4] dark:bg-black"
      /* Open/close: the whole sheet slides up from the bottom */
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
    >
      {/* Header - Android-style top app bar: back arrow + start-aligned title.
          Desktop: a centered floating panel (same treatment as the reader's
          TopBar) with the sheet background showing on either side; phones
          keep the classic full-width band. */}
        <div 
          className={cn(
            "sticky top-0 z-10 md:px-3",
          )}
        >
          <div
            className={cn(
              "max-w-4xl w-full mx-auto md:rounded-b-2xl md:shadow-lg",
              chromeTheme === 'glass'
                ? isDarkMode
                  ? "bg-black/40 backdrop-blur-xl border-b border-white/10"
                  : "bg-[#E7E6E2]/60 backdrop-blur-md border-b border-[#8A8578]/20 md:shadow-[0_2px_12px_rgba(87,70,36,0.08)]"
                : isDarkMode
                  ? "bg-emerald-950"
                  : "bg-gradient-to-b from-emerald-800 to-emerald-600"
            )}
            // Same measured width as the reader's TopBar — the default page
            // is the reference. Inline style overrides the max-w-4xl
            // fallback class; absent on phones.
            style={{
              ...(chromeMaxWidthPx ? { maxWidth: `${chromeMaxWidthPx}px` } : undefined),
              // Status-bar inset on the gradient panel itself (same rule as
              // the reader's TopBar) so the themed background fills the
              // status-bar strip; on the outer wrapper the padding would show
              // the sheet background above the header instead.
              paddingTop: 'env(safe-area-inset-top)',
            }}
          >
          <div className="flex items-center gap-1 px-2 py-1">
            <button
              onClick={() => {
                // Behaves like Android system back: leave sub-view first, then close
                if (!goBackInView()) onClose();
              }}
              className={cn(
                "flex items-center justify-center w-12 h-12 rounded-full shrink-0 transition-colors active:bg-emerald-950/30 dark:active:bg-white/10",
                isGlassLight ? "text-emerald-800 active:bg-emerald-900/10" : "text-[#F2E3BB]"
              )}
              aria-label={isRTL ? "رجوع" : "Go back"}
            >
              {isRTL ? (
                <ChevronRight className="w-7 h-7" />
              ) : (
                <ChevronLeft className="w-7 h-7" />
              )}
            </button>
            
            <motion.h1
              key={activeView}
              initial={slideDirection === 0 ? { opacity: 0 } : { opacity: 0, x: `${-slideDirection * 8}%` }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={cn(
                "text-xl md:text-2xl font-bold truncate",
                isGlassLight ? "text-emerald-800" : "text-[#F2E3BB]"
              )}
            >
              {getTitle()}
            </motion.h1>
          </div>
          </div>
        </div>

        {/* View content - slides horizontally when switching bottom-bar views.
            Touch handlers allow swiping to the next/previous bar item.
            md:px-3 keeps the content column aligned with the floating
            header/footer panels at 768-896px widths. */}
        <div className="flex-1 min-h-0 overflow-hidden md:px-3" {...swipeHandlers}>
          <AnimatePresence initial={false} custom={slideDirection} mode="popLayout">
            <motion.div
              key={activeView}
              custom={slideDirection}
              variants={viewVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className={cn(
                "h-full flex flex-col max-w-4xl w-full mx-auto",
                activeView === 'reciter' ? 'overflow-hidden min-h-0' : 'overflow-y-auto pb-20'
              )}
              // Same measured width as the reader's chrome bars.
              style={chromeMaxWidthPx ? { maxWidth: `${chromeMaxWidthPx}px` } : undefined}
            >
              <div className="flex-1 flex flex-col min-h-0">
                {renderView()}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

      {/* Bottom Navigation Bar - part of the sliding sheet.
          Desktop: centered floating panel matching the header; phones keep
          the classic full-width band. */}
      <div className="pt-2 md:px-3">
        <div
          className={cn(
            "max-w-4xl w-full mx-auto md:rounded-t-2xl md:mb-2 md:shadow-lg",
            chromeTheme === 'glass'
              ? isDarkMode
                ? "bg-black/40 backdrop-blur-xl border-t border-white/10"
                : "bg-[#E7E6E2]/60 backdrop-blur-md border-t border-[#8A8578]/20 md:shadow-[0_-2px_12px_rgba(87,70,36,0.08)]"
              : isDarkMode
                ? "bg-emerald-950"
                : "bg-gradient-to-t from-emerald-800 to-emerald-600"
          )}
          // Same measured width as the reader's footer panel.
          style={chromeMaxWidthPx ? { maxWidth: `${chromeMaxWidthPx}px` } : undefined}
        >
          <BottomBar
            theme={chromeTheme}
            showBottomBarText={showBottomBarText}
            totalBookmarks={getTotalBookmarks()}
            isMobile={isMobile}
            viewMode={viewMode}
            activeButton={
              activeView === 'navigation' ? 'navigation'
              : activeView === 'search' ? 'search'
              : activeView === 'bookmarks' ? 'bookmarks'
              : activeView === 'settings' ? 'settings'
              : activeView === 'tafseer' ? 'tafseer'
              : null
            }
            onGoToClick={closeIfActive('navigation')}
            onSearchClick={closeIfActive('search')}
            onBookmarkClick={closeIfActive('bookmarks')}
            onSettingsClick={closeIfActive('settings')}
            onTafseerClick={closeIfActive('tafseer')}
            onViewModeToggle={onViewModeToggle}
          />
        </div>
      </div>
    </motion.div>
  );
}
