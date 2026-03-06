import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Bookmark, Volume2, Search, Navigation, BookmarkCheck, Menu, Book, BookText, Globe, X, Settings, BookMarked, BookOpen, Play, Pause, Square, ChevronDown, Repeat } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { surahs } from '@/data/surahs';
import { Button } from '@/components/ui/button';
import { TopBar } from '@/components/quran/TopBar';
import { BottomBar } from '@/components/quran/BottomBar';
import { PlayBar } from '@/components/quran/PlayBar';
import { PageDisplay } from '@/components/quran/PageDisplay';
import { AudioProgressBar } from '@/components/quran/AudioProgressBar';
import { ReciterDialog } from '@/components/quran/ReciterDialog';
import { RepeatDialog } from '@/components/quran/RepeatDialog';
import { NavigationDialog } from '@/components/quran/NavigationDialog';
import { TafseerDialog } from '@/components/quran/TafseerDialog';
import ConfigOverlay, { type ConfigType } from '@/components/config/ConfigOverlay';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMushaf, type MushafType } from '@/contexts/MushafContext';
import { useToast } from '@/hooks/use-toast';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useQuranData } from '@/hooks/useQuranData';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { getPageImageFilename, getPageSurahInfo, getPageJuzNumber, getJuzFirstPage, getSurahFirstPage, getAyahPage } from '@/lib/quran-mapping';
import { cn } from '@/lib/utils';
import { isNativePlatform } from '@/lib/native-storage';

