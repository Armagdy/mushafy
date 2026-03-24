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

// Track which fonts are currently being loaded (prevent duplicate loads)
const loadingFonts = new Set<string>();

// Track which fonts have been injected into CSS (persistent across pages)
const injectedFonts = new Set<string>();

/**
 * Load font into document with caching (Optimized for Android performance)
 * Uses CSS @font-face injection instead of FontFace API to avoid blocking
 * Returns the font family name to use in CSS
 * Throws error if font is not cached and offline
 */
export const loadCachedFont = async (
  pageNumber: number,
  mushafType: 'tarteel' | 'tajweed',
  signal?: AbortSignal
): Promise<string> => {
  const fontName = `p${pageNumber}-${mushafType}`;
  
  // If font is already injected, return immediately (FAST PATH)
  if (injectedFonts.has(fontName)) {
    console.log(`✅ Font ${fontName} already injected (cached in CSS)`);
    return fontName;
  }
  
  // If font is currently being loaded, wait for it
  if (loadingFonts.has(fontName)) {
    console.log(`⏳ Font ${fontName} is being loaded, waiting...`);
    // Wait for the ongoing load to complete
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (injectedFonts.has(fontName)) {
          clearInterval(checkInterval);
          resolve(fontName);
        }
      }, 50);
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(fontName);
      }, 5000);
    });
  }
  
  // Mark font as loading
  loadingFonts.add(fontName);
  
  try {
    // Get font URL (from cache or download)
    let fontUrl: string;
    let needsCleanup = false;
    
    if (isNativePlatform()) {
      // On native, try to get file URI first (much faster - direct disk access)
      const fileUri = await getCachedFontUri(pageNumber, mushafType);
      if (fileUri) {
        fontUrl = Capacitor.convertFileSrc(fileUri);
        console.log(`✅ Using cached font URI: ${fontName}`);
      } else {
        // Not cached - check if online before downloading
        if (!navigator.onLine) {
          console.error(`[FontCache] 🔴 OFFLINE and font not cached: p${pageNumber} (${mushafType})`);
          throw new Error('FONT_NOT_CACHED_OFFLINE');
        }
        
        // Online - download and cache it
        console.log(`📥 Font not cached, downloading: ${fontName}`);
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
        console.log(`✅ Using cached font blob: ${fontName}`);
      } else {
        // Not cached - check if online before downloading
        if (!navigator.onLine) {
          console.error(`[FontCache] 🔴 OFFLINE and font not cached: p${pageNumber} (${mushafType})`);
          throw new Error('FONT_NOT_CACHED_OFFLINE');
        }
        
        // Online - download, cache, and use it
        console.log(`📥 Font not cached, downloading: ${fontName}`);
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

    // Inject font using CSS @font-face (non-blocking, persistent)
    // This is MUCH faster than FontFace API because it doesn't block rendering
    const styleId = `font-${fontName}`;
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = `
        @font-face {
          font-family: '${fontName}';
          src: url('${fontUrl}') format('woff');
          font-display: swap;
        }
      `;
      document.head.appendChild(styleElement);
      console.log(`✅ Font ${fontName} injected into CSS (non-blocking)`);
    }
    
    // Mark font as injected
    injectedFonts.add(fontName);
    
    // Optionally preload the font asynchronously (doesn't block rendering)
    // This helps ensure the font is available quickly but doesn't block the UI
    if ('fonts' in document) {
      document.fonts.load(`16px ${fontName}`).catch(() => {
        // Ignore errors - font will load when needed
      });
    }
    
    // Schedule cleanup for blob URLs (web only)
    if (needsCleanup) {
      // Delay cleanup to ensure font is loaded (5 seconds should be enough)
      setTimeout(() => URL.revokeObjectURL(fontUrl), 5000);
    }
    
    return fontName;
  } finally {
    // Remove from loading set
    loadingFonts.delete(fontName);
  }
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
    
    // Remove from injected fonts tracking
    const fontName = `p${pageNumber}-${mushafType}`;
    injectedFonts.delete(fontName);
    
    // Remove CSS style element
    const styleId = `font-${fontName}`;
    const styleElement = document.getElementById(styleId);
    if (styleElement) {
      styleElement.remove();
    }
    
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
    
    // Remove all CSS style elements for fonts
    injectedFonts.forEach(fontName => {
      const styleId = `font-${fontName}`;
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        styleElement.remove();
      }
    });
    
    // Clear tracking sets
    injectedFonts.clear();
    loadingFonts.clear();
    
    console.log(`✅ [${getPlatform()}] Cleared all font cache and CSS`);
    return true;
  } catch (error) {
    console.error('Error clearing font cache:', error);
    return false;
  }
};

