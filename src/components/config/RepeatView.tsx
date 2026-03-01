import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Pencil } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
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

  // Picker open/close state
  const [showStartSurahPicker, setShowStartSurahPicker] = useState(false);
  const [showStartAyahPicker, setShowStartAyahPicker] = useState(false);
  const [showEndSurahPicker, setShowEndSurahPicker] = useState(false);
  const [showEndAyahPicker, setShowEndAyahPicker] = useState(false);

  // Search strings for surah pickers — driven by 50ms polling (Android IME fix)
  const [startSurahSearch, setStartSurahSearch] = useState('');
  const [endSurahSearch, setEndSurahSearch] = useState('');

  // Refs for search inputs
  const startSurahSearchRef = useRef<HTMLInputElement>(null);
  const endSurahSearchRef = useRef<HTMLInputElement>(null);

  // 50ms polling — bypasses Android IME React state desync for both surah search inputs
  useEffect(() => {
    const id = setInterval(() => {
      const v = startSurahSearchRef.current?.value ?? '';
      setStartSurahSearch(prev => prev !== v ? v : prev);
    }, 50);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      const v = endSurahSearchRef.current?.value ?? '';
      setEndSurahSearch(prev => prev !== v ? v : prev);
    }, 50);
    return () => clearInterval(id);
  }, []);

  // Refs for auto-scroll
  const selectedStartSurahRef = useRef<HTMLButtonElement>(null);
  const selectedStartAyahRef = useRef<HTMLButtonElement>(null);
  const selectedEndSurahRef = useRef<HTMLButtonElement>(null);
  const selectedEndAyahRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll selected item into view when a picker opens
  useEffect(() => {
    if (showStartSurahPicker) setTimeout(() => selectedStartSurahRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' }), 0);
  }, [showStartSurahPicker]);
  useEffect(() => {
    if (showStartAyahPicker) setTimeout(() => selectedStartAyahRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' }), 0);
  }, [showStartAyahPicker]);
  useEffect(() => {
    if (showEndSurahPicker) setTimeout(() => selectedEndSurahRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' }), 0);
  }, [showEndSurahPicker]);
  useEffect(() => {
    if (showEndAyahPicker) setTimeout(() => selectedEndAyahRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' }), 0);
  }, [showEndAyahPicker]);

  // Filtered surah lists
  const filteredStartSurahs = useMemo(() => {
    const q = startSurahSearch.trim().toLowerCase();
    if (!q) return ayahData;
    return ayahData.filter((s: any) => {
      const name = (language === 'ar' ? s.name?.ar : s.name?.en) || '';
      return name.toLowerCase().includes(q) || s.number.toString().includes(q);
    });
  }, [startSurahSearch, ayahData, language]);

  const filteredEndSurahs = useMemo(() => {
    const q = endSurahSearch.trim().toLowerCase();
    const base = ayahData.filter((s: any) => s.number >= repeatStartSurah);
    if (!q) return base;
    return base.filter((s: any) => {
      const name = (language === 'ar' ? s.name?.ar : s.name?.en) || '';
      return name.toLowerCase().includes(q) || s.number.toString().includes(q);
    });
  }, [endSurahSearch, ayahData, repeatStartSurah, language]);

  // Derived ayah ranges
  const startSurahData = ayahData.find((s: any) => s.number === repeatStartSurah);
  const endSurahData = ayahData.find((s: any) => s.number === repeatEndSurah);
  const maxStartAyah = startSurahData?.verses?.length || 1;
  const maxEndAyah = endSurahData?.verses?.length || 1;
  const minEndAyah = repeatStartSurah === repeatEndSurah ? repeatStartAyah + 1 : 1;

  const handleStartSurahChange = (val: string) => {
    const newStartSurah = parseInt(val);
    onRepeatStartSurahChange(newStartSurah);
    // Reset start ayah to first ayah of new surah
    onRepeatStartAyahChange(1);
    // If end surah is now before start surah, align it and reset its ayah to last
    if (repeatEndSurah < newStartSurah) {
      onRepeatEndSurahChange(newStartSurah);
      const newSurahData = ayahData.find((s: any) => s.number === newStartSurah);
      onRepeatEndAyahChange(newSurahData?.verses?.length || 1);
    }
    setShowStartSurahPicker(false);
    setStartSurahSearch('');
    if (startSurahSearchRef.current) startSurahSearchRef.current.value = '';
  };

  const handleStartAyahChange = (val: string) => {
    const newStartAyah = parseInt(val);
    onRepeatStartAyahChange(newStartAyah);
    if (repeatStartSurah === repeatEndSurah && repeatEndAyah <= newStartAyah) onRepeatEndAyahChange(newStartAyah + 1);
    setShowStartAyahPicker(false);
  };

  const handleEndSurahChange = (val: string) => {
    const newEndSurah = parseInt(val);
    onRepeatEndSurahChange(newEndSurah);
    // Reset end ayah to last ayah of new surah
    const newEndSurahData = ayahData.find((s: any) => s.number === newEndSurah);
    const newMaxEndAyah = newEndSurahData?.verses?.length || 1;
    // If same surah as start, ensure end ayah is after start ayah
    if (newEndSurah === repeatStartSurah) {
      onRepeatEndAyahChange(Math.max(repeatStartAyah + 1, newMaxEndAyah));
    } else {
      onRepeatEndAyahChange(newMaxEndAyah);
    }
    setShowEndSurahPicker(false);
    setEndSurahSearch('');
    if (endSurahSearchRef.current) endSurahSearchRef.current.value = '';
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

          {/* Start Surah — chip + picker */}
          <div className="flex-1 space-y-1">
            {!showStartSurahPicker ? (
              <button
                onClick={() => setShowStartSurahPicker(true)}
                className={cn('w-full flex items-center gap-1 px-2 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors', isRTL ? 'flex-row-reverse' : 'flex-row')}
              >
                <span className={cn('flex-1 font-semibold text-emerald-800 dark:text-emerald-200 truncate text-start', textSizeClasses.text)}>
                  {language === 'ar' ? startSurahData?.name?.ar : startSurahData?.name?.en}
                </span>
                <Pencil className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              </button>
            ) : (
              <>
                <div className="relative">
                  <Search className={cn('absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400', isRTL ? 'right-2' : 'left-2')} />
                  <input
                    ref={startSurahSearchRef}
                    type="text" autoFocus
                    placeholder={t('search')}
                    className={cn('w-full h-8 rounded-md border border-emerald-300 bg-transparent px-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500', isRTL ? 'pr-7 text-right' : 'pl-7 text-left', textSizeClasses.text)}
                  />
                </div>
                <div className="overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg max-h-36">
                  {filteredStartSurahs.map((surah: any) => (
                    <button
                      key={surah.number}
                      ref={surah.number === repeatStartSurah ? selectedStartSurahRef : null}
                      onClick={() => handleStartSurahChange(surah.number.toString())}
                      className={cn('w-full px-2 py-1.5 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors text-start', 'hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10', surah.number === repeatStartSurah && 'bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold', textSizeClasses.text)}
                    >
                      <div className={cn('flex items-center gap-1 w-full', isRTL && 'flex-row-reverse')}>
                        <span className="text-emerald-500 dark:text-emerald-500 text-xs shrink-0">{surah.number}.</span>
                        <span className="flex-1 text-emerald-800 dark:text-emerald-200 truncate">{language === 'ar' ? surah.name?.ar : surah.name?.en}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Start Ayah — chip + picker */}
          {!ayahSelectionDisabled && (
            <div className="flex-1 space-y-1">
              {!showStartAyahPicker ? (
                <button
                  onClick={() => setShowStartAyahPicker(true)}
                  className={cn('w-full flex items-center gap-2 px-2 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors', isRTL ? 'flex-row-reverse' : 'flex-row')}
                >
                  <span className={cn('flex-1 font-semibold text-emerald-800 dark:text-emerald-200 text-center', textSizeClasses.text)}>{repeatStartAyah}</span>
                  <Pencil className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                </button>
              ) : (
                <div className="overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg max-h-36">
                  {Array.from({ length: maxStartAyah }, (_, i) => i + 1).map(num => (
                    <button
                      key={num}
                      ref={num === repeatStartAyah ? selectedStartAyahRef : null}
                      onClick={() => handleStartAyahChange(num.toString())}
                      className={cn('w-full px-2 py-1.5 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors text-center', 'hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10', num === repeatStartAyah && 'bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold', textSizeClasses.text)}
                    >
                      <span className="text-emerald-800 dark:text-emerald-200">{num}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* End Position */}
      <div className="space-y-2">
        <Label className={cn("font-medium text-emerald-800 dark:text-emerald-300", isRTL ? "text-right" : "text-left", textSizeClasses.label)}>
          {t('endAt')}
        </Label>
        <div className="flex gap-2">

          {/* End Surah — chip + picker */}
          <div className="flex-1 space-y-1">
            {!showEndSurahPicker ? (
              <button
                onClick={() => setShowEndSurahPicker(true)}
                className={cn('w-full flex items-center gap-1 px-2 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors', isRTL ? 'flex-row-reverse' : 'flex-row')}
              >
                <span className={cn('flex-1 font-semibold text-emerald-800 dark:text-emerald-200 truncate text-start', textSizeClasses.text)}>
                  {language === 'ar' ? endSurahData?.name?.ar : endSurahData?.name?.en}
                </span>
                <Pencil className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              </button>
            ) : (
              <>
                <div className="relative">
                  <Search className={cn('absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400', isRTL ? 'right-2' : 'left-2')} />
                  <input
                    ref={endSurahSearchRef}
                    type="text" autoFocus
                    placeholder={t('search')}
                    className={cn('w-full h-8 rounded-md border border-emerald-300 bg-transparent px-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500', isRTL ? 'pr-7 text-right' : 'pl-7 text-left', textSizeClasses.text)}
                  />
                </div>
                <div className="overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg max-h-36">
                  {filteredEndSurahs.map((surah: any) => (
                    <button
                      key={surah.number}
                      ref={surah.number === repeatEndSurah ? selectedEndSurahRef : null}
                      onClick={() => handleEndSurahChange(surah.number.toString())}
                      className={cn('w-full px-2 py-1.5 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors text-start', 'hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10', surah.number === repeatEndSurah && 'bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold', textSizeClasses.text)}
                    >
                      <div className={cn('flex items-center gap-1 w-full', isRTL && 'flex-row-reverse')}>
                        <span className="text-emerald-500 dark:text-emerald-500 text-xs shrink-0">{surah.number}.</span>
                        <span className="flex-1 text-emerald-800 dark:text-emerald-200 truncate">{language === 'ar' ? surah.name?.ar : surah.name?.en}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* End Ayah — chip + picker */}
          {!ayahSelectionDisabled && (
            <div className="flex-1 space-y-1">
              {!showEndAyahPicker ? (
                <button
                  onClick={() => setShowEndAyahPicker(true)}
                  className={cn('w-full flex items-center gap-2 px-2 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors', isRTL ? 'flex-row-reverse' : 'flex-row')}
                >
                  <span className={cn('flex-1 font-semibold text-emerald-800 dark:text-emerald-200 text-center', textSizeClasses.text)}>{repeatEndAyah}</span>
                  <Pencil className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                </button>
              ) : (
                <div className="overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg max-h-36">
                  {Array.from({ length: maxEndAyah - minEndAyah + 1 }, (_, i) => minEndAyah + i).map(num => (
                    <button
                      key={num}
                      ref={num === repeatEndAyah ? selectedEndAyahRef : null}
                      onClick={() => { onRepeatEndAyahChange(num); setShowEndAyahPicker(false); }}
                      className={cn('w-full px-2 py-1.5 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors text-center', 'hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10', num === repeatEndAyah && 'bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold', textSizeClasses.text)}
                    >
                      <span className="text-emerald-800 dark:text-emerald-200">{num}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
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
