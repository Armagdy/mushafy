import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { MushafType } from './MushafContext';
import { cacheAsset, isAssetCached } from '@/lib/asset-cache';
import { getPageImageFilename } from '@/lib/quran-mapping';
import { getSurahAudioUrl } from '@/lib/mp3quran-service';
import { IMAGES_BASE_URL } from '@/config/assets';
import { cacheFont, isFontCached } from '@/lib/font-cache';
import { fetchAndCacheTafseer, isTafseerCached } from '@/lib/tafseer-cache';
import { surahs } from '@/data/surahs';
import type { Mp3QuranMoshaf } from '@/lib/mp3quran-service';

export interface DownloadJob {
  id: string;
  type: 'pages' | 'everyayah' | 'mp3quran' | 'tafseer';
  status: 'idle' | 'downloading' | 'completed' | 'cancelled' | 'error';
  progress: {
    current: number;
    total: number;
  };
  params: {
    // Pages params
    mushafType?: MushafType;
    fromPage?: number;
    toPage?: number;
    // EveryAyah params
    reciterFolder?: string;
    reciterName?: string;
    reciterBaseUrl?: string;
    surahNum?: number;
    fromAyah?: number;
    toAyah?: number;
    // MP3Quran params
    moshaf?: Mp3QuranMoshaf;
    fromSurah?: number;
    toSurah?: number;
    // Tafseer params
    tafseerId?: number;
    tafseerName?: string;
  };
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

interface DownloadContextType {
  activeDownload: DownloadJob | null;
  startDownload: (job: Omit<DownloadJob, 'id' | 'status' | 'progress' | 'startedAt'>) => Promise<void>;
  cancelDownload: () => void;
  clearDownload: () => void;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

// Helper function for parallel downloads with concurrency control
async function downloadInParallel<T>(
  items: T[],
  downloadFn: (item: T, signal: AbortSignal) => Promise<boolean>,
  signal: AbortSignal,
  onProgress: (current: number, total: number) => void,
  concurrency: number = 10 // Download 10 files at once
): Promise<void> {
  const total = items.length;
  let completed = 0;
  let index = 0;
  let lastProgressUpdate = 0;
  
  // Create worker function
  const worker = async (): Promise<void> => {
    while (index < items.length) {
      if (signal.aborted) break;
      
      const currentIndex = index++;
      const item = items[currentIndex];
      
      try {
        const wasDownloaded = await downloadFn(item, signal);
        if (wasDownloaded || !signal.aborted) {
          completed++;
          
          // Batch progress updates (update every 5 files or at end)
          if (completed - lastProgressUpdate >= 5 || completed === total) {
            lastProgressUpdate = completed;
            onProgress(completed, total);
          }
        }
      } catch (error) {
        if (signal.aborted) break;
        throw error;
      }
    }
  };
  
  // Start workers
  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker());
  
  await Promise.all(workers);
  
