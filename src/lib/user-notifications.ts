/**
 * Daily user notifications (تنبيهات) — reading, listening, revision and
 * dhikr times chosen by the user in Settings, plus fully custom reminders
 * with a user-defined name, message and time.
 *
 *  - Native (Capacitor/Android): @capacitor/local-notifications, scheduling
 *    the next `DAYS_AHEAD` days individually. Re-synced whenever the
 *    settings change and on app start.
 *  - Web (PWA): the Notification API through the registered service worker,
 *    driven by a lightweight ticker while the app is open.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Language, translations } from '@/i18n/translations';

export type UserNotificationKind = 'reading' | 'listening' | 'revise' | 'zekr';

export interface UserNotificationItem {
  enabled: boolean;
  /** 'HH:MM' 24h local time */
  time: string;
}

/** A user-defined reminder with custom name, message and time. */
export interface UserCustomNotification {
  /** stable unique key (generated) */
  id: string;
  /** numeric slot used to derive native notification ids */
  idNum: number;
  /** shown as the notification title */
  name: string;
  /** shown as the notification body */
  text: string;
  enabled: boolean;
  /** 'HH:MM' 24h local time */
  time: string;
}

export interface UserNotificationSettings {
  reading: UserNotificationItem;
  listening: UserNotificationItem;
  revise: UserNotificationItem;
  zekr: UserNotificationItem;
  customs: UserCustomNotification[];
}

export const USER_NOTIFICATION_KINDS: UserNotificationKind[] = ['reading', 'listening', 'revise', 'zekr'];

const DEFAULT_TIMES: Record<UserNotificationKind, string> = {
  reading: '06:00',
  listening: '20:00',
  revise: '16:00',
  zekr: '07:00',
};

export const DEFAULT_USER_NOTIFICATIONS: UserNotificationSettings = {
  reading: { enabled: false, time: DEFAULT_TIMES.reading },
  listening: { enabled: false, time: DEFAULT_TIMES.listening },
  revise: { enabled: false, time: DEFAULT_TIMES.revise },
  zekr: { enabled: false, time: DEFAULT_TIMES.zekr },
  customs: [],
};

const STORAGE_KEY = 'quran-user-notifications';
const LAST_FIRE_KEY_PREFIX = 'quran-user-notifications-last-';

/** How many days to keep scheduled natively at once. */
const DAYS_AHEAD = 14;
/** Local notification ids we own (memorize reminders use 70000–79999). */
const ID_BASE = 60000;
const KIND_ID_OFFSET: Record<UserNotificationKind, number> = {
  reading: 0,
  listening: 1000,
  revise: 2000,
  zekr: 3000,
};
const ID_MAX = 69999;
/** Custom reminders get a per-slot block of ids after the fixed kinds. */
const CUSTOM_ID_BASE = 65000;
/** How many custom reminders the id range can hold. */
const CUSTOM_SLOTS = Math.floor((ID_MAX - CUSTOM_ID_BASE + 1) / DAYS_AHEAD);

export function loadUserNotificationSettings(): UserNotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaults();
    const parsed = JSON.parse(raw) as Partial<UserNotificationSettings>;
    const result: UserNotificationSettings = {
      reading: {
        enabled: !!parsed.reading?.enabled,
        time: isValidTime(parsed.reading?.time) ? parsed.reading!.time : DEFAULT_TIMES.reading,
      },
      listening: {
        enabled: !!parsed.listening?.enabled,
        time: isValidTime(parsed.listening?.time) ? parsed.listening!.time : DEFAULT_TIMES.listening,
      },
      revise: {
        enabled: !!parsed.revise?.enabled,
        time: isValidTime(parsed.revise?.time) ? parsed.revise!.time : DEFAULT_TIMES.revise,
      },
      zekr: {
        enabled: !!parsed.zekr?.enabled,
        time: isValidTime(parsed.zekr?.time) ? parsed.zekr!.time : DEFAULT_TIMES.zekr,
      },
      customs: Array.isArray(parsed.customs)
        ? parsed.customs
            .filter((c): c is UserCustomNotification =>
              !!c && typeof c.id === 'string' && typeof c.name === 'string' &&
              typeof c.text === 'string' && isValidTime(c.time))
            .map((c, i) => ({
              id: c.id,
              idNum: typeof c.idNum === 'number' && c.idNum >= 0 && c.idNum < CUSTOM_SLOTS ? c.idNum : i,
              name: c.name,
              text: c.text,
              enabled: !!c.enabled,
              time: c.time,
            }))
        : [],
    };
    return result;
  } catch {
    return cloneDefaults();
  }
}

