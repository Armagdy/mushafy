import { useLanguage } from '@/contexts/LanguageContext';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { cn } from '@/lib/utils';

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
  currentAyah: number | null;
  formatNumber: (num: number | string) => string;
  onSurahClick: () => void;
  onPageClick: () => void;
  onJuzClick: () => void;
}

export function TopBar({
  currentSurah,
  currentPageNum,
  currentJuz,
  currentAyah,
  formatNumber,
  onSurahClick,
  onPageClick,
  onJuzClick,
}: TopBarProps) {
  const { t, isRTL, language } = useLanguage();
  const { isDarkMode } = useDarkMode();

  return (
    <div className={cn(
      "w-full flex justify-center pt-8",
      isDarkMode 
        ? "bg-emerald-950" 
        : "bg-gradient-to-b from-emerald-800 to-emerald-600"
    )}>
      <header className="w-full max-w-[1600px]">
        {/* Main Header */}
        <div className="relative">
          {/* Subtle background gradient - only in light mode */}
          {!isDarkMode && (
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-700/20 to-transparent pointer-events-none" />
          )}
          
          {/* Content */}
          <div className="relative px-4 md:px-8 pt-2.5 pb-1.5 md:pt-3 md:pb-2 flex items-center justify-between gap-2" style={{ direction: 'ltr' }}>
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
              className="flex-1 flex flex-col items-center justify-center hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-2">
                <span className="text-base text-[#F2E3BB]/70 leading-none">﴾</span>
                <span 
                  className="text-xl md:text-2xl font-bold text-[#F2E3BB] leading-none"
                  style={{ fontFamily: "'Scheherazade New', 'Amiri', serif" }}
                >
                  {language === 'ar' ? currentSurah.name : currentSurah.englishName}
                </span>
                <span className="text-base text-[#F2E3BB]/70 leading-none">﴿</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {currentAyah && (
                  <>
                    <span 
                      className="text-[10px] md:text-xs text-[#F2E3BB]/70 leading-none"
                      style={{ fontFamily: "'Scheherazade New', 'Amiri', serif" }}
                    >
                      {t('ayah')} {formatNumber(currentAyah)}
                    </span>
                    <span className="text-[10px] text-[#F2E3BB]/50">-</span>
                  </>
                )}
                <span 
                  className="text-[10px] md:text-xs text-[#F2E3BB]/70 leading-none"
                  style={{ fontFamily: "'Scheherazade New', 'Amiri', serif" }}
                >
                  {t('surah')} {formatNumber(currentSurah.id)}
                </span>
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
      </header>
    </div>
  );
}