const Surah = () => {
  const { page } = useParams<{ page: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, isRTL, language, setLanguage } = useLanguage();
  const { getMushafPath, mushafType, setMushafType } = useMushaf();
  const { toast } = useToast();
  
  // Custom hooks for bookmark and data management
  const {
    bookmarks,
    memorizationBookmarks,
    readingBookmarks,
    bookmarkPageSurahs,
    bookmarkPageAyahs,
    bookmarkPageSurahIds,
    toggleBookmark,
    addMemorizationBookmark,
    removeMemorizationBookmark,
    addReadingBookmark,
    removeReadingBookmark,
    addBookmarkByType,
    getSurahNameForPage,
    getTotalBookmarks,
    isBookmarked
  } = useBookmarks(language);
  
  const {
    ayahData,
    quranMetaData,
    isAyahDataLoading,
    isMetaDataLoading,
    reloadAyahData
  } = useQuranData();
  
  // All mushaf types now use the same styling
  const isTashelOrMadinah = true;
  
  // Helper function to convert numbers based on language
  const formatNumber = (num: number | string): string => {
    const numStr = num.toString();
    if (language === 'ar') {
      // Convert to Eastern Arabic numerals (٠-٩)
      return numStr.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
    }
    return numStr;
  };
  
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<'navigation' | 'word'>('navigation');
  
  // Audio player dialogs
  const [showReciterDialog, setShowReciterDialog] = useState(false);

  // Load ayah metadata (use hook's reload function)
  const loadAyahData = reloadAyahData;
  
  // Repeat dialog
  const [showRepeatDialog, setShowRepeatDialog] = useState(false);

  // Navigation tracking
  const [initialNavTab, setInitialNavTab] = useState<'surah' | 'juz' | 'page'>('surah');
  
  const [currentSurahId, setCurrentSurahId] = useState(1);
  const [currentJuz, setCurrentJuz] = useState(1);
  const [currentPageAyah, setCurrentPageAyah] = useState<number | null>(null);
  const [showTafseerDialog, setShowTafseerDialog] = useState(false);
  const [tafseerSurahNumber, setTafseerSurahNumber] = useState(1);
  const [tafseerAyahNumber, setTafseerAyahNumber] = useState(1);
  const [tafseerSurahName, setTafseerSurahName] = useState('');
  
  // ConfigOverlay state
  const [configOverlayType, setConfigOverlayType] = useState<ConfigType | null>(null);
  const [initialNavigationType, setInitialNavigationType] = useState<'surah' | 'juz' | 'page' | undefined>(undefined);
  const [initialNavigationSurah, setInitialNavigationSurah] = useState<number | undefined>(undefined);
  const [initialNavigationJuz, setInitialNavigationJuz] = useState<number | undefined>(undefined);
  const [initialNavigationPage, setInitialNavigationPage] = useState<number | undefined>(undefined);
  const [initialBookmarkCategory, setInitialBookmarkCategory] = useState<string | null>(null);
  const [currentHezb, setCurrentHezb] = useState(1);
  const [currentQuarter, setCurrentQuarter] = useState(1);
  const [viewMode, setViewMode] = useState<'single' | 'double'>(
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'single' : 'double'
  );
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  );
  const [pagesToLoad, setPagesToLoad] = useState<number>(() => {
    const saved = localStorage.getItem('quran-pages-to-load');
    return saved ? parseInt(saved) : 1;
  });
  const [showBottomBarText, setShowBottomBarText] = useState<boolean>(() => {
    const saved = localStorage.getItem('quran-show-bottom-bar-text');
    return saved !== null ? saved === 'true' : true;
  });
  const [flashAyahPickerIcon, setFlashAyahPickerIcon] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showBookmarkTypeSelector, setShowBookmarkTypeSelector] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);
  const isScrollNavigation = useRef(false);
  const isAyahNavigation = useRef(false);
  const ayahListRef = useRef<HTMLDivElement>(null);
  const wasPlayingBeforeDrag = useRef(false);

  // Current page number (default to 1 if not specified)
  const currentPageNum = parseInt(page || '1');
  
  // Initialize audio player hook (after all state it depends on is declared)
  const {
    audioElement,
    isPlaying,
    currentPlayingAyah,
    setCurrentPlayingAyah,
    currentTime,
    duration,
    isPreloadingAyahs,
    preloadProgress,
    audioSource,
    setAudioSource,
    reciters,
    selectedReciter,
    setSelectedReciter,
    filteredReciters,
    uniqueReciterNames,
    filterReciterName,
    setFilterReciterName,
    filterReading,
    setFilterReading,
    filterStyle,
    setFilterStyle,
    filterQuality,
    setFilterQuality,
    availableReadings,
    availableStyles,
    availableQualities,
    mp3QuranReciters,
    mp3QuranRecitersAr,
    selectedMp3QuranReciter,
    setSelectedMp3QuranReciter,
    selectedMoshaf,
    setSelectedMoshaf,
    hasAyahTimings,
    isRepeatActive,
    setIsRepeatActive,
    repeatPassageCount,
    setRepeatPassageCount,
    repeatAyahCount,
    setRepeatAyahCount,
    repeatStartSurah,
    setRepeatStartSurah,
    repeatStartAyah,
    setRepeatStartAyah,
    repeatEndSurah,
    setRepeatEndSurah,
    repeatEndAyah,
    setRepeatEndAyah,
    currentRepeatPassage,
    currentRepeatAyah,
    currentRepeatSurah,
    currentRepeatAyahCount,
    isRepeatConcatenatedMode,
    repeatAyahTimestamps,
    playAyah,
    togglePlayPause,
    stopAudio,
    seekToTime,
    seekToAyahPosition,
    startRepeat,
    preloadNextAyah,
    ayahTimestamps,
    concatenatedSurah,
    currentSurahAudio,
    ayahTimings
  } = useAudioPlayer({
    currentPageNum,
    secondPageNum: currentPageNum < 604 ? currentPageNum + 1 : undefined,
    currentSurahId,
    currentPageAyah,
    ayahData,
    isAyahNavigation,
    onSurahUnavailable: (reason) => {
      if (reason === 'network-error') {
        toast({
          title: t('surahNotCachedOffline'),
          description: t('connectToPlaySurah'),
          variant: 'destructive',
        });
      } else if (reason === 'unavailable') {
        toast({
          title: t('surahNotAvailableForReciter'),
          variant: 'destructive',
        });
      } else if (reason === 'completed') {
        toast({
          title: t('quranCompleted'),
        });
      }
    }
  });
  
  // Redirect to last page if no page is specified in URL
  useEffect(() => {
    if (!page) {
      const lastPage = localStorage.getItem('quran-last-page');
      if (lastPage) {
        const pageNum = parseInt(lastPage);
        if (pageNum >= 1 && pageNum <= 604) {
          navigate(`/page/${pageNum}`, { replace: true });
        }
      }
    }
  }, [page, navigate]);
  
  // Listen for setting changes from SettingsView
  useEffect(() => {
    const handleSettingChange = (event: CustomEvent) => {
      if (event.detail.key === 'quran-show-bottom-bar-text') {
        setShowBottomBarText(event.detail.value === 'true');
      } else if (event.detail.key === 'quran-pages-to-load') {
        setPagesToLoad(parseInt(event.detail.value));
      }
    };
    
    window.addEventListener('quran-setting-changed' as any, handleSettingChange as any);
    
    return () => {
      window.removeEventListener('quran-setting-changed' as any, handleSettingChange as any);
    };
  }, []);
  
  // In double page mode, ensure we're always on an odd page number (1, 3, 5, etc.)
  // This ensures proper pairing: 1-2, 3-4, 5-6, etc.
  useEffect(() => {
    if (viewMode === 'double' && !isMobile && currentPageNum % 2 === 0 && currentPageNum > 1) {
      // If on an even page in double mode, navigate to the previous odd page
      navigate(`/page/${currentPageNum - 1}`, { replace: true });
    }
  }, [currentPageNum, viewMode, isMobile, navigate]);
  
  // Calculate the two pages to display (like traditional Mushaf) - ONLY for double page mode
  // In double page mode, show current page and next page (1-2, 3-4, 5-6, etc.)
  // Pages are displayed side by side: in RTL (right=current, left=next), in LTR (left=current, right=next)
  const secondPageNum = currentPageNum < 604 ? currentPageNum + 1 : currentPageNum;
  const leftPageNum = isRTL ? secondPageNum : currentPageNum;
  const rightPageNum = isRTL ? currentPageNum : secondPageNum;

  // Debug logging for images
  console.log('=== Page Debug Info ===');
  console.log('Current Page Number:', currentPageNum);
  console.log('View Mode:', viewMode);
  console.log('Is RTL:', isRTL);
  console.log('Is Mobile:', isMobile);
  
  // Only show double page info when in double page mode
  if (viewMode === 'double' && !isMobile) {
    console.log('Left Page Number:', leftPageNum);
    console.log('Right Page Number:', rightPageNum);
    console.log('Left Page Image:', leftPageNum > 0 ? `${getMushafPath()}/${getPageImageFilename(leftPageNum)}` : 'N/A');
    console.log('Right Page Image:', rightPageNum > 0 ? `${getMushafPath()}/${getPageImageFilename(rightPageNum)}` : 'N/A');
  } else {
    console.log('Single Page Mode - Showing:', `${getMushafPath()}/${getPageImageFilename(currentPageNum)}`);
  }

  const currentSurah = surahs.find(s => s.id === currentSurahId) || surahs[0];

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  const updatePagesToLoad = (value: number) => {
    setPagesToLoad(value);
    localStorage.setItem('quran-pages-to-load', value.toString());
  };

  // Load page info (surah and juz)
  useEffect(() => {
    const loadPageInfo = async () => {
      console.log('loadPageInfo called - isAyahNavigation:', isAyahNavigation.current);
      const surahInfo = await getPageSurahInfo(currentPageNum);
      const juzNum = await getPageJuzNumber(currentPageNum);
      
      if (surahInfo) {
        setCurrentSurahId(surahInfo.surahId);
        setCurrentPageAyah(surahInfo.ayah);
        // Only update play bar to first ayah if NOT navigating from ayah selection
        if (!isAyahNavigation.current) {
          console.log('Resetting ayah to first on page:', surahInfo.surahId, surahInfo.ayah);
          setCurrentPlayingAyah({ surah: surahInfo.surahId, ayah: surahInfo.ayah });
        } else {
          console.log('Skipping ayah reset - preserving user selection');
          // Reset the flag after a delay to allow all navigation effects to complete
          setTimeout(() => {
            console.log('Resetting isAyahNavigation flag');
            isAyahNavigation.current = false;
          }, 100);
        }
      }
      
      setCurrentJuz(juzNum);
      
      // Calculate current Hezb (60 hezbs total, each ~10 pages)
      const hezbNum = Math.ceil((currentPageNum * 60) / 604);
      setCurrentHezb(hezbNum);
      
      // Calculate current Quarter (240 quarters total, each ~2.5 pages)
      const quarterNum = Math.ceil((currentPageNum * 240) / 604);
      setCurrentQuarter(quarterNum);
      
      // Persist current page to localStorage
      localStorage.setItem('quran-last-page', currentPageNum.toString());
      
      // Stop audio playback when page changes ONLY if it's a manual navigation
      // Don't stop if it's automatic navigation (following the recitation)
      // Also don't stop if MP3Quran is selected (plays entire surah continuously)
      console.log('=== PAGE CHANGE DETECTED ===');
      console.log('Current page:', currentPageNum);
      console.log('isAyahNavigation.current:', isAyahNavigation.current);
      console.log('audioSource:', audioSource);
      if (audioElement && !isAyahNavigation.current && audioSource !== 'mp3quran') {
        console.log('Stopping audio due to page navigation');
        stopAudio();
      } else {
        console.log('Skipping audio stop (ayah navigation, mp3quran source, or no audio element)');
      }
    };
    
    loadPageInfo();
  }, [currentPageNum, audioSource]);

  // Detect mobile screen and auto-switch to single page
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setViewMode('single');
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Tab key handler to toggle fullscreen
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        setIsFullscreen(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Scroll to current page when it changes - with virtualized loading
  useEffect(() => {
    // Don't scroll if the page change came from the scroll handler
    if (isScrollNavigation.current) {
      isScrollNavigation.current = false;
      return;
    }
    
    if (scrollContainerRef.current && (viewMode === 'single' || isMobile)) {
      isProgrammaticScroll.current = true;
      
      requestAnimationFrame(() => {
        if (!scrollContainerRef.current) return;
        
        const pageElement = document.getElementById(`page-${currentPageNum}`);
        if (pageElement) {
          console.log('=== Scrolling to page ===', currentPageNum);
          console.log('Page element:', pageElement);
          console.log('Container before scroll:', scrollContainerRef.current.scrollLeft);
          
          // In virtualized mode, the current page is always the middle element
          // We need to scroll to center it
          pageElement.scrollIntoView({
            behavior: 'auto',
            block: 'nearest',
            inline: 'center'
          });
          
          // Log after scroll
          setTimeout(() => {
            if (scrollContainerRef.current) {
              console.log('Container after scroll:', scrollContainerRef.current.scrollLeft);
            }
          }, 50);
          
          // Reset flag after scroll completes with longer timeout
          setTimeout(() => {
            isProgrammaticScroll.current = false;
          }, 300);
        } else {
          // If page element not found (edge case), reset flag
          isProgrammaticScroll.current = false;
        }
      });
    }
  }, [currentPageNum, viewMode, isMobile]);

  const handlePreviousPage = () => {
    if (viewMode === 'single' || isMobile) {
      if (currentPageNum > 1) {
        navigate(`/page/${currentPageNum - 1}`);
      }
    } else {
      // In double page mode, move by 2 pages
      if (currentPageNum > 2) {
        navigate(`/page/${currentPageNum - 2}`);
      } else if (currentPageNum === 2) {
        navigate(`/page/1`);
      }
    }
  };

  const handleNextPage = () => {
    if (viewMode === 'single' || isMobile) {
      if (currentPageNum < 604) {
        navigate(`/page/${currentPageNum + 1}`);
      }
    } else {
      // In double page mode, move by 2 pages
      if (currentPageNum < 603) {
        navigate(`/page/${currentPageNum + 2}`);
      }
    }
  };

  const isBookmarkedCurrent = isBookmarked(currentPageNum);

  // Debounce scroll handler to prevent excessive updates
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Handle scroll to update current page
  const handleScroll = () => {
    if (isProgrammaticScroll.current || !scrollContainerRef.current) {
      return;
    }
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      if (!scrollContainerRef.current || isProgrammaticScroll.current) return;
      
      const container = scrollContainerRef.current;
      const scrollLeft = container.scrollLeft;
      const containerWidth = container.clientWidth;
      const scrollWidth = container.scrollWidth;
      const scrollCenter = scrollLeft + containerWidth / 2;
      
      console.log('=== Scroll Debug ===');
      console.log('scrollLeft:', scrollLeft);
      console.log('containerWidth:', containerWidth);
      console.log('scrollWidth:', scrollWidth);
      console.log('scrollCenter:', scrollCenter);
      console.log('isRTL:', isRTL);
      
      // Find which page is currently centered (only check loaded pages)
      let closestPage = currentPageNum;
      let minDistance = Infinity;
      
      // Only check the loaded pages based on pagesToLoad setting
      const pagesToCheck: number[] = [];
      for (let i = pagesToLoad; i >= 1; i--) {
        const pageNum = currentPageNum - i;
        if (pageNum >= 1) pagesToCheck.push(pageNum);
      }
      pagesToCheck.push(currentPageNum);
      for (let i = 1; i <= pagesToLoad; i++) {
        const pageNum = currentPageNum + i;
        if (pageNum <= 604) pagesToCheck.push(pageNum);
      }
      
      for (const pageNum of pagesToCheck) {
        const pageElement = document.getElementById(`page-${pageNum}`);
        if (pageElement) {
          const pageLeft = pageElement.offsetLeft;
          const pageWidth = pageElement.offsetWidth;
          const pageCenter = pageLeft + pageWidth / 2;
          const distance = Math.abs(pageCenter - scrollCenter);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestPage = pageNum;
          }
        }
      }
      
      console.log('closestPage detected:', closestPage, 'current:', currentPageNum);
      
      // Only update if we've scrolled to a different page
      if (closestPage !== currentPageNum) {
        console.log('Navigating to page:', closestPage);
        isScrollNavigation.current = true;
        navigate(`/page/${closestPage}`, { replace: true });
      }
    }, 250);
  };

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  return (
    <div className="w-full h-screen max-h-screen bg-[#FBF9F4] dark:bg-gray-900 flex flex-col overflow-hidden" style={{ height: '100dvh', maxHeight: '100dvh' }}>
      {/* Enhanced Islamic Top Header */}
      <motion.div
        initial={false}
        animate={{
          y: isFullscreen ? '-100%' : '0%',
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
        className={cn("z-50", isFullscreen && "pointer-events-none")}
      >
      <TopBar
        currentSurah={currentSurah}
        currentPageNum={currentPageNum}
        currentJuz={currentJuz}
        currentHezb={currentHezb}
        currentQuarter={currentQuarter}
        currentAyah={currentPlayingAyah?.ayah || currentPageAyah}
        formatNumber={formatNumber}
        onSurahClick={() => {
          setInitialNavigationType('surah');
          setInitialNavigationSurah(currentSurahId);
          setInitialNavigationJuz(undefined);
          setInitialNavigationPage(undefined);
          setConfigOverlayType('navigation');
        }}
        onPageClick={() => {
          setInitialNavigationType('page');
          setInitialNavigationSurah(undefined);
          setInitialNavigationJuz(undefined);
          setInitialNavigationPage(currentPageNum);
          setConfigOverlayType('navigation');
        }}
        onJuzClick={() => {
          setInitialNavigationType('juz');
          setInitialNavigationSurah(undefined);
          setInitialNavigationJuz(currentJuz);
          setInitialNavigationPage(undefined);
          setConfigOverlayType('navigation');
        }}
      />
      </motion.div>

      {/* Fullscreen Info Overlay - Shows when bars are hidden */}
      {isFullscreen && (
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between pt-12 pb-3 px-6"
      >
        {/* Juz */}
        <div className="text-emerald-800 dark:text-emerald-200 text-lg md:text-2xl font-bold">
          {t('juz')} {formatNumber(currentJuz)}
        </div>
        
        {/* Ornament separator */}
        <div className="flex-shrink-0 w-12 h-px bg-gradient-to-r from-transparent via-emerald-700 to-transparent dark:from-transparent dark:via-emerald-500 dark:to-transparent"></div>
        
        {/* Surah Name */}
        <div className="text-emerald-800 dark:text-emerald-200 text-lg md:text-2xl font-bold">
          {language === 'ar' ? currentSurah.name : currentSurah.englishName}
        </div>
        
        {/* Ornament separator */}
        <div className="flex-shrink-0 w-12 h-px bg-gradient-to-r from-transparent via-emerald-700 to-transparent dark:from-transparent dark:via-emerald-500 dark:to-transparent"></div>
        
        {/* Page */}
        <div className="text-emerald-800 dark:text-emerald-200 text-lg md:text-2xl font-bold">
          {t('page')} {formatNumber(currentPageNum)}
        </div>
      </div>
      )}

      {/* Main Content - Two Page Display */}
      <PageDisplay
        currentPageNum={currentPageNum}
        secondPageNum={secondPageNum}
        leftPageNum={leftPageNum}
        rightPageNum={rightPageNum}
        viewMode={viewMode}
        isMobile={isMobile}
        bookmarks={bookmarks}
        memorizationBookmarks={memorizationBookmarks}
        readingBookmarks={readingBookmarks}
        pagesToLoad={pagesToLoad}
        scrollContainerRef={scrollContainerRef}
        onPreviousPage={handlePreviousPage}
        onNextPage={handleNextPage}
        onScroll={handleScroll}
        isFullscreen={isFullscreen}
        onImageClick={() => {
          // Only toggle fullscreen on native platforms (Android/iOS)
          if (isNativePlatform()) {
            setIsFullscreen(!isFullscreen);
          }
        }}
        onAyahSelect={(surah: number, ayah: number) => {
          console.log('Ayah selected in TartelPage:', surah, ayah);
          
          // Check if MP3Quran reciter without ayah timing is selected
          if (audioSource === 'mp3quran' && !hasAyahTimings) {
            toast({
              title: t('cannotSelectAyahWithReciter'),
              description: t('pleaseChooseAnotherReciter'),
              variant: 'destructive',
            });
            return;
          }
          
          setCurrentSurahId(surah);
          setCurrentPageAyah(ayah);
          setCurrentPlayingAyah({ surah, ayah });
          
          // If audio is currently playing, start playing the newly selected ayah
          if (isPlaying) {
            console.log('Audio is playing - starting newly selected ayah:', surah, ayah);
            playAyah(surah, ayah);
          }
        }}
        currentPlayingAyah={currentPlayingAyah}
        onLongPressNotification={() => {
          setFlashAyahPickerIcon(true);
          setTimeout(() => setFlashAyahPickerIcon(false), 3000);
        }}
        audioSource={audioSource}
        hasAyahTimings={hasAyahTimings}
      />

      {/* Add Bookmark Button in Fullscreen Mode */}
      {isFullscreen && (
        <div className="absolute bottom-40 left-4 z-50 flex gap-4">
          {/* Bookmark Button */}
          <div className="relative flex items-end">
            {/* Add Bookmark Button - Icon Only */}
            <button
              onClick={() => setShowBookmarkTypeSelector(!showBookmarkTypeSelector)}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
            >
              <Bookmark className="w-7 h-7" />
            </button>
            
            {/* Bookmark Type Options - Shows to the top-right of button when open */}
            {showBookmarkTypeSelector && (
              <div
                className="absolute bottom-0 left-10 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-2xl border border-emerald-200 dark:border-emerald-700 p-2 flex flex-col gap-1"
              >
                {/* Quick Bookmark */}
                <button
                  onClick={async () => {
                    toggleBookmark(currentPageNum);
                    setShowBookmarkTypeSelector(false);
                    toast({
                      title: bookmarks.includes(currentPageNum) ? t('bookmarkRemoved') : t('bookmarkAdded'),
                      description: `${t('page')} ${formatNumber(currentPageNum)}`,
                    });
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                >
                  <Bookmark className="w-5 h-5 text-amber-600" />
                  <span className="text-base font-medium text-emerald-800 dark:text-emerald-200 whitespace-nowrap">
                    {t('bookmark')}
                  </span>
                </button>
                
                {/* Memorization Bookmark */}
                <button
                  onClick={async () => {
                    await addBookmarkByType('memorization', currentSurahId, currentPageAyah || 1);
                    setShowBookmarkTypeSelector(false);
                    toast({
                      title: t('bookmarkAdded'),
                      description: `${t('memorization')} - ${t('page')} ${formatNumber(currentPageNum)}`,
                    });
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                >
                  <BookMarked className="w-5 h-5 text-emerald-600" />
                  <span className="text-base font-medium text-emerald-800 dark:text-emerald-200 whitespace-nowrap">
                    {t('memorization')}
                  </span>
                </button>
                
                {/* Reading Bookmark */}
                <button
                  onClick={async () => {
                    await addBookmarkByType('reading', currentSurahId, currentPageAyah || 1);
                    setShowBookmarkTypeSelector(false);
                    toast({
                      title: t('bookmarkAdded'),
                      description: `${t('reading')} - ${t('page')} ${formatNumber(currentPageNum)}`,
                    });
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                >
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  <span className="text-base font-medium text-emerald-800 dark:text-emerald-200 whitespace-nowrap">
                    {t('reading')}
                  </span>
                </button>
                
                {/* Edit Bookmark */}
                <button
                  onClick={() => {
                    setShowBookmarkTypeSelector(false);
                    setInitialBookmarkCategory('update');
                    setConfigOverlayType('bookmarks');
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors border-t border-emerald-100 dark:border-emerald-800"
                >
                  <BookmarkCheck className="w-5 h-5 text-purple-600" />
                  <span className="text-base font-medium text-emerald-800 dark:text-emerald-200 whitespace-nowrap">
                    {isRTL ? 'تعديل العلامات' : 'Edit Bookmark'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Tafseer Button */}
          <div className="relative flex items-end">
            <button
              onClick={() => {
                // Save current playing ayah or page ayah for TafseerView
                if (currentPlayingAyah) {
                  localStorage.setItem('quran-tafseer-surah', currentPlayingAyah.surah.toString());
                  localStorage.setItem('quran-tafseer-ayah', currentPlayingAyah.ayah.toString());
                } else {
                  localStorage.setItem('quran-tafseer-surah', currentSurahId.toString());
                  localStorage.setItem('quran-tafseer-ayah', (currentPageAyah || 1).toString());
                }
                setConfigOverlayType('tafseer');
              }}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
            >
              <BookText className="w-7 h-7" />
            </button>
          </div>
        </div>
      )}

      {/* Preloading indicator overlay */}
      {isPreloadingAyahs && (
        <div 
          className="fixed left-0 right-0 z-50 flex items-center justify-center pointer-events-none"
          style={{ bottom: 'calc(120px + env(safe-area-inset-bottom))' }}
        >
          <div className="bg-emerald-700/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-emerald-500/30">
            <p className="text-[#F2E3BB] text-sm md:text-base font-medium text-center">
              {audioSource === 'everyayah' 
                ? `${t('loadingAyahs')} ${preloadProgress.total > 0 ? `${formatNumber(Math.round((preloadProgress.current / preloadProgress.total) * 100))}%` : ''}`
                : t('loadingAudio') || 'Loading audio...'}
            </p>
          </div>
        </div>
      )}

      {/* Audio Progress Bar - between page and controls */}
      <motion.div
        initial={false}
        animate={{
          y: isFullscreen || !currentPlayingAyah ? '100%' : '0%',
          opacity: isFullscreen || !currentPlayingAyah ? 0 : 1,
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
        className={cn("z-50", (isFullscreen || !currentPlayingAyah) && "pointer-events-none")}
      >
        <AudioProgressBar
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            onSeek={seekToTime}
          audioElement={audioElement}
          audioSource={audioSource}
          ayahTimestamps={ayahTimestamps}
          concatenatedSurah={concatenatedSurah}
          mp3QuranAyahTimings={ayahTimings}
          currentSurahAudio={currentSurahAudio}
          formatNumber={formatNumber}
          isRepeatActive={isRepeatActive}
          isRepeatConcatenatedMode={isRepeatConcatenatedMode}
          repeatAyahTimestamps={repeatAyahTimestamps}
          repeatAyahCount={repeatAyahCount || 1}
          repeatPassageCount={repeatPassageCount || 1}
          currentRepeatPassage={currentRepeatPassage}
          currentRepeatAyahCount={currentRepeatAyahCount}
          surahNames={Object.fromEntries(surahs.map(s => [s.id, language === 'ar' ? s.name : s.englishName]))}
          isRTL={isRTL}
          ayahRepeatLabel={t('ayahRepeat')}
          sectionRepeatLabel={t('sectionRepeat')}
          ayahLabel={t('ayah')}
          onDragStart={() => {
            wasPlayingBeforeDrag.current = isPlaying;
            if (isPlaying && audioElement) {
              console.log('Pausing audio for drag');
              audioElement.pause();
            }
          }}
          onDragEnd={() => {
            if (wasPlayingBeforeDrag.current && audioElement) {
              console.log('Drag ended, scheduling audio resume...');
              
              // Give page time to navigate and render (if needed) before resuming
              // This prevents trying to play before the new page is ready
              setTimeout(() => {
                console.log('Attempting to resume audio, readyState:', audioElement.readyState);
                
                // Check if audio is ready to play
                if (audioElement.readyState >= 2) {
                  // HAVE_CURRENT_DATA or better - can play immediately
                  audioElement.play().then(() => {
                    console.log('Playback resumed successfully');
                  }).catch(err => {
                    console.error('Failed to resume playback:', err);
                  });
                } else {
                  // Audio not ready yet - wait for it to load
                  console.log('Audio not ready, waiting for canplay event...');
                  const handleCanPlay = () => {
                    console.log('Audio ready, resuming playback');
                    audioElement.play().then(() => {
                      console.log('Playback resumed successfully after waiting');
                    }).catch(err => {
                      console.error('Failed to resume playback after waiting:', err);
                    });
                    audioElement.removeEventListener('canplay', handleCanPlay);
                  };
                  audioElement.addEventListener('canplay', handleCanPlay);
                  
                  // Timeout fallback (5 seconds)
                  setTimeout(() => {
                    audioElement.removeEventListener('canplay', handleCanPlay);
                    console.log('Timeout waiting for audio to be ready');
                  }, 5000);
                }
              }, 100); // Short delay for navigation - seek only called once now at drag end
            }
            wasPlayingBeforeDrag.current = false;
          }}
        />
        </motion.div>

      {/* Combined Audio & Navigation Bar */}
      <motion.div
        initial={false}
        animate={{
          y: isFullscreen ? '100%' : '0%',
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
        className={cn("w-full bg-gradient-to-t from-emerald-800 to-emerald-600 z-50", isFullscreen && "pointer-events-none")}
      >
        <div className="w-full max-w-[1600px] mx-auto rounded-t-2xl">
        {/* Audio Player Bottom Bar */}
        <PlayBar
          currentPlayingAyah={currentPlayingAyah}
          selectedReciter={audioSource === 'everyayah' ? selectedReciter : null}
          selectedMp3QuranReciter={audioSource === 'mp3quran' ? selectedMp3QuranReciter : null}
          mp3QuranRecitersAr={mp3QuranRecitersAr}
          isPlaying={isPlaying}
          isRepeatActive={isRepeatActive}
          isPreloadingAyahs={isPreloadingAyahs}
          preloadProgress={preloadProgress}
          audioSource={audioSource}
          hasAyahTimings={hasAyahTimings}
          flashAyahPickerIcon={flashAyahPickerIcon}
          currentSurahName={
            // For MP3Quran mode, prioritize currentSurahAudio to show the surah being played
            // This ensures the surah name doesn't change when user navigates pages manually
            audioSource === 'mp3quran' && currentSurahAudio
              ? (language === 'ar' 
                  ? (surahs.find(s => s.id === currentSurahAudio)?.name || currentSurah.name)
                  : (surahs.find(s => s.id === currentSurahAudio)?.englishName || currentSurah.englishName))
              : currentPlayingAyah 
                ? (language === 'ar' 
                    ? (surahs.find(s => s.id === currentPlayingAyah.surah)?.name || currentSurah.name)
                    : (surahs.find(s => s.id === currentPlayingAyah.surah)?.englishName || currentSurah.englishName))
                : (language === 'ar' ? currentSurah.name : currentSurah.englishName)
          }
          formatNumber={formatNumber}
          onAyahSelectorClick={() => setConfigOverlayType('ayahselector')}
          onRepeatClick={() => {
            // Set default values based on current playing ayah
            if (currentPlayingAyah) {
              setRepeatStartSurah(currentPlayingAyah.surah);
              setRepeatStartAyah(currentPlayingAyah.ayah);
              setRepeatEndSurah(currentPlayingAyah.surah);
              // Find the last ayah of current surah
              const currentSurahData = ayahData.find(s => s.number === currentPlayingAyah.surah);
              if (currentSurahData && currentSurahData.verses) {
                setRepeatEndAyah(currentSurahData.verses.length);
              }
            }
            // Prefill repeat counts with 1 if they're empty/0
            if (repeatPassageCount === 0) setRepeatPassageCount(1);
            if (repeatAyahCount === 0) setRepeatAyahCount(1);
            setConfigOverlayType('repeat');
          }}
          onReciterClick={() => setConfigOverlayType('reciter')}
          onStop={stopAudio}
          onTogglePlayPause={togglePlayPause}
        />

        {/* Modern Bottom Toolbar */}
        <BottomBar
        showBottomBarText={showBottomBarText}
        totalBookmarks={getTotalBookmarks()}
        isMobile={isMobile}
        viewMode={viewMode}
        activeButton={null}
        onGoToClick={() => {
          // Reset navigation initial values to show main menu (no specific type selected)
          setInitialNavigationType(undefined);
          setInitialNavigationSurah(undefined);
          setInitialNavigationJuz(undefined);
          setInitialNavigationPage(undefined);
          setConfigOverlayType('navigation');
        }}
        onSearchClick={() => {
          setConfigOverlayType('search');
        }}
        onBookmarkClick={() => {
          // Save current page/surah to localStorage for Bookmarks view
          localStorage.setItem('quran-current-page', currentPageNum.toString());
          localStorage.setItem('quran-current-surah', currentSurahId.toString());
          setInitialBookmarkCategory(null); // Reset to show main menu
          setConfigOverlayType('bookmarks');
        }}
        onSettingsClick={() => setConfigOverlayType('settings')}
        onTafseerClick={() => {
          // Save current playing ayah or page ayah for TafseerView
          if (currentPlayingAyah) {
            localStorage.setItem('quran-tafseer-surah', currentPlayingAyah.surah.toString());
            localStorage.setItem('quran-tafseer-ayah', currentPlayingAyah.ayah.toString());
          } else {
            localStorage.setItem('quran-tafseer-surah', currentSurahId.toString());
            localStorage.setItem('quran-tafseer-ayah', (currentPageAyah || 1).toString());
          }
          setConfigOverlayType('tafseer');
        }}
        onViewModeToggle={() => setViewMode(viewMode === 'single' ? 'double' : 'single')}
      />
        </div>
      </motion.div>

      {/* Search/Navigation Dialog */}
      <NavigationDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        mode={searchMode}
        ayahData={ayahData}
        onNavigate={(page) => navigate(`/page/${page}`)}
        formatNumber={formatNumber}
        currentSurahId={currentSurahId}
        currentAyah={currentPageAyah}
        currentJuz={currentJuz}
        currentHezb={currentHezb}
        currentQuarter={currentQuarter}
        currentPage={currentPageNum}
        initialTab={initialNavTab}
        onSetPlayingAyah={(ayah) => {
          setCurrentPlayingAyah(ayah);
          isAyahNavigation.current = true;
        }}
      />

      {/* Tafseer Dialog */}
      <TafseerDialog
        open={showTafseerDialog}
        onOpenChange={setShowTafseerDialog}
        surahNumber={tafseerSurahNumber}
        ayahNumber={tafseerAyahNumber}
        surahName={tafseerSurahName}
      />

      {/* Reciter Selection Dialog */}
      <ReciterDialog
        open={showReciterDialog}
        onOpenChange={setShowReciterDialog}
        audioSource={audioSource}
        onAudioSourceChange={setAudioSource}
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
        mp3QuranReciters={mp3QuranReciters}
        mp3QuranRecitersAr={mp3QuranRecitersAr}
        selectedMp3QuranReciter={selectedMp3QuranReciter}
        selectedMoshaf={selectedMoshaf}
        onMp3QuranReciterChange={(reciter) => {
          console.log('[Surah] 🎤 Reciter changed in Surah.tsx:', reciter.name, 'ID:', reciter.id);
          console.log('[Surah] 📋 Reciter object received:', reciter);
          console.log('[Surah] 📊 Current hasAyahTimings:', hasAyahTimings);
          console.log('[Surah] 📊 Current ayahTimings length:', ayahTimings?.length || 0);
          setSelectedMp3QuranReciter(reciter);
        }}
        onMoshafChange={(moshaf) => {
          console.log('[Surah] 📖 Moshaf changed in Surah.tsx:', moshaf.name, 'ID:', moshaf.id);
          console.log('[Surah] 📋 Moshaf object received:', moshaf);
          console.log('[Surah] 📊 Current hasAyahTimings:', hasAyahTimings);
          console.log('[Surah] 📊 Current ayahTimings length:', ayahTimings?.length || 0);
          setSelectedMoshaf(moshaf);
        }}
        currentPlayingAyah={currentPlayingAyah}
        currentSurahId={currentSurahId}
        onFilterReciterNameChange={setFilterReciterName}
        onFilterReadingChange={setFilterReading}
        onFilterStyleChange={setFilterStyle}
        onFilterQualityChange={setFilterQuality}
        onNavigateToSurah={async (surahId) => {
          // Stop any playing audio
          stopAudio();
          
          // Set the playing ayah to first ayah of selected surah (same as NavigationDialog)
          setCurrentPlayingAyah({ surah: surahId, ayah: 1 });
          isAyahNavigation.current = true;
          
          // Navigate to page containing first ayah of selected surah
          const firstPage = await getAyahPage(surahId, 1);
          if (firstPage) {
            setTimeout(() => {
              navigate(`/page/${firstPage}`);
            }, 0);
          }
          
          // Close the dialog
          setShowReciterDialog(false);
        }}
        onListen={() => {
          if (audioSource === 'everyayah') {
            // Ensure the reciter from filtered list is selected
            if (filteredReciters.length > 0) {
              const reciterToApply = selectedReciter || filteredReciters[0];
              setSelectedReciter(reciterToApply);
              
              // Persist selected reciter
              if (reciterToApply && reciterToApply.folder) {
                localStorage.setItem('quran-last-reciter', reciterToApply.folder);
              }
            }
          } else if (audioSource === 'mp3quran') {
            // MP3Quran: Ensure moshaf is selected
            if (selectedMp3QuranReciter && selectedMoshaf) {
              localStorage.setItem('quran-last-mp3quran-moshaf', selectedMoshaf.id.toString());
            }
          }
          
          // Note: Dialog closing is handled by onNavigateToSurah
        }}
      />

      {/* Repeat Settings Dialog */}
      <RepeatDialog
        open={showRepeatDialog}
        onOpenChange={setShowRepeatDialog}
        ayahData={ayahData}
        repeatStartSurah={repeatStartSurah}
        repeatStartAyah={repeatStartAyah}
        repeatEndSurah={repeatEndSurah}
        repeatEndAyah={repeatEndAyah}
        repeatPassageCount={repeatPassageCount}
        repeatAyahCount={repeatAyahCount}
        audioSource={audioSource}
        hasAyahTimings={hasAyahTimings}
        onRepeatStartSurahChange={setRepeatStartSurah}
        onRepeatStartAyahChange={setRepeatStartAyah}
        onRepeatEndSurahChange={setRepeatEndSurah}
        onRepeatEndAyahChange={setRepeatEndAyah}
        onRepeatPassageCountChange={setRepeatPassageCount}
        onRepeatAyahCountChange={setRepeatAyahCount}
        onStartRepeat={startRepeat}
      />

      {/* ConfigOverlay for Settings, Bookmarks, Tafseer, etc. */}
      {configOverlayType && (
        <ConfigOverlay
          type={configOverlayType}
          onClose={() => {
            setConfigOverlayType(null);
            setInitialBookmarkCategory(null);
          }}
          onChangeView={(view) => setConfigOverlayType(view)}
          currentPage={currentPageNum}
          currentSurahId={currentSurahId}
          currentPlayingAyah={currentPlayingAyah}
          initialNavigationType={initialNavigationType}
          initialNavigationSurah={initialNavigationSurah}
          initialNavigationJuz={initialNavigationJuz}
          initialNavigationPage={initialNavigationPage}
          initialBookmarkCategory={initialBookmarkCategory}
          onNavigate={(page, ayah) => {
            if (ayah) {
              // Quarter/Rob3 navigation with specific ayah
              isAyahNavigation.current = true;
              setCurrentPlayingAyah(ayah);
            }
            navigate(`/page/${page}`);
            setConfigOverlayType(null);
          }}
          viewMode={viewMode}
          onViewModeToggle={() => setViewMode(viewMode === 'single' ? 'double' : 'single')}
          showBottomBarText={showBottomBarText}
          isMobile={isMobile}
          audioSource={audioSource}
          onAudioSourceChange={setAudioSource}
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
          onFilterReciterNameChange={setFilterReciterName}
          onFilterReadingChange={setFilterReading}
          onFilterStyleChange={setFilterStyle}
          onFilterQualityChange={setFilterQuality}
          mp3QuranReciters={mp3QuranReciters}
          mp3QuranRecitersAr={mp3QuranRecitersAr}
          selectedMp3QuranReciter={selectedMp3QuranReciter}
          selectedMoshaf={selectedMoshaf}
          onMp3QuranReciterChange={setSelectedMp3QuranReciter}
          onMoshafChange={setSelectedMoshaf}
          onReciterListen={() => {
            if (audioSource === 'everyayah' && filteredReciters.length > 0) {
              const reciterToApply = selectedReciter || filteredReciters[0];
              setSelectedReciter(reciterToApply);
              if (reciterToApply?.folder) {
                localStorage.setItem('quran-last-reciter', reciterToApply.folder);
              }
            }
          }}
          onReciterNavigateToSurah={async (surahId) => {
            // Check if user is changing to a different surah
            const isDifferentSurah = surahId !== currentSurahId;
            
            if (isDifferentSurah) {
              stopAudio();
              setCurrentPlayingAyah({ surah: surahId, ayah: 1 });
              isAyahNavigation.current = true;
              const firstPage = await getAyahPage(surahId, 1);
              if (firstPage) {
                navigate(`/page/${firstPage}`);
              }
            }
            
            // Close the overlay (whether same surah or different)
            setConfigOverlayType(null);
          }}
          onStopAudio={stopAudio}
          ayahData={ayahData}
          repeatStartSurah={repeatStartSurah}
          repeatStartAyah={repeatStartAyah}
          repeatEndSurah={repeatEndSurah}
          repeatEndAyah={repeatEndAyah}
          repeatPassageCount={repeatPassageCount}
          repeatAyahCount={repeatAyahCount}
          hasAyahTimings={hasAyahTimings}
          onRepeatStartSurahChange={setRepeatStartSurah}
          onRepeatStartAyahChange={setRepeatStartAyah}
          onRepeatEndSurahChange={setRepeatEndSurah}
          onRepeatEndAyahChange={setRepeatEndAyah}
          onRepeatPassageCountChange={setRepeatPassageCount}
          onRepeatAyahCountChange={setRepeatAyahCount}
          onStartRepeat={() => {
            startRepeat();
            setConfigOverlayType(null);
          }}
          secondPageNum={secondPageNum}
          isAyahNavigationRef={isAyahNavigation}
          onPlayAyah={playAyah}
          onSetCurrentPlayingAyah={setCurrentPlayingAyah}
          onSeekToAyahPosition={seekToAyahPosition}
        />
      )}
    </div>
  );
};

export default Surah;
