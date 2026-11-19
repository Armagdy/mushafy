import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useBookmarks } from "@/hooks/useBookmarks";
import { FullPageLayout } from "@/components/layout/FullPageLayout";
import { BottomBar } from "@/components/quran/BottomBar";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useViewSwipe } from "@/hooks/useViewSwipe";
import { App } from '@capacitor/app';

// Import different configuration views
import SettingsView from "@/components/config/SettingsView";
import BookmarksView from "@/components/config/BookmarksView";
import NavigationView from "@/components/config/NavigationView";
import ReciterView from "@/components/config/ReciterView";
import TafseerView from "@/components/config/TafseerView";
import RepeatView from "@/components/config/RepeatView";
import SearchView from "@/components/config/SearchView";

type ConfigType = 'settings' | 'bookmarks' | 'navigation' | 'reciter' | 'tafseer' | 'repeat' | 'search';

/**
 * Visual order of the bottom-bar views - used to pick the horizontal
 * slide direction when switching between them (ViewPager-style).
 */
const VIEW_ORDER: ConfigType[] = [
  'navigation', 'search', 'tafseer', 'bookmarks', 'settings', 'reciter', 'repeat',
];

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

/**
 * Unified Configuration Page
 * Handles all dialog-like views (Settings, Bookmarks, Navigation, etc.)
 * Route: /config/:type
 */
