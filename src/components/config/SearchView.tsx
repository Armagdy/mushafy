import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { useQuranData } from "@/hooks/useQuranData";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

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
  
  const [searchWord, setSearchWord] = useState('');
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

  // Number formatting for Arabic/English
  const formatNumber = (num: number | string): string => {
    const numStr = num.toString();
    if (language === 'ar') {
      const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
      return numStr.split('').map(digit => arabicDigits[parseInt(digit)] || digit).join('');
    }
    return numStr;
  };

  // Normalize Arabic text by removing diacritics and normalizing character variations
  const normalizeArabic = (text: string) => {
    const normalized = text
      .replace(/\u0640\u0670/g, '') // Remove tatweel+superscript-alif combo FIRST (e.g. هَـٰٓؤُلَآء, أُوْلَـٰٓئِكَ) — decorative elongation, NOT a real alif
      .replace(/\u0670/g, '\u0627') // Remaining standalone superscript alif → regular alif (e.g. إِبْرَٰهِيمَ has a real alif here)
      .replace(/\u0640/g, '') // Remove any remaining tatweel/kashida
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, '') // Remove diacritics
      .replace(/[ٱأإآٲٳٵ]/g, 'ا') // Normalize alef variations
      .replace(/[ىي]/g, 'ي') // Normalize yaa
      .replace(/ة/g, 'ه') // Normalize taa marboota
      .replace(/ؤ/g, 'و') // Normalize waw with hamza
      .replace(/ئ/g, 'ي') // Normalize yaa with hamza (ئ → ي, e.g. خطيئة matches خطيـٔته in Uthmani)
      .replace(/([\u0600-\u06ff])\1+/g, '$1') // Collapse consecutive identical Arabic letters (e.g. خطيي→خطي after ئ→ي)
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
      setHasSearched(true);
      
      console.log('=== WORD SEARCH DEBUG ===');
      console.log('Search Word:', searchWord);
      console.log('Ayah Data Length:', ayahData.length);
      console.log('Normalized Search:', normalizeArabic(searchWord));
      
      // Use setTimeout to allow UI to update with loading state
      setTimeout(() => {
        // Search for the full text phrase in Arabic only
        const normalizedSearchFull = normalizeArabic(searchWord);
        const results: any[] = [];
        
        ayahData.forEach(surahData => {
          surahData.verses?.forEach((verse: any) => {
            const arabicText = verse.text?.ar || '';
            const normalizedArabic = normalizeArabic(arabicText);
            
            // Check if the full phrase matches in Arabic
            const matchesArabic = normalizedArabic.includes(normalizedSearchFull);
            
            if (matchesArabic) {
              console.log('Found match in Surah', surahData.number, 'Ayah', verse.number);
              console.log('Arabic Text:', arabicText);
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
    <div className={cn("p-4 space-y-2 sm:space-y-3", isRTL ? "rtl" : "ltr")}>
      {/* Header */}
      <h1 className={cn(
        "text-xl md:text-2xl font-bold bg-gradient-to-r from-emerald-800 to-emerald-600 bg-clip-text text-transparent mb-4",
        isRTL ? "text-right" : "text-left"
      )}>
        {isRTL ? 'بحث' : 'Search'}
      </h1>
      
      {/* Search Input */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className={cn(
              "absolute top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600 dark:text-emerald-400",
              isRTL ? "right-3" : "left-3"
            )} />
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
                "w-full py-2 rounded-lg border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2",
                isRTL ? "pr-10 pl-3" : "pl-10 pr-3",
                textSizeClasses.text
              )}
            />
          </div>
          <Button
            onClick={performWordSearch}
            className={cn(
              "px-4 py-2 bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB]",
              textSizeClasses.button
            )}
          >
            {isRTL ? 'بحث' : 'Search'}
          </Button>
        </div>
        
        {/* Search Instructions */}
        {!isSearchLoading && wordSearchResults.length === 0 && !searchWord && (
          <div className={cn(
            "text-center py-8 px-4 rounded-lg bg-emerald-50/60 dark:bg-emerald-900/20",
            textSizeClasses.text
          )}>
            <Search className="w-12 h-12 mx-auto mb-3 text-emerald-600 dark:text-emerald-400" />
            <p className="text-emerald-800 dark:text-emerald-300 font-medium mb-2">
              {isRTL ? 'ابحث فى نصوص الايات' : 'Search for a word or phrase'}
            </p>
            <p className="text-emerald-600 dark:text-emerald-400 text-sm">
              {isRTL ? '(البحث بالعربية فقط)' : '(Arabic text only)'}
            </p>
          </div>
        )}
        
        {/* Loading State */}
        {isSearchLoading && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <p className={cn("text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
              {isRTL ? 'جاري البحث...' : 'Searching...'}
            </p>
          </div>
        )}
        
        {/* Search Results */}
        {!isSearchLoading && wordSearchResults.length > 0 && (
          <div className="space-y-2">
            <div className={cn("font-medium text-emerald-800 dark:text-emerald-300 mb-2", textSizeClasses.text)}>
              {t('foundIn')} {formatNumber(wordSearchResults.length)} {t('ayahs')}
            </div>
            <div className="max-h-[500px] sm:max-h-[550px] md:max-h-[600px] overflow-y-auto space-y-2">
              {wordSearchResults.map((result, index) => (
                <motion.button
                  key={`${result.surahNumber}-${result.ayahNumber}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => handleResultClick(result.page, result.surahNumber, result.ayahNumber)}
                  className={cn(
                    "w-full p-3 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-[#FBF9F4] dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-gray-700 transition-all",
                    isRTL ? "text-right" : "text-left"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className={cn("font-semibold text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
                      {isRTL ? result.surahName : result.surahNameEn} - {isRTL ? 'الآية' : 'Ayah'} {formatNumber(result.ayahNumber)}
                    </div>
                    <div className={cn("text-emerald-600 dark:text-emerald-400 whitespace-nowrap", textSizeClasses.text)}>
                      {isRTL ? 'صفحة' : 'Page'} {formatNumber(result.page)}
                    </div>
                  </div>
                  <div 
                    className={cn(
                      "p-3 border border-emerald-300 dark:border-emerald-600 rounded-lg bg-emerald-50/60 dark:bg-emerald-900/20",
                      textSizeClasses.text,
                      "text-right text-emerald-900 dark:text-emerald-100 leading-[2.2] font-arabic"
                    )}
                  >
                    {highlightText(result.arabicText, searchWord, true)}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}
        
        {/* No Results */}
        {!isSearchLoading && hasSearched && wordSearchResults.length === 0 && searchWord.trim().length >= 2 && (
          <div className={cn(
            "text-center py-8 px-4 rounded-lg bg-emerald-50/60 dark:bg-emerald-900/20",
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
      </motion.div>
    </div>
  );
}
