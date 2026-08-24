import { surahs } from '@/data/surahs';
import { getQuranMetaData } from './quran-data-service';

/**
 * Memorize (الحفظ) planner.
 *
 * A plan walks a mushaf region starting from a chosen surah, on a repeating
 * cycle: `memorizeDays` consecutive days each introduce one new portion,
 * followed by `restDays` days of rest.
 * Direction:
 *  - forward  = startSurah → An-Nas in pure sequential chunks;
 *  - backward = startSurah → Al-Fatiha, visiting surahs in descending order,
 *    and every surah is re-chunked from its own first ayah so each surah's
 *    start begins a new day/task (a task never starts mid-surah).
 * Schedule is deterministic — never stored.
 */

export type MemorizeUnit = 'ayah' | 'half-page' | 'page' | 'two-pages' | 'rub' | 'hizb';
export type MemorizeDirection = 'forward' | 'backward';

export interface MemorizePlan {
  version: 8;
  createdAt: number;
  startDate: string; // local 'YYYY-MM-DD'
  startSurah: number; // 1..114; where the memorization sequence starts
  unit: MemorizeUnit;
  ayahsPerDay: number; // only meaningful for 'ayah' unit
  memorizeDays: number; // >= 1; consecutive days that each get a new portion
  restDays: number; // >= 0; days of rest after each memorize run
  direction: MemorizeDirection;
  completedTasks: number[]; // indices of portions marked done
}

export const TOTAL_AYAHS = 6236;
const STORAGE_KEY = 'quran-memorize-plan';
const LEGACY_STORAGE_KEY = 'quran-revision-plan';

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export function loadMemorizePlan(): MemorizePlan | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateLegacyPlan();
    const parsed = JSON.parse(raw) as MemorizePlan & { version?: number };
    if (!parsed || typeof parsed !== 'object') return migrateLegacyPlan();
    if (parsed.version === 8 && isValidPlan(parsed)) return parsed;
    // v7 lacked startSurah (default Al-Fatiha); v6 already carried one.
    if (parsed.version === 7 || parsed.version === 6) {
      const candidate: MemorizePlan = {
        ...(parsed as MemorizePlan),
        version: 8,
        startSurah: clampSurah((parsed as Partial<MemorizePlan>).startSurah),
      };
      if (
        candidate.unit &&
        candidate.direction &&
        typeof candidate.startDate === 'string' &&
        candidate.memorizeDays >= 1 &&
        candidate.restDays >= 0 &&
        Array.isArray(candidate.completedTasks)
      ) {
        return candidate;
      }
    }
    return migrateLegacyPlan();
  } catch {
    return migrateLegacyPlan();
  }
}

function clampSurah(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 114 ? Math.floor(n) : 1;
}

function isValidPlan(p: MemorizePlan): boolean {
  return !!(
    p.unit &&
    p.direction &&
    typeof p.startDate === 'string' &&
    clampSurah(p.startSurah) === p.startSurah &&
    p.memorizeDays >= 1 &&
    p.restDays >= 0 &&
    Array.isArray(p.completedTasks)
  );
}

/** Upgrade a pre-rename revision plan (old key) into the new store. */
function migrateLegacyPlan(): MemorizePlan | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const old = JSON.parse(raw) as Partial<MemorizePlan> & { version?: number };
    if (!old || typeof old !== 'object' || !old.unit) return null;
    const upgraded: MemorizePlan = {
      version: 8,
      createdAt: Number(old.createdAt) || Date.now(),
      startDate: typeof old.startDate === 'string' ? old.startDate : toDateKey(new Date()),
      startSurah: clampSurah(old.startSurah),
      unit: old.unit,
      ayahsPerDay: Number(old.ayahsPerDay) || 0,
      memorizeDays: Math.max(1, Number(old.memorizeDays) || 1),
      restDays: Math.max(0, Number(old.restDays) || 0),
      direction: old.direction === 'backward' ? 'backward' : 'forward',
      completedTasks: Array.isArray(old.completedTasks) ? old.completedTasks : [],
    };
    saveMemorizePlan(upgraded);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return upgraded;
  } catch {
    return null;
  }
}

export function saveMemorizePlan(plan: MemorizePlan): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}

