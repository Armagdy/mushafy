import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useBookmarks } from "@/hooks/useBookmarks";
import { FullPageLayout } from "@/components/layout/FullPageLayout";
import { BottomBar } from "@/components/quran/BottomBar";
import { useState, useEffect } from "react";
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
    <FullPageLayout title={getTitle()} showBottomPadding={true}>
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {renderView()}
      </div>
      
      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-emerald-800 to-emerald-600 z-40 pt-2">
        <BottomBar
          showBottomBarText={showBottomBarText}
          totalBookmarks={getTotalBookmarks()}
          isMobile={isMobile}
          viewMode={viewMode}
          onGoToClick={() => navigate('/config/navigation')}
          onSearchClick={() => navigate('/config/search')}
          onBookmarkClick={() => navigate('/config/bookmarks')}
          onSettingsClick={() => navigate('/config/settings')}
          onTafseerClick={() => navigate('/config/tafseer')}
          onViewModeToggle={() => updateViewMode(viewMode === 'single' ? 'double' : 'single')}
        />
      </div>
    </FullPageLayout>
  );
}
