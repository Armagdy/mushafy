import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, ChevronLeft, RotateCcw, Sunrise, MoonStar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { azkarSabah, azkarMasa, Dhikr } from '@/data/azkar';

type AzkarTab = 'sabah' | 'masa';

export default function Azkar() {
  const navigate = useNavigate();
  const { t, isRTL, language } = useLanguage();

  const [tab, setTab] = useState<AzkarTab>(() =>
    typeof window !== 'undefined' && new Date().getHours() >= 15 ? 'masa' : 'sabah'
  );
  const [progress, setProgress] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  const azkarList = tab === 'sabah' ? azkarSabah : azkarMasa;

  const completedCount = useMemo(
    () => azkarList.filter((d) => (progress[d.id] ?? 0) >= d.count).length,
    [azkarList, progress]
  );
  const totalCount = azkarList.length;

  const formatNumber = (num: number): string => {
    if (language === 'ar') {
      return num.toString().replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
    }
    return num.toString();
  };

  const incrementDhikr = (dhikr: Dhikr) => {
    setProgress((prev) => {
      const current = prev[dhikr.id] ?? 0;
      if (current >= dhikr.count) return prev;
      return { ...prev, [dhikr.id]: current + 1 };
    });
  };

  const resetProgress = () => {
    setProgress({});
  };

  return (
    <div className={cn('h-full overflow-hidden bg-[#FBF9F4] dark:bg-black', isRTL ? 'rtl' : 'ltr')}>
      <div className="h-full flex flex-col max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-between mb-4 pt-6 shrink-0">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-800 to-emerald-600 bg-clip-text text-transparent">
            {t('azkar')}
          </h1>
          <div className="flex items-center gap-3">
            <Button
              onClick={resetProgress}
              aria-label={t('azkarReset')}
              className="bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB] w-10 h-10 p-0 flex items-center justify-center"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => navigate('/')}
              className="bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB] w-10 h-10 p-0 flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3 shrink-0">
          <button
            onClick={() => setTab('sabah')}
            className={cn(
              'flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all font-medium shadow-sm',
              tab === 'sabah'
                ? 'bg-emerald-700 text-[#F2E3BB] border-emerald-600'
                : 'bg-white dark:bg-gray-800 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900'
            )}
          >
            <Sunrise className="w-5 h-5" />
            <span>{t('azkarMorning')}</span>
          </button>
          <button
            onClick={() => setTab('masa')}
            className={cn(
              'flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all font-medium shadow-sm',
              tab === 'masa'
                ? 'bg-emerald-700 text-[#F2E3BB] border-emerald-600'
                : 'bg-white dark:bg-gray-800 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900'
            )}
          >
            <MoonStar className="w-5 h-5" />
            <span>{t('azkarEvening')}</span>
          </button>
        </div>

        <p className="text-center text-sm text-emerald-600 dark:text-emerald-400 mb-4 shrink-0">
          {tab === 'sabah' ? t('azkarMorningTime') : t('azkarEveningTime')}
        </p>

        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="flex-1 h-2 rounded-full bg-emerald-100 dark:bg-emerald-900 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
              style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
            {formatNumber(completedCount)} / {formatNumber(totalCount)}
          </span>
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pb-6">
          {azkarList.map((dhikr) => {
            const current = progress[dhikr.id] ?? 0;
            const isDone = current >= dhikr.count;

            return (
              <Card
                key={dhikr.id}
                onClick={() => incrementDhikr(dhikr)}
                className={cn(
                  'p-5 cursor-pointer select-none transition-all duration-200 active:scale-[0.99]',
                  isDone
                    ? 'bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-500/60 shadow-md'
                    : 'bg-white dark:bg-gray-800 border-0 shadow-md hover:shadow-lg'
                )}
              >
                <div className="flex flex-col items-center gap-4">
                  <p
                    dir="rtl"
                    lang="ar"
                    className={cn(
                      'text-center leading-loose',
                      dhikr.quran ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl',
                      isDone
                        ? 'text-emerald-800 dark:text-emerald-200'
                        : 'text-emerald-950 dark:text-emerald-100'
                    )}
                    style={{ fontFamily: dhikr.quran ? "'Scheherazade New', 'Amiri', serif" : "'Noto Sans Arabic', 'Segoe UI', sans-serif" }}
                  >
                    {dhikr.text}
                  </p>

                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold',
                        isDone
                          ? 'bg-emerald-600 text-[#F2E3BB]'
                          : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                      )}
                    >
                      {isDone ? (
                        <>
                          <Check className="w-4 h-4" />
                          {t('azkarDone')}
                        </>
                      ) : dhikr.count === 1 ? (
                        t('azkarTapToMark')
                      ) : (
                        `${formatNumber(current + 1)} / ${formatNumber(dhikr.count)}`
                      )}
                    </span>
                  </div>

                  {dhikr.virtue && (
                    <p
                      dir="rtl"
                      lang="ar"
                      className="text-sm md:text-base text-center text-emerald-700/80 dark:text-emerald-300/70 border-t border-emerald-100 dark:border-emerald-800 pt-3 w-full leading-relaxed"
                    >
                      {dhikr.virtue}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
