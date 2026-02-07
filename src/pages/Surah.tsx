import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Bookmark, Volume2, Search, Navigation, BookmarkCheck, Menu, Book, Globe, X, Settings, BookMarked, BookOpen, Play, Pause, Square, ChevronDown, Repeat } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { surahs } from '@/data/surahs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMushaf } from '@/contexts/MushafContext';
import { useToast } from '@/hooks/use-toast';
import { getPageImageFilename, getPageSurahInfo, getPageJuzNumber, getJuzFirstPage, getSurahFirstPage, getAyahPage } from '@/lib/quran-mapping';
import { cn } from '@/lib/utils';

const Surah = () => {
  const { page } = useParams<{ page: string }>();
  const navigate = useNavigate();
  const { t, isRTL, language, setLanguage } = useLanguage();
  const { getMushafPath, mushafType, setMushafType } = useMushaf();
  const { toast } = useToast();
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
  const [searchTab, setSearchTab] = useState<'surah' | 'juz' | 'page' | 'word'>(() => {
    const saved = localStorage.getItem('quran-search-tab');
    return (saved as 'surah' | 'juz' | 'page' | 'word') || 'surah';
  });
  const [searchSurah, setSearchSurah] = useState(() => {
    return localStorage.getItem('quran-search-surah') || '';
  });
  const [searchAyah, setSearchAyah] = useState(() => {
    return localStorage.getItem('quran-search-ayah') || '';
  });
  const [filterJuz, setFilterJuz] = useState('');
  const [filterHezb, setFilterHezb] = useState('');
  const [ayahData, setAyahData] = useState<any[]>([]);
  const [selectedSurahAyahs, setSelectedSurahAyahs] = useState<any[]>([]);
  const [searchWord, setSearchWord] = useState('');
  const [wordSearchResults, setWordSearchResults] = useState<any[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchJuz, setSearchJuz] = useState(() => {
    return localStorage.getItem('quran-search-juz') || '';
  });
  const [searchJuzHezb, setSearchJuzHezb] = useState(() => {
    return localStorage.getItem('quran-search-juz-hezb') || '';
  });
  const [searchJuzQuarter, setSearchJuzQuarter] = useState(() => {
    return localStorage.getItem('quran-search-juz-quarter') || '';
  });
  const [searchPage, setSearchPage] = useState(() => {
    return localStorage.getItem('quran-search-page') || '';
  });
  
  // Audio player state
  const [reciters, setReciters] = useState<any[]>([]);
  const [selectedReciter, setSelectedReciter] = useState<any>(null);
  const [showReciterDialog, setShowReciterDialog] = useState(false);
  const [showAyahSelector, setShowAyahSelector] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingAyah, setCurrentPlayingAyah] = useState<{surah: number, ayah: number} | null>(null);
  const [preloadAudioElement, setPreloadAudioElement] = useState<HTMLAudioElement | null>(null);
  
  // Persist navigation dialog values
  useEffect(() => {
    localStorage.setItem('quran-search-tab', searchTab);
  }, [searchTab]);

  useEffect(() => {
    if (searchSurah) localStorage.setItem('quran-search-surah', searchSurah);
  }, [searchSurah]);

  useEffect(() => {
    if (searchAyah) localStorage.setItem('quran-search-ayah', searchAyah);
  }, [searchAyah]);

  useEffect(() => {
    if (searchJuz) localStorage.setItem('quran-search-juz', searchJuz);
  }, [searchJuz]);

  useEffect(() => {
    if (searchJuzHezb) localStorage.setItem('quran-search-juz-hezb', searchJuzHezb);
  }, [searchJuzHezb]);

  useEffect(() => {
    if (searchJuzQuarter) localStorage.setItem('quran-search-juz-quarter', searchJuzQuarter);
  }, [searchJuzQuarter]);

  useEffect(() => {
    if (searchPage) localStorage.setItem('quran-search-page', searchPage);
  }, [searchPage]);

  // Auto-prefill hizb and surah when filterJuz is selected (Surah tab)
  useEffect(() => {
    if (filterJuz && searchTab === 'surah') {
      const juzNum = parseInt(filterJuz);
      const firstHezb = (juzNum - 1) * 2 + 1;
      setFilterHezb(firstHezb.toString());
      
      // Map juz to first surah
      const juzToFirstSurah: Record<number, number> = {
        1: 1, 2: 2, 3: 2, 4: 3, 5: 4, 6: 4, 7: 5, 8: 6, 9: 7,
        10: 8, 11: 9, 12: 11, 13: 13, 14: 15, 15: 17, 16: 18, 17: 21, 18: 23,
        19: 25, 20: 27, 21: 29, 22: 33, 23: 36, 24: 39, 25: 41,
        26: 46, 27: 51, 28: 58, 29: 67, 30: 78
      };
      
      const firstSurah = juzToFirstSurah[juzNum];
      if (firstSurah) {
        setSearchSurah(firstSurah.toString());
        setSearchAyah('1');
      }
    }
  }, [filterJuz, searchTab]);

  // Auto-prefill surah when filterHezb is selected (Surah tab)
  useEffect(() => {
    if (filterHezb && searchTab === 'surah') {
      // Map hizb to first surah
      const hezbToFirstSurah: Record<number, number> = {
        1: 1, 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 3, 8: 3,
        9: 4, 10: 4, 11: 4, 12: 5, 13: 5, 14: 6, 15: 6, 16: 7,
        17: 7, 18: 7, 19: 8, 20: 9, 21: 9, 22: 10, 23: 11, 24: 11,
        25: 12, 26: 13, 27: 15, 28: 16, 29: 17, 30: 18, 31: 20, 32: 21,
        33: 22, 34: 23, 35: 24, 36: 25, 37: 26, 38: 27, 39: 28, 40: 29,
        41: 31, 42: 33, 43: 33, 44: 34, 45: 36, 46: 37, 47: 39, 48: 40,
        49: 41, 50: 43, 51: 46, 52: 48, 53: 51, 54: 55, 55: 58, 56: 62,
        57: 67, 58: 72, 59: 78, 60: 87
      };
      
      const hezbNum = parseInt(filterHezb);
      const firstSurah = hezbToFirstSurah[hezbNum];
      if (firstSurah) {
        setSearchSurah(firstSurah.toString());
        setSearchAyah('1');
      }
    }
  }, [filterHezb, searchTab]);

  // Load ayah metadata
  const loadAyahData = () => {
    fetch('/assets/ayah-meta-data.json')
      .then(res => res.json())
      .then(data => setAyahData(data))
      .catch(err => console.error('Failed to load ayah data:', err));
  };
  
  // Repeat settings
  const [showRepeatDialog, setShowRepeatDialog] = useState(false);
  const [repeatPassageCount, setRepeatPassageCount] = useState(0);
  const [repeatAyahCount, setRepeatAyahCount] = useState(0);
  const [repeatStartSurah, setRepeatStartSurah] = useState(1);
  const [repeatStartAyah, setRepeatStartAyah] = useState(0);
  const [repeatEndSurah, setRepeatEndSurah] = useState(1);
  const [repeatEndAyah, setRepeatEndAyah] = useState(0);
  const [isRepeatActive, setIsRepeatActive] = useState(false);

  // Bookmark dialog
  const [showBookmarkDialog, setShowBookmarkDialog] = useState(false);
  const [currentRepeatPassage, setCurrentRepeatPassage] = useState(0);
  const [currentRepeatAyah, setCurrentRepeatAyah] = useState(0);
  const [currentRepeatSurah, setCurrentRepeatSurah] = useState(0);
  const [currentRepeatAyahCount, setCurrentRepeatAyahCount] = useState(0);
  
  // Audio filters
  const [filterReciterName, setFilterReciterName] = useState<string>('all');
  const [filterReading, setFilterReading] = useState<string>('all');
  const [filterStyle, setFilterStyle] = useState<string>('all');
  const [filterQuality, setFilterQuality] = useState<string>('all');
  const [filteredReciters, setFilteredReciters] = useState<any[]>([]);
  const [uniqueReciterNames, setUniqueReciterNames] = useState<{name: string, nameAr: string}[]>([]);
  const [availableReadings, setAvailableReadings] = useState<string[]>([]);
  const [availableStyles, setAvailableStyles] = useState<string[]>([]);
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  
  const [bookmarks, setBookmarks] = useState<number[]>(() => {
    const saved = localStorage.getItem('quran-bookmark-bookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  const [memorizationBookmarks, setMemorizationBookmarks] = useState<number[]>(() => {
    const saved = localStorage.getItem('quran-memorization-bookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  const [readingBookmarks, setReadingBookmarks] = useState<number[]>(() => {
    const saved = localStorage.getItem('quran-reading-bookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedBookmarkType, setSelectedBookmarkType] = useState<string>('bookmark');
  const [bookmarkPageSurahs, setBookmarkPageSurahs] = useState<Record<number, string>>(() => {
    const saved = localStorage.getItem('quran-bookmark-surahs');
    return saved ? JSON.parse(saved) : {};
  });
  const [bookmarkPageAyahs, setBookmarkPageAyahs] = useState<Record<number, number>>(() => {
    const saved = localStorage.getItem('quran-bookmark-ayahs');
    return saved ? JSON.parse(saved) : {};
  });
  const [bookmarkSurahId, setBookmarkSurahId] = useState(1);
  const [bookmarkAyahNum, setBookmarkAyahNum] = useState(1);
  const [currentSurahId, setCurrentSurahId] = useState(1);
  const [currentJuz, setCurrentJuz] = useState(1);
  const [currentPageAyah, setCurrentPageAyah] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showSurahSearch, setShowSurahSearch] = useState(false);
  const [surahSearchQuery, setSurahSearchQuery] = useState('');
  const [showJuzSearch, setShowJuzSearch] = useState(false);
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

  // Get surah name and ayah for a page
  const getSurahNameForPage = async (page: number): Promise<string> => {
    if (bookmarkPageSurahs[page]) {
      return bookmarkPageSurahs[page];
    }
    
    const surahInfo = await getPageSurahInfo(page);
    if (surahInfo) {
      const surah = surahs.find(s => s.id === surahInfo.surahId);
      if (surah) {
        const name = language === 'ar' ? surah.name : surah.englishName;
        setBookmarkPageSurahs(prev => ({ ...prev, [page]: name }));
        setBookmarkPageAyahs(prev => ({ ...prev, [page]: surahInfo.ayah }));
        return name;
      }
    }
    return '';
  };

  // Load surah names for all bookmarks
  useEffect(() => {
    const loadSurahNames = async () => {
      const allPages = [...new Set([...bookmarks, ...memorizationBookmarks, ...readingBookmarks])];
      for (const page of allPages) {
        await getSurahNameForPage(page);
      }
    };
    loadSurahNames();
  }, [bookmarks, memorizationBookmarks, readingBookmarks, language]);

  // Add bookmark based on selected type
  const addBookmarkByType = async () => {
    const targetPage = await getAyahPage(bookmarkSurahId, bookmarkAyahNum);
    if (!targetPage) return;
    
    if (selectedBookmarkType === 'bookmark') {
      toggleBookmark(targetPage);
    } else if (selectedBookmarkType === 'memorization') {
      addMemorizationBookmark(targetPage);
    } else if (selectedBookmarkType === 'reading') {
      addReadingBookmark(targetPage);
    }
  };

  // 

  // Add memorization bookmark
  const addMemorizationBookmark = (pageNum: number = currentPageNum) => {
    if (!memorizationBookmarks.includes(pageNum)) {
      const updated = [...memorizationBookmarks, pageNum].sort((a, b) => a - b);
      setMemorizationBookmarks(updated);
      localStorage.setItem('quran-memorization-bookmarks', JSON.stringify(updated));
    }
  };

  // Remove memorization bookmark
  const removeMemorizationBookmark = (page: number) => {
    const updated = memorizationBookmarks.filter(p => p !== page);
    setMemorizationBookmarks(updated);
    localStorage.setItem('quran-memorization-bookmarks', JSON.stringify(updated));
  };

  // Add reading bookmark
  const addReadingBookmark = (pageNum: number = currentPageNum) => {
    if (!readingBookmarks.includes(pageNum)) {
      const updated = [...readingBookmarks, pageNum].sort((a, b) => a - b);
      setReadingBookmarks(updated);
      localStorage.setItem('quran-reading-bookmarks', JSON.stringify(updated));
    }
  };

  // Remove reading bookmark
  const removeReadingBookmark = (page: number) => {
    const updated = readingBookmarks.filter(p => p !== page);
    setReadingBookmarks(updated);
    localStorage.setItem('quran-reading-bookmarks', JSON.stringify(updated));
  };

  // Load page info (surah and juz)
  useEffect(() => {
    const loadPageInfo = async () => {
      const surahInfo = await getPageSurahInfo(currentPageNum);
      const juzNum = await getPageJuzNumber(currentPageNum);
      
      if (surahInfo) {
        setCurrentSurahId(surahInfo.surahId);
        setCurrentPageAyah(surahInfo.ayah);
        // Only update play bar to first ayah if NOT navigating from ayah selection
        if (!isAyahNavigation.current) {
          setCurrentPlayingAyah({ surah: surahInfo.surahId, ayah: surahInfo.ayah });
        }
      }
      
      // Always reset the flag after handling, so next manual navigation works
      isAyahNavigation.current = false;
      
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
        setIsPlaying(false);
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

  // Handle audio ended event - auto-play next ayah or handle repeat
  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
    
    if (isRepeatActive && currentPlayingAyah) {
      // Handle repeat logic
      if (currentRepeatAyahCount < repeatAyahCount) {
        // Repeat the same ayah
        setCurrentRepeatAyahCount(prev => prev + 1);
        playAyah(currentPlayingAyah.surah, currentPlayingAyah.ayah);
        return;
      }
      
      // Move to next ayah
      let nextSurah = currentRepeatSurah;
      let nextAyah = currentRepeatAyah + 1;
      
      // Check if we need to move to next surah
      const currentSurahData = ayahData.find(s => s.number === nextSurah);
      if (currentSurahData && nextAyah > currentSurahData.verses.length) {
        nextSurah += 1;
        nextAyah = 1;
      }
      
      // Check if we've reached the end of the repeat range
      const isEndReached = (nextSurah > repeatEndSurah) || 
                          (nextSurah === repeatEndSurah && nextAyah > repeatEndAyah);
      
      if (isEndReached) {
        // Check if we need to repeat the passage
        if (currentRepeatPassage < repeatPassageCount) {
          // Repeat the passage
          setCurrentRepeatPassage(prev => prev + 1);
          setCurrentRepeatSurah(repeatStartSurah);
          setCurrentRepeatAyah(repeatStartAyah);
          setCurrentRepeatAyahCount(1);
          playAyah(repeatStartSurah, repeatStartAyah);
        } else {
          // Repeat finished
          setIsRepeatActive(false);
          setCurrentRepeatPassage(0);
          setCurrentRepeatAyah(0);
          setCurrentRepeatSurah(0);
          setCurrentRepeatAyahCount(0);
        }
      } else {
        // Continue with next ayah
        setCurrentRepeatSurah(nextSurah);
        setCurrentRepeatAyah(nextAyah);
        setCurrentRepeatAyahCount(1);
        playAyah(nextSurah, nextAyah);
      }
      return;
    }
    
    if (!currentPlayingAyah || !ayahData.length) return;
    
    // Find current surah data
    const currentSurahData = ayahData.find(s => s.number === currentPlayingAyah.surah);
    if (!currentSurahData || !currentSurahData.verses) return;
    
    const totalAyahs = currentSurahData.verses.length;
    const currentAyahNum = currentPlayingAyah.ayah;
    
    // Check if there's a next ayah in the current surah
    if (currentAyahNum < totalAyahs) {
      // Play next ayah in the same surah
      const nextAyahNum = currentAyahNum + 1;
      playAyah(currentPlayingAyah.surah, nextAyahNum);
    } else {
      // Current surah finished, check if there's a next surah
      if (currentPlayingAyah.surah < 114) {
        // Play first ayah of next surah
        const nextSurahNum = currentPlayingAyah.surah + 1;
        playAyah(nextSurahNum, 1);
      }
      // If it was the last ayah of the last surah (114), just stop
    }
  }, [isRepeatActive, currentPlayingAyah, currentRepeatAyahCount, repeatAyahCount, currentRepeatSurah, currentRepeatAyah, ayahData, currentRepeatPassage, repeatPassageCount, repeatStartSurah, repeatStartAyah, repeatEndSurah, repeatEndAyah]);

  // Update audio element event listener when dependencies change
  useEffect(() => {
    if (!audioElement) return;
    
    // Remove old listener and add new one with updated closure
    audioElement.removeEventListener('ended', handleAudioEnded);
    audioElement.addEventListener('ended', handleAudioEnded);
    
    return () => {
      audioElement.removeEventListener('ended', handleAudioEnded);
    };
  }, [audioElement, handleAudioEnded]);

  // Load bookmarks from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('quran-bookmarks');
    if (saved) {
      setBookmarks(JSON.parse(saved));
    }
    const savedMemorization = localStorage.getItem('quran-memorization-bookmarks');
    if (savedMemorization) {
      setMemorizationBookmarks(JSON.parse(savedMemorization));
    }
    const savedReading = localStorage.getItem('quran-reading-bookmarks');
    if (savedReading) {
      setReadingBookmarks(JSON.parse(savedReading));
    }
    
    // Load ayah metadata
    loadAyahData();
    
    // Load reciters
    fetch('/assets/audio.json')
      .then(res => res.json())
      .then(data => {
        setReciters(data);
        
        // Extract unique reciter names (remove style and quality suffixes)
        const extractBaseName = (name: string, nameAr: string) => {
          // Remove common suffixes like "Mujawwad", "Murattal", quality info, and Arabic equivalents
          const cleanName = name
            .replace(/\s*-?\s*(Mujawwad|Murattal)\s*/gi, '')
            .replace(/\s*\(\d+kbps\)/gi, '')
            .trim();
          const cleanNameAr = nameAr
            .replace(/\s*-\s*(مجود|مرتل)\s*/g, '')
            .trim();
          return { name: cleanName, nameAr: cleanNameAr };
        };
        
        const uniqueNames = new Map();
        data.forEach((reciter: any) => {
          const baseName = extractBaseName(reciter.name, reciter.nameAr);
          // Use Arabic name as key to handle English spelling variations (e.g., Menshawi vs Minshawy)
          if (!uniqueNames.has(baseName.nameAr)) {
            uniqueNames.set(baseName.nameAr, baseName);
          }
        });
        setUniqueReciterNames(Array.from(uniqueNames.values()));
        
        // Try to load last selected reciter from localStorage
        const lastReciterFolder = localStorage.getItem('quran-last-reciter');
        let reciterToSet = null;
        
        if (lastReciterFolder) {
          reciterToSet = data.find((r: any) => r.folder === lastReciterFolder);
        }
        
        // If no saved reciter or not found, use default
        if (!reciterToSet) {
          reciterToSet = data.find((r: any) => r.folder === 'Minshawy_Murattal_128kbps')
            || data.find((r: any) => r.folder === 'Minshawy_Mujawwad_192kbps') 
            || data.find((r: any) => r.folder === 'Abdul_Basit_Murattal_192kbps') 
            || data[0];
        }
        
        setSelectedReciter(reciterToSet);
        
        // Initialize filters with selected reciter's data
        if (reciterToSet) {
          const extractBaseNameAr = (nameAr: string) => {
            return nameAr
              .replace(/\s*-\s*(مجود|مرتل)\s*/g, '')
              .trim();
          };
          const baseNameAr = extractBaseNameAr(reciterToSet.nameAr);
          setFilterReciterName(baseNameAr);
          setFilterReading(reciterToSet.reading);
          setFilterStyle(reciterToSet.style);
          setFilterQuality(reciterToSet.quality);
        }
      })
      .catch(err => console.error('Failed to load reciters:', err));
    
    // Initialize audio element
    const audio = new Audio();
    audio.addEventListener('play', () => setIsPlaying(true));
    audio.addEventListener('pause', () => setIsPlaying(false));
    setAudioElement(audio);
    
    // Initialize preload audio element for smooth transitions
    const preloadAudio = new Audio();
    setPreloadAudioElement(preloadAudio);
    
    return () => {
      audio.removeEventListener('play', () => setIsPlaying(true));
      audio.removeEventListener('pause', () => setIsPlaying(false));
      audio.pause();
      audio.remove();
      preloadAudio.pause();
      preloadAudio.remove();
    };
  }, []);
  
  // Auto-set default filters and available options when reciter name is selected
  useEffect(() => {
    if (reciters.length === 0) return;
    
    const extractBaseNameAr = (nameAr: string) => {
      return nameAr
        .replace(/\s*-\s*(مجود|مرتل)\s*/g, '')
        .trim();
    };
    
    if (filterReciterName === 'all') {
      // Show all options when "All" is selected
      setAvailableReadings(['hafs', 'warsh']);
      setAvailableStyles(['murattal', 'mujawwad']);
      setAvailableQualities(['192kbps', '128kbps', '64kbps', '48kbps', '40kbps', '32kbps', '16kbps']);
      return;
    }
    
    // Find all reciters with this Arabic name (to handle spelling variations like Menshawi/Minshawy)
    const reciterVariants = reciters.filter((r: any) => 
      extractBaseNameAr(r.nameAr) === filterReciterName
    );
    
    if (reciterVariants.length > 0) {
      // Extract unique available options for this reciter
      const readings = [...new Set(reciterVariants.map((r: any) => r.reading))];
      const styles = [...new Set(reciterVariants.map((r: any) => r.style))];
      const qualities = [...new Set(reciterVariants.map((r: any) => r.quality))];
      
      setAvailableReadings(readings);
      setAvailableStyles(styles);
      setAvailableQualities(qualities);
      
      // Set defaults - prioritize highest quality that actually exists
      const qualityPriority = ['192kbps', '128kbps', '64kbps', '48kbps', '40kbps', '32kbps', '16kbps'];
      const bestQuality = qualityPriority.find(q => qualities.includes(q)) || qualities[0];
      
      setFilterReading(readings[0]);
      setFilterStyle(styles[0]);
      setFilterQuality(bestQuality);
    }
  }, [filterReciterName, reciters]);
  
  // Update available qualities when reading or style changes
  useEffect(() => {
    if (reciters.length === 0 || filterReciterName === 'all') return;
    
    const extractBaseNameAr = (nameAr: string) => {
      return nameAr
        .replace(/\s*-\s*(مجود|مرتل)\s*/g, '')
        .trim();
    };
    
    // Get all variants matching current filters
    const matchingVariants = reciters.filter((r: any) => {
      const baseNameAr = extractBaseNameAr(r.nameAr);
      const matchesReciterName = baseNameAr === filterReciterName;
      const matchesReading = filterReading === 'all' || r.reading === filterReading;
      const matchesStyle = filterStyle === 'all' || r.style === filterStyle;
      
      return matchesReciterName && matchesReading && matchesStyle;
    });
    
    // Extract available qualities from matching variants
    const qualities = [...new Set(matchingVariants.map((r: any) => r.quality))];
    setAvailableQualities(qualities);
    
    // If current quality is not available, select the best available
    if (!qualities.includes(filterQuality)) {
      const qualityPriority = ['192kbps', '128kbps', '64kbps', '48kbps', '40kbps', '32kbps', '16kbps'];
      const bestQuality = qualityPriority.find(q => qualities.includes(q)) || qualities[0];
      if (bestQuality) {
        setFilterQuality(bestQuality);
      }
    }
  }, [filterReciterName, filterReading, filterStyle, reciters, filterQuality]);
  
  // Filter reciters based on selection
  useEffect(() => {
    if (reciters.length === 0) return;
    
    const extractBaseNameAr = (nameAr: string) => {
      return nameAr
        .replace(/\s*-\s*(مجود|مرتل)\s*/g, '')
        .trim();
    };
    
    const filtered = reciters.filter((reciter: any) => {
      const baseNameAr = extractBaseNameAr(reciter.nameAr);
      const matchesReciterName = filterReciterName === 'all' || baseNameAr === filterReciterName;
      const matchesReading = filterReading === 'all' || reciter.reading === filterReading;
      const matchesStyle = filterStyle === 'all' || reciter.style === filterStyle;
      const matchesQuality = filterQuality === 'all' || reciter.quality === filterQuality;
      
      return matchesReciterName && matchesReading && matchesStyle && matchesQuality;
    });
    
    setFilteredReciters(filtered);
    
    // Auto-select reciter when filters result in a single match
    if (filtered.length === 1) {
      setSelectedReciter(filtered[0]);
      // Persist the auto-selected reciter
      if (filtered[0].folder) {
        localStorage.setItem('quran-last-reciter', filtered[0].folder);
      }
    } else if (filtered.length > 0) {
      // If current reciter is not in filtered list, select the highest quality match
      if (!selectedReciter || !filtered.find((r: any) => r.folder === selectedReciter.folder)) {
        // Prioritize highest quality in filtered results
        const qualityPriority = ['192kbps', '128kbps', '64kbps', '48kbps', '40kbps', '32kbps', '16kbps'];
        const bestMatch = qualityPriority
          .map(q => filtered.find((r: any) => r.quality === q))
          .find(r => r !== undefined) || filtered[0];
        setSelectedReciter(bestMatch);
        // Persist the auto-selected reciter
        if (bestMatch && bestMatch.folder) {
          localStorage.setItem('quran-last-reciter', bestMatch.folder);
        }
      }
    }
  }, [reciters, filterReciterName, filterReading, filterStyle, filterQuality, selectedReciter]);
  
  // Update selected surah ayahs when surah changes
  useEffect(() => {
    if (searchSurah && ayahData.length > 0) {
      const surahId = parseInt(searchSurah);
      const surahData = ayahData.find(s => s.number === surahId);
      if (surahData && surahData.verses) {
        setSelectedSurahAyahs(surahData.verses);
      }
    } else {
      setSelectedSurahAyahs([]);
      setSearchAyah('');
    }
  }, [searchSurah, ayahData]);
  
  // Synchronize Juz selection when Hezb changes
  useEffect(() => {
    if (searchJuzHezb) {
      const hezbNum = parseInt(searchJuzHezb);
      const juzNum = Math.ceil(hezbNum / 2);
      if (searchJuz !== juzNum.toString()) {
        setSearchJuz(juzNum.toString());
      }
    }
  }, [searchJuzHezb]);
  
  // Synchronize Juz and Hezb when Quarter changes
  useEffect(() => {
    if (searchJuzQuarter) {
      const quarterNum = parseInt(searchJuzQuarter);
      const hezbNum = Math.ceil(quarterNum / 4);
      const juzNum = Math.ceil(hezbNum / 2);
      
      if (searchJuzHezb !== hezbNum.toString()) {
        setSearchJuzHezb(hezbNum.toString());
      }
      if (searchJuz !== juzNum.toString()) {
        setSearchJuz(juzNum.toString());
      }
    }
  }, [searchJuzQuarter]);
  
  // Normalize Arabic text by removing diacritics and normalizing character variations
  const normalizeArabic = (text: string) => {
    return text
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, '') // Remove diacritics
      .replace(/[ٱأإآٲٳٵ]/g, 'ا') // Normalize alef variations
      .replace(/[ىي]/g, 'ي') // Normalize yaa
      .replace(/ة/g, 'ه') // Normalize taa marboota
      .replace(/ؤ/g, 'و') // Normalize waw with hamza
      .replace(/ئ/g, 'ي') // Normalize yaa with hamza
      .replace(/\s+/g, '') // Remove spaces
      .toLowerCase();
  };

  // Highlight exact phrase match in text
  const highlightText = (text: string, searchWord: string, isArabic: boolean) => {
    if (!searchWord || !text) return text;
    
    const normalizedSearch = isArabic ? normalizeArabic(searchWord.trim()) : searchWord.trim().toLowerCase();
    const normalizedText = isArabic ? normalizeArabic(text) : text.toLowerCase();
    
    // Find the position of the exact match in normalized text
    const matchIndex = normalizedText.indexOf(normalizedSearch);
    
    if (matchIndex === -1) {
      return text; // No match found
    }
    
    // Calculate the actual position in the original text
    // We need to map back from normalized to original text
    let charCount = 0;
    let actualStartIndex = 0;
    let actualEndIndex = text.length;
    
    // Find start position
    for (let i = 0; i < text.length && charCount < matchIndex; i++) {
      const normalized = isArabic ? normalizeArabic(text[i]) : text[i].toLowerCase();
      if (normalized) charCount += normalized.length;
      actualStartIndex = i + 1;
    }
    
    // Find end position
    charCount = 0;
    for (let i = actualStartIndex; i < text.length && charCount < normalizedSearch.length; i++) {
      const normalized = isArabic ? normalizeArabic(text[i]) : text[i].toLowerCase();
      if (normalized) charCount += normalized.length;
      actualEndIndex = i + 1;
    }
    
    // Split text into before, match, and after
    const before = text.substring(0, actualStartIndex);
    const match = text.substring(actualStartIndex, actualEndIndex);
    const after = text.substring(actualEndIndex);
    
    return (
      <>
        {before}
        <span className="bg-yellow-200 dark:bg-yellow-600 font-semibold rounded px-0.5">
          {match}
        </span>
        {after}
      </>
    );
  };
  
  // Word search functionality - now manual search only, supports multiple words
  const performWordSearch = () => {
    if (searchWord.trim().length >= 2 && ayahData.length > 0) {
      setIsSearchLoading(true);
      
      // Use setTimeout to allow UI to update with loading state
      setTimeout(() => {
        // Search for the full text phrase
        const normalizedSearchFull = normalizeArabic(searchWord.trim());
        const searchFullLower = searchWord.trim().toLowerCase();
        const results: any[] = [];
        
        ayahData.forEach(surahData => {
        surahData.verses?.forEach((verse: any) => {
          const arabicText = verse.text?.ar || '';
          const normalizedArabic = normalizeArabic(arabicText);
          const englishText = (verse.text?.en || '').toLowerCase();
          
          // Check if the full phrase matches
          const matchesArabic = normalizedArabic.includes(normalizedSearchFull);
          const matchesEnglish = englishText.includes(searchFullLower);
          
          if (matchesArabic || matchesEnglish) {
            results.push({
              surahNumber: surahData.number,
              surahName: surahData.name?.ar,
              surahNameEn: surahData.name?.en,
              ayahNumber: verse.number,
              arabicText: verse.text?.ar,
              englishText: verse.text?.en,
              page: verse.page,
              juz: verse.juz
            });
          }
        });
      });
      
        setWordSearchResults(results);
        setIsSearchLoading(false);
      }, 100);
    } else {
      setWordSearchResults([]);
      setIsSearchLoading(false);
    }
  };

  // Clear search results when dialog closes
  useEffect(() => {
    if (!searchOpen) {
      setSearchWord('');
      setWordSearchResults([]);
    }
  }, [searchOpen]);

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

  const handleGoToSurah = async () => {
    if (searchSurah) {
      const surahId = parseInt(searchSurah);
      
      // If ayah is selected, navigate to the page containing that ayah
      if (searchAyah && selectedSurahAyahs.length > 0) {
        const ayahNumber = parseInt(searchAyah);
        const ayahInfo = selectedSurahAyahs.find(v => v.number === ayahNumber);
        if (ayahInfo && ayahInfo.page) {
          isAyahNavigation.current = true;
          setCurrentPlayingAyah({ surah: surahId, ayah: ayahNumber });
          navigate(`/page/${ayahInfo.page}`);
        }
      } else {
        // Otherwise, navigate to the first page of the surah
        const firstPage = await getSurahFirstPage(surahId);
        navigate(`/page/${firstPage}`);
      }
      
      setSearchSurah('');
      setSearchAyah('');
      setSearchOpen(false);
    }
  };

  const handleGoToJuz = async () => {
    const juzNum = parseInt(searchJuz);
    if (juzNum >= 1 && juzNum <= 30) {
      let targetPage;
      
      // If quarter is selected, navigate to that quarter
      if (searchJuzQuarter) {
        const quarterNum = parseInt(searchJuzQuarter);
        targetPage = Math.floor(((quarterNum - 1) * 604) / 240) + 1;
      }
      // If hezb is selected, navigate to that hezb
      else if (searchJuzHezb) {
        const hezbNum = parseInt(searchJuzHezb);
        targetPage = Math.floor(((hezbNum - 1) * 604) / 60) + 1;
      }
      // Otherwise, navigate to the first page of the juz
      else {
        targetPage = await getJuzFirstPage(juzNum);
      }
      
      navigate(`/page/${targetPage}`);
      setSearchJuz('');
      setSearchJuzHezb('');
      setSearchJuzQuarter('');
      setSearchOpen(false);
    }
  };

  const handleGoToSearchPage = () => {
    const pageNum = parseInt(searchPage);
    if (pageNum > 0 && pageNum <= 604) {
      navigate(`/page/${pageNum}`);
      setSearchPage('');
      setSearchOpen(false);
    }
  };

  const toggleBookmark = (pageNum: number = currentPageNum) => {
    const newBookmarks = bookmarks.includes(pageNum)
      ? bookmarks.filter(p => p !== pageNum)
      : [...bookmarks, pageNum];
    
    setBookmarks(newBookmarks);
    localStorage.setItem('quran-bookmarks', JSON.stringify(newBookmarks));
  };

  const isBookmarked = bookmarks.includes(currentPageNum);

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

  // Helper function to get next ayah info
  const getNextAyah = useCallback((surahNum: number, ayahNum: number) => {
    if (!ayahData.length) return null;
    
    const currentSurahData = ayahData.find(s => s.number === surahNum);
    if (!currentSurahData || !currentSurahData.verses) return null;
    
    const totalAyahs = currentSurahData.verses.length;
    
    // Check if there's a next ayah in the current surah
    if (ayahNum < totalAyahs) {
      return { surah: surahNum, ayah: ayahNum + 1 };
    } else if (surahNum < 114) {
      // Move to first ayah of next surah
      return { surah: surahNum + 1, ayah: 1 };
    }
    
    return null; // Last ayah of last surah
  }, [ayahData]);

  // Preload next ayah audio for smooth playback
  const preloadNextAyah = useCallback((currentSurah: number, currentAyah: number) => {
    if (!preloadAudioElement || !selectedReciter) return;
    
    const nextAyah = getNextAyah(currentSurah, currentAyah);
    if (!nextAyah) return;
    
    const surahPadded = nextAyah.surah.toString().padStart(3, '0');
    const ayahPadded = nextAyah.ayah.toString().padStart(3, '0');
    const audioUrl = `${selectedReciter.baseUrl}/${surahPadded}${ayahPadded}.mp3`;
    
    // Set the source which triggers browser to start preloading
    preloadAudioElement.src = audioUrl;
    preloadAudioElement.load();
  }, [preloadAudioElement, selectedReciter, getNextAyah]);

  // Audio player functions
  const playAyah = useCallback((surahNum: number, ayahNum: number) => {
    if (!audioElement || !selectedReciter) return;
    
    // Persist selected reciter
    if (selectedReciter.folder) {
      localStorage.setItem('quran-last-reciter', selectedReciter.folder);
    }
    
    const surahPadded = surahNum.toString().padStart(3, '0');
    const ayahPadded = ayahNum.toString().padStart(3, '0');
    const audioUrl = `${selectedReciter.baseUrl}/${surahPadded}${ayahPadded}.mp3`;
    
    setCurrentPlayingAyah({ surah: surahNum, ayah: ayahNum });
    
    // Navigate to the page containing this ayah if not already on it
    const surahData = ayahData.find(s => s.number === surahNum);
    if (surahData && surahData.verses) {
      const verse = surahData.verses.find((v: any) => v.number === ayahNum);
      if (verse && verse.page && verse.page !== currentPageNum) {
        // Set flag to prevent auto-switch to first ayah when page loads
        isAyahNavigation.current = true;
        
        // Set audio source and play after a short delay to allow navigation
        audioElement.src = audioUrl;
        navigate(`/page/${verse.page}#${surahNum}-${ayahNum}`);
        
        // Play audio after navigation with a delay
        setTimeout(() => {
          if (audioElement && audioElement.src === audioUrl) {
            audioElement.play().catch(err => console.error('Failed to play audio:', err));
            // Preload next ayah after starting playback
            preloadNextAyah(surahNum, ayahNum);
          }
          isAyahNavigation.current = false;
        }, 300);
        
        return;
      }
    }
    
    // Same page - play immediately
    audioElement.src = audioUrl;
    audioElement.play().catch(err => console.error('Failed to play audio:', err));
    
    // Preload next ayah for smooth playback
    preloadNextAyah(surahNum, ayahNum);
  }, [audioElement, selectedReciter, ayahData, currentPageNum, navigate, preloadNextAyah]);
  
  const togglePlayPause = () => {
    if (!audioElement) return;
    
    if (isPlaying) {
      audioElement.pause();
    } else {
      if (currentPlayingAyah) {
        // Check if audio is already loaded (has source and can resume)
        if (audioElement.src && audioElement.currentTime > 0) {
          // Resume from paused position
          audioElement.play().catch(err => {
            console.error('Failed to resume audio:', err);
            playAyah(currentPlayingAyah.surah, currentPlayingAyah.ayah);
          });
          preloadNextAyah(currentPlayingAyah.surah, currentPlayingAyah.ayah);
        } else {
          // First time playing - load and play the ayah shown in play bar
          playAyah(currentPlayingAyah.surah, currentPlayingAyah.ayah);
        }
      } else {
        // Play first ayah of current page
        playAyah(currentSurahId, currentPageAyah || 1);
      }
    }
  };
  
  const startRepeat = () => {
    // Use defaults if values are 0
    const passageCount = repeatPassageCount || 1;
    const ayahCount = repeatAyahCount || 1;
    const startSurah = repeatStartSurah || 1;
    const startAyah = repeatStartAyah || 1;
    const endSurah = repeatEndSurah || 1;
    const endAyah = repeatEndAyah || 1;
    
    setIsRepeatActive(true);
    setCurrentRepeatPassage(1);
    setCurrentRepeatSurah(startSurah);
    setCurrentRepeatAyah(startAyah);
    setCurrentRepeatAyahCount(1);
    // Start playing the first ayah
    playAyah(startSurah, startAyah);
  };
  
  const stopAudio = () => {
    if (!audioElement) return;
    audioElement.pause();
    audioElement.currentTime = 0;
    setIsPlaying(false);
    // Stop repeat if active
    setIsRepeatActive(false);
    setCurrentRepeatPassage(0);
    setCurrentRepeatAyah(0);
    setCurrentRepeatSurah(0);
    setCurrentRepeatAyahCount(0);
  };

  return (
    <div className="w-full h-screen bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Enhanced Islamic Top Header */}
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg shadow-sm"
      >
        <div className="px-4 md:px-8 py-3 md:py-4 flex items-center justify-between gap-3 md:gap-6 text-gray-800 dark:text-gray-200 relative">
          {/* Surah Search Button - Enhanced with Islamic styling */}
          <button
            onClick={() => {
              setSearchTab('surah');
              setSearchSurah(currentSurahId.toString());
              setSearchOpen(true);
            }}
            className="group relative bg-gradient-to-br from-emerald-100 to-emerald-50 hover:from-emerald-200 hover:to-emerald-100 dark:from-emerald-900/50 dark:to-emerald-800/40 dark:hover:from-emerald-800 dark:hover:to-emerald-700 text-emerald-900 dark:text-emerald-100 rounded-xl px-3 md:px-4 py-1.5 md:py-2 text-base md:text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer min-w-[100px] md:min-w-[140px] text-center transition-all truncate border border-emerald-200/50 dark:border-emerald-700/50"
          >
            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
            <span className="relative">
              {formatNumber(currentSurah.id)}. {language === 'ar' ? currentSurah.name : currentSurah.englishName}
            </span>
          </button>

          {/* Page Display/Input - Centered with Islamic ornament */}
          <button
            onClick={() => {
              setSearchTab('page');
              setSearchPage(currentPageNum.toString());
              setSearchOpen(true);
            }}
            className="group absolute left-1/2 -translate-x-1/2 bg-gradient-to-br from-gray-50 via-white to-gray-50/50 hover:from-gray-100 hover:via-gray-50 hover:to-gray-100/50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700 dark:hover:from-gray-700 dark:hover:via-gray-700 dark:hover:to-gray-600 text-gray-900 dark:text-gray-100 rounded-xl px-4 md:px-6 py-1.5 md:py-2 text-base md:text-xl font-bold focus:outline-none focus:ring-2 focus:ring-gray-500/50 cursor-pointer transition-all border-2 border-gray-300/50 dark:border-gray-700/50"
          >
            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-white/30 to-transparent pointer-events-none" />
            <span className="relative">
              {isRTL ? formatNumber(currentPageNum) : `Page ${formatNumber(currentPageNum)}`}
            </span>
          </button>

          {/* Juz Search Button - Enhanced with Islamic styling */}
          <button
            onClick={() => {
              setSearchTab('juz');
              setSearchJuz(currentJuz.toString());
              setSearchJuzHezb(currentHezb.toString());
              setSearchJuzQuarter(currentQuarter.toString());
              setSearchOpen(true);
            }}
            className="group relative bg-gradient-to-br from-emerald-100 to-emerald-50 hover:from-emerald-200 hover:to-emerald-100 dark:from-emerald-900/50 dark:to-emerald-800/40 dark:hover:from-emerald-800 dark:hover:to-emerald-700 text-emerald-900 dark:text-emerald-100 rounded-xl px-3 md:px-4 py-1.5 md:py-2 text-base md:text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer flex-shrink-0 text-center transition-all min-w-[100px] md:min-w-[140px] truncate border border-emerald-200/50 dark:border-emerald-700/50"
          >
            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
            <span className="relative">
              {isRTL ? `الجزء ${formatNumber(currentJuz)}` : `Juz ${formatNumber(currentJuz)}`}
            </span>
          </button>
        </div>
      </motion.header>

      {/* Main Content - Two Page Display */}
      <main className="flex-1 flex items-center justify-center gap-6 overflow-hidden">
        {/* Navigation Arrow Left - Hidden on mobile */}
        <motion.button
          whileHover={{ scale: 1.1, x: -5 }}
          whileTap={{ scale: 0.9 }}
          onClick={handlePreviousPage}
          disabled={currentPageNum <= 2}
          className="hidden md:flex w-14 h-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl disabled:hover:scale-100"
          aria-label="Previous pages"
        >
          <ChevronRight className="w-7 h-7" />
        </motion.button>

        {/* Page Display Container */}
        <div className="flex-1 flex items-center justify-center gap-6 max-w-7xl">
          {viewMode === 'double' && !isMobile ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div 
                key={`${currentPageNum}-${secondPageNum}`}
                initial={{ x: isRTL ? -100 : 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: isRTL ? 100 : -100, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="flex-1 flex items-center justify-center gap-6 max-w-7xl"
              >
                {/* In LTR: show left page first, then right */}
                {/* In RTL: show right page first, then left (for RTL flex direction) */}
                {!isRTL ? (
                  <>
                    {/* Left Page */}
                    {leftPageNum > 0 && leftPageNum <= 604 && (
                      <div className={`flex-1 max-w-[600px] h-full flex items-center justify-center ${isTashelOrMadinah ? 'py-2' : ''}`}>
                        <div className="relative group">
                          {(bookmarks.includes(leftPageNum) || memorizationBookmarks.includes(leftPageNum) || readingBookmarks.includes(leftPageNum)) && (
                            <div className="absolute top-0 left-0 z-10 flex gap-0.5 -translate-x-1">
                              {bookmarks.includes(leftPageNum) && (
                                <Bookmark className="w-6 h-6 md:w-8 md:h-8 fill-amber-500 text-amber-500 drop-shadow-lg" />
                              )}
                              {memorizationBookmarks.includes(leftPageNum) && (
                                <BookMarked className="w-6 h-6 md:w-8 md:h-8 fill-emerald-600 text-emerald-600 drop-shadow-lg" />
                              )}
                              {readingBookmarks.includes(leftPageNum) && (
                                <BookOpen className="w-6 h-6 md:w-8 md:h-8 fill-blue-600 text-blue-600 drop-shadow-lg" />
                              )}
                            </div>
                          )}
                          <img
                            src={`${getMushafPath()}/${getPageImageFilename(leftPageNum)}`}
                            alt={`${t('page')} ${leftPageNum}`}
                            className={`relative max-w-full ${isTashelOrMadinah ? 'max-h-[calc(100vh-120px)]' : 'max-h-[calc(100vh-80px)]'} w-auto h-auto object-contain shadow-2xl rounded-xl border-4 border-white mx-auto`}
                            loading="lazy"
                          />
                        </div>
                      </div>
                    )}
                    {/* Right Page */}
                    {rightPageNum > 0 && rightPageNum <= 604 && (
                      <div className={`flex-1 max-w-[600px] h-full flex items-center justify-center ${isTashelOrMadinah ? 'py-2' : ''}`}>
                        <div className="relative group">
                          {(bookmarks.includes(rightPageNum) || memorizationBookmarks.includes(rightPageNum) || readingBookmarks.includes(rightPageNum)) && (
                            <div className="absolute top-0 right-0 z-10 flex gap-0.5 translate-x-1">
                              {bookmarks.includes(rightPageNum) && (
                                <Bookmark className="w-6 h-6 md:w-8 md:h-8 fill-amber-500 text-amber-500 drop-shadow-lg" />
                              )}
                              {memorizationBookmarks.includes(rightPageNum) && (
                                <BookMarked className="w-6 h-6 md:w-8 md:h-8 fill-emerald-600 text-emerald-600 drop-shadow-lg" />
                              )}
                              {readingBookmarks.includes(rightPageNum) && (
                                <BookOpen className="w-6 h-6 md:w-8 md:h-8 fill-blue-600 text-blue-600 drop-shadow-lg" />
                              )}
                            </div>
                          )}
                          <img
                            src={`${getMushafPath()}/${getPageImageFilename(rightPageNum)}`}
                            alt={`${t('page')} ${rightPageNum}`}
                            className={`relative max-w-full ${isTashelOrMadinah ? 'max-h-[calc(100vh-120px)]' : 'max-h-[calc(100vh-80px)]'} w-auto h-auto object-contain shadow-2xl rounded-xl border-4 border-white mx-auto`}
                            loading="lazy"
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Right Page (shown first in RTL) */}
                    {rightPageNum > 0 && rightPageNum <= 604 && (
                      <div className={`flex-1 max-w-[600px] h-full flex items-center justify-center ${isTashelOrMadinah ? 'py-2' : ''}`}>
                        <div className="relative group">
                          {(bookmarks.includes(rightPageNum) || memorizationBookmarks.includes(rightPageNum) || readingBookmarks.includes(rightPageNum)) && (
                            <div className="absolute top-0 right-0 z-10 flex gap-0.5 translate-x-1">
                              {bookmarks.includes(rightPageNum) && (
                                <Bookmark className="w-6 h-6 md:w-8 md:h-8 fill-amber-500 text-amber-500 drop-shadow-lg" />
                              )}
                              {memorizationBookmarks.includes(rightPageNum) && (
                                <BookMarked className="w-6 h-6 md:w-8 md:h-8 fill-emerald-600 text-emerald-600 drop-shadow-lg" />
                              )}
                              {readingBookmarks.includes(rightPageNum) && (
                                <BookOpen className="w-6 h-6 md:w-8 md:h-8 fill-blue-600 text-blue-600 drop-shadow-lg" />
                              )}
                            </div>
                          )}
                          <img
                            src={`${getMushafPath()}/${getPageImageFilename(rightPageNum)}`}
                            alt={`${t('page')} ${rightPageNum}`}
                            className={`relative max-w-full ${isTashelOrMadinah ? 'max-h-[calc(100vh-120px)]' : 'max-h-[calc(100vh-80px)]'} w-auto h-auto object-contain shadow-2xl rounded-xl border-4 border-white mx-auto`}
                            loading="lazy"
                          />
                        </div>
                      </div>
                    )}
                    {/* Left Page (shown second in RTL) */}
                    {leftPageNum > 0 && leftPageNum <= 604 && (
                      <div className={`flex-1 max-w-[600px] h-full flex items-center justify-center ${isTashelOrMadinah ? 'py-2' : ''}`}>
                        <div className="relative group">
                          {(bookmarks.includes(leftPageNum) || memorizationBookmarks.includes(leftPageNum) || readingBookmarks.includes(leftPageNum)) && (
                            <div className="absolute top-0 left-0 z-10 flex gap-0.5 -translate-x-1">
                              {bookmarks.includes(leftPageNum) && (
                                <Bookmark className="w-6 h-6 md:w-8 md:h-8 fill-amber-500 text-amber-500 drop-shadow-lg" />
                              )}
                              {memorizationBookmarks.includes(leftPageNum) && (
                                <BookMarked className="w-6 h-6 md:w-8 md:h-8 fill-emerald-600 text-emerald-600 drop-shadow-lg" />
                              )}
                              {readingBookmarks.includes(leftPageNum) && (
                                <BookOpen className="w-6 h-6 md:w-8 md:h-8 fill-blue-600 text-blue-600 drop-shadow-lg" />
                              )}
                            </div>
                          )}
                          <img
                            src={`${getMushafPath()}/${getPageImageFilename(leftPageNum)}`}
                            alt={`${t('page')} ${leftPageNum}`}
                            className={`relative max-w-full ${isTashelOrMadinah ? 'max-h-[calc(100vh-120px)]' : 'max-h-[calc(100vh-80px)]'} w-auto h-auto object-contain shadow-2xl rounded-xl border-4 border-white mx-auto`}
                            loading="lazy"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            /* Horizontal Scroll View - Single Page Mode */
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 w-full h-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth flex"
              style={{ 
                scrollbarWidth: 'none', 
                msOverflowStyle: 'none',
                direction: isRTL ? 'rtl' : 'ltr'
              }}
            >
              <style>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {/* Only render current page and adjacent pages based on pagesToLoad setting */}
              {(() => {
                const pages: (number | null)[] = [];
                // Add previous pages
                for (let i = pagesToLoad; i >= 1; i--) {
                  const pageNum = currentPageNum - i;
                  pages.push(pageNum >= 1 ? pageNum : null);
                }
                // Add current page
                pages.push(currentPageNum);
                // Add next pages
                for (let i = 1; i <= pagesToLoad; i++) {
                  const pageNum = currentPageNum + i;
                  pages.push(pageNum <= 604 ? pageNum : null);
                }
                return pages.filter((pageNum): pageNum is number => pageNum !== null);
              })().map((pageNum, index) => {
                const imageFilename = getPageImageFilename(pageNum);
                const isOddPage = pageNum % 2 !== 0; // Odd pages are right pages
                console.log(`Rendering page ${pageNum}: ${getMushafPath()}/${imageFilename}`);
                return (
                <div
                  key={pageNum}
                  id={`page-${pageNum}`}
                  className={`flex-shrink-0 h-full flex items-center justify-center snap-center ${isTashelOrMadinah ? 'py-2' : ''}`}
                  style={{ width: '100%', minWidth: '100%' }}
                >
                  <div className={`relative flex items-center justify-center ${mushafType === 'tashel' ? 'px-2' : ''}`}>
                    {/* Bookmark indicator */}
                    {(bookmarks.includes(pageNum) || memorizationBookmarks.includes(pageNum) || readingBookmarks.includes(pageNum)) && (
                      <div className={`absolute top-0 ${pageNum % 2 !== 0 ? 'right-0 translate-x-1' : 'left-0 -translate-x-1'} z-10 flex gap-0.5`}>
                        {bookmarks.includes(pageNum) && (
                          <Bookmark className="w-6 h-6 md:w-8 md:h-8 fill-amber-500 text-amber-500 drop-shadow-lg" />
                        )}
                        {memorizationBookmarks.includes(pageNum) && (
                          <BookMarked className="w-6 h-6 md:w-8 md:h-8 fill-emerald-600 text-emerald-600 drop-shadow-lg" />
                        )}
                        {readingBookmarks.includes(pageNum) && (
                          <BookOpen className="w-6 h-6 md:w-8 md:h-8 fill-blue-600 text-blue-600 drop-shadow-lg" />
                        )}
                      </div>
                    )}
                    {/* Page marker/bookmark icon */}
                    <div 
                      className={`absolute top-0 ${isOddPage ? 'left-0' : 'right-0'} z-10 pointer-events-none`}
                      style={{ 
                        filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
                      }}
                    >
                      <svg 
                        width="10" 
                        height="70" 
                        viewBox="0 0 10 70" 
                        fill="none" 
                        xmlns="http://www.w3.org/2000/svg"
                        className="opacity-80"
                      >
                        {/* Bookmark ribbon shape */}
                        <path 
                          d="M0 0 L10 0 L10 70 L5 60 L0 70 Z" 
                          fill="url(#bookmarkGradient)" 
                          stroke="#000000"
                          strokeWidth="0.5"
                        />
                        <defs>
                          <linearGradient id="bookmarkGradient" x1="5" y1="0" x2="5" y2="70">
                            <stop offset="0%" stopColor="#166534" />
                            <stop offset="100%" stopColor="#14532d" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                    <img
                      src={`${getMushafPath()}/${imageFilename}`}
                      alt={`${t('page')} ${pageNum}`}
                      className={`max-w-full ${isTashelOrMadinah ? 'max-h-[calc(100vh-120px)]' : 'max-h-[calc(100vh-80px)]'} w-auto h-auto object-contain md:shadow-2xl md:rounded-xl md:border-4 md:border-white mx-auto`}
                      loading="eager"
                    />
                  </div>
                </div>
              );})}
            </div>
          )}
        </div>

        {/* Navigation Arrow Right - Hidden on mobile */}
        <motion.button
          whileHover={{ scale: 1.1, x: 5 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleNextPage}
          disabled={currentPageNum >= 604}
          className="hidden md:flex w-14 h-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl disabled:hover:scale-100"
          aria-label="Next pages"
        >
          <ChevronLeft className="w-7 h-7" />
        </motion.button>
      </main>

      {/* Audio Player Bottom Bar */}
      <div className="flex justify-center px-2 md:px-0">
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="w-[98%] md:max-w-3xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-emerald-950 backdrop-blur-lg border border-emerald-200 dark:border-emerald-700 rounded-full"
        >
          <div className="flex items-center py-2 px-2 md:py-3 md:px-7 gap-1 md:gap-0 md:justify-between w-full">
            {/* Ayah Selection - Left */}
            <div className="flex items-center gap-1.5 md:gap-3">
              <button
                onClick={() => setShowAyahSelector(true)}
                className="flex items-center justify-center gap-1 md:gap-2 px-1 md:px-3 py-1 md:py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
              >
                <span className="text-base md:text-xl font-medium text-gray-900 dark:text-gray-100 min-w-[20px] md:min-w-[32px] text-center">
                  {currentPlayingAyah ? formatNumber(currentPlayingAyah.ayah) : '--'}
                </span>
                <ChevronDown className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />
              </button>
              
              <button
                onClick={() => {
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
                className={`flex items-center justify-center transition-all rounded-full p-1 border-2 ${
                  isRepeatActive 
                    ? 'text-green-700 dark:text-green-400 border-green-500 bg-green-50 dark:bg-green-900/20' 
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 border-transparent'
                }`}
                title="Repeat"
              >
                <Repeat className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
            
            {/* Reciter Selection - Center */}
            <button
              onClick={() => setShowReciterDialog(true)}
              className="flex items-center gap-1 md:gap-2 px-1 md:px-4 py-1 md:py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-all flex-[2] md:flex-1 justify-center min-w-0 md:max-w-xs"
            >
              <Volume2 className="w-3.5 h-3.5 md:w-5 md:h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span className="text-base md:text-xl font-medium text-gray-900 dark:text-gray-100 truncate">
                {selectedReciter ? (language === 'ar' ? selectedReciter.nameAr : selectedReciter.name) : t('selectReciter')}
              </span>
              <ChevronDown className="w-3 h-3 md:w-4 md:h-4 text-gray-400 flex-shrink-0" />
            </button>
            
            {/* Playback Controls - Right */}
            <div className="flex items-center justify-end gap-1.5 md:gap-3">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={stopAudio}
                className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 flex items-center justify-center transition-all"
                title={t('stop')}
              >
                <Square className="w-3.5 h-3.5 md:w-5 md:h-5" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={togglePlayPause}
                className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white flex items-center justify-center shadow-md transition-all"
                title={isPlaying ? t('pause') : t('play')}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 md:w-6 md:h-6" />
                ) : (
                  <Play className="w-4 h-4 md:w-6 md:h-6 ml-0.5" />
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Modern Bottom Toolbar */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className={cn(
          "bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg px-2 md:px-6 flex items-stretch justify-between mt-2",
          showBottomBarText ? "py-0.5 md:py-1" : "py-2 md:py-3"
        )}
      >
        {/* Go To */}
        <div className="flex-1 flex justify-center">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setSearchMode('navigation');
              setSearchTab('surah');
              // Prefill with current values
              setSearchSurah(currentSurahId.toString());
              setSearchAyah(currentPageAyah?.toString() || '1');
              setFilterJuz(currentJuz.toString());
              setFilterHezb(currentHezb.toString());
              setSearchJuz(currentJuz.toString());
              setSearchJuzHezb(currentHezb.toString());
              setSearchJuzQuarter(currentQuarter.toString());
              setSearchOpen(true);
            }}
            className="flex flex-col items-center gap-0.5 md:gap-1 text-gray-600 dark:text-gray-300 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors group"
            title={t('search')}
          >
            <Navigation className="w-7 h-7 md:w-8 md:h-8 group-hover:fill-emerald-500/20" />
            {showBottomBarText && <span className="text-base md:text-xl font-medium">{isRTL ? 'انتقل' : 'Go To'}</span>}
          </motion.button>
        </div>

        {/* Word Search */}
        <div className="flex-1 flex justify-center">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setSearchMode('word');
              setSearchTab('word');
              setSearchOpen(true);
            }}
            className="flex flex-col items-center gap-0.5 md:gap-1 text-gray-600 dark:text-gray-300 hover:text-purple-500 dark:hover:text-purple-400 transition-colors group"
            title={isRTL ? 'بحث عن كلمة' : 'Word Search'}
          >
            <Search className="w-7 h-7 md:w-8 md:h-8 group-hover:fill-purple-500/20" />
            {showBottomBarText && <span className="text-base md:text-xl font-medium">{isRTL ? ' بحث' : 'Search'}</span>}
          </motion.button>
        </div>

        {/* Bookmark Button */}
        <div className="flex-1 flex justify-center">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setBookmarkSurahId(currentSurahId);
              setBookmarkAyahNum(currentPageAyah || 1);
              setShowBookmarkDialog(true);
            }}
            className="flex flex-col items-center gap-0.5 md:gap-1 text-gray-600 dark:text-gray-300 hover:text-amber-500 dark:hover:text-amber-400 transition-colors group"
            title={t('bookmarks')}
          >
            <div className="relative">
              <Bookmark className="w-7 h-7 md:w-8 md:h-8 group-hover:fill-amber-500/20" />
              {(bookmarks.length + memorizationBookmarks.length + readingBookmarks.length > 0) && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[8px] rounded-full min-w-[12px] h-3 px-1 flex items-center justify-center">
                  {bookmarks.length + memorizationBookmarks.length + readingBookmarks.length}
                </span>
              )}
            </div>
            {showBottomBarText && <span className="text-base md:text-xl font-medium">{isRTL ? 'علامة' : t('bookmark')}</span>}
          </motion.button>
        </div>

        {/* Settings */}
        <div className="flex-1 flex justify-center">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowSettingsDialog(true)}
            className="flex flex-col items-center gap-0.5 md:gap-1 text-gray-600 dark:text-gray-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors group"
            title={t('settings')}
          >
            <Settings className="w-7 h-7 md:w-8 md:h-8 group-hover:fill-indigo-500/20" />
            {showBottomBarText && <span className="text-base md:text-xl font-medium">{t('settings')}</span>}
          </motion.button>
        </div>

        {/* View Mode Toggle - Hidden on mobile */}
        {!isMobile && (
          <div className="flex-1 flex justify-center">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setViewMode(viewMode === 'single' ? 'double' : 'single')}
              className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors group"
              title={viewMode === 'single' ? (isRTL ? 'عرض صفحتين' : 'Two Pages') : (isRTL ? 'صفحة واحدة' : 'Single Page')}
            >
              <div className="relative w-8 h-8">
                {viewMode === 'single' ? (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="7" y="4" width="10" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="4" y="4" width="7" height="16" rx="1" />
                    <rect x="13" y="4" width="7" height="16" rx="1" />
                  </svg>
                )}
              </div>
              {showBottomBarText && <span className="text-base md:text-xl font-medium">
                {viewMode === 'single' ? (isRTL ? 'صفحتين' : '2 Pages') : (isRTL ? 'صفحة' : '1 Page')}
              </span>}
            </motion.button>
          </div>
        )}
      </motion.div>

      {/* Search/Navigation Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className={`sm:max-w-md max-w-[90vw] max-h-[85vh] overflow-y-auto rounded-xl border border-emerald-500 ${searchMode === 'word' ? '!top-[5vh] !translate-y-0' : ''} ${isRTL ? 'rtl' : 'ltr'}`}>
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold bg-gradient-to-r from-emerald-800 to-emerald-600 bg-clip-text text-transparent">
              {searchMode === 'word' ? (isRTL ? 'بحث فى نصوص الايات' : 'Search') : (isRTL ? 'انتقل' : 'Go To')}
            </DialogTitle>
          </DialogHeader>
          
          {searchMode === 'word' ? (
            /* Word Search - Simplified without tabs */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t('searchWordPlaceholder')}
                  value={searchWord}
                  onChange={(e) => {
                    setSearchWord(e.target.value);
                    setWordSearchResults([]); // Clear results when user types
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      performWordSearch();
                    }
                  }}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-base md:text-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <Button
                  onClick={performWordSearch}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                >
                  {isRTL ? ' بحث' : 'Search'}
                </Button>
              </div>
              
              {isSearchLoading && (
                <div className="flex flex-col items-center justify-center py-8 space-y-3">
                  <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-base md:text-xl text-gray-600 dark:text-gray-400">
                    {isRTL ? 'جاري البحث...' : 'Searching...'}
                  </p>
                </div>
              )}
              
              {!isSearchLoading && wordSearchResults.length > 0 && (
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {wordSearchResults.length > 0 ? (
                    <>
                      <div className="text-base md:text-xl font-medium text-gray-600 dark:text-gray-400 mb-2">
                        {t('foundIn')} {wordSearchResults.length} {t('ayahs')}
                      </div>
                      {wordSearchResults.map((result, index) => (
                        <motion.button
                          key={`${result.surahNumber}-${result.ayahNumber}-${index}`}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => {
                            navigate(`/page/${result.page}`);
                            setSearchOpen(false);
                            setSearchWord('');
                          }}
                          className={`w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all ${isRTL ? 'text-right' : 'text-left'}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="font-semibold text-base md:text-xl text-emerald-600 dark:text-emerald-400">
                              {isRTL ? result.surahName : result.surahNameEn} - {isRTL ? 'الآية' : 'Ayah'} {result.ayahNumber}
                            </div>
                            <div className="text-base md:text-xl text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {isRTL ? 'صفحة' : 'Page'} {result.page}
                            </div>
                          </div>
                          <div className={`text-base md:text-xl text-gray-700 dark:text-gray-300 ${isRTL ? 'text-right' : 'text-left'}`}>
                            {isRTL 
                              ? highlightText(result.arabicText, searchWord, true)
                              : highlightText(result.englishText, searchWord, false)
                            }
                          </div>
                        </motion.button>
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      {t('noResults')}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            /* Navigation Search - With tabs */
            <Tabs value={searchTab} onValueChange={setSearchTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-11 md:h-12">
                <TabsTrigger value="surah" className="text-base md:text-xl">{isRTL ? 'سورة' : 'Surah'}</TabsTrigger>
                <TabsTrigger value="juz" className="text-base md:text-xl">{isRTL ? 'جزء' : 'Juz'}</TabsTrigger>
                <TabsTrigger value="page" className="text-base md:text-xl">{isRTL ? 'صفحة' : 'Page'}</TabsTrigger>
              </TabsList>

            {/* Surah Tab */}
            <TabsContent value="surah" className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Filter Dropdowns Row */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Juz Filter */}
                  <div>
                    <label className={`text-base md:text-xl font-medium mb-1 block ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('filterByJuz')}
                    </label>
                    <select
                      value={filterJuz}
                      onChange={(e) => {
                        const juzValue = e.target.value;
                        setFilterJuz(juzValue);
                        
                        if (juzValue) {
                          // Auto-prefill first hizb for the selected juz
                          const juzNum = parseInt(juzValue);
                          const firstHezb = (juzNum - 1) * 2 + 1;
                          setFilterHezb(firstHezb.toString());
                        } else {
                          // Reset Hizb filter when Juz is cleared
                          setFilterHezb('');
                        }
                      }}
                      className="w-full px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-base md:text-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">{t('all')}</option>
                      {Array.from({ length: 30 }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>
                          {formatNumber(num)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Surah Dropdown */}
                  <div>
                    <label className={`text-base md:text-xl font-medium mb-1 block ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('chooseSurah')}
                    </label>
                    <select
                      value={searchSurah}
                      onChange={(e) => {
                        setSearchSurah(e.target.value);
                        // Pre-fill ayah to 1 when surah is selected
                        setSearchAyah('1');
                      }}
                      className="w-full px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-base md:text-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">{t('selectSurah')}</option>
                      {(() => {
                        // Filter surahs based on selected Juz/Hizb
                        let filteredSurahs = surahs;
                        
                        if (filterHezb) {
                          const hezbNum = parseInt(filterHezb);
                          // Hizb to Surah range mapping based on hizb_quarters data
                          // Each Hizb starts at a specific Surah and continues until the next Hizb starts
                          const hezbRanges: Record<number, number[]> = {
                            1: [1, 2], 2: [2], 3: [2], 4: [2, 3], 5: [3], 6: [3],
                            7: [3], 8: [3, 4], 9: [4], 10: [4], 11: [4, 5], 12: [5],
                            13: [5, 6], 14: [6], 15: [6, 7], 16: [7], 17: [7], 18: [7, 8],
                            19: [8, 9], 20: [9], 21: [9, 10], 22: [10, 11], 23: [11], 24: [11, 12],
                            25: [12, 13], 26: [13, 14, 15], 27: [15, 16], 28: [16, 17], 29: [17, 18], 30: [18, 19, 20],
                            31: [20, 21], 32: [21, 22], 33: [22, 23], 34: [23, 24], 35: [24, 25], 36: [25, 26],
                            37: [26, 27], 38: [27, 28], 39: [28, 29], 40: [29, 30, 31], 41: [31, 32, 33], 42: [33],
                            43: [33, 34], 44: [34, 35, 36], 45: [36, 37], 46: [37, 38, 39], 47: [39, 40], 48: [40, 41],
                            49: [41, 42, 43], 50: [43, 44, 45, 46], 51: [46, 47, 48], 52: [48, 49, 50, 51], 53: [51, 52, 53, 54, 55], 54: [55, 56, 57, 58],
                            55: [58, 59, 60, 61, 62], 56: [62, 63, 64, 65, 66, 67], 57: [67, 68, 69, 70, 71, 72], 58: [72, 73, 74, 75, 76, 77, 78],
                            59: [78, 79, 80, 81, 82, 83, 84, 85, 86, 87], 60: [87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114],
                          };
                          
                          let allowedSurahs = hezbRanges[hezbNum] || [];
                          
                          // For even Hizbs (except Hizb 60 which is the last), remove the last surah
                          if (hezbNum % 2 === 0 && hezbNum !== 60 && allowedSurahs.length > 1) {
                            allowedSurahs = allowedSurahs.slice(0, -1);
                          }
                          
                          filteredSurahs = filteredSurahs.filter(s => allowedSurahs.includes(s.id));
                        } else if (filterJuz) {
                          const juzNum = parseInt(filterJuz);
                          // Juz to Surah mapping (30 Juzs)
                          const juzRanges: Record<number, number[]> = {
                            1: [1, 2], 2: [2], 3: [2, 3], 4: [3, 4], 5: [4],
                            6: [4, 5], 7: [5, 6], 8: [6, 7], 9: [7, 8],
                            10: [8, 9], 11: [9, 10, 11], 12: [11, 12, 13],
                            13: [13, 14, 15], 14: [15, 16], 15: [17],
                            16: [18], 17: [21], 18: [23], 19: [25, 26, 27],
                            20: [27, 28, 29], 21: [29, 30, 31, 32, 33],
                            22: [33, 34, 35, 36], 23: [36, 37, 38, 39],
                            24: [39, 40, 41], 25: [41, 42, 43, 44, 45],
                            26: [46, 47, 48, 49, 50, 51], 27: [51, 52, 53, 54, 55, 56, 57],
                            28: [58, 59, 60, 61, 62, 63, 64, 65, 66],
                            29: [67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77],
                            30: [78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114]
                          };
                          
                          const allowedSurahs = juzRanges[juzNum] || [];
                          filteredSurahs = filteredSurahs.filter(s => allowedSurahs.includes(s.id));
                        }
                        
                        return filteredSurahs.map(s => (
                          <option key={s.id} value={s.id}>
                            {isRTL ? s.name : s.englishName}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>

                  {/* Hizb Filter */}
                  <div>
                    <label className={`text-base md:text-xl font-medium mb-1 block ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('filterByHezb')}
                    </label>
                    <select
                      value={filterHezb}
                      onChange={(e) => setFilterHezb(e.target.value)}
                      className="w-full px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-base md:text-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">{t('all')}</option>
                      {(() => {
                        if (filterJuz) {
                          // Show only the 2 hizbs for selected Juz as "Hizb 1" and "Hizb 2"
                          const juzNum = parseInt(filterJuz);
                          const firstHezb = (juzNum - 1) * 2 + 1;
                          const secondHezb = firstHezb + 1;
                          return [
                            <option key={firstHezb} value={firstHezb}>
                              {formatNumber(1)}
                            </option>,
                            <option key={secondHezb} value={secondHezb}>
                              {formatNumber(2)}
                            </option>
                          ];
                        } else {
                          // Show all 60 hizbs
                          return Array.from({ length: 60 }, (_, i) => i + 1).map(num => (
                            <option key={num} value={num}>
                              {formatNumber(num)}
                            </option>
                          ));
                        }
                      })()}
                    </select>
                  </div>

                  {/* Ayah Filter */}
                  <div>
                    <label className={`text-base md:text-xl font-medium mb-1 block ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('chooseAyah')}
                    </label>
                    <select
                      value={searchAyah}
                      onChange={(e) => setSearchAyah(e.target.value)}
                      disabled={!searchSurah || selectedSurahAyahs.length === 0}
                      className="w-full px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-base md:text-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">{t('selectAyah')}</option>
                      {searchSurah && selectedSurahAyahs.length > 0 && selectedSurahAyahs.map(ayah => (
                        <option key={ayah.number} value={ayah.number}>
                          {formatNumber(ayah.number)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <Button
                  onClick={handleGoToSurah}
                  disabled={!searchSurah && !searchAyah}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                >
                  {searchAyah ? t('goToAyah') : t('goToSurah')}
                </Button>
              </motion.div>
            </TabsContent>

            {/* Juz Tab */}
            <TabsContent value="juz" className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className={`text-base md:text-xl font-medium mb-2 block ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('selectJuz')}
                  </label>
                  <select
                    value={searchJuz}
                    onChange={(e) => {
                      const juzValue = e.target.value;
                      setSearchJuz(juzValue);
                      
                      if (juzValue) {
                        // Auto-prefill first hizb for the selected juz
                        const juzNum = parseInt(juzValue);
                        const firstHezb = (juzNum - 1) * 2 + 1;
                        setSearchJuzHezb(firstHezb.toString());
                        
                        // Auto-prefill first quarter of the first hizb
                        const firstQuarter = (firstHezb - 1) * 4 + 1;
                        setSearchJuzQuarter(firstQuarter.toString());
                      } else {
                        // Clear dependent selections when clearing Juz
                        setSearchJuzHezb('');
                        setSearchJuzQuarter('');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-base md:text-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">{t('selectJuz')}</option>
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>
                        {formatNumber(num)}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className={`text-base md:text-xl font-medium mb-2 block ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('selectHezb')}
                  </label>
                  <select
                    value={searchJuzHezb}
                    onChange={(e) => {
                      const hezbValue = e.target.value;
                      setSearchJuzHezb(hezbValue);
                      
                      if (hezbValue) {
                        // Auto-prefill first quarter of the selected hizb
                        const hezbNum = parseInt(hezbValue);
                        const firstQuarter = (hezbNum - 1) * 4 + 1;
                        setSearchJuzQuarter(firstQuarter.toString());
                      } else {
                        // Clear Quarter when clearing Hezb
                        setSearchJuzQuarter('');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-base md:text-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">{t('selectHezb')}</option>
                    {(() => {
                      if (searchJuz) {
                        // Show only the 2 hezbs for selected Juz
                        const juzNum = parseInt(searchJuz);
                        const firstHezb = (juzNum - 1) * 2 + 1;
                        const secondHezb = firstHezb + 1;
                        return [
                          <option key={firstHezb} value={firstHezb}>
                            {formatNumber(firstHezb)}
                          </option>,
                          <option key={secondHezb} value={secondHezb}>
                            {formatNumber(secondHezb)}
                          </option>
                        ];
                      } else {
                        // Show all 60 hezbs
                        return Array.from({ length: 60 }, (_, i) => i + 1).map(num => (
                          <option key={num} value={num}>
                            {formatNumber(num)}
                          </option>
                        ));
                      }
                    })()}
                  </select>
                </div>
                
                <div>
                  <label className={`text-base md:text-xl font-medium mb-2 block ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('selectQuarter')}
                  </label>
                  <select
                    value={searchJuzQuarter}
                    onChange={(e) => setSearchJuzQuarter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-base md:text-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">{t('selectQuarter')}</option>
                    {(() => {
                      if (searchJuzHezb) {
                        // Show only the 4 quarters for selected Hezb
                        const hezbNum = parseInt(searchJuzHezb);
                        const firstQuarter = (hezbNum - 1) * 4 + 1;
                        return Array.from({ length: 4 }, (_, i) => {
                          const quarterNum = firstQuarter + i;
                          return (
                            <option key={quarterNum} value={quarterNum}>
                              {formatNumber(quarterNum)}
                            </option>
                          );
                        });
                      } else {
                        // Show all 240 quarters
                        return Array.from({ length: 240 }, (_, i) => i + 1).map(num => (
                          <option key={num} value={num}>
                            {formatNumber(num)}
                          </option>
                        ));
                      }
                    })()}
                  </select>
                </div>
                
                <Button
                  onClick={handleGoToJuz}
                  disabled={!searchJuz && !searchJuzHezb && !searchJuzQuarter}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                >
                  {searchJuzQuarter ? t('goToQuarter') : searchJuzHezb ? t('goToHezb') : t('goToJuz')}
                </Button>
              </motion.div>
            </TabsContent>

            {/* Page Tab */}
            <TabsContent value="page" className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <label className={`text-base md:text-xl font-medium mb-2 block ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('pageNumber')}
                </label>
                <input
                  type="number"
                  placeholder={isRTL ? 'رقم الصفحة (1-604)' : 'Page number (1-604)'}
                  value={searchPage}
                  onChange={(e) => setSearchPage(e.target.value)}
                  min="1"
                  max="604"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-base md:text-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <Button
                  onClick={handleGoToSearchPage}
                  disabled={!searchPage}
                  className="w-full mt-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                >
                  {t('goToPage')}
                </Button>
              </motion.div>
            </TabsContent>
          </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Bookmarks Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className={`sm:max-w-md max-w-[90vw] max-h-[85vh] overflow-y-auto rounded-xl border border-emerald-500 ${isRTL ? 'rtl' : 'ltr'}`}>
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold bg-gradient-to-r from-emerald-800 to-emerald-600 bg-clip-text text-transparent">
              {t('bookmarks')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-2 sm:space-y-3">
            {bookmarks.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                {isRTL ? 'لا توجد علامات محفوظة' : 'No bookmarks saved'}
              </p>
            ) : (
              bookmarks.sort((a, b) => a - b).map((pageNum) => (
                <motion.button
                  key={pageNum}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => {
                    navigate(`/page/${pageNum}`);
                    setShowSettings(false);
                  }}
                  className={`w-full flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {isRTL ? `صفحة ${pageNum}` : `Page ${pageNum}`}
                    </span>
                    <BookmarkCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                </motion.button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Surah Search Dialog */}
      <Dialog open={showSurahSearch} onOpenChange={setShowSurahSearch}>
        <DialogContent className={`sm:max-w-md max-w-[90vw] max-h-[85vh] overflow-y-auto rounded-xl border border-emerald-500 ${isRTL ? 'rtl' : 'ltr'}`}>
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold bg-gradient-to-r from-emerald-800 to-emerald-600 bg-clip-text text-transparent">
              {t('selectSurah')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={isRTL ? 'ابحث برقم أو اسم السورة...' : 'Search by number or name...'}
                value={surahSearchQuery}
                onChange={(e) => setSurahSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
            </div>

            {/* Surah List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {surahs
                .filter(s => {
                  if (!surahSearchQuery) return true;
                  const query = surahSearchQuery.toLowerCase();
                  return (
                    s.name.toLowerCase().includes(query) ||
                    s.englishName.toLowerCase().includes(query) ||
                    s.englishNameTranslation.toLowerCase().includes(query) ||
                    s.id.toString().includes(query)
                  );
                })
                .map((s) => (
                  <motion.button
                    key={s.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={async () => {
                      const firstPage = await getSurahFirstPage(s.id);
                      navigate(`/page/${firstPage}`);
                      setShowSurahSearch(false);
                      setSurahSearchQuery('');
                    }}
                    className={`w-full p-3 rounded-lg transition-all border ${
                      s.id === currentSurahId
                        ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-500'
                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600'
                    } ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">
                          {language === 'ar' ? s.name : s.englishName}
                        </div>
                        {language === 'en' && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {s.name}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        #{s.id}
                      </div>
                    </div>
                  </motion.button>
                ))
              }
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Juz Search Dialog */}
      <Dialog open={showJuzSearch} onOpenChange={setShowJuzSearch}>
        <DialogContent className={`sm:max-w-md max-w-[90vw] max-h-[85vh] overflow-y-auto rounded-xl border border-emerald-500 ${isRTL ? 'rtl' : 'ltr'}`}>
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold bg-gradient-to-r from-emerald-800 to-emerald-600 bg-clip-text text-transparent">
              {t('selectJuz')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((num) => (
              <motion.button
                key={num}
                whileHover={{ scale: 1.02 }}
                onClick={async () => {
                  const firstPage = await getJuzFirstPage(num);
                  navigate(`/page/${firstPage}`);
                  setShowJuzSearch(false);
                }}
                className={`w-full p-3 rounded-lg transition-all border ${
                  num === currentJuz
                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-500'
                    : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600'
                } ${isRTL ? 'text-right' : 'text-left'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">
                    {isRTL ? `الجزء ${num}` : `Juz ${num}`}
                  </div>
                  <div className="text-xs text-gray-400">
                    {isRTL ? `رقم ${num}` : `#${num}`}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className={`sm:max-w-md max-w-[90vw] max-h-[85vh] overflow-y-auto rounded-xl border border-emerald-500 ${isRTL ? 'rtl' : 'ltr'}`}>
          <DialogHeader>
            <DialogTitle className="font-bold bg-gradient-to-r from-emerald-800 to-emerald-600 bg-clip-text text-transparent">
              {t('settings')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-2 sm:space-y-3">
            {/* Mushaf Type Setting */}
            <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-2 sm:gap-3">
                <BookOpen className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                <span className="font-medium">{t('mushafType')}</span>
              </div>
              <Select value={mushafType} onValueChange={(value) => setMushafType(value as MushafType)}>
                <SelectTrigger className="w-full h-8 sm:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mwdoa">{t('mushafMwdoa')}</SelectItem>
                  <SelectItem value="tashel">{t('mushafTashel')}</SelectItem>
                  <SelectItem value="madinah">{t('mushafMadinah')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* View Mode Setting - Hide on mobile */}
            {!isMobile && (
              <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Book className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  <span className="font-medium">{isRTL ? 'وضع العرض' : 'View Mode'}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode(viewMode === 'single' ? 'double' : 'single')}
                  className="flex items-center gap-2 h-7 sm:h-8 px-2 sm:px-3"
                >
                  <span>
                    {viewMode === 'single' ? (isRTL ? 'صفحتين' : '2 Pages') : (isRTL ? 'صفحة' : '1 Page')}
                  </span>
                </Button>
              </div>
            )}

            {/* Pages to Load Setting - Only show in single page mode or mobile */}
            {(viewMode === 'single' || isMobile) && (
              <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Navigation className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  <span className="font-medium">
                    {isRTL ? 'الصفحات المحملة' : 'Swipe Sensitivity'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pagesToLoad > 1 && updatePagesToLoad(pagesToLoad - 1)}
                      disabled={pagesToLoad <= 1}
                      className="h-8 w-8 p-0"
                    >
                      -
                    </Button>
                    <div className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-900 rounded-md border border-gray-300 dark:border-gray-600">
                      <span className="font-medium">{pagesToLoad}</span>
                      <span className="text-gray-500">
                        {pagesToLoad === 1 ? (isRTL ? 'صفحة' : 'page') : (isRTL ? 'صفحات' : 'pages')}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pagesToLoad < 5 && updatePagesToLoad(pagesToLoad + 1)}
                      disabled={pagesToLoad >= 5}
                      className="h-8 w-8 p-0"
                    >
                      +
                    </Button>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">
                    {isRTL 
                      ? 'يحدد عدد الصفحات التي يمكنك التمرير إليها بحركة واحدة' 
                      : 'Controls how many pages you can swipe at once'}
                  </p>
                </div>
              </div>
            )}

            {/* Bottom Bar Text Toggle */}
            <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-2 sm:gap-3">
                <Menu className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                <span className="font-medium">
                  {isRTL ? 'إظهار نص الشريط السفلي' : 'Show Bottom Bar Text'}
                </span>
              </div>
              <div dir="ltr">
                <Switch
                  checked={showBottomBarText}
                  onCheckedChange={(checked) => {
                    setShowBottomBarText(checked);
                    localStorage.setItem('quran-show-bottom-bar-text', String(checked));
                  }}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reciter Selection Dialog */}
      <Dialog open={showReciterDialog} onOpenChange={setShowReciterDialog}>
        <DialogContent className={`sm:max-w-md max-w-[90vw] max-h-[85vh] overflow-y-auto rounded-xl border border-emerald-500 ${isRTL ? 'rtl' : 'ltr'}`}>
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold bg-gradient-to-r from-emerald-800 to-emerald-600 bg-clip-text text-transparent">
              {t('selectReciter')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-2 sm:space-y-3">
            {/* Reciter Name Filter */}
            <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {t('reciterName')}
              </span>
              <Select value={filterReciterName} onValueChange={setFilterReciterName}>
                <SelectTrigger className="w-full h-8 sm:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all')}</SelectItem>
                  {uniqueReciterNames.map((reciter) => (
                    <SelectItem key={reciter.nameAr} value={reciter.nameAr}>
                      {language === 'ar' ? reciter.nameAr : reciter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Reading Type Filter */}
            <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {t('readingType')}
              </span>
              <Select value={filterReading} onValueChange={setFilterReading}>
                <SelectTrigger className="w-full h-8 sm:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filterReciterName === 'all' && <SelectItem value="all">{t('all')}</SelectItem>}
                  {availableReadings.includes('hafs') && <SelectItem value="hafs">{t('hafs')}</SelectItem>}
                  {availableReadings.includes('warsh') && <SelectItem value="warsh">{t('warsh')}</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            
            {/* Recitation Style Filter */}
            <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {t('recitationStyle')}
              </span>
              <Select value={filterStyle} onValueChange={setFilterStyle}>
                <SelectTrigger className="w-full h-8 sm:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filterReciterName === 'all' && <SelectItem value="all">{t('all')}</SelectItem>}
                  {availableStyles.includes('murattal') && <SelectItem value="murattal">{t('murattal')}</SelectItem>}
                  {availableStyles.includes('mujawwad') && <SelectItem value="mujawwad">{t('mujawwad')}</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            
            {/* Quality Filter */}
            <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {t('quality')}
              </span>
              <Select value={filterQuality} onValueChange={setFilterQuality}>
                <SelectTrigger className="w-full h-8 sm:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filterReciterName === 'all' && <SelectItem value="all">{t('all')}</SelectItem>}
                  {availableQualities.includes('192kbps') && <SelectItem value="192kbps">192kbps</SelectItem>}
                  {availableQualities.includes('128kbps') && <SelectItem value="128kbps">128kbps</SelectItem>}
                  {availableQualities.includes('64kbps') && <SelectItem value="64kbps">64kbps</SelectItem>}
                  {availableQualities.includes('48kbps') && <SelectItem value="48kbps">48kbps</SelectItem>}
                  {availableQualities.includes('40kbps') && <SelectItem value="40kbps">40kbps</SelectItem>}
                  {availableQualities.includes('32kbps') && <SelectItem value="32kbps">32kbps</SelectItem>}
                  {availableQualities.includes('16kbps') && <SelectItem value="16kbps">16kbps</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Listen Button */}
          <div className="pt-2 sm:pt-3 mt-2">
            <Button
              onClick={() => {
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
              disabled={!selectedReciter && filteredReciters.length === 0}
              className="w-full h-9 sm:h-10 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('listen')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ayah Selection Dialog */}
      <Dialog open={showAyahSelector} onOpenChange={setShowAyahSelector}>
        <DialogContent className={cn("sm:max-w-md max-w-[90vw] max-h-[98vh] overflow-y-auto rounded-xl border border-emerald-500", isRTL && "rtl")}> 
          <DialogHeader>
            <DialogTitle className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              {t('selectAyahToPlay')}
            </DialogTitle>
          </DialogHeader>
          
          <div ref={ayahListRef} className="space-y-3 overflow-y-auto">
            {(() => {
              // In double page mode on large screens, check both pages for surahs
              const pagesToCheck = viewMode === 'double' && !isMobile && currentPageNum < 604 
                ? [currentPageNum, secondPageNum]
                : [currentPageNum];
              
              // Get all surahs from the pages being displayed
              const currentPageSurahs = ayahData.filter((surah: any) => 
                surah.verses?.some((verse: any) => pagesToCheck.includes(verse.page))
              );
              const hasMultipleSurahs = currentPageSurahs.length > 1;
              
              // If multiple surahs on current page(s), show all of them, sorted with current surah first
              // Otherwise, show only the current surah
              const surahsToShow = hasMultipleSurahs 
                ? currentPageSurahs.sort((a, b) => {
                    if (a.number === currentSurahId) return -1;
                    if (b.number === currentSurahId) return 1;
                    return a.number - b.number;
                  })
                : ayahData.filter((surah: any) => surah.number === currentSurahId);
              
              return surahsToShow.map((surah: any) => (
                <div key={surah.number} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 font-semibold text-sm">
                    {language === 'ar' ? surah.name?.ar : surah.name?.en}
                  </div>
                  <div className="max-h-[25vh] overflow-y-auto p-2 grid grid-cols-5 gap-1">
                    {surah.verses?.map((verse: any) => (
                    <motion.button
                      key={`${surah.number}-${verse.number}`}
                      data-ayah={`${surah.number}-${verse.number}`}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        // Set flag to prevent auto-switch to first ayah
                        isAyahNavigation.current = true;
                        // Set current playing ayah BEFORE navigation to ensure it persists
                        setCurrentPlayingAyah({ surah: surah.number, ayah: verse.number });
                        // Play the selected ayah
                        playAyah(surah.number, verse.number);
                        // Navigate to the page containing this ayah (use verse.page directly)
                        navigate(`/page/${verse.page}#${surah.number}-${verse.number}`);
                        setShowAyahSelector(false);
                        // Reset flag after navigation completes (handles case where ayah is on same page)
                        setTimeout(() => {
                          isAyahNavigation.current = false;
                        }, 500);
                      }}
                      className={`w-full aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all ${
                        currentPlayingAyah?.surah === surah.number && currentPlayingAyah?.ayah === verse.number
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {verse.number}
                    </motion.button>
                  ))}
                </div>
              </div>
            ));
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Repeat Settings Dialog */}
      <Dialog open={showRepeatDialog} onOpenChange={setShowRepeatDialog}>
        <DialogContent className={cn("sm:max-w-md max-w-[90vw] max-h-[85vh] overflow-y-auto rounded-xl border border-emerald-500", isRTL && "rtl")}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              {t('repeatSettings')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Start Position */}
            <div className="space-y-2">
              <Label className={`text-sm font-medium ${isRTL ? 'text-right' : 'text-left'}`}>{t('startFrom')}</Label>
              <div className="flex gap-2">
                <Select value={repeatStartSurah.toString()} onValueChange={(val) => {
                  const newStartSurah = parseInt(val);
                  setRepeatStartSurah(newStartSurah);
                  // Ensure end surah is not before start surah
                  if (repeatEndSurah < newStartSurah) {
                    setRepeatEndSurah(newStartSurah);
                  }
                }}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {ayahData.map((surah: any) => (
                      <SelectItem key={surah.number} value={surah.number.toString()}>
                        {language === 'ar' ? surah.name?.ar : surah.name?.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={repeatStartAyah.toString()} onValueChange={(val) => {
                  const newStartAyah = parseInt(val);
                  setRepeatStartAyah(newStartAyah);
                  // If same surah, ensure end ayah is at least start ayah + 1
                  if (repeatStartSurah === repeatEndSurah && repeatEndAyah <= newStartAyah) {
                    setRepeatEndAyah(newStartAyah + 1);
                  }
                }}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t('ayahNumber')} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {(() => {
                      const startSurahData = ayahData.find((s: any) => s.number === repeatStartSurah);
                      const maxAyah = startSurahData?.verses?.length || 1;
                      
                      return Array.from({ length: maxAyah }, (_, i) => i + 1).map(num => (
                        <SelectItem key={num} value={num.toString()}>
                          {isRTL ? `الآية ${num}` : `Ayah ${num}`}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* End Position */}
            <div className="space-y-2">
              <Label className={`text-sm font-medium ${isRTL ? 'text-right' : 'text-left'}`}>{t('endAt')}</Label>
              <div className="flex gap-2">
                <Select value={repeatEndSurah.toString()} onValueChange={(val) => {
                  const newEndSurah = parseInt(val);
                  setRepeatEndSurah(newEndSurah);
                  // If switching to same surah as start, ensure end ayah is greater than start ayah
                  if (newEndSurah === repeatStartSurah && repeatEndAyah <= repeatStartAyah) {
                    setRepeatEndAyah(repeatStartAyah + 1);
                  }
                }}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {ayahData.filter((surah: any) => surah.number >= repeatStartSurah).map((surah: any) => (
                      <SelectItem key={surah.number} value={surah.number.toString()}>
                        {language === 'ar' ? surah.name?.ar : surah.name?.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={repeatEndAyah.toString()} onValueChange={(val) => setRepeatEndAyah(parseInt(val))}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t('ayahNumber')} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {(() => {
                      const endSurahData = ayahData.find((s: any) => s.number === repeatEndSurah);
                      const maxAyah = endSurahData?.verses?.length || 1;
                      const minAyah = repeatStartSurah === repeatEndSurah ? repeatStartAyah + 1 : 1;
                      
                      return Array.from({ length: maxAyah - minAyah + 1 }, (_, i) => minAyah + i).map(num => (
                        <SelectItem key={num} value={num.toString()}>
                          {isRTL ? `الآية ${num}` : `Ayah ${num}`}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Repeat Passage Count */}
            <div className="space-y-2">
              <Label htmlFor="repeat-passage" className={`text-sm font-medium ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('repeatPassage')}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="repeat-passage"
                  type="number"
                  min="0"
                  max="100"
                  value={repeatPassageCount || ''}
                  onChange={(e) => setRepeatPassageCount(parseInt(e.target.value) || 0)}
                  className="flex-1"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('times')}</span>
              </div>
            </div>

            {/* Repeat Each Ayah Count */}
            <div className="space-y-2">
              <Label htmlFor="repeat-ayah" className={`text-sm font-medium ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('repeatEachAyah')}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="repeat-ayah"
                  type="number"
                  min="0"
                  max="100"
                  value={repeatAyahCount || ''}
                  onChange={(e) => setRepeatAyahCount(parseInt(e.target.value) || 0)}
                  className="flex-1"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('times')}</span>
              </div>
            </div>

            {/* Apply Button */}
            <Button
              onClick={() => {
                startRepeat();
                setShowRepeatDialog(false);
              }}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
            >
              {t('applyRepeat')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bookmark Dialog */}
      <Dialog open={showBookmarkDialog} onOpenChange={setShowBookmarkDialog}>
        <DialogContent className={cn("sm:max-w-md max-w-[90vw] max-h-[85vh] overflow-y-auto rounded-xl border border-emerald-500", isRTL && "rtl")}>
          <DialogHeader>
            <DialogTitle className="font-bold bg-gradient-to-r from-emerald-800 to-emerald-600 bg-clip-text text-transparent">
              {t('bookmarks')}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="add" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-11 md:h-12">
              <TabsTrigger value="add" className="text-base md:text-xl">{isRTL ? 'اضف علامة جديدة' : 'Add New Bookmark'}</TabsTrigger>
              <TabsTrigger value="view" className="text-base md:text-xl">{isRTL ? 'العلامات' : 'Bookmarks'}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="add" className="space-y-4">
              <div className="space-y-2 sm:space-y-3">
                {/* Bookmark Type Selector */}
                <div className="space-y-2">
                  <Label htmlFor="bookmark-type" className={`text-base md:text-xl font-medium ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('bookmarkType')}
                  </Label>
                  <Select value={selectedBookmarkType} onValueChange={setSelectedBookmarkType}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bookmark">
                        <div className="flex items-center gap-2">
                          <Bookmark className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500" />
                          <span className="text-base md:text-xl">{isRTL ? 'علامة' : 'Bookmark'}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="memorization">
                        <div className="flex items-center gap-2">
                          <BookMarked className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600" />
                          <span className="text-base md:text-xl">{isRTL ? 'حفظ' : 'Memorization'}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="reading">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                          <span className="text-base md:text-xl">{isRTL ? 'قراءة' : 'Reading'}</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Surah Selector */}
                <div className="space-y-2">
                  <Label htmlFor="bookmark-surah" className={`text-base md:text-xl font-medium ${isRTL ? 'text-right' : 'text-left'}`}>
                    {isRTL ? 'السورة' : 'Surah'}
                  </Label>
                  <Select value={bookmarkSurahId.toString()} onValueChange={(val) => {
                    setBookmarkSurahId(parseInt(val));
                    // Reset ayah to 1 when surah changes
                    setBookmarkAyahNum(1);
                  }}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {surahs.map((surah) => (
                        <SelectItem key={surah.id} value={surah.id.toString()}>
                          <span className="text-base md:text-xl">
                            {surah.id}. {language === 'ar' ? surah.name : surah.englishName}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Ayah Selector */}
                <div className="space-y-2">
                  <Label htmlFor="bookmark-ayah" className={`text-base md:text-xl font-medium ${isRTL ? 'text-right' : 'text-left'}`}>
                    {isRTL ? 'الآية' : 'Ayah'}
                  </Label>
                  <Select value={bookmarkAyahNum.toString()} onValueChange={(val) => setBookmarkAyahNum(parseInt(val))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {Array.from({ length: surahs.find(s => s.id === bookmarkSurahId)?.numberOfAyahs || 1 }, (_, i) => i + 1).map((ayahNum) => (
                        <SelectItem key={ayahNum} value={ayahNum.toString()}>
                          <span className="text-base md:text-xl">
                            {isRTL ? 'آية' : 'Ayah'} {ayahNum}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Save Button */}
                <Button
                  onClick={async () => {
                    const targetPage = await getAyahPage(bookmarkSurahId, bookmarkAyahNum);
                    console.log('Saving bookmark - Surah:', bookmarkSurahId, 'Ayah:', bookmarkAyahNum, 'Page:', targetPage);
                    if (targetPage) {
                      const bookmarkType = selectedBookmarkType;
                      const bookmarkList = bookmarkType === 'memorization' ? memorizationBookmarks :
                                           bookmarkType === 'reading' ? readingBookmarks : bookmarks;
                      const setBookmarkList = bookmarkType === 'memorization' ? setMemorizationBookmarks :
                                               bookmarkType === 'reading' ? setReadingBookmarks : setBookmarks;
                      
                      if (!bookmarkList.includes(targetPage)) {
                        const updated = [...bookmarkList, targetPage];
                        setBookmarkList(updated);
                        localStorage.setItem(`quran-${bookmarkType}-bookmarks`, JSON.stringify(updated));
                        
                        const selectedSurah = surahs.find(s => s.id === bookmarkSurahId);
                        const updatedSurahs = { ...bookmarkPageSurahs, [targetPage]: language === 'ar' ? selectedSurah?.name || '' : selectedSurah?.englishName || '' };
                        const updatedAyahs = { ...bookmarkPageAyahs, [targetPage]: bookmarkAyahNum };
                        setBookmarkPageSurahs(updatedSurahs);
                        setBookmarkPageAyahs(updatedAyahs);
                        localStorage.setItem('quran-bookmark-surahs', JSON.stringify(updatedSurahs));
                        localStorage.setItem('quran-bookmark-ayahs', JSON.stringify(updatedAyahs));
                        
                        toast({
                          title: isRTL ? 'تم الحفظ' : 'Saved',
                          description: isRTL ? 'تمت إضافة علامة جديدة بنجاح' : 'New bookmark saved successfully',
                          duration: 1000,
                          className: 'bg-emerald-500 text-white border-emerald-600',
                        });
                      } else {
                        toast({
                          title: isRTL ? 'موجودة مسبقاً' : 'Already exists',
                          description: isRTL ? 'هذه العلامة موجودة بالفعل' : 'This bookmark already exists',
                          variant: 'destructive',
                          duration: 1000,
                        });
                      }
                    }
                  }}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 py-2 text-base md:text-xl"
                >
                  {t('save')}
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="view" className="space-y-4">
              <div className="max-h-60 sm:max-h-80 overflow-y-auto">
                {/* Quick Bookmarks */}
                {bookmarks.length > 0 && (
                  <div className="px-1 sm:px-2 py-1">
                    <div className="font-semibold text-amber-600 dark:text-amber-400 px-2 py-1">
                      {isRTL ? 'علامات' : 'Bookmarks'} ({bookmarks.length})
                    </div>
                    {bookmarks.map((page) => (
                      <div
                        key={`quick-${page}`}
                        className="flex justify-between items-center py-1 sm:py-1.5 ml-1 sm:ml-2"
                      >
                        <button
                          onClick={() => {
                            navigate(`/page/${page}`);
                            setShowBookmarkDialog(false);
                          }}
                          className={`flex items-center gap-1.5 sm:gap-2 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}
                        >
                          <Bookmark className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0 font-medium truncate">
                            {bookmarkPageSurahs[page] || '...'}{bookmarkPageAyahs[page] ? ` - ${isRTL ? 'آية' : 'Ayah'} ${bookmarkPageAyahs[page]}` : ''} - {t('page')} {page}
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updated = bookmarks.filter(p => p !== page);
                            setBookmarks(updated);
                            localStorage.setItem('quran-bookmarks', JSON.stringify(updated));
                          }}
                          className="ml-1 sm:ml-2 text-red-500 hover:text-red-700 flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Memorization Bookmarks */}
                {memorizationBookmarks.length > 0 && (
                  <div className="px-1 sm:px-2 py-1">
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-1">
                      {isRTL ? 'حفظ' : 'Memorization'} ({memorizationBookmarks.length})
                    </div>
                    {memorizationBookmarks.map((page) => (
                      <div
                        key={`mem-${page}`}
                        className="flex justify-between items-center py-1 sm:py-1.5 ml-1 sm:ml-2"
                      >
                        <button
                          onClick={() => {
                            navigate(`/page/${page}`);
                            setShowBookmarkDialog(false);
                          }}
                          className={`flex items-center gap-1.5 sm:gap-2 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}
                        >
                          <BookMarked className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0 font-medium truncate">
                            {bookmarkPageSurahs[page] || '...'}{bookmarkPageAyahs[page] ? ` - ${isRTL ? 'آية' : 'Ayah'} ${bookmarkPageAyahs[page]}` : ''} - {t('page')} {page}
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMemorizationBookmark(page);
                          }}
                          className="ml-1 sm:ml-2 text-red-500 hover:text-red-700 flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Reading Bookmarks */}
                {readingBookmarks.length > 0 && (
                  <div className="px-1 sm:px-2 py-1">
                    <div className="font-semibold text-blue-600 dark:text-blue-400 px-2 py-1">
                      {isRTL ? 'قراءة' : 'Reading'} ({readingBookmarks.length})
                    </div>
                    {readingBookmarks.map((page) => (
                      <div
                        key={`read-${page}`}
                        className="flex justify-between items-center py-1 sm:py-1.5 ml-1 sm:ml-2"
                      >
                        <button
                          onClick={() => {
                            navigate(`/page/${page}`);
                            setShowBookmarkDialog(false);
                          }}
                          className={`flex items-center gap-1.5 sm:gap-2 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}
                        >
                          <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0 font-medium truncate">
                            {bookmarkPageSurahs[page] || '...'}{bookmarkPageAyahs[page] ? ` - ${isRTL ? 'آية' : 'Ayah'} ${bookmarkPageAyahs[page]}` : ''} - {t('page')} {page}
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeReadingBookmark(page);
                          }}
                          className="ml-1 sm:ml-2 text-red-500 hover:text-red-700 flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* No Bookmarks Message */}
                {bookmarks.length === 0 && memorizationBookmarks.length === 0 && readingBookmarks.length === 0 && (
                  <div className="px-3 sm:px-4 py-4 sm:py-6 text-gray-500 dark:text-gray-400 text-center">
                    {t('noBookmarks')}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Surah;
