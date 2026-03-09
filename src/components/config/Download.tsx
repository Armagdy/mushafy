import React, { useState, useEffect, useRef } from "react";
import { HardDriveDownload, Search, WifiOff, StopCircle, CheckCircle2, XCircle, Pencil } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { MushafType } from "@/contexts/MushafContext";
import { useDownload } from "@/contexts/DownloadContext";
import { cn } from "@/lib/utils";
import { surahs } from "@/data/surahs";
import { getAudioData } from "@/lib/quran-data-service";
import { getMp3QuranReciters, type Mp3QuranReciter, type Mp3QuranMoshaf } from "@/lib/mp3quran-service";
import { useNetwork } from "@/hooks/useNetwork";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface Reciter {
  folder: string;
  name: string;
  nameAr: string;
  baseUrl: string;
  reading: string;
  readingAr?: string;
  style: string;
  quality: string;
}

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

export function Download() {
  const { t, isRTL, language } = useLanguage();
  const { isOnline } = useNetwork();
  const { toast } = useToast();
  const { dialogTextSize } = useDialogTextSize();
  const { activeDownload, startDownload, cancelDownload, clearDownload } = useDownload();
  
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  
  // Download state
  const [downloadType, setDownloadType] = useState<'pages' | 'everyayah' | 'mp3quran'>('pages');
  const [downloadMushafType, setDownloadMushafType] = useState<MushafType>('mwdoa');
  const [downloadFromPage, setDownloadFromPage] = useState(1);
  const [downloadToPage, setDownloadToPage] = useState(604);
  const [downloadFromSurah, setDownloadFromSurah] = useState(1);
  const [downloadToSurah, setDownloadToSurah] = useState(114);
  const [downloadFromAyah, setDownloadFromAyah] = useState(1);
  const [downloadToAyah, setDownloadToAyah] = useState(7);
  
  // Use context state for download progress
  const isDownloading = activeDownload?.status === 'downloading';
  const downloadProgress = activeDownload?.progress || { current: 0, total: 0 };
  
  // Reciter state for downloads
  const [everyAyahReciters, setEveryAyahReciters] = useState<Reciter[]>([]);
  const [mp3QuranReciters, setMp3QuranReciters] = useState<Mp3QuranReciter[]>([]);
  const [mp3QuranRecitersAr, setMp3QuranRecitersAr] = useState<Mp3QuranReciter[]>([]);
  const [selectedMp3QuranReciter, setSelectedMp3QuranReciter] = useState<number | null>(null);
  const [selectedMoshaf, setSelectedMoshaf] = useState<Mp3QuranMoshaf | null>(null);
  
  // Unified reciter selection
  const [selectedUnifiedReciter, setSelectedUnifiedReciter] = useState<UnifiedReciter | null>(null);
  const [showReciterScroll, setShowReciterScroll] = useState(true);
  const [showDownloadTypeScroll, setShowDownloadTypeScroll] = useState(false);
  const [showMushafTypeScroll, setShowMushafTypeScroll] = useState(false);
  
  // EveryAyah: Reading, Style, Quality selection
  const [selectedReading, setSelectedReading] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [selectedQuality, setSelectedQuality] = useState<string>('');
  
  // Unified search state
  const [reciterSearch, setReciterSearch] = useState('');
  const reciterSearchInputRef = useRef<HTMLInputElement>(null);
  
  // Track previous download status to detect transitions
  const prevDownloadStatusRef = useRef<string | null>(null);
  
  // 50ms polling for search input (fixes Android Arabic keyboard IME issues)
  useEffect(() => {
    const checkSearchInput = () => {
      const inputEl = reciterSearchInputRef.current;
      if (!inputEl) return;
      
      const currentValue = inputEl.value;
      if (currentValue !== reciterSearch) {
        setReciterSearch(currentValue);
      }
    };
    
    // Check immediately
    checkSearchInput();
    
    // Poll every 50ms
    const intervalId = setInterval(checkSearchInput, 50);
    
    return () => clearInterval(intervalId);
  }, [reciterSearch]);
  
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
  const matchesSearch = (text: string, search: string): boolean => {
    if (!search.trim()) return true;
    const normalizedText = normalizeArabic(text);
    const normalizedSearch = normalizeArabic(search);
    return normalizedText.includes(normalizedSearch);
  };
  
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
  
  // Get Arabic name for MP3Quran reciter
  const getMp3QuranReciterName = (reciter: Mp3QuranReciter) => {
    const arReciter = mp3QuranRecitersAr.find(r => r.id === reciter.id);
    return arReciter ? arReciter.name : reciter.name;
  };
  
  // Build unified reciter list (combining EveryAyah and MP3Quran)
  const unifiedReciters = React.useMemo<UnifiedReciter[]>(() => {
    const everyAyahUnified = everyAyahReciters.map((r) => ({
      id: `everyayah-${r.folder}`,
      name: r.name,
      nameAr: r.nameAr,
      source: 'everyayah' as const,
      folder: r.folder,
      quality: r.quality,
      style: r.style,
      reading: r.reading,
      readingAr: r.readingAr,
    }));
    
    const mp3QuranUnified = mp3QuranReciters.map((r) => {
      const arReciter = mp3QuranRecitersAr.find(ar => ar.id === r.id);
      return {
        id: `mp3quran-${r.id}`,
        name: r.name,
        nameAr: r.nameAr || arReciter?.name || r.name,
        source: 'mp3quran' as const,
        mp3QuranId: r.id,
        moshaf: r.moshaf,
      };
    });
    
    return [...everyAyahUnified, ...mp3QuranUnified];
  }, [everyAyahReciters, mp3QuranReciters, mp3QuranRecitersAr]);
  
  // Filtered and sorted unified reciters
  const filteredUnifiedReciters = React.useMemo(() => {
    return unifiedReciters
      .filter((reciter) => {
        const name = language === 'ar' ? reciter.nameAr : reciter.name;
        return matchesSearch(name, reciterSearch);
      })
      .sort((a, b) => {
        // Sort by source first (MP3Quran before EveryAyah)
        if (a.source !== b.source) {
          return a.source === 'mp3quran' ? -1 : 1;
        }
        const nameA = language === 'ar' ? a.nameAr : a.name;
        const nameB = language === 'ar' ? b.nameAr : b.name;
        return nameA.localeCompare(nameB, language);
      });
  }, [unifiedReciters, reciterSearch, language]);
  
  // Determine if download button should be enabled
  const isDownloadEnabled = (() => {
    if (isDownloading) return false;
    
    if (downloadType === 'pages') {
      return true; // Pages just need a range
    } else if (downloadType === 'everyayah') {
      // Need unified reciter selected, must be EveryAyah source, and must have reading/style/quality selected
      return selectedUnifiedReciter !== null && 
             selectedUnifiedReciter.source === 'everyayah' &&
             selectedReading !== '' &&
             selectedStyle !== '' &&
             selectedQuality !== '';
    } else if (downloadType === 'mp3quran') {
      // Need unified reciter selected and it must be MP3Quran source
      return selectedUnifiedReciter !== null && selectedUnifiedReciter.source === 'mp3quran' && selectedMoshaf !== null;
    }
    return false;
  })();
  
  // Load reciters when component mounts
  useEffect(() => {
    // Load ALL EveryAyah reciters (including all variations)
    fetch(`/assets/reciters.json`)
      .then(response => response.json())
      .then(data => {
        // Filter for everyayah reciters only
        const everyayahReciters = data.reciters.filter((r: any) => r.source === 'everyayah');
        setEveryAyahReciters(everyayahReciters);
      });
    
    // Load MP3Quran reciters (English and Arabic)
    getMp3QuranReciters('en').then((data) => {
      setMp3QuranReciters(data);
      if (data.length > 0 && !selectedMp3QuranReciter) {
        setSelectedMp3QuranReciter(data[0].id);
        if (data[0].moshaf && data[0].moshaf.length > 0) {
          setSelectedMoshaf(data[0].moshaf[0]);
        }
      }
    });
    
    getMp3QuranReciters('ar').then((data) => {
      setMp3QuranRecitersAr(data);
    });
  }, []);
  
  // Update moshaf when reciter changes
  useEffect(() => {
    if (selectedMp3QuranReciter) {
      const reciter = mp3QuranReciters.find(r => r.id === selectedMp3QuranReciter);
      if (reciter && reciter.moshaf && reciter.moshaf.length > 0) {
        setSelectedMoshaf(reciter.moshaf[0]);
      }
    }
  }, [selectedMp3QuranReciter, mp3QuranReciters]);
  
  // Sync unified reciter selection with source-specific state
  useEffect(() => {
    if (selectedUnifiedReciter) {
      if (selectedUnifiedReciter.source === 'mp3quran' && selectedUnifiedReciter.mp3QuranId) {
        setSelectedMp3QuranReciter(selectedUnifiedReciter.mp3QuranId);
        // Find the reciter and set the first moshaf
        const reciter = mp3QuranReciters.find(r => r.id === selectedUnifiedReciter.mp3QuranId);
        if (reciter && reciter.moshaf && reciter.moshaf.length > 0) {
          setSelectedMoshaf(reciter.moshaf[0]);
        }
      }
    }
  }, [selectedUnifiedReciter, mp3QuranReciters]);
  
  // Update max ayahs when surah changes
  useEffect(() => {
    const surah = surahs.find(s => s.id === downloadFromSurah);
    if (surah) {
      setDownloadToAyah(surah.numberOfAyahs);
    }
  }, [downloadFromSurah]);
  
  // Reset reciter scroll when download type changes
  useEffect(() => {
    if (downloadType === 'everyayah' || downloadType === 'mp3quran') {
      setShowReciterScroll(true);
    }
  }, [downloadType]);
  
  // Reset reading/style/quality when reciter changes
  useEffect(() => {
    setSelectedReading('');
    setSelectedStyle('');
    setSelectedQuality('');
  }, [selectedUnifiedReciter]);
  
  // Initialize the ref on mount with current status (don't show toast for existing state)
  useEffect(() => {
    prevDownloadStatusRef.current = activeDownload?.status || null;
  }, []); // Run only once on mount
  
  // Show toast when download status transitions to completed/error (not on mount)
  useEffect(() => {
    const currentStatus = activeDownload?.status || null;
    const prevStatus = prevDownloadStatusRef.current;
    
    // Only show toast when status CHANGES to completed or error (skip initial mount)
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
    
    // Update the ref for next comparison
    prevDownloadStatusRef.current = currentStatus;
  }, [activeDownload?.status, activeDownload?.error, toast, t]);
  
  const handleCancelDownload = () => {
    cancelDownload();
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
    
    // Prepare download job based on type
    if (downloadType === 'pages') {
      await startDownload({
        type: 'pages',
        params: {
          mushafType: downloadMushafType,
          fromPage: downloadFromPage,
          toPage: downloadToPage,
        },
      });
    } else if (downloadType === 'everyayah') {
      if (!selectedUnifiedReciter || selectedUnifiedReciter.source !== 'everyayah') return;
      
      // Find the exact reciter matching reading/style/quality selection
      const reciter = everyAyahReciters.find(r => 
        r.nameAr === selectedUnifiedReciter.nameAr &&
        r.reading === selectedReading &&
        r.style === selectedStyle &&
        r.quality === selectedQuality
      );
      if (!reciter) return;
      
      await startDownload({
        type: 'everyayah',
        params: {
          reciterFolder: reciter.folder,
          reciterName: reciter.name,
          reciterBaseUrl: reciter.baseUrl,
          surahNum: downloadFromSurah,
          fromAyah: downloadFromAyah,
          toAyah: downloadToAyah,
        },
      });
    } else if (downloadType === 'mp3quran') {
      if (!selectedMoshaf || !selectedUnifiedReciter || selectedUnifiedReciter.source !== 'mp3quran') return;
      
      await startDownload({
        type: 'mp3quran',
        params: {
          moshaf: selectedMoshaf,
          fromSurah: downloadFromSurah,
          toSurah: downloadToSurah,
        },
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Network Status Warning */}
      {!isOnline && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg">
          <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm md:text-base font-medium text-amber-800 dark:text-amber-300">
              {t('networkOffline')}
            </span>
            <span className="text-xs md:text-sm text-amber-700 dark:text-amber-400">
              {t('networkOfflineMessage')}
            </span>
          </div>
        </div>
      )}
      
      {/* Download Type Selection */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <HardDriveDownload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
            {t('downloadType')}
          </span>
        </div>
        {showDownloadTypeScroll ? (
          <div className="flex flex-col gap-1 border border-emerald-200 dark:border-emerald-800 rounded-lg overflow-hidden bg-transparent">
            <button
              onClick={() => {
                setDownloadType('pages');
                setShowDownloadTypeScroll(false);
              }}
              className={cn(
                "w-full px-3 py-2.5 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors text-right",
                downloadType === 'pages' && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                textSizeClasses.text
              )}
            >
              <span className="text-emerald-800 dark:text-emerald-200">
                {t('downloadMushafPages')}
              </span>
            </button>
            {/* Temporarily hidden - EveryAyah download option */}
            {/*
            <button
              onClick={() => {
                setDownloadType('everyayah');
                setShowDownloadTypeScroll(false);
              }}
              className={cn(
                "w-full px-3 py-2.5 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors text-right",
                downloadType === 'everyayah' && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                textSizeClasses.text
              )}
            >
              <span className="text-emerald-800 dark:text-emerald-200">
                {t('downloadEveryAyahAudio')}
              </span>
            </button>
            */}
            <button
              onClick={() => {
                setDownloadType('mp3quran');
                setShowDownloadTypeScroll(false);
              }}
              className={cn(
                "w-full px-3 py-2.5 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors text-right",
                downloadType === 'mp3quran' && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                textSizeClasses.text
              )}
            >
              <span className="text-emerald-800 dark:text-emerald-200">
                {t('downloadMp3QuranAudio')}
              </span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowDownloadTypeScroll(true)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-500/20 dark:bg-emerald-500/20 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors",
              isRTL ? 'flex-row-reverse' : 'flex-row'
            )}
          >
            <span className={cn("flex-1 text-emerald-800 dark:text-emerald-200 font-semibold text-right", textSizeClasses.text)}>
              {downloadType === 'pages' && t('downloadMushafPages')}
              {downloadType === 'everyayah' && t('downloadEveryAyahAudio')}
              {downloadType === 'mp3quran' && t('downloadMp3QuranAudio')}
            </span>
            <Pencil className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          </button>
        )}
      </div>
      
      {/* Pages Download Options */}
      {downloadType === 'pages' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className={cn("text-emerald-700 dark:text-emerald-300", textSizeClasses.label)}>{t('mushafType')}</label>
            {showMushafTypeScroll ? (
              <div className="flex flex-col gap-1 border border-emerald-200 dark:border-emerald-800 rounded-lg overflow-hidden bg-transparent max-h-72 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                <button
                  onClick={() => {
                    setDownloadMushafType('tarteel');
                    setShowMushafTypeScroll(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2.5 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors",
                    downloadMushafType === 'tarteel' && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                    textSizeClasses.text
                  )}
                >
                  <div className={cn('flex items-center gap-2 w-full', isRTL && 'flex-row-reverse')}>
                    <span className="text-emerald-500 dark:text-emerald-500 text-xs shrink-0">1.</span>
                    <span className="flex-1 text-emerald-800 dark:text-emerald-200">
                      {t('mushafTarteel')}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setDownloadMushafType('tajweed');
                    setShowMushafTypeScroll(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2.5 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors",
                    downloadMushafType === 'tajweed' && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                    textSizeClasses.text
                  )}
                >
                  <div className={cn('flex items-center gap-2 w-full', isRTL && 'flex-row-reverse')}>
                    <span className="text-emerald-500 dark:text-emerald-500 text-xs shrink-0">2.</span>
                    <span className="flex-1 text-emerald-800 dark:text-emerald-200">
                      {t('mushafTajweed')}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setDownloadMushafType('mwdoa');
                    setShowMushafTypeScroll(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2.5 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors",
                    downloadMushafType === 'mwdoa' && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                    textSizeClasses.text
                  )}
                >
                  <div className={cn('flex items-center gap-2 w-full', isRTL && 'flex-row-reverse')}>
                    <span className="text-emerald-500 dark:text-emerald-500 text-xs shrink-0">3.</span>
                    <span className="flex-1 text-emerald-800 dark:text-emerald-200">
                      {t('mushafMwdoa')}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setDownloadMushafType('tashel');
                    setShowMushafTypeScroll(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2.5 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors",
                    downloadMushafType === 'tashel' && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                    textSizeClasses.text
                  )}
                >
                  <div className={cn('flex items-center gap-2 w-full', isRTL && 'flex-row-reverse')}>
                    <span className="text-emerald-500 dark:text-emerald-500 text-xs shrink-0">4.</span>
                    <span className="flex-1 text-emerald-800 dark:text-emerald-200">
                      {t('mushafTashel')}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setDownloadMushafType('madinah');
                    setShowMushafTypeScroll(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2.5 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors",
                    downloadMushafType === 'madinah' && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                    textSizeClasses.text
                  )}
                >
                  <div className={cn('flex items-center gap-2 w-full', isRTL && 'flex-row-reverse')}>
                    <span className="text-emerald-500 dark:text-emerald-500 text-xs shrink-0">5.</span>
                    <span className="flex-1 text-emerald-800 dark:text-emerald-200">
                      {t('mushafMadinah')}
                    </span>
                  </div>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowMushafTypeScroll(true)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-500/20 dark:bg-emerald-500/20 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors",
                  isRTL ? 'flex-row-reverse' : 'flex-row',
                  textSizeClasses.text
                )}
              >
                <span className="flex-1 text-emerald-800 dark:text-emerald-200 font-semibold text-right">
                  {downloadMushafType === 'mwdoa' && t('mushafMwdoa')}
                  {downloadMushafType === 'tashel' && t('mushafTashel')}
                  {downloadMushafType === 'madinah' && t('mushafMadinah')}
                  {downloadMushafType === 'tarteel' && t('mushafTarteel')}
                  {downloadMushafType === 'tajweed' && t('mushafTajweed')}
                </span>
                <Pencil className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className={cn("text-emerald-700 dark:text-emerald-300 block mb-1", textSizeClasses.label)}>{t('fromPage')}</label>
              <input
                type="number"
                min={1}
                max={604}
                value={downloadFromPage}
                onChange={(e) => setDownloadFromPage(Math.min(604, Math.max(1, parseInt(e.target.value) || 1)))}
                className={cn("w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500", textSizeClasses.text)}
              />
            </div>
            <div className="flex-1">
              <label className={cn("text-emerald-700 dark:text-emerald-300 block mb-1", textSizeClasses.label)}>{t('toPage')}</label>
              <input
                type="number"
                min={1}
                max={604}
                value={downloadToPage}
                onChange={(e) => setDownloadToPage(Math.min(604, Math.max(1, parseInt(e.target.value) || 604)))}
                className={cn("w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500", textSizeClasses.text)}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* EveryAyah Download Options */}
      {downloadType === 'everyayah' && (
        <div className="flex flex-col gap-3">
          {showReciterScroll ? (
            /* Reciter Selection Phase */
            <>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <label className="text-sm md:text-base text-emerald-700 dark:text-emerald-300 font-medium">{t('reciter')}</label>
              </div>
              {/* Search input */}
              <div className="relative">
                <Search className={cn(
                  'absolute top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600 dark:text-emerald-400',
                  isRTL ? 'right-3' : 'left-3'
                )} />
                <input
                  ref={reciterSearchInputRef}
                  type="text"
                  placeholder={t('searchReciter')}
                  className={cn(
                    'w-full h-9 rounded-md border border-emerald-300 bg-transparent px-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500',
                    isRTL ? 'pr-9 text-right' : 'pl-9 text-left',
                    textSizeClasses.text
                  )}
                />
              </div>

              {/* Unified Reciter scrollable list */}
              <div className="overflow-y-scroll border border-emerald-200 dark:border-emerald-800 rounded-lg max-h-48" style={{ WebkitOverflowScrolling: 'touch' }}>
                {filteredUnifiedReciters.map((reciter, index) => (
                  <button
                    key={reciter.id}
                    onClick={() => {
                      setSelectedUnifiedReciter(reciter);
                      setShowReciterScroll(false);
                    }}
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
                      {/* Source badge only */}
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
            /* Reciter Selected - Show only selected item */
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <label className="text-sm md:text-base text-emerald-700 dark:text-emerald-300 font-medium">{t('reciter')}</label>
              </div>
              <button
                onClick={() => setShowReciterScroll(true)}
                title={t('searchReciter')}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-500/20 dark:bg-emerald-500/20 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors',
                  isRTL ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                <span className="flex-1 font-semibold text-emerald-800 dark:text-emerald-200 text-right">
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
              
              {/* Reading/Style/Quality Selection for EveryAyah */}
              {selectedUnifiedReciter.source === 'everyayah' && (
                <div className="flex flex-col">
                  {/* Column Headers */}
                  <div className="flex gap-2 mb-2">
                    <div className="flex-1 text-center">
                      <h3 className={cn("font-semibold text-emerald-800 dark:text-emerald-200", textSizeClasses.label)}>
                        {t('reading')}
                      </h3>
                    </div>
                    <div className="flex-1 text-center">
                      <h3 className={cn("font-semibold text-emerald-800 dark:text-emerald-200", textSizeClasses.label)}>
                        {t('recitationStyle')}
                      </h3>
                    </div>
                    <div className="flex-1 text-center">
                      <h3 className={cn("font-semibold text-emerald-800 dark:text-emerald-200", textSizeClasses.label)}>
                        {t('quality')}
                      </h3>
                    </div>
                  </div>

                  {/* Scrollable Columns */}
                  <div className="flex gap-2 max-h-32 mb-3">
                    {/* Reading Column */}
                    <div className="flex-1 overflow-y-scroll border border-emerald-200 dark:border-emerald-800 rounded-lg bg-transparent" style={{ WebkitOverflowScrolling: 'touch' }}>
                      {(() => {
                        const readings = [...new Set(everyAyahReciters
                          .filter(r => r.nameAr === selectedUnifiedReciter.nameAr)
                          .map(r => r.reading)
                        )];
                        return readings.map((reading) => (
                          <button
                            key={reading}
                            onClick={() => {
                              setSelectedReading(reading);
                              setSelectedStyle('');
                              setSelectedQuality('');
                            }}
                            className={cn(
                              "w-full px-3 py-2 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors text-center",
                              selectedReading === reading && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                              textSizeClasses.text
                            )}
                          >
                            <span className="text-emerald-800 dark:text-emerald-200">
                              {language === 'ar' 
                                ? (everyAyahReciters.find(r => r.reading === reading)?.readingAr || reading)
                                : reading.charAt(0).toUpperCase() + reading.slice(1)
                              }
                            </span>
                          </button>
                        ));
                      })()}
                    </div>

                    {/* Style Column */}
                    <div className="flex-1 overflow-y-scroll border border-emerald-200 dark:border-emerald-800 rounded-lg bg-transparent" style={{ WebkitOverflowScrolling: 'touch' }}>
                      {(() => {
                        const styles = selectedReading
                          ? [...new Set(everyAyahReciters
                              .filter(r => r.nameAr === selectedUnifiedReciter.nameAr && r.reading === selectedReading)
                              .map(r => r.style)
                            )]
                          : [];
                        return styles.map((style) => (
                          <button
                            key={style}
                            onClick={() => {
                              setSelectedStyle(style);
                              setSelectedQuality('');
                            }}
                            className={cn(
                              "w-full px-3 py-2 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors text-center",
                              selectedStyle === style && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                              textSizeClasses.text
                            )}
                          >
                            <span className="text-emerald-800 dark:text-emerald-200">
                              {t(style as 'murattal' | 'mujawwad' | 'muallim')}
                            </span>
                          </button>
                        ));
                      })()}
                    </div>

                    {/* Quality Column */}
                    <div className="flex-1 overflow-y-scroll border border-emerald-200 dark:border-emerald-800 rounded-lg bg-transparent" style={{ WebkitOverflowScrolling: 'touch' }}>
                      {(() => {
                        const qualities = selectedReading && selectedStyle
                          ? [...new Set(everyAyahReciters
                              .filter(r => r.nameAr === selectedUnifiedReciter.nameAr && r.reading === selectedReading && r.style === selectedStyle)
                              .map(r => r.quality)
                            )].sort((a, b) => parseInt(a) - parseInt(b))
                          : [];
                        return qualities.map((quality) => (
                          <button
                            key={quality}
                            onClick={() => setSelectedQuality(quality)}
                            className={cn(
                              "w-full px-3 py-2 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors text-center",
                              selectedQuality === quality && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                              textSizeClasses.text
                            )}
                          >
                            <span className="text-emerald-800 dark:text-emerald-200">
                              {quality}
                            </span>
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <label className="text-sm md:text-base text-emerald-700 dark:text-emerald-300">{t('selectSurah')}</label>
                <div className="flex flex-col gap-1 border border-emerald-200 dark:border-emerald-800 rounded-lg overflow-hidden bg-transparent max-h-40 overflow-y-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {surahs.map((surah) => (
                    <button
                      key={surah.id}
                      onClick={() => setDownloadFromSurah(surah.id)}
                      className={cn(
                        "w-full px-3 py-2.5 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors text-left",
                        downloadFromSurah === surah.id && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                        textSizeClasses.text
                      )}
                    >
                      <span className="text-emerald-800 dark:text-emerald-200">
                        {surah.id}. {isRTL ? surah.name : surah.englishName}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-sm md:text-base text-emerald-700 dark:text-emerald-300 block mb-1">{t('fromAyah')}</label>
                  <input
                    type="number"
                    min={1}
                    max={surahs.find(s => s.id === downloadFromSurah)?.numberOfAyahs || 7}
                    value={downloadFromAyah}
                    onChange={(e) => setDownloadFromAyah(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 text-base md:text-lg border border-emerald-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm md:text-base text-emerald-700 dark:text-emerald-300 block mb-1">{t('toAyah')}</label>
                  <input
                    type="number"
                    min={1}
                    max={surahs.find(s => s.id === downloadFromSurah)?.numberOfAyahs || 7}
                    value={downloadToAyah}
                    onChange={(e) => setDownloadToAyah(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 text-base md:text-lg border border-emerald-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
            </motion.div>
          ) : null}
        </div>
      )}
      
      {/* MP3Quran Download Options */}
      {downloadType === 'mp3quran' && (
        <div className="flex flex-col gap-3">
          {showReciterScroll ? (
            /* Reciter Selection Phase */
            <>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <label className="text-sm md:text-base text-emerald-700 dark:text-emerald-300 font-medium">{t('reciter')}</label>
              </div>
              {/* Search input */}
              <div className="relative">
                <Search className={cn(
                  'absolute top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600 dark:text-emerald-400',
                  isRTL ? 'right-3' : 'left-3'
                )} />
                <input
                  ref={reciterSearchInputRef}
                  type="text"
                  placeholder={t('searchReciter')}
                  className={cn(
                    'w-full h-9 rounded-md border border-emerald-300 bg-transparent px-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500',
                    isRTL ? 'pr-9 text-right' : 'pl-9 text-left',
                    textSizeClasses.text
                  )}
                />
              </div>

              {/* Unified Reciter scrollable list */}
              <div className="overflow-y-scroll border border-emerald-200 dark:border-emerald-800 rounded-lg max-h-48" style={{ WebkitOverflowScrolling: 'touch' }}>
                {filteredUnifiedReciters.map((reciter, index) => (
                  <button
                    key={reciter.id}
                    onClick={() => {
                      setSelectedUnifiedReciter(reciter);
                      setShowReciterScroll(false);
                    }}
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
                      {/* Source badge only */}
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
            /* Reciter Selected - Show only selected item */
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <label className="text-sm md:text-base text-emerald-700 dark:text-emerald-300 font-medium">{t('reciter')}</label>
              </div>
              <button
                onClick={() => setShowReciterScroll(true)}
                title={t('searchReciter')}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-500/20 dark:bg-emerald-500/20 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors',
                  isRTL ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                <span className="flex-1 font-semibold text-emerald-800 dark:text-emerald-200 text-right">
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
              
              {/* Moshaf Selection (only for mp3quran) */}
              {selectedUnifiedReciter.source === 'mp3quran' && selectedUnifiedReciter.moshaf && selectedUnifiedReciter.moshaf.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm md:text-base text-emerald-700 dark:text-emerald-300">{t('mushafType')}</label>
                  <div className="flex flex-col gap-1 border border-emerald-200 dark:border-emerald-800 rounded-lg overflow-hidden bg-transparent max-h-32 overflow-y-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {selectedUnifiedReciter.moshaf.map((moshaf) => {
                      // Get moshaf name (English or attempt Arabic from API)
                      let displayName = moshaf.name;
                      if (language === 'ar' && selectedUnifiedReciter.mp3QuranId) {
                        const arReciter = mp3QuranRecitersAr.find(r => r.id === selectedUnifiedReciter.mp3QuranId);
                        const arMoshaf = arReciter?.moshaf?.find(m => m.id === moshaf.id);
                        if (arMoshaf && arMoshaf.name) {
                          displayName = arMoshaf.name;
                        }
                      }
                      
                      // Translate common English patterns to Arabic
                      displayName = translateMoshafName(displayName);
                      
                      // Remove duplicate text pattern like "text - text"
                      const parts = displayName.split(' - ');
                      if (parts.length === 2 && parts[0].trim() === parts[1].trim()) {
                        displayName = parts[0].trim();
                      }
                      
                      return (
                        <button
                          key={moshaf.id}
                          onClick={() => setSelectedMoshaf(moshaf)}
                          className={cn(
                            "w-full px-3 py-2.5 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors",
                            selectedMoshaf?.id === moshaf.id && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                            textSizeClasses.text,
                            isRTL ? 'text-right' : 'text-left'
                          )}
                        >
                          <span className="text-emerald-800 dark:text-emerald-200">
                            {displayName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* From/To Surah - Side by Side Scrollable Columns */}
              <div className="flex flex-col">
                {/* Column Headers */}
                <div className="flex gap-2 mb-2">
                  <div className="flex-1 text-center">
                    <h3 className={cn("font-semibold text-emerald-800 dark:text-emerald-200", textSizeClasses.label)}>
                      {t('fromSurah')}
                    </h3>
                  </div>
                  <div className="flex-1 text-center">
                    <h3 className={cn("font-semibold text-emerald-800 dark:text-emerald-200", textSizeClasses.label)}>
                      {t('toSurah')}
                    </h3>
                  </div>
                </div>

                {/* Scrollable Columns */}
                <div className="flex gap-2 max-h-40">
                  {/* From Surah Column */}
                  <div className="flex-1 overflow-y-scroll border border-emerald-200 dark:border-emerald-800 rounded-lg bg-transparent" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {surahs.map((surah) => (
                      <button
                        key={surah.id}
                        onClick={() => {
                          setDownloadFromSurah(surah.id);
                          // Auto-adjust toSurah if it's now less than fromSurah
                          if (downloadToSurah < surah.id) {
                            setDownloadToSurah(surah.id);
                          }
                        }}
                        className={cn(
                          "w-full px-3 py-2.5 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors text-left",
                          downloadFromSurah === surah.id && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                          textSizeClasses.text
                        )}
                      >
                        <span className="text-emerald-800 dark:text-emerald-200">
                          {surah.id}. {isRTL ? surah.name : surah.englishName}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* To Surah Column */}
                  <div className="flex-1 overflow-y-scroll border border-emerald-200 dark:border-emerald-800 rounded-lg bg-transparent" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {surahs.filter(surah => surah.id >= downloadFromSurah).map((surah) => (
                      <button
                        key={surah.id}
                        onClick={() => setDownloadToSurah(surah.id)}
                        className={cn(
                          "w-full px-3 py-2.5 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors text-left",
                          downloadToSurah === surah.id && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                          textSizeClasses.text
                        )}
                      >
                        <span className="text-emerald-800 dark:text-emerald-200">
                          {surah.id}. {isRTL ? surah.name : surah.englishName}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </div>
      )}
      
      {/* Download Progress */}
      {activeDownload && (
        <div className="flex flex-col gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeDownload.status === 'downloading' && (
                <HardDriveDownload className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
              )}
              {activeDownload.status === 'completed' && (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              )}
              {activeDownload.status === 'error' && (
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
              {activeDownload.status === 'cancelled' && (
                <StopCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              )}
              <span className={cn("font-medium text-emerald-700 dark:text-emerald-300", textSizeClasses.text)}>
                {activeDownload.status === 'downloading' && t('downloadProgress')}
                {activeDownload.status === 'completed' && t('downloadComplete')}
                {activeDownload.status === 'error' && t('downloadFailed')}
                {activeDownload.status === 'cancelled' && t('downloadCancelled')}
              </span>
            </div>
            {downloadProgress.total > 0 && (
              <span className={cn("text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
                {downloadProgress.current} / {downloadProgress.total}
              </span>
            )}
          </div>
          
          {activeDownload.status === 'downloading' && downloadProgress.total > 0 && (
            <div className="w-full h-2 bg-emerald-100 dark:bg-emerald-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-300"
                style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
              />
            </div>
          )}
          
          {activeDownload.status === 'completed' && (
            <div className="w-full h-2 bg-emerald-100 dark:bg-emerald-800 rounded-full overflow-hidden">
              <div className="h-full bg-green-600 dark:bg-green-500 w-full" />
            </div>
          )}
          
          {(activeDownload.status === 'completed' || activeDownload.status === 'cancelled' || activeDownload.status === 'error') && (
            <button
              onClick={clearDownload}
              className={cn(
                "mt-1 text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 underline",
                textSizeClasses.label
              )}
            >
              {t('clearDownload')}
            </button>
          )}
        </div>
      )}
      
      {/* Download/Cancel Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleDownload}
          disabled={!isDownloadEnabled || !isOnline || isDownloading}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3 md:px-4 h-10 md:h-12 border border-emerald-600 shadow-md transition-all"
        >
          {!isOnline ? (
            <WifiOff className="w-5 h-5 text-[#F2E3BB]" />
          ) : (
            <HardDriveDownload className="w-5 h-5 text-[#F2E3BB]" />
          )}
          <span className={cn("text-[#F2E3BB] font-bold", textSizeClasses.button)}>
            {!isOnline ? t('networkRequired') : (isDownloading ? t('downloadProgress') : t('startDownload'))}
          </span>
        </button>
        
        {isDownloading && (
          <button
            onClick={handleCancelDownload}
            className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 rounded-lg px-3 md:px-4 h-10 md:h-12 border border-red-500 shadow-md transition-all"
          >
            <StopCircle className="w-5 h-5 text-white" />
            <span className={cn("text-white font-bold", textSizeClasses.button)}>
              {t('cancelDownload')}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
