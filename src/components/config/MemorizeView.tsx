import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { cn } from "@/lib/utils";
import {
  Bell, BellOff, BookMarked, BookOpen, BookOpenCheck, CalendarDays, Check, ChevronLeft,
  ChevronRight, FileDown, MapPin, Pencil, Play, Sparkles, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import {
  MemorizePlan, MemorizeUnit, MemorizeDirection, JuzRevisionFrequency,
  QuranBoundaries, SegmentInfo,
  loadMemorizePlan, saveMemorizePlan, clearMemorizePlan,
  getQuranBoundaries, getTaskSegment, getStats, getSurahFirstPage,
  getTaskDate, getNextTaskIndex, describeSegment, toggleTask, toggleRevision,
  toggleJuzRevision, getRevisionRanges, getJuzRevision, getJuzSpan, getDayKind,
  resolveAbsIndex, todayKey, daysBetween,
} from "@/lib/memorize";
import {
  loadReminderSettings, saveReminderSettings, syncMemorizeReminder,
} from "@/lib/memorize-notifications";
import { exportMemorizePlanPdf } from "@/lib/memorize-pdf";
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
const AR_WEEKDAYS = ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'];
const AR_WEEKDAYS_FULL = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REVISION_CHIPS = [0, 5, 10, 20, 40, 60];
const JUZ_FREQS: { id: JuzRevisionFrequency; key: TranslationKey }[] = [
  { id: 'off', key: 'memorizeJuzFreqOff' },
  { id: 'weekly', key: 'memorizeJuzFreqWeekly' },
  { id: 'twice-weekly', key: 'memorizeJuzFreqTwiceWeekly' },
  { id: 'monthly', key: 'memorizeJuzFreqMonthly' },
  { id: 'twice-monthly', key: 'memorizeJuzFreqTwiceMonthly' },
];

const selectClass =
  "w-full min-h-[48px] px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100";

export default function MemorizeView({ currentPage = 1, onNavigateToPage }: MemorizeViewProps) {
  const { t, isRTL } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);

  const [boundaries, setBoundaries] = useState<QuranBoundaries | null>(null);
  const [plan, setPlan] = useState<MemorizePlan | null>(null);
  const [mode, setMode] = useState<'view' | 'setup'>('setup');

  // setup form
  const [formUnit, setFormUnit] = useState<MemorizeUnit>('page');
  const [formAyahsPerDay, setFormAyahsPerDay] = useState(10);
  const [formMemorizeDays, setFormMemorizeDays] = useState(1);
  const [formRestDays, setFormRestDays] = useState(1);
  const [formStartSurah, setFormStartSurah] = useState(1);
  const [formDirection, setFormDirection] = useState<MemorizeDirection>('backward');
  const [formRevisionPages, setFormRevisionPages] = useState(20);
  const [formJuzFrequency, setFormJuzFrequency] = useState<JuzRevisionFrequency>('off');

  // pdf export
  const [exporting, setExporting] = useState(false);

  // calendar
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth()); // 0-based
  const [selectedDay, setSelectedDay] = useState<string>(todayKey());

  // daily reminder (separate times for memorize & revise; same time = one
  // combined notification)
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMemorizeTime, setReminderMemorizeTime] = useState('20:00');
  const [reminderReviseTime, setReminderReviseTime] = useState('20:00');

  useEffect(() => {
    let alive = true;
    getQuranBoundaries().then(b => {
      if (!alive) return;
      setBoundaries(b);
      const saved = loadMemorizePlan();
      if (saved && saved.version === 12) {
        setPlan(saved);
        applyPlanToForm(saved);
        setMode('view');
      } else {
        const pageIdx = Math.min(Math.max(currentPage, 1), 604) - 1;
        setFormStartSurah(resolveAbsIndex(b.pageStarts[pageIdx]).surah);
      }
      const reminder = loadReminderSettings();
      setReminderEnabled(reminder.enabled);
      setReminderMemorizeTime(reminder.memorizeTime);
      setReminderReviseTime(reminder.reviseTime);
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the reminder schedule in sync with the current plan
  // (plan === null cancels every scheduled reminder)
  useEffect(() => {
    if (!boundaries) return;
    syncMemorizeReminder(plan, boundaries).catch(() => {});
  }, [plan, boundaries]);

  const applyPlanToForm = (p: MemorizePlan) => {
    setFormUnit(p.unit);
    setFormAyahsPerDay(p.ayahsPerDay || 10);
    setFormMemorizeDays(p.memorizeDays);
    setFormRestDays(p.restDays);
    setFormStartSurah(p.startSurah);
    setFormDirection(p.direction);
    setFormRevisionPages(p.revisionPages);
    setFormJuzFrequency(p.juzRevisionFrequency);
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

  const formatFullDate = (key: string): string => {
    const d = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
    if (isRTL) return `${AR_WEEKDAYS_FULL[d.getDay()]} ${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const monthLabel = (y: number, m: number): string => {
    if (isRTL) return `${AR_MONTHS[m]} ${y}`;
    return new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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

  /**
   * The day's revision span label. It starts with the most recently
   * memorized side ("من ﴿last memorized﴾ إلى ﴿oldest in the span﴾") and
   * carries the span's start/end page numbers plus the page to open.
   */
  const revisionSpanInfo = (info: SegmentInfo): { label: string; pagesLabel: string; navPage: number } => {
    const forward = plan?.direction === 'forward';
    const fromSurah = forward ? info.surahTo : info.surahFrom;
    const fromAyah = forward ? info.ayahTo : info.ayahFrom;
    const toSurah = forward ? info.surahFrom : info.surahTo;
    const toAyah = forward ? info.ayahFrom : info.ayahTo;
    return {
      label: t('memorizeRevisionRange')
        .replace('{from}', `${surahName(fromSurah)} ${fmt(fromAyah)}`)
        .replace('{to}', `${surahName(toSurah)} ${fmt(toAyah)}`),
      pagesLabel: info.pageFrom === info.pageTo
        ? `${t('page')} ${fmt(info.pageFrom)}`
        : `${t('page')} ${fmt(info.pageFrom)}–${fmt(info.pageTo)}`,
      navPage: forward ? info.pageTo : info.pageFrom,
    };
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
    // Editing without changing the plan content keeps the schedule and
    // progress intact (only the reminder, for example, may have changed).
    const contentUnchanged = !!plan &&
      plan.unit === formUnit &&
      plan.ayahsPerDay === (formUnit === 'ayah' ? Math.min(Math.max(formAyahsPerDay, 1), 100) : 0) &&
      plan.memorizeDays === Math.min(Math.max(formMemorizeDays, 1), 30) &&
      plan.restDays === Math.min(Math.max(formRestDays, 0), 30) &&
      plan.startSurah === Math.min(Math.max(formStartSurah, 1), 114) &&
      plan.direction === formDirection &&
      plan.revisionPages === Math.min(Math.max(formRevisionPages, 0), 604) &&
      plan.juzRevisionFrequency === formJuzFrequency;

    const newPlan: MemorizePlan = {
      version: 12,
      createdAt: plan?.createdAt ?? Date.now(),
      startDate: contentUnchanged && plan ? plan.startDate : todayKey(),
      startSurah: Math.min(Math.max(formStartSurah, 1), 114),
      unit: formUnit,
      ayahsPerDay: formUnit === 'ayah' ? Math.min(Math.max(formAyahsPerDay, 1), 100) : 0,
      memorizeDays: Math.min(Math.max(formMemorizeDays, 1), 30),
      restDays: Math.min(Math.max(formRestDays, 0), 30),
      direction: formDirection,
      revisionPages: Math.min(Math.max(formRevisionPages, 0), 604),
      completedTasks: contentUnchanged && plan ? [...plan.completedTasks] : [],
      completedRevisions: contentUnchanged && plan ? [...plan.completedRevisions] : [],
      juzRevisionFrequency: formJuzFrequency,
      completedJuz: contentUnchanged && plan ? [...plan.completedJuz] : [],
    };
    updatePlan(newPlan);

    // store the reminder times chosen during creation and schedule right away
    const reminderSettings = {
      enabled: reminderEnabled,
      memorizeTime: reminderMemorizeTime,
      reviseTime: reminderReviseTime,
    };
    saveReminderSettings(reminderSettings);
    if (reminderEnabled && boundaries) {
      const ensurePermission = async () => {
        if (!Capacitor.isNativePlatform() && typeof Notification !== 'undefined' && Notification.permission === 'default') {
          return (await Notification.requestPermission()) === 'granted';
        }
        return true;
      };
      ensurePermission()
        .then(() => syncMemorizeReminder(newPlan, boundaries, true))
        .then(result => {
          if (result === 'denied') toast.error(t('memorizeReminderPermissionDenied'));
        })
        .catch(() => {});
    } else {
      syncMemorizeReminder(newPlan, boundaries, false).catch(() => {});
    }

    const d = new Date();
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setSelectedDay(todayKey());
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
      setMode('setup');
    }
  };

  const handleToggleTask = (index: number) => {
    if (!plan) return;
    updatePlan(toggleTask(plan, index));
  };

  const handleToggleRevision = (index: number) => {
    if (!plan) return;
    updatePlan(toggleRevision(plan, index));
  };

  const handleToggleJuz = (dateKey: string) => {
    if (!plan) return;
    updatePlan(toggleJuzRevision(plan, dateKey));
  };

  const handleExportPdf = async () => {
    if (!plan || !boundaries || exporting) return;
    setExporting(true);
    try {
      const result = await exportMemorizePlanPdf(plan, boundaries);
      if (result.ok && result.path) {
        toast.success(t('memorizeExportSaved').replace('{path}', result.path));
      } else if (result.ok) {
        toast.success(t('memorizePdfTitle'));
      } else {
        toast.error(t('memorizeExportFailed'));
      }
    } catch {
      toast.error(t('memorizeExportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const handleToggleReminder = async () => {
    const next = {
      enabled: !reminderEnabled,
      memorizeTime: reminderMemorizeTime,
      reviseTime: reminderReviseTime,
    };
    if (next.enabled && !Capacitor.isNativePlatform() && typeof Notification !== 'undefined') {
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          toast.error(t('memorizeReminderPermissionDenied'));
          return;
        }
      } else if (Notification.permission === 'denied') {
        toast.error(t('memorizeReminderPermissionDenied'));
        return;
      }
    }
    setReminderEnabled(next.enabled);
    saveReminderSettings(next);
    if (plan && boundaries) {
      const result = await syncMemorizeReminder(plan, boundaries, true);
      if (result === 'denied') toast.error(t('memorizeReminderPermissionDenied'));
    }
  };

  const handleReminderTimeChange = (kind: 'memorize' | 'revise', value: string) => {
    if (!value) return;
    if (kind === 'memorize') setReminderMemorizeTime(value);
    else setReminderReviseTime(value);
    saveReminderSettings({
      enabled: reminderEnabled,
      memorizeTime: kind === 'memorize' ? value : reminderMemorizeTime,
      reviseTime: kind === 'revise' ? value : reminderReviseTime,
    });
    if (plan && boundaries && reminderEnabled) {
      syncMemorizeReminder(plan, boundaries, false).catch(() => {});
    }
  };

  const chipButtonClass = (active: boolean) =>
    cn(
      "px-3 py-2 min-h-[44px] rounded-lg border transition-all font-medium active:scale-[0.97]",
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
            aria-label="-"
            className="w-11 h-11 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xl font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900 active:scale-[0.97] transition-all flex items-center justify-center"
          >−</button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={formAyahsPerDay}
            onChange={e => setFormAyahsPerDay(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))}
            className="w-24 min-h-[48px] text-center px-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100"
          />
          <button
            onClick={() => setFormAyahsPerDay(v => Math.min(100, v + 1))}
            aria-label="+"
            className="w-11 h-11 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xl font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900 active:scale-[0.97] transition-all flex items-center justify-center"
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

      {/* Revision of already-memorized pages */}
      <div className="space-y-2 pt-2 border-t border-emerald-100 dark:border-emerald-900">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
            {t('memorizeRevision')} — {t('memorizeMemorizedPages')}
          </span>
        </div>
        <p className={cn("text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
          {t('memorizeMemorizedPagesHint')}
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setFormRevisionPages(v => Math.max(0, v - 5))}
            aria-label="-"
            className="w-11 h-11 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xl font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900 active:scale-[0.97] transition-all flex items-center justify-center"
          >−</button>
          <span className={cn(
            "min-w-[7rem] text-center font-medium px-2 py-3 rounded-lg border",
            formRevisionPages === 0
              ? "text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
              : "text-emerald-900 dark:text-emerald-100 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950"
          )}>
            {formRevisionPages === 0
              ? t('memorizeRevisionNone')
              : t('memorizeLastPages').replace('{n}', fmt(formRevisionPages))}
          </span>
          <button
            onClick={() => setFormRevisionPages(v => Math.min(604, v + 5))}
            aria-label="+"
            className="w-11 h-11 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xl font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900 active:scale-[0.97] transition-all flex items-center justify-center"
          >+</button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {REVISION_CHIPS.map(n => (
            <button
              key={n}
              onClick={() => setFormRevisionPages(n)}
              className={chipButtonClass(formRevisionPages === n)}
            >
              {n === 0 ? t('memorizeRevisionNone') : t('memorizeLastPages').replace('{n}', fmt(n))}
            </button>
          ))}
        </div>
        {formRevisionPages > 0 && (
          <p className={cn("text-center text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
            {t('memorizeRevisionStatement')}
          </p>
        )}
      </div>

      {/* Juz revision: cycling of whole memorized juz (pool derived automatically) */}
      <div className="space-y-2 pt-2 border-t border-emerald-100 dark:border-emerald-900">
        <div className="flex items-center gap-2">
          <BookMarked className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
            {t('memorizeJuzRevision')} — {t('memorizeMemorizedPages')}
          </span>
        </div>
        <p className={cn("text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
          {t('memorizeJuzHint')}
        </p>

        <span className={cn("block font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
          {t('memorizeJuzFreq')}
        </span>
        <div className="flex flex-wrap justify-center gap-2">
          {JUZ_FREQS.map(f => (
            <button
              key={f.id}
              onClick={() => setFormJuzFrequency(f.id)}
              className={chipButtonClass(formJuzFrequency === f.id)}
            >
              {t(f.key)}
            </button>
          ))}
        </div>
      </div>

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

      {/* Daily reminder: separate memorize & revise times */}
      <div className="space-y-2 pt-2 border-t border-emerald-100 dark:border-emerald-900">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setReminderEnabled(v => !v)}
            className={cn(
              "flex items-center gap-2 min-h-[44px] font-medium active:scale-[0.97] transition-all",
              textSizeClasses.button,
              reminderEnabled
                ? "text-emerald-800 dark:text-emerald-200"
                : "text-emerald-500 dark:text-emerald-500"
            )}
          >
            {reminderEnabled
              ? <Bell className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              : <BellOff className="w-5 h-5" />}
            {t('memorizeReminder')}
          </button>
          <div className="flex items-center gap-2">
            <label className={cn("flex flex-col items-center gap-0.5", !reminderEnabled && "opacity-50")}>
              <span className="text-xs text-emerald-600 dark:text-emerald-400">{t('memorize')}</span>
              <input
                type="time"
                value={reminderMemorizeTime}
                onChange={e => setReminderMemorizeTime(e.target.value || '20:00')}
                disabled={!reminderEnabled}
                aria-label={t('memorize')}
                className={cn(
                  "min-h-[40px] px-2 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100",
                  textSizeClasses.button
                )}
              />
            </label>
            <label className={cn("flex flex-col items-center gap-0.5", !reminderEnabled && "opacity-50")}>
              <span className="text-xs text-emerald-600 dark:text-emerald-400">{t('memorizeRevision')}</span>
              <input
                type="time"
                value={reminderReviseTime}
                onChange={e => setReminderReviseTime(e.target.value || '20:00')}
                disabled={!reminderEnabled}
                aria-label={t('memorizeRevision')}
                className={cn(
                  "min-h-[40px] px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100",
                  textSizeClasses.button
                )}
              />
            </label>
          </div>
        </div>
        <p className={cn("text-center text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
          {t('memorizeReminderSetupHint')}
        </p>
      </div>

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

  const portionText = (info: SegmentInfo): string => {
    if (info.surahFrom === info.surahTo) {
      return `${surahName(info.surahFrom)} ${fmt(info.ayahFrom)}–${fmt(info.ayahTo)}`;
    }
    return `${surahName(info.surahFrom)} ${fmt(info.ayahFrom)} ← ${surahName(info.surahTo)} ${fmt(info.ayahTo)}`;
  };

  const pagesText = (info: SegmentInfo): string => {
    return `${t('page')} ${fmt(info.pageFrom)}${info.pageTo !== info.pageFrom ? `–${fmt(info.pageTo)}` : ''}`;
  };

  interface JuzInfo {
    juz: number;
    info: SegmentInfo;
    done: boolean;
  }

  interface DayContent {
    kind: 'memorize' | 'rest' | 'off';
    dateKey: string;
    taskIndex: number;
    memorizeInfo: SegmentInfo | null;
    memorizeDone: boolean;
    isNext: boolean;
    overdue: boolean;
    revisionInfos: SegmentInfo[];
    revisionDone: boolean;
    juzInfo: JuzInfo | null;
    startsLater: boolean;
  }

  const getDayContent = (dateKey: string): DayContent => {
    const base: DayContent = {
      kind: 'off', dateKey, taskIndex: -1,
      memorizeInfo: null, memorizeDone: false, isNext: false, overdue: false,
      revisionInfos: [], revisionDone: false, juzInfo: null, startsLater: false,
    };
    if (!plan || !boundaries) return base;

    // juz revision runs on its own calendar rhythm — any day kind can carry it
    const juz = getJuzRevision(plan, boundaries, dateKey);
    const juzInfo: JuzInfo | null = juz !== null
      ? {
          juz,
          info: describeSegment({ index: 0, ...getJuzSpan(boundaries, juz) }, boundaries),
          done: plan.completedJuz.includes(dateKey),
        }
      : null;

    const kind = getDayKind(plan, dateKey);
    if (kind.type === 'rest') return { ...base, kind: 'rest', juzInfo };
    if (kind.type === 'off') {
      // before the plan starts (future days inside the plan are never 'off')
      return { ...base, juzInfo, startsLater: daysBetween(dateKey, plan.startDate) > 0 };
    }

    const seg = getTaskSegment(plan, boundaries, kind.index);
    if (!seg) {
      // past the final task — the juz cycle can still continue
      return { ...base, juzInfo, startsLater: false };
    }
    const revRanges = getRevisionRanges(plan, boundaries, kind.index);
    const done = plan.completedTasks.includes(kind.index);
    return {
      kind: 'memorize',
      dateKey,
      taskIndex: kind.index,
      memorizeInfo: describeSegment(seg, boundaries),
      memorizeDone: done,
      isNext: kind.index === nextTaskIndex && !done,
      overdue: !done && daysBetween(dateKey, todayKey()) > 0,
      revisionInfos: revRanges.map(r => describeSegment({ index: 0, ...r }, boundaries)),
      revisionDone: revRanges.length > 0 && plan.completedRevisions.includes(kind.index),
      juzInfo,
      startsLater: false,
    };
  };

  // ---------------------------------------------------------------- calendar

  const shiftMonth = (delta: number) => {
    const d = new Date(calYear, calMonth + delta, 1);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  };

  const goToday = () => {
    const d = new Date();
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setSelectedDay(todayKey());
  };

  const renderCalendar = () => {
    const firstWeekday = new Date(calYear, calMonth, 1).getDay(); // 0 = Sunday
    const daysCount = new Date(calYear, calMonth + 1, 0).getDate();
    const weekdays = isRTL ? AR_WEEKDAYS : EN_WEEKDAYS;

    const cells: (string | null)[] = [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: daysCount }, (_, i) => {
        const d = new Date(calYear, calMonth, i + 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }),
    ];

    return (
      <section className="space-y-2">
        {/* Month header */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => shiftMonth(isRTL ? 1 : -1)}
            aria-label={t('memorizePrevMonth')}
            className="w-10 h-10 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900 flex items-center justify-center active:scale-[0.97] transition-all"
          >
            {isRTL ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
          <span className={cn("font-medium text-emerald-900 dark:text-emerald-100", textSizeClasses.label)}>
            {monthLabel(calYear, calMonth)}
          </span>
          <div className="flex items-center gap-2">
            {selectedDay !== todayKey() && (
              <button
                onClick={goToday}
                title={t('memorizeTodayCard')}
                aria-label={t('memorizeTodayCard')}
                className="w-10 h-10 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900 flex items-center justify-center active:scale-[0.97] transition-all"
              >
                <CalendarDays className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => shiftMonth(isRTL ? -1 : 1)}
              aria-label={t('memorizeNextMonth')}
              className="w-10 h-10 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900 flex items-center justify-center active:scale-[0.97] transition-all"
            >
              {isRTL ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1">
          {weekdays.map((w, i) => (
            <span key={i} className={cn("text-center text-xs font-medium text-emerald-600 dark:text-emerald-400 py-1")}>
              {w}
            </span>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((dateKey, i) => {
            if (!dateKey) return <span key={`blank-${i}`} />;
            const content = getDayContent(dateKey);
            const isToday = dateKey === todayKey();
            const isSelected = dateKey === selectedDay;
            const dot =
              content.kind === 'memorize'
                ? content.overdue
                  ? 'bg-red-400'
                  : content.memorizeDone
                    ? 'bg-emerald-400 dark:bg-emerald-500'
                    : 'bg-emerald-700 dark:bg-emerald-400'
                : content.kind === 'rest'
                  ? 'bg-slate-300 dark:bg-emerald-800'
                  : '';
            return (
              <button
                key={dateKey}
                onClick={() => setSelectedDay(dateKey)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-1.5 min-h-[44px] rounded-lg transition-all active:scale-[0.97]",
                  isSelected
                    ? "bg-emerald-100 dark:bg-emerald-900/60 ring-1 ring-emerald-500"
                    : "hover:bg-emerald-50 dark:hover:bg-emerald-900/40",
                  isToday && "ring-2 ring-emerald-500/70"
                )}
              >
                <span className={cn(
                  "text-sm font-medium leading-none",
                  content.kind === 'off'
                    ? "text-emerald-400 dark:text-emerald-600"
                    : "text-emerald-900 dark:text-emerald-100",
                  isToday && "font-bold"
                )}>
                  {fmt(Number(dateKey.slice(8, 10)))}
                </span>
                <span className="flex items-center gap-1">
                  <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
                  {content.juzInfo && (
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-600 dark:bg-violet-400" />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1">
          <span className={cn("flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400")}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 dark:bg-emerald-400" />
            {t('memorizeLegendMemorize')}
          </span>
          <span className={cn("flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400")}>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-emerald-800" />
            {t('memorizeLegendRest')}
          </span>
          <span className={cn("flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400")}>
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            {t('memorizeLegendOverdue')}
          </span>
          <span className={cn("flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400")}>
            <span className="w-1.5 h-1.5 rounded-full bg-violet-600 dark:bg-violet-400" />
            {t('memorizeLegendJuz')}
          </span>
        </div>
      </section>
    );
  };

  // -------------------------------------------------------------- day detail

  const renderDayDetails = (dateKey: string, isToday: boolean) => {
    if (!plan || !boundaries) return null;
    const content = getDayContent(dateKey);

    // whole-juz revision row (its own calendar rhythm — any day kind)
    const juzRow = content.juzInfo && (() => {
      const j = content.juzInfo!;
      return (
        <div className={cn(
          "flex items-center gap-3 rounded-xl border border-violet-200 dark:border-violet-900/60 p-3",
          j.done ? "bg-violet-100/60 dark:bg-violet-900/25" : "bg-violet-50/60 dark:bg-violet-950/20"
        )}>
          <button
            onClick={() => handleToggleJuz(dateKey)}
            aria-label={t('memorizeMarkDone')}
            className={cn(
              "w-10 h-10 flex-shrink-0 rounded-lg border-2 flex items-center justify-center transition-colors active:scale-[0.97]",
              j.done
                ? "bg-violet-600 border-violet-600 text-white"
                : "border-violet-400 dark:border-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/40"
            )}
          >
            {j.done && <Check className="w-5 h-5" />}
          </button>
          <div className={cn("flex-1 min-w-0", textSizeClasses.text)}>
            <span className="text-xs font-semibold text-violet-700 dark:text-violet-400">
              {t('memorizeJuzRevision')}
            </span>
            <p className={cn(
              "font-medium truncate",
              j.done
                ? "line-through text-violet-700/80 dark:text-violet-500/80"
                : "text-emerald-900 dark:text-emerald-100"
            )}>
              {t('memorizeJuzFull').replace('{juz}', fmt(j.juz))}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              {pagesText(j.info)}
            </p>
          </div>
          <button
            onClick={() => onNavigateToPage?.(j.info.pageFrom)}
            title={t('memorizeJuzRevision')}
            aria-label={t('memorizeJuzRevision')}
            className="w-11 h-11 rounded-lg bg-violet-600/80 hover:bg-violet-600 text-white flex items-center justify-center shadow-sm transition-all active:scale-[0.97] flex-shrink-0"
          >
            <MapPin className="w-5 h-5" />
          </button>
        </div>
      );
    })();

    let body: React.ReactNode;
    if (content.kind === 'rest') {
      body = (
        <div className={cn("flex items-center gap-2 py-3 text-emerald-700 dark:text-emerald-400", textSizeClasses.text)}>
          <Sparkles className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium">{t('memorizeRestDay')}</p>
            <p className="text-xs opacity-80">{t('memorizeRestDayMsg')}</p>
          </div>
        </div>
      );
    } else if (!content.memorizeInfo) {
      const msg = content.startsLater
        ? t('memorizePlanStartsOn').replace('{date}', formatDateLabel(plan.startDate))
        : t('memorizeNoTasksDay');
      body = (
        <p className={cn("py-3 text-center text-emerald-700 dark:text-emerald-400", textSizeClasses.text)}>
          {msg}
        </p>
      );
    } else {
      const info = content.memorizeInfo;
      body = (
        <div className="space-y-2">
          {/* Memorize row */}
          <div className={cn(
            "flex items-center gap-3 rounded-xl border p-3",
            content.memorizeDone
              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700"
              : "bg-white dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
          )}>
            <button
              onClick={() => handleToggleTask(content.taskIndex)}
              aria-label={t('memorizeMarkDone')}
              className={cn(
                "w-10 h-10 flex-shrink-0 rounded-lg border-2 flex items-center justify-center transition-colors active:scale-[0.97]",
                content.memorizeDone
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "border-emerald-400 dark:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/60"
              )}
            >
              {content.memorizeDone && <Check className="w-5 h-5" />}
            </button>
            <div className={cn("flex-1 min-w-0", textSizeClasses.text)}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {t('memorizeNewPortion')}
                </span>
                {content.isNext && (
                  <span className="text-xs px-2 rounded-full bg-emerald-600 text-white font-medium">
                    {t('memorizeNext')}
                  </span>
                )}
                {content.overdue && (
                  <span className="text-xs px-2 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 font-medium">
                    {t('memorizeLegendOverdue')}
                  </span>
                )}
              </div>
              <p className={cn(
                "font-medium truncate",
                content.memorizeDone
                  ? "line-through text-emerald-600 dark:text-emerald-500"
                  : "text-emerald-900 dark:text-emerald-100"
              )}>
                {portionText(info)}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {pagesText(info)}
                {' • '}
                {info.surahFrom === info.surahTo && plan.unit === 'ayah'
                  ? `${fmt(info.ayahTo - info.ayahFrom + 1)} ${t('verses')}`
                  : t((UNITS.find(u => u.id === plan.unit) as { key: TranslationKey }).key)}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <button
                onClick={() => onNavigateToPage?.(getSurahFirstPage(boundaries!, info.surahFrom))}
                title={`${t('goToSurah')} — ${surahName(info.surahFrom)}`}
                aria-label={t('goToSurah')}
                className="w-11 h-11 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/60 active:scale-[0.97] flex items-center justify-center transition-all"
              >
                <BookOpen className="w-5 h-5" />
              </button>
              <button
                onClick={() => onNavigateToPage?.(info.pageFrom)}
                title={t('memorizeStartButton')}
                aria-label={t('memorizeStartButton')}
                className={cn(
                  "w-11 h-11 rounded-lg text-[#F2E3BB] flex items-center justify-center shadow-sm transition-all active:scale-[0.97]",
                  content.isNext ? "bg-emerald-700 hover:bg-emerald-600" : "bg-emerald-600/70 hover:bg-emerald-600"
                )}
              >
                <Play className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Revise row: 1 range normally, 2 when midway through a surah */}
          {content.revisionInfos.length > 0 && (() => {
            const spans = content.revisionInfos.map(revisionSpanInfo);
            return (
              <div className={cn(
                "flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-900/60 p-3",
                content.revisionDone ? "bg-amber-100/60 dark:bg-amber-900/25" : "bg-amber-50/60 dark:bg-amber-950/20"
              )}>
                <button
                  onClick={() => handleToggleRevision(content.taskIndex)}
                  aria-label={t('memorizeMarkDone')}
                  className={cn(
                    "w-10 h-10 flex-shrink-0 rounded-lg border-2 flex items-center justify-center transition-colors active:scale-[0.97]",
                    content.revisionDone
                      ? "bg-amber-600 border-amber-600 text-white"
                      : "border-amber-400 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  )}
                >
                  {content.revisionDone && <Check className="w-5 h-5" />}
                </button>
                <div className={cn("flex-1 min-w-0", textSizeClasses.text)}>
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    {t('memorizeRevisePortion')}
                  </span>
                  <p className={cn(
                    "font-medium truncate",
                    content.revisionDone
                      ? "line-through text-amber-700/80 dark:text-amber-500/80"
                      : "text-emerald-900 dark:text-emerald-100"
                  )}>
                    {spans.map(s => s.label).join(' • ')}
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 truncate">
                    {spans.map(s => s.pagesLabel).join(' • ')}
                  </p>
                </div>
                <button
                  onClick={() => onNavigateToPage?.(spans[0].navPage)}
                  title={t('memorizeRevisePortion')}
                  aria-label={t('memorizeRevisePortion')}
                  className="w-11 h-11 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white flex items-center justify-center shadow-sm transition-all active:scale-[0.97] flex-shrink-0"
                >
                  <MapPin className="w-5 h-5" />
                </button>
              </div>
            );
          })()}

          {juzRow}
        </div>
      );
    }

    const juzOutside = !!juzRow && !(content.kind === 'memorize' && content.memorizeInfo);

    return (
      <section className={cn(
        "rounded-xl border p-3 space-y-1",
        isToday
          ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50/60 dark:bg-emerald-900/30"
          : "border-emerald-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40"
      )}>
        <div className="flex items-center justify-between gap-2 pb-1">
          <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
            {isToday ? t('memorizeTodayCard') : formatDateLabel(dateKey)}
          </span>
          <span className={cn("text-xs text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
            {formatFullDate(dateKey)}
          </span>
        </div>
        <div className={cn(juzOutside && "space-y-2")}>
          {body}
          {juzOutside && juzRow}
        </div>
      </section>
    );
  };

  const renderView = () => {
    if (!plan || !boundaries || !stats) return null;
    const today = todayKey();

    return (
      <div className="space-y-4 pb-12">
        {/* Plan management */}
        <section className="grid grid-cols-3 gap-2">
          <button
            onClick={handleEditClick}
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900 active:scale-[0.97] transition-all",
              textSizeClasses.button
            )}
          >
            <Pencil className="w-4 h-4" />
            {t('memorizeEdit')}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900 active:scale-[0.97] transition-all disabled:opacity-60",
              textSizeClasses.button
            )}
          >
            <FileDown className={cn("w-4 h-4", exporting && "animate-pulse")} />
            {t('memorizeExportPdf')}
          </button>
          <button
            onClick={handleDeletePlan}
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 active:scale-[0.97] transition-all",
              textSizeClasses.button
            )}
          >
            <Trash2 className="w-4 h-4" />
            {t('delete')}
          </button>
        </section>

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
          {plan.revisionPages > 0 && (
            <p className={cn("text-center text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
              {t('memorizeLastPages').replace('{n}', fmt(plan.revisionPages))}
            </p>
          )}
        </section>

        {/* Daily reminder */}
        <section className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40 p-3">
          <button
            onClick={handleToggleReminder}
            className={cn(
              "flex items-center gap-2 min-h-[44px] font-medium active:scale-[0.97] transition-all",
              textSizeClasses.button,
              reminderEnabled
                ? "text-emerald-800 dark:text-emerald-200"
                : "text-emerald-500 dark:text-emerald-500"
            )}
          >
            {reminderEnabled
              ? <Bell className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              : <BellOff className="w-5 h-5" />}
            {t('memorizeReminder')}
          </button>
          {reminderEnabled && (
            <div className="flex items-center gap-2">
              <label className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-emerald-600 dark:text-emerald-400">{t('memorize')}</span>
                <input
                  type="time"
                  value={reminderMemorizeTime}
                  onChange={e => handleReminderTimeChange('memorize', e.target.value)}
                  aria-label={t('memorize')}
                  className={cn(
                    "min-h-[40px] px-2 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100",
                    textSizeClasses.button
                  )}
                />
              </label>
              <label className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-amber-700 dark:text-amber-400">{t('memorizeRevision')}</span>
                <input
                  type="time"
                  value={reminderReviseTime}
                  onChange={e => handleReminderTimeChange('revise', e.target.value)}
                  aria-label={t('memorizeRevision')}
                  className={cn(
                    "min-h-[40px] px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100",
                    textSizeClasses.button
                  )}
                />
              </label>
            </div>
          )}
        </section>

        {/* Today */}
        {renderDayDetails(today, true)}

        {/* Calendar */}
        {renderCalendar()}

        {/* Selected day */}
        {selectedDay !== today && renderDayDetails(selectedDay, false)}

        {stats.finished && (
          <div className="flex items-center justify-center gap-2 py-2 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="w-5 h-5" />
            <span className={cn("font-medium", textSizeClasses.text)}>
              {t('memorizeCompletedMsg')}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {mode === 'setup' || !plan ? renderSetup() : renderView()}
    </div>
  );
}
