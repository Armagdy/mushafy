import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, Loader2, CheckCircle2, XCircle, Pencil, Star, ArrowDownCircle } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { cn } from "@/lib/utils";
import type { Mp3QuranReciter, Mp3QuranMoshaf } from "@/lib/mp3quran-service";
import { checkAyahTiming } from "@/lib/mp3quran-service";
import { getCachedAyahTiming, cacheAyahTiming, getCachedIndividualAyah, isMp3QuranAudioCached, getCachedMp3QuranAudio, getCachedReciterFolders } from "@/lib/audio-cache";
import { getDownloadedAudioCategories } from "@/lib/asset-cache";
import { getAudioData } from "@/lib/quran-data-service";
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

const FAVORITE_RECITERS_KEY = 'quran-favorite-reciters';

const loadFavoriteReciterIds = (): string[] => {
  try {
    const raw = localStorage.getItem(FAVORITE_RECITERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id: unknown) => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

// Strip the style suffix from an Arabic reciter name to get the base name.
// Must match the base-name extraction used to build uniqueReciterNames
// (see extractBaseNameAr in useAudioPlayer).
const extractBaseNameArLocal = (nameAr: string): string => {
  return nameAr
    .replace(/\s*-\s*(مجود|مرتل)\s*/g, '')
    .trim();
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

  // Favorite reciters (persisted in localStorage)
  const [favoriteIds, setFavoriteIds] = useState<string[]>(loadFavoriteReciterIds);

  // Downloaded reciters (audio available offline), detected from the caches
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(() => new Set());

  const toggleFavorite = (reciterId: string) => {
    setFavoriteIds(prev => {
      const next = prev.includes(reciterId)
        ? prev.filter(id => id !== reciterId)
        : [...prev, reciterId];
      try {
        localStorage.setItem(FAVORITE_RECITERS_KEY, JSON.stringify(next));
      } catch { /* storage full/unavailable */ }
      return next;
    });
  };

  // MP3Quran reading/style selection (derived from moshaf names)
  const [selectedMp3Reading, setSelectedMp3Reading] = useState('');
  const [selectedMp3Style, setSelectedMp3Style] = useState('');

  // ── Draft selection state ────────────────────────────────────────────────
  // Everything the user picks in this view is DRAFT until they press Save.
  // Browsing/selecting reciters must NEVER change the currently playing
  // reciter — commits to the audio player happen only in the Save button's
  // handler below.
  const [draftFilterReading, setDraftFilterReading] = useState(filterReading);
  const [draftFilterStyle, setDraftFilterStyle] = useState(filterStyle);
  const [draftMp3Reciter, setDraftMp3Reciter] = useState<Mp3QuranReciter | null>(selectedMp3QuranReciter);
  const [draftMoshaf, setDraftMoshaf] = useState<Mp3QuranMoshaf | null>(selectedMoshaf);

  // Full EveryAyah reciter dataset — used to compute reading/style options for
  // a draft-selected reciter before anything is committed to the player
  const [everyAyahRecitersData, setEveryAyahRecitersData] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    getAudioData().then((data: any) => {
      if (!cancelled && Array.isArray(data)) setEveryAyahRecitersData(data);
    }).catch((err) => console.error('Failed to load EveryAyah reciters:', err));
    return () => { cancelled = true; };
  }, []);

  // MP3Quran timing validation state
  const [isCheckingTiming, setIsCheckingTiming] = useState(false);
  const [timingAvailable, setTimingAvailable] = useState(false);
  const [timingError, setTimingError] = useState<'network' | 'not-found' | null>(null);

  // Surah availability state
  const [isSurahAvailable, setIsSurahAvailable] = useState(true);
  const [isCheckingSurah, setIsCheckingSurah] = useState(false);
  const [surahError, setSurahError] = useState<'network' | 'not-found' | null>(null);

  // Scroll-to refs
  const selectedReciterRef = useRef<HTMLDivElement>(null);
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

  // Detect downloaded reciters (offline audio) — runs in the background.
  // Sources: the asset cache (download manager) and the audio cache
  // (full-surah playback cache). Re-runs when the picker is re-opened
  // so fresh downloads are reflected.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [downloadedAudio, cachedAudio] = await Promise.all([
          getDownloadedAudioCategories(),
          getCachedReciterFolders(),
        ]);
        if (cancelled) return;

        const everyayahFolders = new Set([
          ...downloadedAudio.everyayahFolders,
          ...cachedAudio.everyayahFolders,
        ]);
        const mp3quranMoshafIds = new Set<number>([
          ...downloadedAudio.mp3quranMoshafIds,
          ...cachedAudio.mp3quranMoshafIds,
        ]);

        const ids = new Set<string>();

        // EveryAyah: map cached folders to unified ids (everyayah-${baseNameAr})
        try {
          const data = await getAudioData();
          if (Array.isArray(data)) {
            const folderToBase = new Map<string, string>();
            for (const reciter of data) {
              if (reciter?.folder && reciter?.nameAr) {
                folderToBase.set(reciter.folder, extractBaseNameArLocal(reciter.nameAr));
              }
            }
            for (const folder of everyayahFolders) {
              const base = folderToBase.get(folder);
              if (base) ids.add(`everyayah-${base}`);
            }
          }
        } catch (err) {
          console.error('Failed to map EveryAyah folders to reciters:', err);
        }

        // MP3Quran: downloaded when any of its moshafs has cached audio
        for (const reciter of unifiedReciters) {
          if (reciter.source === 'mp3quran' && reciter.moshaf?.some(m => mp3quranMoshafIds.has(m.id))) {
            ids.add(reciter.id);
          }
        }

        if (!cancelled) setDownloadedIds(ids);
      } catch (error) {
        console.error('Failed to detect downloaded reciters:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [unifiedReciters, showReciterScroll]);

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

  // MP3Quran: init reading/style from the DRAFT moshaf selection
  useEffect(() => {
    if (draftMp3Reciter && draftMoshaf) {
      setSelectedMp3Reading(getMoshafReading(draftMoshaf.name));
      setSelectedMp3Style(getMoshafStyle(draftMoshaf.name));
    }
  }, [draftMp3Reciter?.id, draftMoshaf?.id]);

  // MP3Quran: auto-select the DRAFT moshaf when reading+style change
  // (nothing is committed to the audio player here)
  useEffect(() => {
    if (!draftMp3Reciter || !selectedMp3Reading || !selectedMp3Style) return;
    const matching = draftMp3Reciter.moshaf.find(
      (m) => getMoshafReading(m.name) === selectedMp3Reading && getMoshafStyle(m.name) === selectedMp3Style
    );
    if (matching && matching.id !== draftMoshaf?.id) {
      setDraftMoshaf(matching);
    }
  }, [selectedMp3Reading, selectedMp3Style, draftMp3Reciter, draftMoshaf?.id]);

  // Check MP3Quran surah availability (against the DRAFT moshaf)
  useEffect(() => {
    if (selectedUnifiedReciter?.source !== 'mp3quran' || !draftMoshaf) {
      setIsSurahAvailable(true);
      return;
    }

    const checkSurahAvailability = async () => {
      const isCached = await isMp3QuranAudioCached(draftMoshaf.id, selectedSurahForPlayback);
      if (isCached) {
        setIsSurahAvailable(true);
        return;
      }
      
      const surahList = draftMoshaf.surah_list.split(',').map(s => parseInt(s.trim(), 10));
      setIsSurahAvailable(surahList.includes(selectedSurahForPlayback));
    };

    checkSurahAvailability();
  }, [selectedUnifiedReciter, draftMoshaf, selectedSurahForPlayback]);

  // Check EveryAyah surah availability - DISABLED: No checks for EveryAyah
  useEffect(() => {
    // Skip all checks for EveryAyah reciters
    if (selectedUnifiedReciter?.source === 'everyayah') {
      setIsSurahAvailable(true);
      setIsCheckingSurah(false);
      setSurahError(null);
      return;
    }
    
    if (selectedUnifiedReciter?.source !== 'everyayah' || !selectedReciter?.folder) {
      setIsCheckingSurah(false);
      setSurahError(null);
      return;
    }
  }, [selectedUnifiedReciter, selectedReciter, selectedSurahForPlayback]);

  // Check MP3Quran ayah timing availability (against the DRAFT selection)
  useEffect(() => {
    if (selectedUnifiedReciter?.source !== 'mp3quran' || !draftMp3Reciter || !draftMoshaf) {
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
        const cachedTiming = await getCachedAyahTiming(draftMoshaf.id, selectedSurahForPlayback);
        if (cachedTiming && cachedTiming.length > 0) {
          setTimingAvailable(true);
          setIsCheckingTiming(false);
          return;
        }

        const cachedMp3Audio = await getCachedMp3QuranAudio(draftMoshaf.id, selectedSurahForPlayback);
        if (cachedMp3Audio && cachedMp3Audio.timingData && cachedMp3Audio.timingData.length > 0) {
          await cacheAyahTiming(draftMoshaf.id, selectedSurahForPlayback, cachedMp3Audio.timingData);
          setTimingAvailable(true);
          setIsCheckingTiming(false);
          return;
        }

        const result = await checkAyahTiming(selectedSurahForPlayback, draftMoshaf.id);
        
        if (result.success && result.timings.length > 0) {
          await cacheAyahTiming(draftMoshaf.id, selectedSurahForPlayback, result.timings);
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
  }, [selectedUnifiedReciter, draftMp3Reciter, draftMoshaf, selectedSurahForPlayback]);

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

  // Handle reciter selection — DRAFT ONLY.
  // Nothing is committed to the audio player here; committing happens
  // exclusively in the Save button handler, so the currently playing
  // reciter is never changed just by browsing this page.
  const handleReciterSelect = (reciter: UnifiedReciter) => {
    setSelectedUnifiedReciter(reciter);
    setShowReciterScroll(false);
    if (reciter.source === 'everyayah') {
      // Default the draft reading/style to this reciter's first variant
      const variants = everyAyahRecitersData.filter(r => extractBaseNameArLocal(r?.nameAr || '') === reciter.nameAr);
      if (variants.length > 0) {
        const readings = [...new Set(variants.map((v: any) => v.reading).filter(Boolean))];
        const reading = readings[0] || 'hafs';
        const styleVariants = variants.filter((v: any) => v.reading === reading);
        const styles = [...new Set(styleVariants.map((v: any) => v.style).filter(Boolean))];
        setDraftFilterReading(reading);
        setDraftFilterStyle(styles[0] || 'murattal');
      }
    } else if (reciter.source === 'mp3quran' && reciter.mp3QuranId) {
      const mp3Reciter = mp3QuranReciters.find(r => r.id === reciter.mp3QuranId);
      if (mp3Reciter) {
        setDraftMp3Reciter(mp3Reciter);
        // Default the draft moshaf to this reciter's first moshaf
        const firstMoshaf = mp3Reciter.moshaf?.[0];
        if (firstMoshaf) setDraftMoshaf(firstMoshaf);
      }
    }
  };

  // Filtered + sorted reciter list, favorites first, then downloaded (memoized)
  const filteredAndSortedReciters = useMemo(() => unifiedReciters
    .filter(r => {
      const name = language === 'ar' ? r.nameAr : r.name;
      return matchesSearch(name, search);
    })
    .sort((a, b) => {
      // Favorites first, then downloaded, then the rest
      const rank = (r: UnifiedReciter) => favoriteIds.includes(r.id) ? 0 : downloadedIds.has(r.id) ? 1 : 2;
      const aRank = rank(a);
      const bRank = rank(b);
      if (aRank !== bRank) return aRank - bRank;
      // MP3Quran always before EveryAyah
      if (a.source !== b.source) {
        return a.source === 'mp3quran' ? -1 : 1;
      }
      const nameA = language === 'ar' ? a.nameAr : a.name;
      const nameB = language === 'ar' ? b.nameAr : b.name;
      return nameA.localeCompare(nameB, language);
    }), [unifiedReciters, search, language, favoriteIds, downloadedIds]);

  // Three-way partition — a reciter that is both bookmarked and downloaded
  // appears only once (in favorites), showing both icons
  const { favoriteReciters, downloadedReciters, otherReciters } = useMemo(() => {
    const favoriteReciters: UnifiedReciter[] = [];
    const downloadedReciters: UnifiedReciter[] = [];
    const otherReciters: UnifiedReciter[] = [];
    for (const r of filteredAndSortedReciters) {
      if (favoriteIds.includes(r.id)) favoriteReciters.push(r);
      else if (downloadedIds.has(r.id)) downloadedReciters.push(r);
      else otherReciters.push(r);
    }
    return { favoriteReciters, downloadedReciters, otherReciters };
  }, [filteredAndSortedReciters, favoriteIds, downloadedIds]);

  // ── Column 1: reading type data ───────────────────────────────────────────────
  // EveryAyah: variants of the DRAFT-selected reciter (used to build the
  // reading/style columns before anything is committed)
  const draftEveryAyahVariants = useMemo(() => {
    if (selectedUnifiedReciter?.source !== 'everyayah' || !selectedUnifiedReciter.nameAr) return [];
    return everyAyahRecitersData.filter(r => extractBaseNameArLocal(r?.nameAr || '') === selectedUnifiedReciter.nameAr);
  }, [selectedUnifiedReciter, everyAyahRecitersData]);

  const mp3Readings = useMemo(() => {
    if (!draftMp3Reciter) return [];
    const readings = draftMp3Reciter.moshaf.map(m => getMoshafReading(m.name));
    return [...new Set(readings)];
  }, [draftMp3Reciter]);

  // ── Column 2: style data (filtered by reading for MP3Quran) ───────────────────
  const mp3StylesForReading = useMemo(() => {
    if (!draftMp3Reciter) return [];
    const moshafs = selectedMp3Reading
      ? draftMp3Reciter.moshaf.filter(m => getMoshafReading(m.name) === selectedMp3Reading)
      : draftMp3Reciter.moshaf;
    const styles = moshafs.map(m => getMoshafStyle(m.name));
    return [...new Set(styles)];
  }, [draftMp3Reciter, selectedMp3Reading]);

  const getReadings = () => {
    if (!selectedUnifiedReciter) return [];
    if (selectedUnifiedReciter.source === 'everyayah') {
      // Options for the DRAFT-selected reciter (falls back to the committed
      // options while the reciter dataset loads)
      if (draftEveryAyahVariants.length > 0) {
        const readings = [...new Set(draftEveryAyahVariants.map((v: any) => v.reading).filter(Boolean))];
        if (readings.length > 0) return readings;
      }
      return availableReadings.length > 0 ? availableReadings : ['hafs'];
    }
    return mp3Readings;
  };

  const getStyles = () => {
    if (!selectedUnifiedReciter) return [];
    if (selectedUnifiedReciter.source === 'everyayah') {
      if (draftEveryAyahVariants.length > 0) {
        const styleVariants = draftEveryAyahVariants.filter((v: any) => !draftFilterReading || v.reading === draftFilterReading);
        const styles = [...new Set(styleVariants.map((v: any) => v.style).filter(Boolean))];
        if (styles.length > 0) return styles;
      }
      return availableStyles.length > 0 ? availableStyles : ['murattal'];
    }
    return mp3StylesForReading;
  };

  const isReadingSelected = (reading: string) => {
    if (selectedUnifiedReciter?.source === 'everyayah') return draftFilterReading === reading;
    return selectedMp3Reading === reading;
  };

  const isStyleSelected = (style: string) => {
    if (selectedUnifiedReciter?.source === 'everyayah') return draftFilterStyle === style;
    return selectedMp3Style === style;
  };

  const handleReadingSelect = (reading: string) => {
    if (!selectedUnifiedReciter) return;
    if (selectedUnifiedReciter.source === 'everyayah') {
      // Draft only — committed on Save
      setDraftFilterReading(reading);
      const styleVariants = draftEveryAyahVariants.filter((v: any) => v.reading === reading);
      if (styleVariants.length > 0) {
        const styles = [...new Set(styleVariants.map((v: any) => v.style).filter(Boolean))];
        if (styles.length > 0) setDraftFilterStyle(styles[0]);
      }
    } else {
      setSelectedMp3Reading(reading);
      const moshafs = draftMp3Reciter?.moshaf.filter(m => getMoshafReading(m.name) === reading) || [];
      if (moshafs.length > 0) setSelectedMp3Style(getMoshafStyle(moshafs[0].name));
    }
  };

  const handleStyleSelect = (style: string) => {
    if (!selectedUnifiedReciter) return;
    if (selectedUnifiedReciter.source === 'everyayah') {
      // Draft only — committed on Save
      setDraftFilterStyle(style);
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

  // Column item shared classes
  const colItemBase = cn(
    'w-full px-2 py-1.5 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors text-center',
    textSizeClasses.text
  );

  // Reciter row renderer (shared by favorites, downloaded & all-reciters sections)
  const renderReciterRow = (reciter: UnifiedReciter, index: number) => {
    const isFavorite = favoriteIds.includes(reciter.id);
    const isDownloaded = downloadedIds.has(reciter.id);
    const favoriteLabel = isFavorite ? t('removeFromFavorites') : t('addToFavorites');
    return (
      <div
        key={reciter.id}
        ref={selectedUnifiedReciter?.id === reciter.id ? selectedReciterRef : undefined}
        role="button"
        tabIndex={0}
        aria-pressed={selectedUnifiedReciter?.id === reciter.id}
        onClick={() => handleReciterSelect(reciter)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleReciterSelect(reciter);
          }
        }}
        className={cn(
          'w-full px-3 py-2 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors cursor-pointer',
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
          {isDownloaded && (
            <span
              className="shrink-0 p-1"
              title={t('downloaded')}
              aria-label={t('downloaded')}
            >
              <ArrowDownCircle className="w-4 h-4 fill-emerald-700/20 text-emerald-700 dark:fill-emerald-400/20 dark:text-emerald-400" />
            </span>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleFavorite(reciter.id); }}
            onKeyDown={(e) => e.stopPropagation()}
            title={favoriteLabel}
            aria-label={favoriteLabel}
            aria-pressed={isFavorite}
            className="shrink-0 p-1 rounded-full hover:bg-emerald-500/15 dark:hover:bg-emerald-400/15 transition-colors"
          >
            <Star className={cn(
              'w-4 h-4 transition-colors',
              isFavorite
                ? 'fill-emerald-700 text-emerald-700 dark:fill-emerald-400 dark:text-emerald-400'
                : 'text-emerald-300 dark:text-emerald-700'
            )} />
          </button>
        </div>
      </div>
    );
  };

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
            {/* Favorites on top */}
            {favoriteReciters.length > 0 && (
              <>
                {favoriteReciters.map((reciter, index) => renderReciterRow(reciter, index))}
                {/* Separator between favorites and the sections below */}
                {(downloadedReciters.length > 0 || otherReciters.length > 0) && (
                  <div
                    role="separator"
                    className="flex items-center gap-2 my-1 px-3"
                  >
                    <div className="flex-1 border-t-2 border-emerald-700 dark:border-emerald-600 rounded" />
                    <Star className="w-3 h-3 shrink-0 fill-emerald-700 text-emerald-700 dark:fill-emerald-500 dark:text-emerald-500" />
                    <div className="flex-1 border-t-2 border-emerald-700 dark:border-emerald-600 rounded" />
                  </div>
                )}
              </>
            )}
            {/* Downloaded (not bookmarked) below favorites */}
            {downloadedReciters.length > 0 && (
              <>
                {downloadedReciters.map((reciter, index) => renderReciterRow(reciter, favoriteReciters.length + index))}
                {/* Separator between downloaded and the rest */}
                {otherReciters.length > 0 && (
                  <div
                    role="separator"
                    className="flex items-center gap-2 my-1 px-3"
                  >
                    <div className="flex-1 border-t-2 border-emerald-700 dark:border-emerald-600 rounded" />
                    <ArrowDownCircle className="w-3 h-3 shrink-0 fill-emerald-700/20 text-emerald-700 dark:fill-emerald-400/20 dark:text-emerald-400" />
                    <div className="flex-1 border-t-2 border-emerald-700 dark:border-emerald-600 rounded" />
                  </div>
                )}
              </>
            )}
            {/* Rest of reciters */}
            {otherReciters.map((reciter, index) => renderReciterRow(reciter, favoriteReciters.length + downloadedReciters.length + index))}
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
          <button
            onClick={() => setShowReciterScroll(true)}
            title={t('searchReciter')}
            className={cn(
              'w-full flex items-center gap-2 mb-2 px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 shrink-0 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors',
              isRTL ? 'flex-row-reverse' : 'flex-row'
            )}
          >
            <span className={cn('flex-1 font-semibold text-emerald-800 dark:text-emerald-200 text-start', textSizeClasses.text)}>
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
            <Pencil className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          </button>
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

          {/* Save button */}
          <div className="shrink-0 pt-2 mt-1 border-t border-emerald-100 dark:border-emerald-900 bg-gradient-to-b from-transparent via-[#FBF9F4]/80 to-[#FBF9F4] dark:from-transparent dark:via-gray-900/80 dark:to-gray-900">
            <Button
              onClick={async () => {
                // ── COMMIT the draft selection ──────────────────────────────
                // This is the ONLY place the current playing reciter changes.
                // Any previously saved reciter that was playing is stopped by
                // onNavigateToSurah (stopAudio), even for the same surah.
                const source = selectedUnifiedReciter?.source ?? audioSource;
                onAudioSourceChange(source);
                if (source === 'everyayah') {
                  if (selectedUnifiedReciter?.nameAr) {
                    onFilterReciterNameChange(selectedUnifiedReciter.nameAr);
                  }
                  onFilterReadingChange(draftFilterReading);
                  onFilterStyleChange(draftFilterStyle);
                } else {
                  if (draftMp3Reciter) onMp3QuranReciterChange(draftMp3Reciter);
                  if (draftMoshaf) {
                    onMoshafChange(draftMoshaf);
                    // Persist now — the parent's onListen callback still sees
                    // the previous moshaf in this render's closure
                    localStorage.setItem('quran-last-mp3quran-moshaf', draftMoshaf.id.toString());
                  }
                }
                onListen();
                await onNavigateToSurah(selectedSurahForPlayback);
              }}
              className={cn(
                'w-full bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB]',
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

          {/* Status messages (compact) - below button to prevent jumping */}
          <div className="shrink-0 pb-1 space-y-0.5">
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
        </motion.div>
      ) : null}
    </div>
  );
}
