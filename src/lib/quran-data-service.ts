import { ASSETS_BASE_URL } from '@/config/assets';
import { NativeStorage, isNativePlatform } from './native-storage';

/**
 * Centralized data service for caching static Quran JSON files
 * Ensures each file is fetched only once and reused throughout the application
 * Uses native storage for persistent offline access
 */

// Cache storage (memory)
let quranMetaDataCache: any = null;
let ayahMetaDataCache: any = null;
let audioDataCache: any = null;
let faviconCache: string | null = null;

// Promises for in-flight requests
let quranMetaDataPromise: Promise<any> | null = null;
let ayahMetaDataPromise: Promise<any> | null = null;
let audioDataPromise: Promise<any> | null = null;
let faviconPromise: Promise<string> | null = null;

// Native storage for persistent offline access
const quranDataStorage = new NativeStorage('quran-data-storage');
let storageInitialized = false;

/**
 * Initialize storage (lazy initialization)
 */
async function initStorage(): Promise<void> {
  if (!storageInitialized) {
    await quranDataStorage.init();
    storageInitialized = true;
    console.log(`✅ Quran data storage initialized (${isNativePlatform() ? 'Native' : 'IndexedDB'})`);
  }
}

/**
 * Save data to persistent storage
 */
async function saveDataToStorage(key: string, data: any): Promise<void> {
  try {
    await initStorage();
    const jsonString = JSON.stringify(data);
    await quranDataStorage.setItem(key, jsonString, {
      cachedAt: Date.now(),
      platform: isNativePlatform() ? 'native' : 'web'
    });
    console.log(`✅ Saved ${key} to storage`);
  } catch (error) {
    console.error(`Failed to save ${key} to storage:`, error);
  }
}

/**
 * Load data from persistent storage
 */
async function loadDataFromStorage(key: string): Promise<any | null> {
  try {
    await initStorage();
    const result = await quranDataStorage.getItem(key);
    
    if (result) {
      const jsonString = typeof result.data === 'string' 
        ? result.data 
        : await (result.data as Blob).text();
      const data = JSON.parse(jsonString);
      console.log(`✅ Loaded ${key} from storage (cached at ${new Date(result.timestamp).toLocaleString()})`);
      return data;
    }
  } catch (error) {
    console.error(`Failed to load ${key} from storage:`, error);
  }
  return null;
}

/**
 * Fetch quran-meta-data.json once and cache it
 * Priority: Memory Cache → Native Storage → Fetch from Assets
 */
export const getQuranMetaData = async (): Promise<any> => {
  // Return cached data if available
  if (quranMetaDataCache) {
    console.log('✅ Loaded quran-meta-data from memory cache');
    return quranMetaDataCache;
  }

  // Return existing promise if fetch is in progress
  if (quranMetaDataPromise) {
    return quranMetaDataPromise;
  }

  // Try loading from persistent storage first
  const storedData = await loadDataFromStorage('quran-meta-data');
  if (storedData) {
    quranMetaDataCache = storedData;
    return storedData;
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
      
      // Save to storage for offline access
      saveDataToStorage('quran-meta-data', data);
      
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
 * Priority: Memory Cache → Native Storage → Fetch from Assets
 */
export const getAyahMetaData = async (): Promise<any> => {
  // Return cached data if available
  if (ayahMetaDataCache) {
    console.log('✅ Loaded ayah-meta-data from memory cache');
    return ayahMetaDataCache;
  }

  // Return existing promise if fetch is in progress
  if (ayahMetaDataPromise) {
    return ayahMetaDataPromise;
  }

  // Try loading from persistent storage first
  const storedData = await loadDataFromStorage('ayah-meta-data');
  if (storedData) {
    ayahMetaDataCache = storedData;
    return storedData;
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
      
      // Save to storage for offline access
      saveDataToStorage('ayah-meta-data', data);
      
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
 * Fetch reciters.json once and cache it (contains both everyayah and mp3quran reciters)
 * Priority: Memory Cache → Native Storage → Fetch from Assets
 */
export const getAudioData = async (): Promise<any> => {
  // Return cached data if available
  if (audioDataCache) {
    console.log('✅ Loaded everyayah reciters from memory cache');
    return audioDataCache;
  }

  // Return existing promise if fetch is in progress
  if (audioDataPromise) {
    return audioDataPromise;
  }

  // Try loading from persistent storage first
  const storedData = await loadDataFromStorage('reciters-data');
  if (storedData && Array.isArray(storedData) && storedData.length > 0) {
    audioDataCache = storedData;
    return storedData;
  }

  // Start new fetch and cache the promise
  audioDataPromise = fetch(`${ASSETS_BASE_URL}/reciters.json`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Filter for everyayah reciters only
      const everyayahReciters = data.reciters.filter((r: any) => r.source === 'everyayah');
      audioDataCache = everyayahReciters;
      audioDataPromise = null;
      
      // Save to storage for offline access
      saveDataToStorage('reciters-data', everyayahReciters);
      
      console.log('✅ reciters.json loaded and cached (everyayah reciters)');
      return everyayahReciters;
    })
    .catch(error => {
      audioDataPromise = null;
      console.error('Failed to load reciters.json:', error);
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
 * Get ayah text from local cached data
 * Returns Arabic and English text for a specific ayah
 */
export const getAyahText = async (surahNumber: number, ayahNumber: number): Promise<{ ar: string; en: string } | null> => {
  try {
    const ayahData = await getAyahMetaData();
    if (!ayahData || !Array.isArray(ayahData)) {
      console.warn('Ayah metadata not available');
      return null;
    }

    // Find the surah (array is 0-indexed, surah numbers are 1-indexed)
    const surah = ayahData.find((s: any) => s.number === surahNumber);
    if (!surah || !surah.verses) {
      console.warn(`Surah ${surahNumber} not found in ayah metadata`);
      return null;
    }

    // Find the ayah (verse numbers are 1-indexed)
    const verse = surah.verses.find((v: any) => v.number === ayahNumber);
    if (!verse || !verse.text) {
      console.warn(`Ayah ${ayahNumber} not found in surah ${surahNumber}`);
      return null;
    }

    return {
      ar: verse.text.ar || '',
      en: verse.text.en || ''
    };
  } catch (error) {
    console.error('Failed to get ayah text:', error);
    return null;
  }
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
