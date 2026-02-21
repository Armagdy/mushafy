import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { MushafType } from './MushafContext';
import { cacheAsset } from '@/lib/asset-cache';
import { getPageImageFilename } from '@/lib/quran-mapping';
import { getSurahAudioUrl } from '@/lib/mp3quran-service';
import { ASSETS_BASE_URL } from '@/config/assets';
import type { Mp3QuranMoshaf } from '@/lib/mp3quran-service';

export interface DownloadJob {
  id: string;
  type: 'pages' | 'everyayah' | 'mp3quran';
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
  downloadFn: (item: T, signal: AbortSignal) => Promise<void>,
  signal: AbortSignal,
  onProgress: (current: number, total: number) => void,
  concurrency: number = 5 // Download 5 files at once
): Promise<void> {
  const total = items.length;
  let completed = 0;
  let index = 0;
  
  // Create worker function
  const worker = async (): Promise<void> => {
    while (index < items.length) {
      if (signal.aborted) break;
      
      const currentIndex = index++;
      const item = items[currentIndex];
      
      try {
        await downloadFn(item, signal);
        completed++;
        onProgress(completed, total);
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

  const total = toPage - fromPage + 1;
  onProgress({ current: 0, total });

  const folder = mushafType === 'mwdoa'
    ? 'mushuf_mwdoa_images'
    : mushafType === 'tashel'
    ? 'mushaf_tashel_pages'
    : 'mushaf_madinah_images';
  const mushafPath = `${ASSETS_BASE_URL}/${folder}`;
  const category = `mushaf-${mushafType}`;

  // Create array of page numbers to download
  const pages = Array.from({ length: total }, (_, i) => fromPage + i);

  // Download pages in parallel (5 at a time)
  await downloadInParallel(
    pages,
    async (page, sig) => {
      const url = `${mushafPath}/${getPageImageFilename(page)}`;
      await cacheAsset(url, category, sig);
    },
    signal,
    (current, totalCount) => onProgress({ current, total: totalCount }),
    5 // 5 concurrent downloads
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

  // Download ayahs in parallel (5 at a time)
  await downloadInParallel(
    ayahs,
    async (ayah, sig) => {
      const ayahStr = ayah.toString().padStart(3, '0');
      const url = `${reciterBaseUrl}/${surahStr}${ayahStr}.mp3`;
      await cacheAsset(url, category, sig);
    },
    signal,
    (current, totalCount) => onProgress({ current, total: totalCount }),
    5 // 5 concurrent downloads
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

  // Download surahs in parallel (3 at a time - larger files)
  await downloadInParallel(
    surahs,
    async (surahNum, sig) => {
      const url = getSurahAudioUrl(moshaf.server, surahNum);
      await cacheAsset(url, category, sig);
    },
    signal,
    (current, totalCount) => onProgress({ current, total: totalCount }),
    3 // 3 concurrent downloads (audio files are larger)
  );
}
