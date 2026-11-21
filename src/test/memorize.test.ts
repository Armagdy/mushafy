// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  MemorizePlan,
  loadMemorizePlan, saveMemorizePlan, clearMemorizePlan,
  getTaskSegment, getTotalTasks, getStats, getNextTaskIndex, toggleTask,
  getTaskDate, describeSegment, resolveAbsIndex, getSurahFirstPage,
  getRevisionRanges, getJuzPool, getJuzRevisionPortion, getJuzSpan, getDayKind,
  toggleRevision, toggleJuzRevision,
  toDateKey, todayKey, addDaysToKey, daysBetween,
  QuranBoundaries,
} from "@/lib/memorize";
import { surahs } from "@/data/surahs";

const meta = JSON.parse(
  readFileSync(join(process.cwd(), "public/assets/quran-meta-data.json"), "utf-8")
);

const absIndex = (surahId: number, ayah: number): number => {
  const s = surahs.find(x => x.id === surahId)!;
  return s.startingAyah + ayah - 1;
};

const boundaries: QuranBoundaries = {
  pageStarts: meta.pages.map(([s, a]: [number, number]) => absIndex(s, a)),
  quarterStarts: meta.hizb_quarters.map(([s, a]: [number, number]) => absIndex(s, a)),
  juzStarts: meta.juzs.map(([s, a]: [number, number]) => absIndex(s, a)),
};

function makePlan(overrides: Partial<MemorizePlan> = {}): MemorizePlan {
  return {
    version: 12,
    createdAt: Date.now(),
    startDate: '2026-01-01',
    startSurah: 1,
    unit: 'page',
    ayahsPerDay: 0,
    memorizeDays: 1,
    restDays: 0,
    direction: 'forward',
    revisionPages: 0,
    completedTasks: [],
    completedRevisions: [],
    juzRevisionFrequency: 'off',
    completedJuz: [],
    ...overrides,
  };
}

/** Walk all tasks until exhaustion (bounded). */
function walk(plan: MemorizePlan) {
  const out = [];
  for (let i = 0; i < 20000; i++) {
    const seg = getTaskSegment(plan, boundaries, i);
    if (!seg) break;
    out.push(seg);
  }
  return out;
}

describe("date helpers", () => {
  it("round-trips date keys", () => {
    expect(toDateKey(new Date(2026, 7, 25))).toBe('2026-08-25');
    expect(daysBetween('2026-08-24', '2026-08-25')).toBe(1);
    expect(daysBetween('2026-08-25', '2026-08-24')).toBe(-1);
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
  });

  it("resolves absolute indices round-trip", () => {
    for (const [s, a] of [[1, 1], [2, 255], [18, 1], [114, 6]] as const) {
      const abs = absIndex(s, a);
      expect(resolveAbsIndex(abs)).toEqual({ surah: s, ayah: a });
    }
  });
});

describe("task generation per unit (full mushaf, forward)", () => {
  it("ayah unit: fixed contiguous chunks over the whole mushaf", () => {
    const plan = makePlan({ unit: 'ayah', ayahsPerDay: 10 });
    const tasks = walk(plan);
    expect(tasks[0]).toMatchObject({ startAbs: 0, endAbs: 9 });
    for (let i = 1; i < tasks.length; i++) {
      expect(tasks[i].startAbs).toBe(tasks[i - 1].endAbs + 1);
    }
    expect(tasks[tasks.length - 1].endAbs).toBe(6235);
    expect(getTotalTasks(plan, boundaries)).toBe(Math.ceil(6236 / 10));
  });

  it("page unit: one page per task", () => {
    const tasks = walk(makePlan({ unit: 'page' }));
    expect(tasks.length).toBe(604);
    expect(tasks[0]).toMatchObject({ startAbs: boundaries.pageStarts[0], endAbs: boundaries.pageStarts[1] - 1 });
    expect(tasks[603]).toMatchObject({ startAbs: boundaries.pageStarts[603], endAbs: 6235 });
  });

  it("two-pages unit: two pages per task", () => {
    const tasks = walk(makePlan({ unit: 'two-pages' }));
    expect(tasks.length).toBe(Math.ceil(604 / 2));
    expect(tasks[0]).toMatchObject({ endAbs: boundaries.pageStarts[2] - 1 });
    expect(tasks[301]).toMatchObject({ startAbs: boundaries.pageStarts[602], endAbs: 6235 });
  });

  it("half-page unit: alternating halves that reassemble pages", () => {
    const tasks = walk(makePlan({ unit: 'half-page' }));
    expect(tasks.length).toBe(1208); // 604 x 2
    for (let i = 1; i < tasks.length; i++) {
      expect(tasks[i].startAbs).toBe(tasks[i - 1].endAbs + 1);
    }
  });

  it("rub and hizb units align to quarter boundaries", () => {
    const rub = walk(makePlan({ unit: 'rub' }));
    expect(rub.length).toBe(240);
    expect(rub[5]).toMatchObject({ startAbs: boundaries.quarterStarts[5], endAbs: boundaries.quarterStarts[6] - 1 });

    const hizb = walk(makePlan({ unit: 'hizb' }));
    expect(hizb.length).toBe(60);
    expect(hizb[3]).toMatchObject({ startAbs: boundaries.quarterStarts[12], endAbs: boundaries.quarterStarts[16] - 1 });
  });

  it("returns null beyond the last task", () => {
    const plan = makePlan({ unit: 'page' });
    expect(getTaskSegment(plan, boundaries, 604)).toBeNull();
    expect(getTaskSegment(plan, boundaries, -1)).toBeNull();
  });
});

