import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, Loader2, CheckCircle2, XCircle, Pencil } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { cn } from "@/lib/utils";
import type { Mp3QuranReciter, Mp3QuranMoshaf } from "@/lib/mp3quran-service";
import { checkAyahTiming } from "@/lib/mp3quran-service";
import { getCachedAyahTiming, cacheAyahTiming, getCachedIndividualAyah, isMp3QuranAudioCached, getCachedMp3QuranAudio } from "@/lib/audio-cache";
import { surahs } from "@/data/surahs";

interface UnifiedReciter {
  id: string;
  name: string;
  nameAr: string;
  source: 'everyayah' | 'mp3quran';
  // EveryAyah specific
  folder?: string;
  quality?: string;
  style?: string;
  reading?: string;
  readingAr?: string;
  // MP3Quran specific
  mp3QuranId?: number;
  moshaf?: Mp3QuranMoshaf[];
}

interface ReciterViewProps {
  // Audio source
  audioSource: 'everyayah' | 'mp3quran';
  onAudioSourceChange: (source: 'everyayah' | 'mp3quran') => void;
  
  // EveryAyah props
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
  onFilterReciterNameChange: (value: string) => void;
  onFilterReadingChange: (value: string) => void;
  onFilterStyleChange: (value: string) => void;
  onFilterQualityChange: (value: string) => void;
  
  // MP3Quran props
  mp3QuranReciters: Mp3QuranReciter[];
  mp3QuranRecitersAr: Mp3QuranReciter[];
  selectedMp3QuranReciter: Mp3QuranReciter | null;
  selectedMoshaf: Mp3QuranMoshaf | null;
  onMp3QuranReciterChange: (reciter: Mp3QuranReciter) => void;
  onMoshafChange: (moshaf: Mp3QuranMoshaf) => void;
  
  // Common
  currentPlayingAyah: { surah: number; ayah: number } | null;
  currentSurahId: number;
  onListen: () => void;
  onNavigateToSurah: (surahId: number) => Promise<void>;
}

