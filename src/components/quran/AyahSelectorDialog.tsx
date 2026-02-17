import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { BookText } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface AyahSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ayahData: any[];
  currentPageNum: number;
  secondPageNum: number;
  currentSurahId: number;
  currentPlayingAyah: { surah: number; ayah: number } | null;
  viewMode: 'single' | 'double';
  isMobile: boolean;
  isAyahNavigationRef: React.MutableRefObject<boolean>;
  audioSource: 'everyayah' | 'mp3quran';
  onPlayAyah: (surahNum: number, ayahNum: number) => void;
  onSetCurrentPlayingAyah: (ayah: { surah: number; ayah: number }) => void;
  onSeekToAyahPosition: (surahNum: number, ayahNum: number) => void;
  onViewTafseer?: (surahNum: number, ayahNum: number, surahName: string) => void;
  onStopAudio?: () => void;
}

export function AyahSelectorDialog({
  open,
  onOpenChange,
  ayahData,
  currentPageNum,
  secondPageNum,
  currentSurahId,
  currentPlayingAyah,
  viewMode,
  isMobile,
  isAyahNavigationRef,
  audioSource,
  onPlayAyah,
  onSetCurrentPlayingAyah,
  onSeekToAyahPosition,
  onViewTafseer,
  onStopAudio,
}: AyahSelectorDialogProps) {
  const { t, isRTL, language } = useLanguage();
  const navigate = useNavigate();
  const ayahListRef = useRef<HTMLDivElement>(null);

  const handleAyahClick = (surahNum: number, ayahNum: number, versePage: number) => {
    console.log('=== NAVIGATING FROM AYAH SELECTOR ===');
    console.log('Ayah clicked:', surahNum, ayahNum, 'page:', versePage);
    console.log('Audio source:', audioSource);
    
    if (audioSource === 'mp3quran') {
      // MP3Quran mode: Seek to ayah position to update progress bar
      // This will update the visual position without playing
      onSeekToAyahPosition(surahNum, ayahNum);
    } else {
      // EveryAyah mode: Stop audio playback
      if (onStopAudio) {
        onStopAudio();
      }
    }
    
    // Set flag to prevent auto-switch to first ayah
    isAyahNavigationRef.current = true;
    console.log('Set isAyahNavigation flag to true');
    // Set current playing ayah BEFORE navigation to ensure it persists
    onSetCurrentPlayingAyah({ surah: surahNum, ayah: ayahNum });
    // Navigate to the page containing this ayah (use verse.page directly)
    // Note: Audio will NOT auto-play - user can manually press play if desired
    navigate(`/page/${versePage}#${surahNum}-${ayahNum}`);
    onOpenChange(false);
  };

  const handleTafseerClick = (e: React.MouseEvent, surahNum: number, ayahNum: number, surahName: string) => {
    e.stopPropagation();
    if (onViewTafseer) {
      onViewTafseer(surahNum, ayahNum, surahName);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "sm:max-w-md md:max-w-lg lg:max-w-xl max-w-[90vw] max-h-[85vh] overflow-y-auto p-0",
          "rounded-xl border-0 bg-[#FBF9F4]",
          isRTL ? "rtl" : "ltr"
        )}
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      > 
        <DialogHeader className="bg-gradient-to-b from-emerald-800 to-emerald-600 rounded-t-xl px-4 py-3">
          <DialogTitle className="text-center text-base md:text-xl font-bold text-[#F2E3BB]">
            {t('selectAyahToPlay')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-4 space-y-2 sm:space-y-3">
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
              <div key={surah.number} className="border border-emerald-200 dark:border-emerald-700 rounded-lg overflow-hidden">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 flex items-center justify-between">
                  <span className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">
                    {language === 'ar' ? surah.name?.ar : surah.name?.en}
                  </span>
                  {onViewTafseer && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const firstVerse = surah.verses?.[0];
                        if (firstVerse) {
                          handleTafseerClick(e, surah.number, firstVerse.number, language === 'ar' ? surah.name?.ar : surah.name?.en);
                        }
                      }}
                      className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                      title={t('tafseer')}
                    >
                      <BookText className="w-4 h-4" />
                      <span>{t('tafseer')}</span>
                    </button>
                  )}
                </div>
                <div className="max-h-[25vh] overflow-y-auto p-2 grid grid-cols-5 gap-1">
                  {surah.verses?.map((verse: any) => (
                    <div key={`${surah.number}-${verse.number}`} className="relative group">
                      <motion.button
                        data-ayah={`${surah.number}-${verse.number}`}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAyahClick(surah.number, verse.number, verse.page)}
                        className={`w-full aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all ${
                          currentPlayingAyah?.surah === surah.number && currentPlayingAyah?.ayah === verse.number
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {verse.number}
                      </motion.button>
                      {onViewTafseer && (
                        <button
                          onClick={(e) => handleTafseerClick(e, surah.number, verse.number, language === 'ar' ? surah.name?.ar : surah.name?.en)}
                          className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-600 hover:bg-emerald-700 text-white rounded-full p-0.5 shadow-lg"
                          title={t('tafseer')}
                        >
                          <BookText className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
