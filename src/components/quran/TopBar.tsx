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
  /**
   * Whether the surah/juz info reflects the current page yet. On cold start
   * the surah is only resolved asynchronously — while false, the header
   * shows a placeholder instead of flashing the first surah's name.
   */
  isInfoLoaded?: boolean;
  formatNumber: (num: number | string) => string;
  onSurahClick: () => void;
  onPageClick: () => void;
  onJuzClick: () => void;
  theme?: 'green' | 'glass';
  /**
   * Desktop chrome width cap (px) — the width actually occupied by the
   * displayed pages (two-page spread at most), so the top bar aligns with
   * the mushaf content and the bottom bar. Undefined on phones (full width).
   */
  maxWidthPx?: number;
}

export function TopBar({
  currentSurah,
  currentPageNum,
  currentJuz,
  currentAyah,
  isInfoLoaded = true,
  formatNumber,
  onSurahClick,
  onPageClick,
  onJuzClick,
  theme = 'green',
  maxWidthPx,
}: TopBarProps) {
  const { t, isRTL, language } = useLanguage();
  const { isDarkMode } = useDarkMode();

  const isGlassLight = theme === 'glass' && !isDarkMode;
  const primaryText = isGlassLight ? 'text-emerald-800' : 'text-[#F2E3BB]';
  const mutedText = isGlassLight ? 'text-emerald-700/70' : 'text-[#F2E3BB]/70';

  return (
    // Transparent outer strip — ZERO top padding, flush with the top of the
    // screen on every device. On wide screens the bar itself is a centered
    // floating panel; on phones it renders like the old full-bleed band but
    // with no gap above it.
    <div className="w-full flex justify-center md:px-3">
      <header
        className={cn(
          "w-full max-w-4xl md:rounded-b-2xl md:shadow-lg",
          theme === 'glass'
            ? isDarkMode
              ? "bg-black/40 backdrop-blur-xl border-b border-white/10"
              : "bg-[#E7E6E2]/60 backdrop-blur-md border-b border-[#8A8578]/20 md:shadow-[0_2px_12px_rgba(87,70,36,0.08)]"
            : isDarkMode
              ? "bg-emerald-950"
              : "bg-gradient-to-b from-emerald-800 to-emerald-600"
        )}
        // Inline maxWidth (measured pages' width) overrides the max-w-4xl
        // fallback class on desktop; absent on phones.
        style={maxWidthPx ? { maxWidth: `${maxWidthPx}px` } : undefined}
      >
        {/* Main Header */}
        <div className="relative">
          {/* Subtle background gradient - only in light green theme */}
          {!isDarkMode && theme === 'green' && (
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-700/20 to-transparent pointer-events-none" />
          )}
          
          {/* Content */}
          <div className="relative px-4 md:px-6 pt-2.5 pb-1.5 md:pt-1.5 md:pb-1 flex items-center justify-between gap-2" style={{ direction: 'ltr' }}>
            {/* Left Cell - Page Number */}
            <button
              onClick={onPageClick}
              className="flex flex-col items-center gap-0 min-w-[70px] hover:opacity-80 transition-opacity"
            >
              <span 
                className={cn("text-xs", mutedText, "tracking-wide leading-none")}
                style={{ fontFamily: "'Changa', sans-serif" }}
              >
                {t('page')}
              </span>
              <span 
                className={cn("text-xl font-bold", primaryText, "leading-none mt-0.5")}
                style={{ fontFamily: "'Changa', sans-serif" }}
              >
                {formatNumber(currentPageNum)}
              </span>
            </button>

            {/* Separator */}
            <div className="w-[1px] h-9 md:h-7 bg-gradient-to-b from-transparent via-emerald-400/50 to-transparent" />

            {/* Center Cell - Surah Name */}
            <button
              onClick={onSurahClick}
              className="flex-1 flex flex-col items-center justify-center hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-2">
                <span className={cn("text-base", mutedText, "leading-none")}>﴾</span>
                <span
                  className={cn("text-xl font-bold", primaryText, "leading-none")}
                  style={{ fontFamily: "'Changa', sans-serif" }}
                >
                  {isInfoLoaded
                    ? (language === 'ar' ? currentSurah.name : currentSurah.englishName)
                    : '…'}
                </span>
                <span className={cn("text-base", mutedText, "leading-none")}>﴿</span>
              </div>
              {isInfoLoaded && (
              <div className="flex items-center gap-2 mt-0.5">
                {currentAyah && (
                  <>
                    <span 
                      className={cn("text-[10px] md:text-xs", mutedText, "leading-none")}
                      style={{ fontFamily: "'Changa', sans-serif" }}
                    >
                      {t('ayah')} {formatNumber(currentAyah)}
                    </span>
                    <span className={cn("text-[10px]", isGlassLight ? "text-emerald-700/50" : "text-[#F2E3BB]/50")}>-</span>
                  </>
                )}
                <span 
                  className={cn("text-[10px] md:text-xs", mutedText, "leading-none")}
                  style={{ fontFamily: "'Changa', sans-serif" }}
                >
                  {t('surah')} {formatNumber(currentSurah.id)}
                </span>
              </div>
              )}
            </button>

            {/* Separator */}
            <div className="w-[1px] h-9 md:h-7 bg-gradient-to-b from-transparent via-emerald-400/50 to-transparent" />

            {/* Right Cell - Juz Number */}
            <button
              onClick={onJuzClick}
              className="flex flex-col items-center gap-0 min-w-[70px] hover:opacity-80 transition-opacity"
            >
              <span 
                className={cn("text-xs", mutedText, "tracking-wide leading-none")}
                style={{ fontFamily: "'Changa', sans-serif" }}
              >
                {t('juz')}
              </span>
              <span 
                className={cn("text-xl font-bold", primaryText, "leading-none mt-0.5")}
                style={{ fontFamily: "'Changa', sans-serif" }}
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
