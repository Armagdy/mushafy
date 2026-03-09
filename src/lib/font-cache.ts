/**
 * Font Cache Service for on-demand font loading
 * Downloads and caches page-specific Quran fonts (qpc_v2 and qpc_v4)
 * Uses native storage on Android/iOS, IndexedDB on web
 */

import { IMAGES_BASE_URL } from '@/config/assets';
import { NativeStorage, isNativePlatform, getPlatform } from './native-storage';
import { Capacitor } from '@capacitor/core';
import { checkNetworkBeforeDownload } from '@/hooks/useNetwork';

// Hybrid storage instance for fonts
const fontStorage = new NativeStorage('quran-font-cache');

// Initialize storage on module load
fontStorage.init().catch(console.error);

/**
 * Generate cache key for font file
 */
const getFontCacheKey = (pageNumber: number, mushafType: 'tarteel' | 'tajweed'): string => {
  const fontVersion = mushafType === 'tajweed' ? 'qpc_v4' : 'qpc_v2';
  return `${fontVersion}_p${pageNumber}`;
};

/**
 * Get font URL
 */
export const getFontUrl = (pageNumber: number, mushafType: 'tarteel' | 'tajweed'): string => {
  const fontVersion = mushafType === 'tajweed' ? 'qpc_v4_font' : 'qpc_v2_font';
  return `${IMAGES_BASE_URL}/fonts/${fontVersion}/p${pageNumber}.woff`;
};

/**
 * Cache a font file
 */
export const cacheFont = async (
  pageNumber: number,
  mushafType: 'tarteel' | 'tajweed',
  signal?: AbortSignal
): Promise<boolean> => {
  try {
    // Check network connectivity before downloading
    checkNetworkBeforeDownload();
    
    await fontStorage.init();
    
    const url = getFontUrl(pageNumber, mushafType);
    const key = getFontCacheKey(pageNumber, mushafType);
    
    // Fetch the font
    const response = await fetch(url, { mode: 'cors', signal });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    
    const blobData = await response.blob();
    
    const metadata = {
      url,
      pageNumber,
      mushafType,
      mimeType: 'font/woff',
      category: 'font',
    };
    
    await fontStorage.setItem(key, blobData, metadata);
    
    console.log(`✅ [${getPlatform()}] Cached font: p${pageNumber} (${mushafType})`);
    return true;
  } catch (error) {
    console.error(`Error caching font p${pageNumber}:`, error);
    return false;
  }
};

/**
 * Get cached font blob
 */
export const getCachedFont = async (
  pageNumber: number,
  mushafType: 'tarteel' | 'tajweed'
): Promise<Blob | null> => {
  try {
    await fontStorage.init();
    
    const key = getFontCacheKey(pageNumber, mushafType);
    const result = await fontStorage.getItem(key);
    
    if (result && result.data instanceof Blob) {
      console.log(`✅ [${getPlatform()}] Font cache HIT: p${pageNumber} (${mushafType})`);
      return result.data;
    }
    
    console.log(`❌ [${getPlatform()}] Font cache MISS: p${pageNumber} (${mushafType})`);
    return null;
  } catch (error) {
    console.error(`Error retrieving cached font p${pageNumber}:`, error);
    return null;
  }
};

/**
 * Get cached font URI (native platforms only - much faster than loading blob)
 */
export const getCachedFontUri = async (
  pageNumber: number,
  mushafType: 'tarteel' | 'tajweed'
): Promise<string | null> => {
  if (!isNativePlatform()) return null;
  
  try {
    await fontStorage.init();
    
    const key = getFontCacheKey(pageNumber, mushafType);
    const uri = await fontStorage.getFileUri(key);
    
    if (uri) {
      console.log(`✅ [${getPlatform()}] Font URI found: p${pageNumber} (${mushafType})`);
      return uri;
    }
    
    return null;
  } catch (error) {
    console.error(`Error retrieving font URI p${pageNumber}:`, error);
    return null;
  }
};

/**
 * Check if font is cached
 */
export const isFontCached = async (
  pageNumber: number,
  mushafType: 'tarteel' | 'tajweed'
): Promise<boolean> => {
  try {
    await fontStorage.init();
    
    const key = getFontCacheKey(pageNumber, mushafType);
    return await fontStorage.hasItem(key);
  } catch (error) {
    console.error(`Error checking font cache p${pageNumber}:`, error);
    return false;
  }
};

/**
 * Load font into document with caching
 * Returns the font family name to use in CSS
 * Throws error if font is not cached and offline
 */
