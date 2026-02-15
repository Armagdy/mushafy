// MP3Quran.net API service for continuous surah audio with ayah timing

export interface Mp3QuranReciter {
  id: number;
  name: string;
  letter: string;
  moshaf: Mp3QuranMoshaf[];
}

export interface Mp3QuranMoshaf {
  id: number;
  name: string;
  server: string;
  surah_total: number;
  moshaf_type: number;
  surah_list: string;
}

export interface AyahTiming {
  ayah: number;
  start_time: number; // milliseconds
  end_time: number;   // milliseconds
  polygon?: string;
  x?: string;
  y?: string;
  page?: string;
}

// Cache for reciters and timing data
let recitersCacheEn: Mp3QuranReciter[] | null = null;
let recitersCacheAr: Mp3QuranReciter[] | null = null;
const timingCache = new Map<string, AyahTiming[]>();

/**
 * Load reciters from local JSON file (offline fallback)
 */
async function loadRecitersFromLocalFile(): Promise<Mp3QuranReciter[]> {
  try {
    const response = await fetch('/mp3quran_reciters.json');
    if (!response.ok) {
      throw new Error('Failed to load local reciters file');
    }
    const data = await response.json();
    return data.reciters || [];
  } catch (error) {
    console.error('Error loading local reciters file:', error);
    throw error;
  }
}

/**
 * Fetch list of reciters from MP3Quran.net API (online) or local file (offline)
 */
export async function getMp3QuranReciters(language: 'en' | 'ar' = 'en'): Promise<Mp3QuranReciter[]> {
  const cache = language === 'en' ? recitersCacheEn : recitersCacheAr;
  
  if (cache) {
    return cache;
  }

  try {
    // Try fetching from API first (online - gets latest data)
    const response = await fetch(
      `https://mp3quran.net/api/v3/reciters?language=${language}`,
      { signal: AbortSignal.timeout(5000) } // 5 second timeout
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch reciters: ${response.statusText}`);
    }

    const data = await response.json();
    const reciters = data.reciters || data;

    if (language === 'en') {
      recitersCacheEn = reciters;
    } else {
      recitersCacheAr = reciters;
    }

    console.log('✅ Loaded reciters from API (online)');
    return reciters;
  } catch (error) {
    // API failed (offline or network error) - fallback to local file
    console.warn('Failed to fetch from API, loading from local file:', error);
    
    try {
      const reciters = await loadRecitersFromLocalFile();
      
      // Cache based on language (note: local file is in English only)
      if (language === 'en') {
        recitersCacheEn = reciters;
      } else {
        recitersCacheAr = reciters;
      }
      
      console.log('✅ Loaded reciters from local file (offline)');
      return reciters;
    } catch (localError) {
      console.error('Failed to load reciters from local file:', localError);
      throw new Error('Unable to load reciters from API or local file');
    }
  }
}

/**
 * Fetch ayah timing data for a specific surah and moshaf
 */
export async function getAyahTiming(
  surahNumber: number,
  moshafId: number
): Promise<AyahTiming[]> {
  const cacheKey = `${surahNumber}-${moshafId}`;
  
  if (timingCache.has(cacheKey)) {
    return timingCache.get(cacheKey)!;
  }

  try {
    const response = await fetch(
      `https://www.mp3quran.net/api/v3/ayat_timing?surah=${surahNumber}&read=${moshafId}`,
      { signal: AbortSignal.timeout(5000) } // 5 second timeout
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch ayah timing: ${response.statusText}`);
    }

    const timings: AyahTiming[] = await response.json();
    timingCache.set(cacheKey, timings);

    return timings;
  } catch (error) {
    console.warn('Error fetching ayah timing (will play without precise tracking):', error);
    // Return empty array instead of throwing - allows playback without timing
    return [];
  }
}

/**
 * Build audio URL for complete surah
 */
export function getSurahAudioUrl(server: string, surahNumber: number): string {
  const surahPadded = surahNumber.toString().padStart(3, '0');
  return `${server}${surahPadded}.mp3`;
}

/**
 * Find current ayah based on audio current time
 */
export function getCurrentAyahFromTime(
  timings: AyahTiming[],
  currentTime: number // in seconds
): number | null {
  const currentTimeMs = currentTime * 1000;

  // Find the ayah whose time range includes current time
  for (const timing of timings) {
    if (currentTimeMs >= timing.start_time && currentTimeMs < timing.end_time) {
      return timing.ayah;
    }
  }

  // If we're at the very end, return the last ayah
  if (timings.length > 0) {
    const lastTiming = timings[timings.length - 1];
    if (currentTimeMs >= lastTiming.start_time) {
      return lastTiming.ayah;
    }
  }

  return null;
}

/**
 * Seek to specific ayah in continuous audio
 */
export function seekToAyah(
  audio: HTMLAudioElement,
  timings: AyahTiming[],
  ayahNumber: number
): boolean {
  const timing = timings.find(t => t.ayah === ayahNumber);
  
  if (timing) {
    // Convert milliseconds to seconds
    audio.currentTime = timing.start_time / 1000;
    return true;
  }

  return false;
}

/**
 * Clear caches (useful when switching language)
 */
export function clearCaches(): void {
  recitersCacheEn = null;
  recitersCacheAr = null;
  timingCache.clear();
}