describe("start surah", () => {
  it("forward plan begins exactly at the chosen surah's first ayah", () => {
    for (const unit of ['ayah', 'half-page', 'page', 'two-pages', 'rub', 'hizb'] as const) {
      const plan = makePlan({ direction: 'forward', startSurah: 36, unit, ayahsPerDay: 20 });
      const first = getTaskSegment(plan, boundaries, 0)!;
      expect(first.startAbs).toBe(absIndex(36, 1));
    }
  });

  it("backward plan starts AT the chosen surah and descends till Al-Fatiha", () => {
    const plan = makePlan({ direction: 'backward', startSurah: 78, unit: 'page' });
    const tasks = walk(plan);
    expect(tasks[0].startAbs).toBe(absIndex(78, 1)); // begins at the chosen surah
    expect(tasks[tasks.length - 1].endAbs).toBe(absIndex(2, 1) - 1); // finishes with Al-Fatiha

    const covered = new Set<number>();
    for (const t of tasks) {
      for (let a = t.startAbs; a <= t.endAbs; a++) covered.add(a);
    }
    expect(covered.size).toBe(absIndex(79, 1)); // exactly [Fatiha .. end of surah 78]
    expect(covered.has(absIndex(79, 1))).toBe(false); // nothing after the start surah
    expect(covered.has(absIndex(114, 1))).toBe(false);
  });

  it("backward with startSurah=2 covers only surahs 2..1", () => {
    const plan = makePlan({ direction: 'backward', startSurah: 2, unit: 'page' });
    const tasks = walk(plan);
    expect(tasks[0].startAbs).toBe(absIndex(2, 1));
    expect(tasks[tasks.length - 1].endAbs).toBe(6); // Fatiha's last ayah (abs of Baqarah 1 minus 1)
    expect(getTotalTasks(plan, boundaries)).toBeLessThan(getTotalTasks({ ...plan, startSurah: 3 }, boundaries));
  });

  it("surah starts begin tasks in backward mode for every unit", () => {
    for (const unit of ['ayah', 'half-page', 'page', 'two-pages', 'rub', 'hizb'] as const) {
      const plan = makePlan({ direction: 'backward', startSurah: 50, unit, ayahsPerDay: 10 });
      const startSet = new Set(walk(plan).map(t => t.startAbs));
      for (let s = 1; s <= 50; s++) {
        expect(startSet.has(absIndex(s, 1))).toBe(true);
      }
    }
  });

  it("backward startSurah=114 spans An-Nas down to Al-Fatiha (full mushaf)", () => {
    const plan = makePlan({ direction: 'backward', startSurah: 114, unit: 'ayah', ayahsPerDay: 3 });
    const tasks = walk(plan);
    expect(tasks[0]).toMatchObject({ startAbs: absIndex(114, 1), endAbs: absIndex(114, 3) });
    expect(tasks[tasks.length - 1].endAbs).toBe(6); // finishes with Al-Fatiha
    const covered = new Set<number>();
    for (const t of tasks) for (let a = t.startAbs; a <= t.endAbs; a++) covered.add(a);
    expect(covered.size).toBe(6236);
  });

  it("getSurahFirstPage finds the first page where a surah appears", () => {
    for (const s of [1, 2, 36, 70, 78, 110, 114]) {
      const abs = absIndex(s, 1);
      let expected = 1;
      while (expected < boundaries.pageStarts.length && boundaries.pageStarts[expected] <= abs) expected++;
      expect(getSurahFirstPage(boundaries, s)).toBe(expected);
    }
  });
});

