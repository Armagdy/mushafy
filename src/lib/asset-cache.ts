/**
 * Asset Cache Service using IndexedDB
 * Caches mushaf pages and other assets for offline PWA use
 */

const DB_NAME = 'quran-asset-cache';
const DB_VERSION = 1;
const STORE_NAME = 'assets';

interface CachedAsset {
  url: string;
  blobData: Blob;
  mimeType: string;
  cachedAt: number;
  category: string; // 'mushaf-mwdoa', 'mushaf-tashel', 'mushaf-madinah', 'audio-everyayah', 'audio-mp3quran'
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
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        objectStore.createIndex('category', 'category', { unique: false });
        objectStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }
    };
  });
};

/**
 * Cache an asset from URL
 */
export const cacheAsset = async (
  url: string,
  category: string
): Promise<boolean> => {
  try {
    // Fetch the asset
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    
    const blobData = await response.blob();
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Store in IndexedDB
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const cachedAsset: CachedAsset = {
      url,
      blobData,
      mimeType,
      cachedAt: Date.now(),
      category,
    };
    
    store.put(cachedAsset);
    
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    
    db.close();
    return true;
  } catch (error) {
    console.error('Error caching asset:', error);
    return false;
  }
};

/**
 * Get cached asset
 */
export const getCachedAsset = async (url: string): Promise<Blob | null> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.get(url);
    
    const result = await new Promise<CachedAsset | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    db.close();
    
    return result ? result.blobData : null;
  } catch (error) {
    console.error('Error retrieving cached asset:', error);
    return null;
  }
};

/**
 * Check if asset is cached
 */
export const isAssetCached = async (url: string): Promise<boolean> => {
  const cached = await getCachedAsset(url);
  return cached !== null;
};

/**
 * Clear all cached assets by category
 */
export const clearCategoryCache = async (category: string): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('category');
    
    const request = index.openCursor(IDBKeyRange.only(category));
    
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
    console.log(`Cleared cache for category: ${category}`);
  } catch (error) {
    console.error('Error clearing category cache:', error);
  }
};

/**
 * Clear entire asset cache
 */
export const clearAllAssetCache = async (): Promise<void> => {
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
    console.log('Cleared all asset cache');
  } catch (error) {
    console.error('Error clearing asset cache:', error);
  }
};

/**
 * Get cache statistics
 */
export const getAssetCacheStats = async (): Promise<{
  totalEntries: number;
  estimatedSize: number;
  categoryCounts: Record<string, number>;
}> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const allRequest = store.getAll();
    
    const all = await new Promise<CachedAsset[]>((resolve, reject) => {
      allRequest.onsuccess = () => resolve(allRequest.result);
      allRequest.onerror = () => reject(allRequest.error);
    });
    
    const estimatedSize = all.reduce((sum, item) => sum + item.blobData.size, 0);
    const categoryCounts: Record<string, number> = {};
    
    all.forEach(item => {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    });
    
    db.close();
    
    return {
      totalEntries: all.length,
      estimatedSize,
      categoryCounts,
    };
  } catch (error) {
    console.error('Error getting asset cache stats:', error);
    return {
      totalEntries: 0,
      estimatedSize: 0,
      categoryCounts: {},
    };
  }
};