export function clearMemorizePlan(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Date helpers (local timezone, 'YYYY-MM-DD')
// ---------------------------------------------------------------------------

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDaysToKey(key: string, n: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

/** Whole days between keys (positive when toKey is later). */
export function daysBetween(fromKey: string, toKey: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  const fromNoon = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  const toNoon = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 12);
  return Math.round((toNoon.getTime() - fromNoon.getTime()) / msPerDay);
}

// ---------------------------------------------------------------------------
// Absolute ayah indexing
// ---------------------------------------------------------------------------

function absIndexOf(surahId: number, ayah: number): number {
  const s = surahs.find(x => x.id === surahId);
  if (!s) return 0;
  return Math.min(Math.max(s.startingAyah + ayah - 1, 0), TOTAL_AYAHS - 1);
}

export function resolveAbsIndex(abs: number): { surah: number; ayah: number } {
  const clamped = Math.min(Math.max(abs, 0), TOTAL_AYAHS - 1);
  let lo = 0;
  let hi = surahs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (surahs[mid].startingAyah <= clamped) lo = mid;
    else hi = mid - 1;
  }
  const s = surahs[lo];
  return { surah: s.id, ayah: clamped - s.startingAyah + 1 };
}

// ---------------------------------------------------------------------------
// Quran boundaries
// ---------------------------------------------------------------------------

export interface QuranBoundaries {
  /** absolute index of first ayah of page p (p = arrayIndex + 1) */
  pageStarts: number[];
  /** absolute index of first ayah of hizb quarter q */
  quarterStarts: number[];
}

let boundariesPromise: Promise<QuranBoundaries> | null = null;

export function getQuranBoundaries(): Promise<QuranBoundaries> {
  if (!boundariesPromise) {
    boundariesPromise = getQuranMetaData().then(meta => ({
      pageStarts: meta.pages.map(([s, a]: [number, number]) => absIndexOf(s, a)),
      quarterStarts: meta.hizb_quarters.map(([s, a]: [number, number]) => absIndexOf(s, a)),
    }));
  }
  return boundariesPromise;
}

function indexOfAtOrBefore(arr: number[], abs: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (arr[mid] <= abs) lo = mid;
    else hi = mid - 1;
  }
  return arr[lo] <= abs ? lo : 0;
}

/** First mushaf page (1-based) on which the given surah appears. */
export function getSurahFirstPage(b: QuranBoundaries, surahId: number): number {
  return indexOfAtOrBefore(b.pageStarts, absIndexOf(surahId, 1)) + 1;
}

// ---------------------------------------------------------------------------
// Task (portion) computation
// ---------------------------------------------------------------------------

export interface MemorizeSegment {
  index: number; // task number (0-based)
  startAbs: number; // inclusive
  endAbs: number; // inclusive
}

/**
 * Chunk the window [startAbs..endAbs] into unit-sized portions anchored at
 * startAbs. Used over whole-surah windows so that, when backward, every
 * surah's first ayah coincides with the start of a task.
 */
function chunkWindow(
  plan: MemorizePlan,
  b: QuranBoundaries,
  startAbs: number,
  endAbs: number,
  push: (startAbs: number, endAbs: number) => void
): void {
  switch (plan.unit) {
    case 'ayah': {
      const size = Math.max(1, plan.ayahsPerDay || 1);
      let a = startAbs;
      while (a <= endAbs) {
        push(a, Math.min(a + size - 1, endAbs));
        a += size;
      }
      break;
    }
    case 'half-page': {
      let idx = indexOfAtOrBefore(b.pageStarts, startAbs);
      while (idx < b.pageStarts.length) {
        const ps = b.pageStarts[idx];
        const pe = (idx + 1 < b.pageStarts.length ? b.pageStarts[idx + 1] : TOTAL_AYAHS) - 1;
        const count = pe - ps + 1;
        const fhEnd = ps + Math.ceil(count / 2) - 1;
        const h1s = Math.max(ps, startAbs);
        if (h1s > endAbs) break;
        if (h1s <= fhEnd) {
          push(h1s, Math.min(fhEnd, endAbs));
          if (fhEnd + 1 <= endAbs) push(fhEnd + 1, pe);
        } else {
          // anchored past the first half: one chunk from the anchor to page end
          push(startAbs, pe);
        }
        if (pe >= endAbs) break;
        idx++;
      }
      break;
    }
    case 'page':
    case 'two-pages': {
      const step = plan.unit === 'page' ? 1 : 2;
      let idx = indexOfAtOrBefore(b.pageStarts, startAbs);
      while (idx < b.pageStarts.length) {
        const ps = b.pageStarts[idx];
        if (ps > endAbs) break;
        const nextIdx = Math.min(idx + step, b.pageStarts.length);
        const pe = (nextIdx < b.pageStarts.length ? b.pageStarts[nextIdx] : TOTAL_AYAHS) - 1;
        push(Math.max(ps, startAbs), Math.min(pe, endAbs));
        if (pe >= endAbs) break;
        idx += step;
      }
      break;
    }
    case 'rub':
    case 'hizb': {
      const step = plan.unit === 'rub' ? 1 : 4;
      let q = indexOfAtOrBefore(b.quarterStarts, startAbs);
      while (q < b.quarterStarts.length) {
        const qs = b.quarterStarts[q];
        if (qs > endAbs) break;
        const nextQ = Math.min(q + step, b.quarterStarts.length);
        const qe = (nextQ < b.quarterStarts.length ? b.quarterStarts[nextQ] : TOTAL_AYAHS) - 1;
        push(Math.max(qs, startAbs), Math.min(qe, endAbs));
        if (qe >= endAbs) break;
        q += step;
      }
      break;
    }
  }
}

