import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { useQuranData } from "@/hooks/useQuranData";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { surahs } from "@/data/surahs";
import { BookOpen, Hash, FileText, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight } from "lucide-react";

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
  
  // Set initial type when component mounts or initialType changes
  useEffect(() => {
    if (initialType) {
      setSearchParams({ type: initialType });
    } else {
      // Clear search params if no initialType
      setSearchParams({});
    }
  }, [initialType]);  // Run when initialType changes
  
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
      
      if (onNavigate) {
        onNavigate(targetPage);
        onClose?.();
      } else {
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
  
  // Render content for specific navigation type
  const renderNavigationContent = () => {
    switch (activeNavType) {
      case 'surah':
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Surah and Ayah Selection */}
            <div className="grid grid-cols-2 gap-2">
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
                  {surahs.map(s => (
                    <option key={s.id} value={s.id}>
                      {isRTL ? `${formatNumber(s.id)}. ${s.name}` : `${s.id}. ${s.englishName}`}
                    </option>
                  ))}
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