/**
 * Preload fonts for adjacent pages (performance optimization)
 * Call this after loading the current page to prepare nearby pages
 */
export const preloadAdjacentFonts = async (
  currentPage: number,
  mushafType: 'tarteel' | 'tajweed',
  range: number = 2
): Promise<void> => {
  const pagesToPreload: number[] = [];
  
  // Preload previous and next pages within range
  for (let i = 1; i <= range; i++) {
    const prevPage = currentPage - i;
    const nextPage = currentPage + i;
    
    if (prevPage >= 1) pagesToPreload.push(prevPage);
    if (nextPage <= 604) pagesToPreload.push(nextPage);
  }
  
  // Preload fonts in parallel (non-blocking)
  const preloadPromises = pagesToPreload.map(async (pageNum) => {
    try {
      // Check if already cached or injected
      const fontName = `p${pageNum}-${mushafType}`;
      if (injectedFonts.has(fontName)) {
        return; // Already loaded
      }
      
      // Check if cached in storage
      const isCached = await isFontCached(pageNum, mushafType);
      if (!isCached && navigator.onLine) {
        // Download and cache if online
        await cacheFont(pageNum, mushafType);
        console.log(`📦 Preloaded font for page ${pageNum}`);
      }
    } catch (error) {
      // Silently fail - preloading is optional
      console.log(`⚠️ Failed to preload font for page ${pageNum}`);
    }
  });
  
  await Promise.allSettled(preloadPromises);
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

// ============================================
// Icon Font Loading (quran-icon, surah-name-v4)
// ============================================

type IconFontType = 'quran-icon' | 'surah-name-v4';

// Track which icon fonts are loaded
const loadedIconFonts = new Set<IconFontType>();
const loadingIconFonts = new Set<IconFontType>();

/**
 * Get icon font URL from CDN
 */
export const getIconFontUrl = (fontType: IconFontType): string => {
  const fontFiles: Record<IconFontType, string> = {
    'quran-icon': 'quran-icon/quran-common.woff2',
    'surah-name-v4': 'surah-name-v4/surah-name-v2.woff2',
  };
  return `${IMAGES_BASE_URL}/fonts/${fontFiles[fontType]}`;
};

/**
 * Get cache key for icon font
 */
const getIconFontCacheKey = (fontType: IconFontType): string => {
  return `icon_font_${fontType}`;
};

/**
 * Cache an icon font
 */
export const cacheIconFont = async (
  fontType: IconFontType,
  signal?: AbortSignal
): Promise<boolean> => {
  try {
    checkNetworkBeforeDownload();
    await fontStorage.init();
    
    const url = getIconFontUrl(fontType);
    const key = getIconFontCacheKey(fontType);
    
    const response = await fetch(url, { mode: 'cors', signal });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    
    const blobData = await response.blob();
    
    const metadata = {
      url,
      fontType,
      mimeType: 'font/woff2',
      category: 'icon-font',
    };
    
    await fontStorage.setItem(key, blobData, metadata);
    
    console.log(`✅ [${getPlatform()}] Cached icon font: ${fontType}`);
    return true;
  } catch (error) {
    console.error(`Error caching icon font ${fontType}:`, error);
    return false;
  }
};

/**
 * Get cached icon font blob
 */
export const getCachedIconFont = async (
  fontType: IconFontType
): Promise<Blob | null> => {
  try {
    await fontStorage.init();
    
    const key = getIconFontCacheKey(fontType);
    const result = await fontStorage.getItem(key);
    
    if (result && result.data instanceof Blob) {
      console.log(`✅ [${getPlatform()}] Icon font cache HIT: ${fontType}`);
      return result.data;
    }
    
    console.log(`❌ [${getPlatform()}] Icon font cache MISS: ${fontType}`);
    return null;
  } catch (error) {
    console.error(`Error retrieving cached icon font ${fontType}:`, error);
    return null;
  }
};

/**
 * Get cached icon font URI (native platforms only)
 */
export const getCachedIconFontUri = async (
  fontType: IconFontType
): Promise<string | null> => {
  if (!isNativePlatform()) return null;
  
  try {
    await fontStorage.init();
    
    const key = getIconFontCacheKey(fontType);
    const uri = await fontStorage.getFileUri(key);
    
    if (uri) {
      console.log(`✅ [${getPlatform()}] Icon font URI found: ${fontType}`);
      return uri;
    }
    
    return null;
  } catch (error) {
    console.error(`Error retrieving icon font URI ${fontType}:`, error);
    return null;
  }
};

/**
 * Check if icon font is cached
 */
export const isIconFontCached = async (fontType: IconFontType): Promise<boolean> => {
  try {
    await fontStorage.init();
    const key = getIconFontCacheKey(fontType);
    return await fontStorage.hasItem(key);
  } catch (error) {
    console.error(`Error checking icon font cache ${fontType}:`, error);
    return false;
  }
};

/**
 * Load icon font into document (with caching)
 */
export const loadIconFont = async (
  fontType: IconFontType,
  signal?: AbortSignal
): Promise<string> => {
  // Already loaded
  if (loadedIconFonts.has(fontType)) {
    console.log(`✅ Icon font ${fontType} already loaded`);
    return fontType;
  }
  
  // Currently loading - wait for it
  if (loadingIconFonts.has(fontType)) {
    console.log(`⏳ Icon font ${fontType} is loading, waiting...`);
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (loadedIconFonts.has(fontType)) {
          clearInterval(checkInterval);
          resolve(fontType);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(fontType);
      }, 5000);
    });
  }
  
  loadingIconFonts.add(fontType);
  
  try {
    let fontUrl: string;
    
    if (isNativePlatform()) {
      // Native: Try cached file URI first
      const fileUri = await getCachedIconFontUri(fontType);
      if (fileUri) {
        fontUrl = Capacitor.convertFileSrc(fileUri);
        console.log(`✅ Using cached icon font URI: ${fontType}`);
      } else {
        // Not cached - download if online
        if (!navigator.onLine) {
          console.error(`[FontCache] 🔴 OFFLINE and icon font not cached: ${fontType}`);
          throw new Error('ICON_FONT_NOT_CACHED_OFFLINE');
        }
        
        console.log(`📥 Icon font not cached, downloading: ${fontType}`);
        await cacheIconFont(fontType, signal);
        
        const newFileUri = await getCachedIconFontUri(fontType);
        if (newFileUri) {
          fontUrl = Capacitor.convertFileSrc(newFileUri);
        } else {
          fontUrl = getIconFontUrl(fontType);
        }
      }
    } else {
      // Web: Use direct URL (fonts are small and always available from server/CDN)
      // No need for IndexedDB caching - just use the URL directly
      fontUrl = getIconFontUrl(fontType);
      console.log(`✅ Using direct icon font URL: ${fontType} -> ${fontUrl}`);
    }
    
    // Inject CSS @font-face
    const styleId = `icon-font-${fontType}`;
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = `
        @font-face {
          font-family: '${fontType}';
          src: url('${fontUrl}') format('woff2');
          font-display: swap;
        }
      `;
      document.head.appendChild(styleElement);
      console.log(`✅ Icon font ${fontType} injected into CSS`);
    }
    
    loadedIconFonts.add(fontType);
    
    // Preload the font to ensure it's ready
    if ('fonts' in document) {
      try {
        await document.fonts.load(`16px ${fontType}`);
        console.log(`✅ Icon font ${fontType} preloaded into browser`);
      } catch (e) {
        console.warn(`⚠️ Font preload for ${fontType} failed:`, e);
      }
    }
    
    // Do NOT revoke blob URLs for icon fonts - they need to persist for the session
    // (only 2 small fonts, so memory impact is negligible)
    
    return fontType;
  } finally {
    loadingIconFonts.delete(fontType);
  }
};

/**
 * Load all icon fonts (call at app startup)
 */
export const loadAllIconFonts = async (): Promise<void> => {
  const iconFonts: IconFontType[] = ['quran-icon', 'surah-name-v4'];
  
  await Promise.allSettled(
    iconFonts.map(fontType => loadIconFont(fontType))
  );
  
  console.log('✅ All icon fonts loaded');
};

/**
 * Check if all icon fonts are cached
 */
export const areIconFontsCached = async (): Promise<boolean> => {
  const results = await Promise.all([
    isIconFontCached('quran-icon'),
    isIconFontCached('surah-name-v4'),
  ]);
  return results.every(cached => cached);
};

/**
 * Preload icon fonts (download and cache without injecting)
 */
export const preloadIconFonts = async (): Promise<void> => {
  const iconFonts: IconFontType[] = ['quran-icon', 'surah-name-v4'];
  
  for (const fontType of iconFonts) {
    const isCached = await isIconFontCached(fontType);
    if (!isCached && navigator.onLine) {
      await cacheIconFont(fontType);
      console.log(`📦 Preloaded icon font: ${fontType}`);
    }
  }
};
