/**
 * Audio Cache Service using IndexedDB
 * Caches concatenated surah audio to avoid re-downloading
 */

const DB_NAME = 'quran-audio-cache';
const DB_VERSION = 2;
const STORE_NAME = 'audio-blobs';

interface CachedAudio {
  key: string; // Format: "reciterFolder-surahNum" or "mp3quran-moshafId-surahNum"
  blobData: Blob;
  timestamps: number[]; // For EveryAyah: start times in seconds; Not used for MP3Quran
  cachedAt: number;
  reciterFolder: string;
  surahNum: number;
  audioType?: 'everyayah' | 'mp3quran'; // Type of cached audio
  timingData?: any[]; // For MP3Quran: array of AyahTiming objects
}

/**
 * Open IndexedDB connection
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        objectStore.createIndex('reciterFolder', 'reciterFolder', { unique: false });
        objectStore.createIndex('surahNum', 'surahNum', { unique: false });
        objectStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }
    };
  });
};

/**
 * Generate cache key
 */
const getCacheKey = (reciterFolder: string, surahNum: number): string => {
  return `${reciterFolder}-${surahNum}`;
};

/**
 * Store audio in cache
 */
export const cacheAudio = async (
  reciterFolder: string,
  surahNum: number,
  blobData: Blob,
  timestamps: number[]
): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const cachedAudio: CachedAudio = {
      key: getCacheKey(reciterFolder, surahNum),
      blobData,
      timestamps,
      cachedAt: Date.now(),
      reciterFolder,
      surahNum,
    };
    
    store.put(cachedAudio);
    
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    
    db.close();
  } catch (error) {
    console.error('Error caching audio:', error);
  }
};

/**
 * Retrieve audio from cache
 */
export const getCachedAudio = async (
  reciterFolder: string,
  surahNum: number
): Promise<{ blobData: Blob; timestamps: number[] } | null> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const key = getCacheKey(reciterFolder, surahNum);
    const request = store.get(key);
    
    const result = await new Promise<CachedAudio | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    db.close();
    
    if (result) {
      console.log(`Cache HIT for ${reciterFolder} surah ${surahNum}`);
      return {
        blobData: result.blobData,
        timestamps: result.timestamps,
      };
    }
    
    console.log(`Cache MISS for ${reciterFolder} surah ${surahNum}`);
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
 * Clear all cached audio for a specific reciter
 */
export const clearReciterCache = async (reciterFolder: string): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('reciterFolder');
    
    const request = index.openCursor(IDBKeyRange.only(reciterFolder));
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    
    db.close();
    console.log(`Cleared cache for reciter: ${reciterFolder}`);
  } catch (error) {
    console.error('Error clearing reciter cache:', error);
  }
};

/**
 * Clear entire audio cache
 */
export const clearAllCache = async (): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    store.clear();
    
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    
    db.close();
    console.log('Cleared all audio cache');
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
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const countRequest = store.count();
    const allRequest = store.getAll();
    
    const [count, all] = await Promise.all([
      new Promise<number>((resolve, reject) => {
        countRequest.onsuccess = () => resolve(countRequest.result);
        countRequest.onerror = () => reject(countRequest.error);
      }),
      new Promise<CachedAudio[]>((resolve, reject) => {
        allRequest.onsuccess = () => resolve(allRequest.result);
        allRequest.onerror = () => reject(allRequest.error);
      }),
    ]);
    
    const estimatedSize = all.reduce((sum, item) => sum + item.blobData.size, 0);
    const reciters = [...new Set(all.map(item => item.reciterFolder))];
    
    db.close();
    
    return {
      totalEntries: count,
      estimatedSize,
      reciters,
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
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const cachedAudio: CachedAudio = {
      key: `mp3quran-${moshafId}-${surahNum}`,
      blobData,
      timestamps: [], // Not used for MP3Quran
      cachedAt: Date.now(),
      reciterFolder: `mp3quran-${moshafId}`, // Store as identifier
      surahNum,
      audioType: 'mp3quran',
      timingData,
    };
    
    store.put(cachedAudio);
    
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    
    db.close();
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
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const key = `mp3quran-${moshafId}-${surahNum}`;
    const request = store.get(key);
    
    const result = await new Promise<CachedAudio | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    db.close();
    
    if (result && result.audioType === 'mp3quran') {
      console.log(`Cache HIT for MP3Quran moshaf ${moshafId} surah ${surahNum}`);
      return {
        blobData: result.blobData,
        timingData: result.timingData || [],
      };
    }
    
    console.log(`Cache MISS for MP3Quran moshaf ${moshafId} surah ${surahNum}`);
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
