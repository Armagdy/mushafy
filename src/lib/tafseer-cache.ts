/**
 * Tafseer Cache Service using IndexedDB
 * Caches tafseer text for offline access
 */

const DB_NAME = 'quran-tafseer-cache';
const DB_VERSION = 1;
const STORE_NAME = 'tafseer-texts';

interface CachedTafseer {
  key: string; // Format: "tafseerId-surahNum-ayahNum"
  tafseer_id: number;
  tafseer_name: string;
  surah_number: number;
  ayah_number: number;
  text: string;
  cachedAt: number;
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
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        objectStore.createIndex('tafseer_id', 'tafseer_id', { unique: false });
        objectStore.createIndex('surah_number', 'surah_number', { unique: false });
        objectStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }
    };
  });
};

/**
 * Generate cache key
 */
const getCacheKey = (tafseerId: number, surahNum: number, ayahNum: number): string => {
  return `${tafseerId}-${surahNum}-${ayahNum}`;
};

/**
 * Store tafseer in cache
 */
export const cacheTafseer = async (
  tafseerId: number,
  tafseerName: string,
  surahNumber: number,
  ayahNumber: number,
  text: string
): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const cachedTafseer: CachedTafseer = {
      key: getCacheKey(tafseerId, surahNumber, ayahNumber),
      tafseer_id: tafseerId,
      tafseer_name: tafseerName,
      surah_number: surahNumber,
      ayah_number: ayahNumber,
      text,
      cachedAt: Date.now(),
    };
    
    store.put(cachedTafseer);
    
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    
    db.close();
  } catch (error) {
    console.error('Error caching tafseer:', error);
  }
};

/**
 * Retrieve tafseer from cache
 */
export const getCachedTafseer = async (
  tafseerId: number,
  surahNumber: number,
  ayahNumber: number
): Promise<{ tafseer_name: string; text: string } | null> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const key = getCacheKey(tafseerId, surahNumber, ayahNumber);
    const request = store.get(key);
    
    const result = await new Promise<CachedTafseer | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    db.close();
    
    if (result) {
      return {
        tafseer_name: result.tafseer_name,
        text: result.text,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving cached tafseer:', error);
    return null;
  }
};

/**
 * Get cache statistics
 */
export const getTafseerCacheStats = async (): Promise<{
  totalEntries: number;
  byTafseer: Record<number, number>;
}> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const allRequest = store.getAll();
    
    const all = await new Promise<CachedTafseer[]>((resolve, reject) => {
      allRequest.onsuccess = () => resolve(allRequest.result);
      allRequest.onerror = () => reject(allRequest.error);
    });
    
    const byTafseer: Record<number, number> = {};
    all.forEach(item => {
      byTafseer[item.tafseer_id] = (byTafseer[item.tafseer_id] || 0) + 1;
    });
    
    db.close();
    
    return {
      totalEntries: all.length,
      byTafseer,
    };
  } catch (error) {
    console.error('Error getting tafseer cache stats:', error);
    return {
      totalEntries: 0,
      byTafseer: {},
    };
  }
};

/**
 * Clear tafseer cache
 */
export const clearTafseerCache = async (): Promise<void> => {
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
    console.log('Cleared tafseer cache');
  } catch (error) {
    console.error('Error clearing tafseer cache:', error);
  }
};
