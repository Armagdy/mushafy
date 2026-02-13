import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface RepeatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ayahData: any[];
  repeatStartSurah: number;
  repeatStartAyah: number;
  repeatEndSurah: number;
  repeatEndAyah: number;
  repeatPassageCount: number;
  repeatAyahCount: number;
  audioSource: 'everyayah' | 'mp3quran';
  onRepeatStartSurahChange: (value: number) => void;
  onRepeatStartAyahChange: (value: number) => void;
  onRepeatEndSurahChange: (value: number) => void;
  onRepeatEndAyahChange: (value: number) => void;
  onRepeatPassageCountChange: (value: number) => void;
  onRepeatAyahCountChange: (value: number) => void;
  onStartRepeat: () => void;
}

export function RepeatDialog({
  open,
  onOpenChange,
  ayahData,
  repeatStartSurah,
  repeatStartAyah,
  repeatEndSurah,
  repeatEndAyah,
  repeatPassageCount,
  repeatAyahCount,
  audioSource,
  onRepeatStartSurahChange,
  onRepeatStartAyahChange,
  onRepeatEndSurahChange,
  onRepeatEndAyahChange,
  onRepeatPassageCountChange,
  onRepeatAyahCountChange,
  onStartRepeat,
}: RepeatDialogProps) {
  const { t, isRTL, language } = useLanguage();

  const handleStartSurahChange = (val: string) => {
    const newStartSurah = parseInt(val);
    onRepeatStartSurahChange(newStartSurah);
    // Ensure end surah is not before start surah
    if (repeatEndSurah < newStartSurah) {
      onRepeatEndSurahChange(newStartSurah);
    }
  };

  const handleStartAyahChange = (val: string) => {
    const newStartAyah = parseInt(val);
    onRepeatStartAyahChange(newStartAyah);
    // If same surah, ensure end ayah is at least start ayah + 1
    if (repeatStartSurah === repeatEndSurah && repeatEndAyah <= newStartAyah) {
      onRepeatEndAyahChange(newStartAyah + 1);
    }
  };

  const handleEndSurahChange = (val: string) => {
    const newEndSurah = parseInt(val);
    onRepeatEndSurahChange(newEndSurah);
    // If switching to same surah as start, ensure end ayah is greater than start ayah
    if (newEndSurah === repeatStartSurah && repeatEndAyah <= repeatStartAyah) {
      onRepeatEndAyahChange(repeatStartAyah + 1);
    }
  };

  const handleApply = () => {
    onStartRepeat();
    onOpenChange(false);
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
            {t('repeatSettings')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-4 space-y-2 sm:space-y-3">
          {/* Start Position */}
          <div className="space-y-2">
            <Label className={cn("text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-300", isRTL ? "text-right" : "text-left")}>
              {t('startFrom')}
            </Label>
            <div className="flex gap-2">
              <Select value={repeatStartSurah.toString()} onValueChange={handleStartSurahChange}>
                <SelectTrigger className="flex-1 text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60 bg-[#FBF9F4] dark:bg-emerald-950">
                  {ayahData.map((surah: any) => (
                    <SelectItem key={surah.number} value={surah.number.toString()} className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">
                      {language === 'ar' ? surah.name?.ar : surah.name?.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={repeatStartAyah.toString()} onValueChange={handleStartAyahChange} disabled={audioSource === 'mp3quran'}>
                <SelectTrigger className={cn(
                  "flex-1 text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500",
                  audioSource === 'mp3quran' && "opacity-50 cursor-not-allowed"
                )}>
                  <SelectValue placeholder={t('ayahNumber')} />
                </SelectTrigger>
                <SelectContent className="max-h-60 bg-[#FBF9F4] dark:bg-emerald-950">
                  {(() => {
                    const startSurahData = ayahData.find((s: any) => s.number === repeatStartSurah);
                    const maxAyah = startSurahData?.verses?.length || 1;
                    
                    return Array.from({ length: maxAyah }, (_, i) => i + 1).map(num => (
                      <SelectItem key={num} value={num.toString()} className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">
                        {isRTL ? `الآية ${num}` : `Ayah ${num}`}
                      </SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* End Position */}
          <div className="space-y-2">
            <Label className={cn("text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-300", isRTL ? "text-right" : "text-left")}>
              {t('endAt')}
            </Label>
            <div className="flex gap-2">
              <Select value={repeatEndSurah.toString()} onValueChange={handleEndSurahChange}>
                <SelectTrigger className="flex-1 text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60 bg-[#FBF9F4] dark:bg-emerald-950">
                  {ayahData.filter((surah: any) => surah.number >= repeatStartSurah).map((surah: any) => (
                    <SelectItem key={surah.number} value={surah.number.toString()} className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">
                      {language === 'ar' ? surah.name?.ar : surah.name?.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={repeatEndAyah.toString()} onValueChange={(val) => onRepeatEndAyahChange(parseInt(val))} disabled={audioSource === 'mp3quran'}>
                <SelectTrigger className={cn(
                  "flex-1 text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500",
                  audioSource === 'mp3quran' && "opacity-50 cursor-not-allowed"
                )}>
                  <SelectValue placeholder={t('ayahNumber')} />
                </SelectTrigger>
                <SelectContent className="max-h-60 bg-[#FBF9F4] dark:bg-emerald-950">
                  {(() => {
                    const endSurahData = ayahData.find((s: any) => s.number === repeatEndSurah);
                    const maxAyah = endSurahData?.verses?.length || 1;
                    const minAyah = repeatStartSurah === repeatEndSurah ? repeatStartAyah + 1 : 1;
                    
                    return Array.from({ length: maxAyah - minAyah + 1 }, (_, i) => minAyah + i).map(num => (
                      <SelectItem key={num} value={num.toString()} className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">
                        {isRTL ? `الآية ${num}` : `Ayah ${num}`}
                      </SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Repeat Passage Count */}
          <div className="space-y-2">
            <Label htmlFor="repeat-passage" className={cn("text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-300", isRTL ? "text-right" : "text-left")}>
              {t('repeatPassage')}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="repeat-passage"
                type="number"
                min="0"
                max="100"
                value={repeatPassageCount || ''}
                onChange={(e) => onRepeatPassageCountChange(parseInt(e.target.value) || 0)}
                className="flex-1 text-base md:text-lg border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-sm md:text-base text-emerald-600 dark:text-emerald-400">{t('times')}</span>
            </div>
          </div>

          {/* Repeat Each Ayah Count */}
          <div className="space-y-2">
            <Label htmlFor="repeat-ayah" className={cn("text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-300", isRTL ? "text-right" : "text-left")}>
              {t('repeatEachAyah')}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="repeat-ayah"
                type="number"
                min="0"
                max="100"
                value={repeatAyahCount || ''}
                onChange={(e) => onRepeatAyahCountChange(parseInt(e.target.value) || 0)}
                disabled={audioSource === 'mp3quran'}
                className={cn(
                  "flex-1 text-base md:text-lg border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500",
                  audioSource === 'mp3quran' && "opacity-50 cursor-not-allowed"
                )}
              />
              <span className="text-sm md:text-base text-emerald-600 dark:text-emerald-400">{t('times')}</span>
            </div>
            {audioSource === 'mp3quran' && (
              <p className="text-xs md:text-sm text-emerald-600 dark:text-emerald-400 italic">
                {isRTL ? "تكرار الآية غير متاح مع تلاوات mp3quran" : "Ayah repeat not available with mp3quran reciters"}
              </p>
            )}
          </div>

          {/* Apply Button */}
          <Button
            onClick={handleApply}
            className="w-full text-base md:text-xl bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB]"
          >
            {t('applyRepeat')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