describe("memorize/rest cycle dates", () => {
  it("daily without rest", () => {
    const daily = makePlan({ startDate: '2026-03-01', memorizeDays: 1, restDays: 0 });
    expect(getTaskDate(daily, 0)).toBe('2026-03-01');
    expect(getTaskDate(daily, 2)).toBe('2026-03-03');
  });

  it("one on, one off", () => {
    const plan = makePlan({ startDate: '2026-03-01', memorizeDays: 1, restDays: 1 });
    expect(getTaskDate(plan, 0)).toBe('2026-03-01');
    expect(getTaskDate(plan, 1)).toBe('2026-03-03'); // rest on 03-02
    expect(getTaskDate(plan, 2)).toBe('2026-03-05');
  });

  it("two memorize days then one rest day", () => {
    const plan = makePlan({ startDate: '2026-03-01', memorizeDays: 2, restDays: 1 });
    expect(getTaskDate(plan, 0)).toBe('2026-03-01');
    expect(getTaskDate(plan, 1)).toBe('2026-03-02');
    expect(getTaskDate(plan, 2)).toBe('2026-03-04'); // rest on 03-03
    expect(getTaskDate(plan, 3)).toBe('2026-03-05');
    expect(getTaskDate(plan, 4)).toBe('2026-03-07');
  });

  it("date math is direction-independent", () => {
    const plan = makePlan({ startDate: '2026-03-01', memorizeDays: 2, restDays: 1, direction: 'backward' });
    expect(getTaskDate(plan, 4)).toBe('2026-03-07');
  });
});

describe("revision ranges (Z memorized + N − Z previous, cut when a surah is midway)", () => {
  const pageOf = (abs: number) => boundaries.pageStarts.findIndex(p => p > abs) - 1;
  const pages = (ranges: { startAbs: number; endAbs: number }[]) =>
    ranges.reduce((sum, r) => sum + pageOf(r.endAbs) - pageOf(r.startAbs) + 1, 0);

  it("no revision when revisionPages is 0 or nothing is memorized yet", () => {
    expect(getRevisionRanges(makePlan({ revisionPages: 0, startSurah: 78, direction: 'backward' }), boundaries, 0)).toEqual([]);
    // backward plan starting at An-Nas: nothing memorized before it yet
    expect(getRevisionRanges(makePlan({ revisionPages: 20, startSurah: 114, direction: 'backward' }), boundaries, 0)).toEqual([]);
    // forward plan starting at Al-Fatiha (page 1): nothing before it
    expect(getRevisionRanges(makePlan({ revisionPages: 20, startSurah: 1, direction: 'forward' }), boundaries, 0)).toEqual([]);
  });

  it("backward day 0: the N pages of the previous pool, past the cut page", () => {
    const plan = makePlan({ revisionPages: 20, startSurah: 78, direction: 'backward' });
    const ranges = getRevisionRanges(plan, boundaries, 0);
    expect(ranges.length).toBe(1);
    const firstEnd = absIndex(79, 1) - 1;
    const startIdx = pageOf(firstEnd) + 1; // skip the page holding the surah
    expect(ranges[0].startAbs).toBe(boundaries.pageStarts[startIdx]);
    expect(ranges[0].endAbs).toBe(boundaries.pageStarts[startIdx + 20] - 1);
    expect(pages(ranges)).toBe(20);
  });

  it("backward day 1 (surah midway): two ranges — Z below the cut, N − Z above", () => {
    const plan = makePlan({ revisionPages: 20, unit: 'page', startSurah: 78, direction: 'backward' });
    const ranges = getRevisionRanges(plan, boundaries, 1);
    expect(ranges.length).toBe(2);

    // range 1: the memorized page of the current surah (Z = 1)
    expect(ranges[0].startAbs).toBe(absIndex(78, 1));
    expect(ranges[0].endAbs).toBe(getTaskSegment(plan, boundaries, 0)!.endAbs);

    // range 2: the N − Z = 19 previous pages, starting after the cut page
    const firstEnd = absIndex(79, 1) - 1;
    const cutIdx = pageOf(firstEnd) + 1;
    expect(ranges[1].startAbs).toBe(boundaries.pageStarts[cutIdx]);
    expect(pageOf(ranges[1].endAbs) - pageOf(ranges[1].startAbs) + 1).toBe(19);
    expect(pages(ranges)).toBe(20);
  });

  it("backward: once the surah is finished the revision is ONE normal N-page span", () => {
    const plan = makePlan({ revisionPages: 20, unit: 'page', startSurah: 78, direction: 'backward' });
    const ranges = getRevisionRanges(plan, boundaries, 2);
    expect(ranges.length).toBe(1);
    expect(ranges[0].startAbs).toBe(absIndex(78, 1));
    // the surah's 2 pages merge with the previous pool into one span
    expect(ranges[0].endAbs).toBeGreaterThan(getTaskSegment(plan, boundaries, 1)!.endAbs);
    expect(pages(ranges)).toBe(20);
  });

  it("backward deeper (next surah midway): two ranges totalling N pages", () => {
    const plan = makePlan({ revisionPages: 20, unit: 'page', startSurah: 78, direction: 'backward' });
    const ranges = getRevisionRanges(plan, boundaries, 3);
    expect(ranges.length).toBe(2);
    // lower range: the next surah's memorized page
    expect(ranges[0].startAbs).toBe(absIndex(77, 1));
    expect(ranges[0].endAbs).toBe(getTaskSegment(plan, boundaries, 2)!.endAbs);
    // upper range: the completed surahs + previous pool
    expect(ranges[1].startAbs).toBe(absIndex(78, 1));
    expect(pages(ranges)).toBe(20);
  });

  it("checking today's task or running ahead of schedule pulls the ranges forward", () => {
    // index 1 with task 1 already marked done: progress = max(0, 1) = 1,
    // the surah is finished → one normal 20-page span from its first ayah
    const checked = makePlan({
      revisionPages: 20, unit: 'page',
      startSurah: 78, direction: 'backward',
      completedTasks: [1],
    });
    const ranges = getRevisionRanges(checked, boundaries, 1);
    expect(ranges.length).toBe(1);
    expect(ranges[0].startAbs).toBe(absIndex(78, 1));
    expect(pages(ranges)).toBe(20);

    // day 5 with a stale checkmark: the schedule (task 4) wins
    const stale = makePlan({
      revisionPages: 20, unit: 'page',
      startSurah: 78, direction: 'backward',
      completedTasks: [0],
    });
    const ahead = getRevisionRanges(stale, boundaries, 5);
    const frontier = getTaskSegment(stale, boundaries, 4)!;
    const fs = resolveAbsIndex(frontier.startAbs).surah;
    expect(ahead[0].startAbs).toBe(absIndex(fs, 1));
  });

  it("backward trims to the newest N pages once in-plan progress exceeds N", () => {
    const plan = makePlan({ revisionPages: 3, unit: 'page', startSurah: 78, direction: 'backward' });
    const ranges = getRevisionRanges(plan, boundaries, 10);
    expect(pages(ranges)).toBe(3);
    // the newest page (the frontier's) is always included
    const frontier = getTaskSegment(plan, boundaries, 9)!;
    expect(pageOf(ranges[0].startAbs)).toBe(pageOf(frontier.startAbs));
  });

  it("backward from An-Nas: the revision grows from zero with progress", () => {
    const empty = makePlan({ revisionPages: 20, startSurah: 114, direction: 'backward' });
    expect(getRevisionRanges(empty, boundaries, 0)).toEqual([]);

    const growing = makePlan({
      revisionPages: 20, unit: 'page',
      startSurah: 114, direction: 'backward',
      completedTasks: [0],
    });
    const ranges = getRevisionRanges(growing, boundaries, 1);
    expect(ranges.length).toBe(1);
    expect(ranges[0].startAbs).toBe(absIndex(114, 1));
    expect(ranges[0].endAbs).toBe(6235); // clamped: An-Nas fits on the last page
  });

  it("backward: clamps at the end of the mushaf", () => {
    const plan = makePlan({ revisionPages: 20, startSurah: 110, direction: 'backward' });
    const ranges = getRevisionRanges(plan, boundaries, 0);
    expect(ranges.length).toBe(1);
    expect(ranges[0].endAbs).toBe(6235); // An-Nas's last ayah
  });

  it("forward: one span ending at the last memorized page", () => {
    const plan = makePlan({ revisionPages: 20, unit: 'page', startSurah: 36, direction: 'forward' });

    // no progress yet: ends right before the start surah
    const day0 = getRevisionRanges(plan, boundaries, 0);
    expect(day0.length).toBe(1);
    expect(day0[0].endAbs).toBe(absIndex(36, 1) - 1);

    // day 2: two pages memorized in-plan; the span ends at the newest one
    const day2 = getRevisionRanges(plan, boundaries, 2);
    expect(day2.length).toBe(1);
    expect(day2[0].endAbs).toBe(getTaskSegment(plan, boundaries, 1)!.endAbs);
    expect(pages(day2)).toBe(20);
  });
});