export default function Configuration() {
  const { type } = useParams<{ type: ConfigType }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, language, isRTL } = useLanguage();
  const { toast } = useToast();
  
  // Track the previous view to compute the horizontal slide direction
  const prevTypeRef = useRef<ConfigType>(configType);
  const slideDirection = (() => {
    const nextIdx = VIEW_ORDER.indexOf(configType);
    const prevIdx = VIEW_ORDER.indexOf(prevTypeRef.current);
    prevTypeRef.current = configType;
    if (nextIdx === -1 || prevIdx === -1 || nextIdx === prevIdx) return 0;
    const forward = nextIdx > prevIdx ? 1 : -1;
    return isRTL ? -forward : forward;
  })();

  // Swipe between bottom-bar views (ViewPager gesture).
  // Disabled while a sub-screen is open so scrolling inside those screens
  // can never be mistaken for a view switch. Tafseer is excluded too:
  // its ayah cards already own a horizontal drag.
  const swipeHandlers = useViewSwipe((dir) => {
    const barTypes: ConfigType[] = ['navigation', 'search', 'tafseer', 'bookmarks', 'settings'];
    const inSubScreen = !!(searchParams.get('category') || searchParams.get('type'));
    if (inSubScreen || configType === 'tafseer' || !barTypes.includes(configType)) return;
    const idx = barTypes.indexOf(configType);
    const forward = isRTL ? dir === 'right' : dir === 'left';
    const nextIdx = forward ? idx + 1 : idx - 1;
    if (nextIdx >= 0 && nextIdx < barTypes.length) {
      navigate(`/config/${barTypes[nextIdx]}`);
    }
  });
  
  // Handle legacy routes (/settings, /bookmarks) by mapping to correct type
  const configType = type || (window.location.pathname.includes('/settings') ? 'settings' : 
                              window.location.pathname.includes('/bookmarks') ? 'bookmarks' : 
                              'settings');
  
  // Get bookmarks for badge count and all bookmark data
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
  
  // Current page/surah state for bookmarks (from localStorage or defaults)
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem('temp-current-page');
    const value = saved ? parseInt(saved) : 1;
    console.log('📖 Configuration: Reading currentPage from localStorage:', { saved, value });
    return value;
  });
  const [currentSurahId, setCurrentSurahId] = useState(() => {
    const saved = localStorage.getItem('temp-current-surah');
    const value = saved ? parseInt(saved) : 1;
    console.log('📖 Configuration: Reading currentSurahId from localStorage:', { saved, value });
    return value;
  });

  // Clear temp values from localStorage after component mounts to avoid stale data
  useEffect(() => {
    return () => {
      localStorage.removeItem('temp-current-page');
      localStorage.removeItem('temp-current-surah');
    };
  }, []);
  
  // View mode and display settings from localStorage
  const [isMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  );
  const [viewMode, setViewMode] = useState<'single' | 'double'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'single';
    const saved = localStorage.getItem('quran-view-mode');
    return (saved as 'single' | 'double') || 'double';
  });
  const [showBottomBarText, setShowBottomBarText] = useState<boolean>(() => {
    const saved = localStorage.getItem('quran-show-bottom-bar-text');
    return saved !== null ? saved === 'true' : true;
  });
  
  // Listen for bottom bar text setting changes
  useEffect(() => {
    const handleSettingChange = (event: CustomEvent) => {
      if (event.detail.key === 'quran-show-bottom-bar-text') {
        setShowBottomBarText(event.detail.value === 'true');
      }
    };
    
    window.addEventListener('quran-setting-changed' as any, handleSettingChange as any);
    
    return () => {
      window.removeEventListener('quran-setting-changed' as any, handleSettingChange as any);
    };
  }, []);
  
  // Handle Android hardware back button
  useEffect(() => {
    const handleBackButton = App.addListener('backButton', () => {
      // Check if we have search params (indicates we're in a sub-view/tab)
      const hasSearchParams = Array.from(searchParams.keys()).length > 0;
      
      if (hasSearchParams) {
        // Clear search params to go back to main list/view
        navigate(window.location.pathname, { replace: true });
      } else {
        // Go back to home page
        navigate('/');
      }
    });
    
    return () => {
      handleBackButton.then(listener => listener.remove());
    };
  }, [navigate, searchParams]);
  
  // Get page title based on type
  const getTitle = (): string => {
    switch (configType) {
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
        return t('repeat');
      default:
        return '';
    }
  };
  
  // Render appropriate view based on type
  const renderView = () => {
    switch (configType) {
      case 'settings':
        return <SettingsView />;
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
            currentPlayingAyah={null}
            onNavigate={(page) => navigate(`/page/${page}`)}
            onToggleBookmark={toggleBookmark}
            onRemoveMemorizationBookmark={removeMemorizationBookmark}
            onRemoveReadingBookmark={removeReadingBookmark}
            onAddBookmarkByType={addBookmarkByType}
            onUpdateBookmark={updateBookmark}
            onTouchBookmark={touchBookmark}
          />
        );
      case 'navigation':
        return <NavigationView />;
      case 'search':
        return <SearchView />;
      case 'reciter':
        return <ReciterView />;
      case 'tafseer':
        return <TafseerView />;
      case 'repeat':
        return <RepeatView />;
      default:
        return (
          <div className="p-4 text-center text-emerald-600">
            {t('pageNotFound') || 'Page not found'}
          </div>
        );
    }
  };
  
  const updateViewMode = (mode: 'single' | 'double') => {
    setViewMode(mode);
    localStorage.setItem('quran-view-mode', mode);
  };
  
  return (
    /* Slide up from the bottom on first entry (component stays mounted
       while switching bottom-bar items, so this only plays once) */
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
    >
      <FullPageLayout title={getTitle()} showBottomPadding={false}>
        {/* Main Content - slides horizontally when switching bottom-bar views.
            Touch handlers allow swiping to the next/previous bar item. */}
        <div className="h-full overflow-hidden" {...swipeHandlers}>
          <AnimatePresence initial={false} custom={slideDirection} mode="popLayout">
            <motion.div
              key={configType}
              custom={slideDirection}
              variants={viewVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className="h-full overflow-y-auto pb-20"
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Bottom Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-emerald-800 to-emerald-600 z-40 pt-2">
          <BottomBar
            showBottomBarText={showBottomBarText}
            totalBookmarks={getTotalBookmarks()}
            isMobile={isMobile}
            viewMode={viewMode}
            activeButton={
              configType === 'navigation' ? 'navigation'
              : configType === 'search' ? 'search'
              : configType === 'tafseer' ? 'tafseer'
              : configType === 'bookmarks' ? 'bookmarks'
              : configType === 'settings' ? 'settings'
              : null
            }
            onGoToClick={() => configType === 'navigation' ? navigate('/') : navigate('/config/navigation')}
            onSearchClick={() => configType === 'search' ? navigate('/') : navigate('/config/search')}
            onBookmarkClick={() => configType === 'bookmarks' ? navigate('/') : navigate('/config/bookmarks')}
            onSettingsClick={() => configType === 'settings' ? navigate('/') : navigate('/config/settings')}
            onTafseerClick={() => configType === 'tafseer' ? navigate('/') : navigate('/config/tafseer')}
            onViewModeToggle={() => updateViewMode(viewMode === 'single' ? 'double' : 'single')}
          />
        </div>
      </FullPageLayout>
    </motion.div>
  );
}