  // Ensure final progress update
  if (lastProgressUpdate !== completed) {
    onProgress(completed, total);
  }
}

export function DownloadProvider({ children }: { children: ReactNode }) {
  const [activeDownload, setActiveDownload] = useState<DownloadJob | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startDownload = async (jobParams: Omit<DownloadJob, 'id' | 'status' | 'progress' | 'startedAt'>) => {
    // Cancel any existing download
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new job
    const job: DownloadJob = {
      ...jobParams,
      id: `download-${Date.now()}`,
      status: 'downloading',
      progress: { current: 0, total: 0 },
      startedAt: new Date(),
    };

    setActiveDownload(job);

    // Create abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      if (job.type === 'pages') {
        await downloadPages(job, signal, (progress) => {
          setActiveDownload(prev => prev ? { ...prev, progress } : null);
        });
      } else if (job.type === 'everyayah') {
        await downloadEveryAyah(job, signal, (progress) => {
          setActiveDownload(prev => prev ? { ...prev, progress } : null);
        });
      } else if (job.type === 'mp3quran') {
        await downloadMp3Quran(job, signal, (progress) => {
          setActiveDownload(prev => prev ? { ...prev, progress } : null);
        });
      } else if (job.type === 'tafseer') {
        await downloadTafseer(job, signal, (progress) => {
          setActiveDownload(prev => prev ? { ...prev, progress } : null);
        });
      }

      // Mark as completed if not cancelled
      if (!signal.aborted) {
        setActiveDownload(prev => prev ? {
          ...prev,
          status: 'completed',
          completedAt: new Date(),
        } : null);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setActiveDownload(prev => prev ? { ...prev, status: 'cancelled' } : null);
      } else {
        console.error('Download error:', error);
        setActiveDownload(prev => prev ? {
          ...prev,
          status: 'error',
          error: error.message || 'Download failed',
        } : null);
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const cancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setActiveDownload(prev => prev ? { ...prev, status: 'cancelled' } : null);
  };

  const clearDownload = () => {
    setActiveDownload(null);
  };

  return (
    <DownloadContext.Provider value={{ activeDownload, startDownload, cancelDownload, clearDownload }}>
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownload() {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error('useDownload must be used within DownloadProvider');
  }
  return context;
}

// Download implementations
async function downloadPages(
  job: DownloadJob,
  signal: AbortSignal,
  onProgress: (progress: { current: number; total: number }) => void
) {
  const { mushafType, fromPage, toPage } = job.params;
  if (!mushafType || fromPage === undefined || toPage === undefined) {
    throw new Error('Invalid page download parameters');
  }

  // For tarteel/tajweed, download fonts instead of images
  if (mushafType === 'tarteel' || mushafType === 'tajweed') {
    const pageCount = toPage - fromPage + 1;
    const pages = Array.from({ length: pageCount }, (_, i) => fromPage + i);
    
    onProgress({ current: 0, total: pageCount });
    
    // Check which fonts are already cached
    console.log(`[Download] Checking ${pages.length} ${mushafType} fonts for existing cache...`);
    const cacheChecks = await Promise.all(
      pages.map(async (page) => {
        const cached = await isFontCached(page, mushafType);
        return { page, cached };
      })
    );
    
    const uncachedFonts = cacheChecks.filter(f => !f.cached);
    const cachedCount = pages.length - uncachedFonts.length;
    
    if (cachedCount > 0) {
      console.log(`[Download] ✓ ${cachedCount} fonts already cached, downloading ${uncachedFonts.length} fonts`);
    }

    // Download only uncached fonts in parallel (10 at a time - fonts are small)
    await downloadInParallel(
      uncachedFonts,
      async (item, sig) => {
        await cacheFont(item.page, mushafType, sig);
        return true;
      },
      signal,
      (current, totalCount) => onProgress({ current: current + cachedCount, total: pageCount }),
      10
    );
    return;
  }

  // For image-based mushafs (mwdoa, tashel, madinah)
  const total = toPage - fromPage + 1;
  onProgress({ current: 0, total });

  const folder = mushafType === 'mwdoa'
    ? 'mushuf_mwdoa_images'
    : mushafType === 'tashel'
    ? 'mushaf_tashel_pages'
    : 'mushaf_madinah_images';
  const mushafPath = `${IMAGES_BASE_URL}/${folder}`;
  const category = `mushaf-${mushafType}`;

  // Create array of page numbers to download
  const pages = Array.from({ length: total }, (_, i) => fromPage + i);
  
  // Pre-filter: Check which pages are already cached (in parallel)
  console.log(`[Download] Checking ${pages.length} pages for existing cache...`);
  const cacheChecks = await Promise.all(
    pages.map(async (page) => {
      const url = `${mushafPath}/${getPageImageFilename(page)}`;
      const cached = await isAssetCached(url);
      return { page, url, cached };
    })
  );
  
  const uncachedPages = cacheChecks.filter(p => !p.cached);
  const cachedCount = pages.length - uncachedPages.length;
  
  if (cachedCount > 0) {
    console.log(`[Download] ✓ ${cachedCount} pages already cached, downloading ${uncachedPages.length} pages`);
  }

  // Download only uncached pages in parallel (10 at a time for max speed)
  await downloadInParallel(
    uncachedPages,
    async (item, sig) => {
      await cacheAsset(item.url, category, sig);
      return true; // Downloaded
    },
    signal,
    (current, totalCount) => onProgress({ current: current + cachedCount, total: total }),
    10 // 10 concurrent downloads
  );
}

async function downloadEveryAyah(
  job: DownloadJob,
  signal: AbortSignal,
  onProgress: (progress: { current: number; total: number }) => void
) {
  const { reciterFolder, reciterBaseUrl, surahNum, fromAyah, toAyah } = job.params;
  if (!reciterFolder || !reciterBaseUrl || surahNum === undefined || fromAyah === undefined || toAyah === undefined) {
    throw new Error('Invalid EveryAyah download parameters');
  }

  const total = toAyah - fromAyah + 1;
  onProgress({ current: 0, total });

  const category = `audio-everyayah-${reciterFolder}`;
  const surahStr = surahNum.toString().padStart(3, '0');

  // Create array of ayah numbers to download
  const ayahs = Array.from({ length: total }, (_, i) => fromAyah + i);
  
  // Pre-filter: Check which ayahs are already cached (in parallel)
  console.log(`[Download] Checking ${ayahs.length} ayahs for existing cache...`);
  const cacheChecks = await Promise.all(
    ayahs.map(async (ayah) => {
      const ayahStr = ayah.toString().padStart(3, '0');
      const url = `${reciterBaseUrl}/${surahStr}${ayahStr}.mp3`;
      const cached = await isAssetCached(url);
      return { ayah, url, cached };
    })
  );
  
  const uncachedAyahs = cacheChecks.filter(a => !a.cached);
  const cachedCount = ayahs.length - uncachedAyahs.length;
  
  if (cachedCount > 0) {
    console.log(`[Download] ✓ ${cachedCount} ayahs already cached, downloading ${uncachedAyahs.length} ayahs`);
  }

  // Download only uncached ayahs in parallel (8 at a time for audio)
  await downloadInParallel(
    uncachedAyahs,
    async (item, sig) => {
      await cacheAsset(item.url, category, sig);
      return true; // Downloaded
    },
    signal,
    (current, totalCount) => onProgress({ current: current + cachedCount, total: total }),
    8 // 8 concurrent downloads
  );
}

async function downloadMp3Quran(
  job: DownloadJob,
  signal: AbortSignal,
  onProgress: (progress: { current: number; total: number }) => void
) {
  const { moshaf, fromSurah, toSurah } = job.params;
  if (!moshaf || fromSurah === undefined || toSurah === undefined) {
    throw new Error('Invalid MP3Quran download parameters');
  }

  const total = toSurah - fromSurah + 1;
  onProgress({ current: 0, total });

  const category = `audio-mp3quran-${moshaf.id}`;

  // Create array of surah numbers to download
  const surahs = Array.from({ length: total }, (_, i) => fromSurah + i);
  
  // Pre-filter: Check which surahs are already cached (in parallel)
  console.log(`[Download] Checking ${surahs.length} surahs for existing cache...`);
  const cacheChecks = await Promise.all(
    surahs.map(async (surahNum) => {
      const url = getSurahAudioUrl(moshaf.server, surahNum);
      const cached = await isAssetCached(url);
      return { surahNum, url, cached };
    })
  );
  
  const uncachedSurahs = cacheChecks.filter(s => !s.cached);
  const cachedCount = surahs.length - uncachedSurahs.length;
  
  if (cachedCount > 0) {
    console.log(`[Download] ✓ ${cachedCount} surahs already cached, downloading ${uncachedSurahs.length} surahs`);
  }

  // Download only uncached surahs in parallel (5 at a time - larger files but still fast)
  await downloadInParallel(
    uncachedSurahs,
    async (item, sig) => {
      await cacheAsset(item.url, category, sig);
      return true; // Downloaded
    },
    signal,
    (current, totalCount) => onProgress({ current: current + cachedCount, total: total }),
    5 // 5 concurrent downloads (increased from 3)
  );
}

async function downloadTafseer(
  job: DownloadJob,
  signal: AbortSignal,
  onProgress: (progress: { current: number; total: number }) => void
) {
  const { tafseerId, tafseerName, fromSurah, toSurah } = job.params;
  if (!tafseerId || !tafseerName || fromSurah === undefined || toSurah === undefined) {
    throw new Error('Invalid Tafseer download parameters');
  }

  // Build list of all ayahs to download
  interface AyahToDownload {
    surahNum: number;
    ayahNum: number;
  }
  
  const ayahsToDownload: AyahToDownload[] = [];
  for (let surahNum = fromSurah; surahNum <= toSurah; surahNum++) {
    const surah = surahs.find(s => s.id === surahNum);
    if (surah) {
      for (let ayahNum = 1; ayahNum <= surah.numberOfAyahs; ayahNum++) {
        ayahsToDownload.push({ surahNum, ayahNum });
      }
    }
  }

  const total = ayahsToDownload.length;
  onProgress({ current: 0, total });

  console.log(`[Download] Starting tafseer download for ${total} ayahs (surahs ${fromSurah}-${toSurah})`);

  // Pre-filter: Check which ayahs are already cached (in parallel batches)
  console.log(`[Download] Checking ${total} ayahs for existing tafseer cache...`);
  const cacheChecks = await Promise.all(
    ayahsToDownload.map(async (ayah) => {
      const cached = await isTafseerCached(tafseerId, ayah.surahNum, ayah.ayahNum);
      return { ...ayah, cached };
    })
  );

  const uncachedAyahs = cacheChecks.filter(a => !a.cached);
  const cachedCount = total - uncachedAyahs.length;

  if (cachedCount > 0) {
    console.log(`[Download] ✓ ${cachedCount} ayahs already cached, downloading ${uncachedAyahs.length} tafseer entries`);
  }

  // Download only uncached tafseer in parallel (8 at a time - API rate limiting consideration)
  await downloadInParallel(
    uncachedAyahs,
    async (item, sig) => {
      await fetchAndCacheTafseer(tafseerId, tafseerName, item.surahNum, item.ayahNum, sig);
      return true;
    },
    signal,
    (current, totalCount) => onProgress({ current: current + cachedCount, total: total }),
    8 // 8 concurrent downloads
  );
}

