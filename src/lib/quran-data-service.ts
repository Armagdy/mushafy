import { ASSETS_BASE_URL } from '@/config/assets';

/**
 * Centralized data service for caching static Quran JSON files
 * Ensures each file is fetched only once and reused throughout the application
 */

// Cache storage
let quranMetaDataCache: any = null;
let ayahMetaDataCache: any = null;
let audioDataCache: any = null;
let faviconCache: string | null = null;

// Promises for in-flight requests
let quranMetaDataPromise: Promise<any> | null = null;
let ayahMetaDataPromise: Promise<any> | null = null;
let audioDataPromise: Promise<any> | null = null;
let faviconPromise: Promise<string> | null = null;

/**
 * Fetch quran-meta-data.json once and cache it
 * Subsequent calls return the cached data
 */
export const getQuranMetaData = async (): Promise<any> => {
  // Return cached data if available
  if (quranMetaDataCache) {
    return quranMetaDataCache;
  }

  // Return existing promise if fetch is in progress
  if (quranMetaDataPromise) {
    return quranMetaDataPromise;
  }

  // Start new fetch and cache the promise
  quranMetaDataPromise = fetch(`${ASSETS_BASE_URL}/quran-meta-data.json`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      quranMetaDataCache = data;
      quranMetaDataPromise = null;
      console.log('✅ quran-meta-data.json loaded and cached');
      return data;
    })
    .catch(error => {
      quranMetaDataPromise = null;
      console.error('Failed to load quran-meta-data.json:', error);
      throw error;
    });

  return quranMetaDataPromise;
};

/**
 * Fetch ayah-meta-data.json once and cache it
 * Subsequent calls return the cached data
 */
export const getAyahMetaData = async (): Promise<any> => {
  // Return cached data if available
  if (ayahMetaDataCache) {
    return ayahMetaDataCache;
  }

  // Return existing promise if fetch is in progress
  if (ayahMetaDataPromise) {
    return ayahMetaDataPromise;
  }

  // Start new fetch and cache the promise
  ayahMetaDataPromise = fetch(`${ASSETS_BASE_URL}/ayah-meta-data.json`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      ayahMetaDataCache = data;
      ayahMetaDataPromise = null;
      console.log('✅ ayah-meta-data.json loaded and cached');
      return data;
    })
    .catch(error => {
      ayahMetaDataPromise = null;
      console.error('Failed to load ayah-meta-data.json:', error);
      throw error;
    });

  return ayahMetaDataPromise;
};

/**
 * Fetch audio.json once and cache it
 * Subsequent calls return the cached data
 */
export const getAudioData = async (): Promise<any> => {
  // Return cached data if available
  if (audioDataCache) {
    return audioDataCache;
  }

  // Return existing promise if fetch is in progress
  if (audioDataPromise) {
    return audioDataPromise;
  }

  // Start new fetch and cache the promise
  audioDataPromise = fetch(`${ASSETS_BASE_URL}/audio.json`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      audioDataCache = data;
      audioDataPromise = null;
      console.log('✅ audio.json loaded and cached');
      return data;
    })
    .catch(error => {
      audioDataPromise = null;
      console.error('Failed to load audio.json:', error);
      throw error;
    });

  return audioDataPromise;
};

/**
 * Fetch favicon image once and cache it as an object URL
 * Subsequent calls return the cached object URL
 */
export const getFaviconUrl = async (): Promise<string> => {
  // Return cached URL if available
  if (faviconCache) {
    return faviconCache;
  }

  // Return existing promise if fetch is in progress
  if (faviconPromise) {
    return faviconPromise;
  }

  // Start new fetch and cache the promise
  faviconPromise = fetch('/mushafy.jpeg')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.blob();
    })
    .then(blob => {
      // Create object URL from blob for reuse
      const objectUrl = URL.createObjectURL(blob);
      faviconCache = objectUrl;
      faviconPromise = null;
      console.log('✅ mushafy.jpeg loaded and cached as object URL');
      
      // Update all favicon references with the cached object URL
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
      const ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
      const twitterImage = document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement;
      
      if (favicon) favicon.href = objectUrl;
      if (appleTouchIcon) appleTouchIcon.href = objectUrl;
      if (ogImage) ogImage.content = objectUrl;
      if (twitterImage) twitterImage.content = objectUrl;
      
      return objectUrl;
    })
    .catch(error => {
      faviconPromise = null;
      console.error('Failed to load mushafy.jpeg:', error);
      throw error;
    });

  return faviconPromise;
};

/**
 * Clear all cached data and in-flight promises
 * Useful for testing or force reload scenarios
 */
export const clearDataCache = (): void => {
  quranMetaDataCache = null;
  ayahMetaDataCache = null;
  audioDataCache = null;
  if (faviconCache) {
    URL.revokeObjectURL(faviconCache);
  }
  faviconCache = null;
  quranMetaDataPromise = null;
  ayahMetaDataPromise = null;
  audioDataPromise = null;
  faviconPromise = null;
  console.log('🗑️ Data cache cleared');
};

/**
 * Preload all static data files
 * Call this on app initialization to fetch data early
 */
export const preloadQuranData = async (): Promise<void> => {
  try {
    await Promise.all([
      getQuranMetaData(),
      getAyahMetaData(),
      getAudioData(),
      getFaviconUrl(),
    ]);
    console.log('✅ All Quran data preloaded');
  } catch (error) {
    console.error('Failed to preload Quran data:', error);
    throw error;
  }
};
