import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
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
  onPlayAyah: (surahNum: number, ayahNum: number) => void;
  onSetCurrentPlayingAyah: (ayah: { surah: number; ayah: number }) => void;
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
  onPlayAyah,
  onSetCurrentPlayingAyah,
}: AyahSelectorDialogProps) {
  const { t, isRTL, language } = useLanguage();
  const navigate = useNavigate();
  const ayahListRef = useRef<HTMLDivElement>(null);

  const handleAyahClick = (surahNum: number, ayahNum: number, versePage: number) => {
    // Set flag to prevent auto-switch to first ayah
    isAyahNavigationRef.current = true;
    // Set current playing ayah BEFORE navigation to ensure it persists
    onSetCurrentPlayingAyah({ surah: surahNum, ayah: ayahNum });
    // Play the selected ayah
    onPlayAyah(surahNum, ayahNum);
    // Navigate to the page containing this ayah (use verse.page directly)
    navigate(`/page/${versePage}#${surahNum}-${ayahNum}`);
    onOpenChange(false);
    // Reset flag after navigation completes (handles case where ayah is on same page)
    setTimeout(() => {
      isAyahNavigationRef.current = false;
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "sm:max-w-md max-w-[90vw] max-h-[98vh] overflow-y-auto rounded-xl border border-emerald-500",
        isRTL && "rtl"
      )}> 
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
                      onClick={() => handleAyahClick(surah.number, verse.number, verse.page)}
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
  );
}
