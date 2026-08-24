import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { cn } from "@/lib/utils";
import {
  BookOpen, BookOpenCheck, Check, ChevronDown, MapPin,
  Pencil, Play, Sparkles, Trash2,
} from "lucide-react";
import {
  MemorizePlan, MemorizeUnit, MemorizeDirection, QuranBoundaries,
  loadMemorizePlan, saveMemorizePlan, clearMemorizePlan,
  getQuranBoundaries, getTaskSegment, getStats, getSurahFirstPage,
  getTaskDate, getNextTaskIndex, describeSegment, toggleTask,
  resolveAbsIndex, todayKey, daysBetween,
} from "@/lib/memorize";
import { surahs } from "@/data/surahs";
import type { TranslationKey } from "@/i18n/translations";

interface MemorizeViewProps {
  currentPage?: number;
  onNavigateToPage?: (page: number) => void;
}

const UNITS: { id: MemorizeUnit; key: TranslationKey }[] = [
  { id: 'ayah', key: 'memorizeAyahsUnit' },
  { id: 'half-page', key: 'memorizeHalfPage' },
  { id: 'page', key: 'memorizeOnePage' },
  { id: 'two-pages', key: 'memorizeTwoPages' },
  { id: 'rub', key: 'memorizeRub' },
  { id: 'hizb', key: 'memorizeHizb' },
];

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const PAGE_SIZE = 25;

const selectClass =
  "w-full px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100";

