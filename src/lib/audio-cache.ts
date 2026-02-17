/**
 * Audio Cache Service using Hybrid Storage
 * - Native filesystem on Android/iOS (unlimited storage)
 * - IndexedDB fallback on web browsers
 * Caches concatenated surah audio to avoid re-downloading
 */

import { NativeStorage, isNativePlatform, getPlatform } from './native-storage';

const DB_NAME = 'quran-audio-cache';
const DB_VERSION = 2;
const STORE_NAME = 'audio-blobs';

// Hybrid storage instance
const audioStorage = new NativeStorage('quran-audio-cache');

// Initialize storage on module load
audioStorage.init().catch(console.error);

// Legacy interface for backward compatibility
interface CachedAudio {
  key: string;
  blobData: Blob;
  timestamps: number[];
  cachedAt: number;
  reciterFolder: string;
  surahNum: number;
  audioType?: 'everyayah' | 'mp3quran';
  timingData?: any[];
}

// Legacy IndexedDB functions kept for potential migration needs
// These are no longer used but kept for reference

// Legacy IndexedDB functions kept for potential migration needs
// These are no longer used but kept for reference

/**
 * Generate cache key
 */
const getCacheKey = (reciterFolder: string, surahNum: number): string => {
  return `${reciterFolder}-${surahNum}`;
};

/**
 * Store audio in cache
 * Uses native filesystem on Android/iOS, IndexedDB on web
 */
export const cacheAudio = async (
  reciterFolder: string,
  surahNum: number,
  blobData: Blob,
  timestamps: number[]
): Promise<void> => {
  try {
    await audioStorage.init();
    
    const key = getCacheKey(reciterFolder, surahNum);
    const metadata = {
      reciterFolder,
      surahNum,
      timestamps,
      audioType: 'everyayah',
      mimeType: blobData.type || 'audio/mpeg', // Support both audio/mpeg (MP3) and audio/wav
    };
    
    await audioStorage.setItem(key, blobData, metadata);
    
    console.log(`✅ [${getPlatform()}] Cached audio: ${key} (${blobData.type})`);
  } catch (error) {
    console.error('Error caching audio:', error);
  }
};

/**
 * Retrieve audio from cache
 * Uses native filesystem on Android/iOS, IndexedDB on web
 */
export const getCachedAudio = async (
  reciterFolder: string,
  surahNum: number
): Promise<{ blobData: Blob; timestamps: number[] } | null> => {
  try {
    await audioStorage.init();
    
    const key = getCacheKey(reciterFolder, surahNum);
    const result = await audioStorage.getItem(key);
    
    if (result && result.data instanceof Blob) {
      console.log(`✅ [${getPlatform()}] Cache HIT for ${reciterFolder} surah ${surahNum}`);
      return {
        blobData: result.data,
        timestamps: result.metadata?.timestamps || [],
      };
    }
    
    console.log(`❌ [${getPlatform()}] Cache MISS for ${reciterFolder} surah ${surahNum}`);
    return null;
  } catch (error) {
    console.error('Error retrieving cached audio:', error);
    return null;
  }
};

/**
 * Check if audio is cached
 */
export const isAudioCached = async (
  reciterFolder: string,
  surahNum: number
): Promise<boolean> => {
  const cached = await getCachedAudio(reciterFolder, surahNum);
  return cached !== null;
};

/**
 * ============================================================================
 * INDIVIDUAL AYAH CACHING (For EveryAyah reciters)
 * ============================================================================
 * Cache individual ayahs instead of concatenated blobs to save storage space.
 * The concatenated blob is created on-the-fly during playback and kept in
 * memory until user stops playback.
 */

/**
 * Generate cache key for individual ayah
 */
const getAyahCacheKey = (reciterFolder: string, surahNum: number, ayahNum: number): string => {
  return `ayah-${reciterFolder}-${surahNum}-${ayahNum}`;
};

/**
 * Cache individual ayah MP3
 */
export const cacheIndividualAyah = async (
  reciterFolder: string,
  surahNum: number,
  ayahNum: number,
  blobData: Blob
): Promise<void> => {
  try {
    await audioStorage.init();
    
    const key = getAyahCacheKey(reciterFolder, surahNum, ayahNum);
    const metadata = {
      reciterFolder,
      surahNum,
      ayahNum,
      audioType: 'everyayah-individual',
      mimeType: blobData.type || 'audio/mpeg',
    };
    
    await audioStorage.setItem(key, blobData, metadata);
    
    console.log(`✅ [${getPlatform()}] Cached individual ayah: ${key}`);
  } catch (error) {
    console.error('Error caching individual ayah:', error);
  }
};

/**
 * Retrieve individual ayah from cache
 */
