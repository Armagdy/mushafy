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
      className="bg-gradient-to-b from-emerald-800 to-emerald-600"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="px-4 md:px-8 py-1.5 md:py-2 flex items-center justify-between gap-3 md:gap-6 relative">
        {/* Surah Button */}
        <button
          onClick={onSurahClick}
          className="group relative bg-emerald-800/50 hover:bg-emerald-800/70 rounded-lg px-2 md:px-3 py-1.5 md:py-2 border border-[#F2E3BB]/30 shadow-md cursor-pointer transition-all min-w-[80px] md:min-w-[100px] text-center"
        >
          <span className="text-[#F2E3BB] text-base md:text-xl font-bold" style={{ fontFamily: "'Amiri', serif" }}>
            {language === 'ar' 
              ? `${currentSurah.name} ${formatNumber(currentSurah.id)}`
              : `${formatNumber(currentSurah.id)}. ${currentSurah.englishName}`}
          </span>
        </button>

        {/* Page Display - Centered */}
        <button
          onClick={onPageClick}
          className="group absolute left-1/2 -translate-x-1/2 bg-emerald-800/50 hover:bg-emerald-800/70 rounded-lg px-2 md:px-3 py-1.5 md:py-2 border border-[#F2E3BB]/30 shadow-md cursor-pointer transition-all min-w-[80px] md:min-w-[100px] text-center"
        >
          <span className="text-[#F2E3BB] text-base md:text-xl font-bold" style={{ fontFamily: "'Amiri', serif" }}>
            ص {formatNumber(currentPageNum)}
          </span>
        </button>

        {/* Juz Button */}
        <button
          onClick={onJuzClick}
          className="group relative bg-emerald-800/50 hover:bg-emerald-800/70 rounded-lg px-2 md:px-3 py-1.5 md:py-2 border border-[#F2E3BB]/30 shadow-md cursor-pointer transition-all min-w-[80px] md:min-w-[100px] text-center"
        >
          <span className="text-[#F2E3BB] text-base md:text-xl font-bold" style={{ fontFamily: "'Amiri', serif" }}>
            {isRTL ? `الجزء ${formatNumber(currentJuz)}` : `Juz ${formatNumber(currentJuz)}`}
          </span>
        </button>
      </div>
    </motion.header>
  );
}
