import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ChevronLeft, ChevronRight, Search, Pencil } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { cn } from "@/lib/utils";
import { useTafseer } from "@/hooks/useTafseer";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { surahs } from "@/data/surahs";

/**
 * Tafseer View Component
 * Used by Configuration page for /config/tafseer
 * Displays Quran tafseer (interpretation/commentary) for selected ayah
 */
export default function TafseerView() {
  const { t, isRTL, language } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  const {
    tafseers,
    selectedTafseerId,
    setSelectedTafseerId,
    selectedTafseerInfo,
    tafseerText,
    isLoading,
    error,
    fetchTafseerForAyah,
    getTafseersByLanguage,
  } = useTafseer();

  const [currentSurahNumber, setCurrentSurahNumber] = useState(() => {
    const saved = localStorage.getItem('quran-tafseer-surah');
    return saved ? parseInt(saved) : 1;
  });
  const [currentAyahNumber, setCurrentAyahNumber] = useState(() => {
    const saved = localStorage.getItem('quran-tafseer-ayah');
    return saved ? parseInt(saved) : 1;
  });
  const [ayahText, setAyahText] = useState<string>("");
  const [isLoadingAyah, setIsLoadingAyah] = useState(false);
  // Animation state
  const [animDirection, setAnimDirection] = useState<1 | -1>(1); // 1=next, -1=prev
  const [dragOffset, setDragOffset] = useState(0);              // live drag preview
  const [swipeHint, setSwipeHint] = useState<'left' | 'right' | null>(null);

  // Dropdown picker state
  const [surahSearch, setSurahSearch] = useState('');
  const [tafseerSearch, setTafseerSearch] = useState('');
  const [showSurahPicker, setShowSurahPicker] = useState(false);
  const [showAyahPicker, setShowAyahPicker] = useState(false);
  const [showTafseerPicker, setShowTafseerPicker] = useState(false);

  // Refs for scrollable pickers
  const surahSearchRef = useRef<HTMLInputElement>(null);
  const tafseerSearchRef = useRef<HTMLInputElement>(null);
  const selectedSurahRef = useRef<HTMLButtonElement>(null);
  const selectedAyahRef = useRef<HTMLButtonElement>(null);
  const selectedTafseerRef = useRef<HTMLButtonElement>(null);

  // Helper function to convert numbers based on language
  const formatNumber = (num: number | string): string => {
    const numStr = num.toString();
    if (language === 'ar') {
      // Convert to Eastern Arabic numerals (٠-٩)
      return numStr.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
    }
    return numStr;
  };

  // Get current surah info for ayah count
  const currentSurah = surahs.find(s => s.id === currentSurahNumber);
  const maxAyahs = currentSurah?.numberOfAyahs || 1;

  // Handle surah change - reset to first ayah and collapse pickers
  const handleSurahChange = (value: string | number) => {
    const newSurahNumber = typeof value === 'string' ? parseInt(value) : value;
    setCurrentSurahNumber(newSurahNumber);
    setCurrentAyahNumber(1);
    setSurahSearch('');
    setShowSurahPicker(false);
    setShowAyahPicker(false);
  };

  // Handle ayah change and collapse picker
  const handleAyahChange = (value: string | number) => {
    const newAyahNumber = typeof value === 'string' ? parseInt(value) : value;
    setCurrentAyahNumber(newAyahNumber);
    setShowAyahPicker(false);
  };

  // Fetch ayah text from Quran.com API - defer to avoid blocking render
  useEffect(() => {
    if (currentSurahNumber && currentAyahNumber) {
      // Defer fetch to next tick to allow view to render first
      const timeoutId = setTimeout(() => {
        setIsLoadingAyah(true);
        setAyahText(""); // Reset ayah text
        
        // Use Quran.com API to get verse text
        fetch(`https://api.quran.com/api/v4/verses/by_key/${currentSurahNumber}:${currentAyahNumber}?fields=text_uthmani`)
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
          })
          .then(data => {
            if (data && data.verse && data.verse.text_uthmani) {
              console.log('Ayah text loaded from Quran.com API:', data.verse.text_uthmani);
              setAyahText(data.verse.text_uthmani);
            } else {
              console.warn('Verse text not found in response');
            }
            setIsLoadingAyah(false);
          })
          .catch(err => {
            console.error('Failed to load ayah text from Quran.com API:', err);
            setIsLoadingAyah(false);
          });
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentSurahNumber, currentAyahNumber]);

  // Fetch tafseer when ayah changes - defer to avoid blocking render
  useEffect(() => {
    if (currentSurahNumber && currentAyahNumber && selectedTafseerId) {
      // Defer fetch to next tick to allow view to render first
      const timeoutId = setTimeout(() => {
        fetchTafseerForAyah(currentSurahNumber, currentAyahNumber);
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSurahNumber, currentAyahNumber, selectedTafseerId]);

  // Animation variants for slide transitions
  // enter from the SAME side the finger came from, exit toward where the finger went
  const slideVariants = {
    enter: (dir: number) => ({ x: dir * -60, opacity: 0 }),
    center: { x: 0, opacity: 1, transition: { duration: 0.22, ease: 'easeOut' as const } },
    exit:  (dir: number) => ({ x: dir * 60, opacity: 0, transition: { duration: 0.15, ease: 'easeIn' as const } }),
  };

  // Navigation handlers
  const handlePreviousAyah = useCallback(() => {
    if (currentAyahNumber > 1) {
      setAnimDirection(-1); // enters from right, slides left
      setCurrentAyahNumber(prev => prev - 1);
    }
  }, [currentAyahNumber]);

  const handleNextAyah = useCallback(() => {
    if (currentAyahNumber < maxAyahs) {
      setAnimDirection(1); // enters from left, slides right
      setCurrentAyahNumber(prev => prev + 1);
    }
  }, [currentAyahNumber, maxAyahs]);

  // Swipe gesture support for navigating between ayahs
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setDragOffset(0);
    setSwipeHint(null);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);
    const absX = Math.abs(deltaX);
    if (absX > 12 && absX > deltaY * 1.2) {
      // Clamp drag to ±40px for a subtle preview feel
      setDragOffset(Math.max(-40, Math.min(40, deltaX * 0.35)));
      setSwipeHint(deltaX > 0 ? 'right' : 'left');
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    setDragOffset(0);
    setSwipeHint(null);

    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Only trigger navigation if horizontal swipe dominates vertical scroll
    // and meets minimum distance threshold (50px)
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (absX < 50 || absX < absY * 1.2) return;

    // Swipe right (left→right, deltaX > 0) → next ayah
    // Swipe left  (right→left, deltaX < 0) → previous ayah
    if (deltaX > 0) handleNextAyah();
    else handlePreviousAyah();
  }, [isRTL, handlePreviousAyah, handleNextAyah]);

  // Get tafseers for current language
  const languageTafseers = getTafseersByLanguage(language);
  const allTafseers = languageTafseers.length > 0 ? languageTafseers : tafseers;

  // Filtered lists for search
  const filteredSurahs = useMemo(() => {
    const q = surahSearch.trim().toLowerCase();
    if (!q) return surahs;
    return surahs.filter(s =>
      s.name.includes(q) ||
      s.englishName.toLowerCase().includes(q) ||
      s.id.toString().includes(q)
    );
  }, [surahSearch]);

  const filteredTafseers = useMemo(() => {
    const q = tafseerSearch.trim().toLowerCase();
    if (!q) return allTafseers;
    return allTafseers.filter(t => t.name.toLowerCase().includes(q));
  }, [tafseerSearch, allTafseers]);

  // Auto-scroll selected surah into view
  useEffect(() => {
    selectedSurahRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' });
  }, [currentSurahNumber]);

  // Auto-scroll selected ayah into view
  useEffect(() => {
    selectedAyahRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' });
  }, [currentAyahNumber]);

  // Auto-scroll selected items into view when pickers open
  useEffect(() => {
    if (showSurahPicker) {
      setTimeout(() => {
        selectedSurahRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' });
      }, 0);
    }
  }, [showSurahPicker]);

  useEffect(() => {
    if (showAyahPicker) {
      setTimeout(() => {
        selectedAyahRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' });
      }, 0);
    }
  }, [showAyahPicker]);

  useEffect(() => {
    if (showTafseerPicker) {
      setTimeout(() => {
        selectedTafseerRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' });
      }, 0);
    }
  }, [showTafseerPicker]);

  return (
    <div className={cn(
      "flex flex-col h-full",
      isRTL ? "rtl" : "ltr"
    )}>
      {/* Fixed Top Section - Selectors and Controls */}
      <div className="flex-shrink-0 p-4 space-y-4">
        {/* Surah and Ayah Selectors */}
        <div className={cn("grid grid-cols-2 gap-3 md:gap-4", isRTL && "rtl")}>

          {/* Surah Selector — chip when chosen, search+list when open */}
          <div className="space-y-1">
            <label className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
              {t('selectSurah')}
            </label>
            {!showSurahPicker ? (
              /* Collapsed chip */
              <button
                onClick={() => setShowSurahPicker(true)}
                className={cn(
                  'w-full flex items-center gap-1 px-2 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors',
                  isRTL ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                <span className="text-emerald-500 dark:text-emerald-500 text-xs shrink-0">{formatNumber(currentSurahNumber)}.</span>
                <span className={cn('flex-1 font-semibold text-emerald-800 dark:text-emerald-200 truncate text-start', textSizeClasses.text)}>
                  {language === 'ar' ? currentSurah?.name : currentSurah?.englishName}
                </span>
                <Pencil className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              </button>
            ) : (
              /* Expanded picker */
              <>
                <div className="relative shrink-0">
                  <Search className={cn(
                    'absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400',
                    isRTL ? 'right-2' : 'left-2'
                  )} />
                  <input
                    ref={surahSearchRef}
                    type="text"
                    placeholder={t('search')}
                    value={surahSearch}
                    onChange={e => setSurahSearch(e.target.value)}
                    autoFocus
                    className={cn(
                      'w-full h-8 rounded-md border border-emerald-300 bg-transparent px-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500',
                      isRTL ? 'pr-7 text-right' : 'pl-7 text-left',
                      textSizeClasses.text
                    )}
                  />
                </div>
                <div className="overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg max-h-36">
                  {filteredSurahs.map((surah) => (
                    <button
                      key={surah.id}
                      ref={surah.id === currentSurahNumber ? selectedSurahRef : null}
                      onClick={() => handleSurahChange(surah.id)}
                      className={cn(
                        'w-full px-2 py-1.5 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors text-start',
                        'hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10',
                        surah.id === currentSurahNumber && 'bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold',
                        textSizeClasses.text
                      )}
                    >
                      <div className={cn('flex items-center gap-1 w-full', isRTL && 'flex-row-reverse')}>
                        <span className="text-emerald-500 dark:text-emerald-500 text-xs shrink-0">{formatNumber(surah.id)}.</span>
                        <span className="flex-1 text-emerald-800 dark:text-emerald-200 truncate">
                          {language === 'ar' ? surah.name : surah.englishName}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Ayah Selector — chip when chosen, scrollable list when open */}
          <div className="space-y-1">
            <label className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
              {t('selectAyah')}
            </label>
            {!showAyahPicker ? (
              /* Collapsed chip */
              <button
                onClick={() => setShowAyahPicker(true)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors',
                  isRTL ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                <span className={cn('flex-1 font-semibold text-emerald-800 dark:text-emerald-200 text-center', textSizeClasses.text)}>
                  {formatNumber(currentAyahNumber)}
                </span>
                <Pencil className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              </button>
            ) : (
              /* Expanded picker */
              <div className="overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg max-h-36">
                {Array.from({ length: maxAyahs }, (_, i) => i + 1).map((ayahNum) => (
                  <button
                    key={ayahNum}
                    ref={ayahNum === currentAyahNumber ? selectedAyahRef : null}
                    onClick={() => handleAyahChange(ayahNum)}
                    className={cn(
                      'w-full px-2 py-1.5 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors text-center',
                      'hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10',
                      ayahNum === currentAyahNumber && 'bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold',
                      textSizeClasses.text
                    )}
                  >
                    <span className="text-emerald-800 dark:text-emerald-200">{formatNumber(ayahNum)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      {/* Ayah Navigation */}
      <div className={cn(
        "flex items-center justify-between gap-2 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/20",
        isRTL && "flex-row-reverse"
      )}>
        <button
          onClick={handleNextAyah}
          disabled={currentAyahNumber >= maxAyahs}
          className={cn("bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-emerald-600 shadow-md px-3 md:px-4 py-1.5 md:py-2 text-[#F2E3BB] font-medium transition-all", textSizeClasses.button)}
        >
          {t('nextAyah')}
        </button>
        
        <div className="text-center flex-1">
          <div className={cn("font-bold text-emerald-900 dark:text-emerald-300", textSizeClasses.text)}>
            {formatNumber(currentAyahNumber)} / {formatNumber(maxAyahs)}
          </div>
        </div>

        <button
          onClick={handlePreviousAyah}
          disabled={currentAyahNumber <= 1}
          className={cn("bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-emerald-600 shadow-md px-3 md:px-4 py-1.5 md:py-2 text-[#F2E3BB] font-medium transition-all", textSizeClasses.button)}
        >
          {t('previousAyah')}
        </button>
      </div>

      {/* Ayah Text Display */}
      <div className={cn("rounded-lg", isRTL && "rtl")}>
        <div className={cn("font-medium text-emerald-800 dark:text-emerald-300 pb-2", textSizeClasses.label)}>
          {t('ayahText')}
        </div>
        {isLoadingAyah ? (
          <div className="flex items-center justify-center py-6 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-lg">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
          </div>
        ) : (
          <div
            className="relative overflow-hidden rounded-lg border border-emerald-300 dark:border-emerald-600 bg-emerald-50/60 dark:bg-emerald-900/20"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Swipe arrow overlays */}
            <AnimatePresence>
              {swipeHint === 'right' && currentAyahNumber < maxAyahs && (
                <motion.div
                  key="hint-right"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-emerald-700/80 rounded-full p-1 shadow"
                >
                  <ChevronRight className="w-5 h-5 text-[#F2E3BB]" />
                </motion.div>
              )}
              {swipeHint === 'left' && currentAyahNumber > 1 && (
                <motion.div
                  key="hint-left"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-emerald-700/80 rounded-full p-1 shadow"
                >
                  <ChevronLeft className="w-5 h-5 text-[#F2E3BB]" />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="max-h-[250px] md:max-h-[300px] overflow-y-auto p-4">
              <AnimatePresence mode="wait" custom={animDirection}>
                {ayahText ? (
                  <motion.div
                    key={`ayah-text-${currentSurahNumber}-${currentAyahNumber}`}
                    custom={animDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate={{ ...slideVariants.center, x: dragOffset }}
                    exit="exit"
                    className={cn("leading-[2.2] text-right text-emerald-900 dark:text-emerald-50", textSizeClasses.text)}
                    style={{ fontFamily: "'Scheherazade New', 'Noto Naskh Arabic', serif" }}
                  >
                    {ayahText}
                  </motion.div>
                ) : (
                  <motion.div
                    key="ayah-empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn("text-center py-4 text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}
                  >
                    {isRTL ? 'لا يمكن تحميل نص الآية' : 'Unable to load ayah text'}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Tafseer Selector — selected-chip + expandable picker */}
      <div className="space-y-1">
        <label className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
          {t('selectTafseer')}
        </label>
        {/* Selected chip — entire row is clickable to re-open picker */}
        {!showTafseerPicker && selectedTafseerInfo && (
          <button
            onClick={() => setShowTafseerPicker(true)}
            title={t('selectTafseer')}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors',
              isRTL ? 'flex-row-reverse' : 'flex-row'
            )}
          >
            <span className={cn('flex-1 font-semibold text-emerald-800 dark:text-emerald-200 text-start', textSizeClasses.text)}>
              {selectedTafseerInfo.name}
            </span>
            <Pencil className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          </button>
        )}
        {/* Picker — search + scrollable list */}
        {(showTafseerPicker || !selectedTafseerInfo) && (
          <>
            <div className="relative shrink-0">
              <Search className={cn(
                'absolute top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600 dark:text-emerald-400',
                isRTL ? 'right-3' : 'left-3'
              )} />
              <input
                ref={tafseerSearchRef}
                type="text"
                placeholder={t('selectTafseer')}
                value={tafseerSearch}
                onChange={e => setTafseerSearch(e.target.value)}
                className={cn(
                  'w-full h-9 rounded-md border border-emerald-300 bg-transparent px-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500',
                  isRTL ? 'pr-9 text-right' : 'pl-9 text-left',
                  textSizeClasses.text
                )}
              />
            </div>
            <div className="overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg max-h-36">
              {filteredTafseers.map((tafseer, index) => (
                <button
                  key={tafseer.id}
                  ref={tafseer.id === selectedTafseerId ? selectedTafseerRef : null}
                  onClick={() => {
                    setSelectedTafseerId(tafseer.id);
                    setShowTafseerPicker(false);
                    setTafseerSearch('');
                  }}
                  className={cn(
                    'w-full px-3 py-2 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors',
                    'hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10',
                    tafseer.id === selectedTafseerId && 'bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold',
                    textSizeClasses.text,
                    isRTL ? 'text-right' : 'text-left'
                  )}
                >
                  <div className={cn('flex items-center gap-2 w-full', isRTL && 'flex-row-reverse')}>
                    <span className="text-emerald-500 dark:text-emerald-500 text-xs shrink-0">{index + 1}.</span>
                    <span className="flex-1 text-emerald-800 dark:text-emerald-200">{tafseer.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      </div>

      {/* Flexible Tafseer Content - Takes remaining space */}
      <div
        className="flex-1 min-h-0 overflow-hidden px-4 pb-20 flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={cn("font-medium text-emerald-800 dark:text-emerald-300 pb-2 flex-shrink-0", textSizeClasses.label)}>
          {t('tafseer')}
        </div>
        <div className="relative flex-1 min-h-0">
          {/* Swipe arrow overlays on tafseer panel */}
          <AnimatePresence>
            {swipeHint === 'right' && currentAyahNumber < maxAyahs && (
              <motion.div
                key="tafs-hint-right"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-emerald-700/80 rounded-full p-1.5 shadow-lg pointer-events-none"
              >
                <ChevronRight className="w-6 h-6 text-[#F2E3BB]" />
              </motion.div>
            )}
            {swipeHint === 'left' && currentAyahNumber > 1 && (
              <motion.div
                key="tafs-hint-left"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-emerald-700/80 rounded-full p-1.5 shadow-lg pointer-events-none"
              >
                <ChevronLeft className="w-6 h-6 text-[#F2E3BB]" />
              </motion.div>
            )}
          </AnimatePresence>

          <ScrollArea className="h-full w-full rounded-md border border-emerald-200 dark:border-emerald-700 p-4 bg-white dark:bg-emerald-950/30">
            <AnimatePresence mode="wait" custom={animDirection}>
              {isLoading ? (
                <motion.div
                  key="tafseer-loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center min-h-[200px] gap-2"
                >
                  <Loader2 className="w-6 h-6 md:w-8 md:h-8 animate-spin text-emerald-600 dark:text-emerald-400" />
                  <span className={cn("text-emerald-800 dark:text-emerald-300", textSizeClasses.text)}>
                    {t('loadingTafseer')}
                  </span>
                </motion.div>
              ) : error ? (
                <motion.div
                  key="tafseer-error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center min-h-[200px] space-y-4 px-4"
                >
                  <div className="text-center">
                    <p className={cn("text-red-600 dark:text-red-400 font-medium mb-2", textSizeClasses.text)}>{error}</p>
                    <p className={cn("text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
                      {isRTL 
                        ? 'يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى'
                        : 'Please check your internet connection and try again'
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => fetchTafseerForAyah(currentSurahNumber, currentAyahNumber)}
                    className={cn("bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md px-4 py-2 text-[#F2E3BB] font-medium transition-all", textSizeClasses.button)}
                  >
                    {isRTL ? 'إعادة المحاولة' : 'Retry'}
                  </button>
                </motion.div>
              ) : tafseerText ? (
                <motion.div
                  key={`tafseer-${currentSurahNumber}-${currentAyahNumber}-${selectedTafseerId}`}
                  custom={animDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate={{ ...slideVariants.center, x: dragOffset }}
                  exit="exit"
                  className={cn(
                    "leading-relaxed text-emerald-900 dark:text-emerald-100",
                    isRTL ? "text-right" : "text-left",
                    textSizeClasses.text
                  )}
                >
                  {tafseerText.text}
                </motion.div>
              ) : (
                <motion.div
                  key="tafseer-empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={cn("flex items-center justify-center min-h-[200px] text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}
                >
                  {t('tafseerNotAvailable')}
                </motion.div>
              )}
            </AnimatePresence>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