describe("juz revision (one juz spread over each cycle's days)", () => {
  it("getJuzSpan covers each juz exactly (juz 29 ends where juz 30 starts)", () => {
    expect(getJuzSpan(boundaries, 29)).toEqual({ startAbs: absIndex(67, 1), endAbs: absIndex(78, 1) - 1 });
    expect(getJuzSpan(boundaries, 30)).toEqual({ startAbs: absIndex(78, 1), endAbs: 6235 });
    expect(getJuzSpan(boundaries, 1).startAbs).toBe(0);
  });

  it("no juz revision when the frequency is off or the pool is empty", () => {
    const off = makePlan({ startSurah: 77, direction: 'backward', juzRevisionFrequency: 'off' });
    expect(getJuzRevisionPortion(off, boundaries, '2026-01-01')).toBeNull();

    // backward starting AT An-Nas: nothing memorized before it yet
    const empty = makePlan({ startSurah: 114, direction: 'backward', juzRevisionFrequency: 'weekly' });
    expect(getJuzRevisionPortion(empty, boundaries, '2026-01-01')).toBeNull();
  });

  it("backward: previously-memorized juz derive automatically from the start point (user's example)", () => {
    // memorized juz 30 before the plan; memorizing juz 29 now (backward
    // from surah 77, one page a day, once a week)
    const plan = makePlan({
      startDate: '2026-01-01',
      startSurah: 77, direction: 'backward', unit: 'page',
      juzRevisionFrequency: 'weekly',
    });

    // day 0: only juz 30 lies wholly after the start surah
    expect(getJuzPool(plan, boundaries, '2026-01-01')).toEqual([30]);
    // the whole week carries juz 30, one slice per day
    for (let i = 0; i < 7; i++) {
      const p = getJuzRevisionPortion(plan, boundaries, addDaysToKey('2026-01-01', i))!;
      expect(p.juz).toBe(30);
      expect(p.dayInSlot).toBe(i + 1);
      expect(p.slotDays).toBe(7);
    }
    // the 7 slices tile the juz exactly, in reading order, and split evenly
    const whole = describeSegment({ index: 0, ...getJuzSpan(boundaries, 30) }, boundaries);
    const slices = Array.from({ length: 7 }, (_, i) =>
      describeSegment(
        { index: 0, ...getJuzRevisionPortion(plan, boundaries, addDaysToKey('2026-01-01', i))! },
        boundaries
      )
    );
    expect(slices[0].pageFrom).toBe(whole.pageFrom);
    expect(slices[6].pageTo).toBe(whole.pageTo);
    for (let i = 1; i < 7; i++) {
      expect(slices[i].pageFrom).toBe(slices[i - 1].pageTo + 1);
    }
    const sizes = slices.map(s => s.pageTo - s.pageFrom + 1);
    expect(sizes.reduce((a, z) => a + z, 0)).toBe(whole.pageTo - whole.pageFrom + 1);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);

    // juz 29 completes once the frontier leaves surah 67
    let p0 = 0;
    while (resolveAbsIndex(getTaskSegment(plan, boundaries, p0)!.startAbs).surah > 66) p0++;
    const completionOffset = p0 + 1;
    // first weekly window at/after the completion
    const s0 = Math.ceil(completionOffset / 7);
    const at = (slot: number) => addDaysToKey('2026-01-01', slot * 7);

    // consecutive weeks alternate 29 / 30 / 29 (or 30 / 29 / 30)
    const a = getJuzRevisionPortion(plan, boundaries, at(s0))!.juz;
    const b = getJuzRevisionPortion(plan, boundaries, at(s0 + 1))!.juz;
    const c = getJuzRevisionPortion(plan, boundaries, at(s0 + 2))!.juz;
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).toBe(c);
    expect([29, 30]).toContain(a);
    expect([29, 30]).toContain(b);
  });

  it("backward: a juz straddling the start point completes in-plan", () => {
    // backward from surah 78 (the start of juz 30): juz 30 needs surah 78,
    // which the plan memorizes — it joins once the frontier enters surah 77
    const plan = makePlan({
      startDate: '2026-01-01',
      startSurah: 78, direction: 'backward', unit: 'page',
      juzRevisionFrequency: 'weekly',
    });
    // nothing memorized yet and nothing wholly after An-Nas's first surah
    expect(getJuzPool(plan, boundaries, '2026-01-01')).toEqual([]);
    // find the first task below surah 78; the day after it juz 30 completes
    let p = 0;
    while (resolveAbsIndex(getTaskSegment(plan, boundaries, p)!.startAbs).surah >= 78) p++;
    expect(getJuzPool(plan, boundaries, addDaysToKey('2026-01-01', p))).not.toContain(30);
    expect(getJuzPool(plan, boundaries, addDaysToKey('2026-01-01', p + 1))).toContain(30);
  });

  it("twice-weekly: two windows per week (3 days then 4 days)", () => {
    const plan = makePlan({
      startDate: '2026-01-01',
      startSurah: 77, direction: 'backward', unit: 'page',
      juzRevisionFrequency: 'twice-weekly',
    });
    const at = (offset: number) => getJuzRevisionPortion(plan, boundaries, addDaysToKey('2026-01-01', offset));
    // window 1: days 0–2 (3 days) — juz 30 split over 3 days
    expect(at(0)!.juz).toBe(30);
    expect(at(0)!.dayInSlot).toBe(1);
    expect(at(0)!.slotDays).toBe(3);
    expect(at(1)!.juz).toBe(30);
    expect(at(2)!.juz).toBe(30);
    // window 2: days 3–6 (4 days) — still juz 30 (one-juz pool)
    expect(at(3)!.juz).toBe(30);
    expect(at(3)!.dayInSlot).toBe(1);
    expect(at(3)!.slotDays).toBe(4);
    expect(at(6)!.juz).toBe(30);
    expect(at(6)!.dayInSlot).toBe(4);
    // the following week repeats the rhythm
    expect(at(7)!.juz).toBe(30);
    expect(at(7)!.slotDays).toBe(3);
    expect(at(10)!.juz).toBe(30);
    expect(at(10)!.slotDays).toBe(4);
  });

  it("monthly: one 30-day window — a page a day until the juz runs out", () => {
    const plan = makePlan({
      startDate: '2026-01-01',
      startSurah: 77, direction: 'backward', unit: 'page',
      juzRevisionFrequency: 'monthly',
    });
    const at = (offset: number) => getJuzRevisionPortion(plan, boundaries, addDaysToKey('2026-01-01', offset));
    // juz 30 holds 23 pages in this mushaf: 23 days of one page each
    expect(at(0)!.juz).toBe(30);
    expect(at(0)!.slotDays).toBe(30);
    expect(at(0)!.dayInSlot).toBe(1);
    expect(at(22)!.juz).toBe(30);
    expect(at(22)!.dayInSlot).toBe(23);
    // the juz is exhausted before the window ends: nothing left to carry
    expect(at(23)).toBeNull();
    expect(at(29)).toBeNull();
    // the next month's window starts fresh
    expect(at(30)!.juz).toBe(30);
    expect(at(30)!.dayInSlot).toBe(1);
    expect(at(60)!.juz).toBe(30);
  });

  it("forward: previously-memorized juz derive from the start point, newest-first", () => {
    // forward from surah 67: juz 1..28 lie wholly before it
    const plan = makePlan({
      startDate: '2026-01-01',
      startSurah: 67, direction: 'forward', unit: 'page',
      juzRevisionFrequency: 'weekly',
    });
    const pool = getJuzPool(plan, boundaries, '2026-01-01');
    expect(pool.length).toBe(28);
    expect(pool[0]).toBe(28); // newest = highest
    expect(pool[27]).toBe(1);
    // weekly windows walk the pool one juz at a time: 28, 27, 26, ...
    expect(getJuzRevisionPortion(plan, boundaries, '2026-01-01')!.juz).toBe(28);
    // mid-window days keep the same juz and take its next slice
    const mid = getJuzRevisionPortion(plan, boundaries, '2026-01-04')!;
    expect(mid.juz).toBe(28);
    expect(mid.dayInSlot).toBe(4);
    expect(getJuzRevisionPortion(plan, boundaries, '2026-01-08')!.juz).toBe(27);
    expect(getJuzRevisionPortion(plan, boundaries, '2026-01-15')!.juz).toBe(26);
  });

  it("forward: juz completed inside the plan join the pool", () => {
    const plan = makePlan({
      startDate: '2026-01-01',
      startSurah: 1, direction: 'forward', unit: 'page',
      juzRevisionFrequency: 'weekly',
    });
    // after ~30 pages the first juz is fully covered
    expect(getJuzPool(plan, boundaries, addDaysToKey('2026-01-01', 30))).toEqual([1]);
    // and a week later the window still rotates over just that juz
    expect(getJuzRevisionPortion(plan, boundaries, addDaysToKey('2026-01-01', 35))!.juz).toBe(1);
    // mid-window days carry slices of the same juz
    const mid = getJuzRevisionPortion(plan, boundaries, addDaysToKey('2026-01-01', 37))!;
    expect(mid.juz).toBe(1);
    expect(mid.dayInSlot).toBe(3);
  });

  it("nothing before the plan's start date", () => {
    const plan = makePlan({
      startDate: '2026-01-10',
      startSurah: 77, direction: 'backward', unit: 'page',
      juzRevisionFrequency: 'weekly',
    });
    expect(getJuzRevisionPortion(plan, boundaries, '2026-01-03')).toBeNull();
  });

  it("toggles juz revisions by date keeping sorted order", () => {
    let plan = makePlan();
    plan = toggleJuzRevision(plan, '2026-03-01');
    plan = toggleJuzRevision(plan, '2026-02-01');
    expect(plan.completedJuz).toEqual(['2026-02-01', '2026-03-01']);
    plan = toggleJuzRevision(plan, '2026-03-01');
    expect(plan.completedJuz).toEqual(['2026-02-01']);
  });
});

