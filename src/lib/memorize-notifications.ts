/**
 * Memorize/revision daily reminders (تذكير الحفظ والمراجعة).
 *
 * The user picks two daily times — one for the new memorization portion and
 * one for the revision portion. When both times are the same, a single
 * combined notification carries both portions; when they differ, each is
 * sent separately at its own time.
 *
 *  - Native (Capacitor/Android): @capacitor/local-notifications, scheduling
 *    the next `DAYS_AHEAD` days individually (each with its own computed
 *    body) so the message always matches the day. Re-synced whenever the
 *    plan, settings or language change.
 *  - Web (PWA): the Notification API through the registered service worker,
 *    driven by a lightweight ticker while the app is open.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Language, translations } from '@/i18n/translations';
import { surahs } from '@/data/surahs';
import {
  MemorizePlan, QuranBoundaries, SegmentInfo, RevisionRange,
  getDayKind, getTaskSegment, getRevisionRanges, getJuzRevision, describeSegment,
  todayKey, addDaysToKey,
} from './memorize';

export interface MemorizeReminderSettings {
  enabled: boolean;
  /** 'HH:MM' 24h local time for the memorize portion */
  memorizeTime: string;
  /** 'HH:MM' 24h local time for the revision portion */
  reviseTime: string;
}

const STORAGE_KEY = 'quran-memorize-reminder';
const LAST_MEM_FIRE_KEY = 'quran-memorize-reminder-last-mem';
const LAST_REV_FIRE_KEY = 'quran-memorize-reminder-last-rev';
const DEFAULT_TIME = '20:00';
const DEFAULT_SETTINGS: MemorizeReminderSettings = {
  enabled: false,
  memorizeTime: DEFAULT_TIME,
  reviseTime: DEFAULT_TIME,
};

/** How many days to keep scheduled natively at once. */
const DAYS_AHEAD = 14;
/** Local notification ids we own (audio/other features use lower ids). */
const MEM_ID_BASE = 70000;
const REV_ID_BASE = 71000;
const ID_MAX = 79999;

