import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ChevronDown, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { cn } from "@/lib/utils";
import type { Mp3QuranReciter, Mp3QuranMoshaf } from "@/lib/mp3quran-service";
import { checkAyahTiming } from "@/lib/mp3quran-service";
import { getCachedAyahTiming, cacheAyahTiming, getCachedIndividualAyah, isMp3QuranAudioCached, getCachedMp3QuranAudio } from "@/lib/audio-cache";
import { surahs } from "@/data/surahs";

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
  const [everyAyahSearch, setEveryAyahSearch] = useState('');
  const [mp3QuranSearch, setMp3QuranSearch] = useState('');
  const [selectedSurahForPlayback, setSelectedSurahForPlayback] = useState(currentSurahId);
  const [selectedAyahForPlayback, setSelectedAyahForPlayback] = useState(currentPlayingAyah?.ayah || 1);
  
  // MP3Quran timing validation state
  const [isCheckingTiming, setIsCheckingTiming] = useState(false);
  const [timingAvailable, setTimingAvailable] = useState(false);
  const [timingError, setTimingError] = useState<'network' | 'not-found' | null>(null);
  
  // MP3Quran surah availability state
  const [isSurahAvailable, setIsSurahAvailable] = useState(true);
  
  // EveryAyah surah availability state
  const [isCheckingEveryAyahSurah, setIsCheckingEveryAyahSurah] = useState(false);
  const [isEveryAyahSurahAvailable, setIsEveryAyahSurahAvailable] = useState(true);
  const [everyAyahSurahError, setEveryAyahSurahError] = useState<'network' | 'not-found' | null>(null);
  
  // Dropdown visibility state
  const [showEveryAyahDropdown, setShowEveryAyahDropdown] = useState(false);
  const [showMp3QuranDropdown, setShowMp3QuranDropdown] = useState(false);
  const everyAyahContainerRef = useRef<HTMLDivElement>(null);
  const mp3QuranContainerRef = useRef<HTMLDivElement>(null);
  const everyAyahInputRef = useRef<HTMLInputElement>(null);
  const mp3QuranInputRef = useRef<HTMLInputElement>(null);
  
  // Polling refs for Android IME composition fix
  const everyAyahPollingRef = useRef<NodeJS.Timeout | null>(null);
  const mp3QuranPollingRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is outside the container for EveryAyah
      if (everyAyahContainerRef.current && !everyAyahContainerRef.current.contains(target)) {
        setShowEveryAyahDropdown(false);
      }
      // Check if click is outside the container for MP3Quran
      if (mp3QuranContainerRef.current && !mp3QuranContainerRef.current.contains(target)) {
        setShowMp3QuranDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Poll EveryAyah input for changes (fixes Android IME composition issue)
  useEffect(() => {
    if (showEveryAyahDropdown && everyAyahInputRef.current) {
      everyAyahPollingRef.current = setInterval(() => {
        if (everyAyahInputRef.current) {
          const currentValue = everyAyahInputRef.current.value;
          if (currentValue !== everyAyahSearch) {
            setEveryAyahSearch(currentValue);
          }
        }
      }, 100); // Poll every 100ms
    } else {
      if (everyAyahPollingRef.current) {
        clearInterval(everyAyahPollingRef.current);
        everyAyahPollingRef.current = null;
      }
    }

    return () => {
      if (everyAyahPollingRef.current) {
        clearInterval(everyAyahPollingRef.current);
        everyAyahPollingRef.current = null;
      }
    };
  }, [showEveryAyahDropdown, everyAyahSearch]);

  // Poll MP3Quran input for changes (fixes Android IME composition issue)
  useEffect(() => {
    if (showMp3QuranDropdown && mp3QuranInputRef.current) {
      mp3QuranPollingRef.current = setInterval(() => {
        if (mp3QuranInputRef.current) {
          const currentValue = mp3QuranInputRef.current.value;
          if (currentValue !== mp3QuranSearch) {
            setMp3QuranSearch(currentValue);
          }
        }
      }, 100); // Poll every 100ms
    } else {
      if (mp3QuranPollingRef.current) {
        clearInterval(mp3QuranPollingRef.current);
        mp3QuranPollingRef.current = null;
      }
    }

    return () => {
      if (mp3QuranPollingRef.current) {
        clearInterval(mp3QuranPollingRef.current);
        mp3QuranPollingRef.current = null;
      }
    };
  }, [showMp3QuranDropdown, mp3QuranSearch]);

  // Update selected surah/ayah when current changes
  useEffect(() => {
    setSelectedSurahForPlayback(currentSurahId);
    setSelectedAyahForPlayback(currentPlayingAyah?.ayah || 1);
  }, [currentSurahId, currentPlayingAyah]);

  // Check if selected surah is available in the selected moshaf (MP3Quran only)
  useEffect(() => {
    if (audioSource !== 'mp3quran' || !selectedMoshaf || !selectedMoshaf.surah_list) {
      setIsSurahAvailable(true);
      return;
    }

    const checkSurahAvailability = async () => {
      // First check if audio is cached - if yes, it's definitely available
      const isCached = await isMp3QuranAudioCached(selectedMoshaf.id, selectedSurahForPlayback);
      if (isCached) {
        console.log(`✅ Surah ${selectedSurahForPlayback} is cached for moshaf ${selectedMoshaf.id}`);
        setIsSurahAvailable(true);
        return;
      }

      // Not cached, check surah_list
      const surahList = selectedMoshaf.surah_list.split(',').map(s => parseInt(s.trim(), 10));
      const isAvailable = surahList.includes(selectedSurahForPlayback);
      
      setIsSurahAvailable(isAvailable);
      
      if (!isAvailable) {
        console.log(`❌ Surah ${selectedSurahForPlayback} not available in moshaf ${selectedMoshaf.id}`);
      }
    };

    checkSurahAvailability();
  }, [audioSource, selectedMoshaf, selectedSurahForPlayback]);

  // Check if selected surah is available for EveryAyah reciter (check first ayah)
  useEffect(() => {
    if (audioSource !== 'everyayah' || !selectedReciter || !selectedReciter.folder) {
      setIsEveryAyahSurahAvailable(true);
      setIsCheckingEveryAyahSurah(false);
      setEveryAyahSurahError(null);
      return;
    }

    const checkSurahAvailability = async () => {
      setIsCheckingEveryAyahSurah(true);
      setEveryAyahSurahError(null);

      try {
        // First check if first ayah is cached - if yes, surah is available
        const cachedAyah = await getCachedIndividualAyah(
          selectedReciter.folder,
          selectedSurahForPlayback,
          1
        );
        
        if (cachedAyah) {
          console.log(`✅ Surah ${selectedSurahForPlayback} first ayah is cached for ${selectedReciter.folder}`);
          setIsEveryAyahSurahAvailable(true);
          setEveryAyahSurahError(null);
          setIsCheckingEveryAyahSurah(false);
          return;
        }

        // Not cached, verify via network
        // Format surah and ayah numbers (3 digits)
        const surahStr = String(selectedSurahForPlayback).padStart(3, '0');
        const ayahStr = '001'; // Check first ayah
        
        // Build the audio URL
        const audioUrl = `https://everyayah.com/data/${selectedReciter.folder}/${surahStr}${ayahStr}.mp3`;
        
        // Try to fetch first 1KB to verify file exists
        const response = await fetch(audioUrl, {
          method: 'GET',
          headers: {
            'Range': 'bytes=0-1023'
          }
        });
        
        // Check if response is OK or Partial Content (206)
        if (response.ok || response.status === 206) {
          const blob = await response.blob();
          if (blob.size > 0) {
            setIsEveryAyahSurahAvailable(true);
            setEveryAyahSurahError(null);
          } else {
            console.log(`❌ Surah ${selectedSurahForPlayback} not available for reciter ${selectedReciter.folder}`);
            setIsEveryAyahSurahAvailable(false);
            setEveryAyahSurahError('not-found');
          }
        } else {
          if (response.status === 404) {
            console.log(`❌ Surah ${selectedSurahForPlayback} not available for reciter ${selectedReciter.folder} (status: ${response.status})`);
            setIsEveryAyahSurahAvailable(false);
            setEveryAyahSurahError('not-found');
          } else {
            console.log(`⚠️ Network/server error while checking surah ${selectedSurahForPlayback} for reciter ${selectedReciter.folder} (status: ${response.status})`);
            setIsEveryAyahSurahAvailable(false);
            setEveryAyahSurahError('network');
          }
        }
      } catch (error) {
        console.error('Error checking EveryAyah surah availability:', error);
        // Network or connectivity issue
        setIsEveryAyahSurahAvailable(false);
        setEveryAyahSurahError('network');
      } finally {
        setIsCheckingEveryAyahSurah(false);
      }
    };

    // Debounce the check slightly to avoid too many requests
    const timeoutId = setTimeout(checkSurahAvailability, 300);
    return () => clearTimeout(timeoutId);
  }, [audioSource, selectedReciter, selectedSurahForPlayback]);

  // Check ayah timing availability for MP3Quran
  useEffect(() => {
    // Only check for MP3Quran mode
    if (audioSource !== 'mp3quran' || !selectedMp3QuranReciter || !selectedMoshaf) {
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
        // Check dedicated timing cache first
        const cachedTiming = await getCachedAyahTiming(selectedMoshaf.id, selectedSurahForPlayback);
        
        if (cachedTiming && cachedTiming.length > 0) {
          console.log(`✅ Timing available from cache for moshaf ${selectedMoshaf.id} surah ${selectedSurahForPlayback}`);
          setTimingAvailable(true);
          setIsCheckingTiming(false);
          return;
        }

        // Fallback: if MP3Quran audio is already cached and has embedded timing metadata, use it
        const cachedMp3Audio = await getCachedMp3QuranAudio(selectedMoshaf.id, selectedSurahForPlayback);
        if (cachedMp3Audio && cachedMp3Audio.timingData && cachedMp3Audio.timingData.length > 0) {
          console.log(`✅ Timing available from cached MP3Quran audio for moshaf ${selectedMoshaf.id} surah ${selectedSurahForPlayback}`);
          // Persist to dedicated timing cache for faster future checks
          await cacheAyahTiming(selectedMoshaf.id, selectedSurahForPlayback, cachedMp3Audio.timingData);
          setTimingAvailable(true);
          setIsCheckingTiming(false);
          return;
        }

        // Not in cache, fetch from API
        console.log(`🔍 Checking timing from API for moshaf ${selectedMoshaf.id} surah ${selectedSurahForPlayback}`);
        const result = await checkAyahTiming(selectedSurahForPlayback, selectedMoshaf.id);

        if (result.success && result.timings.length > 0) {
          // Save to cache
          await cacheAyahTiming(selectedMoshaf.id, selectedSurahForPlayback, result.timings);
          console.log(`✅ Timing fetched and cached for moshaf ${selectedMoshaf.id} surah ${selectedSurahForPlayback}`);
          setTimingAvailable(true);
        } else {
          // Handle errors
          if (result.error === 'network') {
            setTimingError('network');
          } else if (result.error === 'not-found') {
            setTimingError('not-found');
          }
          setTimingAvailable(false);
        }
      } catch (error) {
        console.error('Error checking timing:', error);
        setTimingError('network');
        setTimingAvailable(false);
      } finally {
        setIsCheckingTiming(false);
      }
    };

    checkTiming();
  }, [audioSource, selectedMp3QuranReciter, selectedMoshaf, selectedSurahForPlayback]);

  // Get current surah info
  const currentSurah = surahs.find(s => s.id === selectedSurahForPlayback) || surahs[0];
  const ayahsCount = currentSurah.numberOfAyahs;

  // Normalize Arabic text for search
  const normalizeArabic = (text: string): string => {
    return text
      // Normalize different forms of Alif
      .replace(/[أإآٱ]/g, 'ا')
      // Normalize Alif Maqsura to Ya
      .replace(/ى/g, 'ي')
      // Normalize Ta Marbuta to Ha
      .replace(/ة/g, 'ه')
      // Remove all diacritics (tashkeel)
      .replace(/[\u064B-\u065F\u0670]/g, '')
      // Remove tatweel (kashida)
      .replace(/\u0640/g, '')
      .toLowerCase();
  };

  // Filter function for Arabic/English text
  const matchesSearch = (text: string, search: string): boolean => {
    if (!search.trim()) return true;
    const normalizedText = normalizeArabic(text);
    const normalizedSearch = normalizeArabic(search);
    return normalizedText.includes(normalizedSearch);
  };

  // Get Arabic name for MP3Quran reciter
  const getMp3QuranReciterName = (reciter: Mp3QuranReciter) => {
    const arReciter = mp3QuranRecitersAr.find(r => r.id === reciter.id);
    return arReciter ? arReciter.name : reciter.name;
  };

  // Get display value for EveryAyah search input
  const getEveryAyahDisplayValue = () => {
    if (showEveryAyahDropdown) return everyAyahSearch;
    if (filterReciterName && filterReciterName !== 'all') {
      const reciter = uniqueReciterNames.find(r => r.nameAr === filterReciterName);
      if (reciter) {
        return language === 'ar' ? reciter.nameAr : reciter.name;
      }
    }
    return '';
  };

  // Get display value for MP3Quran search input
  const getMp3QuranDisplayValue = () => {
    if (showMp3QuranDropdown) return mp3QuranSearch;
    if (selectedMp3QuranReciter) {
      return getMp3QuranReciterName(selectedMp3QuranReciter);
    }
    return '';
  };

  // Translate moshaf name
  const translateMoshafName = (moshafName: string): string => {
    const nameLower = moshafName.toLowerCase();
    
    // Special case for specific patterns (these already include the style in the name)
    if (nameLower.includes("almusshaf al mo'lim - almusshaf al mo'lim")) {
      return t('muallim');
    } else if (nameLower.includes("almusshaf al mojawwad - almusshaf al mojawwad")) {
      return t('mujawwad');
    }
    
    // Extract rewayat (reading style) from the name
    // Pattern: "Rewayat [Name] - [Style]"
    const rewayatMatch = moshafName.match(/Rewayat\s+(.+?)\s+-\s+(.+)/i);
    
    if (rewayatMatch) {
      const rewayatName = rewayatMatch[1].trim(); // e.g., "Hafs A'n Assem", "Warsh A'n Nafi'"
      const styleName = rewayatMatch[2].trim().toLowerCase(); // e.g., "Murattal", "Mujawwad"
      
      // Simplify common rewayat names for brevity
      let simplifiedRewayat = rewayatName;
      
      // Extract just the main name (before "A'n" or "An")
      const mainNameMatch = rewayatName.match(/^(.+?)\s+(?:A'n|An)\s+/i);
      if (mainNameMatch) {
        simplifiedRewayat = mainNameMatch[1].trim(); // e.g., "Hafs", "Warsh", "Qalon"
      }
      
      // Translate the rewayat name using a mapping
      const translateRewayat = (rewayat: string): string => {
        const rewayatLower = rewayat.toLowerCase().replace(/['\s-]/g, '');
        
        // Map common rewayat names to translation keys
        const rewayatMap: Record<string, string> = {
          'hafs': 'hafs',
          'warsh': 'warsh',
          'qalon': 'qalon',
          'aldori': 'aldori',
          'aldorai': 'aldorai',
          'shobah': 'shobah',
          'khalaf': 'khalaf',
          'khallad': 'khallad',
          'albizi': 'albizi',
          'qunbol': 'qunbol',
          'ibnthakwan': 'ibnThakwan',
          'ibnamer': 'ibnAmer',
          'ibnkatheer': 'ibnKatheer',
          'alkisai': 'alkisai',
          'hamzah': 'hamzah',
          'asim': 'asim',
          'assem': 'assem',
          'nafi': 'nafi',
          'abiamr': 'abiAmr',
        };
        
        const key = rewayatMap[rewayatLower];
        if (key) {
          return t(key as any);
        }
        
        // If no translation found, return original
        return rewayat;
      };
      
      const translatedRewayat = translateRewayat(simplifiedRewayat);
      
      // Translate the style
      let translatedStyle = '';
      if (styleName.includes('murattal') || styleName.includes('مرتل')) {
        translatedStyle = t('murattal');
      } else if (styleName.includes('mujawwad') || styleName.includes('mojawwad') || styleName.includes('مجود')) {
        translatedStyle = t('mujawwad');
      } else if (styleName.includes("mo'lim") || styleName.includes('muallim') || styleName.includes('معلم') || styleName.includes('teacher')) {
        translatedStyle = t('muallim');
      } else {
        translatedStyle = styleName;
      }
      
      // Return combined name: "Murattal - Hafs" or just the rewayat name if no style translation
      if (translatedStyle && translatedStyle !== styleName) {
        return `${translatedStyle} - ${translatedRewayat}`;
      }
      return translatedRewayat;
    }
    
    // Check for common recitation types (fallback if no rewayat pattern)
    if (nameLower.includes('murattal') || nameLower.includes('مرتل')) {
      return t('murattal');
    } else if (nameLower.includes('mujawwad') || nameLower.includes('مجود')) {
      return t('mujawwad');
    } else if (nameLower.includes("mo'lim") || nameLower.includes('muallim') || nameLower.includes('معلم') || nameLower.includes('teacher')) {
      return t('muallim');
    }
    
    // Return original name if no translation found
    return moshafName;
  };

  return (
    <div className={cn("p-4 space-y-3 bg-[#FBF9F4]", isRTL ? "rtl" : "ltr")}>
      {/* Audio Source Tabs */}
      <Tabs value={audioSource} onValueChange={(value) => onAudioSourceChange(value as 'everyayah' | 'mp3quran')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-11 md:h-12 bg-emerald-100 dark:bg-emerald-900/30">
          <TabsTrigger value="everyayah" className={cn("data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB]", textSizeClasses.text)}>
            {t('everyAyah')}
          </TabsTrigger>
          <TabsTrigger value="mp3quran" className={cn("data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB]", textSizeClasses.text)}>
            {t('mp3Quran')}
          </TabsTrigger>
        </TabsList>

        {/* Tab Explanation Text */}
        <div className="mt-3 mb-2 px-2 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
          <p className={cn(
            "text-emerald-700 dark:text-emerald-300",
            isRTL ? "text-right" : "text-left",
            textSizeClasses.text
          )}>
            {audioSource === 'everyayah' ? t('everyAyahExplanation') : t('mp3QuranExplanation')}
          </p>
        </div>

        {/* EveryAyah Tab Content */}
        <TabsContent value="everyayah" className="space-y-2 sm:space-y-3 mt-3">
          {/* Reciter Name Search Box */}
          <div className="flex flex-col gap-2" ref={everyAyahContainerRef}>
            <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
              {t('reciterName')}
            </span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600 dark:text-emerald-400 z-10" />
              <Input
                ref={everyAyahInputRef}
                placeholder={t('searchReciter')}
                value={showEveryAyahDropdown ? everyAyahSearch : getEveryAyahDisplayValue()}
                onChange={(e) => {
                  setEveryAyahSearch(e.target.value);
                  setShowEveryAyahDropdown(true);
                }}
                onCompositionUpdate={(e) => {
                  // Android IME composition: update during text composition
                  const target = e.target as HTMLInputElement;
                  setEveryAyahSearch(target.value);
                }}
                onKeyUp={(e) => {
                  // Fallback for Android: read value directly from input on any key
                  const target = e.target as HTMLInputElement;
                  if (target.value !== everyAyahSearch) {
                    setEveryAyahSearch(target.value);
                  }
                }}
                onFocus={() => {
                  setEveryAyahSearch('');
                  setShowEveryAyahDropdown(true);
                }}
                className={cn("pl-10 pr-10 border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 bg-emerald-50 dark:bg-emerald-900/20", textSizeClasses.text)}
              />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            
              {/* Dropdown Results */}
              {showEveryAyahDropdown && (
                <div 
                  className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#FBF9F4] dark:bg-emerald-950 border border-emerald-300 rounded-lg shadow-lg"
                  style={{ maxHeight: '200px', overflowY: 'scroll' }}
                >
                  {uniqueReciterNames
                    .filter((reciter) => {
                      const name = language === 'ar' ? reciter.nameAr : reciter.name;
                      return matchesSearch(name, everyAyahSearch);
                    })
                    .slice()
                    .sort((a, b) => {
                      const nameA = language === 'ar' ? a.nameAr : a.name;
                      const nameB = language === 'ar' ? b.nameAr : b.name;
                      return nameA.localeCompare(nameB, language);
                    })
                    .map((reciter, index) => (
                      <div
                        key={reciter.nameAr}
                        className="px-4 py-2 hover:bg-emerald-100 dark:hover:bg-emerald-800 cursor-pointer border-b border-emerald-100 last:border-none"
                        onClick={() => {
                          onFilterReciterNameChange(reciter.nameAr);
                          setShowEveryAyahDropdown(false);
                        }}
                      >
                        <div className={cn("flex items-center gap-2 w-full", language === 'ar' && "flex-row-reverse text-right", textSizeClasses.text)}>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{index + 1}.</span>
                          <span className="flex-1">{language === 'ar' ? reciter.nameAr : reciter.name}</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Show other options only after selection */}
          {filterReciterName && filterReciterName !== 'all' && (
            <>
              {/* Reading Type Filter */}
              <div className="flex flex-col gap-2">
                <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
                  {t('readingType')}
                </span>
                <Select value={filterReading} onValueChange={onFilterReadingChange} modal={false}>
                  <SelectTrigger className="w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 touch-manipulation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950 z-[100]" position="popper" sideOffset={5}>
                    {filterReciterName === 'all' && <SelectItem value="all" className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation", textSizeClasses.text)}>{t('all')}</SelectItem>}
                    {availableReadings.includes('hafs') && <SelectItem value="hafs" className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation", textSizeClasses.text)}>{t('hafs')}</SelectItem>}
                    {availableReadings.includes('warsh') && <SelectItem value="warsh" className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation", textSizeClasses.text)}>{t('warsh')}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Recitation Style Filter */}
              <div className="flex flex-col gap-2">
                <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
                  {t('recitationStyle')}
                </span>
                <Select value={filterStyle} onValueChange={onFilterStyleChange} modal={false}>
                  <SelectTrigger className="w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 touch-manipulation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950 z-[100]" position="popper" sideOffset={5}>
                    {filterReciterName === 'all' && <SelectItem value="all" className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation", textSizeClasses.text)}>{t('all')}</SelectItem>}
                    {availableStyles.includes('murattal') && <SelectItem value="murattal" className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation", textSizeClasses.text)}>{t('murattal')}</SelectItem>}
                    {availableStyles.includes('mujawwad') && <SelectItem value="mujawwad" className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation", textSizeClasses.text)}>{t('mujawwad')}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Quality Filter */}
              <div className="flex flex-col gap-2">
                <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
                  {t('quality')}
                </span>
                <Select value={filterQuality} onValueChange={onFilterQualityChange} modal={false}>
                  <SelectTrigger className="w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 touch-manipulation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950 z-[100]" position="popper" sideOffset={5}>
                    {filterReciterName === 'all' && <SelectItem value="all" className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation", textSizeClasses.text)}>{t('all')}</SelectItem>}
                    {availableQualities.includes('192kbps') && <SelectItem value="192kbps" className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation", textSizeClasses.text)}>192kbps</SelectItem>}
                    {availableQualities.includes('128kbps') && <SelectItem value="128kbps" className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation", textSizeClasses.text)}>128kbps</SelectItem>}
                    {availableQualities.includes('64kbps') && <SelectItem value="64kbps" className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation", textSizeClasses.text)}>64kbps</SelectItem>}
                    {availableQualities.includes('48kbps') && <SelectItem value="48kbps" className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation", textSizeClasses.text)}>48kbps</SelectItem>}
                    {availableQualities.includes('40kbps') && <SelectItem value="40kbps" className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation", textSizeClasses.text)}>40kbps</SelectItem>}
                    {availableQualities.includes('32kbps') && <SelectItem value="32kbps" className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation", textSizeClasses.text)}>32kbps</SelectItem>}
                    {availableQualities.includes('16kbps') && <SelectItem value="16kbps" className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation", textSizeClasses.text)}>16kbps</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              {/* Separator */}
              <div className="border-t border-emerald-200 dark:border-emerald-700 my-2"></div>

              {/* Ayah and Surah Selection */}
              <div className="grid grid-cols-2 gap-2">
                {/* Ayah Selection */}
                <div className="flex flex-col gap-2">
                  <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
                    {t('chooseAyah')}
                  </span>
                  <Select value={selectedAyahForPlayback.toString()} onValueChange={(value) => setSelectedAyahForPlayback(Number(value))}>
                    <SelectTrigger className="w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
                      <div className="max-h-[200px] overflow-y-auto">
                        {Array.from({ length: ayahsCount }, (_, i) => i + 1).map((ayahNum) => (
                          <SelectItem
                            key={ayahNum}
                            value={ayahNum.toString()}
                            className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100", textSizeClasses.text)}
                          >
                            {t('ayah')} {ayahNum}
                          </SelectItem>
                        ))}
                      </div>
                    </SelectContent>
                  </Select>
                </div>

                {/* Surah Selection */}
                <div className="flex flex-col gap-2">
                  <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
                    {t('chooseSurah')}
                  </span>
                  <Select value={selectedSurahForPlayback.toString()} onValueChange={(value) => {
                    setSelectedSurahForPlayback(Number(value));
                    setSelectedAyahForPlayback(1);
                  }}>
                    <SelectTrigger className="w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
                      <div className="max-h-[200px] overflow-y-auto">
                        {surahs.map((surah) => (
                          <SelectItem
                            key={surah.id}
                            value={surah.id.toString()}
                            className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100", textSizeClasses.text)}
                          >
                            {language === 'ar' ? `${surah.id}. ${surah.name}` : `${surah.id}. ${surah.englishName}`}
                          </SelectItem>
                        ))}
                      </div>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Surah Availability Status for EveryAyah */}
              {selectedReciter && (
                <div className="flex flex-col gap-2 mt-2">
                  {isCheckingEveryAyahSurah && (
                    <div className={cn("flex items-center gap-2 text-blue-600 dark:text-blue-400 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800", textSizeClasses.text)}>
                      <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                      <span>{t('loading')}</span>
                    </div>
                  )}

                  {!isCheckingEveryAyahSurah && everyAyahSurahError === 'network' && (
                    <div className={cn("flex items-center gap-2 text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800", textSizeClasses.text)}>
                      <XCircle className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                      <span>{t('everyAyahNetworkError')}</span>
                    </div>
                  )}
                  
                  {!isCheckingEveryAyahSurah && everyAyahSurahError === 'not-found' && (
                    <div className={cn("flex items-center gap-2 text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800", textSizeClasses.text)}>
                      <XCircle className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                      <span>{t('surahNotAvailableForReciter')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Save Button for EveryAyah */}
              <div className="pt-2 sm:pt-3 mt-2">
                <Button
                  onClick={async () => {
                    onListen();
                    await onNavigateToSurah(selectedSurahForPlayback);
                  }}
                  disabled={(!selectedReciter && filteredReciters.length === 0) || isCheckingEveryAyahSurah || !isEveryAyahSurahAvailable}
                  className={cn("w-full bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB] disabled:opacity-50 disabled:cursor-not-allowed", textSizeClasses.button)}
                >
                  {isCheckingEveryAyahSurah ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('loading')}
                    </span>
                  ) : (
                    t('save')
                  )}
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* MP3Quran Tab Content */}
        <TabsContent value="mp3quran" className="space-y-2 sm:space-y-3 mt-3">
          {/* Reciter Search Box */}
          <div className="flex flex-col gap-2" ref={mp3QuranContainerRef}>
            <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
              {t('reciterName')}
            </span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600 dark:text-emerald-400 z-10" />
              <Input
                ref={mp3QuranInputRef}
                placeholder={t('searchReciter')}
                value={showMp3QuranDropdown ? mp3QuranSearch : getMp3QuranDisplayValue()}
                onChange={(e) => {
                  setMp3QuranSearch(e.target.value);
                  setShowMp3QuranDropdown(true);
                }}
                onCompositionUpdate={(e) => {
                  // Android IME composition: update during text composition
                  const target = e.target as HTMLInputElement;
                  setMp3QuranSearch(target.value);
                }}
                onKeyUp={(e) => {
                  // Fallback for Android: read value directly from input on any key
                  const target = e.target as HTMLInputElement;
                  if (target.value !== mp3QuranSearch) {
                    setMp3QuranSearch(target.value);
                  }
                }}
                onFocus={() => {
                  setMp3QuranSearch('');
                  setShowMp3QuranDropdown(true);
                }}
                className={cn("pl-10 pr-10 border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 bg-emerald-50 dark:bg-emerald-900/20", textSizeClasses.text)}
              />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            
              {/* Dropdown Results */}
              {showMp3QuranDropdown && (
                <div 
                  className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#FBF9F4] dark:bg-emerald-950 border border-emerald-300 rounded-lg shadow-lg"
                  style={{ maxHeight: '200px', overflowY: 'scroll' }}
                >
                  {mp3QuranReciters
                    .filter((reciter) => matchesSearch(getMp3QuranReciterName(reciter), mp3QuranSearch))
                    .slice()
                    .sort((a, b) => {
                      const nameA = getMp3QuranReciterName(a);
                      const nameB = getMp3QuranReciterName(b);
                      return nameA.localeCompare(nameB, 'ar');
                    })
                    .map((reciter, index) => (
                      <div
                        key={reciter.id}
                        className="px-4 py-2 hover:bg-emerald-100 dark:hover:bg-emerald-800 cursor-pointer border-b border-emerald-100 last:border-none"
                        onClick={() => {
                          onMp3QuranReciterChange(reciter);
                          setShowMp3QuranDropdown(false);
                        }}
                      >
                        <div className={cn("flex items-center gap-2 w-full flex-row-reverse text-right", textSizeClasses.text)}>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{index + 1}.</span>
                          <span className="flex-1">{getMp3QuranReciterName(reciter)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Show other options only after selection */}
          {selectedMp3QuranReciter && (
            <>
              {/* Moshaf/Recitation Type Selection */}
              {selectedMp3QuranReciter.moshaf.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
                    {t('recitationType')}
                  </span>
                  <Select
                    value={selectedMoshaf?.id.toString() || ''}
                    onValueChange={(value) => {
                      const moshaf = selectedMp3QuranReciter.moshaf.find(m => m.id.toString() === value);
                      if (moshaf) {
                        onMoshafChange(moshaf);
                      }
                    }}
                    modal={false}
                  >
                    <SelectTrigger className="w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 touch-manipulation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950 z-[100]" position="popper" sideOffset={5}>
                      {selectedMp3QuranReciter.moshaf.map((moshaf) => (
                        <SelectItem
                          key={moshaf.id}
                          value={moshaf.id.toString()}
                          className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation", textSizeClasses.text)}
                        >
                          {translateMoshafName(moshaf.name)} ({moshaf.surah_total} {t('surahs')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Separator */}
              <div className="border-t border-emerald-200 dark:border-emerald-700 my-2"></div>

              {/* Surah Selection */}
              <div className="flex flex-col gap-2">
                <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
                  {t('chooseSurah')}
                </span>
                <Select value={selectedSurahForPlayback.toString()} onValueChange={(value) => {
                  setSelectedSurahForPlayback(Number(value));
                  setSelectedAyahForPlayback(1);
                }} modal={false}>
                  <SelectTrigger className="w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 touch-manipulation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950 z-[100]" position="popper" sideOffset={5}>
                    <div className="max-h-[200px] overflow-y-auto">
                      {surahs.map((surah) => (
                        <SelectItem
                          key={surah.id}
                          value={surah.id.toString()}
                          className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation", textSizeClasses.text)}
                        >
                          {language === 'ar' ? `${surah.id}. ${surah.name}` : `${surah.id}. ${surah.englishName}`}
                        </SelectItem>
                      ))}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              {/* Surah Availability Warning for MP3Quran */}
              {selectedMp3QuranReciter && selectedMoshaf && !isSurahAvailable && (
                <div className={cn("flex items-center gap-2 text-red-600 dark:text-red-400 mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800", textSizeClasses.text)}>
                  <XCircle className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                  <span>{t('surahNotAvailableForReciter')}</span>
                </div>
              )}

              {/* Timing Status Display */}
              {selectedMp3QuranReciter && selectedMoshaf && isSurahAvailable && (
                <div className="flex flex-col gap-2 mt-2">
                  {isCheckingTiming && (
                    <div className={cn("flex items-center gap-2 text-blue-600 dark:text-blue-400", textSizeClasses.text)}>
                      <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                      <span>{t('checkingTiming')}</span>
                    </div>
                  )}
                  
                  {!isCheckingTiming && timingAvailable && (
                    <div className={cn("flex items-center gap-2 text-green-600 dark:text-green-400", textSizeClasses.text)}>
                      <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
                      <span>{t('timingAvailable')}</span>
                    </div>
                  )}
                  
                  {!isCheckingTiming && timingError === 'network' && (
                    <div className={cn("flex items-center gap-2 text-red-600 dark:text-red-400", textSizeClasses.text)}>
                      <XCircle className="w-4 h-4 md:w-5 md:h-5" />
                      <span>{t('timingNetworkError')}</span>
                    </div>
                  )}
                  
                  {!isCheckingTiming && timingError === 'not-found' && (
                    <div className={cn("flex items-center gap-2 text-amber-600 dark:text-amber-400", textSizeClasses.text)}>
                      <XCircle className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                      <span className="whitespace-pre-line">{t('timingNotAvailable')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Save Button for MP3Quran */}
              <div className="pt-2 sm:pt-3 mt-2">
                <Button
                  onClick={async () => {
                    onListen();
                    await onNavigateToSurah(selectedSurahForPlayback);
                  }}
                  disabled={!selectedMp3QuranReciter || !selectedMoshaf || !isSurahAvailable}
                  className={cn("w-full bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB] disabled:opacity-50 disabled:cursor-not-allowed", textSizeClasses.button)}
                >
                  {isCheckingTiming ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('checkingTiming')}
                    </span>
                  ) : (
                    t('save')
                  )}
                </Button>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