describe("calendar day mapping", () => {
  it("maps days to tasks and rest days without rest", () => {
    const plan = makePlan({ startDate: '2026-03-01', memorizeDays: 1, restDays: 0 });
    expect(getDayKind(plan, '2026-03-01')).toEqual({ type: 'memorize', index: 0 });
    expect(getDayKind(plan, '2026-03-05')).toEqual({ type: 'memorize', index: 4 });
  });

  it("maps days with a memorize/rest cycle", () => {
    const plan = makePlan({ startDate: '2026-03-01', memorizeDays: 2, restDays: 1 });
    expect(getDayKind(plan, '2026-03-01')).toEqual({ type: 'memorize', index: 0 });
    expect(getDayKind(plan, '2026-03-02')).toEqual({ type: 'memorize', index: 1 });
    expect(getDayKind(plan, '2026-03-03')).toEqual({ type: 'rest' });
    expect(getDayKind(plan, '2026-03-04')).toEqual({ type: 'memorize', index: 2 });
    expect(getDayKind(plan, '2026-03-06')).toEqual({ type: 'rest' });
  });

  it("days before the plan start are off-plan", () => {
    const plan = makePlan({ startDate: '2026-03-10' });
    expect(getDayKind(plan, '2026-03-09')).toEqual({ type: 'off' });
    expect(getDayKind(plan, '2026-03-10')).toEqual({ type: 'memorize', index: 0 });
  });

  it("task dates round-trip through getDayKind", () => {
    const plan = makePlan({ startDate: '2026-03-01', memorizeDays: 2, restDays: 1 });
    for (let i = 0; i < 12; i++) {
      const dateKey = getTaskDate(plan, i);
      expect(getDayKind(plan, dateKey)).toEqual({ type: 'memorize', index: i });
    }
  });

  it("indices past the final task are still memorize days (plan finished)", () => {
    const plan = makePlan({ unit: 'page' });
    const total = getTotalTasks(plan, boundaries);
    const lastDate = getTaskDate(plan, total - 1);
    expect(getDayKind(plan, lastDate)).toEqual({ type: 'memorize', index: total - 1 });
    expect(getTaskSegment(plan, boundaries, getDayKind(plan, addDaysToKey(lastDate, 1)).type === 'memorize'
      ? (getDayKind(plan, addDaysToKey(lastDate, 1)) as { index: number }).index
      : -1)).toBeNull();
  });
});