export function saveUserNotificationSettings(settings: UserNotificationSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** Generate a unique key for a new custom reminder. */
export function createCustomId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Smallest free id slot for a new custom reminder (null when full). */
export function allocateCustomSlot(settings: UserNotificationSettings): number | null {
  const used = new Set(settings.customs.map(c => c.idNum));
  for (let slot = 0; slot < CUSTOM_SLOTS; slot++) {
    if (!used.has(slot)) return slot;
  }
  return null;
}

function cloneDefaults(): UserNotificationSettings {
  return {
    reading: { ...DEFAULT_USER_NOTIFICATIONS.reading },
    listening: { ...DEFAULT_USER_NOTIFICATIONS.listening },
    revise: { ...DEFAULT_USER_NOTIFICATIONS.revise },
    zekr: { ...DEFAULT_USER_NOTIFICATIONS.zekr },
    customs: [],
  };
}

function isValidTime(v: unknown): v is string {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

function currentLanguage(): Language {
  return localStorage.getItem('quran-app-language') === 'en' ? 'en' : 'ar';
}

export interface ReminderContent {
  title: string;
  body: string;
}

function buildContent(kind: UserNotificationKind, lang: Language): ReminderContent {
  const t = translations[lang];
  switch (kind) {
    case 'reading':
      return { title: t.notificationsReading, body: t.notificationsReadingBody };
    case 'listening':
      return { title: t.notificationsListening, body: t.notificationsListeningBody };
    case 'revise':
      return { title: t.notificationsRevise, body: t.notificationsReviseBody };
    case 'zekr':
      return { title: t.notificationsZekr, body: t.notificationsZekrBody };
  }
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

async function cancelOurNotifications(): Promise<void> {
  try {
    const { notifications } = await LocalNotifications.getPending();
    const ours = notifications.filter(n => n.id >= ID_BASE && n.id <= ID_MAX);
    if (ours.length > 0) {
      await LocalNotifications.cancel({ notifications: ours });
    }
  } catch {
    // platform not ready — ignore
  }
}

/** Native id for a custom reminder on a given day index. */
function customId(custom: UserCustomNotification, dayIndex: number): number {
  return CUSTOM_ID_BASE + custom.idNum * DAYS_AHEAD + dayIndex;
}

/**
 * Re-sync the notifications with the stored settings. Call whenever the
 * settings change and on (native) app start.
 * `requestPermission` should only be true from a user gesture (e.g. toggling
 * a notification on) so the OS permission dialog is never a surprise.
 * Returns 'denied' when the user refused notification permission.
 */
export async function syncUserNotifications(requestPermission = false): Promise<'ok' | 'denied' | 'skipped'> {
  const settings = loadUserNotificationSettings();
  const anyEnabled =
    USER_NOTIFICATION_KINDS.some(k => settings[k].enabled) ||
    settings.customs.some(c => c.enabled);

  if (Capacitor.isNativePlatform()) {
    await cancelOurNotifications();
    if (!anyEnabled) return 'skipped';

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

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const notifications: {
      id: number; title: string; body: string;
      schedule: { at: Date; allowWhileIdle: boolean };
    }[] = [];

    for (const kind of USER_NOTIFICATION_KINDS) {
      const item = settings[kind];
      if (!item.enabled) continue;

      const minutes = parseTimeToMinutes(item.time);
      const content = buildContent(kind, currentLanguage());

      for (let i = 0; i < DAYS_AHEAD; i++) {
        const at = new Date(now);
        at.setDate(at.getDate() + i);
        at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
        // skip today if the time already passed
        if (i === 0 && nowMinutes >= minutes) continue;
        if (at.getTime() <= Date.now()) continue;
        notifications.push({
          id: ID_BASE + KIND_ID_OFFSET[kind] + i,
          title: content.title,
          body: content.body,
          schedule: { at, allowWhileIdle: true },
        });
      }
    }

    for (const custom of settings.customs) {
      if (!custom.enabled) continue;

      const minutes = parseTimeToMinutes(custom.time);
      const body = custom.text.trim() || custom.name;

      for (let i = 0; i < DAYS_AHEAD; i++) {
        const at = new Date(now);
        at.setDate(at.getDate() + i);
        at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
        if (i === 0 && nowMinutes >= minutes) continue;
        if (at.getTime() <= Date.now()) continue;
        notifications.push({
          id: customId(custom, i),
          title: custom.name,
          body,
          schedule: { at, allowWhileIdle: true },
        });
      }
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
    return 'ok';
  }

  // Web/PWA: a ticker checks the clock while the app is open.
  restartWebTicker();
  return 'ok';
}

// ---------------------------------------------------------------------------
// Web (PWA) ticker
// ---------------------------------------------------------------------------

let tickerId: ReturnType<typeof setInterval> | null = null;

function restartWebTicker(): void {
  if (tickerId !== null) {
    clearInterval(tickerId);
    tickerId = null;
  }
  const settings = loadUserNotificationSettings();
  if (
    !USER_NOTIFICATION_KINDS.some(k => settings[k].enabled) &&
    !settings.customs.some(c => c.enabled)
  ) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  tickerId = setInterval(checkWebNotifications, 30_000);
  checkWebNotifications();
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function markFired(key: string, dayKey: string): void {
  try { localStorage.setItem(key, dayKey); } catch { /* ignore */ }
}

function showWebNotification(tag: string, content: ReminderContent): void {
  navigator.serviceWorker?.ready
    .then(registration => registration.showNotification(content.title, {
      body: content.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: `user-notification-${tag}`,
    }))
    .catch(() => {
      try { new Notification(content.title, { body: content.body }); } catch { /* ignore */ }
    });
}

function checkWebNotifications(): void {
  try {
    const settings = loadUserNotificationSettings();
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const dayKey = todayKey();

    const due: { key: string; tag: string; content: ReminderContent }[] = [];

    for (const kind of USER_NOTIFICATION_KINDS) {
      const item = settings[kind];
      if (!item.enabled) continue;
      const minutes = parseTimeToMinutes(item.time);
      if (nowMinutes < minutes) continue;
      const fireKey = LAST_FIRE_KEY_PREFIX + kind;
      if (localStorage.getItem(fireKey) === dayKey) continue;
      due.push({ key: fireKey, tag: kind, content: buildContent(kind, currentLanguage()) });
    }

    for (const custom of settings.customs) {
      if (!custom.enabled) continue;
      const minutes = parseTimeToMinutes(custom.time);
      if (nowMinutes < minutes) continue;
      const fireKey = LAST_FIRE_KEY_PREFIX + 'custom-' + custom.id;
      if (localStorage.getItem(fireKey) === dayKey) continue;
      due.push({
        key: fireKey,
        tag: 'custom-' + custom.id,
        content: { title: custom.name, body: custom.text.trim() || custom.name },
      });
    }

    for (const item of due) {
      showWebNotification(item.tag, item.content);
      markFired(item.key, dayKey);
    }
  } catch {
    // never crash the app over a notification
  }
}