export default function MemorizeView({ currentPage = 1, onNavigateToPage }: MemorizeViewProps) {
  const { t, isRTL } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);

  const [boundaries, setBoundaries] = useState<QuranBoundaries | null>(null);
  const [plan, setPlan] = useState<MemorizePlan | null>(null);
  const [mode, setMode] = useState<'view' | 'setup'>('setup');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [formUnit, setFormUnit] = useState<MemorizeUnit>('page');
  const [formAyahsPerDay, setFormAyahsPerDay] = useState(10);
  const [formMemorizeDays, setFormMemorizeDays] = useState(1);
  const [formRestDays, setFormRestDays] = useState(1);
  const [formStartSurah, setFormStartSurah] = useState(1);
  const [formDirection, setFormDirection] = useState<MemorizeDirection>('backward');

  useEffect(() => {
    let alive = true;
    getQuranBoundaries().then(b => {
      if (!alive) return;
      setBoundaries(b);
      const saved = loadMemorizePlan();
      if (saved && saved.version === 8) {
        setPlan(saved);
        applyPlanToForm(saved);
        setMode('view');
      } else {
        const pageIdx = Math.min(Math.max(currentPage, 1), 604) - 1;
        setFormStartSurah(resolveAbsIndex(b.pageStarts[pageIdx]).surah);
      }
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPlanToForm = (p: MemorizePlan) => {
    setFormUnit(p.unit);
    setFormAyahsPerDay(p.ayahsPerDay || 10);
    setFormMemorizeDays(p.memorizeDays);
    setFormRestDays(p.restDays);
    setFormStartSurah(p.startSurah);
    setFormDirection(p.direction);
  };

  const fmt = (n: number | string): string => {
    const s = String(n);
    return isRTL ? s.replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]) : s;
  };

  const surahName = (id: number): string => {
    const s = surahs.find(x => x.id === id);
    if (!s) return '';
    return isRTL ? s.name : s.englishName;
  };

  const formatDateLabel = (key: string): string => {
    const d = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
    if (isRTL) return `${d.getDate()} ${AR_MONTHS[d.getMonth()]}`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const stats = useMemo(
    () => (plan && boundaries ? getStats(plan, boundaries) : null),
    [plan, boundaries]
  );

  const nextTaskIndex = useMemo(
    () => (plan && boundaries ? getNextTaskIndex(plan, boundaries) : 0),
    [plan, boundaries]
  );

  const orderStatement = (direction: MemorizeDirection, startSurah: number): string => {
    if (direction === 'backward') {
      return t('memorizeOrderStatement')
        .replace('{from}', surahName(startSurah))
        .replace('{to}', surahName(1));
    }
    return t('memorizeOrderStatement')
      .replace('{from}', surahName(startSurah))
      .replace('{to}', surahName(114));
  };

  const cycleStatement = (): string => {
    if (formRestDays === 0) return t('memorizeDailyStatement');
    return t('memorizeCycleStatement')
      .replace('{m}', fmt(formMemorizeDays))
      .replace('{r}', fmt(formRestDays));
  };

  const updatePlan = (next: MemorizePlan) => {
    setPlan(next);
    saveMemorizePlan(next);
  };

  const handleCreatePlan = () => {
    const newPlan: MemorizePlan = {
      version: 8,
      createdAt: plan?.createdAt ?? Date.now(),
      startDate: todayKey(),
      startSurah: Math.min(Math.max(formStartSurah, 1), 114),
      unit: formUnit,
      ayahsPerDay: formUnit === 'ayah' ? Math.min(Math.max(formAyahsPerDay, 1), 100) : 0,
      memorizeDays: Math.min(Math.max(formMemorizeDays, 1), 30),
      restDays: Math.min(Math.max(formRestDays, 0), 30),
      direction: formDirection,
      completedTasks: [],
    };
    updatePlan(newPlan);
    setVisibleCount(PAGE_SIZE);
    setMode('view');
  };

  const handleEditClick = () => {
    if (plan) applyPlanToForm(plan);
    setMode('setup');
  };

  const handleDeletePlan = () => {
    if (window.confirm(t('memorizeDeleteConfirm'))) {
      clearMemorizePlan();
      setPlan(null);
      setVisibleCount(PAGE_SIZE);
      setMode('setup');
    }
  };

  const handleToggleTask = (index: number) => {
    if (!plan) return;
    updatePlan(toggleTask(plan, index));
  };

  const chipButtonClass = (active: boolean) =>
    cn(
      "px-3 py-2 rounded-lg border transition-all font-medium",
      textSizeClasses.button,
      active
        ? "bg-emerald-700 text-[#F2E3BB] border-emerald-600 shadow-md"
        : "bg-white dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900"
    );

  // ------------------------------------------------------------------ setup

  const renderSetup = () => (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-2">
        <BookOpenCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
          {t('memorizeQuantity')}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {UNITS.map(u => (
          <button
            key={u.id}
            onClick={() => setFormUnit(u.id)}
            className={chipButtonClass(formUnit === u.id)}
          >
            {t(u.key)}
          </button>
        ))}
      </div>

      {formUnit === 'ayah' && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setFormAyahsPerDay(v => Math.max(1, v - 1))}
            className="w-10 h-10 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xl font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900"
          >−</button>
          <input
            type="number"
            min={1}
            max={100}
            value={formAyahsPerDay}
            onChange={e => setFormAyahsPerDay(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))}
            className="w-24 text-center py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100"
          />
          <button
            onClick={() => setFormAyahsPerDay(v => Math.min(100, v + 1))}
            className="w-10 h-10 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xl font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900"
          >+</button>
        </div>
      )}

      <span className={cn("block font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
        {t('memorizeMemorizeDays')}
      </span>
      <div className="flex flex-wrap justify-center gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map(n => (
          <button key={n} onClick={() => setFormMemorizeDays(n)} className={chipButtonClass(formMemorizeDays === n)}>
            {fmt(n)}
          </button>
        ))}
      </div>

      <span className={cn("block font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
        {t('memorizeRestDays')}
      </span>
      <div className="flex flex-wrap justify-center gap-2">
        {[0, 1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => setFormRestDays(n)} className={chipButtonClass(formRestDays === n)}>
            {n === 0 ? t('memorizeRestNone') : fmt(n)}
          </button>
        ))}
      </div>
      <p className={cn("text-center text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
        {cycleStatement()}
      </p>

      <label className="flex flex-col gap-1">
        <span className={cn("block font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
          {t('memorizeStartFrom')}
        </span>
        <select
          value={formStartSurah}
          onChange={e => setFormStartSurah(parseInt(e.target.value, 10))}
          className={selectClass}
        >
          {surahs.map(s => (
            <option key={s.id} value={s.id}>{`${fmt(s.id)}. ${isRTL ? s.name : s.englishName}`}</option>
          ))}
        </select>
      </label>

      <span className={cn("block font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
        {t('memorizeDirection')}
      </span>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setFormDirection('forward')} className={chipButtonClass(formDirection === 'forward')}>
          {t('memorizeDirForward')}
        </button>
        <button onClick={() => setFormDirection('backward')} className={chipButtonClass(formDirection === 'backward')}>
          {t('memorizeDirBackward')}
        </button>
      </div>
      <p className={cn("text-center text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
        {orderStatement(formDirection, formStartSurah)}
      </p>

      <button
        onClick={handleCreatePlan}
        className={cn(
          "w-full py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-[#F2E3BB] font-semibold shadow-md transition-colors",
          textSizeClasses.button
        )}
      >
        {t('memorizeStartPlan')}
      </button>
    </div>
  );

  // ------------------------------------------------------------------- view

  const renderTaskCard = (index: number) => {
    if (!plan || !boundaries) return null;
    const seg = getTaskSegment(plan, boundaries, index);
    if (!seg) return null;
    const info = describeSegment(seg, boundaries);
    const done = plan.completedTasks.includes(index);
    const dateKey = getTaskDate(plan, index);
    const isNext = index === nextTaskIndex;
    const overdue = !done && daysBetween(dateKey, todayKey()) > 0;

    return (
      <div
        key={index}
        className={cn(
          "flex items-center gap-3 rounded-xl border p-3 transition-colors",
          done
            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700"
            : "bg-white dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
          isNext && !done && "ring-2 ring-emerald-500"
        )}
      >
        {/* Checkbox */}
        <button
          onClick={() => handleToggleTask(index)}
          aria-label={t('memorizeMarkDone')}
          className={cn(
            "w-7 h-7 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-colors",
            done
              ? "bg-emerald-600 border-emerald-600 text-white"
              : "border-emerald-400 dark:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/60"
          )}
        >
          {done && <Check className="w-5 h-5" />}
        </button>

        {/* Content */}
        <button
          onClick={() => handleToggleTask(index)}
          className={cn("flex-1 min-w-0 text-start", textSizeClasses.text)}
        >
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-medium",
              overdue ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"
            )}>
              {formatDateLabel(dateKey)}
            </span>
            {isNext && !done && (
              <span className="text-xs px-2 rounded-full bg-emerald-600 text-white font-medium">
                {t('memorizeNext')}
              </span>
            )}
          </div>
          <p className={cn(
            "font-medium truncate",
            done ? "line-through text-emerald-600 dark:text-emerald-500" : "text-emerald-900 dark:text-emerald-100"
          )}>
            {info.surahFrom === info.surahTo
              ? `${surahName(info.surahFrom)} ${fmt(info.ayahFrom)}–${fmt(info.ayahTo)}`
              : `${surahName(info.surahFrom)} ${fmt(info.ayahFrom)} ← ${surahName(info.surahTo)} ${fmt(info.ayahTo)}`}
          </p>
          <p className={cn("text-xs text-emerald-700 dark:text-emerald-400")}>
            {t('page')} {fmt(info.pageFrom)}{info.pageTo !== info.pageFrom ? `–${fmt(info.pageTo)}` : ''}
            {' • '}
            {info.surahFrom === info.surahTo && formUnit === 'ayah'
              ? `${fmt(info.ayahTo - info.ayahFrom + 1)} ${t('verses')}`
              : t((UNITS.find(u => u.id === plan.unit) as { key: TranslationKey }).key)}
          </p>
        </button>

        {/* Actions: go to surah + start this portion */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button
            onClick={() => onNavigateToPage?.(getSurahFirstPage(boundaries!, info.surahFrom))}
            title={`${t('goToSurah')} — ${surahName(info.surahFrom)}`}
            aria-label={t('goToSurah')}
            className="w-8 h-8 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/60 flex items-center justify-center transition-colors"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigateToPage?.(info.pageFrom)}
            title={t('memorizeStartButton')}
            aria-label={t('memorizeStartButton')}
            className={cn(
              "w-8 h-8 rounded-lg text-[#F2E3BB] flex items-center justify-center shadow-sm transition-colors",
              index === nextTaskIndex && !done ? "bg-emerald-700 hover:bg-emerald-600" : "bg-emerald-600/70 hover:bg-emerald-600"
            )}
          >
            {index === nextTaskIndex && !done ? <Play className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );
  };

  const renderView = () => {
    if (!plan || !boundaries || !stats) return null;

    return (
      <div className="space-y-4 pb-12">
        {/* Header: progress + management */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
              {t('memorizeProgress')}
            </span>
            <span className={cn("text-emerald-700 dark:text-emerald-400", textSizeClasses.text)}>
              {fmt(stats.doneTasks)} / {fmt(stats.totalTasks)} • {fmt(stats.percent)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-emerald-100 dark:bg-emerald-900 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
              style={{ width: `${stats.percent}%` }}
            />
          </div>
          <p className={cn("text-center text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
            {orderStatement(plan.direction, plan.startSurah)}
          </p>
        </section>

        {/* Task cards */}
        <section className="space-y-2">
          {Array.from({ length: Math.min(visibleCount, stats.totalTasks) }, (_, i) => renderTaskCard(i))}

          {visibleCount < stats.totalTasks && (
            <button
              onClick={() => setVisibleCount(c => c + PAGE_SIZE * 2)}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors",
                textSizeClasses.button
              )}
            >
              <ChevronDown className="w-5 h-5" />
              {t('memorizeShowMore')}
            </button>
          )}
        </section>

        {stats.finished && (
          <div className="flex items-center justify-center gap-2 py-2 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="w-5 h-5" />
            <span className={cn("font-medium", textSizeClasses.text)}>
              {t('memorizeCompletedMsg')}
            </span>
          </div>
        )}

        {/* Plan management */}
        <section className="grid grid-cols-2 gap-2">
          <button
            onClick={handleEditClick}
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900 transition-colors",
              textSizeClasses.button
            )}
          >
            <Pencil className="w-4 h-4" />
            {t('memorizeEdit')}
          </button>
          <button
            onClick={handleDeletePlan}
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors",
              textSizeClasses.button
            )}
          >
            <Trash2 className="w-4 h-4" />
            {t('delete')}
          </button>
        </section>
      </div>
    );
  };

  return (
    <div>
      {mode === 'setup' || !plan ? renderSetup() : renderView()}
    </div>
  );
}
