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
  const { t, isRTL, language } = useLanguage();

  return (
    <div className="w-full flex justify-center bg-gradient-to-b from-emerald-800 to-emerald-600" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="w-full max-w-[1600px]"
      >
        {/* Main Header */}
        <div className="relative">
          {/* Subtle background gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-700/20 to-transparent pointer-events-none" />
          
          {/* Content */}
          <div className="relative px-4 md:px-8 py-2.5 md:py-3 flex items-center justify-between gap-2" style={{ direction: 'ltr' }}>
            {/* Left Cell - Page Number */}
            <button
              onClick={onPageClick}
              className="flex flex-col items-center gap-0 min-w-[70px] hover:opacity-80 transition-opacity"
            >
              <span 
                className="text-xs text-[#F2E3BB]/70 tracking-wide leading-none"
                style={{ fontFamily: "'Scheherazade New', 'Amiri', serif" }}
              >
                {t('page')}
              </span>
              <span 
                className="text-xl md:text-2xl font-bold text-[#F2E3BB] leading-none mt-0.5"
                style={{ fontFamily: "'Scheherazade New', 'Amiri', serif" }}
              >
                {formatNumber(currentPageNum)}
              </span>
            </button>

            {/* Separator */}
            <div className="w-[1px] h-9 bg-gradient-to-b from-transparent via-emerald-400/50 to-transparent" />

            {/* Center Cell - Surah Name */}
            <button
              onClick={onSurahClick}
              className="flex-1 flex items-center justify-center hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-2">
                <span className="text-base text-[#F2E3BB]/70 leading-none">﴾</span>
                <span 
                  className="text-2xl md:text-3xl font-bold text-[#F2E3BB] leading-none"
                  style={{ fontFamily: "'Scheherazade New', 'Amiri', serif" }}
                >
                  {language === 'ar' ? currentSurah.name : currentSurah.englishName}
                </span>
                <span className="text-base text-[#F2E3BB]/70 leading-none">﴿</span>
              </div>
            </button>

            {/* Separator */}
            <div className="w-[1px] h-9 bg-gradient-to-b from-transparent via-emerald-400/50 to-transparent" />

            {/* Right Cell - Juz Number */}
            <button
              onClick={onJuzClick}
              className="flex flex-col items-center gap-0 min-w-[70px] hover:opacity-80 transition-opacity"
            >
              <span 
                className="text-xs text-[#F2E3BB]/70 tracking-wide leading-none"
                style={{ fontFamily: "'Scheherazade New', 'Amiri', serif" }}
              >
                {t('juz')}
              </span>
              <span 
                className="text-xl md:text-2xl font-bold text-[#F2E3BB] leading-none mt-0.5"
                style={{ fontFamily: "'Scheherazade New', 'Amiri', serif" }}
              >
                {formatNumber(currentJuz)}
              </span>
            </button>
          </div>
        </div>
      </motion.header>
    </div>
  );
}
