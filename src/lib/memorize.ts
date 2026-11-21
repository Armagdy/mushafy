import { surahs } from '@/data/surahs';
import { getQuranMetaData } from './quran-data-service';

/**
 * Memorize (الحفظ) planner.
 *
 * A plan walks a mushaf region starting from a chosen surah, on a repeating
 * cycle: `memorizeDays` consecutive days each introduce one new portion,
 * followed by `restDays` days of rest.
 * Revision (المراجعة): each memorize day revises `revisionPages` (N) pages
 * of already-memorized material counted from the newest memorized page — Z
 * pages memorized inside the plan plus N − Z from the previously-memorized
 * pool. While a surah is midway, its un-memorized remainder cuts the span
 * into two ranges; once it is finished the span is one normal N-page range.
 * Rest days carry nothing.
 * Direction:
 *  - forward  = startSurah → An-Nas in pure sequential chunks;
 *  - backward = startSurah → Al-Fatiha, visiting surahs in descending order,
 *    and every surah is re-chunked from its own first ayah so each surah's
 *    start begins a new day/task (a task never starts mid-surah).
 * Schedule is deterministic — never stored.
 */

export type MemorizeUnit = 'ayah' | 'half-page' | 'page' | 'two-pages' | 'rub' | 'hizb';
export type MemorizeDirection = 'forward' | 'backward';
export type JuzRevisionFrequency = 'off' | 'weekly' | 'twice-weekly' | 'monthly' | 'twice-monthly';

export interface MemorizePlan {
  version: 12;
  createdAt: number;
  startDate: string; // local 'YYYY-MM-DD'
  startSurah: number; // 1..114; where the memorization sequence starts
  unit: MemorizeUnit;
  ayahsPerDay: number; // only meaningful for 'ayah' unit
  memorizeDays: number; // >= 1; consecutive days that each get a new portion
  restDays: number; // >= 0; days of rest after each memorize run
  direction: MemorizeDirection;
  /** 0..604 already-memorized pages beside the plan's start point. */
  revisionPages: number;
  completedTasks: number[]; // indices of new portions marked done
  completedRevisions: number[]; // indices of revision portions marked done
  /** Cycling of memorized juz (independent of the page revision). Each
   *  cycle (a week, half a week, a month...) takes the next juz of the pool
   *  in rotation and spreads it over the cycle's days; the pool itself is
   *  derived automatically from the plan's start point and direction. */
  juzRevisionFrequency: JuzRevisionFrequency;
  /** Date keys of completed juz-revision days (one day's portion each). */
  completedJuz: string[];
}

export const TOTAL_AYAHS = 6236;
const STORAGE_KEY = 'quran-memorize-plan';
const LEGACY_STORAGE_KEY = 'quran-revision-plan';

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/** Shape read from storage — may be any historical plan version. */
type StoredPlan = Partial<Omit<MemorizePlan, 'version'>> & { version?: number };

