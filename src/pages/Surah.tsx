import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Bookmark, Volume2, Search, Navigation, BookmarkCheck, Menu, Book, Globe, X, Settings, BookMarked, BookOpen, Play, Pause, Square, ChevronDown, Repeat } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { surahs } from '@/data/surahs';
import { Button } from '@/components/ui/button';
import { TopBar } from '@/components/quran/TopBar';
import { BottomBar } from '@/components/quran/BottomBar';
import { PlayBar } from '@/components/quran/PlayBar';
import { PageDisplay } from '@/components/quran/PageDisplay';
import { ReciterDialog } from '@/components/quran/ReciterDialog';
import { AyahSelectorDialog } from '@/components/quran/AyahSelectorDialog';
import { RepeatDialog } from '@/components/quran/RepeatDialog';
import { BookmarksDialog } from '@/components/quran/BookmarksDialog';
import { SettingsDialog } from '@/components/quran/SettingsDialog';
import { NavigationDialog } from '@/components/quran/NavigationDialog';
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

const Surah = () => {
  const { page } = useParams<{ page: string }>();
  const navigate = useNavigate();
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
  
  const isTashelOrMadinah = mushafType === 'tashel' || mushafType === 'madinah';
  
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
  const [showAyahSelector, setShowAyahSelector] = useState(false);
  


  // Load ayah metadata (use hook's reload function)
  const loadAyahData = reloadAyahData;
  
  // Repeat dialog
  const [showRepeatDialog, setShowRepeatDialog] = useState(false);

  // Bookmark dialog
  const [showBookmarkDialog, setShowBookmarkDialog] = useState(false);
  const [initialNavTab, setInitialNavTab] = useState<'surah' | 'juz' | 'page'>('surah');
  
  const [currentSurahId, setCurrentSurahId] = useState(1);
  const [currentJuz, setCurrentJuz] = useState(1);
  const [currentPageAyah, setCurrentPageAyah] = useState<number | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
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
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);
  const isScrollNavigation = useRef(false);
  const isAyahNavigation = useRef(false);
  const ayahListRef = useRef<HTMLDivElement>(null);

  // Current page number (default to 1 if not specified)
  const currentPageNum = parseInt(page || '1');
  
  // Initialize audio player hook (after all state it depends on is declared)
  const {
    audioElement,
    isPlaying,
    currentPlayingAyah,
    setCurrentPlayingAyah,
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
    playAyah,
    togglePlayPause,
    stopAudio,
    startRepeat,
    preloadNextAyah
  } = useAudioPlayer({
    currentPageNum,
    currentSurahId,
    currentPageAyah,
    ayahData,
    isAyahNavigation
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
      if (audioElement && !isAyahNavigation.current) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
    };
    
    loadPageInfo();
  }, [currentPageNum, audioElement]);

  // Scroll to currently playing ayah when ayah selector dialog opens
  useEffect(() => {
    console.log('=== Ayah Selector Scroll Debug ===');
    console.log('showAyahSelector:', showAyahSelector);
    console.log('ayahListRef.current:', ayahListRef.current);
    console.log('currentPlayingAyah:', currentPlayingAyah);
    console.log('currentSurahId:', currentSurahId);
    console.log('currentPageAyah:', currentPageAyah);
    
    if (showAyahSelector && ayahListRef.current) {
      // Determine which ayah to scroll to: playing ayah if available, otherwise current page's first ayah
      const targetSurah = currentPlayingAyah?.surah || currentSurahId;
      const targetAyah = currentPlayingAyah?.ayah || (currentPageAyah || 1);
      
      console.log('Target ayah to scroll to:', targetSurah, '-', targetAyah);
      console.log('Selector:', `[data-ayah="${targetSurah}-${targetAyah}"]`);
      
      // Scroll the dialog to the target ayah
      setTimeout(() => {
        const ayahButton = ayahListRef.current?.querySelector(
          `[data-ayah="${targetSurah}-${targetAyah}"]`
        );
        console.log('Found ayah button:', ayahButton);
        if (ayahButton) {
          console.log('Scrolling to ayah button...');
          ayahButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          console.log('Ayah button NOT found! Available buttons:', 
            Array.from(ayahListRef.current?.querySelectorAll('[data-ayah]') || [])
              .map(el => el.getAttribute('data-ayah'))
          );
        }
      }, 100);
      
      // Simulate the scroll that happens on page change
      isProgrammaticScroll.current = true;
      requestAnimationFrame(() => {
        if (!scrollContainerRef.current) return;
        const pageElement = document.getElementById(`page-${currentPageNum}`);
        if (pageElement) {
          pageElement.scrollIntoView({
            behavior: 'auto',
            block: 'nearest',
            inline: 'start'
          });
          setTimeout(() => {
            isProgrammaticScroll.current = false;
          }, 300);
        }
      });
    }
  }, [showAyahSelector, currentPlayingAyah, currentSurahId, currentPageAyah]);

  // Reload ayah data when ayah selector opens
  useEffect(() => {
    if (showAyahSelector) {
      loadAyahData();
    }
  }, [showAyahSelector]);
  


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
    <div className="w-full h-screen bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Enhanced Islamic Top Header */}
      <TopBar
        currentSurah={currentSurah}
        currentPageNum={currentPageNum}
        currentJuz={currentJuz}
        currentHezb={currentHezb}
        currentQuarter={currentQuarter}
        formatNumber={formatNumber}
        onSurahClick={() => {
          setSearchMode('navigation');
          setInitialNavTab('surah');
          setSearchOpen(true);
        }}
        onPageClick={() => {
          setSearchMode('navigation');
          setInitialNavTab('page');
          setSearchOpen(true);
        }}
        onJuzClick={() => {
          setSearchMode('navigation');
          setInitialNavTab('juz');
          setSearchOpen(true);
        }}
      />

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
      />

      {/* Audio Player Bottom Bar */}
      <PlayBar
        currentPlayingAyah={currentPlayingAyah}
        selectedReciter={selectedReciter}
        isPlaying={isPlaying}
        isRepeatActive={isRepeatActive}
        formatNumber={formatNumber}
        onAyahSelectorClick={() => setShowAyahSelector(true)}
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
          setShowRepeatDialog(true);
        }}
        onReciterClick={() => setShowReciterDialog(true)}
        onStop={stopAudio}
        onTogglePlayPause={togglePlayPause}
      />

      {/* Modern Bottom Toolbar */}
      <BottomBar
        showBottomBarText={showBottomBarText}
        totalBookmarks={getTotalBookmarks()}
        isMobile={isMobile}
        viewMode={viewMode}
        onGoToClick={() => {
          setSearchMode('navigation');
          setSearchOpen(true);
        }}
        onSearchClick={() => {
          setSearchMode('word');
          setSearchOpen(true);
        }}
        onBookmarkClick={() => {
          setShowBookmarkDialog(true);
        }}
        onSettingsClick={() => setShowSettingsDialog(true)}
        onViewModeToggle={() => setViewMode(viewMode === 'single' ? 'double' : 'single')}
      />

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

      {/* Settings Dialog */}
      <SettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        isMobile={isMobile}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        pagesToLoad={pagesToLoad}
        onPagesToLoadChange={setPagesToLoad}
        showBottomBarText={showBottomBarText}
        onShowBottomBarTextChange={setShowBottomBarText}
      />

      {/* Reciter Selection Dialog */}
      <ReciterDialog
        open={showReciterDialog}
        onOpenChange={setShowReciterDialog}
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
        currentPlayingAyah={currentPlayingAyah}
        currentSurahId={currentSurahId}
        onFilterReciterNameChange={setFilterReciterName}
        onFilterReadingChange={setFilterReading}
        onFilterStyleChange={setFilterStyle}
        onFilterQualityChange={setFilterQuality}
        onListen={() => {
          // Ensure the reciter from filtered list is selected
          if (filteredReciters.length > 0) {
            const reciterToApply = selectedReciter || filteredReciters[0];
            setSelectedReciter(reciterToApply);
            
            // Persist selected reciter
            if (reciterToApply && reciterToApply.folder) {
              localStorage.setItem('quran-last-reciter', reciterToApply.folder);
            }
            
            // Close the dialog first
            setShowReciterDialog(false);
            
            // Then start playing after a brief delay to ensure state is updated
            setTimeout(() => {
              if (currentPlayingAyah) {
                playAyah(currentPlayingAyah.surah, currentPlayingAyah.ayah);
              } else {
                // If no ayah is selected, play the first ayah of current page
                playAyah(currentSurahId, 1);
              }
            }, 100);
          }
        }}
      />

      {/* Ayah Selection Dialog */}
      <AyahSelectorDialog
        open={showAyahSelector}
        onOpenChange={setShowAyahSelector}
        ayahData={ayahData}
        currentPageNum={currentPageNum}
        secondPageNum={secondPageNum}
        currentSurahId={currentSurahId}
        currentPlayingAyah={currentPlayingAyah}
        viewMode={viewMode}
        isMobile={isMobile}
        isAyahNavigationRef={isAyahNavigation}
        onPlayAyah={playAyah}
        onSetCurrentPlayingAyah={setCurrentPlayingAyah}
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
        onRepeatStartSurahChange={setRepeatStartSurah}
        onRepeatStartAyahChange={setRepeatStartAyah}
        onRepeatEndSurahChange={setRepeatEndSurah}
        onRepeatEndAyahChange={setRepeatEndAyah}
        onRepeatPassageCountChange={setRepeatPassageCount}
        onRepeatAyahCountChange={setRepeatAyahCount}
        onStartRepeat={startRepeat}
      />

      {/* Bookmark Dialog */}
      <BookmarksDialog
        open={showBookmarkDialog}
        onOpenChange={setShowBookmarkDialog}
        bookmarks={bookmarks}
        memorizationBookmarks={memorizationBookmarks}
        readingBookmarks={readingBookmarks}
        bookmarkPageSurahs={bookmarkPageSurahs}
        bookmarkPageAyahs={bookmarkPageAyahs}
        currentSurahId={currentSurahId}
        currentAyahNum={currentPageAyah ?? 1}
        currentPage={currentPageNum}
        currentPlayingAyah={currentPlayingAyah}
        onNavigate={(page) => navigate(`/page/${page}`)}
        onToggleBookmark={(page) => toggleBookmark(page, currentSurahId, currentPageAyah ?? undefined)}
        onRemoveMemorizationBookmark={removeMemorizationBookmark}
        onRemoveReadingBookmark={removeReadingBookmark}
        onAddBookmarkByType={addBookmarkByType}
      />
    </div>
  );
};

export default Surah;
