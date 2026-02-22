import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { cn } from "@/lib/utils";
import { useTafseer } from "@/hooks/useTafseer";
import { useState, useEffect } from "react";
import { surahs } from "@/data/surahs";

/**
 * Tafseer View Component
 * Used by Configuration page for /config/tafseer
 * Displays Quran tafseer (interpretation/commentary) for selected ayah
 */
export default function TafseerView() {
  const { t, isRTL, language } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  const {
    tafseers,
    selectedTafseerId,
    setSelectedTafseerId,
    selectedTafseerInfo,
    tafseerText,
    isLoading,
    error,
    fetchTafseerForAyah,
    getTafseersByLanguage,
  } = useTafseer();

  const [currentSurahNumber, setCurrentSurahNumber] = useState(() => {
    const saved = localStorage.getItem('quran-tafseer-surah');
    return saved ? parseInt(saved) : 1;
  });
  const [currentAyahNumber, setCurrentAyahNumber] = useState(() => {
    const saved = localStorage.getItem('quran-tafseer-ayah');
    return saved ? parseInt(saved) : 1;
  });
  const [ayahText, setAyahText] = useState<string>("");
  const [isLoadingAyah, setIsLoadingAyah] = useState(false);

  // Helper function to convert numbers based on language
  const formatNumber = (num: number | string): string => {
    const numStr = num.toString();
    if (language === 'ar') {
      // Convert to Eastern Arabic numerals (٠-٩)
      return numStr.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
    }
    return numStr;
  };

  // Get current surah info for ayah count
  const currentSurah = surahs.find(s => s.id === currentSurahNumber);
  const maxAyahs = currentSurah?.numberOfAyahs || 1;

  // Handle surah change - reset to first ayah
  const handleSurahChange = (value: string) => {
    const newSurahNumber = parseInt(value);
    setCurrentSurahNumber(newSurahNumber);
    setCurrentAyahNumber(1); // Reset to first ayah when changing surah
  };

  // Handle ayah change
  const handleAyahChange = (value: string) => {
    const newAyahNumber = parseInt(value);
    setCurrentAyahNumber(newAyahNumber);
  };

  // Fetch ayah text from Quran.com API - defer to avoid blocking render
  useEffect(() => {
    if (currentSurahNumber && currentAyahNumber) {
      // Defer fetch to next tick to allow view to render first
      const timeoutId = setTimeout(() => {
        setIsLoadingAyah(true);
        setAyahText(""); // Reset ayah text
        
        // Use Quran.com API to get verse text
        fetch(`https://api.quran.com/api/v4/verses/by_key/${currentSurahNumber}:${currentAyahNumber}?fields=text_uthmani`)
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
          })
          .then(data => {
            if (data && data.verse && data.verse.text_uthmani) {
              console.log('Ayah text loaded from Quran.com API:', data.verse.text_uthmani);
              setAyahText(data.verse.text_uthmani);
            } else {
              console.warn('Verse text not found in response');
            }
            setIsLoadingAyah(false);
          })
          .catch(err => {
            console.error('Failed to load ayah text from Quran.com API:', err);
            setIsLoadingAyah(false);
          });
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentSurahNumber, currentAyahNumber]);

  // Fetch tafseer when ayah changes - defer to avoid blocking render
  useEffect(() => {
    if (currentSurahNumber && currentAyahNumber && selectedTafseerId) {
      // Defer fetch to next tick to allow view to render first
      const timeoutId = setTimeout(() => {
        fetchTafseerForAyah(currentSurahNumber, currentAyahNumber);
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSurahNumber, currentAyahNumber, selectedTafseerId]);

  // Navigation handlers
  const handlePreviousAyah = () => {
    if (currentAyahNumber > 1) {
      setCurrentAyahNumber(currentAyahNumber - 1);
    }
  };

  const handleNextAyah = () => {
    if (currentAyahNumber < maxAyahs) {
      setCurrentAyahNumber(currentAyahNumber + 1);
    }
  };

  // Get tafseers for current language
  const languageTafseers = getTafseersByLanguage(language);
  const allTafseers = languageTafseers.length > 0 ? languageTafseers : tafseers;

  return (
    <div className={cn(
      "flex flex-col h-full",
      isRTL ? "rtl" : "ltr"
    )}>
      {/* Fixed Top Section - Selectors and Controls */}
      <div className="flex-shrink-0 p-4 space-y-4">
        {/* Surah and Ayah Selectors */}
        <div className={cn(
          "grid grid-cols-2 gap-3 md:gap-4",
          isRTL && "rtl"
        )}>
        {/* Surah Selector */}
        <div className="space-y-2">
          <label className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
            {t('selectSurah')}
          </label>
          <Select
            value={currentSurahNumber.toString()}
            onValueChange={handleSurahChange}
          >
            <SelectTrigger className={cn(
              "w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500",
              isRTL && "text-right",
              textSizeClasses.text
            )}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={cn("bg-[#FBF9F4] dark:bg-emerald-950", isRTL ? "rtl" : "ltr")}>
              {surahs.map((surah) => (
                <SelectItem 
                  key={surah.id} 
                  value={surah.id.toString()}
                  className={cn(
                    "focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100",
                    isRTL ? "text-right" : "text-left",
                    textSizeClasses.text
                  )}
                >
                  {formatNumber(surah.id)}. {language === 'ar' ? surah.name : surah.englishName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ayah Selector */}
        <div className="space-y-2">
          <label className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
            {t('selectAyah')}
          </label>
          <Select
            value={currentAyahNumber.toString()}
            onValueChange={handleAyahChange}
          >
            <SelectTrigger className={cn(
              "w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500",
              isRTL && "text-right",
              textSizeClasses.text
            )}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={cn("bg-[#FBF9F4] dark:bg-emerald-950", isRTL ? "rtl" : "ltr")}>
              {Array.from({ length: maxAyahs }, (_, i) => i + 1).map((ayahNum) => (
                <SelectItem 
                  key={ayahNum} 
                  value={ayahNum.toString()}
                  className={cn(
                    "focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100",
                    isRTL ? "text-right" : "text-left",
                    textSizeClasses.text
                  )}
                >
                  {t('ayah')} {formatNumber(ayahNum)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Ayah Navigation */}
      <div className={cn(
        "flex items-center justify-between gap-2 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/20",
        isRTL && "flex-row-reverse"
      )}>
        <button
          onClick={handlePreviousAyah}
          disabled={currentAyahNumber <= 1}
          className={cn("bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-emerald-600 shadow-md px-3 md:px-4 py-1.5 md:py-2 text-[#F2E3BB] font-medium transition-all", textSizeClasses.button)}
        >
          {t('previousAyah')}
        </button>
        
        <div className="text-center flex-1">
          <div className={cn("font-bold text-emerald-900 dark:text-emerald-300", textSizeClasses.text)}>
            {formatNumber(currentAyahNumber)} / {formatNumber(maxAyahs)}
          </div>
        </div>

        <button
          onClick={handleNextAyah}
          disabled={currentAyahNumber >= maxAyahs}
          className={cn("bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-emerald-600 shadow-md px-3 md:px-4 py-1.5 md:py-2 text-[#F2E3BB] font-medium transition-all", textSizeClasses.button)}
        >
          {t('nextAyah')}
        </button>
      </div>

      {/* Ayah Text Display */}
      <div className={cn(
        "rounded-lg",
        isRTL && "rtl"
      )}>
        <div className={cn("font-medium text-emerald-800 dark:text-emerald-300 pb-2", textSizeClasses.label)}>
          {t('ayahText')}
        </div>
        {isLoadingAyah ? (
          <div className="flex items-center justify-center py-6 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-lg">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
          </div>
        ) : ayahText ? (
          <div className="max-h-[250px] md:max-h-[300px] overflow-y-auto p-4 border border-emerald-300 dark:border-emerald-600 rounded-lg bg-emerald-50/60 dark:bg-emerald-900/20">
            <div className={cn("leading-[2.2] text-right text-emerald-900 dark:text-emerald-50", textSizeClasses.text)} style={{ fontFamily: "'Scheherazade New', 'Noto Naskh Arabic', serif" }}>
              {ayahText}
            </div>
          </div>
        ) : (
          <div className={cn("text-center py-6 text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-lg", textSizeClasses.text)}>
            {isRTL ? 'لا يمكن تحميل نص الآية' : 'Unable to load ayah text'}
          </div>
        )}
      </div>

      {/* Tafseer Selector */}
      <div className="space-y-2">
        <label className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
          {t('selectTafseer')}
        </label>
        <Select
          value={selectedTafseerId?.toString() || ""}
          onValueChange={(value) => setSelectedTafseerId(parseInt(value))}
        >
          <SelectTrigger className={cn(
            "w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500",
            isRTL && "text-right",
            textSizeClasses.text
          )}>
            <SelectValue placeholder={t('selectTafseer')} />
          </SelectTrigger>
          <SelectContent className={cn("bg-[#FBF9F4] dark:bg-emerald-950", isRTL ? "rtl" : "ltr")}>
            {allTafseers.map((tafseer) => (
              <SelectItem 
                key={tafseer.id} 
                value={tafseer.id.toString()}
                className={cn(
                  "focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 font-bold",
                  isRTL ? "text-right" : "text-left",
                  textSizeClasses.text
                )}
              >
                {tafseer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      </div>

      {/* Flexible Tafseer Content - Takes remaining space */}
      <div className="flex-1 overflow-hidden px-4 pb-24 md:pb-20">
        <div className={cn("font-medium text-emerald-800 dark:text-emerald-300 pb-2", textSizeClasses.label)}>
          {t('tafseer')}
        </div>
        <ScrollArea className="h-full w-full rounded-md border border-emerald-200 dark:border-emerald-700 p-4 bg-white dark:bg-emerald-950/30">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[200px] gap-2">
              <Loader2 className="w-6 h-6 md:w-8 md:h-8 animate-spin text-emerald-600 dark:text-emerald-400" />
              <span className={cn("text-emerald-800 dark:text-emerald-300", textSizeClasses.text)}>
                {t('loadingTafseer')}
              </span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center min-h-[200px] space-y-4 px-4">
              <div className="text-center">
                <p className={cn("text-red-600 dark:text-red-400 font-medium mb-2", textSizeClasses.text)}>{error}</p>
                <p className={cn("text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
                  {isRTL 
                    ? 'يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى'
                    : 'Please check your internet connection and try again'
                  }
                </p>
              </div>
              <button
                onClick={() => fetchTafseerForAyah(currentSurahNumber, currentAyahNumber)}
                className={cn("bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md px-4 py-2 text-[#F2E3BB] font-medium transition-all", textSizeClasses.button)}
              >
                {isRTL ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          ) : tafseerText ? (
            <div className={cn(
              "leading-relaxed text-emerald-900 dark:text-emerald-100",
              isRTL ? "text-right" : "text-left",
              textSizeClasses.text
            )}>
              {tafseerText.text}
            </div>
          ) : (
            <div className={cn("flex items-center justify-center min-h-[200px] text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
              {t('tafseerNotAvailable')}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