export function loadReminderSettings(): MemorizeReminderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<MemorizeReminderSettings> & { time?: string };
    // migrate the old single-time shape: both times fall back to it
    const legacyTime = isValidTime(parsed.time) ? parsed.time! : DEFAULT_TIME;
    return {
      enabled: !!parsed.enabled,
      memorizeTime: isValidTime(parsed.memorizeTime) ? parsed.memorizeTime! : legacyTime,
      reviseTime: isValidTime(parsed.reviseTime) ? parsed.reviseTime! : legacyTime,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveReminderSettings(settings: MemorizeReminderSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function isValidTime(v: unknown): v is string {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

function currentLanguage(): Language {
  return localStorage.getItem('quran-app-language') === 'en' ? 'en' : 'ar';
}

function surahName(id: number, lang: Language): string {
  const s = surahs.find(x => x.id === id);
  return s ? (lang === 'ar' ? s.name : s.englishName) : '';
}

function fmtNum(n: number, lang: Language): string {
  const s = String(n);
  return lang === 'ar' ? s.replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]) : s;
}

function portionLabel(info: SegmentInfo, lang: Language): string {
  const t = translations[lang];
  const name = surahName(info.surahFrom, lang);
  const pages = info.pageFrom === info.pageTo
    ? `${t.page} ${fmtNum(info.pageFrom, lang)}`
    : `${t.page} ${fmtNum(info.pageFrom, lang)}–${fmtNum(info.pageTo, lang)}`;
  const ayahs = info.surahFrom === info.surahTo
    ? `${fmtNum(info.ayahFrom, lang)}–${fmtNum(info.ayahTo, lang)}`
    : `${fmtNum(info.ayahFrom, lang)} ← ${fmtNum(info.ayahTo, lang)}`;
  return `${name} ${ayahs} • ${pages}`;
}

export interface ReminderContent {
  title: string;
  body: string;
}

/** Notification text for the day's NEW memorization portion (or null). */
export function buildMemorizeReminder(plan: MemorizePlan, b: QuranBoundaries, dateKey: string): ReminderContent | null {
  const lang = currentLanguage();
  const t = translations[lang];
  const kind = getDayKind(plan, dateKey);
  if (kind.type !== 'memorize') return null;
  const seg = getTaskSegment(plan, b, kind.index);
  if (!seg) return null;
  return {
    title: t.memorizeReminderMemorizeTitle,
    body: t.memorizeReminderMemorize.replace('{portion}', portionLabel(describeSegment(seg, b), lang)),
  };
}

/** Notification text for the day's REVISION (pages and whole juz, or null). */
export function buildReviseReminder(plan: MemorizePlan, b: QuranBoundaries, dateKey: string): ReminderContent | null {
  const lang = currentLanguage();
  const t = translations[lang];
  const kind = getDayKind(plan, dateKey);
  // the juz cycle runs on its own rhythm and can land on rest days too
  const ranges = kind.type === 'memorize' ? getRevisionRanges(plan, b, kind.index) : [];
  const juz = getJuzRevision(plan, b, dateKey);
  if (ranges.length === 0 && juz === null) return null;

  const lines: string[] = ranges.map((r: RevisionRange) =>
    t.memorizeReminderRevise.replace('{portion}', portionLabel(describeSegment({ index: 0, ...r }, b), lang)));
  if (juz !== null) {
    lines.push(t.memorizeReminderJuz.replace('{juz}', fmtNum(juz, lang)));
  }
  return {
    title: t.memorizeReminderReviseTitle,
    body: lines.join('\n'),
  };
}

/** Combined memorize+revise message (used when both times are equal). */
export function buildDayReminder(plan: MemorizePlan, b: QuranBoundaries, dateKey: string): ReminderContent | null {
  const lang = currentLanguage();
  const t = translations[lang];
  const memo = buildMemorizeReminder(plan, b, dateKey);
  const rev = buildReviseReminder(plan, b, dateKey);
  if (!memo && !rev) return null;
  const lines: string[] = [];
  if (memo) lines.push(memo.body);
  if (rev) lines.push(rev.body);
  return { title: t.memorizeReminderTitle, body: lines.join('\n') };
}

async function cancelOurNotifications(): Promise<void> {
  try {
    const { notifications } = await LocalNotifications.getPending();
    const ours = notifications.filter(n => n.id >= MEM_ID_BASE && n.id <= ID_MAX);
    if (ours.length > 0) {
      await LocalNotifications.cancel({ notifications: ours });
    }
  } catch {
    // platform not ready — ignore
  }
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function dateAtTime(dateKey: string, minutes: number): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0);
}

/**
 * Re-sync the reminders with the current plan/settings. Call whenever the
 * plan, reminder settings or (on native) app start changes.
 * `requestPermission` should only be true from a user gesture (e.g. toggling
 * the reminder on) so the OS permission dialog is never a surprise.
 * Returns 'denied' when the user refused notification permission.
 */
