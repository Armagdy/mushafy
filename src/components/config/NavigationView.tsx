import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { useQuranData } from "@/hooks/useQuranData";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { surahs } from "@/data/surahs";
import { BookOpen, Hash, FileText, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, Search } from "lucide-react";

interface NavigationViewProps {
  onNavigate?: (page: number) => void;
  onClose?: () => void;
  initialType?: 'surah' | 'juz' | 'page';
  initialSurah?: number;
  initialJuz?: number;
  initialPage?: number;
}

/**
 * Navigation View - Full page navigation interface
 * Extracted from NavigationDialog.tsx for use in Configuration page
 */
export default function NavigationView({ onNavigate, onClose, initialType, initialSurah, initialJuz, initialPage }: NavigationViewProps) {
  const { t, isRTL, language } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Load Quran data
  const { ayahData, isAyahDataLoading } = useQuranData();
  
  // Active navigation type from URL
  const activeNavType = searchParams.get('type') as 'surah' | 'juz' | 'page' | null;
  
  // Map surah ID to Juz range (based on Quran structure)
  const getSurahJuzRange = (surahId: number): { start: number; end: number } => {
    // Juz boundaries: which surah/ayah each juz starts with
    const juzStarts = [
      { juz: 1, surah: 1, ayah: 1 },      // Al-Fatiha
      { juz: 2, surah: 2, ayah: 142 },    // Al-Baqarah continues (started in Juz 1)
      { juz: 3, surah: 2, ayah: 253 },    // Al-Baqarah continues
      { juz: 4, surah: 3, ayah: 93 },     // Aal-i-Imran (started in Juz 3)
      { juz: 5, surah: 4, ayah: 24 },     // An-Nisaa
      { juz: 6, surah: 4, ayah: 148 },    // An-Nisaa continues  
      { juz: 7, surah: 5, ayah: 82 },     // Al-Maidah (started in Juz 6)
      { juz: 8, surah: 6, ayah: 111 },    // Al-An'am (started in Juz 7)
      { juz: 9, surah: 7, ayah: 88 },     // Al-A'raf (started in Juz 8)
      { juz: 10, surah: 8, ayah: 41 },    // Al-Anfal (started in Juz 9)
      { juz: 11, surah: 9, ayah: 93 },    // At-Tawbah (started in Juz 10)
      { juz: 12, surah: 11, ayah: 6 },    // Hud
      { juz: 13, surah: 12, ayah: 53 },   // Yusuf (started in Juz 12)
      { juz: 14, surah: 15, ayah: 1 },    // Al-Hijr
      { juz: 15, surah: 17, ayah: 1 },    // Al-Isra
      { juz: 16, surah: 18, ayah: 75 },   // Al-Kahf (started in Juz 15)
      { juz: 17, surah: 21, ayah: 1 },    // Al-Anbiya
      { juz: 18, surah: 23, ayah: 1 },    // Al-Mu'minun
      { juz: 19, surah: 25, ayah: 21 },   // Al-Furqan (started in Juz 18)
      { juz: 20, surah: 27, ayah: 56 },   // An-Naml (started in Juz 19)
      { juz: 21, surah: 29, ayah: 46 },   // Al-Ankabut (started in Juz 20)
      { juz: 22, surah: 33, ayah: 31 },   // Al-Ahzab (started in Juz 21)
      { juz: 23, surah: 36, ayah: 28 },   // Ya-Sin (started in Juz 22)
      { juz: 24, surah: 39, ayah: 32 },   // Az-Zumar (started in Juz 23)
      { juz: 25, surah: 41, ayah: 47 },   // Fussilat (started in Juz 24)
      { juz: 26, surah: 46, ayah: 1 },    // Al-Ahqaf
      { juz: 27, surah: 51, ayah: 31 },   // Adh-Dhariyat (started in Juz 26)
      { juz: 28, surah: 58, ayah: 1 },    // Al-Mujadila
      { juz: 29, surah: 67, ayah: 1 },    // Al-Mulk
      { juz: 30, surah: 78, ayah: 1 },    // An-Naba
    ];
    
    // Find which juz entries mention this surah
    const juzEntriesForSurah = juzStarts.filter(j => j.surah === surahId);
    
    if (juzEntriesForSurah.length > 0) {
      // If surah is explicitly mentioned, find its range
      const firstMention = juzEntriesForSurah[0].juz;
      
      // Surah started in previous juz if first mention is not at ayah 1
      const startJuz = juzEntriesForSurah[0].ayah === 1 ? firstMention : firstMention - 1;
      
      // Find last juz before next surah starts
      let endJuz = 30;
      for (let i = 0; i < juzStarts.length; i++) {
        if (juzStarts[i].surah > surahId) {
          endJuz = juzStarts[i].juz - 1;
          break;
        }
      }
      
      return { start: startJuz, end: endJuz };
    } else {
      // Surah not explicitly mentioned - find by position
      let startJuz = 1;
      let endJuz = 30;
      
      for (let i = juzStarts.length - 1; i >= 0; i--) {
        if (juzStarts[i].surah < surahId) {
          startJuz = juzStarts[i].juz;
          break;
        }
      }
      
      for (let i = 0; i < juzStarts.length; i++) {
        if (juzStarts[i].surah > surahId) {
          endJuz = juzStarts[i].juz - 1;
          break;
        }
      }
      
      return { start: startJuz, end: endJuz };
    }
  };
  
  // Set initial type when component mounts or initialType changes
  useEffect(() => {
    if (initialType) {
      setSearchParams({ type: initialType });
    } else {
      // Clear search params if no initialType
      setSearchParams({});
    }
  }, [initialType]);  // Run when initialType changes
  
  // Clear surah/ayah selection when switching away from surah tab
  useEffect(() => {
    if (activeNavType !== 'surah') {
      setSelectedSurahAyahs([]);
    }
  }, [activeNavType]);
  
  // Number formatting for Arabic/English
  const formatNumber = (num: number | string): string => {
    const numStr = num.toString();
    if (language === 'ar') {
      const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
      return numStr.split('').map(digit => arabicDigits[parseInt(digit)] || digit).join('');
    }
    return numStr;
  };
  
  // Surah tab state
  const [searchSurah, setSearchSurah] = useState(() => {
    if (initialSurah && initialType === 'surah') return initialSurah.toString();
    return localStorage.getItem('quran-search-surah') || '';
  });
  const [searchAyah, setSearchAyah] = useState(() => localStorage.getItem('quran-search-ayah') || '');
  const [selectedSurahAyahs, setSelectedSurahAyahs] = useState<any[]>([]);
  const [surahSearchQuery, setSurahSearchQuery] = useState('');
  
  // Juz tab state
  const [searchJuz, setSearchJuz] = useState(() => {
    if (initialJuz && initialType === 'juz') return initialJuz.toString();
    return localStorage.getItem('quran-search-juz') || '';
  });
  const [searchJuzHezb, setSearchJuzHezb] = useState(() => localStorage.getItem('quran-search-juz-hezb') || '');
  const [searchJuzQuarter, setSearchJuzQuarter] = useState(() => localStorage.getItem('quran-search-juz-quarter') || '');
  
  // Page tab state
  const [searchPage, setSearchPage] = useState(() => {
    if (initialPage && initialType === 'page') return initialPage.toString();
    return localStorage.getItem('quran-search-page') || '';
  });
  const [pageValidationError, setPageValidationError] = useState<string>('');

  // Persist navigation values
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

  // Validate page number
  useEffect(() => {
    if (activeNavType === 'page') {
      const pageStr = searchPage.trim();
      
      if (pageStr === '') {
        setPageValidationError('');
        return;
      }
      
      const pageNum = parseInt(pageStr);
      
      if (isNaN(pageNum)) {
        setPageValidationError(t('pageRangeError'));
        return;
      }
      
      if (pageNum < 1 || pageNum > 604) {
        setPageValidationError(t('pageRangeError'));
        return;
      }
      
      setPageValidationError('');
    } else {
      setPageValidationError('');
    }
  }, [activeNavType, searchPage, t]);

  // Update selected surah ayahs when surah changes
  useEffect(() => {
    if (searchSurah && searchSurah.trim() !== '' && ayahData.length > 0) {
      const surahId = parseInt(searchSurah);
      if (!isNaN(surahId)) {
        const surahData = ayahData.find(s => s.number === surahId);
        setSelectedSurahAyahs(surahData?.verses || []);
      } else {
        setSelectedSurahAyahs([]);
      }
    } else {
      setSelectedSurahAyahs([]);
    }
  }, [searchSurah, ayahData]);

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
  }, [searchJuzQuarter, searchJuz, searchJuzHezb]);

  // Synchronize Juz when Hezb changes
  useEffect(() => {
    if (searchJuzHezb) {
      const hezbNum = parseInt(searchJuzHezb);
      const juzNum = Math.ceil(hezbNum / 2);
      
      if (searchJuz !== juzNum.toString()) {
        setSearchJuz(juzNum.toString());
      }
    }
  }, [searchJuzHezb, searchJuz]);

  const handleGoToSurah = async () => {
    if (searchSurah) {
      const surahId = parseInt(searchSurah);
      
      // If ayah is selected, navigate to the page containing that ayah
      if (searchAyah && selectedSurahAyahs.length > 0) {
        const ayahNumber = parseInt(searchAyah);
        const ayahInfo = selectedSurahAyahs.find(v => v.number === ayahNumber);
        if (ayahInfo && ayahInfo.page) {
          if (onNavigate) {
            onNavigate(ayahInfo.page);
            onClose?.();
          } else {
            navigate(`/page/${ayahInfo.page}`);
          }
        }
      } else {
        // Otherwise, navigate to the first page of the surah
        const { getSurahFirstPage } = await import('@/lib/quran-mapping');
        const firstPage = await getSurahFirstPage(surahId);
        if (onNavigate) {
          onNavigate(firstPage);
          onClose?.();
        } else {
          navigate(`/page/${firstPage}`);
        }
      }
      
      setSearchSurah('');
      setSearchAyah('');
    }
  };

  const handleGoToJuz = async () => {
    const juzNum = parseInt(searchJuz);
    console.log(`📍 [NavigationView] handleGoToJuz called - Juz: ${juzNum}, Hezb: ${searchJuzHezb}, Quarter: ${searchJuzQuarter}`);
    
    if (juzNum >= 1 && juzNum <= 30) {
      let targetPage;
      
      // Check if Quarter/Hezb were auto-populated (not manually changed by user)
      const expectedFirstHezb = (juzNum - 1) * 2 + 1;
      const expectedFirstQuarter = (expectedFirstHezb - 1) * 4 + 1;
      const isAutoPopulatedHezb = searchJuzHezb === expectedFirstHezb.toString();
      const isAutoPopulatedQuarter = searchJuzQuarter === expectedFirstQuarter.toString();
      
      // If quarter/hezb match auto-populated values, use getJuzFirstPage for accuracy
      // Otherwise, user manually selected a different quarter/hezb, so use their selection
      if (searchJuzQuarter && !isAutoPopulatedQuarter) {
        // User manually changed quarter - use quarter calculation
        const quarterNum = parseInt(searchJuzQuarter);
        targetPage = Math.floor(((quarterNum - 1) * 604) / 240) + 1;
        console.log(`📍 [NavigationView] Using quarter calculation (manually selected): Quarter ${quarterNum} -> Page ${targetPage}`);
      }
      else if (searchJuzHezb && !isAutoPopulatedHezb) {
        // User manually changed hezb - use hezb calculation
        const hezbNum = parseInt(searchJuzHezb);
        targetPage = Math.floor(((hezbNum - 1) * 604) / 60) + 1;
        console.log(`📍 [NavigationView] Using hezb calculation (manually selected): Hezb ${hezbNum} -> Page ${targetPage}`);
      }
      else {
        // Navigate to first page of juz (more accurate than quarter/hezb math)
        const { getJuzFirstPage } = await import('@/lib/quran-mapping');
        targetPage = await getJuzFirstPage(juzNum);
        console.log(`📍 [NavigationView] Using getJuzFirstPage (auto-populated or no quarter/hezb): Juz ${juzNum} -> Page ${targetPage}`);
      }
      
      console.log(`📍 [NavigationView] Final target page: ${targetPage}`);
      if (onNavigate) {
        console.log(`📍 [NavigationView] Calling onNavigate(${targetPage})`);
        onNavigate(targetPage);
        onClose?.();
      } else {
        console.log(`📍 [NavigationView] Navigating to /page/${targetPage}`);
        navigate(`/page/${targetPage}`);
      }
      setSearchJuz('');
      setSearchJuzHezb('');
      setSearchJuzQuarter('');
    }
  };

  const handleGoToSearchPage = () => {
    const pageNum = parseInt(searchPage);
    if (pageNum > 0 && pageNum <= 604 && !pageValidationError) {
      if (onNavigate) {
        onNavigate(pageNum);
        onClose?.();
      } else {
        navigate(`/page/${pageNum}`);
      }
      setSearchPage('');
    }
  };

  if (isAyahDataLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  const navigationTypes = [
    { id: 'surah', icon: BookOpen, label: isRTL ? 'سورة' : 'Surah' },
    { id: 'page', icon: FileText, label: isRTL ? 'صفحة' : 'Page' },
    { id: 'juz', icon: Hash, label: isRTL ? 'جزء' : 'Juz' },
  ];
  
  // Render list of navigation types
  const renderNavigationList = () => {
    return (
      <div className="divide-y divide-emerald-100 dark:divide-emerald-900">
        {navigationTypes.map((navType) => {
          const Icon = navType.icon;
          
          return (
            <button
              key={navType.id}
              onClick={() => setSearchParams({ type: navType.id })}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors",
                isRTL ? "justify-start" : "justify-end"
              )}
            >
              {isRTL ? (
                <ChevronLeft className="w-6 h-6 text-emerald-500" />
              ) : (
                <ChevronRight className="w-6 h-6 text-emerald-500" />
              )}
              <span className={cn(
                "font-medium text-emerald-700 dark:text-emerald-400",
                textSizeClasses.label
              )}>
                {navType.label}
              </span>
              <Icon className="w-6 h-6 flex-shrink-0 text-emerald-600 dark:text-emerald-500" />
            </button>
          );
        })}
        </div>
    );
  };
  
  // Render header with back button
  const renderNavigationHeader = () => {
    const currentNavType = navigationTypes.find(nav => nav.id === activeNavType);
    if (!currentNavType) return null;
    
    const Icon = currentNavType.icon;
    
    return (
      <div className="flex items-center gap-3 pb-4 border-b border-emerald-100 dark:border-emerald-900">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSearchParams({})}
          className="text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
        >
          {isRTL ? (
            <ArrowRight className="w-5 h-5" />
          ) : (
            <ArrowLeft className="w-5 h-5" />
          )}
        </Button>
        <Icon className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
        <h2 className={cn(
          "font-semibold text-emerald-800 dark:text-emerald-300",
          textSizeClasses.title
        )}>
          {currentNavType.label}
        </h2>
      </div>
    );
  };
  
  // Filter surahs based on search query
  const filteredSurahs = surahSearchQuery.trim() === '' 
    ? surahs 
    : surahs.filter(surah => {
        const query = surahSearchQuery.toLowerCase();
        const nameMatch = surah.name.includes(surahSearchQuery); // Arabic search
        const englishNameMatch = surah.englishName.toLowerCase().includes(query);
        const idMatch = surah.id.toString().includes(query);
        return nameMatch || englishNameMatch || idMatch;
      });
  
  // Render content for specific navigation type
  const renderNavigationContent = () => {
    switch (activeNavType) {
      case 'surah':
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col h-full max-h-[calc(100vh-20rem)] md:max-h-[calc(100vh-16rem)]"
          >
            {/* Search Bar */}
            <div className="mb-3 flex-shrink-0">
              <div className="relative">
                <Search className={cn(
                  "absolute top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600",
                  isRTL ? "right-3" : "left-3"
                )} />
                <input
                  type="text"
                  placeholder={isRTL ? 'ابحث عن سورة...' : 'Search for a surah...'}
                  value={surahSearchQuery}
                  onChange={(e) => setSurahSearchQuery(e.target.value)}
                  className={cn(
                    "w-full py-2 rounded-lg border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2",
                    isRTL ? "pr-10 pl-4" : "pl-10 pr-4",
                    textSizeClasses.text
                  )}
                />
              </div>
            </div>
            
            {/* Two Scrollable Lists Side by Side */}
            <div className="flex gap-2 flex-1 overflow-hidden mb-3">
              {/* Surah List */}
              <div className={cn(
                "overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg bg-transparent",
                searchSurah && searchSurah !== '' && selectedSurahAyahs.length > 0 ? "flex-1" : "w-full"
              )}>
                {filteredSurahs.length > 0 ? (
                  filteredSurahs.map(surah => {
                    const juzRange = getSurahJuzRange(surah.id);
                    const isSelected = searchSurah === surah.id.toString();
                    
                    // Format Juz display
                    let juzDisplay = '';
                    if (juzRange.start === juzRange.end) {
                      juzDisplay = isRTL 
                        ? `الجزء ${formatNumber(juzRange.start)}`
                        : `Juz ${juzRange.start}`;
                    } else {
                      juzDisplay = isRTL 
                        ? `الجزء ${formatNumber(juzRange.start)}-${formatNumber(juzRange.end)}`
                        : `Juz ${juzRange.start}-${juzRange.end}`;
                    }
                    
                    return (
                      <button
                        key={surah.id}
                        onClick={() => {
                          setSearchSurah(surah.id.toString());
                          setSearchAyah('1');
                        }}
                        className={cn(
                          "w-full px-3 py-2.5 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors",
                          isSelected && "bg-emerald-500/20 dark:bg-emerald-500/20",
                          isRTL ? "text-right" : "text-left"
                        )}
                      >
                        {/* Juz number/range - small text at top */}
                        <div className={cn(
                          "text-xs text-emerald-600 dark:text-emerald-400 mb-0.5",
                          isRTL ? "text-right" : "text-left"
                        )}>
                          {juzDisplay}
                        </div>
                        
                        {/* Surah name - main text */}
                        <div className={cn(
                          "text-emerald-800 dark:text-emerald-200",
                          isSelected && "font-semibold",
                          textSizeClasses.text
                        )}>
                          {isRTL ? `${formatNumber(surah.id)}. ${surah.name}` : `${surah.id}. ${surah.englishName}`}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className={cn(
                    "p-4 text-center text-emerald-600 dark:text-emerald-400",
                    textSizeClasses.text
                  )}>
                    {isRTL ? 'لا توجد نتائج' : 'No results found'}
                  </div>
                )}
              </div>
              
              {/* Ayah List - Only shown when surah is selected */}
              {searchSurah && searchSurah !== '' && selectedSurahAyahs.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex-none w-32 overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg bg-transparent"
                >
                  {selectedSurahAyahs.map(ayah => {
                    const isSelected = searchAyah === ayah.number.toString();
                    
                    return (
                      <button
                        key={ayah.number}
                        onClick={() => setSearchAyah(ayah.number.toString())}
                        className={cn(
                          "w-full px-3 py-3 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors",
                          isSelected && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                          isRTL ? "text-right" : "text-left",
                          textSizeClasses.text
                        )}
                      >
                        {isRTL ? `آية ${formatNumber(ayah.number)}` : `Ayah ${ayah.number}`}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </div>
            
            {/* Navigation Button - Fixed at Bottom Always Visible */}
            <div className="mt-auto pt-3 pb-4 border-t border-emerald-100 dark:border-emerald-900 bg-gradient-to-b from-transparent via-[#FBF9F4]/80 to-[#FBF9F4] dark:from-transparent dark:via-gray-900/80 dark:to-gray-900 flex-shrink-0">
              <Button
                onClick={handleGoToSurah}
                disabled={!searchSurah}
                className={cn("w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB]", textSizeClasses.button)}
              >
                {searchAyah ? t('goToAyah') : t('goToSurah')}
              </Button>
            </div>
          </motion.div>
        );
        
      case 'juz':
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <label className={cn("font-medium mb-2 block text-emerald-800 dark:text-emerald-300", isRTL ? 'text-right' : 'text-left', textSizeClasses.label)}>
                {t('selectJuz')}
              </label>
              <select
                value={searchJuz}
                onChange={(e) => {
                  const juzValue = e.target.value;
                  setSearchJuz(juzValue);
                  
                  if (juzValue) {
                    const juzNum = parseInt(juzValue);
                    const firstHezb = (juzNum - 1) * 2 + 1;
                    setSearchJuzHezb(firstHezb.toString());
                    
                    const firstQuarter = (firstHezb - 1) * 4 + 1;
                    setSearchJuzQuarter(firstQuarter.toString());
                  } else {
                    setSearchJuzHezb('');
                    setSearchJuzQuarter('');
                  }
                }}
                className={cn("w-full px-3 py-2 rounded-lg border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2", textSizeClasses.text)}
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
              <label className={cn("font-medium mb-2 block text-emerald-800 dark:text-emerald-300", isRTL ? 'text-right' : 'text-left', textSizeClasses.label)}>
                {t('selectHezb')}
              </label>
              <select
                value={searchJuzHezb}
                onChange={(e) => {
                  const hezbValue = e.target.value;
                  setSearchJuzHezb(hezbValue);
                  
                  if (hezbValue) {
                    const hezbNum = parseInt(hezbValue);
                    const firstQuarter = (hezbNum - 1) * 4 + 1;
                    setSearchJuzQuarter(firstQuarter.toString());
                  } else {
                    setSearchJuzQuarter('');
                  }
                }}
                className={cn("w-full px-3 py-2 rounded-lg border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2", textSizeClasses.text)}
              >
                <option value="">{t('selectHezb')}</option>
                {(() => {
                  if (searchJuz) {
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
              <label className={cn("font-medium mb-2 block text-emerald-800 dark:text-emerald-300", isRTL ? 'text-right' : 'text-left', textSizeClasses.label)}>
                {t('selectQuarter')}
              </label>
              <select
                value={searchJuzQuarter}
                onChange={(e) => setSearchJuzQuarter(e.target.value)}
                className={cn("w-full px-3 py-2 rounded-lg border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2", textSizeClasses.text)}
              >
                <option value="">{t('selectQuarter')}</option>
                {(() => {
                  if (searchJuzHezb) {
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
              className={cn("w-full bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB]", textSizeClasses.button)}
            >
              {searchJuzQuarter ? t('goToQuarter') : searchJuzHezb ? t('goToHezb') : t('goToJuz')}
            </Button>
          </motion.div>
        );
        
      case 'page':
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <label className={cn("font-medium mb-2 block text-emerald-800 dark:text-emerald-300", isRTL ? 'text-right' : 'text-left', textSizeClasses.label)}>
              {t('pageNumber')}
            </label>
            <input
              type="number"
              placeholder={isRTL ? 'رقم الصفحة (1-604)' : 'Page number (1-604)'}
              value={searchPage}
              onChange={(e) => setSearchPage(e.target.value)}
              min="1"
              max="604"
              className={cn("w-full px-3 py-2 rounded-lg border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2", textSizeClasses.text)}
            />
            
            {/* Validation Error Message */}
            {pageValidationError && (
              <div className={cn("text-red-600 dark:text-red-400 text-center font-medium bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800", textSizeClasses.text)}>
                {pageValidationError}
              </div>
            )}
            
            <Button
              onClick={handleGoToSearchPage}
              disabled={!searchPage || !!pageValidationError}
              className={cn("w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB]", textSizeClasses.button)}
            >
              {t('goToPage')}
            </Button>
          </motion.div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="p-4 space-y-2 sm:space-y-3">
      {!activeNavType ? (
        renderNavigationList()
      ) : (
        <>
          {renderNavigationHeader()}
          {renderNavigationContent()}
        </>
      )}
    </div>
  );
}