/**
 * Materialized schedule.
 *  - forward:  one sequential window startSurah → end of mushaf;
 *  - backward: per-surah windows visited startSurah → Al-Fatiha
 *    (descending), each re-chunked from its own first ayah so every
 *    surah's start coincides with the start of a task.
 */
const listCache = new Map<string, MemorizeSegment[]>();

function getTaskList(plan: MemorizePlan, b: QuranBoundaries): MemorizeSegment[] {
  const cacheKey = `${plan.direction}:${plan.unit}:${plan.ayahsPerDay}:${plan.startSurah}`;
  const cached = listCache.get(cacheKey);
  if (cached) return cached;

  const out: MemorizeSegment[] = [];
  const push = (startAbs: number, endAbs: number) => {
    out.push({ index: out.length, startAbs, endAbs });
  };

  const startSurah = clampSurah(plan.startSurah);
  if (plan.direction === 'backward') {
    let s = startSurah;
    while (s >= 1) {
      const subEnd = s < 114 ? absIndexOf(s + 1, 1) - 1 : TOTAL_AYAHS - 1;
      chunkWindow(plan, b, absIndexOf(s, 1), subEnd, push);
      s--;
    }
  } else {
    chunkWindow(plan, b, absIndexOf(startSurah, 1), TOTAL_AYAHS - 1, push);
  }

  listCache.set(cacheKey, out);
  return out;
}

export function getTaskSegment(plan: MemorizePlan, b: QuranBoundaries, index: number): MemorizeSegment | null {
  if (index < 0) return null;
  const list = getTaskList(plan, b);
  return index < list.length ? list[index] : null;
}

export function getTotalTasks(plan: MemorizePlan, b: QuranBoundaries): number {
  return getTaskList(plan, b).length;
}

/**
 * Date of task `index`: consecutive memorizeDays each carry one portion,
 * followed by restDays with no portions, repeating.
 */
export function getTaskDate(plan: MemorizePlan, index: number): string {
  const m = Math.max(1, plan.memorizeDays || 1);
  const r = Math.max(0, plan.restDays || 0);
  const cycle = Math.floor(index / m);
  const dayOffset = cycle * (m + r) + (index % m);
  return addDaysToKey(plan.startDate, dayOffset);
}

export function getStats(plan: MemorizePlan, b: QuranBoundaries): { totalTasks: number; doneTasks: number; percent: number; finished: boolean } {
  const totalTasks = getTotalTasks(plan, b);
  const doneTasks = new Set(plan.completedTasks.filter(i => i >= 0 && i < totalTasks)).size;
  const percent = totalTasks === 0 ? 100 : Math.round((doneTasks / totalTasks) * 100);
  return { totalTasks, doneTasks, percent, finished: totalTasks > 0 && doneTasks >= totalTasks };
}

export function toggleTask(plan: MemorizePlan, index: number): MemorizePlan {
  const exists = plan.completedTasks.includes(index);
  const completedTasks = exists
    ? plan.completedTasks.filter(i => i !== index)
    : [...plan.completedTasks, index].sort((a, z) => a - z);
  return { ...plan, completedTasks };
}

/** Index of the first uncompleted task (or totalTasks when all done). */
export function getNextTaskIndex(plan: MemorizePlan, b: QuranBoundaries): number {
  const total = getTotalTasks(plan, b);
  const done = new Set(plan.completedTasks);
  for (let i = 0; i < total; i++) {
    if (!done.has(i)) return i;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Description
// ---------------------------------------------------------------------------

export interface SegmentInfo {
  surahFrom: number;
  ayahFrom: number;
  surahTo: number;
  ayahTo: number;
  pageFrom: number;
  pageTo: number;
}

export function describeSegment(segment: MemorizeSegment, b: QuranBoundaries): SegmentInfo {
  const from = resolveAbsIndex(segment.startAbs);
  const to = resolveAbsIndex(segment.endAbs);
  return {
    surahFrom: from.surah,
    ayahFrom: from.ayah,
    surahTo: to.surah,
    ayahTo: to.ayah,
    pageFrom: indexOfAtOrBefore(b.pageStarts, segment.startAbs) + 1,
    pageTo: indexOfAtOrBefore(b.pageStarts, segment.endAbs) + 1,
  };
}
