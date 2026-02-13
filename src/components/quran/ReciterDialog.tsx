import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { Mp3QuranReciter, Mp3QuranMoshaf } from "@/lib/mp3quran-service";

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
  onListen,
}: ReciterDialogProps) {
  const { t, isRTL, language } = useLanguage();
  const [openEveryAyahReciter, setOpenEveryAyahReciter] = useState(false);
  const [openMp3QuranReciter, setOpenMp3QuranReciter] = useState(false);

  // Normalize Arabic text - convert all alif variants to plain alif
  const normalizeArabic = (text: string): string => {
    return text
      // Normalize alif variants (أ إ آ ٱ) to plain alif (ا)
      .replace(/[أإآٱ]/g, 'ا')
      // Remove tashkeel/diacritics
      .replace(/[\u064B-\u065F\u0670]/g, '')
      // Remove tatweel
      .replace(/\u0640/g, '')
      .toLowerCase();
  };

  // Custom filter for Arabic text search
  const arabicFilter = (value: string, search: string): number => {
    if (!search || !search.trim()) return 1;
    const normalizedValue = normalizeArabic(value.trim());
    const normalizedSearch = normalizeArabic(search.trim());
    // Check if the value contains the full search string
    return normalizedValue.includes(normalizedSearch) ? 1 : 0;
  };

  // Get Arabic name for MP3Quran reciter
  const getMp3QuranReciterName = (reciter: Mp3QuranReciter) => {
    const arReciter = mp3QuranRecitersAr.find(r => r.id === reciter.id);
    return arReciter ? arReciter.name : reciter.name;
  };

  // Get display name for selected MP3Quran reciter
  const selectedMp3QuranReciterName = selectedMp3QuranReciter 
    ? getMp3QuranReciterName(selectedMp3QuranReciter)
    : t('selectReciter');

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
            <TabsList className="grid w-full grid-cols-2 bg-emerald-100 dark:bg-emerald-900/30">
              <TabsTrigger value="everyayah" className="text-base md:text-xl data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB]">
                {t('everyAyah')}
              </TabsTrigger>
              <TabsTrigger value="mp3quran" className="text-base md:text-xl data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB]">
                {t('mp3Quran')}
              </TabsTrigger>
            </TabsList>

            {/* EveryAyah Tab Content */}
            <TabsContent value="everyayah" className="space-y-2 sm:space-y-3 mt-3">
          {/* Reciter Name Filter */}
          <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
            <span className="font-medium text-base md:text-xl text-emerald-800 dark:text-emerald-300">
              {t('reciterName')}
            </span>
            <Popover open={openEveryAyahReciter} onOpenChange={setOpenEveryAyahReciter}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openEveryAyahReciter}
                  className="w-full justify-between h-8 sm:h-9 text-base md:text-xl border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900"
                >
                  {filterReciterName === 'all' 
                    ? t('all') 
                    : uniqueReciterNames.find(r => r.nameAr === filterReciterName)
                      ? (language === 'ar' 
                          ? uniqueReciterNames.find(r => r.nameAr === filterReciterName)!.nameAr 
                          : uniqueReciterNames.find(r => r.nameAr === filterReciterName)!.name)
                      : t('all')}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] sm:w-[400px] p-0 bg-[#FBF9F4] dark:bg-emerald-950" align="start">
                <Command className="bg-[#FBF9F4] dark:bg-emerald-950" filter={arabicFilter}>
                  <CommandInput placeholder={t('searchReciter')} className="text-base md:text-lg" />
                  <CommandList>
                    <CommandEmpty>{t('noResults')}</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        key="all"
                        value="all"
                        onSelect={() => {
                          onFilterReciterNameChange('all');
                          setOpenEveryAyahReciter(false);
                        }}
                        className="text-base md:text-xl"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            filterReciterName === 'all' ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {t('all')}
                      </CommandItem>
                      {uniqueReciterNames
                        .slice()
                        .sort((a, b) => {
                          const nameA = language === 'ar' ? a.nameAr : a.name;
                          const nameB = language === 'ar' ? b.nameAr : b.name;
                          return nameA.localeCompare(nameB, language);
                        })
                        .map((reciter) => (
                          <CommandItem
                            key={reciter.nameAr}
                            value={`${reciter.name}|${reciter.nameAr}`}
                            onSelect={() => {
                              onFilterReciterNameChange(reciter.nameAr);
                              setOpenEveryAyahReciter(false);
                            }}
                            className="text-base md:text-xl"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                filterReciterName === reciter.nameAr ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {language === 'ar' ? reciter.nameAr : reciter.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Reading Type Filter */}
          <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
            <span className="font-medium text-base md:text-xl text-emerald-800 dark:text-emerald-300">
              {t('readingType')}
            </span>
            <Select value={filterReading} onValueChange={onFilterReadingChange}>
              <SelectTrigger className="w-full h-8 sm:h-9 text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
                {filterReciterName === 'all' && <SelectItem value="all" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('all')}</SelectItem>}
                {availableReadings.includes('hafs') && <SelectItem value="hafs" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('hafs')}</SelectItem>}
                {availableReadings.includes('warsh') && <SelectItem value="warsh" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('warsh')}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          
          {/* Recitation Style Filter */}
          <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
            <span className="font-medium text-base md:text-xl text-emerald-800 dark:text-emerald-300">
              {t('recitationStyle')}
            </span>
            <Select value={filterStyle} onValueChange={onFilterStyleChange}>
              <SelectTrigger className="w-full h-8 sm:h-9 text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
                {filterReciterName === 'all' && <SelectItem value="all" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('all')}</SelectItem>}
                {availableStyles.includes('murattal') && <SelectItem value="murattal" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('murattal')}</SelectItem>}
                {availableStyles.includes('mujawwad') && <SelectItem value="mujawwad" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('mujawwad')}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          
          {/* Quality Filter */}
          <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
            <span className="font-medium text-base md:text-xl text-emerald-800 dark:text-emerald-300">
              {t('quality')}
            </span>
            <Select value={filterQuality} onValueChange={onFilterQualityChange}>
              <SelectTrigger className="w-full h-8 sm:h-9 text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
                {filterReciterName === 'all' && <SelectItem value="all" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('all')}</SelectItem>}
                {availableQualities.includes('192kbps') && <SelectItem value="192kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">192kbps</SelectItem>}
                {availableQualities.includes('128kbps') && <SelectItem value="128kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">128kbps</SelectItem>}
                {availableQualities.includes('64kbps') && <SelectItem value="64kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">64kbps</SelectItem>}
                {availableQualities.includes('48kbps') && <SelectItem value="48kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">48kbps</SelectItem>}
                {availableQualities.includes('40kbps') && <SelectItem value="40kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">40kbps</SelectItem>}
                {availableQualities.includes('32kbps') && <SelectItem value="32kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">32kbps</SelectItem>}
                {availableQualities.includes('16kbps') && <SelectItem value="16kbps" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">16kbps</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* Listen Button */}
          <div className="pt-2 sm:pt-3 mt-2">
            <Button
              onClick={onListen}
              disabled={!selectedReciter && filteredReciters.length === 0}
              className="w-full h-9 sm:h-10 text-base md:text-xl bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('listen')}
            </Button>
          </div>
            </TabsContent>

            {/* MP3Quran Tab Content */}
            <TabsContent value="mp3quran" className="space-y-2 sm:space-y-3 mt-3">
              {/* Reciter Selection */}
              <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                <span className="font-medium text-base md:text-xl text-emerald-800 dark:text-emerald-300">
                  {t('reciterName')}
                </span>
                <Popover open={openMp3QuranReciter} onOpenChange={setOpenMp3QuranReciter}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openMp3QuranReciter}
                      className="w-full justify-between h-8 sm:h-9 text-base md:text-xl border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900"
                    >
                      {selectedMp3QuranReciterName}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] sm:w-[400px] p-0 bg-[#FBF9F4] dark:bg-emerald-950" align="start">
                    <Command className="bg-[#FBF9F4] dark:bg-emerald-950" filter={arabicFilter}>
                      <CommandInput placeholder={t('searchReciter')} className="text-base md:text-lg" />
                      <CommandList>
                        <CommandEmpty>{t('noResults')}</CommandEmpty>
                        <CommandGroup>
                          {mp3QuranReciters
                            .slice()
                            .sort((a, b) => {
                              const nameA = getMp3QuranReciterName(a);
                              const nameB = getMp3QuranReciterName(b);
                              return nameA.localeCompare(nameB, 'ar');
                            })
                            .map((reciter) => {
                              const arName = getMp3QuranReciterName(reciter);
                              return (
                                <CommandItem
                                  key={reciter.id}
                                  value={arName}
                                  onSelect={() => {
                                    onMp3QuranReciterChange(reciter);
                                    setOpenMp3QuranReciter(false);
                                  }}
                                  className="text-base md:text-xl"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedMp3QuranReciter?.id === reciter.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {arName}
                                </CommandItem>
                              );
                            })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Moshaf/Recitation Type Selection */}
              {selectedMp3QuranReciter && selectedMp3QuranReciter.moshaf.length > 0 && (
                <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
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
                  >
                    <SelectTrigger className="w-full h-8 sm:h-9 text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
                      {selectedMp3QuranReciter.moshaf.map((moshaf) => (
                        <SelectItem
                          key={moshaf.id}
                          value={moshaf.id.toString()}
                          className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100"
                        >
                          {translateMoshafName(moshaf.name)} ({moshaf.surah_total} {t('surahs')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Listen Button */}
              <div className="pt-2 sm:pt-3 mt-2">
                <Button
                  onClick={onListen}
                  disabled={!selectedMp3QuranReciter || !selectedMoshaf}
                  className="w-full h-9 sm:h-10 text-base md:text-xl bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('listen')}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
