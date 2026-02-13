import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useTafseer } from "@/hooks/useTafseer";
import { useState, useEffect } from "react";
import { surahs } from "@/data/surahs";

interface TafseerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surahNumber: number;
  ayahNumber: number;
  surahName: string;
}

export function TafseerDialog({ 
  open, 
  onOpenChange, 
  surahNumber, 
  ayahNumber,
  surahName 
}: TafseerDialogProps) {
  const { t, isRTL, language } = useLanguage();
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

  const [currentSurahNumber, setCurrentSurahNumber] = useState(surahNumber);
  const [currentAyahNumber, setCurrentAyahNumber] = useState(ayahNumber);
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

  // Reset current surah and ayah when props change
  useEffect(() => {
    setCurrentSurahNumber(surahNumber);
    setCurrentAyahNumber(ayahNumber);
  }, [surahNumber, ayahNumber]);

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

  // Fetch ayah text from Quran.com API (same source as tafseer)
  useEffect(() => {
    if (open && currentSurahNumber && currentAyahNumber) {
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
    }
  }, [open, currentSurahNumber, currentAyahNumber]);

  // Fetch tafseer when dialog opens or ayah changes
  useEffect(() => {
    if (open && currentSurahNumber && currentAyahNumber && selectedTafseerId) {
      fetchTafseerForAyah(currentSurahNumber, currentAyahNumber);
    }
  }, [open, currentSurahNumber, currentAyahNumber, selectedTafseerId]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "sm:max-w-md md:max-w-lg lg:max-w-xl max-w-[90vw] p-0",
          "rounded-xl border-0 bg-[#FBF9F4]",
          isRTL ? "rtl" : "ltr"
        )}
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        <DialogHeader className="bg-gradient-to-b from-emerald-800 to-emerald-600 rounded-t-xl px-4 py-3">
          <DialogTitle className="text-center text-base md:text-xl font-bold text-[#F2E3BB]">
            {t('tafseer')}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-2 sm:space-y-3">
        {/* Surah and Ayah Selectors */}
        <div className={cn(
          "grid grid-cols-2 gap-3",
          isRTL && "rtl"
        )}>
          {/* Surah Selector */}
          <div className="space-y-2">
            <label className="text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-300">
              {t('selectSurah')}
            </label>
            <Select
              value={currentSurahNumber.toString()}
              onValueChange={handleSurahChange}
            >
              <SelectTrigger className={cn(
                "w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 text-base md:text-xl",
                isRTL && "text-right"
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={cn("bg-[#FBF9F4] dark:bg-emerald-950", isRTL ? "rtl" : "ltr")}>
                {surahs.map((surah) => (
                  <SelectItem 
                    key={surah.id} 
                    value={surah.id.toString()}
                    className={cn(
                      "focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 text-base md:text-xl",
                      isRTL ? "text-right" : "text-left"
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
            <label className="text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-300">
              {t('selectAyah')}
            </label>
            <Select
              value={currentAyahNumber.toString()}
              onValueChange={handleAyahChange}
            >
              <SelectTrigger className={cn(
                "w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 text-base md:text-xl",
                isRTL && "text-right"
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={cn("bg-[#FBF9F4] dark:bg-emerald-950", isRTL ? "rtl" : "ltr")}>
                {Array.from({ length: maxAyahs }, (_, i) => i + 1).map((ayahNum) => (
                  <SelectItem 
                    key={ayahNum} 
                    value={ayahNum.toString()}
                    className={cn(
                      "focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 text-base md:text-xl",
                      isRTL ? "text-right" : "text-left"
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
          "flex items-center justify-between gap-2 p-2 sm:p-3 rounded-lg",
          isRTL && "flex-row-reverse"
        )}>
          <button
            onClick={handlePreviousAyah}
            disabled={currentAyahNumber <= 1}
            className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-emerald-600 shadow-md px-3 md:px-4 py-1.5 md:py-2 text-base md:text-xl text-[#F2E3BB] font-medium transition-all"
          >
            {t('previousAyah')}
          </button>
          
          <div className="text-center flex-1">
            <div className="text-base md:text-xl font-bold text-emerald-900">{formatNumber(currentAyahNumber)} / {formatNumber(maxAyahs)}</div>
          </div>

          <button
            onClick={handleNextAyah}
            disabled={currentAyahNumber >= maxAyahs}
            className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-emerald-600 shadow-md px-3 md:px-4 py-1.5 md:py-2 text-base md:text-xl text-[#F2E3BB] font-medium transition-all"
          >
            {t('nextAyah')}
          </button>
        </div>

        {/* Ayah Text Display */}
        <div className={cn(
          "rounded-lg",
          isRTL && "rtl"
        )}>
          <div className="text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-300 pb-2">{t('ayahText')}</div>
          {isLoadingAyah ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
            </div>
          ) : ayahText ? (
            <ScrollArea className="max-h-[100px] sm:max-h-[120px] md:max-h-[140px] p-3 border border-emerald-200 dark:border-emerald-700 rounded-lg">
              <div className="text-lg md:text-xl lg:text-2xl leading-relaxed text-right font-arabic text-emerald-900 dark:text-emerald-100">
                {ayahText}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-4 text-emerald-600 dark:text-emerald-400 text-base md:text-xl">
              {isRTL ? 'لا يمكن تحميل نص الآية' : 'Unable to load ayah text'}
            </div>
          )}
        </div>

        {/* Tafseer Selector */}
        <div className="space-y-2">
          <label className="text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-300">
            {t('selectTafseer')}
          </label>
          <Select
            value={selectedTafseerId?.toString() || ""}
            onValueChange={(value) => setSelectedTafseerId(parseInt(value))}
          >
            <SelectTrigger className={cn(
              "w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 text-base md:text-xl",
              isRTL && "text-right"
            )}>
              <SelectValue placeholder={t('selectTafseer')} />
            </SelectTrigger>
            <SelectContent className={cn("bg-[#FBF9F4] dark:bg-emerald-950", isRTL ? "rtl" : "ltr")}>
              {allTafseers.map((tafseer) => (
                <SelectItem 
                  key={tafseer.id} 
                  value={tafseer.id.toString()}
                  className={cn(
                    "focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 text-base md:text-xl font-bold",
                    isRTL ? "text-right" : "text-left"
                  )}
                >
                  {tafseer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tafseer Content */}
        <ScrollArea className="h-[250px] sm:h-[350px] md:h-[450px] lg:h-[550px] w-full rounded-md border border-emerald-200 dark:border-emerald-700 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full gap-2">
              <Loader2 className="w-6 h-6 md:w-8 md:h-8 animate-spin text-emerald-600 dark:text-emerald-400" />
              <span className="text-base md:text-xl text-emerald-800 dark:text-emerald-300">
                {t('loadingTafseer')}
              </span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 px-4">
              <div className="text-center">
                <p className="text-red-600 dark:text-red-400 font-medium mb-2 text-base md:text-xl">{error}</p>
                <p className="text-base md:text-xl text-emerald-600 dark:text-emerald-400">
                  {isRTL 
                    ? 'يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى'
                    : 'Please check your internet connection and try again'
                  }
                </p>
              </div>
              <button
                onClick={() => fetchTafseerForAyah(currentSurahNumber, currentAyahNumber)}
                className="bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md px-4 py-2 text-base md:text-xl text-[#F2E3BB] font-medium transition-all"
              >
                {isRTL ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          ) : tafseerText ? (
            <div className={cn(
              "leading-relaxed text-emerald-900 dark:text-emerald-100",
              language === 'ar' ? "text-lg md:text-xl lg:text-2xl font-arabic" : "text-base md:text-lg lg:text-xl",
              isRTL ? "text-right" : "text-left"
            )}>
              {tafseerText.text}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-emerald-600 dark:text-emerald-400 text-base md:text-xl">
              {t('tafseerNotAvailable')}
            </div>
          )}
        </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
