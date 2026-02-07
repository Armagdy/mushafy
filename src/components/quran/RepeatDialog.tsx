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
      <DialogContent className={cn(
        "sm:max-w-md max-w-[90vw] max-h-[85vh] overflow-y-auto rounded-xl border border-emerald-500",
        isRTL && "rtl"
      )}>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            {t('repeatSettings')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Start Position */}
          <div className="space-y-2">
            <Label className={cn("text-sm font-medium", isRTL ? "text-right" : "text-left")}>
              {t('startFrom')}
            </Label>
            <div className="flex gap-2">
              <Select value={repeatStartSurah.toString()} onValueChange={handleStartSurahChange}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {ayahData.map((surah: any) => (
                    <SelectItem key={surah.number} value={surah.number.toString()}>
                      {language === 'ar' ? surah.name?.ar : surah.name?.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={repeatStartAyah.toString()} onValueChange={handleStartAyahChange}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t('ayahNumber')} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {(() => {
                    const startSurahData = ayahData.find((s: any) => s.number === repeatStartSurah);
                    const maxAyah = startSurahData?.verses?.length || 1;
                    
                    return Array.from({ length: maxAyah }, (_, i) => i + 1).map(num => (
                      <SelectItem key={num} value={num.toString()}>
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
            <Label className={cn("text-sm font-medium", isRTL ? "text-right" : "text-left")}>
              {t('endAt')}
            </Label>
            <div className="flex gap-2">
              <Select value={repeatEndSurah.toString()} onValueChange={handleEndSurahChange}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {ayahData.filter((surah: any) => surah.number >= repeatStartSurah).map((surah: any) => (
                    <SelectItem key={surah.number} value={surah.number.toString()}>
                      {language === 'ar' ? surah.name?.ar : surah.name?.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={repeatEndAyah.toString()} onValueChange={(val) => onRepeatEndAyahChange(parseInt(val))}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t('ayahNumber')} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {(() => {
                    const endSurahData = ayahData.find((s: any) => s.number === repeatEndSurah);
                    const maxAyah = endSurahData?.verses?.length || 1;
                    const minAyah = repeatStartSurah === repeatEndSurah ? repeatStartAyah + 1 : 1;
                    
                    return Array.from({ length: maxAyah - minAyah + 1 }, (_, i) => minAyah + i).map(num => (
                      <SelectItem key={num} value={num.toString()}>
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
            <Label htmlFor="repeat-passage" className={cn("text-sm font-medium", isRTL ? "text-right" : "text-left")}>
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
                className="flex-1"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('times')}</span>
            </div>
          </div>

          {/* Repeat Each Ayah Count */}
          <div className="space-y-2">
            <Label htmlFor="repeat-ayah" className={cn("text-sm font-medium", isRTL ? "text-right" : "text-left")}>
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
                className="flex-1"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('times')}</span>
            </div>
          </div>

          {/* Apply Button */}
          <Button
            onClick={handleApply}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
          >
            {t('applyRepeat')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
