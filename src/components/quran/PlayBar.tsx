import { motion } from 'framer-motion';
import { Play, Pause, Square, Repeat } from 'lucide-react';
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
    <div className="flex justify-center px-2 md:px-0 pt-2 pb-1">
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="w-[98%] md:max-w-4xl lg:max-w-5xl rounded-full"
      >
        <div className="flex items-center py-2 px-2 md:py-3 md:px-7 gap-1 md:gap-0 md:justify-between w-full">
          {/* Ayah Selection - Left */}
          <div className="flex items-center gap-1.5 md:gap-3">
            <button
              onClick={onAyahSelectorClick}
              className="flex items-center justify-center bg-emerald-800/50 hover:bg-emerald-800/70 rounded-lg px-3 md:px-4 h-10 md:h-12 border border-[#F2E3BB]/30 shadow-md transition-all"
            >
              <span className="text-[#F2E3BB] text-base md:text-xl font-bold" style={{ fontFamily: "'Amiri', serif" }}>
                {currentPlayingAyah ? formatNumber(currentPlayingAyah.ayah) : '--'}
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
              {selectedReciter ? (language === 'ar' ? selectedReciter.nameAr : selectedReciter.name) : t('selectReciter')}
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
              className="flex items-center justify-center bg-emerald-800/50 hover:bg-emerald-800/70 rounded-lg px-3 md:px-4 h-10 md:h-12 border border-[#F2E3BB]/30 shadow-md transition-all"
              title={isPlaying ? t('pause') : t('play')}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 md:w-6 md:h-6 text-[#F2E3BB]" />
              ) : (
                <Play className="w-5 h-5 md:w-6 md:h-6 text-[#F2E3BB]" />
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
