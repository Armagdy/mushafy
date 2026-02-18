/**
 * Asset Cache Service using Hybrid Storage
 * - Native filesystem on Android/iOS (unlimited storage)
 * - IndexedDB fallback on web browsers
 * Caches mushaf pages and other assets for offline use
 */

import { checkNetworkBeforeDownload } from '@/hooks/useNetwork';
import { NativeStorage, isNativePlatform, getPlatform } from './native-storage';

// Hybrid storage instance
const assetStorage = new NativeStorage('quran-asset-cache');

// Initialize storage on module load
assetStorage.init().catch(console.error);

/**
 * Sanitize URL to create a valid cache key for filesystem
 */
const urlToCacheKey = (url: string): string => {
  // Convert URL to a safe filename by replacing special chars
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 200); // Limit length
};

/**
 * Cache an asset from URL
 * Uses native filesystem on Android/iOS, IndexedDB on web
 */
export const cacheAsset = async (
  url: string,
  category: string,
  signal?: AbortSignal
): Promise<boolean> => {
  try {
    // Check network connectivity before downloading
    checkNetworkBeforeDownload();
    
    await assetStorage.init();
    
    // Fetch the asset
    const response = await fetch(url, { mode: 'cors', signal });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    
    const blobData = await response.blob();
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';
    
    const key = urlToCacheKey(url);
    const metadata = {
      url,
      category,
      mimeType,
    };
    
    await assetStorage.setItem(key, blobData, metadata);
    
    console.log(`✅ [${getPlatform()}] Cached asset: ${url} in category ${category}`);
    return true;
  } catch (error) {
    console.error('Error caching asset:', error);
    return false;
  }
};

/**
 * Get cached asset
 * Uses native filesystem on Android/iOS, IndexedDB on web
 */
export const getCachedAsset = async (url: string): Promise<Blob | null> => {
  try {
    const filename = url.split('/').pop() || 'unknown';
    console.log(`[AssetCache] 🔍 getCachedAsset called for: ${filename}`);
    
    await assetStorage.init();
    
    const key = urlToCacheKey(url);
    console.log(`[AssetCache] Using cache key: ${key}`);
    const result = await assetStorage.getItem(key);
    
    if (result && result.data instanceof Blob) {
      console.log(`✅ [${getPlatform()}] Cache HIT for ${filename} (size: ${result.data.size} bytes)`);
      return result.data;
    }
    
    console.log(`❌ [${getPlatform()}] Cache MISS for ${filename}`);
    return null;
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
 * Uses native filesystem on Android/iOS, IndexedDB on web
 */
export const clearCategoryCache = async (category: string): Promise<void> => {
  try {
    await assetStorage.init();
    
    const allKeys = await assetStorage.keys();
    let deletedCount = 0;
    
    // Filter keys by category and delete
    for (const key of allKeys) {
      try {
        const item = await assetStorage.getItem(key);
        if (item && item.metadata?.category === category) {
          await assetStorage.removeItem(key);
          deletedCount++;
        }
      } catch (err) {
        console.warn(`Failed to check/delete item ${key}:`, err);
      }
    }
    
    console.log(`✅ [${getPlatform()}] Cleared ${deletedCount} assets from category: ${category}`);
  } catch (error) {
    console.error('Error clearing category cache:', error);
  }
};

/**
 * Clear entire asset cache
 * Uses native filesystem on Android/iOS, IndexedDB on web
 */
export const clearAllAssetCache = async (): Promise<void> => {
  try {
    await assetStorage.init();
    await assetStorage.clear();
    console.log(`✅ [${getPlatform()}] Cleared all asset cache`);
  } catch (error) {
    console.error('Error clearing asset cache:', error);
  }
};

/**
 * Get cache statistics
 * Uses native filesystem on Android/iOS, IndexedDB on web
 */
export const getAssetCacheStats = async (): Promise<{
  totalEntries: number;
  estimatedSize: number;
  categoryCounts: Record<string, number>;
}> => {
  try {
    await assetStorage.init();
    
    const allKeys = await assetStorage.keys();
    let estimatedSize = 0;
    const categoryCounts: Record<string, number> = {};
    
    for (const key of allKeys) {
      try {
        const item = await assetStorage.getItem(key);
        if (item) {
          if (item.data instanceof Blob) {
            estimatedSize += item.data.size;
          }
          const category = item.metadata?.category || 'unknown';
          categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        }
      } catch (err) {
        console.warn(`Failed to get stats for item ${key}:`, err);
      }
    }
    
    return {
      totalEntries: allKeys.length,
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
