import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { Mp3QuranReciter, Mp3QuranMoshaf } from "@/lib/mp3quran-service";
import { surahs } from "@/data/surahs";

interface ReciterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  
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

export function ReciterDialog({
  open,
  onOpenChange,
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
}: ReciterDialogProps) {
  const { t, isRTL, language } = useLanguage();
  const [everyAyahSearch, setEveryAyahSearch] = useState('');
  const [mp3QuranSearch, setMp3QuranSearch] = useState('');
  const [selectedSurahForPlayback, setSelectedSurahForPlayback] = useState(currentSurahId);
  const [selectedAyahForPlayback, setSelectedAyahForPlayback] = useState(currentPlayingAyah?.ayah || 1);
  
  // Dropdown visibility state
  const [showEveryAyahDropdown, setShowEveryAyahDropdown] = useState(false);
  const [showMp3QuranDropdown, setShowMp3QuranDropdown] = useState(false);
  const everyAyahRef = useRef<HTMLDivElement>(null);
  const mp3QuranRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (everyAyahRef.current && !everyAyahRef.current.contains(event.target as Node)) {
        setShowEveryAyahDropdown(false);
      }
      if (mp3QuranRef.current && !mp3QuranRef.current.contains(event.target as Node)) {
        setShowMp3QuranDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update selected surah/ayah when current changes
  useEffect(() => {
    setSelectedSurahForPlayback(currentSurahId);
    setSelectedAyahForPlayback(currentPlayingAyah?.ayah || 1);
  }, [currentSurahId, currentPlayingAyah]);

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
    
    // Special case for specific patterns
    if (nameLower.includes("almusshaf al mo'lim - almusshaf al mo'lim")) {
      return t('muallim');
    } else if (nameLower.includes("almusshaf al mojawwad - almusshaf al mojawwad")) {
      return t('mujawwad');
    }
    
    // Check for common recitation types
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "sm:max-w-md md:max-w-lg lg:max-w-xl max-w-[90vw] max-h-[85vh] overflow-y-auto p-0",
          "rounded-xl border-0 bg-[#FBF9F4]",
          isRTL ? "rtl" : "ltr"
        )}
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        <DialogHeader className="bg-gradient-to-b from-emerald-800 to-emerald-600 rounded-t-xl px-4 py-3">
          <DialogTitle className="text-center text-base md:text-xl font-bold text-[#F2E3BB]">
            {t('selectReciter')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-4 space-y-3">
          {/* Audio Source Tabs */}
          <Tabs value={audioSource} onValueChange={(value) => onAudioSourceChange(value as 'everyayah' | 'mp3quran')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-11 md:h-12 bg-emerald-100 dark:bg-emerald-900/30">
              <TabsTrigger value="everyayah" className="text-base md:text-xl data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB]">
                {t('everyAyah')}
              </TabsTrigger>
              <TabsTrigger value="mp3quran" className="text-base md:text-xl data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB]">
                {t('mp3Quran')}
              </TabsTrigger>
            </TabsList>

            {/* Tab Explanation Text */}
            <div className="mt-3 mb-2 px-2 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
              <p className={cn(
                "text-sm md:text-base text-emerald-700 dark:text-emerald-300",
                isRTL ? "text-right" : "text-left"
              )}>
                {audioSource === 'everyayah' ? t('everyAyahExplanation') : t('mp3QuranExplanation')}
              </p>
            </div>

            {/* EveryAyah Tab Content */}
            <TabsContent value="everyayah" className="space-y-2 sm:space-y-3 mt-3">
          {/* Reciter Name Search Box */}
          <div className="flex flex-col gap-2" ref={everyAyahRef}>
            <span className="font-medium text-base md:text-xl text-emerald-800 dark:text-emerald-300">
              {t('reciterName')}
            </span>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600 dark:text-emerald-400 z-10" />
                <Input
                  placeholder={t('searchReciter')}
                  value={getEveryAyahDisplayValue()}
                  onChange={(e) => {
                    setEveryAyahSearch(e.target.value);
                    setShowEveryAyahDropdown(true);
                  }}
                  onFocus={() => {
                    setEveryAyahSearch('');
                    setShowEveryAyahDropdown(true);
                  }}
                  className="pl-10 pr-10 border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 text-base md:text-lg bg-emerald-50 dark:bg-emerald-900/20"
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              
              {/* Dropdown Results */}
              {showEveryAyahDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-[#FBF9F4] dark:bg-emerald-950 border border-emerald-300 rounded-lg shadow-lg max-h-[250px] overflow-y-auto">
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

          {/* Show other options only after selection */}
          {filterReciterName && filterReciterName !== 'all' && (
            <>
          
              {/* Reading Type Filter */}
              <div className="flex flex-col gap-2">
                <span className="font-medium text-base md:text-xl text-emerald-800 dark:text-emerald-300">
                  {t('readingType')}
                </span>
                <Select value={filterReading} onValueChange={onFilterReadingChange} modal={false}>
                  <SelectTrigger className="w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 touch-manipulation">
                    <SelectValue />
                  </SelectTrigger>
              <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950 z-[100]" position="popper" sideOffset={5}>
                {filterReciterName === 'all' && <SelectItem value="all" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">{t('all')}</SelectItem>}
                {availableReadings.includes('hafs') && <SelectItem value="hafs" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">{t('hafs')}</SelectItem>}
                {availableReadings.includes('warsh') && <SelectItem value="warsh" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">{t('warsh')}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          
          {/* Recitation Style Filter */}
          <div className="flex flex-col gap-2">
            <span className="font-medium text-base md:text-xl text-emerald-800 dark:text-emerald-300">
              {t('recitationStyle')}
            </span>
            <Select value={filterStyle} onValueChange={onFilterStyleChange} modal={false}>
              <SelectTrigger className="w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 touch-manipulation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950 z-[100]" position="popper" sideOffset={5}>
                {filterReciterName === 'all' && <SelectItem value="all" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">{t('all')}</SelectItem>}
                {availableStyles.includes('murattal') && <SelectItem value="murattal" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">{t('murattal')}</SelectItem>}
                {availableStyles.includes('mujawwad') && <SelectItem value="mujawwad" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">{t('mujawwad')}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          
          {/* Quality Filter */}
          <div className="flex flex-col gap-2">
            <span className="font-medium text-base md:text-xl text-emerald-800 dark:text-emerald-300">
              {t('quality')}
            </span>
            <Select value={filterQuality} onValueChange={onFilterQualityChange} modal={false}>
              <SelectTrigger className="w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 touch-manipulation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950 z-[100]" position="popper" sideOffset={5}>
                {filterReciterName === 'all' && <SelectItem value="all" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">{t('all')}</SelectItem>}
                {availableQualities.includes('192kbps') && <SelectItem value="192kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">192kbps</SelectItem>}
                {availableQualities.includes('128kbps') && <SelectItem value="128kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">128kbps</SelectItem>}
                {availableQualities.includes('64kbps') && <SelectItem value="64kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">64kbps</SelectItem>}
                {availableQualities.includes('48kbps') && <SelectItem value="48kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">48kbps</SelectItem>}
                {availableQualities.includes('40kbps') && <SelectItem value="40kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">40kbps</SelectItem>}
                {availableQualities.includes('32kbps') && <SelectItem value="32kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">32kbps</SelectItem>}
                {availableQualities.includes('16kbps') && <SelectItem value="16kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation">16kbps</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* Separator */}
          <div className="border-t border-emerald-200 dark:border-emerald-700 my-2"></div>

          {/* Ayah and Surah Selection */}
          <div className="grid grid-cols-2 gap-2">
            {/* Ayah Selection */}
            <div className="flex flex-col gap-2">
              <span className="font-medium text-base md:text-xl text-emerald-800 dark:text-emerald-300">
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
                        className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100"
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
              <span className="font-medium text-base md:text-xl text-emerald-800 dark:text-emerald-300">
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
                        className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100"
                      >
                        {language === 'ar' ? `${surah.id}. ${surah.name}` : `${surah.id}. ${surah.englishName}`}
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>
          </div>

              {/* Save Button for EveryAyah */}
              <div className="pt-2 sm:pt-3 mt-2">
                <Button
                  onClick={async () => {
                    onListen();
                    await onNavigateToSurah(selectedSurahForPlayback);
                  }}
                  disabled={!selectedReciter && filteredReciters.length === 0}
                  className="w-full text-base md:text-xl bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('save')}
                </Button>
              </div>
            </>
          )}
            </TabsContent>

            {/* MP3Quran Tab Content */}
            <TabsContent value="mp3quran" className="space-y-2 sm:space-y-3 mt-3">
              {/* Reciter Search Box */}
              <div className="flex flex-col gap-2" ref={mp3QuranRef}>
                <span className="font-medium text-base md:text-xl text-emerald-800 dark:text-emerald-300">
                  {t('reciterName')}
                </span>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600 dark:text-emerald-400 z-10" />
                    <Input
                      placeholder={t('searchReciter')}
                      value={getMp3QuranDisplayValue()}
                      onChange={(e) => {
                        setMp3QuranSearch(e.target.value);
                        setShowMp3QuranDropdown(true);
                      }}
                      onFocus={() => {
                        setMp3QuranSearch('');
                        setShowMp3QuranDropdown(true);
                      }}
                      className="pl-10 pr-10 border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 text-base md:text-lg bg-emerald-50 dark:bg-emerald-900/20"
                    />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  
                  {/* Dropdown Results */}
                  {showMp3QuranDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-[#FBF9F4] dark:bg-emerald-950 border border-emerald-300 rounded-lg shadow-lg max-h-[250px] overflow-y-auto">
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

              {/* Show other options only after selection */}
              {selectedMp3QuranReciter && (
                <>

              {/* Moshaf/Recitation Type Selection */}
              {selectedMp3QuranReciter.moshaf.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="font-medium text-base md:text-xl text-emerald-800 dark:text-emerald-300">
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
                          className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation"
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
                <span className="font-medium text-base md:text-xl text-emerald-800 dark:text-emerald-300">
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
                          className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100 touch-manipulation"
                        >
                          {language === 'ar' ? `${surah.id}. ${surah.name}` : `${surah.id}. ${surah.englishName}`}
                        </SelectItem>
                      ))}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              {/* Save Button for MP3Quran */}
              <div className="pt-2 sm:pt-3 mt-2">
                <Button
                  onClick={async () => {
                    onListen();
                    await onNavigateToSurah(selectedSurahForPlayback);
                  }}
                  disabled={!selectedMp3QuranReciter || !selectedMoshaf}
                  className="w-full text-base md:text-xl bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('save')}
                </Button>
              </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
