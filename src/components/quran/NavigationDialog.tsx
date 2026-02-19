import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { surahs } from "@/data/surahs";

interface NavigationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'navigation' | 'word';
  ayahData: any[];
  onNavigate: (page: number) => void;
  formatNumber: (num: number | string) => string;
  currentSurahId?: number;
  currentAyah?: number | null;
  currentJuz?: number;
  currentHezb?: number;
  currentQuarter?: number;
  currentPage?: number;
  onSetPlayingAyah?: (ayah: { surah: number; ayah: number }) => void;
  initialTab?: 'surah' | 'juz' | 'page';
}

export function NavigationDialog({
  open,
  onOpenChange,
  mode,
  ayahData,
  onNavigate,
  formatNumber,
  currentSurahId,
  currentAyah,
  currentJuz,
  currentHezb,
  currentQuarter,
  currentPage,
  onSetPlayingAyah,
  initialTab
}: NavigationDialogProps) {
  const { t, isRTL } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  
  // Navigation tab state
  const [searchTab, setSearchTab] = useState<'surah' | 'juz' | 'page' | 'word'>(() => {
    const saved = localStorage.getItem('quran-search-tab');
    return (saved as 'surah' | 'juz' | 'page' | 'word') || 'surah';
  });
  
  // Update tab when dialog opens with initialTab
  useEffect(() => {
    if (open && initialTab) {
      setSearchTab(initialTab);
    }
  }, [open, initialTab]);
  
  // Update tab when dialog opens with initialTab
  useEffect(() => {
    if (open && initialTab) {
      setSearchTab(initialTab);
    }
  }, [open, initialTab]);
  
  // Surah tab state
  const [searchSurah, setSearchSurah] = useState(() => localStorage.getItem('quran-search-surah') || '');
  const [searchAyah, setSearchAyah] = useState(() => localStorage.getItem('quran-search-ayah') || '');
  const [filterJuz, setFilterJuz] = useState('');
  const [filterHezb, setFilterHezb] = useState('');
  const [selectedSurahAyahs, setSelectedSurahAyahs] = useState<any[]>([]);
  
  // Juz tab state
  const [searchJuz, setSearchJuz] = useState(() => localStorage.getItem('quran-search-juz') || '');
  const [searchJuzHezb, setSearchJuzHezb] = useState(() => localStorage.getItem('quran-search-juz-hezb') || '');
  const [searchJuzQuarter, setSearchJuzQuarter] = useState(() => localStorage.getItem('quran-search-juz-quarter') || '');
  
  // Page tab state
  const [searchPage, setSearchPage] = useState(() => localStorage.getItem('quran-search-page') || '');
  const [pageValidationError, setPageValidationError] = useState<string>('');
  
  // Word search state
  const [searchWord, setSearchWord] = useState('');
  const [wordSearchResults, setWordSearchResults] = useState<any[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);

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

  // Validate page number
  useEffect(() => {
    if (searchTab === 'page') {
      const pageStr = searchPage.trim();
      
      // Allow empty values
      if (pageStr === '') {
        setPageValidationError('');
        return;
      }
      
      const pageNum = parseInt(pageStr);
      
      // Check if value is a valid number
      if (isNaN(pageNum)) {
        setPageValidationError(t('pageRangeError'));
        return;
      }
      
      // Check range (1-604)
      if (pageNum < 1 || pageNum > 604) {
        setPageValidationError(t('pageRangeError'));
        return;
      }
      
      setPageValidationError('');
    } else {
      setPageValidationError('');
    }
  }, [searchTab, searchPage, t]);

  // Update selected surah ayahs when surah changes
  useEffect(() => {
    if (searchSurah && ayahData.length > 0) {
      const surahId = parseInt(searchSurah);
      const surahData = ayahData.find(s => s.number === surahId);
      setSelectedSurahAyahs(surahData?.verses || []);
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

  // Prefill with current values when dialog opens
  useEffect(() => {
    if (open) {
      console.log('=== Navigation Dialog Opened ===');
      console.log('Current Surah ID:', currentSurahId);
      console.log('Current Ayah:', currentAyah);
      console.log('Current Juz:', currentJuz);
      console.log('Current Hezb:', currentHezb);
      console.log('Current Quarter:', currentQuarter);
      console.log('Current Page:', currentPage);
      console.log('================================');
      
      // Prefill Surah tab with current surah and ayah
      if (currentSurahId) {
        setSearchSurah(currentSurahId.toString());
      }
      if (currentAyah) {
        setSearchAyah(currentAyah.toString());
      }
      
      // Keep Juz and Hezb filters empty in Surah tab
      setFilterJuz('');
      setFilterHezb('');
      
      // Prefill Juz tab with current juz, hezb, and quarter
      if (currentJuz) {
        setSearchJuz(currentJuz.toString());
      }
      if (currentHezb) {
        setSearchJuzHezb(currentHezb.toString());
      }
      if (currentQuarter) {
        setSearchJuzQuarter(currentQuarter.toString());
      }
      
      // Prefill Page tab with current page
      if (currentPage) {
        setSearchPage(currentPage.toString());
      }
    } else {
      // Clear search results when dialog closes
      setSearchWord('');
      setWordSearchResults([]);
    }
  }, [open, currentSurahId, currentAyah, currentJuz, currentHezb, currentQuarter, currentPage]);

  // Normalize Arabic text by removing diacritics and normalizing character variations
  const normalizeArabic = (text: string) => {
    const normalized = text
      .replace(/ٰ/g, 'ا') // IMPORTANT: Normalize superscript alif (U+0670) to regular alif FIRST, before removing diacritics
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, '') // Remove diacritics
      .replace(/[ٱأإآٲٳٵ]/g, 'ا') // Normalize alef variations
      .replace(/[ىي]/g, 'ي') // Normalize yaa
      .replace(/ة/g, 'ه') // Normalize taa marboota
      .replace(/ؤ/g, 'و') // Normalize waw with hamza
      .replace(/ئ/g, 'ي') // Normalize yaa with hamza
      // .replace(/\s+/g, '') // Remove spaces
      .toLowerCase();
    
    // Debug: Show before and after for first few characters
    if (text.includes('و') && text.length < 50) {
      console.log('Normalize:', text.substring(0, 20), '→', normalized.substring(0, 20));
    }
    
    return normalized;
  };

  // Highlight exact phrase match in text
  const highlightText = (text: string, searchWord: string, isArabic: boolean) => {
    if (!searchWord || !text) return text;
    
    const normalizedSearch = isArabic ? normalizeArabic(searchWord) : searchWord.toLowerCase();
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

  // Word search functionality
  const performWordSearch = () => {
    if (searchWord.trim().length >= 2 && ayahData.length > 0) {
      setIsSearchLoading(true);
      
      console.log('=== WORD SEARCH DEBUG ===');
      console.log('Search Word:', searchWord);
      console.log('Ayah Data Length:', ayahData.length);
      console.log('Normalized Search:', normalizeArabic(searchWord));
      
      // Use setTimeout to allow UI to update with loading state
      setTimeout(() => {
        // Search for the full text phrase
        const normalizedSearchFull = normalizeArabic(searchWord);
        const searchFullLower = searchWord.toLowerCase();
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
              console.log('Found match in Surah', surahData.number, 'Ayah', verse.number);
              console.log('Arabic Text:', arabicText);
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
        
        console.log('Total Results:', results.length);
        console.log('========================');
        
        setWordSearchResults(results);
        setIsSearchLoading(false);
      }, 100);
    } else {
      console.log('Search too short or no data. Length:', searchWord.trim().length, 'Data:', ayahData.length);
      setWordSearchResults([]);
      setIsSearchLoading(false);
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
          // Set the playing ayah BEFORE navigating to ensure it's correct
          if (onSetPlayingAyah) {
            onSetPlayingAyah({ surah: surahId, ayah: ayahNumber });
          }
          // Use setTimeout to ensure the ayah is set before navigation triggers page load
          setTimeout(() => {
            console.log('=== NAVIGATING TO SURAH/AYAH ===');
            console.log('Surah:', surahId, 'Ayah:', ayahNumber, 'Page:', ayahInfo.page);
            onNavigate(ayahInfo.page);
          }, 0);
        }
      } else {
        // Otherwise, navigate to the first page of the surah
        const { getSurahFirstPage } = await import('@/lib/quran-mapping');
        const firstPage = await getSurahFirstPage(surahId);
        // Set the playing ayah to first ayah of the surah
        if (onSetPlayingAyah) {
          onSetPlayingAyah({ surah: surahId, ayah: 1 });
        }
        // Use setTimeout to ensure the ayah is set before navigation triggers page load
        setTimeout(() => {
          console.log('=== NAVIGATING TO SURAH (first page) ===');
          console.log('Surah:', surahId, 'Page:', firstPage);
          onNavigate(firstPage);
        }, 0);
      }
      
      setSearchSurah('');
      setSearchAyah('');
      onOpenChange(false);
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
        const { getJuzFirstPage } = await import('@/lib/quran-mapping');
        targetPage = await getJuzFirstPage(juzNum);
      }
      
      console.log('=== NAVIGATING TO JUZ ===');
      console.log('Juz:', juzNum, 'Page:', targetPage);
      onNavigate(targetPage);
      setSearchJuz('');
      setSearchJuzHezb('');
      setSearchJuzQuarter('');
      onOpenChange(false);
    }
  };

  const handleGoToSearchPage = () => {
    const pageNum = parseInt(searchPage);
    if (pageNum > 0 && pageNum <= 604 && !pageValidationError) {
      console.log('=== NAVIGATING TO PAGE ===');
      console.log('Page:', pageNum);
      onNavigate(pageNum);
      setSearchPage('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "sm:max-w-md md:max-w-lg lg:max-w-xl max-w-[90vw] overflow-y-auto p-0",
          "rounded-xl border-0 bg-[#FBF9F4]",
          // Taller dialog when search results are available
          wordSearchResults.length > 0 
            ? "max-h-[90vh] md:max-h-[95vh]" 
            : "max-h-[85vh]",
          mode === 'word' ? '!top-[5vh] !translate-y-0' : '',
          isRTL ? 'rtl' : 'ltr'
        )}
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        <DialogHeader className="bg-gradient-to-b from-emerald-800 to-emerald-600 rounded-t-xl px-4 py-3">
          <DialogTitle className={cn("text-center font-bold text-[#F2E3BB]", textSizeClasses.title)}>
            {mode === 'word' ? (isRTL ? 'بحث فى نصوص الايات' : 'Search') : (isRTL ? 'انتقل' : 'Go To')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-4 space-y-2 sm:space-y-3">
        {mode === 'word' ? (
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
                className={cn("flex-1 px-3 py-2 rounded-lg border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2", textSizeClasses.text)}
              />
              <Button
                onClick={performWordSearch}
                className={cn("px-4 py-2 bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB]", textSizeClasses.button)}
              >
                {isRTL ? ' بحث' : 'Search'}
              </Button>
            </div>
            
            {isSearchLoading && (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                <p className={cn("text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
                  {isRTL ? 'جاري البحث...' : 'Searching...'}
                </p>
              </div>
            )}
            
            {!isSearchLoading && wordSearchResults.length > 0 && (
              <div className="max-h-96 overflow-y-auto space-y-2">
                <div className={cn("font-medium text-emerald-800 dark:text-emerald-300 mb-2", textSizeClasses.text)}>
                  {t('foundIn')} {wordSearchResults.length} {t('ayahs')}
                </div>
                {wordSearchResults.map((result, index) => (
                  <motion.button
                    key={`${result.surahNumber}-${result.ayahNumber}-${index}`}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => {
                      onNavigate(result.page);
                      onOpenChange(false);
                      setSearchWord('');
                    }}
                    className={`w-full p-3 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-[#FBF9F4] dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-gray-700 transition-all ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                    <div className={cn("font-semibold text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
                      {isRTL ? result.surahName : result.surahNameEn} - {isRTL ? 'الآية' : 'Ayah'} {result.ayahNumber}
                    </div>
                    <div className={cn("text-emerald-600 dark:text-emerald-400 whitespace-nowrap", textSizeClasses.text)}>
                        {isRTL ? 'صفحة' : 'Page'} {result.page}
                      </div>
                    </div>
                    <div className={cn(
                      textSizeClasses.text,
                      isRTL ? "text-right font-arabic text-emerald-900 dark:text-emerald-100 leading-20" : "text-left text-emerald-900 dark:text-emerald-100 leading-relaxed"
                    )}>
                      {isRTL 
                        ? highlightText(result.arabicText, searchWord, true)
                        : highlightText(result.englishText, searchWord, false)
                      }
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          /* Navigation Search - With tabs */
          <Tabs value={searchTab} onValueChange={setSearchTab as any} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-11 md:h-12 bg-emerald-100 dark:bg-emerald-900/30">
              <TabsTrigger value="juz" className={cn("data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB]", textSizeClasses.text)}>{isRTL ? 'جزء' : 'Juz'}</TabsTrigger>
              <TabsTrigger value="page" className={cn("data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB]", textSizeClasses.text)}>{isRTL ? 'صفحة' : 'Page'}</TabsTrigger>
              <TabsTrigger value="surah" className={cn("data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB]", textSizeClasses.text)}>{isRTL ? 'سورة' : 'Surah'}</TabsTrigger>
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
                    <label className={cn("font-medium mb-1 block text-emerald-800 dark:text-emerald-300", isRTL ? 'text-right' : 'text-left', textSizeClasses.label)}>
                      {t('filterByJuz')}
                    </label>
                    <select
                      value={filterJuz}
                      onChange={(e) => {
                        const juzValue = e.target.value;
                        setFilterJuz(juzValue);
                        
                        if (juzValue) {
                          const juzNum = parseInt(juzValue);
                          const firstHezb = (juzNum - 1) * 2 + 1;
                          setFilterHezb(firstHezb.toString());
                          
                          // Auto-select first surah based on the Hezb (since Hezb filter takes precedence)
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
                          
                          const firstSurahId = hezbRanges[firstHezb]?.[0];
                          if (firstSurahId) {
                            setSearchSurah(firstSurahId.toString());
                            setSearchAyah('1');
                          }
                        } else {
                          setFilterHezb('');
                          setSearchSurah('');
                          setSearchAyah('');
                        }
                      }}
                      className={cn("w-full px-2 py-2 rounded-lg border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2", textSizeClasses.text)}
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
                    <label className={cn("font-medium mb-1 block text-emerald-800 dark:text-emerald-300", isRTL ? 'text-right' : 'text-left', textSizeClasses.label)}>
                      {t('chooseSurah')}
                    </label>
                    <select
                      value={searchSurah}
                      onChange={(e) => {
                        setSearchSurah(e.target.value);
                        setSearchAyah('1');
                      }}
                      className={cn("w-full px-2 py-2 rounded-lg border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2", textSizeClasses.text)}
                    >
                      <option value="">{t('selectSurah')}</option>
                      {(() => {
                        let filteredSurahs = surahs;
                        
                        if (filterHezb) {
                          const hezbNum = parseInt(filterHezb);
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
                          
                          if (hezbNum % 2 === 0 && hezbNum !== 60 && allowedSurahs.length > 1) {
                            allowedSurahs = allowedSurahs.slice(0, -1);
                          }
                          
                          filteredSurahs = filteredSurahs.filter(s => allowedSurahs.includes(s.id));
                        } else if (filterJuz) {
                          const juzNum = parseInt(filterJuz);
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
                            {isRTL ? `${formatNumber(s.id)}. ${s.name}` : `${s.id}. ${s.englishName}`}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>

                  {/* Hizb Filter */}
                  <div>
                    <label className={cn("font-medium mb-1 block text-emerald-800 dark:text-emerald-300", isRTL ? 'text-right' : 'text-left', textSizeClasses.label)}>
                      {t('filterByHezb')}
                    </label>
                    <select
                      value={filterHezb}
                      onChange={(e) => {
                        const hezbValue = e.target.value;
                        setFilterHezb(hezbValue);
                        
                        if (hezbValue) {
                          const hezbNum = parseInt(hezbValue);
                          
                          // Auto-select first surah in this Hezb
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
                          
                          if (hezbNum % 2 === 0 && hezbNum !== 60 && allowedSurahs.length > 1) {
                            allowedSurahs = allowedSurahs.slice(0, -1);
                          }
                          
                          const firstSurahId = allowedSurahs[0];
                          if (firstSurahId) {
                            setSearchSurah(firstSurahId.toString());
                            setSearchAyah('1');
                          }
                        } else {
                          setSearchSurah('');
                          setSearchAyah('');
                        }
                      }}   
                      className={cn("w-full px-2 py-2 rounded-lg border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2", textSizeClasses.text)}
                    >
                      <option value="">{t('all')}</option>
                      {(() => {
                        if (filterJuz) {
                          const juzNum = parseInt(filterJuz);
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

                  {/* Ayah Filter */}
                  <div>
                    <label className={cn("font-medium mb-1 block text-emerald-800 dark:text-emerald-300", isRTL ? 'text-right' : 'text-left', textSizeClasses.label)}>
                      {t('chooseAyah')}
                    </label>
                    <select
                      value={searchAyah}
                      onChange={(e) => setSearchAyah(e.target.value)}
                      disabled={!searchSurah || selectedSurahAyahs.length === 0}
                      className={cn("w-full px-2 py-2 rounded-lg border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed", textSizeClasses.text)}
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
                  className={cn("w-full bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB]", textSizeClasses.button)}
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
            </TabsContent>

            {/* Page Tab */}
            <TabsContent value="page" className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
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
                  <div className={cn("text-red-600 dark:text-red-400 text-center font-medium bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 mt-3", textSizeClasses.text)}>
                    {pageValidationError}
                  </div>
                )}
                
                <Button
                  onClick={handleGoToSearchPage}
                  disabled={!searchPage || !!pageValidationError}
                  className={cn("w-full mt-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB]", textSizeClasses.button)}
                >
                  {t('goToPage')}
                </Button>
              </motion.div>
            </TabsContent>
          </Tabs>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