// Extract reading type (rewayah) from an MP3Quran moshaf name
const getMoshafReading = (moshafName: string): string => {
  const nameLower = moshafName.toLowerCase();
  if (nameLower.includes("mo'lim") || nameLower.includes('moallem') || nameLower.includes('muallim')) return 'hafs';
  const rewayatMatch = moshafName.match(/Rewayat\s+(.+?)\s+(?:A'n|An)\s+/i);
  if (rewayatMatch) {
    const name = rewayatMatch[1].toLowerCase().replace(/['''\s-]/g, '');
    if (name.includes('hafs')) return 'hafs';
    if (name.includes('warsh')) return 'warsh';
    if (name.includes('qalon') || name.includes('qaloon')) return 'qalon';
    if (name.includes('dori') || name.includes('aldori')) return 'aldori';
    if (name.includes('khalaf')) return 'khalaf';
    return rewayatMatch[1].trim().split(/\s+/)[0];
  }
  return 'hafs';
};

// Extract recitation style from an MP3Quran moshaf name
const getMoshafStyle = (moshafName: string): string => {
  const nameLower = moshafName.toLowerCase();
  if (nameLower.includes("mo'lim") || nameLower.includes('moallem') || nameLower.includes('muallim')) return 'muallim';
  if (nameLower.includes('mojawwad') || nameLower.includes('mujawwad')) return 'mujawwad';
  return 'murattal';
};

export default function ReciterView({
  audioSource,
  onAudioSourceChange,
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
  mp3QuranReciters,
  mp3QuranRecitersAr,
  selectedMp3QuranReciter,
  selectedMoshaf,
  onMp3QuranReciterChange,
  onMoshafChange,
  currentSurahId,
  currentPlayingAyah,
  onListen,
  onNavigateToSurah,
}: ReciterViewProps) {
  const { t, isRTL, language } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  const [, setSearchParams] = useSearchParams();
  
  // Core state
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedUnifiedReciter, setSelectedUnifiedReciter] = useState<UnifiedReciter | null>(null);
  const [showReciterScroll, setShowReciterScroll] = useState(true);
  const [selectedSurahForPlayback, setSelectedSurahForPlayback] = useState(currentSurahId);
  const [selectedAyahForPlayback, setSelectedAyahForPlayback] = useState(currentPlayingAyah?.ayah || 1);

  // MP3Quran reading/style selection (derived from moshaf names)
  const [selectedMp3Reading, setSelectedMp3Reading] = useState('');
  const [selectedMp3Style, setSelectedMp3Style] = useState('');

  // MP3Quran timing validation state
  const [isCheckingTiming, setIsCheckingTiming] = useState(false);
  const [timingAvailable, setTimingAvailable] = useState(false);
  const [timingError, setTimingError] = useState<'network' | 'not-found' | null>(null);

  // Surah availability state
  const [isSurahAvailable, setIsSurahAvailable] = useState(true);
  const [isCheckingSurah, setIsCheckingSurah] = useState(false);
  const [surahError, setSurahError] = useState<'network' | 'not-found' | null>(null);

  // Scroll-to refs
  const selectedReciterRef = useRef<HTMLButtonElement>(null);
  const selectedReadingRef = useRef<HTMLButtonElement>(null);
  const selectedStyleRef = useRef<HTMLButtonElement>(null);
  const selectedSurahRef = useRef<HTMLButtonElement>(null);

  // 50ms polling for search input — bypasses Android IME React state desync
  useEffect(() => {
    const id = setInterval(() => {
      const val = searchInputRef.current?.value ?? '';
      setSearch(prev => prev !== val ? val : prev);
    }, 50);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll effects for all columns
  useEffect(() => {
    selectedReciterRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' });
  }, [selectedUnifiedReciter?.id]);

  useEffect(() => {
    selectedReadingRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' });
  }, [filterReading, selectedMp3Reading]);

  useEffect(() => {
    selectedStyleRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' });
  }, [filterStyle, selectedMp3Style]);

  useEffect(() => {
    selectedSurahRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' });
  }, [selectedSurahForPlayback]);

  // Build unified reciter list (memoized)
  const unifiedReciters = useMemo<UnifiedReciter[]>(() => [
    ...uniqueReciterNames.map((r) => ({
      id: `everyayah-${r.nameAr}`,
      name: r.name,
      nameAr: r.nameAr,
      source: 'everyayah' as const,
    })),
    ...mp3QuranReciters.map((r) => {
      // Use nameAr from the reciter object if available (from local JSON)
      // Otherwise try to find it from the Arabic reciters array (from API)
      const arReciter = mp3QuranRecitersAr.find(ar => ar.id === r.id);
      return {
        id: `mp3quran-${r.id}`,
        name: r.name,
        nameAr: r.nameAr || arReciter?.name || r.name,
        source: 'mp3quran' as const,
        mp3QuranId: r.id,
        moshaf: r.moshaf,
      };
    }),
  ], [uniqueReciterNames, mp3QuranReciters, mp3QuranRecitersAr]);

  // Update selected surah/ayah when current changes
  useEffect(() => {
    setSelectedSurahForPlayback(currentSurahId);
    setSelectedAyahForPlayback(currentPlayingAyah?.ayah || 1);
  }, [currentSurahId, currentPlayingAyah]);

  // Sync current selections → selectedUnifiedReciter
  useEffect(() => {
    if (audioSource === 'everyayah' && filterReciterName && !selectedUnifiedReciter) {
      const found = unifiedReciters.find(r => r.source === 'everyayah' && r.nameAr === filterReciterName);
      if (found) { setSelectedUnifiedReciter(found); setShowReciterScroll(false); }
    } else if (audioSource === 'mp3quran' && selectedMp3QuranReciter && !selectedUnifiedReciter) {
      const found = unifiedReciters.find(r => r.source === 'mp3quran' && r.mp3QuranId === selectedMp3QuranReciter.id);
      if (found) { setSelectedUnifiedReciter(found); setShowReciterScroll(false); }
    }
  }, [audioSource, filterReciterName, selectedMp3QuranReciter, unifiedReciters]);

  // MP3Quran: init reading/style from selectedMoshaf
  useEffect(() => {
    if (selectedMp3QuranReciter && selectedMoshaf) {
      setSelectedMp3Reading(getMoshafReading(selectedMoshaf.name));
      setSelectedMp3Style(getMoshafStyle(selectedMoshaf.name));
    }
  }, [selectedMp3QuranReciter?.id, selectedMoshaf?.id]);

  // MP3Quran: auto-select moshaf when reading+style change
  useEffect(() => {
    if (!selectedMp3QuranReciter || !selectedMp3Reading || !selectedMp3Style) return;
    const matching = selectedMp3QuranReciter.moshaf.find(
      (m) => getMoshafReading(m.name) === selectedMp3Reading && getMoshafStyle(m.name) === selectedMp3Style
    );
    if (matching && matching.id !== selectedMoshaf?.id) {
      onMoshafChange(matching);
    }
  }, [selectedMp3Reading, selectedMp3Style, selectedMp3QuranReciter]);

  // Check MP3Quran surah availability
  useEffect(() => {
    if (selectedUnifiedReciter?.source !== 'mp3quran' || !selectedMoshaf) {
      setIsSurahAvailable(true);
      return;
    }

    const checkSurahAvailability = async () => {
      const isCached = await isMp3QuranAudioCached(selectedMoshaf.id, selectedSurahForPlayback);
      if (isCached) {
        setIsSurahAvailable(true);
        return;
      }
      
      const surahList = selectedMoshaf.surah_list.split(',').map(s => parseInt(s.trim(), 10));
      setIsSurahAvailable(surahList.includes(selectedSurahForPlayback));
    };

    checkSurahAvailability();
  }, [selectedUnifiedReciter, selectedMoshaf, selectedSurahForPlayback]);

  // Check EveryAyah surah availability
  useEffect(() => {
    if (selectedUnifiedReciter?.source !== 'everyayah' || !selectedReciter?.folder) {
      setIsCheckingSurah(false);
      setSurahError(null);
      return;
    }

    const checkSurahAvailability = async () => {
      setIsCheckingSurah(true);
      setSurahError(null);

      try {
        const cachedAyah = await getCachedIndividualAyah(
          selectedReciter.folder,
          selectedSurahForPlayback,
          1
        );
        
        if (cachedAyah) {
          setIsSurahAvailable(true);
          setSurahError(null);
          setIsCheckingSurah(false);
          return;
        }

        const surahStr = String(selectedSurahForPlayback).padStart(3, '0');
        const audioUrl = `https://everyayah.com/data/${selectedReciter.folder}/${surahStr}001.mp3`;
        
        const response = await fetch(audioUrl, {
          method: 'GET',
          headers: { 'Range': 'bytes=0-1023' }
        });
        
        if (response.ok || response.status === 206) {
          const blob = await response.blob();
          setIsSurahAvailable(blob.size > 0);
          setSurahError(blob.size > 0 ? null : 'not-found');
        } else {
          setIsSurahAvailable(false);
          setSurahError(response.status === 404 ? 'not-found' : 'network');
        }
      } catch (error) {
        setIsSurahAvailable(false);
        setSurahError('network');
      } finally {
        setIsCheckingSurah(false);
      }
    };

    const timeoutId = setTimeout(checkSurahAvailability, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedUnifiedReciter, selectedReciter, selectedSurahForPlayback]);

  // Check MP3Quran ayah timing availability
  useEffect(() => {
    if (selectedUnifiedReciter?.source !== 'mp3quran' || !selectedMp3QuranReciter || !selectedMoshaf) {
      setTimingAvailable(false);
      setTimingError(null);
      setIsCheckingTiming(false);
      return;
    }

    const checkTiming = async () => {
      setIsCheckingTiming(true);
      setTimingError(null);
      setTimingAvailable(false);

      try {
        const cachedTiming = await getCachedAyahTiming(selectedMoshaf.id, selectedSurahForPlayback);
        if (cachedTiming && cachedTiming.length > 0) {
          setTimingAvailable(true);
          setIsCheckingTiming(false);
          return;
        }

        const cachedMp3Audio = await getCachedMp3QuranAudio(selectedMoshaf.id, selectedSurahForPlayback);
        if (cachedMp3Audio && cachedMp3Audio.timingData && cachedMp3Audio.timingData.length > 0) {
          await cacheAyahTiming(selectedMoshaf.id, selectedSurahForPlayback, cachedMp3Audio.timingData);
          setTimingAvailable(true);
          setIsCheckingTiming(false);
          return;
        }

        const result = await checkAyahTiming(selectedSurahForPlayback, selectedMoshaf.id);
        
        if (result.success && result.timings.length > 0) {
          await cacheAyahTiming(selectedMoshaf.id, selectedSurahForPlayback, result.timings);
          setTimingAvailable(true);
          setTimingError(null);
        } else if (result.error === 'network') {
          setTimingAvailable(false);
          setTimingError('network');
        } else {
          setTimingAvailable(false);
          setTimingError('not-found');
        }
      } catch (error) {
        setTimingAvailable(false);
        setTimingError('network');
      } finally {
        setIsCheckingTiming(false);
      }
    };

    const timeoutId = setTimeout(checkTiming, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedUnifiedReciter, selectedMp3QuranReciter, selectedMoshaf, selectedSurahForPlayback]);

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

  // Filter reciters based on search
  const matchesSearch = (text: string, searchTerm: string): boolean => {
    if (!searchTerm.trim()) return true;
    return normalizeArabic(text).includes(normalizeArabic(searchTerm));
  };

  // Translate moshaf name
  const translateMoshafName = (moshafName: string): string => {
    const nameLower = moshafName.toLowerCase();
    
    if (nameLower.includes("almusshaf al mo'lim")) return t('muallim');
    if (nameLower.includes("almusshaf al mojawwad")) return t('mujawwad');
    
    const rewayatMatch = moshafName.match(/Rewayat\s+(.+?)\s+-\s+(.+)/i);
    if (rewayatMatch) {
      const rewayatName = rewayatMatch[1].trim();
      const styleName = rewayatMatch[2].trim().toLowerCase();
      
      const mainNameMatch = rewayatName.match(/^(.+?)\s+(?:A'n|An)\s+/i);
      const simplifiedRewayat = mainNameMatch ? mainNameMatch[1].trim() : rewayatName;
      
      const rewayatLower = simplifiedRewayat.toLowerCase().replace(/['\s-]/g, '');
      const rewayatMap: Record<string, string> = {
        'hafs': 'hafs',
        'warsh': 'warsh',
        'qalon': 'qalon',
        'aldori': 'aldori',
      };
      
      const translatedRewayat = rewayatMap[rewayatLower] ? t(rewayatMap[rewayatLower] as any) : simplifiedRewayat;
      
      let translatedStyle = '';
      if (styleName.includes('murattal') || styleName.includes('مرتل')) {
        translatedStyle = t('murattal');
      } else if (styleName.includes('mujawwad') || styleName.includes('mojawwad')) {
        translatedStyle = t('mujawwad');
      }
      
      if (translatedStyle) {
        return `${translatedStyle} - ${translatedRewayat}`;
      }
      return translatedRewayat;
    }
    
    if (nameLower.includes('murattal') || nameLower.includes('مرتل')) return t('murattal');
    if (nameLower.includes('mujawwad') || nameLower.includes('مجود')) return t('mujawwad');
    
    return moshafName;
  };

  // Handle reciter selection
  const handleReciterSelect = (reciter: UnifiedReciter) => {
    setSelectedUnifiedReciter(reciter);
    setShowReciterScroll(false);
    onAudioSourceChange(reciter.source);
    if (reciter.source === 'everyayah') {
      onFilterReciterNameChange(reciter.nameAr);
    } else if (reciter.source === 'mp3quran' && reciter.mp3QuranId) {
      const mp3Reciter = mp3QuranReciters.find(r => r.id === reciter.mp3QuranId);
      if (mp3Reciter) onMp3QuranReciterChange(mp3Reciter);
    }
  };

  // Filtered + sorted reciter list (memoized)
  const filteredAndSortedReciters = useMemo(() => unifiedReciters
    .filter(r => {
      const name = language === 'ar' ? r.nameAr : r.name;
      return matchesSearch(name, search);
    })
    .sort((a, b) => {
      // MP3Quran always before EveryAyah
      if (a.source !== b.source) {
        return a.source === 'mp3quran' ? -1 : 1;
      }
      const nameA = language === 'ar' ? a.nameAr : a.name;
      const nameB = language === 'ar' ? b.nameAr : b.name;
      return nameA.localeCompare(nameB, language);
    }), [unifiedReciters, search, language]);

  // ── Column 1: reading type data ───────────────────────────────────────────────
  const mp3Readings = useMemo(() => {
    if (!selectedMp3QuranReciter) return [];
    const readings = selectedMp3QuranReciter.moshaf.map(m => getMoshafReading(m.name));
    return [...new Set(readings)];
  }, [selectedMp3QuranReciter]);

  // ── Column 2: style data (filtered by reading for MP3Quran) ───────────────────
  const mp3StylesForReading = useMemo(() => {
    if (!selectedMp3QuranReciter) return [];
    const moshafs = selectedMp3Reading
      ? selectedMp3QuranReciter.moshaf.filter(m => getMoshafReading(m.name) === selectedMp3Reading)
      : selectedMp3QuranReciter.moshaf;
    const styles = moshafs.map(m => getMoshafStyle(m.name));
    return [...new Set(styles)];
  }, [selectedMp3QuranReciter, selectedMp3Reading]);

  const getReadings = () => {
    if (!selectedUnifiedReciter) return [];
    if (selectedUnifiedReciter.source === 'everyayah') return availableReadings.length > 0 ? availableReadings : ['hafs'];
    return mp3Readings;
  };

  const getStyles = () => {
    if (!selectedUnifiedReciter) return [];
    if (selectedUnifiedReciter.source === 'everyayah') return availableStyles.length > 0 ? availableStyles : ['murattal'];
    return mp3StylesForReading;
  };

  const isReadingSelected = (reading: string) => {
    if (selectedUnifiedReciter?.source === 'everyayah') return filterReading === reading;
    return selectedMp3Reading === reading;
  };

  const isStyleSelected = (style: string) => {
    if (selectedUnifiedReciter?.source === 'everyayah') return filterStyle === style;
    return selectedMp3Style === style;
  };

  const handleReadingSelect = (reading: string) => {
    if (!selectedUnifiedReciter) return;
    if (selectedUnifiedReciter.source === 'everyayah') {
      onFilterReadingChange(reading);
    } else {
      setSelectedMp3Reading(reading);
      const moshafs = selectedMp3QuranReciter?.moshaf.filter(m => getMoshafReading(m.name) === reading) || [];
      if (moshafs.length > 0) setSelectedMp3Style(getMoshafStyle(moshafs[0].name));
    }
  };

  const handleStyleSelect = (style: string) => {
    if (!selectedUnifiedReciter) return;
    if (selectedUnifiedReciter.source === 'everyayah') {
      onFilterStyleChange(style);
    } else {
      setSelectedMp3Style(style);
    }
  };

  const translateReadingKey = (key: string): string => {
    const map: Record<string, string> = {
      hafs: t('hafs'), warsh: t('warsh'), qalon: t('qalon'), aldori: t('aldori'),
    };
    return map[key] || key;
  };

  const translateStyleKey = (key: string): string => {
    const map: Record<string, string> = {
      murattal: t('murattal'), mujawwad: t('mujawwad'), muallim: t('muallim'),
    };
    return map[key] || key;
  };

  // Save button disability
  const isSaveDisabled = selectedUnifiedReciter?.source === 'everyayah'
    ? (!selectedReciter || !isSurahAvailable)
    : (!selectedMp3QuranReciter || !selectedMoshaf || !isSurahAvailable);

  // Column item shared classes
  const colItemBase = cn(
    'w-full px-2 py-1.5 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors text-center',
    textSizeClasses.text
  );

  return (
    <div
      className={cn('flex flex-col flex-1 min-h-0 overflow-hidden px-4 pt-3 pb-[5.5rem]', isRTL ? 'rtl' : 'ltr')}
    >
      {/* Back button + title */}
      <button
        onClick={() => setSearchParams({})}
        className={cn(
          'flex items-center gap-2 shrink-0 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors',
          textSizeClasses.text
        )}
      >
        {isRTL ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        <span className="font-bold">{t('reciter')}</span>
      </button>

      {showReciterScroll ? (
        /* ── PHASE 1: Reciter picker (full remaining height) ── */
        <>
          {/* Search input */}
          <div className="relative mt-2 mb-1 shrink-0">
            <Search className={cn(
              'absolute top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600 dark:text-emerald-400',
              isRTL ? 'right-3' : 'left-3'
            )} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t('searchReciter')}
              className={cn(
                'w-full h-9 rounded-md border border-emerald-300 bg-transparent px-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500',
                isRTL ? 'pr-9 text-right' : 'pl-9 text-left',
                textSizeClasses.text
              )}
            />
          </div>

          {/* Reciter scroll — takes all remaining height */}
          <div className="overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg max-h-[calc(100vh-30rem)] md:max-h-[calc(100vh-26rem)]">
            {filteredAndSortedReciters.map((reciter, index) => (
              <button
                key={reciter.id}
                ref={selectedUnifiedReciter?.id === reciter.id ? selectedReciterRef : null}
                onClick={() => handleReciterSelect(reciter)}
                className={cn(
                  'w-full px-3 py-2 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors',
                  'hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10',
                  selectedUnifiedReciter?.id === reciter.id && 'bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold',
                  textSizeClasses.text,
                  isRTL ? 'text-right' : 'text-left'
                )}
              >
                <div className={cn('flex items-center gap-2 w-full', isRTL && 'flex-row-reverse')}>
                  <span className="text-emerald-500 dark:text-emerald-500 text-xs shrink-0">{index + 1}.</span>
                  <span className="flex-1 text-emerald-800 dark:text-emerald-200">
                    {language === 'ar' ? reciter.nameAr : reciter.name}
                  </span>
                  <span className={cn(
                    'shrink-0 px-1.5 py-0.5 rounded text-[0.6rem] font-medium leading-tight',
                    reciter.source === 'everyayah'
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                      : 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400'
                  )}>
                    {reciter.source === 'everyayah' ? t('everyAyah') : t('mp3Quran')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : selectedUnifiedReciter ? (
        /* ── PHASE 2: Reciter chosen — name chip + 3 columns ── */
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col flex-1 min-h-0 mt-2"
        >
          {/* Selected reciter name + re-choose button */}
          <div className={cn(
            'flex items-center gap-2 mb-2 px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 shrink-0',
            isRTL ? 'flex-row-reverse' : 'flex-row'
          )}>
            <span className={cn('flex-1 font-semibold text-emerald-800 dark:text-emerald-200', textSizeClasses.text)}>
              {language === 'ar' ? selectedUnifiedReciter.nameAr : selectedUnifiedReciter.name}
            </span>
            <span className={cn(
              'shrink-0 px-1.5 py-0.5 rounded text-[0.6rem] font-medium leading-tight',
              selectedUnifiedReciter.source === 'everyayah'
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                : 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400'
            )}>
              {selectedUnifiedReciter.source === 'everyayah' ? t('everyAyah') : t('mp3Quran')}
            </span>
            <button
              onClick={() => setShowReciterScroll(true)}
              className="shrink-0 p-1.5 rounded-md text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-800 transition-colors"
              title={t('searchReciter')}
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
          {/* Column headers */}
          <div className={cn('flex gap-2 mb-1 shrink-0', textSizeClasses.label)}>
            <h3 className="flex-1 text-center font-semibold text-emerald-800 dark:text-emerald-200">
              {t('readingType')}
            </h3>
            <h3 className="flex-1 text-center font-semibold text-emerald-800 dark:text-emerald-200">
              {t('recitationStyle')}
            </h3>
            <h3 className="flex-1 text-center font-semibold text-emerald-800 dark:text-emerald-200">
              {t('surah')}
            </h3>
          </div>

          {/* 3 scrollable columns */}
          <div className="flex gap-2 overflow-hidden min-h-0 max-h-[calc(100vh-30rem)] md:max-h-[calc(100vh-26rem)]">
            {/* Column 1: Reading type */}
            <div className="flex-1 overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg">
              {getReadings().map((reading) => (
                <button
                  key={reading}
                  ref={isReadingSelected(reading) ? selectedReadingRef : null}
                  onClick={() => handleReadingSelect(reading)}
                  className={cn(colItemBase, 'hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10', isReadingSelected(reading) && 'bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold')}
                >
                  <span className="text-emerald-800 dark:text-emerald-200">{translateReadingKey(reading)}</span>
                </button>
              ))}
            </div>

            {/* Column 2: Style */}
            <div className="flex-1 overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg">
              {getStyles().map((style) => (
                <button
                  key={style}
                  ref={isStyleSelected(style) ? selectedStyleRef : null}
                  onClick={() => handleStyleSelect(style)}
                  className={cn(colItemBase, 'hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10', isStyleSelected(style) && 'bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold')}
                >
                  <span className="text-emerald-800 dark:text-emerald-200">{translateStyleKey(style)}</span>
                </button>
              ))}
            </div>

            {/* Column 3: Surah */}
            <div className="flex-1 overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg">
              {surahs.map((surah) => (
                <button
                  key={surah.id}
                  ref={selectedSurahForPlayback === surah.id ? selectedSurahRef : null}
                  onClick={() => setSelectedSurahForPlayback(surah.id)}
                  className={cn(
                    colItemBase,
                    'hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10',
                    selectedSurahForPlayback === surah.id && 'bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold',
                    isRTL ? 'text-right' : 'text-left'
                  )}
                >
                  <span className="text-emerald-800 dark:text-emerald-200">
                    {surah.id}. {language === 'ar' ? surah.name : surah.englishName}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Status messages (compact) */}
          <div className="shrink-0 mt-1 space-y-0.5">
            {isCheckingSurah && (
              <div className={cn('flex items-center gap-2 text-emerald-600 dark:text-emerald-400', textSizeClasses.text)}>
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>{t('loading')}</span>
              </div>
            )}
            {!isCheckingSurah && !isSurahAvailable && surahError === 'not-found' && (
              <div className={cn('flex items-center gap-2 text-amber-600 dark:text-amber-400', textSizeClasses.text)}>
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{t('surahNotAvailableForReciter')}</span>
              </div>
            )}
            {selectedUnifiedReciter.source === 'mp3quran' && (
              <>
                {isCheckingTiming && (
                  <div className={cn('flex items-center gap-2 text-emerald-600 dark:text-emerald-400', textSizeClasses.text)}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>{t('checkingTiming')}</span>
                  </div>
                )}
                {!isCheckingTiming && timingAvailable && (
                  <div className={cn('flex items-center gap-2 text-green-600 dark:text-green-400', textSizeClasses.text)}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('timingAvailable')}</span>
                  </div>
                )}
                {!isCheckingTiming && timingError === 'network' && (
                  <div className={cn('flex items-center gap-2 text-red-600 dark:text-red-400', textSizeClasses.text)}>
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('timingNetworkError')}</span>
                  </div>
                )}
                {!isCheckingTiming && timingError === 'not-found' && (
                  <div className={cn('flex items-center gap-2 text-amber-600 dark:text-amber-400', textSizeClasses.text)}>
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="whitespace-pre-line">{t('timingNotAvailable')}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Save button */}
          <div className="shrink-0 pt-2 pb-1 mt-1 border-t border-emerald-100 dark:border-emerald-900 bg-gradient-to-b from-transparent via-[#FBF9F4]/80 to-[#FBF9F4] dark:from-transparent dark:via-gray-900/80 dark:to-gray-900">
            <Button
              onClick={async () => {
                onListen();
                await onNavigateToSurah(selectedSurahForPlayback);
              }}
              disabled={isSaveDisabled}
              className={cn(
                'w-full bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB] disabled:opacity-50',
                textSizeClasses.button
              )}
            >
              {isCheckingTiming ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('checkingTiming')}
                </span>
              ) : (
                t('save')
              )}
            </Button>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
