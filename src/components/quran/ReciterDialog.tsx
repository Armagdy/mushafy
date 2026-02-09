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
      <DialogContent className={cn(
        "sm:max-w-md max-w-[90vw] max-h-[85vh] overflow-y-auto rounded-xl border border-emerald-500",
        isRTL ? "rtl" : "ltr"
      )}>
        <DialogHeader>
          <DialogTitle className="text-center text-base md:text-xl font-bold bg-gradient-to-r from-emerald-800 to-emerald-600 bg-clip-text text-transparent">
            {t('selectReciter')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2 sm:space-y-3">
          {/* Reciter Name Filter */}
          <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {t('reciterName')}
            </span>
            <Select value={filterReciterName} onValueChange={onFilterReciterNameChange}>
              <SelectTrigger className="w-full h-8 sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                {uniqueReciterNames.map((reciter) => (
                  <SelectItem key={reciter.nameAr} value={reciter.nameAr}>
                    {language === 'ar' ? reciter.nameAr : reciter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Reading Type Filter */}
          <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {t('readingType')}
            </span>
            <Select value={filterReading} onValueChange={onFilterReadingChange}>
              <SelectTrigger className="w-full h-8 sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterReciterName === 'all' && <SelectItem value="all">{t('all')}</SelectItem>}
                {availableReadings.includes('hafs') && <SelectItem value="hafs">{t('hafs')}</SelectItem>}
                {availableReadings.includes('warsh') && <SelectItem value="warsh">{t('warsh')}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          
          {/* Recitation Style Filter */}
          <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {t('recitationStyle')}
            </span>
            <Select value={filterStyle} onValueChange={onFilterStyleChange}>
              <SelectTrigger className="w-full h-8 sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterReciterName === 'all' && <SelectItem value="all">{t('all')}</SelectItem>}
                {availableStyles.includes('murattal') && <SelectItem value="murattal">{t('murattal')}</SelectItem>}
                {availableStyles.includes('mujawwad') && <SelectItem value="mujawwad">{t('mujawwad')}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          
          {/* Quality Filter */}
          <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {t('quality')}
            </span>
            <Select value={filterQuality} onValueChange={onFilterQualityChange}>
              <SelectTrigger className="w-full h-8 sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterReciterName === 'all' && <SelectItem value="all">{t('all')}</SelectItem>}
                {availableQualities.includes('192kbps') && <SelectItem value="192kbps">192kbps</SelectItem>}
                {availableQualities.includes('128kbps') && <SelectItem value="128kbps">128kbps</SelectItem>}
                {availableQualities.includes('64kbps') && <SelectItem value="64kbps">64kbps</SelectItem>}
                {availableQualities.includes('48kbps') && <SelectItem value="48kbps">48kbps</SelectItem>}
                {availableQualities.includes('40kbps') && <SelectItem value="40kbps">40kbps</SelectItem>}
                {availableQualities.includes('32kbps') && <SelectItem value="32kbps">32kbps</SelectItem>}
                {availableQualities.includes('16kbps') && <SelectItem value="16kbps">16kbps</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Listen Button */}
        <div className="pt-2 sm:pt-3 mt-2">
          <Button
            onClick={onListen}
            disabled={!selectedReciter && filteredReciters.length === 0}
            className="w-full h-9 sm:h-10 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('listen')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
