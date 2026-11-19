/**
 * Shared Quran word-search service.
 *
 * All full-Quran searches go through here and run in a Web Worker, so the
 * UI thread — and therefore typing — is NEVER blocked by a search. The data
 * is loaded once (from the same cache useQuranData uses) and handed to the
 * worker once; every search afterwards is just a tiny message round-trip.
 *
 * If the webview has no Worker support (ancient devices only), the service
 * falls back to a chunked main-thread scan that yields to the event loop
 * between chunks, so typing still stays responsive.
 */
import QuranSearchWorker from './quran-search-worker?worker';
import { getAyahMetaData } from './quran-data-service';
import { buildArabicSearchRegex } from './arabic-search';

export interface QuranSearchResult {
  surahNumber: number;
  surahName: string;
  surahNameEn: string;
  ayahNumber: number;
  arabicText: string;
  englishText: string;
  page: number;
  juz: number;
}

export interface QuranSearchOptions {
  /** Match the query as a whole word (used when the search term ends with a space) */
  wholeWord?: boolean;
  /** Also match against the English translation */
  includeEnglish?: boolean;
}

export interface QuranSearchOutcome {
  query: string;
  /** Total number of matching ayahs (may exceed the returned results) */
  count: number;
  /** The matches, capped at MAX_SEARCH_RESULTS */
  results: QuranSearchResult[];
}

/** Cap on results handed back to the UI (keeps postMessage + rendering cheap) */
export const MAX_SEARCH_RESULTS = 200;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

class QuranSearchService {
  private worker: Worker | null = null;
  private data: any[] | null = null;
  private initPromise: Promise<void> | null = null;
  private nextId = 1;
  private pending = new Map<number, (outcome: QuranSearchOutcome) => void>();

  /**
   * Load the Quran data once and hand it to the worker. Idempotent — safe to
   * call from anywhere, any number of times. The data comes from the same
   * cache useQuranData uses, so there is no extra fetch.
   */
  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    const p = this.doInit();
    this.initPromise = p;
    // Allow a retry after a failed init (e.g. temporary fetch failure)
    p.catch(() => { this.initPromise = null; });
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    const data = await getAyahMetaData();
    if (!Array.isArray(data)) return;
    this.data = data;

    if (typeof Worker !== 'undefined') {
      try {
        const worker = new QuranSearchWorker();
        const loaded = new Promise<void>((resolve, reject) => {
          worker.onmessage = (e: MessageEvent) => {
            if (e.data?.type === 'loaded') {
              resolve();
            } else if (e.data?.type === 'results') {
              this.resolvePending(e.data);
            }
          };
          worker.onerror = () => reject(new Error('search worker failed to start'));
        });
        this.worker = worker;
        worker.postMessage({ type: 'load', data });
        // Wait until the worker confirms it flattened the data, so no search
        // can be posted before the worker is actually ready
        await loaded;
      } catch {
        this.worker = null; // fallback: chunked main-thread search
      }
    }
  }

  private resolvePending(msg: any) {
    const resolve = this.pending.get(msg.id);
    if (!resolve) return;
    this.pending.delete(msg.id);
    resolve({ query: msg.query, count: msg.count, results: msg.results });
  }

  /**
   * Search the full Quran for a word/phrase. Runs entirely in the worker
   * (off the UI thread) and resolves with the total match count plus the
   * first MAX_SEARCH_RESULTS matches.
   */
  async search(query: string, options: QuranSearchOptions = {}): Promise<QuranSearchOutcome> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return { query: trimmed, count: 0, results: [] };
    }

    try {
      await this.init();
    } catch (error) {
      console.error('Search service init failed:', error);
      return { query: trimmed, count: 0, results: [] };
    }

    if (!this.data) {
      return { query: trimmed, count: 0, results: [] };
    }

    if (this.worker) {
      const id = this.nextId++;
      return new Promise<QuranSearchOutcome>((resolve) => {
        this.pending.set(id, resolve);
        this.worker!.postMessage({
          type: 'search',
          id,
          query: trimmed,
          wholeWord: options.wholeWord === true,
          includeEnglish: options.includeEnglish === true,
        });
      });
    }

    // No Worker support: chunked scan that yields between chunks so the UI
    // thread (and typing) stays responsive
    return this.chunkedSearch(trimmed, options);
  }

  private async chunkedSearch(
    query: string,
    options: QuranSearchOptions
  ): Promise<QuranSearchOutcome> {
    const data = this.data!;
    const regex = buildArabicSearchRegex(query, { wholeWord: options.wholeWord });
    const includeEnglish = options.includeEnglish === true;
    const queryLower = query.toLowerCase();
    const wholeWordRe = options.wholeWord
      ? new RegExp(`(^|\\s)${escapeRegExp(queryLower)}(\\s|$)`)
      : null;

    const results: QuranSearchResult[] = [];
    let count = 0;
    let processed = 0;
    const CHUNK = 250;
    const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    for (const surah of data) {
      const na = typeof surah.name === 'object' ? surah.name.ar : surah.name;
      const ne = typeof surah.name === 'object' ? surah.name.en : (surah.englishName || surah.name);
      for (const verse of surah.verses ?? []) {
        const arabicText = verse.text?.ar ?? '';
        let matched = regex !== null && regex.test(arabicText);
        if (!matched && includeEnglish) {
          const englishLower = (verse.text?.en ?? '').toLowerCase();
          matched = wholeWordRe
            ? wholeWordRe.test(englishLower)
            : englishLower.includes(queryLower);
        }
        if (matched) {
          count++;
          if (results.length < MAX_SEARCH_RESULTS) {
            results.push({
              surahNumber: surah.number,
              surahName: na,
              surahNameEn: ne,
              ayahNumber: verse.number,
              arabicText: verse.text?.ar,
              englishText: verse.text?.en,
              page: verse.page,
              juz: verse.juz,
            });
          }
        }
        if (++processed >= CHUNK) {
          processed = 0;
          await nextTick(); // let input events through
        }
      }
    }

    return { query, count, results };
  }
}

/** App-wide singleton */
export const quranSearch = new QuranSearchService();
