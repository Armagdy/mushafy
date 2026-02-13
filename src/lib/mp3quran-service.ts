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
 * Fetch list of reciters from MP3Quran.net
 */
export async function getMp3QuranReciters(language: 'en' | 'ar' = 'en'): Promise<Mp3QuranReciter[]> {
  const cache = language === 'en' ? recitersCacheEn : recitersCacheAr;
  
  if (cache) {
    return cache;
  }

  try {
    const response = await fetch(
      `https://mp3quran.net/api/v3/reciters?language=${language}`
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

    return reciters;
  } catch (error) {
    console.error('Error fetching MP3Quran reciters:', error);
    throw error;
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
      `https://www.mp3quran.net/api/v3/ayat_timing?surah=${surahNumber}&read=${moshafId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch ayah timing: ${response.statusText}`);
    }

    const timings: AyahTiming[] = await response.json();
    timingCache.set(cacheKey, timings);

    return timings;
  } catch (error) {
    console.error('Error fetching ayah timing:', error);
    throw error;
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