describe("completion & stats", () => {
  it("toggles tasks keeping sorted order", () => {
    let plan = makePlan();
    plan = toggleTask(plan, 4);
    plan = toggleTask(plan, 1);
    expect(plan.completedTasks).toEqual([1, 4]);
    plan = toggleTask(plan, 4);
    expect(plan.completedTasks).toEqual([1]);
  });

  it("toggles revisions independently of tasks", () => {
    let plan = makePlan();
    plan = toggleTask(plan, 1);
    plan = toggleRevision(plan, 3);
    plan = toggleRevision(plan, 1);
    expect(plan.completedTasks).toEqual([1]);
    expect(plan.completedRevisions).toEqual([1, 3]);
    plan = toggleRevision(plan, 3);
    expect(plan.completedRevisions).toEqual([1]);
    expect(toggleRevision(plan, 1).completedRevisions).toEqual([]);
  });

  it("next-task index skips completed and clamps at the end", () => {
    let plan = makePlan();
    expect(getNextTaskIndex(plan, boundaries)).toBe(0);
    plan = toggleTask(plan, 0);
    expect(getNextTaskIndex(plan, boundaries)).toBe(1);

    let donePlan = makePlan();
    const total = getTotalTasks(donePlan, boundaries);
    for (let i = 0; i < total; i++) donePlan = toggleTask(donePlan, i);
    expect(getNextTaskIndex(donePlan, boundaries)).toBe(total);
  });

  it("computes stats and finished state", () => {
    let plan = makePlan();
    plan = toggleTask(plan, 0);
    const stats = getStats(plan, boundaries);
    expect(stats.doneTasks).toBe(1);
    expect(stats.totalTasks).toBe(604);
    expect(stats.finished).toBe(false);
    expect(stats.percent).toBe(Math.round((1 / 604) * 100));
  });
});

