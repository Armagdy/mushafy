import { motion } from 'framer-motion';
import { Play, Pause, Square, Repeat, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Mp3QuranReciter } from '@/lib/mp3quran-service';

interface PlayBarProps {
  currentPlayingAyah: { surah: number; ayah: number } | null;
  selectedReciter: { name: string; nameAr: string } | null;
  selectedMp3QuranReciter?: Mp3QuranReciter | null;
  mp3QuranRecitersAr?: Mp3QuranReciter[];
  isPlaying: boolean;
  isRepeatActive: boolean;
  isPreloadingAyahs?: boolean;
  preloadProgress?: { current: number; total: number };
  audioSource?: 'everyayah' | 'mp3quran';
  currentSurahName?: string;
  hasAyahTimings?: boolean;
  flashAyahPickerIcon?: boolean;
  formatNumber: (num: number | string) => string;
  onAyahSelectorClick: () => void;
  onRepeatClick: () => void;
  onReciterClick: () => void;
  onStop: () => void;
  onTogglePlayPause: () => void;
}

export function PlayBar({
  currentPlayingAyah,
  selectedReciter,
  selectedMp3QuranReciter,
  mp3QuranRecitersAr = [],
  isPlaying,
  isRepeatActive,
  isPreloadingAyahs = false,
  preloadProgress = { current: 0, total: 0 },
  audioSource = 'everyayah',
  currentSurahName,
  hasAyahTimings = false,
  flashAyahPickerIcon = false,
  formatNumber,
  onAyahSelectorClick,
  onRepeatClick,
  onReciterClick,
  onStop,
  onTogglePlayPause,
}: PlayBarProps) {
  const { language, t } = useLanguage();
  
  // Debug logging for props
  console.log('[PlayBar] 🎵 PlayBar props:');
  console.log('[PlayBar]    - audioSource:', audioSource);
  console.log('[PlayBar]    - hasAyahTimings:', hasAyahTimings);
  console.log('[PlayBar]    - selectedMp3QuranReciter:', selectedMp3QuranReciter?.name, 'ID:', selectedMp3QuranReciter?.id);
  console.log('[PlayBar]    - currentSurahName:', currentSurahName);
  console.log('[PlayBar]    - currentPlayingAyah:', currentPlayingAyah);

  // Clean reciter name by removing style indicators
  const cleanReciterName = (name: string): string => {
    return name
      .replace(/\s*-\s*مرتل\s*/g, '')
      .replace(/\s*-\s*معلم\s*/g, '')
      .replace(/\s*-\s*مجود\s*/g, '')
      .replace(/\s*مرتل\s*/g, '')
      .replace(/\s*معلم\s*/g, '')
      .replace(/\s*مجود\s*/g, '')
      .trim();
  };

  // Get the appropriate reciter name based on audio source
  const getReciterName = () => {
    if (selectedReciter) {
      // EveryAyah reciter - show reciter name with surah name
      const rawName = language === 'ar' ? selectedReciter.nameAr : selectedReciter.name;
      const reciterName = cleanReciterName(rawName);
      return currentSurahName ? `${reciterName} - ${currentSurahName}` : reciterName;
    } else if (selectedMp3QuranReciter) {
      // MP3Quran reciter - show reciter name with surah name and (كاملة) indicating complete surah
      let rawName = selectedMp3QuranReciter.name;
      
      // If Arabic language is selected, use nameAr if available (from local JSON)
      // Otherwise try to find it from the Arabic reciters array (from API)
      if (language === 'ar') {
        if (selectedMp3QuranReciter.nameAr) {
          rawName = selectedMp3QuranReciter.nameAr;
        } else {
          const arReciter = mp3QuranRecitersAr.find(r => r.id === selectedMp3QuranReciter.id);
          rawName = arReciter ? arReciter.name : selectedMp3QuranReciter.name;
        }
      }
      
      const reciterName = cleanReciterName(rawName);
      return currentSurahName ? `${reciterName} - ${currentSurahName} (${language === 'ar' ? 'كاملة' : 'Full'})` : reciterName;
    }
    return t('selectReciter');
  };

  return (
    <div className="flex justify-center px-2 md:px-0 pt-0 pb-0">
      <div className="w-[98%] md:max-w-4xl lg:max-w-5xl rounded-full">
        <div className="flex items-center py-2 px-2 md:py-3 md:px-7 gap-1 md:gap-0 md:justify-between w-full">
          {/* Ayah Selection - Left */}
          <div className="flex items-center gap-1.5 md:gap-3">
            <button
              onClick={onAyahSelectorClick}
              disabled={audioSource === 'mp3quran' && !hasAyahTimings}
              className={`flex items-center justify-center bg-emerald-800/50 hover:bg-emerald-800/70 rounded-lg px-3 md:px-4 h-10 md:h-12 border border-[#F2E3BB]/30 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-800/50 ${
                flashAyahPickerIcon ? 'animate-flash-gold' : ''
              }`}
              title={(audioSource === 'mp3quran' && !hasAyahTimings) ? t('ayahSelectionNotAvailable') : ''}
            >
              <span className="text-[#F2E3BB] text-base md:text-xl font-bold" style={{ fontFamily: "'Amiri', serif" }}>
                {(audioSource === 'mp3quran' && !hasAyahTimings) 
                  ? '--' 
                  : currentPlayingAyah 
                    ? formatNumber(currentPlayingAyah.ayah) 
                    : '--'}
              </span>
            </button>
            
            <button
              onClick={onRepeatClick}
              className={`flex items-center justify-center transition-all rounded-lg px-3 md:px-4 h-10 md:h-12 border shadow-md ${
                isRepeatActive 
                  ? 'bg-emerald-800/50 border-[#F2E3BB]/30 text-[#F2E3BB]' 
                  : 'bg-gray-600/50 border-gray-400/30 text-gray-300 hover:bg-gray-500/50'
              }`}
              title="Repeat"
            >
              <Repeat className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
          
          {/* Reciter Selection - Center */}
          <button
            onClick={onReciterClick}
            className="flex items-center justify-center bg-emerald-800/50 hover:bg-emerald-800/70 rounded-lg px-3 md:px-4 h-10 md:h-12 border border-[#F2E3BB]/30 shadow-md transition-all flex-[2] md:flex-1 min-w-0 md:max-w-md lg:max-w-lg"
          >
            <span className="text-[#F2E3BB] text-base md:text-xl font-bold truncate" style={{ fontFamily: "'Amiri', serif" }}>
              {getReciterName()}
            </span>
          </button>
          
          {/* Playback Controls - Right */}
          <div className="flex items-center justify-end gap-1.5 md:gap-3">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onStop}
              className="flex items-center justify-center bg-emerald-800/50 hover:bg-emerald-800/70 rounded-lg px-3 md:px-4 h-10 md:h-12 border border-[#F2E3BB]/30 shadow-md transition-all"
              title={t('stop')}
            >
              <Square className="w-5 h-5 md:w-6 md:h-6 text-[#F2E3BB]" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onTogglePlayPause}
              disabled={isPreloadingAyahs}
              className="flex items-center justify-center bg-emerald-800/50 hover:bg-emerald-800/70 rounded-lg px-3 md:px-4 h-10 md:h-12 border border-[#F2E3BB]/30 shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              title={isPreloadingAyahs ? t('loading') : (isPlaying ? t('pause') : t('play'))}
            >
              {isPreloadingAyahs ? (
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <Loader2 className="w-5 h-5 md:w-6 md:h-6 text-[#F2E3BB] animate-spin" />
                  {preloadProgress.total > 0 && (
                    <span className="text-[#F2E3BB] text-[8px] md:text-[10px] font-medium">
                      {preloadProgress.current}/{preloadProgress.total}
                    </span>
                  )}
                </div>
              ) : isPlaying ? (
                <Pause className="w-5 h-5 md:w-6 md:h-6 text-[#F2E3BB]" />
              ) : (
                <Play className="w-5 h-5 md:w-6 md:h-6 text-[#F2E3BB]" />
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
