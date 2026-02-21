import React, { useState, useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { HardDriveDownload, Search, ChevronDown, WifiOff, StopCircle, CheckCircle2, XCircle } from "lucide-react";
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

interface Reciter {
  folder: string;
  name: string;
  nameAr: string;
  baseUrl: string;
  reading: string;
  style: string;
  quality: string;
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
  const [selectedEveryAyahReciter, setSelectedEveryAyahReciter] = useState<string>('');
  const [selectedRecitationStyle, setSelectedRecitationStyle] = useState<string>('__all__');
  const [selectedQuality, setSelectedQuality] = useState<string>('__all__');
  const [mp3QuranReciters, setMp3QuranReciters] = useState<Mp3QuranReciter[]>([]);
  const [mp3QuranRecitersAr, setMp3QuranRecitersAr] = useState<Mp3QuranReciter[]>([]);
  const [selectedMp3QuranReciter, setSelectedMp3QuranReciter] = useState<number | null>(null);
  const [selectedMoshaf, setSelectedMoshaf] = useState<Mp3QuranMoshaf | null>(null);
  
  // Search state for reciter dropdowns
  const [everyAyahSearch, setEveryAyahSearch] = useState('');
  const [mp3QuranSearch, setMp3QuranSearch] = useState('');
  const [showEveryAyahDropdown, setShowEveryAyahDropdown] = useState(false);
  const [showMp3QuranDropdown, setShowMp3QuranDropdown] = useState(false);
  const everyAyahContainerRef = useRef<HTMLDivElement>(null);
  const mp3QuranContainerRef = useRef<HTMLDivElement>(null);
  const everyAyahInputRef = useRef<HTMLInputElement>(null);
  const mp3QuranInputRef = useRef<HTMLInputElement>(null);
  const everyAyahPollingRef = useRef<NodeJS.Timeout | null>(null);
  const mp3QuranPollingRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track previous download status to detect transitions
  const prevDownloadStatusRef = useRef<string | null>(null);
  
  // Get the selected reciter object
  const selectedReciterObj = everyAyahReciters.find(r => r.folder === selectedEveryAyahReciter);
  
  // Get reciters matching the selected reciter name (same reciter can have different styles/qualities)
  const recitersMatchingName = selectedReciterObj 
    ? everyAyahReciters.filter(r => r.nameAr === selectedReciterObj.nameAr)
    : everyAyahReciters;
  
  // Get unique styles based on selected reciter name
  const uniqueStyles = selectedEveryAyahReciter
    ? [...new Set(recitersMatchingName.map(r => r.style).filter(Boolean))]
    : [...new Set(everyAyahReciters.map(r => r.style).filter(Boolean))];
  
  // Get reciters matching reciter name AND selected style (for quality filtering)
  const recitersMatchingNameAndStyle = selectedRecitationStyle === '__all__'
    ? recitersMatchingName
    : recitersMatchingName.filter(r => r.style === selectedRecitationStyle);
  
  // Get unique qualities based on selected reciter AND style
  const uniqueQualities = [...new Set(recitersMatchingNameAndStyle.map(r => r.quality).filter(Boolean))].sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    return numA - numB;
  });
  
  // Filter reciters based on selected style and quality (for final reciter selection)
  const filteredEveryAyahReciters = everyAyahReciters.filter(r => {
    if (selectedRecitationStyle !== '__all__' && r.style !== selectedRecitationStyle) return false;
    if (selectedQuality !== '__all__' && r.quality !== selectedQuality) return false;
    return true;
  });
  
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
  
  // Get unique reciter names (deduplicated by nameAr)
  const uniqueReciterNames = everyAyahReciters.reduce((acc, reciter) => {
    if (!acc.find(r => r.nameAr === reciter.nameAr)) {
      acc.push(reciter);
    }
    return acc;
  }, [] as Reciter[]);
  
  // Get Arabic name for MP3Quran reciter
  const getMp3QuranReciterName = (reciter: Mp3QuranReciter) => {
    const arReciter = mp3QuranRecitersAr.find(r => r.id === reciter.id);
    return arReciter ? arReciter.name : reciter.name;
  };
  
  // Get display value for EveryAyah search input
  const getEveryAyahDisplayValue = () => {
    if (showEveryAyahDropdown) return everyAyahSearch;
    if (selectedEveryAyahReciter) {
      const reciter = everyAyahReciters.find(r => r.folder === selectedEveryAyahReciter);
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
      const reciter = mp3QuranReciters.find(r => r.id === selectedMp3QuranReciter);
      if (reciter) {
        return getMp3QuranReciterName(reciter);
      }
    }
    return '';
  };
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (everyAyahContainerRef.current && !everyAyahContainerRef.current.contains(target)) {
        setShowEveryAyahDropdown(false);
      }
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
      }, 100);
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
      }, 100);
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
  
  // Determine if download button should be enabled
  const isDownloadEnabled = (() => {
    if (isDownloading) return false;
    
    if (downloadType === 'pages') {
      return true; // Pages just need a range
    } else if (downloadType === 'everyayah') {
      // Need reciter, style, and quality all selected (not __all__)
      return selectedEveryAyahReciter !== '' && 
             selectedRecitationStyle !== '__all__' && 
             selectedQuality !== '__all__';
    } else if (downloadType === 'mp3quran') {
      return selectedMp3QuranReciter !== null && selectedMoshaf !== null;
    }
    return false;
  })();
  
  // Load reciters when component mounts
  useEffect(() => {
    // Load EveryAyah reciters
    getAudioData().then((data) => {
      setEveryAyahReciters(data);
      if (data.length > 0 && !selectedEveryAyahReciter) {
        setSelectedEveryAyahReciter(data[0].folder);
      }
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
  
  // Update max ayahs when surah changes
  useEffect(() => {
    const surah = surahs.find(s => s.id === downloadFromSurah);
    if (surah) {
      setDownloadToAyah(surah.numberOfAyahs);
    }
  }, [downloadFromSurah]);

  // Auto-update reciter selection when style/quality changes and current selection doesn't match
  useEffect(() => {
    if (!selectedEveryAyahReciter) return;
    
    const currentReciter = everyAyahReciters.find(r => r.folder === selectedEveryAyahReciter);
    if (!currentReciter) return;
    
    const styleMatches = selectedRecitationStyle === '__all__' || currentReciter.style === selectedRecitationStyle;
    const qualityMatches = selectedQuality === '__all__' || currentReciter.quality === selectedQuality;
    
    if (!styleMatches || !qualityMatches) {
      // Find a matching reciter with same name
      const matchingReciter = everyAyahReciters.find(r => 
        r.nameAr === currentReciter.nameAr &&
        (selectedRecitationStyle === '__all__' || r.style === selectedRecitationStyle) &&
        (selectedQuality === '__all__' || r.quality === selectedQuality)
      );
      
      if (matchingReciter) {
        setSelectedEveryAyahReciter(matchingReciter.folder);
      }
    }
  }, [selectedRecitationStyle, selectedQuality, everyAyahReciters, selectedEveryAyahReciter]);
  
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
      const reciter = everyAyahReciters.find(r => r.folder === selectedEveryAyahReciter);
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
      if (!selectedMoshaf) return;
      
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
        <Select value={downloadType} onValueChange={(value) => setDownloadType(value as 'pages' | 'everyayah' | 'mp3quran')}>
          <SelectTrigger className={cn("w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500", textSizeClasses.text)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
            <SelectItem value="pages" className={cn("focus:bg-emerald-100 focus:text-emerald-900", textSizeClasses.text)}>
              {t('downloadMushafPages')}
            </SelectItem>
            {/* Temporarily hidden - EveryAyah download option
            <SelectItem value="everyayah" className={cn("focus:bg-emerald-100 focus:text-emerald-900", textSizeClasses.text)}>
              {t('downloadEveryAyahAudio')}
            </SelectItem>
            */}
            <SelectItem value="mp3quran" className={cn("focus:bg-emerald-100 focus:text-emerald-900", textSizeClasses.text)}>
              {t('downloadMp3QuranAudio')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Pages Download Options */}
      {downloadType === 'pages' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className={cn("text-emerald-700 dark:text-emerald-300", textSizeClasses.label)}>{t('mushafType')}</label>
            <Select value={downloadMushafType} onValueChange={(value) => setDownloadMushafType(value as MushafType)}>
              <SelectTrigger className={cn("w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500", textSizeClasses.text)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
                <SelectItem value="mwdoa" className={cn("focus:bg-emerald-100 focus:text-emerald-900", textSizeClasses.text)}>{t('mushafMwdoa')}</SelectItem>
                <SelectItem value="tashel" className={cn("focus:bg-emerald-100 focus:text-emerald-900", textSizeClasses.text)}>{t('mushafTashel')}</SelectItem>
                <SelectItem value="madinah" className={cn("focus:bg-emerald-100 focus:text-emerald-900", textSizeClasses.text)}>{t('mushafMadinah')}</SelectItem>
              </SelectContent>
            </Select>
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
          {/* Reciter Name Search Box */}
          <div className="flex flex-col gap-2" ref={everyAyahContainerRef}>
            <label className="text-sm md:text-base text-emerald-700 dark:text-emerald-300">{t('reciter')}</label>
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
                  const target = e.target as HTMLInputElement;
                  setEveryAyahSearch(target.value);
                }}
                onKeyUp={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.value !== everyAyahSearch) {
                    setEveryAyahSearch(target.value);
                  }
                }}
                onFocus={() => {
                  setEveryAyahSearch('');
                  setShowEveryAyahDropdown(true);
                }}
                className="pl-10 pr-10 border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 text-base md:text-lg bg-emerald-50 dark:bg-emerald-900/20"
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
                      key={reciter.folder}
                      className="px-4 py-2 hover:bg-emerald-100 dark:hover:bg-emerald-800 cursor-pointer border-b border-emerald-100 last:border-none"
                      onClick={() => {
                        setSelectedEveryAyahReciter(reciter.folder);
                        setShowEveryAyahDropdown(false);
                      }}
                    >
                      <div className={cn("flex items-center gap-2 w-full text-base md:text-xl", language === 'ar' && "flex-row-reverse text-right")}>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{index + 1}.</span>
                        <span className="flex-1">{language === 'ar' ? reciter.nameAr : reciter.name}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
          </div>
          
          {/* Recitation Style */}
          <div className="flex flex-col gap-2">
            <label className="text-sm md:text-base text-emerald-700 dark:text-emerald-300">{t('recitationStyle')}</label>
            <Select value={selectedRecitationStyle} onValueChange={(v) => {
              setSelectedRecitationStyle(v);
              // Reset quality selection when style changes (reciter stays)
              setSelectedQuality('__all__');
            }}>
              <SelectTrigger className="w-full text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 touch-manipulation">
                <SelectValue placeholder={isRTL ? 'الكل' : 'All'} />
              </SelectTrigger>
              <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950 max-h-60 z-[100]" position="popper" sideOffset={5}>
                <SelectItem value="__all__" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">
                  {isRTL ? 'الكل' : 'All'}
                </SelectItem>
                {uniqueStyles.map((style) => (
                  <SelectItem key={style} value={style} className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">
                    {style === 'murattal' ? (isRTL ? 'مرتل' : 'Murattal') : 
                     style === 'mujawwad' ? (isRTL ? 'مجود' : 'Mujawwad') :
                     style === 'muallim' ? (isRTL ? 'معلم' : 'Muallim') : style}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Quality */}
          <div className="flex flex-col gap-2">
            <label className="text-sm md:text-base text-emerald-700 dark:text-emerald-300">{t('quality')}</label>
            <Select value={selectedQuality} onValueChange={setSelectedQuality}>
              <SelectTrigger className="w-full text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 touch-manipulation">
                <SelectValue placeholder={isRTL ? 'الكل' : 'All'} />
              </SelectTrigger>
              <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950 max-h-60 z-[100]" position="popper" sideOffset={5}>
                <SelectItem value="__all__" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">
                  {isRTL ? 'الكل' : 'All'}
                </SelectItem>
                {uniqueQualities.map((quality) => (
                  <SelectItem key={quality} value={quality} className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">
                    {quality}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm md:text-base text-emerald-700 dark:text-emerald-300">{t('selectSurah')}</label>
            <Select value={String(downloadFromSurah)} onValueChange={(v) => setDownloadFromSurah(parseInt(v))}>
              <SelectTrigger className="w-full text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 touch-manipulation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950 max-h-60 z-[100]" position="popper" sideOffset={5}>
                {surahs.map((surah) => (
                  <SelectItem key={surah.id} value={String(surah.id)} className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">
                    {surah.id}. {isRTL ? surah.name : surah.englishName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        </div>
      )}
      
      {/* MP3Quran Download Options */}
      {downloadType === 'mp3quran' && (
        <div className="flex flex-col gap-3">
          {/* Reciter Name Search Box */}
          <div className="flex flex-col gap-2" ref={mp3QuranContainerRef}>
            <label className="text-sm md:text-base text-emerald-700 dark:text-emerald-300">{t('reciter')}</label>
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
                  const target = e.target as HTMLInputElement;
                  setMp3QuranSearch(target.value);
                }}
                onKeyUp={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.value !== mp3QuranSearch) {
                    setMp3QuranSearch(target.value);
                  }
                }}
                onFocus={() => {
                  setMp3QuranSearch('');
                  setShowMp3QuranDropdown(true);
                }}
                className="pl-10 pr-10 border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 text-base md:text-lg bg-emerald-50 dark:bg-emerald-900/20"
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
                        setSelectedMp3QuranReciter(reciter.id);
                        setShowMp3QuranDropdown(false);
                      }}
                    >
                      <div className="flex items-center gap-2 w-full flex-row-reverse text-right text-base md:text-xl">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{index + 1}.</span>
                        <span className="flex-1">{getMp3QuranReciterName(reciter)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-sm md:text-base text-emerald-700 dark:text-emerald-300 block mb-1">{t('fromSurah')}</label>
              <Select value={String(downloadFromSurah)} onValueChange={(v) => {
                const newFromSurah = parseInt(v);
                setDownloadFromSurah(newFromSurah);
                // Auto-adjust toSurah if it's now less than fromSurah
                if (downloadToSurah < newFromSurah) {
                  setDownloadToSurah(newFromSurah);
                }
              }}>
                <SelectTrigger className="w-full text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 touch-manipulation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950 max-h-60 z-[100]" position="popper" sideOffset={5}>
                  {surahs.map((surah) => (
                    <SelectItem key={surah.id} value={String(surah.id)} className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">
                      {surah.id}. {isRTL ? surah.name : surah.englishName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm md:text-base text-emerald-700 dark:text-emerald-300 block mb-1">{t('toSurah')}</label>
              <Select value={String(downloadToSurah)} onValueChange={(v) => setDownloadToSurah(parseInt(v))}>
                <SelectTrigger className="w-full text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 touch-manipulation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950 max-h-60 z-[100]" position="popper" sideOffset={5}>
                  {surahs.filter(surah => surah.id >= downloadFromSurah).map((surah) => (
                    <SelectItem key={surah.id} value={String(surah.id)} className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">
                      {surah.id}. {isRTL ? surah.name : surah.englishName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
      <div className="flex gap-2">
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