export const getCachedIndividualAyah = async (
  reciterFolder: string,
  surahNum: number,
  ayahNum: number
): Promise<Blob | null> => {
  try {
    await audioStorage.init();
    
    const key = getAyahCacheKey(reciterFolder, surahNum, ayahNum);
    const result = await audioStorage.getItem(key);
    
    if (result && result.data instanceof Blob) {
      return result.data;
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving cached individual ayah:', error);
    return null;
  }
};

/**
 * Get all cached ayahs for a surah
 * Returns a map of ayah number to Blob
 */
export const getAllCachedAyahsForSurah = async (
  reciterFolder: string,
  surahNum: number,
  totalAyahs: number
): Promise<Map<number, Blob>> => {
  const cachedAyahs = new Map<number, Blob>();
  
  try {
    await audioStorage.init();
    
    // Check each ayah
    for (let ayahNum = 1; ayahNum <= totalAyahs; ayahNum++) {
      const blob = await getCachedIndividualAyah(reciterFolder, surahNum, ayahNum);
      if (blob) {
        cachedAyahs.set(ayahNum, blob);
      }
    }
    
    console.log(`📊 [${getPlatform()}] Found ${cachedAyahs.size}/${totalAyahs} cached ayahs for ${reciterFolder} surah ${surahNum}`);
  } catch (error) {
    console.error('Error getting cached ayahs for surah:', error);
  }
  
  return cachedAyahs;
};

/**
 * Check if all ayahs for a surah are cached
 */
export const areAllAyahsCached = async (
  reciterFolder: string,
  surahNum: number,
  totalAyahs: number
): Promise<boolean> => {
  const cachedAyahs = await getAllCachedAyahsForSurah(reciterFolder, surahNum, totalAyahs);
  return cachedAyahs.size === totalAyahs;
};

/**
 * Clear all cached audio for a specific reciter
 */
export const clearReciterCache = async (reciterFolder: string): Promise<void> => {
  try {
    await audioStorage.init();
    
    const keys = await audioStorage.keys();
    const reciterKeys = keys.filter(key => key.startsWith(reciterFolder));
    
    for (const key of reciterKeys) {
      await audioStorage.removeItem(key);
    }
    
    console.log(`✅ [${getPlatform()}] Cleared cache for reciter: ${reciterFolder}`);
  } catch (error) {
    console.error('Error clearing reciter cache:', error);
  }
};

/**
 * Clear entire audio cache
 */
export const clearAllCache = async (): Promise<void> => {
  try {
    await audioStorage.init();
    await audioStorage.clear();
    
    console.log(`✅ [${getPlatform()}] Cleared all audio cache`);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = async (): Promise<{
  totalEntries: number;
  estimatedSize: number;
  reciters: string[];
}> => {
  try {
    await audioStorage.init();
    
    const keys = await audioStorage.keys();
    let estimatedSize = 0;
    const recitersSet = new Set<string>();
    
    // Get size and reciter info from each cached item
    for (const key of keys) {
      const item = await audioStorage.getItem(key);
      if (item && item.data instanceof Blob) {
        estimatedSize += item.data.size;
        if (item.metadata?.reciterFolder) {
          recitersSet.add(item.metadata.reciterFolder);
        }
      }
    }
    
    const storageInfo = await audioStorage.getStorageInfo();
    
    console.log(`📊 [${getPlatform()}] Cache stats: ${keys.length} entries, ~${(estimatedSize / 1024 / 1024).toFixed(2)}MB`);
    
    return {
      totalEntries: keys.length,
      estimatedSize,
      reciters: Array.from(recitersSet),
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      totalEntries: 0,
      estimatedSize: 0,
      reciters: [],
    };
  }
};

/**
 * Store MP3Quran audio in cache with timing data
 * Uses moshaf ID as the identifier instead of reciter folder
 */
export const cacheMp3QuranAudio = async (
  moshafId: number,
  surahNum: number,
  blobData: Blob,
  timingData: any[] // AyahTiming array
): Promise<void> => {
  try {
    await audioStorage.init();
    
    const key = `mp3quran-${moshafId}-${surahNum}`;
    const metadata = {
      reciterFolder: `mp3quran-${moshafId}`,
      surahNum,
      audioType: 'mp3quran',
      timingData,
      mimeType: blobData.type || 'audio/mpeg',
    };
    
    await audioStorage.setItem(key, blobData, metadata);
    
    console.log(`✅ [${getPlatform()}] Cached MP3Quran audio: ${key}`);
  } catch (error) {
    console.error('Error caching MP3Quran audio:', error);
  }
};

/**
 * Retrieve MP3Quran audio from cache
 */
export const getCachedMp3QuranAudio = async (
  moshafId: number,
  surahNum: number
): Promise<{ blobData: Blob; timingData: any[] } | null> => {
  try {
    await audioStorage.init();
    
    const key = `mp3quran-${moshafId}-${surahNum}`;
    const result = await audioStorage.getItem(key);
    
    if (result && result.data instanceof Blob && result.metadata?.audioType === 'mp3quran') {
      console.log(`✅ [${getPlatform()}] Cache HIT for MP3Quran moshaf ${moshafId} surah ${surahNum}`);
      return {
        blobData: result.data,
        timingData: result.metadata?.timingData || [],
      };
    }
    
    console.log(`❌ [${getPlatform()}] Cache MISS for MP3Quran moshaf ${moshafId} surah ${surahNum}`);
    return null;
  } catch (error) {
    console.error('Error retrieving cached MP3Quran audio:', error);
    return null;
  }
};

/**
 * Check if MP3Quran audio is cached
 */
export const isMp3QuranAudioCached = async (
  moshafId: number,
  surahNum: number
): Promise<boolean> => {
  const cached = await getCachedMp3QuranAudio(moshafId, surahNum);
  return cached !== null;
};
