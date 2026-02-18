// MP3Quran.net API service for continuous surah audio with ayah timing

import { NativeStorage, isNativePlatform } from './native-storage';

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

// Native storage for persistent offline access
const recitersStorage = new NativeStorage('quran-reciters-storage');
let storageInitialized = false;

/**
 * Initialize storage (lazy initialization)
 */
async function initStorage(): Promise<void> {
  if (!storageInitialized) {
    await recitersStorage.init();
    storageInitialized = true;
    console.log(`✅ Reciters storage initialized (${isNativePlatform() ? 'Native' : 'IndexedDB'})`);
  }
}

/**
 * Save reciters to persistent storage
 */
async function saveRecitersToStorage(language: 'en' | 'ar', reciters: Mp3QuranReciter[]): Promise<void> {
  try {
    await initStorage();
    const key = `mp3quran-reciters-${language}`;
    const jsonString = JSON.stringify(reciters);
    await recitersStorage.setItem(key, jsonString, {
      language,
      cachedAt: Date.now(),
      platform: isNativePlatform() ? 'native' : 'web'
    });
    console.log(`✅ Saved ${language} reciters to storage (${reciters.length} reciters)`);
  } catch (error) {
    console.error('Failed to save reciters to storage:', error);
  }
}

/**
 * Load reciters from persistent storage
 */
async function loadRecitersFromStorage(language: 'en' | 'ar'): Promise<Mp3QuranReciter[] | null> {
  try {
    await initStorage();
    const key = `mp3quran-reciters-${language}`;
    const result = await recitersStorage.getItem(key);
    
    if (result) {
      const jsonString = typeof result.data === 'string' 
        ? result.data 
        : await (result.data as Blob).text();
      const reciters = JSON.parse(jsonString) as Mp3QuranReciter[];
      console.log(`✅ Loaded ${language} reciters from storage (${reciters.length} reciters, cached at ${new Date(result.timestamp).toLocaleString()})`);
      return reciters;
    }
  } catch (error) {
    console.error('Failed to load reciters from storage:', error);
  }
  return null;
}

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
 * Priority: Memory Cache → Native Storage → API → Local JSON File
 */
export async function getMp3QuranReciters(language: 'en' | 'ar' = 'en'): Promise<Mp3QuranReciter[]> {
  // 1. Check memory cache
  const cache = language === 'en' ? recitersCacheEn : recitersCacheAr;
  if (cache) {
    console.log(`✅ Loaded ${language} reciters from memory cache`);
    return cache;
  }

  // 2. Try loading from persistent storage (native/IndexedDB)
  try {
    const storedReciters = await loadRecitersFromStorage(language);
    if (storedReciters && storedReciters.length > 0) {
      // Update memory cache
      if (language === 'en') {
        recitersCacheEn = storedReciters;
      } else {
        recitersCacheAr = storedReciters;
      }
      return storedReciters;
    }
  } catch (error) {
    console.warn('Failed to load from storage, continuing to API:', error);
  }

  // 3. Try fetching from API (online - gets latest data)
  try {
    const response = await fetch(
      `https://mp3quran.net/api/v3/reciters?language=${language}`,
      { signal: AbortSignal.timeout(5000) } // 5 second timeout
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch reciters: ${response.statusText}`);
    }

    const data = await response.json();
    const reciters = data.reciters || data;

    // Update memory cache
    if (language === 'en') {
      recitersCacheEn = reciters;
    } else {
      recitersCacheAr = reciters;
    }

    // Save to persistent storage for offline access
    await saveRecitersToStorage(language, reciters);

    console.log(`✅ Loaded ${language} reciters from API (online)`);
    return reciters;
  } catch (error) {
    console.warn('Failed to fetch from API, trying local file:', error);
  }

  // 4. Fallback to local JSON file (offline)
  try {
    const reciters = await loadRecitersFromLocalFile();
    
    // Update memory cache (note: local file is in English only)
    if (language === 'en') {
      recitersCacheEn = reciters;
    } else {
      recitersCacheAr = reciters;
    }
    
    // Save to persistent storage for future offline access
    await saveRecitersToStorage(language, reciters);
    
    console.log(`✅ Loaded ${language} reciters from local file (offline)`);
    return reciters;
  } catch (localError) {
    console.error('Failed to load reciters from local file:', localError);
    throw new Error('Unable to load reciters from API, storage, or local file. Please check your internet connection.');
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
 * Check and fetch ayah timing with better error handling
 * Returns object with success status and timing data or error
 */
export async function checkAyahTiming(
  surahNumber: number,
  moshafId: number
): Promise<{
  success: boolean;
  timings: AyahTiming[];
  error?: 'network' | 'not-found' | 'unknown';
  message?: string;
}> {
  const cacheKey = `${surahNumber}-${moshafId}`;
  
  // Check in-memory cache first
  if (timingCache.has(cacheKey)) {
    const timings = timingCache.get(cacheKey)!;
    return { success: true, timings };
  }

  try {
    const response = await fetch(
      `https://www.mp3quran.net/api/v3/ayat_timing?surah=${surahNumber}&read=${moshafId}`,
      { signal: AbortSignal.timeout(10000) } // 10 second timeout
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          timings: [],
          error: 'not-found',
          message: 'Ayah timing not available for this recitation'
        };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const timings: AyahTiming[] = await response.json();
    
    // Validate timing data
    if (!Array.isArray(timings) || timings.length === 0) {
      return {
        success: false,
        timings: [],
        error: 'not-found',
        message: 'No timing data found for this recitation'
      };
    }
    
    // Cache the result
    timingCache.set(cacheKey, timings);

    return { success: true, timings };
  } catch (error: any) {
    // Network errors (timeout, no connection, etc.)
    if (error.name === 'AbortError' || error.message?.includes('fetch') || error.message?.includes('network')) {
      return {
        success: false,
        timings: [],
        error: 'network',
        message: 'Network error: Unable to fetch timing data'
      };
    }
    
    // Unknown errors
    return {
      success: false,
      timings: [],
      error: 'unknown',
      message: error.message || 'Unknown error occurred'
    };
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
