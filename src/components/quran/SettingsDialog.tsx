import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BookOpen, Book, Navigation, Menu, GraduationCap, Palette, HardDriveDownload, Search, ChevronDown, WifiOff, StopCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMushaf, MushafType } from "@/contexts/MushafContext";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { surahs } from "@/data/surahs";
import { ASSETS_BASE_URL } from "@/config/assets";
import { getAudioData } from "@/lib/quran-data-service";
import { getMp3QuranReciters, getSurahAudioUrl, getAyahTiming, type Mp3QuranReciter, type Mp3QuranMoshaf } from "@/lib/mp3quran-service";
import { cacheAsset } from "@/lib/asset-cache";
import { isMp3QuranAudioCached, cacheMp3QuranAudio } from "@/lib/audio-cache";
import { getPageImageFilename } from "@/lib/quran-mapping";
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

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  viewMode: 'single' | 'double';
  onViewModeChange: (mode: 'single' | 'double') => void;
  pagesToLoad: number;
  onPagesToLoadChange: (pages: number) => void;
  showBottomBarText: boolean;
  onShowBottomBarTextChange: (show: boolean) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  isMobile,
  viewMode,
  onViewModeChange,
  pagesToLoad,
  onPagesToLoadChange,
  showBottomBarText,
  onShowBottomBarTextChange,
}: SettingsDialogProps) {
  const { t, isRTL, language } = useLanguage();
  const { mushafType, setMushafType } = useMushaf();
  const { isOnline } = useNetwork();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<string>(() => {
    const saved = localStorage.getItem('quran-settings-tab');
    return saved || 'mushaf';
  });
  
  // Local state for mushaf selection (only applied on save)
  const [selectedMushaf, setSelectedMushaf] = useState<MushafType>(mushafType);
  const hasUnsavedChanges = selectedMushaf !== mushafType;
  
  // Download state
  const [downloadType, setDownloadType] = useState<'pages' | 'everyayah' | 'mp3quran'>('pages');
  const [downloadMushafType, setDownloadMushafType] = useState<MushafType>(mushafType);
  const [downloadFromPage, setDownloadFromPage] = useState<string | number>(1);
  const [downloadToPage, setDownloadToPage] = useState<string | number>(604);
  const [pageValidationError, setPageValidationError] = useState<string>('');
  const [downloadFromSurah, setDownloadFromSurah] = useState(1);
  const [downloadToSurah, setDownloadToSurah] = useState(114);
  const [downloadFromAyah, setDownloadFromAyah] = useState(1);
  const [downloadToAyah, setDownloadToAyah] = useState(7);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  
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
  
  // AbortController for cancelling downloads
  const downloadAbortControllerRef = React.useRef<AbortController | null>(null);
  
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
  
  // Validate page range
  React.useEffect(() => {
    if (downloadType === 'pages') {
      const fromStr = String(downloadFromPage).trim();
      const toStr = String(downloadToPage).trim();
      
      // Allow empty values while typing
      if (fromStr === '' || toStr === '') {
        setPageValidationError(t('pageRangeError'));
        return;
      }
      
      const fromNum = parseInt(fromStr);
      const toNum = parseInt(toStr);
      
      // Check if values are valid numbers
      if (isNaN(fromNum) || isNaN(toNum)) {
        setPageValidationError(t('pageRangeError'));
        return;
      }
      
      // Check range (1-604)
      if (fromNum < 1 || fromNum > 604 || toNum < 1 || toNum > 604) {
        setPageValidationError(t('pageRangeError'));
        return;
      }
      
      // Check order
      if (fromNum > toNum) {
        setPageValidationError(t('pageOrderError'));
        return;
      }
      
      setPageValidationError('');
    } else {
      setPageValidationError('');
    }
  }, [downloadType, downloadFromPage, downloadToPage, t]);
  
  // Determine if download button should be enabled
  const isDownloadEnabled = (() => {
    if (isDownloading) return false;
    
    if (downloadType === 'pages') {
      return pageValidationError === ''; // Pages need valid range
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
  
  // Load reciters when download tab is active
  useEffect(() => {
    if (activeTab === 'download') {
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
    }
  }, [activeTab]);
  
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
  }, [selectedRecitationStyle, selectedQuality, everyAyahReciters]);

  // Reset selected mushaf when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedMushaf(mushafType);
    }
  }, [open, mushafType]);

  useEffect(() => {
    localStorage.setItem('quran-settings-tab', activeTab);
  }, [activeTab]);
  
  const handleSaveMushaf = () => {
    setMushafType(selectedMushaf);
  };

  const updatePagesToLoad = (pages: number) => {
    onPagesToLoadChange(pages);
    localStorage.setItem('quran-pages-to-load', String(pages));
  };
  
  const handleCancelDownload = () => {
    if (downloadAbortControllerRef.current) {
      downloadAbortControllerRef.current.abort();
      downloadAbortControllerRef.current = null;
    }
    setIsDownloading(false);
    setDownloadProgress({ current: 0, total: 0 });
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
    
    // Create new AbortController for this download session
    downloadAbortControllerRef.current = new AbortController();
    const signal = downloadAbortControllerRef.current.signal;
    
    setIsDownloading(true);
    
    try {
      if (downloadType === 'pages') {
        // Cache mushaf pages
        const total = parseInt(String(downloadToPage)) - parseInt(String(downloadFromPage)) + 1;
        setDownloadProgress({ current: 0, total });
        
        // Get mushaf path based on download mushaf type
        const folder = downloadMushafType === 'mwdoa' 
          ? 'mushuf_mwdoa_images' 
          : downloadMushafType === 'tashel'
          ? 'mushaf_tashel_pages'
          : 'mushaf_madinah_images';
        const mushafPath = `${ASSETS_BASE_URL}/${folder}`;
        const category = `mushaf-${downloadMushafType}`;
        
        for (let page = parseInt(String(downloadFromPage)); page <= parseInt(String(downloadToPage)); page++) {
          if (signal.aborted) break;
          const url = `${mushafPath}/${getPageImageFilename(page)}`;
          await cacheAsset(url, category, signal);
          setDownloadProgress({ current: page - parseInt(String(downloadFromPage)) + 1, total });
        }
      } else if (downloadType === 'everyayah') {
        // Cache EveryAyah audio
        const reciter = everyAyahReciters.find(r => r.folder === selectedEveryAyahReciter);
        if (!reciter) return;
        
        const total = downloadToAyah - downloadFromAyah + 1;
        setDownloadProgress({ current: 0, total });
        const category = `audio-everyayah-${reciter.folder}`;
        
        for (let ayah = downloadFromAyah; ayah <= downloadToAyah; ayah++) {
          if (signal.aborted) break;
          const surahStr = downloadFromSurah.toString().padStart(3, '0');
          const ayahStr = ayah.toString().padStart(3, '0');
          const url = `${reciter.baseUrl}/${surahStr}${ayahStr}.mp3`;
          await cacheAsset(url, category, signal);
          setDownloadProgress({ current: ayah - downloadFromAyah + 1, total });
        }
      } else if (downloadType === 'mp3quran') {
        // Cache MP3Quran full surah audio
        if (!selectedMoshaf) return;
        
        const total = downloadToSurah - downloadFromSurah + 1;
        setDownloadProgress({ current: 0, total });
        const category = `audio-mp3quran-${selectedMoshaf.id}`;
        
        for (let surahNum = downloadFromSurah; surahNum <= downloadToSurah; surahNum++) {
          if (signal.aborted) break;
          
          // Check if this surah is already cached
          const isCached = await isMp3QuranAudioCached(selectedMoshaf.id, surahNum);
          if (isCached) {
            console.log(`⏭️ Skipping surah ${surahNum} - already cached for moshaf ${selectedMoshaf.id}`);
            setDownloadProgress({ current: surahNum - downloadFromSurah + 1, total });
            continue;
          }
          
          console.log(`📥 Downloading surah ${surahNum} for moshaf ${selectedMoshaf.id}`);
          
          try {
            // Download audio file
            const url = getSurahAudioUrl(selectedMoshaf.server, surahNum);
            const response = await fetch(url, { signal });
            if (!response.ok) throw new Error(`Failed to download surah ${surahNum}`);
            const audioBlob = await response.blob();
            
            // Fetch timing data
            let timingData = [];
            try {
              timingData = await getAyahTiming(surahNum, selectedMoshaf.id);
            } catch (timingError) {
              console.warn(`No timing data for surah ${surahNum}, caching without timing`);
            }
            
            // Cache using audio-cache (not asset-cache)
            await cacheMp3QuranAudio(selectedMoshaf.id, surahNum, audioBlob, timingData);
            console.log(`✅ Cached surah ${surahNum} with ${timingData.length} ayah timings`);
          } catch (error: any) {
            if (error.name === 'AbortError') throw error;
            console.error(`Failed to cache surah ${surahNum}:`, error);
          }
          
          setDownloadProgress({ current: surahNum - downloadFromSurah + 1, total });
        }
      }
      
      // Show success toast when download completes
      if (!signal.aborted) {
        toast({
          title: t('downloadComplete'),
          description: t('downloadCompleteMessage'),
        });
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Download cancelled by user');
      } else {
        console.error('Download error:', error);
        toast({
          title: t('downloadFailed'),
          description: error.message || 'An error occurred',
          variant: "destructive",
        });
      }
    } finally {
      downloadAbortControllerRef.current = null;
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "sm:max-w-md md:max-w-lg max-w-[90vw] max-h-[85vh] overflow-y-auto p-0",
          "rounded-xl border-0 bg-[#FBF9F4]",
          isRTL ? "rtl" : "ltr"
        )}
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        <DialogHeader className="bg-gradient-to-b from-emerald-800 to-emerald-600 rounded-t-xl px-4 py-3">
          <DialogTitle className="text-center text-base md:text-xl font-bold text-[#F2E3BB]">
            {t('settings')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-11 md:h-12 bg-emerald-100 dark:bg-emerald-900/30">
              <TabsTrigger 
                value="mushaf" 
                className="text-sm md:text-base data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB] px-1"
              >
                <BookOpen className="w-3 h-3 md:w-4 md:h-4 mr-0.5 md:mr-1" />
                {isRTL ? 'المصحف' : 'Mushaf'}
              </TabsTrigger>
              <TabsTrigger 
                value="download" 
                className="text-sm md:text-base data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB] px-1"
              >
                <HardDriveDownload className="w-3 h-3 md:w-4 md:h-4 mr-0.5 md:mr-1" />
                {t('download')}
              </TabsTrigger>
              <TabsTrigger 
                value="test" 
                className="text-sm md:text-base data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB] px-1"
              >
                <GraduationCap className="w-3 h-3 md:w-4 md:h-4 mr-0.5 md:mr-1" />
                {isRTL ? 'اختبار' : 'Test'}
              </TabsTrigger>
              <TabsTrigger 
                value="style" 
                className="text-sm md:text-base data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB] px-1"
              >
                <Palette className="w-3 h-3 md:w-4 md:h-4 mr-0.5 md:mr-1" />
                {isRTL ? 'العرض' : 'Style'}
              </TabsTrigger>
            </TabsList>

            {/* Mushaf Tab */}
            <TabsContent value="mushaf" className="space-y-4 mt-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-300">{t('mushafType')}</span>
                </div>
                <Select value={selectedMushaf} onValueChange={(value) => setSelectedMushaf(value as MushafType)}>
                  <SelectTrigger className="w-full text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
                    <SelectItem value="mwdoa" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('mushafMwdoa')}</SelectItem>
                    <SelectItem value="tashel" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('mushafTashel')}</SelectItem>
                    <SelectItem value="madinah" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('mushafMadinah')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Save Button - always visible, disabled when no changes */}
              <button
                onClick={handleSaveMushaf}
                disabled={!hasUnsavedChanges}
                className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3 md:px-4 h-10 md:h-12 border border-emerald-600 shadow-md transition-all"
              >
                <span className="text-[#F2E3BB] text-base md:text-xl font-bold">
                  {isRTL ? 'حفظ' : 'Save'}
                </span>
              </button>
            </TabsContent>

            {/* Style Tab */}
            <TabsContent value="style" className="space-y-4 mt-4">
              {/* View Mode Setting - Hide on mobile */}
              {!isMobile && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Book className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-300">{isRTL ? 'وضع العرض' : 'View Mode'}</span>
                  </div>
                  <button
                    onClick={() => onViewModeChange(viewMode === 'single' ? 'double' : 'single')}
                    className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 rounded-lg px-3 md:px-4 h-8 md:h-10 border border-emerald-600 shadow-md transition-all text-base md:text-xl"
                  >
                    <span className="text-[#F2E3BB] font-bold">
                      {viewMode === 'single' ? (isRTL ? 'صفحتين' : '2 Pages') : (isRTL ? 'صفحة' : '1 Page')}
                    </span>
                  </button>
                </div>
              )}

              {/* Pages to Load Setting - Only show in single page mode or mobile */}
              {(viewMode === 'single' || isMobile) && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Navigation className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-300">
                      {isRTL ? 'الصفحات المحملة' : 'Swipe Sensitivity'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => pagesToLoad > 1 && updatePagesToLoad(pagesToLoad - 1)}
                        disabled={pagesToLoad <= 1}
                        className="flex items-center justify-center bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg h-10 md:h-12 w-10 md:w-12 border border-emerald-600 shadow-md transition-all"
                      >
                        <span className="text-[#F2E3BB] text-xl md:text-2xl font-bold">-</span>
                      </button>
                      <div className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-white dark:bg-emerald-950 rounded-md border border-emerald-300 dark:border-emerald-700">
                        <span className="text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-200">{pagesToLoad}</span>
                        <span className="text-base md:text-xl text-emerald-600 dark:text-emerald-400">
                          {pagesToLoad === 1 ? (isRTL ? 'صفحة' : 'page') : (isRTL ? 'صفحات' : 'pages')}
                        </span>
                      </div>
                      <button
                        onClick={() => pagesToLoad < 5 && updatePagesToLoad(pagesToLoad + 1)}
                        disabled={pagesToLoad >= 5}
                        className="flex items-center justify-center bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg h-10 md:h-12 w-10 md:w-12 border border-emerald-600 shadow-md transition-all"
                      >
                        <span className="text-[#F2E3BB] text-xl md:text-2xl font-bold">+</span>
                      </button>
                    </div>
                    <p className="text-base md:text-xl text-emerald-600 dark:text-emerald-400">
                      {isRTL 
                        ? 'يحدد عدد الصفحات التي يمكنك التمرير إليها بحركة واحدة' 
                        : 'Controls how many pages you can swipe at once'}
                    </p>
                  </div>
                </div>
              )}

              {/* Bottom Bar Text Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Menu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-300">
                    {isRTL ? 'إظهار نص الشريط السفلي' : 'Show Bottom Bar Text'}
                  </span>
                </div>
                <div dir="ltr">
                  <Switch
                    checked={showBottomBarText}
                    onCheckedChange={(checked) => {
                      onShowBottomBarTextChange(checked);
                      localStorage.setItem('quran-show-bottom-bar-text', String(checked));
                    }}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Download Tab */}
            <TabsContent value="download" className="space-y-4 mt-4">
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
                  <span className="text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-300">
                    {t('downloadType')}
                  </span>
                </div>
                <Select value={downloadType} onValueChange={(value) => setDownloadType(value as 'pages' | 'everyayah' | 'mp3quran')}>
                  <SelectTrigger className="w-full text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
                    <SelectItem value="pages" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900">
                      {t('downloadMushafPages')}
                    </SelectItem>
                    {/* Temporarily hidden - EveryAyah download option
                    <SelectItem value="everyayah" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900">
                      {t('downloadEveryAyahAudio')}
                    </SelectItem>
                    */}
                    <SelectItem value="mp3quran" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900">
                      {t('downloadMp3QuranAudio')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Pages Download Options */}
              {downloadType === 'pages' && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm md:text-base text-emerald-700 dark:text-emerald-300">{t('mushafType')}</label>
                    <Select value={downloadMushafType} onValueChange={(value) => setDownloadMushafType(value as MushafType)}>
                      <SelectTrigger className="w-full text-base md:text-lg border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
                        <SelectItem value="mwdoa" className="text-base focus:bg-emerald-100 focus:text-emerald-900">{t('mushafMwdoa')}</SelectItem>
                        <SelectItem value="tashel" className="text-base focus:bg-emerald-100 focus:text-emerald-900">{t('mushafTashel')}</SelectItem>
                        <SelectItem value="madinah" className="text-base focus:bg-emerald-100 focus:text-emerald-900">{t('mushafMadinah')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-sm md:text-base text-emerald-700 dark:text-emerald-300 block mb-1">{t('fromPage')}</label>
                      <input
                        type="number"
                        min={1}
                        max={604}
                        value={downloadFromPage}
                        onChange={(e) => setDownloadFromPage(e.target.value)}
                        className="w-full px-3 py-2 text-base md:text-lg border border-emerald-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-sm md:text-base text-emerald-700 dark:text-emerald-300 block mb-1">{t('toPage')}</label>
                      <input
                        type="number"
                        min={1}
                        max={604}
                        value={downloadToPage}
                        onChange={(e) => setDownloadToPage(e.target.value)}
                        className="w-full px-3 py-2 text-base md:text-lg border border-emerald-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
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
                  </div>
                </div>
              )}
              
              {/* Download Progress */}
              {isDownloading && downloadProgress.total > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm md:text-base text-emerald-700">
                    <span>{t('downloadProgress')}</span>
                    <span>{downloadProgress.current} / {downloadProgress.total}</span>
                  </div>
                  <div className="w-full h-2 bg-emerald-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-600 transition-all duration-300"
                      style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Validation Error Message */}
              {pageValidationError && (
                <div className="text-sm md:text-base text-red-600 dark:text-red-400 text-center font-medium bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
                  {pageValidationError}
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
                  <span className="text-[#F2E3BB] text-base md:text-xl font-bold">
                    {!isOnline ? t('networkRequired') : (isDownloading ? t('downloadProgress') : t('startDownload'))}
                  </span>
                </button>
                
                {isDownloading && (
                  <button
                    onClick={handleCancelDownload}
                    className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 rounded-lg px-3 md:px-4 h-10 md:h-12 border border-red-500 shadow-md transition-all"
                  >
                    <StopCircle className="w-5 h-5 text-white" />
                    <span className="text-white text-base md:text-xl font-bold">
                      {t('cancelDownload')}
                    </span>
                  </button>
                )}
              </div>
            </TabsContent>

            {/* Test Tab */}
            <TabsContent value="test" className="space-y-4 mt-4">
              <div className="flex flex-col gap-3">
                <p className="text-base md:text-xl text-emerald-700 dark:text-emerald-300">
                  {isRTL 
                    ? 'اختبر حفظك للقرآن الكريم من خلال تمارين تفاعلية.'
                    : 'Test your Quran memorization with interactive exercises.'}
                </p>
                <Link to="/test" className="block">
                  <button
                    onClick={() => onOpenChange(false)}
                    className="w-full flex items-center justify-center gap-2 sm:gap-3 bg-emerald-700 hover:bg-emerald-800 rounded-lg px-3 md:px-4 h-10 md:h-12 border border-emerald-600 shadow-md transition-all"
                  >
                    <GraduationCap className="w-5 h-5 md:w-6 md:h-6 text-[#F2E3BB]" />
                    <span className="text-[#F2E3BB] text-base md:text-xl font-bold">
                      {t('testFeature')}
                    </span>
                  </button>
                </Link>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
