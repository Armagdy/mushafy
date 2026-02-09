import { motion } from 'framer-motion';
import { Volume2, Play, Pause, Square, ChevronDown, Repeat } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface PlayBarProps {
  currentPlayingAyah: { surah: number; ayah: number } | null;
  selectedReciter: { name: string; nameAr: string } | null;
  isPlaying: boolean;
  isRepeatActive: boolean;
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
  isPlaying,
  isRepeatActive,
  formatNumber,
  onAyahSelectorClick,
  onRepeatClick,
  onReciterClick,
  onStop,
  onTogglePlayPause,
}: PlayBarProps) {
  const { language, t } = useLanguage();

  return (
    <div className="flex justify-center px-2 md:px-0">
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="w-[98%] md:max-w-4xl lg:max-w-5xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-emerald-950 backdrop-blur-lg border border-emerald-200 dark:border-emerald-700 rounded-full"
      >
        <div className="flex items-center py-2 px-2 md:py-3 md:px-7 gap-1 md:gap-0 md:justify-between w-full">
          {/* Ayah Selection - Left */}
          <div className="flex items-center gap-1.5 md:gap-3">
            <button
              onClick={onAyahSelectorClick}
              className="flex items-center justify-center gap-1 md:gap-2 px-1 md:px-3 py-1 md:py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            >
              <span className="text-base md:text-xl font-medium text-gray-900 dark:text-gray-100 min-w-[20px] md:min-w-[32px] text-center">
                {currentPlayingAyah ? formatNumber(currentPlayingAyah.ayah) : '--'}
              </span>
              <ChevronDown className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />
            </button>
            
            <button
              onClick={onRepeatClick}
              className={`flex items-center justify-center transition-all rounded-full p-1 border-2 ${
                isRepeatActive 
                  ? 'text-green-700 dark:text-green-400 border-green-500 bg-green-50 dark:bg-green-900/20' 
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 border-transparent'
              }`}
              title="Repeat"
            >
              <Repeat className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
          
          {/* Reciter Selection - Center */}
          <button
            onClick={onReciterClick}
            className="flex items-center gap-1 md:gap-2 px-1 md:px-4 py-1 md:py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-all flex-[2] md:flex-1 justify-center min-w-0 md:max-w-md lg:max-w-lg"
          >
            <Volume2 className="w-3.5 h-3.5 md:w-5 md:h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="text-base md:text-xl font-medium text-gray-900 dark:text-gray-100 truncate">
              {selectedReciter ? (language === 'ar' ? selectedReciter.nameAr : selectedReciter.name) : t('selectReciter')}
            </span>
            <ChevronDown className="w-3 h-3 md:w-4 md:h-4 text-gray-400 flex-shrink-0" />
          </button>
          
          {/* Playback Controls - Right */}
          <div className="flex items-center justify-end gap-1.5 md:gap-3">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onStop}
              className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 flex items-center justify-center transition-all"
              title={t('stop')}
            >
              <Square className="w-3.5 h-3.5 md:w-5 md:h-5" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onTogglePlayPause}
              className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white flex items-center justify-center shadow-md transition-all"
              title={isPlaying ? t('pause') : t('play')}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 md:w-6 md:h-6" />
              ) : (
                <Play className="w-4 h-4 md:w-6 md:h-6 ml-0.5" />
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
