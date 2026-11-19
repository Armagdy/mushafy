/**
 * Quran word-search Web Worker.
 *
 * The full-Quran scan (~6,236 verses) runs HERE, off the UI thread, so the
 * user can always type without any lag or block: the main thread only sends
 * the query and paints the results. Previously the scan ran on the UI thread
 * with the tolerant regex rebuilt for every single verse — that froze typing
 * for the whole scan.
 *
 * Protocol:
 *   main → { type: 'load', data }                     once: full ayah metadata
 *   main ← { type: 'loaded' }                          worker flattened the data
 *   main → { type: 'search', id, query, wholeWord?, includeEnglish? }
 *   main ← { type: 'results', id, query, count, results }
 *
 *   `count` is the TOTAL number of matching ayahs; `results` is capped at
 *   MAX_WORKER_RESULTS to keep the postMessage clone and result rendering
 *   cheap even for very common words.
 */
import { buildArabicSearchRegex } from './arabic-search';

/** Must stay in sync with MAX_SEARCH_RESULTS in quran-search.ts */
const MAX_WORKER_RESULTS = 200;

// Flat verse record — short keys keep the per-search loop tight and the
// in-worker memory small
interface FlatVerse {
  s: number;   // surah number
  na: string;  // surah name (Arabic)
  ne: string;  // surah name (English)
  n: number;   // ayah number
  t: string;   // Arabic (Uthmani) text
  e: string;   // English text
  p: number;   // page
  j: number;   // juz
}

// Minimal typing for the worker global scope (DedicatedWorkerGlobalScope
// is not part of this project's configured TS libs)
interface WorkerCtx {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage(msg: any): void;
}

const ctx = self as unknown as WorkerCtx;

let verses: FlatVerse[] | null = null;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data;

  if (msg.type === 'load') {
    // Flatten once so every later search is a tight loop over small objects
    const flat: FlatVerse[] = [];
    for (const surah of msg.data as any[]) {
      const na = typeof surah.name === 'object' ? surah.name.ar : surah.name;
      const ne = typeof surah.name === 'object' ? surah.name.en : (surah.englishName || surah.name);
      for (const verse of surah.verses ?? []) {
        flat.push({
          s: surah.number,
          na,
          ne,
          n: verse.number,
          t: verse.text?.ar ?? '',
          e: verse.text?.en ?? '',
          p: verse.page,
          j: verse.juz,
        });
      }
    }
    verses = flat;
    ctx.postMessage({ type: 'loaded' });
    return;
  }

  if (msg.type === 'search') {
    const results: any[] = [];
    let count = 0;
    const list = verses;

    if (list) {
      // Build the tolerant Uthmani regex ONCE per query (the old code
      // rebuilt it for every verse — this alone is a massive speedup)
      const regex = buildArabicSearchRegex(msg.query, { wholeWord: msg.wholeWord === true });
      const includeEnglish = msg.includeEnglish === true;
      const wholeWord = msg.wholeWord === true;
      const queryLower = String(msg.query).toLowerCase();
      // English whole-word matcher, also built once per query
      const englishWholeWordRe = includeEnglish && wholeWord
        ? new RegExp(`(^|\\s)${escapeRegExp(queryLower)}(\\s|$)`)
        : null;

      for (const v of list) {
        const matchesArabic = regex !== null && regex.test(v.t);
        if (!matchesArabic) {
          if (!includeEnglish) continue;
          const englishLower = v.e.toLowerCase();
          const matchesEnglish = englishWholeWordRe
            ? englishWholeWordRe.test(englishLower)
            : englishLower.includes(queryLower);
          if (!matchesEnglish) continue;
        }

        count++;
        if (results.length < MAX_WORKER_RESULTS) {
          results.push({
            surahNumber: v.s,
            surahName: v.na,
            surahNameEn: v.ne,
            ayahNumber: v.n,
            arabicText: v.t,
            englishText: v.e,
            page: v.p,
            juz: v.j,
          });
        }
      }
    }

    ctx.postMessage({ type: 'results', id: msg.id, query: msg.query, count, results });
  }
};
