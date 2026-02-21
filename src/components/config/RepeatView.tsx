import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { cn } from "@/lib/utils";

interface RepeatViewProps {
  ayahData: any[];
  repeatStartSurah: number;
  repeatStartAyah: number;
  repeatEndSurah: number;
  repeatEndAyah: number;
  repeatPassageCount: number;
  repeatAyahCount: number;
  audioSource: 'everyayah' | 'mp3quran';
  hasAyahTimings?: boolean;
  onRepeatStartSurahChange: (value: number) => void;
  onRepeatStartAyahChange: (value: number) => void;
  onRepeatEndSurahChange: (value: number) => void;
  onRepeatEndAyahChange: (value: number) => void;
  onRepeatPassageCountChange: (value: number) => void;
  onRepeatAyahCountChange: (value: number) => void;
  onStartRepeat: () => void;
  onClose: () => void;
}

/**
 * Repeat View - Extract from RepeatDialog
 * Allows users to configure repeat settings for Quran recitation
 */
export default function RepeatView({
  ayahData,
  repeatStartSurah,
  repeatStartAyah,
  repeatEndSurah,
  repeatEndAyah,
  repeatPassageCount,
  repeatAyahCount,
  audioSource,
  hasAyahTimings = false,
  onRepeatStartSurahChange,
  onRepeatStartAyahChange,
  onRepeatEndSurahChange,
  onRepeatEndAyahChange,
  onRepeatPassageCountChange,
  onRepeatAyahCountChange,
  onStartRepeat,
  onClose,
}: RepeatViewProps) {
  const { t, isRTL, language } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);

  // Ayah selection should be disabled only for MP3Quran without timing
  const ayahSelectionDisabled = audioSource === 'mp3quran' && !hasAyahTimings;

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
    onClose();
  };

  return (
    <div className={cn("p-4 space-y-2 sm:space-y-3", isRTL ? "rtl" : "ltr")}>
      {/* Warning for disabled ayah selection */}
      {ayahSelectionDisabled && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
          <p className={cn("text-emerald-600 dark:text-emerald-400 whitespace-pre-line", textSizeClasses.text)}>
            {t('timingNotAvailable')}
          </p>
        </div>
      )}

      {/* Start Position */}
      <div className="space-y-2">
        <Label className={cn("font-medium text-emerald-800 dark:text-emerald-300", isRTL ? "text-right" : "text-left", textSizeClasses.label)}>
          {t('startFrom')}
        </Label>
        <div className="flex gap-2">
          <Select value={repeatStartSurah.toString()} onValueChange={handleStartSurahChange}>
            <SelectTrigger className={cn("flex-1 border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500", textSizeClasses.text)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60 bg-[#FBF9F4] dark:bg-emerald-950">
              {ayahData.map((surah: any) => (
                <SelectItem key={surah.number} value={surah.number.toString()} className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100", textSizeClasses.text)}>
                  {language === 'ar' ? surah.name?.ar : surah.name?.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!ayahSelectionDisabled && (
            <Select value={repeatStartAyah.toString()} onValueChange={handleStartAyahChange}>
              <SelectTrigger className={cn("flex-1 border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500", textSizeClasses.text)}>
                <SelectValue placeholder={t('ayahNumber')} />
              </SelectTrigger>
              <SelectContent className="max-h-60 bg-[#FBF9F4] dark:bg-emerald-950">
                {(() => {
                  const startSurahData = ayahData.find((s: any) => s.number === repeatStartSurah);
                  const maxAyah = startSurahData?.verses?.length || 1;
                  
                  return Array.from({ length: maxAyah }, (_, i) => i + 1).map(num => (
                    <SelectItem key={num} value={num.toString()} className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100", textSizeClasses.text)}>
                      {isRTL ? `الآية ${num}` : `Ayah ${num}`}
                    </SelectItem>
                  ));
                })()}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* End Position */}
      <div className="space-y-2">
        <Label className={cn("font-medium text-emerald-800 dark:text-emerald-300", isRTL ? "text-right" : "text-left", textSizeClasses.label)}>
          {t('endAt')}
        </Label>
        <div className="flex gap-2">
          <Select value={repeatEndSurah.toString()} onValueChange={handleEndSurahChange}>
            <SelectTrigger className={cn("flex-1 border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500", textSizeClasses.text)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60 bg-[#FBF9F4] dark:bg-emerald-950">
              {ayahData.filter((surah: any) => surah.number >= repeatStartSurah).map((surah: any) => (
                <SelectItem key={surah.number} value={surah.number.toString()} className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100", textSizeClasses.text)}>
                  {language === 'ar' ? surah.name?.ar : surah.name?.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!ayahSelectionDisabled && (
            <Select value={repeatEndAyah.toString()} onValueChange={(val) => onRepeatEndAyahChange(parseInt(val))}>
              <SelectTrigger className={cn("flex-1 border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500", textSizeClasses.text)}>
                <SelectValue placeholder={t('ayahNumber')} />
              </SelectTrigger>
              <SelectContent className="max-h-60 bg-[#FBF9F4] dark:bg-emerald-950">
                {(() => {
                  const endSurahData = ayahData.find((s: any) => s.number === repeatEndSurah);
                  const maxAyah = endSurahData?.verses?.length || 1;
                  const minAyah = repeatStartSurah === repeatEndSurah ? repeatStartAyah + 1 : 1;
                  
                  return Array.from({ length: maxAyah - minAyah + 1 }, (_, i) => minAyah + i).map(num => (
                    <SelectItem key={num} value={num.toString()} className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100", textSizeClasses.text)}>
                      {isRTL ? `الآية ${num}` : `Ayah ${num}`}
                    </SelectItem>
                  ));
                })()}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Repeat Passage Count */}
      <div className="space-y-2">
        <Label htmlFor="repeat-passage" className={cn("font-medium text-emerald-800 dark:text-emerald-300", isRTL ? "text-right" : "text-left", textSizeClasses.label)}>
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
            className={cn("flex-1 border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500", textSizeClasses.text)}
          />
          <span className={cn("text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>{t('times')}</span>
        </div>
      </div>

      {/* Repeat Each Ayah Count */}
      {!ayahSelectionDisabled && (
        <div className="space-y-2">
          <Label htmlFor="repeat-ayah" className={cn("font-medium text-emerald-800 dark:text-emerald-300", isRTL ? "text-right" : "text-left", textSizeClasses.label)}>
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
              className={cn("flex-1 border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500", textSizeClasses.text)}
            />
            <span className={cn("text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>{t('times')}</span>
          </div>
        </div>
      )}

      {/* Apply Button */}
      <Button
        onClick={handleApply}
        className={cn("w-full bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB]", textSizeClasses.button)}
      >
        {t('applyRepeat')}
      </Button>
    </div>
  );
}