export async function syncMemorizeReminder(
  plan: MemorizePlan | null,
  boundaries: QuranBoundaries | null,
  requestPermission = false
): Promise<'ok' | 'denied' | 'skipped'> {
  const settings = loadReminderSettings();

  if (Capacitor.isNativePlatform()) {
    await cancelOurNotifications();
    if (!plan || !boundaries || !settings.enabled) return 'skipped';

    let granted = false;
    try {
      const current = await LocalNotifications.checkPermissions();
      if (current.display === 'granted') granted = true;
      else if (requestPermission) {
        granted = (await LocalNotifications.requestPermissions()).display === 'granted';
      }
    } catch {
      granted = false;
    }
    if (!granted) return 'denied';

    const sameTime = settings.memorizeTime === settings.reviseTime;
    const memMinutes = parseTimeToMinutes(settings.memorizeTime);
    const revMinutes = parseTimeToMinutes(settings.reviseTime);
    const todayMinutes = new Date().getHours() * 60 + new Date().getMinutes();

    const notifications: {
      id: number; title: string; body: string;
      schedule: { at: Date; allowWhileIdle: boolean };
    }[] = [];

    for (let i = 0; i < DAYS_AHEAD; i++) {
      // start today (if the time is still ahead) otherwise tomorrow
      const dateKey = addDaysToKey(todayKey(), i === 0 && todayMinutes >= Math.max(memMinutes, revMinutes) ? 1 : i);

      if (sameTime) {
        const content = buildDayReminder(plan, boundaries, dateKey);
        if (!content) continue;
        const at = dateAtTime(dateKey, memMinutes);
        if (at.getTime() <= Date.now()) continue;
        notifications.push({
          id: MEM_ID_BASE + i,
          title: content.title,
          body: content.body,
          schedule: { at, allowWhileIdle: true },
        });
      } else {
        const memo = buildMemorizeReminder(plan, boundaries, dateKey);
        if (memo) {
          const at = dateAtTime(dateKey, memMinutes);
          if (at.getTime() > Date.now()) {
            notifications.push({
              id: MEM_ID_BASE + i,
              title: memo.title,
              body: memo.body,
              schedule: { at, allowWhileIdle: true },
            });
          }
        }
        const rev = buildReviseReminder(plan, boundaries, dateKey);
        if (rev) {
          const at = dateAtTime(dateKey, revMinutes);
          if (at.getTime() > Date.now()) {
            notifications.push({
              id: REV_ID_BASE + i,
              title: rev.title,
              body: rev.body,
              schedule: { at, allowWhileIdle: true },
            });
          }
        }
      }
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
    return 'ok';
  }

  // Web/PWA: a ticker checks the clock while the app is open.
  restartWebTicker(plan, boundaries, settings);
  return 'ok';
}

// ---------------------------------------------------------------------------
// Web (PWA) ticker
// ---------------------------------------------------------------------------

let tickerId: ReturnType<typeof setInterval> | null = null;
let tickerPlan: MemorizePlan | null = null;
let tickerBoundaries: QuranBoundaries | null = null;

function restartWebTicker(
  plan: MemorizePlan | null,
  boundaries: QuranBoundaries | null,
  settings: MemorizeReminderSettings
): void {
  tickerPlan = plan;
  tickerBoundaries = boundaries;
  if (tickerId !== null) {
    clearInterval(tickerId);
    tickerId = null;
  }
  if (!plan || !boundaries || !settings.enabled) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  tickerId = setInterval(checkWebReminder, 30_000);
  checkWebReminder();
}

function markFired(key: string, dayKey: string): void {
  try { localStorage.setItem(key, dayKey); } catch { /* ignore */ }
}

function showWebNotification(content: ReminderContent): void {
  navigator.serviceWorker?.ready
    .then(registration => registration.showNotification(content.title, {
      body: content.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: `memorize-reminder-${content.title}`,
    }))
    .catch(() => {
      try { new Notification(content.title, { body: content.body }); } catch { /* ignore */ }
    });
}

function checkWebReminder(): void {
  try {
    const settings = loadReminderSettings();
    if (!settings.enabled || !tickerPlan || !tickerBoundaries) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const memMinutes = parseTimeToMinutes(settings.memorizeTime);
    const revMinutes = parseTimeToMinutes(settings.reviseTime);
    const sameTime = settings.memorizeTime === settings.reviseTime;
    const dayKey = todayKey();

    let memFired = localStorage.getItem(LAST_MEM_FIRE_KEY) === dayKey;
    let revFired = localStorage.getItem(LAST_REV_FIRE_KEY) === dayKey;

    if (nowMinutes >= memMinutes && !memFired) {
      if (sameTime) {
        const combined = buildDayReminder(tickerPlan, tickerBoundaries, dayKey);
        if (combined) showWebNotification(combined);
        markFired(LAST_MEM_FIRE_KEY, dayKey);
        markFired(LAST_REV_FIRE_KEY, dayKey);
        return;
      }
      const memo = buildMemorizeReminder(tickerPlan, tickerBoundaries, dayKey);
      if (memo) showWebNotification(memo);
      markFired(LAST_MEM_FIRE_KEY, dayKey);
      memFired = true;
    }

    if (!sameTime && nowMinutes >= revMinutes && !revFired) {
      const rev = buildReviseReminder(tickerPlan, tickerBoundaries, dayKey);
      if (rev) showWebNotification(rev);
      markFired(LAST_REV_FIRE_KEY, dayKey);
      revFired = true;
    }

    // nothing left to fire today — make sure the flags are set so we stop
    if (nowMinutes >= Math.max(memMinutes, revMinutes) && memFired && revFired) return;
    if (!tickerPlan || !tickerBoundaries) return;
  } catch {
    // never crash the app over a reminder
  }
}
