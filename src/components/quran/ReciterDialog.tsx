import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface ReciterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedReciter: any;
  filteredReciters: any[];
  uniqueReciterNames: any[];
  filterReciterName: string;
  filterReading: string;
  filterStyle: string;
  filterQuality: string;
  availableReadings: string[];
  availableStyles: string[];
  availableQualities: string[];
  currentPlayingAyah: { surah: number; ayah: number } | null;
  currentSurahId: number;
  onFilterReciterNameChange: (value: string) => void;
  onFilterReadingChange: (value: string) => void;
  onFilterStyleChange: (value: string) => void;
  onFilterQualityChange: (value: string) => void;
  onListen: () => void;
}

export function ReciterDialog({
  open,
  onOpenChange,
  selectedReciter,
  filteredReciters,
  uniqueReciterNames,
  filterReciterName,
  filterReading,
  filterStyle,
  filterQuality,
  availableReadings,
  availableStyles,
  availableQualities,
  onFilterReciterNameChange,
  onFilterReadingChange,
  onFilterStyleChange,
  onFilterQualityChange,
  onListen,
}: ReciterDialogProps) {
  const { t, isRTL, language } = useLanguage();

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
            {t('selectReciter')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-4 space-y-2 sm:space-y-3">
          {/* Reciter Name Filter */}
          <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
            <span className="font-medium text-base md:text-xl text-emerald-800 dark:text-emerald-300">
              {t('reciterName')}
            </span>
            <Select value={filterReciterName} onValueChange={onFilterReciterNameChange}>
              <SelectTrigger className="w-full h-8 sm:h-9 text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
                <SelectItem value="all" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('all')}</SelectItem>
                {uniqueReciterNames.map((reciter) => (
                  <SelectItem key={reciter.nameAr} value={reciter.nameAr} className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">
                    {language === 'ar' ? reciter.nameAr : reciter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Reading Type Filter */}
          <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
            <span className="font-medium text-base md:text-xl text-emerald-800 dark:text-emerald-300">
              {t('readingType')}
            </span>
            <Select value={filterReading} onValueChange={onFilterReadingChange}>
              <SelectTrigger className="w-full h-8 sm:h-9 text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
                {filterReciterName === 'all' && <SelectItem value="all" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('all')}</SelectItem>}
                {availableReadings.includes('hafs') && <SelectItem value="hafs" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('hafs')}</SelectItem>}
                {availableReadings.includes('warsh') && <SelectItem value="warsh" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('warsh')}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          
          {/* Recitation Style Filter */}
          <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
            <span className="font-medium text-base md:text-xl text-emerald-800 dark:text-emerald-300">
              {t('recitationStyle')}
            </span>
            <Select value={filterStyle} onValueChange={onFilterStyleChange}>
              <SelectTrigger className="w-full h-8 sm:h-9 text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
                {filterReciterName === 'all' && <SelectItem value="all" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('all')}</SelectItem>}
                {availableStyles.includes('murattal') && <SelectItem value="murattal" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('murattal')}</SelectItem>}
                {availableStyles.includes('mujawwad') && <SelectItem value="mujawwad" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('mujawwad')}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          
          {/* Quality Filter */}
          <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
            <span className="font-medium text-base md:text-xl text-emerald-800 dark:text-emerald-300">
              {t('quality')}
            </span>
            <Select value={filterQuality} onValueChange={onFilterQualityChange}>
              <SelectTrigger className="w-full h-8 sm:h-9 text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
                {filterReciterName === 'all' && <SelectItem value="all" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('all')}</SelectItem>}
                {availableQualities.includes('192kbps') && <SelectItem value="192kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">192kbps</SelectItem>}
                {availableQualities.includes('128kbps') && <SelectItem value="128kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">128kbps</SelectItem>}
                {availableQualities.includes('64kbps') && <SelectItem value="64kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">64kbps</SelectItem>}
                {availableQualities.includes('48kbps') && <SelectItem value="48kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">48kbps</SelectItem>}
                {availableQualities.includes('40kbps') && <SelectItem value="40kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">40kbps</SelectItem>}
                {availableQualities.includes('32kbps') && <SelectItem value="32kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">32kbps</SelectItem>}
                {availableQualities.includes('16kbps') && <SelectItem value="16kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">16kbps</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* Listen Button */}
          <div className="pt-2 sm:pt-3 mt-2">
            <Button
              onClick={onListen}
              disabled={!selectedReciter && filteredReciters.length === 0}
              className="w-full h-9 sm:h-10 text-base md:text-xl bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('listen')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
