import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

interface TopBarProps {
  currentSurah: {
    id: number;
    name: string;
    englishName: string;
  };
  currentPageNum: number;
  currentJuz: number;
  currentHezb: number;
  currentQuarter: number;
  formatNumber: (num: number | string) => string;
  onSurahClick: () => void;
  onPageClick: () => void;
  onJuzClick: () => void;
}

export function TopBar({
  currentSurah,
  currentPageNum,
  currentJuz,
  formatNumber,
  onSurahClick,
  onPageClick,
  onJuzClick,
}: TopBarProps) {
  const { isRTL, language } = useLanguage();

  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg shadow-sm"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="px-4 md:px-8 py-3 md:py-4 flex items-center justify-between gap-3 md:gap-6 text-gray-800 dark:text-gray-200 relative">
        {/* Surah Search Button - Enhanced with Islamic styling */}
        <button
          onClick={onSurahClick}
          className="group relative bg-gradient-to-br from-emerald-100 to-emerald-50 hover:from-emerald-200 hover:to-emerald-100 dark:from-emerald-900/50 dark:to-emerald-800/40 dark:hover:from-emerald-800 dark:hover:to-emerald-700 text-emerald-900 dark:text-emerald-100 rounded-xl px-3 md:px-4 py-1.5 md:py-2 text-base md:text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer min-w-[100px] md:min-w-[140px] text-center transition-all truncate border border-emerald-200/50 dark:border-emerald-700/50"
        >
          <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
          <span className="relative">
            {formatNumber(currentSurah.id)} {language === 'ar' ? currentSurah.name : currentSurah.englishName}
          </span>
        </button>

        {/* Page Display/Input - Centered with Islamic ornament */}
        <button
          onClick={onPageClick}
          className="group absolute left-1/2 -translate-x-1/2 bg-gradient-to-br from-gray-50 via-white to-gray-50/50 hover:from-gray-100 hover:via-gray-50 hover:to-gray-100/50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700 dark:hover:from-gray-700 dark:hover:via-gray-700 dark:hover:to-gray-600 text-gray-900 dark:text-gray-100 rounded-xl px-4 md:px-6 py-1.5 md:py-2 text-base md:text-xl font-bold focus:outline-none focus:ring-2 focus:ring-gray-500/50 cursor-pointer transition-all border-2 border-gray-300/50 dark:border-gray-700/50"
        >
          <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-white/30 to-transparent pointer-events-none" />
          <span className="relative">
            {isRTL ? formatNumber(currentPageNum) : `Page ${formatNumber(currentPageNum)}`}
          </span>
        </button>

        {/* Juz Search Button - Enhanced with Islamic styling */}
        <button
          onClick={onJuzClick}
          className="group relative bg-gradient-to-br from-emerald-100 to-emerald-50 hover:from-emerald-200 hover:to-emerald-100 dark:from-emerald-900/50 dark:to-emerald-800/40 dark:hover:from-emerald-800 dark:hover:to-emerald-700 text-emerald-900 dark:text-emerald-100 rounded-xl px-3 md:px-4 py-1.5 md:py-2 text-base md:text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer flex-shrink-0 text-center transition-all min-w-[100px] md:min-w-[140px] truncate border border-emerald-200/50 dark:border-emerald-700/50"
        >
          <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
          <span className="relative">
            {isRTL ? `الجزء ${formatNumber(currentJuz)}` : `Juz ${formatNumber(currentJuz)}`}
          </span>
        </button>
      </div>
    </motion.header>
  );
}