describe("segment description & storage", () => {
  it("describes segments with surah/ayah/page info", () => {
    const info = describeSegment(getTaskSegment(makePlan(), boundaries, 49)!, boundaries);
    const [surahId, ayahNum] = meta.pages[49];
    expect(info.surahFrom).toBe(surahId);
    expect(info.ayahFrom).toBe(ayahNum);
    expect(info.pageFrom).toBe(50);
  });

  beforeEach(() => localStorage.clear());

  it("saves, loads and clears via the new storage key", () => {
    expect(loadMemorizePlan()).toBeNull();
    saveMemorizePlan(makePlan());
    expect(loadMemorizePlan()).toEqual(makePlan());
    clearMemorizePlan();
    expect(loadMemorizePlan()).toBeNull();
    expect(localStorage.getItem('quran-memorize-plan')).toBeNull();
  });

  it("upgrades a v7 payload (no startSurah) to v12 with defaults", () => {
    localStorage.setItem('quran-memorize-plan', JSON.stringify({
      version: 7,
      createdAt: Date.now(),
      startDate: todayKey(),
      unit: 'page',
      ayahsPerDay: 0,
      memorizeDays: 1,
      restDays: 1,
      direction: 'backward',
      completedTasks: [2],
    }));
    const loaded = loadMemorizePlan();
    expect(loaded!.version).toBe(12);
    expect(loaded!.startSurah).toBe(1);
    expect(loaded!.direction).toBe('backward');
    expect(loaded!.revisionPages).toBe(20);
    expect(loaded!.completedRevisions).toEqual([]);
    expect(loaded!.juzRevisionFrequency).toBe('off');
    expect(loaded!.completedJuz).toEqual([]);
  });

  it("upgrades a v8 payload (no revisionPages) to v12 keeping explicit revisionPages", () => {
    localStorage.setItem('quran-memorize-plan', JSON.stringify({
      version: 8,
      createdAt: Date.now(),
      startDate: todayKey(),
      startSurah: 36,
      unit: 'page',
      ayahsPerDay: 0,
      memorizeDays: 1,
      restDays: 0,
      direction: 'forward',
      revisionPages: 40,
      completedTasks: [],
    }));
    const loaded = loadMemorizePlan();
    expect(loaded!.version).toBe(12);
    expect(loaded!.startSurah).toBe(36);
    expect(loaded!.revisionPages).toBe(40);
    expect(loaded!.completedRevisions).toEqual([]);
  });

  it("upgrades a v9 payload (no completedRevisions) to v12", () => {
    localStorage.setItem('quran-memorize-plan', JSON.stringify({
      version: 9,
      createdAt: Date.now(),
      startDate: todayKey(),
      startSurah: 78,
      unit: 'page',
      ayahsPerDay: 0,
      memorizeDays: 1,
      restDays: 0,
      direction: 'backward',
      revisionPages: 20,
      completedTasks: [0, 1],
    }));
    const loaded = loadMemorizePlan();
    expect(loaded!.version).toBe(12);
    expect(loaded!.completedTasks).toEqual([0, 1]);
    expect(loaded!.completedRevisions).toEqual([]);
  });

  it("upgrades a v10 payload (no juz fields) to v12 keeping them defaulted", () => {
    localStorage.setItem('quran-memorize-plan', JSON.stringify({
      version: 10,
      createdAt: Date.now(),
      startDate: todayKey(),
      startSurah: 77,
      unit: 'page',
      ayahsPerDay: 0,
      memorizeDays: 1,
      restDays: 0,
      direction: 'backward',
      revisionPages: 20,
      completedTasks: [0, 1],
      completedRevisions: [0],
    }));
    const loaded = loadMemorizePlan();
    expect(loaded!.version).toBe(12);
    expect(loaded!.completedTasks).toEqual([0, 1]);
    expect(loaded!.completedRevisions).toEqual([0]);
    expect(loaded!.juzRevisionFrequency).toBe('off');
    expect(loaded!.completedJuz).toEqual([]);
  });

  it("upgrades a v11 payload (manual memorizedJuz) to v12 deriving juz automatically", () => {
    localStorage.setItem('quran-memorize-plan', JSON.stringify({
      version: 11,
      createdAt: Date.now(),
      startDate: todayKey(),
      startSurah: 77,
      unit: 'page',
      ayahsPerDay: 0,
      memorizeDays: 1,
      restDays: 0,
      direction: 'backward',
      revisionPages: 20,
      completedTasks: [0, 1],
      completedRevisions: [0],
      juzRevisionFrequency: 'weekly',
      memorizedJuz: 1,
      completedJuz: ['2026-01-01'],
    }));
    const loaded = loadMemorizePlan();
    expect(loaded!.version).toBe(12);
    expect(loaded!.juzRevisionFrequency).toBe('weekly');
    expect(loaded!.completedJuz).toEqual(['2026-01-01']);
    expect('memorizedJuz' in loaded!).toBe(false); // derived automatically now
  });

  it("migrates a legacy revision-key plan into the new key", () => {
    const v5Shape = {
      version: 5,
      createdAt: Date.now(),
      startDate: todayKey(),
      unit: 'page',
      ayahsPerDay: 0,
      memorizeDays: 2,
      restDays: 1,
      direction: 'backward',
      completedTasks: [3],
    };
    localStorage.setItem('quran-revision-plan', JSON.stringify(v5Shape));

    const loaded = loadMemorizePlan();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(12);
    expect(loaded!.startSurah).toBe(1);
    expect(loaded!.direction).toBe('backward');
    expect(loaded!.completedTasks).toEqual([3]);
    expect(loaded!.revisionPages).toBe(20);
    expect(loaded!.completedRevisions).toEqual([]);

    expect(JSON.parse(localStorage.getItem('quran-memorize-plan')!).version).toBe(12);
    expect(localStorage.getItem('quran-revision-plan')).toBeNull();
  });

  it("rejects invalid payloads", () => {
    localStorage.setItem('quran-memorize-plan', 'not-json{');
    expect(loadMemorizePlan()).toBeNull();
  });
});