export const loadCachedFont = async (
  pageNumber: number,
  mushafType: 'tarteel' | 'tajweed',
  signal?: AbortSignal
): Promise<string> => {
  const fontName = `p${pageNumber}-${mushafType}`;
  
  // Check if font is already loaded in document.fonts
  const existingFont = Array.from(document.fonts).find(
    (font: any) => font.family === fontName
  );
  
  if (existingFont && existingFont.status === 'loaded') {
    console.log(`Font ${fontName} already loaded in document`);
    return fontName;
  }

  // Try to get from cache first
  let fontUrl: string;
  let needsCleanup = false;
  
  if (isNativePlatform()) {
    // On native, try to get file URI first (much faster)
    const fileUri = await getCachedFontUri(pageNumber, mushafType);
    if (fileUri) {
      fontUrl = Capacitor.convertFileSrc(fileUri);
      console.log(`Using cached font URI: ${fontName}`);
    } else {
      // Not cached - check if online before downloading
      if (!navigator.onLine) {
        console.error(`[FontCache] 🔴 OFFLINE and font not cached: p${pageNumber} (${mushafType})`);
        throw new Error('FONT_NOT_CACHED_OFFLINE');
      }
      
      // Online - download and cache it
      console.log(`Font not cached, downloading: ${fontName}`);
      await cacheFont(pageNumber, mushafType, signal);
      
      // Get the URI after caching
      const newFileUri = await getCachedFontUri(pageNumber, mushafType);
      if (newFileUri) {
        fontUrl = Capacitor.convertFileSrc(newFileUri);
      } else {
        // Fallback to network URL
        fontUrl = getFontUrl(pageNumber, mushafType);
      }
    }
  } else {
    // On web, try to get blob from cache
    const cachedBlob = await getCachedFont(pageNumber, mushafType);
    
    if (cachedBlob) {
      fontUrl = URL.createObjectURL(cachedBlob);
      needsCleanup = true;
      console.log(`Using cached font blob: ${fontName}`);
    } else {
      // Not cached - check if online before downloading
      if (!navigator.onLine) {
        console.error(`[FontCache] 🔴 OFFLINE and font not cached: p${pageNumber} (${mushafType})`);
        throw new Error('FONT_NOT_CACHED_OFFLINE');
      }
      
      // Online - download, cache, and use it
      console.log(`Font not cached, downloading: ${fontName}`);
      await cacheFont(pageNumber, mushafType, signal);
      
      // Get the blob after caching
      const newBlob = await getCachedFont(pageNumber, mushafType);
      if (newBlob) {
        fontUrl = URL.createObjectURL(newBlob);
        needsCleanup = true;
      } else {
        // Fallback to network URL
        fontUrl = getFontUrl(pageNumber, mushafType);
      }
    }
  }

  // Load font into document
  const font = new FontFace(fontName, `url(${fontUrl})`);
  await font.load();
  document.fonts.add(font);
  
  // Wait for fonts to be fully ready
  await document.fonts.ready;
  
  // Cleanup blob URL if we created one
  if (needsCleanup) {
    // Delay cleanup to ensure font is loaded
    setTimeout(() => URL.revokeObjectURL(fontUrl), 1000);
  }
  
  console.log(`Font ${fontName} loaded and ready`);
  return fontName;
};

/**
 * Remove cached font
 */
export const removeCachedFont = async (
  pageNumber: number,
  mushafType: 'tarteel' | 'tajweed'
): Promise<boolean> => {
  try {
    await fontStorage.init();
    
    const key = getFontCacheKey(pageNumber, mushafType);
    await fontStorage.removeItem(key);
    
    console.log(`✅ [${getPlatform()}] Removed cached font: p${pageNumber} (${mushafType})`);
    return true;
  } catch (error) {
    console.error(`Error removing cached font p${pageNumber}:`, error);
    return false;
  }
};

/**
 * Clear all cached fonts
 */
export const clearAllFonts = async (): Promise<boolean> => {
  try {
    await fontStorage.init();
    await fontStorage.clear();
    console.log(`✅ [${getPlatform()}] Cleared all font cache`);
    return true;
  } catch (error) {
    console.error('Error clearing font cache:', error);
    return false;
  }
};

/**
 * Get font cache statistics
 */
export const getFontCacheStats = async (): Promise<{
  totalFonts: number;
  tarteel: number;
  tajweed: number;
}> => {
  try {
    await fontStorage.init();
    const keys = await fontStorage.keys();
    
    const tarteel = keys.filter(k => k.startsWith('qpc_v2_')).length;
    const tajweed = keys.filter(k => k.startsWith('qpc_v4_')).length;
    
    return {
      totalFonts: keys.length,
      tarteel,
      tajweed,
    };
  } catch (error) {
    console.error('Error getting font cache stats:', error);
    return { totalFonts: 0, tarteel: 0, tajweed: 0 };
  }
};
