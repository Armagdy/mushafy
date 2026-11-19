import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses, getQuranTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { useQuranData } from "@/hooks/useQuranData";
import { cn } from "@/lib/utils";
import { arabicTextMatches, findArabicMatch } from "@/lib/arabic-search";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";

interface SearchViewProps {
  onNavigate?: (page: number, ayah?: { surah: number; ayah: number }) => void;
  onClose?: () => void;
}

/**
 * Search View - Word search in Quran text
 * Self-contained view that loads its own data and handles navigation
 * Route: /config/search
 */
export default function SearchView({ onNavigate, onClose }: SearchViewProps) {
  const navigate = useNavigate();
  
  // Load Quran data
  const { ayahData, isAyahDataLoading } = useQuranData();
  const { t, isRTL, language } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  const quranTextClasses = getQuranTextSizeClasses(dialogTextSize);
  
  const [searchWord, setSearchWord] = useState('');
  const [searchedWord, setSearchedWord] = useState('');
  const [wordSearchResults, setWordSearchResults] = useState<any[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null); // Direct DOM access for Android IME

  // Validate that text contains only Arabic characters
  const isArabicText = (text: string): boolean => {
    // Allow Arabic letters (U+0600-U+06FF), Arabic numerals, spaces, and common punctuation
    const arabicPattern = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]+$/;
    return arabicPattern.test(text) || text === '';
  };

  // Polling approach: Update search word from DOM every 50ms (Android IME fix)
  useEffect(() => {
    const checkSearchInput = () => {
      const inputEl = searchInputRef.current;
      if (!inputEl) {
        return;
      }

      const value = inputEl.value;
      
      // Only update state if value changed (avoid unnecessary re-renders)
      if (value !== searchWord) {
        setSearchWord(value);
        // Clear results when typing (search not performed yet)
        if (wordSearchResults.length > 0) {
          setWordSearchResults([]);
        }
        // Reset search state when input changes
        if (hasSearched && value !== searchWord) {
          setHasSearched(false);
        }
      }
    };

    // Check immediately
    checkSearchInput();

    // Then poll every 50ms
    const intervalId = setInterval(checkSearchInput, 50);

    return () => clearInterval(intervalId);
  }, [searchWord, wordSearchResults.length, hasSearched]);

  // Clear the search input and all results
  const clearSearch = () => {
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
    setSearchWord('');
    setSearchedWord('');
    setWordSearchResults([]);
    setHasSearched(false);
  };

  // Number formatting for Arabic/English
  const formatNumber = (num: number | string): string => {
    const numStr = num.toString();
    if (language === 'ar') {
      const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
      return numStr.split('').map(digit => arabicDigits[parseInt(digit)] || digit).join('');
    }
    return numStr;
  };

  // Highlight the searched word in Arabic text (Uthmani-script aware:
  // the match range maps exactly onto the original text)
  const renderHighlightedArabic = (text?: string) => {
    if (!text || !searchedWord) return text;
    const match = findArabicMatch(text, searchedWord);
    if (!match) return text;

    return (
      <>
        {text.slice(0, match.start)}
        <span className="bg-yellow-200 dark:bg-yellow-600 font-semibold rounded px-0.5">
          {text.slice(match.start, match.end)}
        </span>
        {text.slice(match.end)}
      </>
    );
  };

  // Word search functionality - runs only when the user triggers it
  // (search button or Enter), never automatically while typing
  const performWordSearch = () => {
    // Read directly from the input to avoid stale state (Android IME polling)
    const query = (searchInputRef.current?.value ?? searchWord).trim();

    if (query.length >= 2 && ayahData.length > 0) {
      setIsSearchLoading(true);
      setHasSearched(true);
      setSearchedWord(query);

      // Use setTimeout to allow UI to update with loading state
      setTimeout(() => {
        const results: any[] = [];

        ayahData.forEach(surahData => {
          surahData.verses?.forEach((verse: any) => {
            const arabicText = verse.text?.ar || '';

            // Uthmani-aware Arabic match (hamza words like اولئك, يسالونك, ...)
            if (arabicTextMatches(arabicText, query)) {
              results.push({
                surahNumber: surahData.number,
                surahName: typeof surahData.name === 'object' ? surahData.name.ar : surahData.name,
                surahNameEn: typeof surahData.name === 'object' ? surahData.name.en : (surahData.englishName || surahData.name),
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
      setHasSearched(false);
      setSearchedWord('');
    }
  };

  const handleResultClick = (page: number, surahNumber: number, ayahNumber: number) => {
    if (onNavigate) {
      // Pass ayah information for search result navigation
      onNavigate(page, { surah: surahNumber, ayah: ayahNumber });
      onClose?.();
    } else {
      navigate(`/page/${page}`);
    }
  };

  // Show loading state while data is loading
  if (isAyahDataLoading) {
    return (
      <div className={cn("p-4 flex flex-col items-center justify-center py-16 space-y-3", isRTL ? "rtl" : "ltr")}>
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className={cn("text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
          {isRTL ? 'جاري التحميل...' : 'Loading...'}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("w-full max-w-2xl mx-auto min-h-full", isRTL ? "rtl" : "ltr")}>
      {/* Search bar - docked under the app bar, like Android search screens */}
      <div className="sticky top-0 z-10 bg-[#FBF9F4] dark:bg-black pt-2 pb-2 px-3">
        <div className="flex items-center gap-2 min-h-[52px] px-3 rounded-2xl bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800 shadow-sm focus-within:border-emerald-500 dark:focus-within:border-emerald-500 transition-colors">
          <Search className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={t('searchWordPlaceholder')}
            onInput={(e) => {
              const input = e.target as HTMLInputElement;
              // Filter: keep only Arabic characters in real-time
              if (!isArabicText(input.value)) {
                // Find last valid Arabic substring
                const filtered = input.value.split('').filter((char, i) =>
                  isArabicText(input.value.substring(0, i + 1))
                ).join('');
                input.value = filtered;
              }
              // State is updated by 50ms polling, not here
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                performWordSearch();
              }
            }}
            className={cn(
              "flex-1 min-w-0 min-h-[44px] bg-transparent focus:outline-none text-emerald-900 dark:text-emerald-100 placeholder:text-emerald-400/70",
              textSizeClasses.text
            )}
          />
          <button
            type="button"
            onClick={performWordSearch}
            className="flex items-center justify-center gap-1.5 px-4 h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-[#F2E3BB] font-medium shadow-md shrink-0 transition-colors"
            aria-label={isRTL ? 'بحث' : 'Search'}
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">{isRTL ? 'بحث' : 'Search'}</span>
          </button>
          {searchWord && (
            <button
              onClick={clearSearch}
              className="flex items-center justify-center w-9 h-9 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 active:bg-emerald-100 dark:active:bg-emerald-900/40 transition-colors shrink-0"
              aria-label={isRTL ? 'مسح' : 'Clear search'}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Content below the docked bar */}
      <div className="px-3 pt-2 pb-4 space-y-2">
        {/* Search Instructions */}
        {!isSearchLoading && wordSearchResults.length === 0 && !searchWord && (
          <div className="py-12 px-4 text-center space-y-3">
            <span className="mx-auto flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-b from-emerald-800 to-emerald-600 shadow-md">
              <Search className="w-7 h-7 text-[#F2E3BB]" />
            </span>
            <p className={cn("text-emerald-800 dark:text-emerald-300 font-medium", textSizeClasses.text)}>
              {isRTL ? 'ابحث فى نصوص الآيات' : 'Search for a word or phrase'}
            </p>
            <p className="text-emerald-600 dark:text-emerald-400 text-sm">
              {isRTL ? '(البحث بالعربية فقط)' : '(Arabic text only)'}
            </p>
          </div>
        )}

        {/* Loading State */}
        {isSearchLoading && (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <p className={cn("text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
              {isRTL ? 'جاري البحث...' : 'Searching...'}
            </p>
          </div>
        )}

        {/* Search Results - flat Material rows like the settings list */}
        {!isSearchLoading && wordSearchResults.length > 0 && (
          <>
            <div className={cn("px-1 py-2 font-semibold text-emerald-800 dark:text-emerald-300", textSizeClasses.text)}>
              {t('foundIn')} {formatNumber(wordSearchResults.length)} {t('ayahs')}
            </div>
            {wordSearchResults.map((result, index) => (
              <motion.button
                key={`${result.surahNumber}-${result.ayahNumber}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
                onClick={() => handleResultClick(result.page, result.surahNumber, result.ayahNumber)}
                className="w-full px-3 py-3 rounded-2xl active:bg-emerald-100 dark:active:bg-emerald-900/40 transition-colors"
              >
                <span className="block space-y-1.5">
                  {/* Row header: "Surah name - آية N" (matches the reader / audio style) */}
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn("font-medium text-emerald-800 dark:text-emerald-200 truncate", textSizeClasses.label)}>
                      {isRTL
                        ? `${result.surahName} - آية ${formatNumber(result.ayahNumber)}`
                        : `${result.surahNameEn} - Ayah ${result.ayahNumber}`}
                    </span>
                    <span className={cn(
                      "shrink-0 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300",
                      textSizeClasses.text
                    )}>
                      {isRTL ? 'صفحة' : 'Page'} {formatNumber(result.page)}
                    </span>
                  </span>
                  {/* Ayah text with highlighted match */}
                  <span
                    className={cn(
                      "block p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/20",
                      quranTextClasses,
                      "text-right text-emerald-900 dark:text-emerald-100 leading-[2.2] font-quran"
                    )}
                  >
                    {renderHighlightedArabic(result.arabicText)}
                  </span>
                </span>
              </motion.button>
            ))}
          </>
        )}

        {/* No Results */}
        {!isSearchLoading && hasSearched && wordSearchResults.length === 0 && searchedWord.trim().length >= 2 && (
          <div className={cn(
            "text-center py-10 px-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-900/20",
            textSizeClasses.text
          )}>
            <p className="text-emerald-800 dark:text-emerald-300 font-medium">
              {isRTL ? 'لم يتم العثور على نتائج' : 'No results found'}
            </p>
            <p className="text-emerald-600 dark:text-emerald-400 text-sm mt-1">
              {isRTL ? 'جرب كلمة مختلفة' : 'Try a different word'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