export function loadMemorizePlan(): MemorizePlan | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateLegacyPlan();
    const parsed = JSON.parse(raw) as StoredPlan;
    if (!parsed || typeof parsed !== 'object') return migrateLegacyPlan();
    if (parsed.version === 12 && isValidPlan(parsed as MemorizePlan)) return parsed as MemorizePlan;
    // v11 and earlier lacked nothing but the manual memorized-juz count,
    // which v12 derives automatically from the plan's start and direction;
    // v10 lacked the juz fields; v9 lacked completedRevisions; v8 lacked
    // revisionPages; v7/v6 lacked startSurah.
    if (parsed.version === 11 || parsed.version === 10 || parsed.version === 9 || parsed.version === 8 || parsed.version === 7 || parsed.version === 6) {
      const candidate = upgradeLegacyPlan(parsed);
      if (candidate) return candidate;
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

function clampPages(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 604 ? Math.floor(n) : 20;
}

const JUZ_FREQUENCIES_SET = new Set<JuzRevisionFrequency>([
  'off', 'weekly', 'twice-weekly', 'monthly', 'twice-monthly',
]);

function isValidPlan(p: MemorizePlan): boolean {
  return !!(
    p.unit &&
    p.direction &&
    typeof p.startDate === 'string' &&
    clampSurah(p.startSurah) === p.startSurah &&
    p.memorizeDays >= 1 &&
    p.restDays >= 0 &&
    clampPages(p.revisionPages) === p.revisionPages &&
    Array.isArray(p.completedTasks) &&
    Array.isArray(p.completedRevisions) &&
    JUZ_FREQUENCIES_SET.has(p.juzRevisionFrequency) &&
    Array.isArray(p.completedJuz)
  );
}

/** Coerce any pre-v12 payload shape into a valid v12 plan (or null). */
function upgradeLegacyPlan(old: StoredPlan | Partial<MemorizePlan>): MemorizePlan | null {
  if (!old || typeof old !== 'object') return null;
  const candidate: MemorizePlan = {
    version: 12,
    createdAt: Number(old.createdAt) || Date.now(),
    startDate: typeof old.startDate === 'string' ? old.startDate : toDateKey(new Date()),
    startSurah: clampSurah(old.startSurah),
    unit: old.unit ?? 'page',
    ayahsPerDay: Number(old.ayahsPerDay) || 0,
    memorizeDays: Math.max(1, Number(old.memorizeDays) || 1),
    restDays: Math.max(0, Number(old.restDays) || 0),
    direction: old.direction === 'backward' ? 'backward' : 'forward',
    revisionPages: clampPages(old.revisionPages),
    completedTasks: Array.isArray(old.completedTasks) ? old.completedTasks : [],
    completedRevisions: Array.isArray((old as { completedRevisions?: number[] }).completedRevisions)
      ? (old as { completedRevisions: number[] }).completedRevisions
      : [],
    juzRevisionFrequency: JUZ_FREQUENCIES_SET.has((old as { juzRevisionFrequency?: JuzRevisionFrequency }).juzRevisionFrequency)
      ? (old as { juzRevisionFrequency: JuzRevisionFrequency }).juzRevisionFrequency
      : 'off',
    completedJuz: Array.isArray((old as { completedJuz?: string[] }).completedJuz)
      ? (old as { completedJuz: string[] }).completedJuz
      : [],
  };
  if (!UNITS_SET.has(candidate.unit) || !DIRECTIONS_SET.has(candidate.direction)) return null;
  return isValidPlan(candidate) ? candidate : null;
}

const UNITS_SET = new Set<MemorizeUnit>(['ayah', 'half-page', 'page', 'two-pages', 'rub', 'hizb']);
const DIRECTIONS_SET = new Set<MemorizeDirection>(['forward', 'backward']);

/** Upgrade a pre-rename revision plan (old key) into the new store. */
function migrateLegacyPlan(): MemorizePlan | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const old = JSON.parse(raw) as StoredPlan;
    if (!old || typeof old !== 'object' || !old.unit) return null;
    const upgraded = upgradeLegacyPlan(old);
    if (!upgraded) return null;
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
  /** absolute index of first ayah of juz j (j = arrayIndex + 1) */
  juzStarts: number[];
}

let boundariesPromise: Promise<QuranBoundaries> | null = null;

