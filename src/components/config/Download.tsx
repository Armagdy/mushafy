import React, { useState, useEffect, useRef } from "react";
import {
  HardDriveDownload,
  Search,
  WifiOff,
  StopCircle,
  CheckCircle2,
  XCircle,
  Check,
  X,
  Image as ImageIcon,
  Headphones,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { MushafType } from "@/contexts/MushafContext";
import { useDownload } from "@/contexts/DownloadContext";
import { cn } from "@/lib/utils";
import { surahs } from "@/data/surahs";
import { getMp3QuranReciters, type Mp3QuranReciter, type Mp3QuranMoshaf } from "@/lib/mp3quran-service";
import { useNetwork } from "@/hooks/useNetwork";
import { useToast } from "@/hooks/use-toast";
import { useTafseer, type TafseerInfo } from "@/hooks/useTafseer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DownloadTab = 'pages' | 'mp3quran' | 'tafseer';

/**
 * Uncontrolled search input with 50ms polling.
 * Polling bypasses a React state desync on Android where IME composition
 * (especially with Arabic keyboards) does not fire onChange reliably.
 */
function SearchField({ placeholder, onValueChange }: { placeholder: string; onValueChange: (value: string) => void }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  useEffect(() => {
    const check = () => {
      const el = inputRef.current;
      if (el && el.value !== value) {
        setValue(el.value);
      }
    };
    check();
    const intervalId = setInterval(check, 50);
    return () => clearInterval(intervalId);
  }, [value]);

  useEffect(() => {
    onValueChangeRef.current(value);
  }, [value]);

  const handleClear = () => {
    if (inputRef.current) inputRef.current.value = '';
    setValue('');
  };

  return (
    <div className="relative">
      <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600 dark:text-emerald-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          'w-full min-h-[44px] rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950 ps-10 pe-3 text-start text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500',
          textSizeClasses.text
        )}
      />
      {value && (
        <button
          onClick={handleClear}
          aria-label={placeholder}
          className="absolute end-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-full text-emerald-500 dark:text-emerald-400 active:bg-emerald-100 dark:active:bg-emerald-900 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/** Section header: icon + label, matching the Settings/Navigation view pattern. */
function SectionLabel({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
      <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
        {children}
      </span>
    </div>
  );
}

/** From/To surah dropdowns (44px+ touch targets) shared by the audio and tafseer branches. */
function SurahRangeSelect({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: number;
  to: number;
  onFromChange: (surahId: number) => void;
  onToChange: (surahId: number) => void;
}) {
  const { t, isRTL } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);

  const surahLabel = (surah: { id: number; name: string; englishName: string }) =>
    `${surah.id}. ${isRTL ? surah.name : surah.englishName}`;

  const itemClass = cn(
    "py-3 focus:bg-emerald-100 dark:focus:bg-emerald-900/40 focus:text-emerald-900 dark:focus:text-emerald-100",
    textSizeClasses.text
  );

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex flex-col gap-1 min-w-0">
        <label className={cn("text-emerald-700 dark:text-emerald-300 font-medium", textSizeClasses.label)}>
          {t('fromSurah')}
        </label>
        <Select value={String(from)} onValueChange={(v) => onFromChange(parseInt(v, 10))}>
          <SelectTrigger
            aria-label={t('fromSurah')}
            className={cn(
              "min-h-[48px] h-auto rounded-lg border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950 focus:ring-emerald-500",
              textSizeClasses.text
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[60vh] bg-[#FBF9F4] dark:bg-emerald-950">
            {surahs.map((surah) => (
              <SelectItem key={surah.id} value={String(surah.id)} className={itemClass}>
                {surahLabel(surah)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <label className={cn("text-emerald-700 dark:text-emerald-300 font-medium", textSizeClasses.label)}>
          {t('toSurah')}
        </label>
        <Select value={String(to)} onValueChange={(v) => onToChange(parseInt(v, 10))}>
          <SelectTrigger
            aria-label={t('toSurah')}
            className={cn(
              "min-h-[48px] h-auto rounded-lg border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950 focus:ring-emerald-500",
              textSizeClasses.text
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[60vh] bg-[#FBF9F4] dark:bg-emerald-950">
            {surahs.filter((surah) => surah.id >= from).map((surah) => (
              <SelectItem key={surah.id} value={String(surah.id)} className={itemClass}>
                {surahLabel(surah)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function Download() {
  const { t, language } = useLanguage();
  const { isOnline } = useNetwork();
  const { toast } = useToast();
  const { dialogTextSize } = useDialogTextSize();
  const { activeDownload, startDownload, cancelDownload, clearDownload } = useDownload();
  const { tafseers } = useTafseer();

  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);

  // Download state
  const [downloadType, setDownloadType] = useState<DownloadTab>('pages');
  const [downloadMushafType, setDownloadMushafType] = useState<MushafType>('mwdoa');
  const [downloadFromPage, setDownloadFromPage] = useState(1);
  const [downloadToPage, setDownloadToPage] = useState(604);
  const [downloadFromSurah, setDownloadFromSurah] = useState(1);
  const [downloadToSurah, setDownloadToSurah] = useState(114);

  // Use context state for download progress
  const isDownloading = activeDownload?.status === 'downloading';
  const downloadProgress = activeDownload?.progress || { current: 0, total: 0 };
  const downloadPercent =
    downloadProgress.total > 0
      ? Math.round((downloadProgress.current / downloadProgress.total) * 100)
      : null;

  // Reciter state (MP3Quran)
  const [mp3QuranReciters, setMp3QuranReciters] = useState<Mp3QuranReciter[]>([]);
  const [mp3QuranRecitersAr, setMp3QuranRecitersAr] = useState<Mp3QuranReciter[]>([]);
  const [selectedReciter, setSelectedReciter] = useState<Mp3QuranReciter | null>(null);
  const [selectedMoshaf, setSelectedMoshaf] = useState<Mp3QuranMoshaf | null>(null);
  const [reciterSearch, setReciterSearch] = useState('');

  // Tafseer state
  const [selectedTafseer, setSelectedTafseer] = useState<TafseerInfo | null>(null);
  const [tafseerSearch, setTafseerSearch] = useState('');

  // Track previous download status to detect transitions (skip initial mount)
  const prevDownloadStatusRef = useRef<string | null>(null);

  // Normalize Arabic text for search
  const normalizeArabic = (text: string): string => {
    return text
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/\u0640/g, '')
      .toLowerCase();
  };

  // Filter function for Arabic/English text
  const matchesSearch = React.useCallback((text: string, search: string): boolean => {
    if (!search.trim()) return true;
    return normalizeArabic(text).includes(normalizeArabic(search));
  }, []);

  // Translate common moshaf name patterns to Arabic
  const translateMoshafName = (name: string): string => {
    if (language !== 'ar') return name;

    let translated = name;

    // Translate reading types
    translated = translated.replace(/Rewayat Hafs A'n Assem/gi, 'رواية حفص عن عاصم');
    translated = translated.replace(/Hafs A'n Assem/gi, 'حفص عن عاصم');
    translated = translated.replace(/Rewayat Warsh/gi, 'رواية ورش');
    translated = translated.replace(/Warsh/gi, 'ورش');
    translated = translated.replace(/Rewayat/gi, 'رواية');

    // Translate style types
    translated = translated.replace(/Murattal/gi, 'مرتل');
    translated = translated.replace(/Mujawwad/gi, 'مجود');
    translated = translated.replace(/Mojawwad/gi, 'مجود');
    translated = translated.replace(/Muallim/gi, 'مصحف المعلم');
    translated = translated.replace(/Mu'allim/gi, 'مصحف المعلم');
    translated = translated.replace(/Mo'lim/gi, 'مصحف المعلم');
    translated = translated.replace(/Teacher Edition/gi, 'مصحف المعلم');
    translated = translated.replace(/Teacher/gi, 'معلم');

    return translated;
  };

  // Localized reciter name (Arabic names come from the Arabic API response)
  const getReciterName = React.useCallback(
    (reciter: Mp3QuranReciter): string => {
      if (language !== 'ar') return reciter.name;
      const arReciter = mp3QuranRecitersAr.find((r) => r.id === reciter.id);
      return arReciter?.name || reciter.name;
    },
    [language, mp3QuranRecitersAr]
  );

  // Localized moshaf name, translated and de-duplicated ("Murattal - Murattal" → "Murattal")
  const getMoshafDisplayName = (moshaf: Mp3QuranMoshaf): string => {
    let displayName = moshaf.name;
    if (language === 'ar' && selectedReciter) {
      const arReciter = mp3QuranRecitersAr.find((r) => r.id === selectedReciter.id);
      const arMoshaf = arReciter?.moshaf?.find((m) => m.id === moshaf.id);
      if (arMoshaf?.name) {
        displayName = arMoshaf.name;
      }
    }
    displayName = translateMoshafName(displayName);
    const parts = displayName.split(' - ');
    if (parts.length === 2 && parts[0].trim() === parts[1].trim()) {
      displayName = parts[0].trim();
    }
    return displayName;
  };

  // Filtered and sorted reciters
  const filteredReciters = React.useMemo(() => {
    return mp3QuranReciters
      .filter((reciter) => matchesSearch(getReciterName(reciter), reciterSearch))
      .sort((a, b) => getReciterName(a).localeCompare(getReciterName(b), language));
  }, [mp3QuranReciters, reciterSearch, language, matchesSearch, getReciterName]);

  // Filtered tafseers (name, author or book name)
  const filteredTafseers = React.useMemo(() => {
    return tafseers.filter(
      (tafseer) =>
        matchesSearch(tafseer.name, tafseerSearch) ||
        matchesSearch(tafseer.author, tafseerSearch) ||
        matchesSearch(tafseer.book_name, tafseerSearch)
    );
  }, [tafseers, tafseerSearch, matchesSearch]);

  // Determine if download button should be enabled
  const isDownloadEnabled = (() => {
    if (isDownloading) return false;
    if (downloadType === 'pages') return true;
    if (downloadType === 'mp3quran') return selectedReciter !== null && selectedMoshaf !== null;
    if (downloadType === 'tafseer') return selectedTafseer !== null;
    return false;
  })();

  // Load reciters on mount (English + Arabic names) and preselect the first one
  useEffect(() => {
    let cancelled = false;

    getMp3QuranReciters('en').then((data) => {
      if (cancelled) return;
      setMp3QuranReciters(data);
      if (data.length > 0) {
        setSelectedReciter(data[0]);
        setSelectedMoshaf(data[0].moshaf?.[0] ?? null);
      }
    });

    getMp3QuranReciters('ar').then((data) => {
      if (!cancelled) setMp3QuranRecitersAr(data);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize the ref on mount with current status (don't show toast for existing state)
  useEffect(() => {
    prevDownloadStatusRef.current = activeDownload?.status || null;
    // Run only once on mount — activeDownload is read just for initialization
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show toast when download status transitions to completed/error (not on mount)
  useEffect(() => {
    const currentStatus = activeDownload?.status || null;
    const prevStatus = prevDownloadStatusRef.current;

    if (prevStatus !== null && currentStatus !== prevStatus) {
      if (currentStatus === 'completed') {
        toast({
          title: t('downloadComplete'),
          description: t('downloadCompleteMessage'),
        });
      } else if (currentStatus === 'error') {
        toast({
          title: t('downloadFailed'),
          description: activeDownload?.error || 'An error occurred',
          variant: "destructive",
        });
      }
    }

    prevDownloadStatusRef.current = currentStatus;
  }, [activeDownload?.status, activeDownload?.error, toast, t]);

  // Selecting a reciter resets the moshaf to its first option
  const handleSelectReciter = (reciter: Mp3QuranReciter) => {
    setSelectedReciter(reciter);
    setSelectedMoshaf(reciter.moshaf?.[0] ?? null);
  };

  // Keep the "to" surah within the selected range
  const handleFromSurahChange = (surahId: number) => {
    setDownloadFromSurah(surahId);
    if (downloadToSurah < surahId) {
      setDownloadToSurah(surahId);
    }
  };

  // Keep the "to" page within the selected range
  const handleFromPageChange = (raw: string) => {
    const page = Math.min(604, Math.max(1, parseInt(raw, 10) || 1));
    setDownloadFromPage(page);
    if (downloadToPage < page) {
      setDownloadToPage(page);
    }
  };

  const handleToPageChange = (raw: string) => {
    const page = Math.min(604, Math.max(1, parseInt(raw, 10) || 604));
    setDownloadToPage(page);
  };

  const handleDownload = async () => {
    // Check network connectivity before downloading
    if (!isOnline) {
      toast({
        title: t('networkOffline'),
        description: t('networkOfflineMessage'),
        variant: "destructive",
      });
      return;
    }

    if (downloadType === 'pages') {
      await startDownload({
        type: 'pages',
        params: {
          mushafType: downloadMushafType,
          fromPage: downloadFromPage,
          toPage: downloadToPage,
        },
      });
    } else if (downloadType === 'mp3quran') {
      if (!selectedMoshaf || !selectedReciter) return;
      await startDownload({
        type: 'mp3quran',
        params: {
          moshaf: selectedMoshaf,
          fromSurah: downloadFromSurah,
          toSurah: downloadToSurah,
        },
      });
    } else if (downloadType === 'tafseer') {
      if (!selectedTafseer) return;
      await startDownload({
        type: 'tafseer',
        params: {
          tafseerId: selectedTafseer.id,
          tafseerName: selectedTafseer.name,
          fromSurah: downloadFromSurah,
          toSurah: downloadToSurah,
        },
      });
    }
  };

  const downloadTabs: { value: DownloadTab; label: string; icon: LucideIcon }[] = [
    { value: 'pages', label: t('pages'), icon: ImageIcon },
    { value: 'mp3quran', label: t('recitations'), icon: Headphones },
    { value: 'tafseer', label: t('tafseer'), icon: BookOpen },
  ];

  const mushafOptions: { value: MushafType; label: string; image: string }[] = [
    { value: 'mwdoa', label: t('mushafMwdoa'), image: '/assets/mushaf_snippets/mwdoaa.jpg' },
    { value: 'tashel', label: t('mushafTashel'), image: '/assets/mushaf_snippets/tayseer.jpg' },
    { value: 'madinah', label: t('mushafMadinah'), image: '/assets/mushaf_snippets/madinah.jpg' },
    { value: 'tarteel', label: t('mushafTarteel'), image: '/assets/mushaf_snippets/tarteel.jpg' },
    { value: 'tajweed', label: t('mushafTajweed'), image: '/assets/mushaf_snippets/tajweed.jpg' },
  ];

  const pageInputClass = cn(
    "w-full min-h-[48px] rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950 px-3 py-2 text-start text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500",
    textSizeClasses.text
  );

  const listClass =
    "overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg bg-transparent max-h-[calc(100vh-30rem)] md:max-h-[calc(100vh-26rem)] min-h-[8rem]";

  const isTerminalStatus =
    activeDownload?.status === 'completed' ||
    activeDownload?.status === 'cancelled' ||
    activeDownload?.status === 'error';

  return (
    <div className="space-y-4">
      {/* Network Status Warning */}
      {!isOnline && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg">
          <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className={cn("font-medium text-amber-800 dark:text-amber-300", textSizeClasses.label)}>
              {t('networkOffline')}
            </span>
            <span className="text-xs md:text-sm text-amber-700 dark:text-amber-400">
              {t('networkOfflineMessage')}
            </span>
          </div>
        </div>
      )}

      {/* Download Type — segmented tabs */}
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label={t('downloadType')}>
        {downloadTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = downloadType === tab.value;
          return (
            <button
              key={tab.value}
              role="tab"
              aria-selected={isActive}
              onClick={() => setDownloadType(tab.value)}
              disabled={isDownloading}
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-h-[56px] px-2 py-2 rounded-lg border font-medium transition-all active:scale-[0.97] disabled:opacity-60",
                isActive
                  ? "bg-emerald-700 text-[#F2E3BB] border-emerald-600 shadow-md"
                  : "bg-white dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900",
                textSizeClasses.text
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="leading-tight text-center">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Pages Download Options */}
      {downloadType === 'pages' && (
        <div className="flex flex-col gap-3">
          <SectionLabel icon={BookOpen}>{t('mushafType')}</SectionLabel>

          {/* Mushaf cards — same picker as the Mushaf settings category */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {mushafOptions.map((option) => {
              const isSelected = downloadMushafType === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setDownloadMushafType(option.value)}
                  disabled={isDownloading}
                  className={cn(
                    "relative flex flex-col gap-2 p-2 rounded-lg border-2 transition-all duration-200 hover:shadow-lg active:scale-[0.97] overflow-hidden disabled:opacity-60",
                    isSelected
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 shadow-md"
                      : "border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-800 hover:border-emerald-400"
                  )}
                >
                  <div className="relative w-full aspect-[3/4] rounded overflow-hidden bg-emerald-50 dark:bg-emerald-900/20">
                    <img
                      src={option.image}
                      alt={option.label}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-emerald-600/20 dark:bg-emerald-500/30 flex items-center justify-center">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center shadow-lg">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={cn(
                    "text-center font-medium px-1",
                    isSelected
                      ? "text-emerald-800 dark:text-emerald-200 font-semibold"
                      : "text-emerald-700 dark:text-emerald-300",
                    textSizeClasses.text
                  )}>
                    {option.label}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Page range */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="download-from-page" className={cn("text-emerald-700 dark:text-emerald-300 font-medium", textSizeClasses.label)}>
                {t('fromPage')}
              </label>
              <input
                id="download-from-page"
                type="number"
                inputMode="numeric"
                min={1}
                max={604}
                value={downloadFromPage}
                onChange={(e) => handleFromPageChange(e.target.value)}
                className={pageInputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="download-to-page" className={cn("text-emerald-700 dark:text-emerald-300 font-medium", textSizeClasses.label)}>
                {t('toPage')}
              </label>
              <input
                id="download-to-page"
                type="number"
                inputMode="numeric"
                min={1}
                max={604}
                value={downloadToPage}
                onChange={(e) => handleToPageChange(e.target.value)}
                className={pageInputClass}
              />
            </div>
          </div>
        </div>
      )}

      {/* MP3Quran (audio) Download Options */}
      {downloadType === 'mp3quran' && (
        <div className="flex flex-col gap-3">
          <SectionLabel icon={Headphones}>{t('reciter')}</SectionLabel>
          <SearchField placeholder={t('searchReciter')} onValueChange={setReciterSearch} />

          {/* Reciter list — radio style, current selection marked with a check */}
          <div className={cn(listClass, "min-h-[12rem]")} style={{ WebkitOverflowScrolling: 'touch' }}>
            {filteredReciters.length === 0 ? (
              <div className={cn("flex items-center justify-center h-full py-8 text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
                {t('noResults')}
              </div>
            ) : (
              filteredReciters.map((reciter) => {
                const isSelected = selectedReciter?.id === reciter.id;
                return (
                  <button
                    key={reciter.id}
                    onClick={() => handleSelectReciter(reciter)}
                    className={cn(
                      "w-full flex items-center gap-3 min-h-[48px] px-3 py-2 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors active:bg-emerald-100 dark:active:bg-emerald-900/40",
                      isSelected && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                      textSizeClasses.text
                    )}
                  >
                    <span className={cn("flex-1 text-start truncate", isSelected ? "text-emerald-800 dark:text-emerald-200" : "text-emerald-700 dark:text-emerald-300")}>
                      {getReciterName(reciter)}
                    </span>
                    {isSelected && <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Moshaf (recitation edition) chips for the selected reciter */}
          {selectedReciter?.moshaf && selectedReciter.moshaf.length > 0 && (
            <div className="flex flex-col gap-2">
              <SectionLabel icon={BookOpen}>{t('mushafType')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {selectedReciter.moshaf.map((moshaf) => {
                  const isSelected = selectedMoshaf?.id === moshaf.id;
                  return (
                    <button
                      key={moshaf.id}
                      onClick={() => setSelectedMoshaf(moshaf)}
                      className={cn(
                        "min-h-[44px] rounded-lg border px-3 py-1.5 font-medium transition-all active:scale-[0.97]",
                        isSelected
                          ? "bg-emerald-700 text-[#F2E3BB] border-emerald-600 shadow-md"
                          : "bg-white dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900",
                        textSizeClasses.text
                      )}
                    >
                      {getMoshafDisplayName(moshaf)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Surah range */}
          <SurahRangeSelect
            from={downloadFromSurah}
            to={downloadToSurah}
            onFromChange={handleFromSurahChange}
            onToChange={setDownloadToSurah}
          />
        </div>
      )}

      {/* Tafseer Download Options */}
      {downloadType === 'tafseer' && (
        <div className="flex flex-col gap-3">
          <SectionLabel icon={BookOpen}>{t('tafseer')}</SectionLabel>
          <SearchField placeholder={t('searchTafseer')} onValueChange={setTafseerSearch} />

          {/* Tafseer list — radio style, current selection marked with a check */}
          <div className={cn(listClass, "min-h-[12rem]")} style={{ WebkitOverflowScrolling: 'touch' }}>
            {filteredTafseers.length === 0 ? (
              <div className={cn("flex items-center justify-center h-full py-8 text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
                {t('noResults')}
              </div>
            ) : (
              filteredTafseers.map((tafseer) => {
                const isSelected = selectedTafseer?.id === tafseer.id;
                return (
                  <button
                    key={tafseer.id}
                    onClick={() => setSelectedTafseer(tafseer)}
                    className={cn(
                      "w-full flex items-center gap-3 min-h-[48px] px-3 py-2 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors active:bg-emerald-100 dark:active:bg-emerald-900/40",
                      isSelected && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                      textSizeClasses.text
                    )}
                  >
                    <span className="flex-1 flex flex-col min-w-0 text-start">
                      <span className={cn("truncate", isSelected ? "text-emerald-800 dark:text-emerald-200" : "text-emerald-700 dark:text-emerald-300")}>
                        {tafseer.name}
                      </span>
                      <span className="truncate text-xs md:text-sm font-normal text-emerald-600 dark:text-emerald-400">
                        {tafseer.author}
                      </span>
                    </span>
                    <span className={cn(
                      'shrink-0 px-1.5 py-0.5 rounded text-[0.6rem] font-medium leading-tight',
                      tafseer.language === 'ar'
                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                        : 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400'
                    )}>
                      {tafseer.language === 'ar' ? 'عربي' : 'EN'}
                    </span>
                    {isSelected && <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Surah range */}
          <SurahRangeSelect
            from={downloadFromSurah}
            to={downloadToSurah}
            onFromChange={handleFromSurahChange}
            onToChange={setDownloadToSurah}
          />
        </div>
      )}

      {/* Download Progress */}
      {activeDownload && (
        <div className="flex flex-col gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 rounded-lg">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {activeDownload.status === 'downloading' && (
                <HardDriveDownload className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-pulse shrink-0" />
              )}
              {activeDownload.status === 'completed' && (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
              )}
              {activeDownload.status === 'error' && (
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
              )}
              {activeDownload.status === 'cancelled' && (
                <StopCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <span className={cn("font-medium text-emerald-700 dark:text-emerald-300 truncate", textSizeClasses.text)}>
                {activeDownload.status === 'downloading' && t('downloadProgress')}
                {activeDownload.status === 'completed' && t('downloadComplete')}
                {activeDownload.status === 'error' && t('downloadFailed')}
                {activeDownload.status === 'cancelled' && t('downloadCancelled')}
              </span>
            </div>
            {downloadProgress.total > 0 && (
              <span className={cn("text-emerald-600 dark:text-emerald-400 shrink-0", textSizeClasses.text)}>
                {downloadProgress.current} / {downloadProgress.total}
                {downloadPercent !== null && ` (${downloadPercent}%)`}
              </span>
            )}
          </div>

          {(activeDownload.status === 'downloading' || activeDownload.status === 'completed') && downloadProgress.total > 0 && (
            <div className="w-full h-2 bg-emerald-100 dark:bg-emerald-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  activeDownload.status === 'completed'
                    ? "bg-green-600 dark:bg-green-500 w-full"
                    : "bg-emerald-600 dark:bg-emerald-500"
                )}
                style={activeDownload.status === 'downloading' ? { width: `${downloadPercent}%` } : undefined}
              />
            </div>
          )}

          {isTerminalStatus && (
            <button
              onClick={clearDownload}
              className={cn(
                "w-full flex items-center justify-center gap-2 min-h-[44px] rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors active:scale-[0.98]",
                textSizeClasses.button
              )}
            >
              <X className="w-4 h-4" />
              {t('clearDownload')}
            </button>
          )}
        </div>
      )}

      {/* Sticky action bar — primary action always reachable (Material pattern, matches Navigation/Reciter views) */}
      <div className="sticky bottom-0 -mx-5 -mb-5 px-5 pt-3 pb-4 border-t border-emerald-100 dark:border-emerald-900 bg-gradient-to-b from-transparent via-[#FBF9F4]/80 to-[#FBF9F4] dark:from-transparent dark:via-black/80 dark:to-black">
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            disabled={!isDownloadEnabled || !isOnline || isDownloading}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-emerald-600 shadow-md transition-all active:scale-[0.98] px-3 min-h-[48px] py-2"
          >
            {!isOnline ? (
              <WifiOff className="w-5 h-5 text-[#F2E3BB] shrink-0" />
            ) : (
              <HardDriveDownload className="w-5 h-5 text-[#F2E3BB] shrink-0" />
            )}
            <span className={cn("text-[#F2E3BB] font-bold text-center leading-tight", textSizeClasses.button)}>
              {!isOnline ? t('networkRequired') : (isDownloading ? t('downloadProgress') : t('startDownload'))}
            </span>
          </button>

          {isDownloading && (
            <button
              onClick={cancelDownload}
              className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 rounded-lg border border-red-500 shadow-md transition-all active:scale-[0.98] px-3 min-h-[48px] py-2"
            >
              <StopCircle className="w-5 h-5 text-white shrink-0" />
              <span className={cn("text-white font-bold text-center leading-tight", textSizeClasses.button)}>
                {t('cancelDownload')}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
