// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  MemorizePlan,
  loadMemorizePlan, saveMemorizePlan, clearMemorizePlan,
  getTaskSegment, getTotalTasks, getStats, getNextTaskIndex, toggleTask,
  getTaskDate, describeSegment, resolveAbsIndex, getSurahFirstPage,
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
};

function makePlan(overrides: Partial<MemorizePlan> = {}): MemorizePlan {
  return {
    version: 8,
    createdAt: Date.now(),
    startDate: '2026-01-01',
    startSurah: 1,
    unit: 'page',
    ayahsPerDay: 0,
    memorizeDays: 1,
    restDays: 0,
    direction: 'forward',
    completedTasks: [],
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

describe("completion & stats", () => {
  it("toggles tasks keeping sorted order", () => {
    let plan = makePlan();
    plan = toggleTask(plan, 4);
    plan = toggleTask(plan, 1);
    expect(plan.completedTasks).toEqual([1, 4]);
    plan = toggleTask(plan, 4);
    expect(plan.completedTasks).toEqual([1]);
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

  it("upgrades a v7 payload (no startSurah) to v8", () => {
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
    expect(loaded!.version).toBe(8);
    expect(loaded!.startSurah).toBe(1);
    expect(loaded!.direction).toBe('backward');
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
    expect(loaded!.version).toBe(8);
    expect(loaded!.startSurah).toBe(1);
    expect(loaded!.direction).toBe('backward');
    expect(loaded!.completedTasks).toEqual([3]);

    expect(JSON.parse(localStorage.getItem('quran-memorize-plan')!).version).toBe(8);
    expect(localStorage.getItem('quran-revision-plan')).toBeNull();
  });

  it("rejects invalid payloads", () => {
    localStorage.setItem('quran-memorize-plan', 'not-json{');
    expect(loadMemorizePlan()).toBeNull();
  });
});