export function getQuranBoundaries(): Promise<QuranBoundaries> {
  if (!boundariesPromise) {
    boundariesPromise = getQuranMetaData().then(meta => ({
      pageStarts: meta.pages.map(([s, a]: [number, number]) => absIndexOf(s, a)),
      quarterStarts: meta.hizb_quarters.map(([s, a]: [number, number]) => absIndexOf(s, a)),
      juzStarts: meta.juzs.map(([s, a]: [number, number]) => absIndexOf(s, a)),
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

/** Toggle the day's revision portion done/undone (independent of the task). */
export function toggleRevision(plan: MemorizePlan, index: number): MemorizePlan {
  const exists = plan.completedRevisions.includes(index);
  const completedRevisions = exists
    ? plan.completedRevisions.filter(i => i !== index)
    : [...plan.completedRevisions, index].sort((a, z) => a - z);
  return { ...plan, completedRevisions };
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

// ---------------------------------------------------------------------------
// Revision (المراجعة) of already-memorized pages
// ---------------------------------------------------------------------------

/**
 * How much of the plan counts as memorized when scheduling day `index`:
 * everything the schedule covered before that day (index − 1, clamped to the
 * plan's last task), plus anything the user actually marked done. Progress
 * therefore advances every day the plan moves, and checking a day off can
 * only pull it forward.
 */
function progressAt(plan: MemorizePlan, b: QuranBoundaries, index: number): number {
  const total = getTotalTasks(plan, b);
  const scheduled = Math.min(index - 1, total - 1);
  const h = plan.completedTasks.length > 0 ? Math.max(...plan.completedTasks) : -1;
  return Math.max(scheduled, h);
}

/** A revision range: the ayah span [startAbs..endAbs] of one page block. */
export interface RevisionRange {
  startAbs: number;
  endAbs: number;
}

/**
 * The day's revision: `revisionPages` (N) pages of already-memorized
 * material counted from the most recently memorized page:
 *  - first the pages memorized inside the plan so far (Z), newest first;
 *  - then the previously-memorized pool beside the plan's start (N − Z),
 *    skipping the pages currently being memorized.
 *
 * While the surah being memorized is midway, its not-yet-memorized remainder
 * cuts the span in two: the memorized part below (Z) and the previous pool
 * above (N − Z). Once that surah is finished everything is contiguous and
 * the result is a single normal N-page range. Forward plans always produce
 * one range (their un-memorized remainder lies beyond the span). Returns []
 * when revision is off or nothing is memorized yet.
 */
export function getRevisionRanges(plan: MemorizePlan, b: QuranBoundaries, index: number): RevisionRange[] {
  const n = clampPages(plan.revisionPages ?? 0);
  if (n <= 0 || b.pageStarts.length === 0) return [];
  const surah = clampSurah(plan.startSurah);
  const p = progressAt(plan, b, index);
  const pageOf = (abs: number) => indexOfAtOrBefore(b.pageStarts, abs);

  if (plan.direction === 'forward') {
    // one span ending at the newest memorized ayah, descending N pages
    const firstStart = absIndexOf(surah, 1);
    const frontier = p >= 0 ? getTaskSegment(plan, b, p) : null;
    const anchor = frontier ? frontier.endAbs : firstStart - 1;
    if (anchor < 0) return [];
    const topIdx = pageOf(anchor);
    const beginIdx = Math.max(0, topIdx - (n - 1));
    return [{ startAbs: b.pageStarts[beginIdx], endAbs: anchor }];
  }

  // ---- backward: Z in-plan pages + (N − Z) previous-pool pages ----
  const firstEnd = surah < 114 ? absIndexOf(surah + 1, 1) - 1 : TOTAL_AYAHS - 1;
  if (surah >= 114 && p < 0) return [];

  // block 1: the current surah's memorized part (bottom of the span)
  // block 2: the completed surahs above it, through the plan's first surah
  let b1: RevisionRange | null = null;
  let b2: RevisionRange | null = null;
  let fsEnd = firstEnd; // last ayah of the surah being memorized
  if (p >= 0) {
    const frontier = getTaskSegment(plan, b, p);
    if (!frontier) return [];
    const fs = resolveAbsIndex(frontier.startAbs).surah;
    fsEnd = fs < 114 ? absIndexOf(fs + 1, 1) - 1 : TOTAL_AYAHS - 1;
    b1 = { startAbs: absIndexOf(fs, 1), endAbs: frontier.endAbs };
    if (firstEnd > fsEnd) b2 = { startAbs: fsEnd + 1, endAbs: firstEnd };
  }

  const pagesOf = (r: RevisionRange) => pageOf(r.endAbs) - pageOf(r.startAbs) + 1;

  // keep at most N in-plan pages, dropping the oldest
  let budget = n;
  if (b1) {
    if (pagesOf(b1) > budget) {
      b1 = { startAbs: b.pageStarts[pageOf(b1.endAbs) - budget + 1], endAbs: b1.endAbs };
      budget = 0;
    } else {
      budget -= pagesOf(b1);
    }
  }
  if (b2 && budget > 0) {
    if (pagesOf(b2) > budget) {
      b2 = { startAbs: b2.startAbs, endAbs: b.pageStarts[pageOf(b2.startAbs) + budget] - 1 };
      budget = 0;
    } else {
      budget -= pagesOf(b2);
    }
  } else if (budget <= 0) {
    b2 = null;
  }

  // previous pool fills the rest, skipping the cut (pages holding the
  // current surah's un-memorized remainder) and already-counted pages
  let old: RevisionRange | null = null;
  if (budget > 0 && surah < 114) {
    const gapCut = p >= 0
      ? (b1 && b1.endAbs < fsEnd ? pageOf(fsEnd) + 1 : 0) // current surah midway
      : pageOf(firstEnd) + 1;                             // first surah not started yet
    const inPlanTop = b2 ?? b1;
    const overlapCut = inPlanTop ? pageOf(inPlanTop.endAbs) + 1 : 0;
    const startIdx = Math.max(pageOf(firstEnd + 1), gapCut, overlapCut);
    if (startIdx < b.pageStarts.length) {
      const endIdx = Math.min(startIdx + budget - 1, b.pageStarts.length - 1);
      old = {
        startAbs: b.pageStarts[startIdx],
        endAbs: (endIdx + 1 < b.pageStarts.length ? b.pageStarts[endIdx + 1] : TOTAL_AYAHS) - 1,
      };
    }
  }

  // merge ayah-contiguous blocks; the cut keeps the low block separate
  const gap = !!b1 && b1.endAbs < fsEnd; // the surah being memorized is midway
  if (b1 && b2 && !gap) {
    b1 = { startAbs: b1.startAbs, endAbs: b2.endAbs };
    b2 = null;
  }
  const upper = b2 && old
    ? { startAbs: b2.startAbs, endAbs: old.endAbs }
    : (b2 ?? old);
  if (b1 && upper && !gap) {
    return [{ startAbs: b1.startAbs, endAbs: upper.endAbs }];
  }
  const out: RevisionRange[] = [];
  if (b1) out.push(b1);
  if (upper) out.push(upper);
  return out;
}

// ---------------------------------------------------------------------------
// Juz revision (مراجعة الأجزاء) — one memorized juz per cycle, spread over
// the cycle's days so the cards carry a small portion every day
// ---------------------------------------------------------------------------

/** How many days each frequency's cycle spans and where its slots open.
 *  A slot opens a revision window: from its offset to the next offset (or
 *  the period's end). The window's juz is split across the window's days. */
const JUZ_FREQUENCY_SLOTS: Record<Exclude<JuzRevisionFrequency, 'off'>, { period: number; offsets: number[] }> = {
  'weekly': { period: 7, offsets: [0] },
  'twice-weekly': { period: 7, offsets: [0, 3] },
  'monthly': { period: 30, offsets: [0] },
  'twice-monthly': { period: 30, offsets: [0, 15] },
};

/**
 * The plan's progress as of an arbitrary DATE (unlike progressAt, which is
 * task-index based): everything scheduled before that day, plus anything the
 * user actually marked done. Works for memorize days, rest days and days
 * past the plan's end (where the whole plan counts as covered).
 */
function progressAtDate(plan: MemorizePlan, b: QuranBoundaries, dateKey: string): number {
  const total = getTotalTasks(plan, b);
  const h = plan.completedTasks.length > 0 ? Math.max(...plan.completedTasks) : -1;
  const offset = daysBetween(plan.startDate, dateKey);
  if (offset < 0) return h;

  const m = Math.max(1, plan.memorizeDays || 1);
  const r = Math.max(0, plan.restDays || 0);
  const cycle = Math.floor(offset / (m + r));
  const pos = offset % (m + r);
  // rest days: every memorize day of this cycle has passed
  const covered = pos < m ? cycle * m + pos - 1 : cycle * m + m - 1;
  return Math.max(Math.min(covered, total - 1), h);
}

/** Absolute ayah span of juz `juz` (1..30). */
export function getJuzSpan(b: QuranBoundaries, juz: number): { startAbs: number; endAbs: number } {
  const j = Math.min(Math.max(juz, 1), 30);
  return {
    startAbs: b.juzStarts[j - 1],
    endAbs: (j < 30 ? b.juzStarts[j] : TOTAL_AYAHS) - 1,
  };
}

/**
 * The fully-memorized juz pool as of `dateKey`, newest first — derived
 * automatically from the plan itself:
 *  - everything on the previously-memorized side of the plan's start point
 *    counts as known (after the start surah for backward plans, before it
 *    for forward ones), so any juz lying wholly in that region is in;
 *  - as the plan progresses, a juz joins the moment the frontier covers its
 *    remaining part (juz straddling the start point included).
 * Newest-first = ascending numbers for backward plans (the lowest is the
 * most recently memorized), descending for forward ones.
 */
export function getJuzPool(plan: MemorizePlan, b: QuranBoundaries, dateKey: string): number[] {
  const pool = new Set<number>();
  if (b.juzStarts.length !== 30) return [];

  const surah0 = clampSurah(plan.startSurah);
  const p = progressAtDate(plan, b, dateKey);
  const frontier = p >= 0 ? getTaskSegment(plan, b, p) : null;

  for (let j = 1; j <= 30; j++) {
    const span = getJuzSpan(b, j);
    let complete: boolean;
    if (frontier) {
      const fs = resolveAbsIndex(frontier.startAbs).surah;
      const fsStart = absIndexOf(fs, 1);
      const fsEnd = fs < 114 ? absIndexOf(fs + 1, 1) - 1 : TOTAL_AYAHS - 1;
      if (plan.direction === 'backward') {
        // the current surah's memorized part, or anything above its end —
        // completed surahs and previously-memorized material are contiguous
        complete = (span.startAbs >= fsStart && span.endAbs <= frontier.endAbs)
          || span.startAbs >= fsEnd + 1;
      } else {
        // everything from the mushaf's start through the frontier is covered
        complete = span.endAbs <= frontier.endAbs;
      }
    } else if (plan.direction === 'backward') {
      // nothing in-plan yet: only the region after the start surah counts
      const regionStart = surah0 < 114 ? absIndexOf(surah0 + 1, 1) : TOTAL_AYAHS;
      complete = span.startAbs >= regionStart;
    } else {
      // nothing in-plan yet: only the region before the start surah counts
      complete = span.endAbs <= absIndexOf(surah0, 1) - 1;
    }
    if (complete) pool.add(j);
  }

  return [...pool].sort((a, z) => (plan.direction === 'backward' ? a - z : z - a));
}

/** One day's slice of the juz-revision cycle. */
export interface JuzRevisionPortion {
  juz: number;
  /** 1-based day number inside the revision window (e.g. day 3 of 7). */
  dayInSlot: number;
  /** How many days the window spreads the juz over. */
  slotDays: number;
  startAbs: number; // inclusive
  endAbs: number; // inclusive
}

/**
 * The day's juz-revision portion (or null): each frequency opens revision
 * windows on its rhythm — weekly → one 7-day window per week, twice-weekly →
 * windows of 3 then 4 days, monthly → one 30-day window, twice-monthly →
 * two 15-day windows — and each window takes the next juz of the pool in
 * rotation, newest first (e.g. with juz 29 and 30 memorized, weekly: week 1
 * → juz 29, week 2 → juz 30, week 3 → juz 29, ...). The window's juz is then
 * SPLIT EVENLY across the window's days (20 pages over 7 days → 3,3,3,3,3,
 * 3,2) so the daily cards guide the user through the juz over the whole
 * window instead of cramming it into a single day. The juz is frozen at the
 * window's first day, so the whole window revises the same juz even if the
 * pool grows mid-window. Days past the juz's last page carry nothing.
 */
export function getJuzRevisionPortion(plan: MemorizePlan, b: QuranBoundaries, dateKey: string): JuzRevisionPortion | null {
  const f = plan.juzRevisionFrequency;
  if (!f || f === 'off') return null;
  const offset = daysBetween(plan.startDate, dateKey);
  if (offset < 0) return null;
  if (b.pageStarts.length === 0) return null;

  const { period, offsets } = JUZ_FREQUENCY_SLOTS[f];
  const pos = offset % period;
  // the window this day belongs to: from its slot start to the next slot
  let oi = -1;
  for (let i = offsets.length - 1; i >= 0; i--) {
    if (pos >= offsets[i]) { oi = i; break; }
  }
  if (oi < 0) return null;

  const slotStart = offsets[oi];
  const slotEnd = (oi + 1 < offsets.length ? offsets[oi + 1] : period) - 1;
  const slotDays = slotEnd - slotStart + 1;
  const dayInSlot = pos - slotStart; // 0-based within the window

  // window number in the pool rotation (same numbering the old whole-juz
  // slots used, evaluated on the window's first day)
  const slot = Math.floor(offset / period) * offsets.length + oi;
  const windowStart = addDaysToKey(plan.startDate, Math.floor(offset / period) * period + slotStart);
  const pool = getJuzPool(plan, b, windowStart);
  if (pool.length === 0) return null;
  const juz = pool[slot % pool.length];

  // split the juz's pages across the window's days, in reading order
  const span = getJuzSpan(b, juz);
  const pageOf = (abs: number) => indexOfAtOrBefore(b.pageStarts, abs);
  const firstPage = pageOf(span.startAbs);
  const pages = pageOf(span.endAbs) - firstPage + 1;

  // even split: the first `pages % slotDays` days take one extra page
  const base = Math.floor(pages / slotDays);
  const extra = pages % slotDays;
  const size = base + (dayInSlot < extra ? 1 : 0);
  if (size <= 0) return null; // the juz ends before the window does

  const fromPage = firstPage + dayInSlot * base + Math.min(dayInSlot, extra);
  const toPage = fromPage + size - 1;
  return {
    juz,
    dayInSlot: dayInSlot + 1,
    slotDays,
    startAbs: b.pageStarts[fromPage],
    endAbs: toPage + 1 < b.pageStarts.length ? b.pageStarts[toPage + 1] - 1 : TOTAL_AYAHS - 1,
  };
}

/** Toggle a day's juz revision done/undone (keyed by date). */
export function toggleJuzRevision(plan: MemorizePlan, dateKey: string): MemorizePlan {
  const exists = plan.completedJuz.includes(dateKey);
  const completedJuz = exists
    ? plan.completedJuz.filter(k => k !== dateKey)
    : [...plan.completedJuz, dateKey].sort();
  return { ...plan, completedJuz };
}

// ---------------------------------------------------------------------------
// Calendar mapping (day -> task)
// ---------------------------------------------------------------------------

export type MemorizeDayKind =
  | { type: 'memorize'; index: number }
  | { type: 'rest' }
  | { type: 'off' };

/**
 * What a given calendar day holds:
 *  - 'memorize': a new portion (and its paired revision) — `index` is the
 *    task index; it may exceed the last task when the plan is finished,
 *    callers should treat a null segment as 'off';
 *  - 'rest': inside the plan's cycle, resting;
 *  - 'off': before the plan starts or past its final task.
 */
export function getDayKind(plan: MemorizePlan, dateKey: string): MemorizeDayKind {
  const offset = daysBetween(plan.startDate, dateKey);
  if (offset < 0) return { type: 'off' };
  const m = Math.max(1, plan.memorizeDays || 1);
  const r = Math.max(0, plan.restDays || 0);
  const pos = offset % (m + r);
  if (pos >= m) return { type: 'rest' };
  return { type: 'memorize', index: Math.floor(offset / (m + r)) * m + pos };
}
