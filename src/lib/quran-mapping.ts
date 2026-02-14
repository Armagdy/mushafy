import { ASSETS_BASE_URL } from '@/config/assets';
import { getQuranMetaData } from './quran-data-service';

// Generate surah to image filename mapping from quran-meta-data.json
export const generateSurahImageMap = async (): Promise<Record<number, string>> => {
  try {
    const quranData = await getQuranMetaData();
    
    const imageMap: Record<number, string> = {};
    const seenSurahs = new Set<number>();

    // The pages array contains [surah_id, ayah_number] for each page
    // Page number directly maps to image number (page 1 = Quran_0001.jpg)
    quranData.pages.forEach((page: number[], index: number) => {
      const [surahId] = page;
      
      // Only map the first page for each surah
      if (!seenSurahs.has(surahId)) {
        const pageNumber = index  // Pages start at 1
        console.log('Mapping surah', surahId, 'to page', pageNumber + 1);
        const paddedPageNumber = String(pageNumber).padStart(4, '0');
        imageMap[surahId] = `Quran_${paddedPageNumber}.jpg`;
        seenSurahs.add(surahId);
      }
    });

    return imageMap;
  } catch (error) {
    console.error('Failed to load quran-meta-data.json:', error);
    return {};
  }
};

// Get all pages for a specific surah
export const getSurahPages = async (surahId: number): Promise<number[]> => {
  try {
    const quranData = await getQuranMetaData();
    
    const pages: number[] = [];
    quranData.pages.forEach((page: number[], index: number) => {
      const [pagesurahId] = page;
      if (pagesurahId === surahId) {
        const pageNumber = index ; // Pages start at 1
        pages.push(pageNumber);
      }
    });

    return pages;
  } catch (error) {
    console.error('Failed to load quran-meta-data.json:', error);
    return [];
  }
};

// Get image filename for a specific page
export const getPageImageFilename = (pageNumber: number): string => {
  // All mushafs use page_XXXX.webp format (optimized WebP images)
  const paddedPageNumber = String(pageNumber).padStart(4, '0');
  return `page_${paddedPageNumber}.webp`;
};

// Get surah info for a specific page
export const getPageSurahInfo = async (pageNumber: number): Promise<{ surahId: number; ayah: number } | null> => {
  try {
    const quranData = await getQuranMetaData();
    
    if (pageNumber < 1 || pageNumber > quranData.pages.length) {
      return null;
    }
    
    const pageData = quranData.pages[pageNumber - 1];
    return {
      surahId: pageData[0],
      ayah: pageData[1]
    };
  } catch (error) {
    console.error('Failed to load quran-meta-data.json:', error);
    return null;
  }
};

// Get juz number for a specific page
export const getPageJuzNumber = async (pageNumber: number): Promise<number> => {
  try {
    const quranData = await getQuranMetaData();
    
    // Get the surah and ayah for this page
    if (pageNumber < 1 || pageNumber > quranData.pages.length) {
      return 1;
    }
    
    const [surahId, ayah] = quranData.pages[pageNumber - 1];
    
    // Find which juz this page belongs to
    let juzNumber = 1;
    for (let i = 0; i < quranData.juzs.length; i++) {
      const [juzSurahId, juzAyah] = quranData.juzs[i];
      
      // If we're past this juz start, increment
      if (surahId > juzSurahId || (surahId === juzSurahId && ayah >= juzAyah)) {
        juzNumber = i + 1;
      } else {
        break;
      }
    }
    
    return juzNumber;
  } catch (error) {
    console.error('Failed to load quran-meta-data.json:', error);
    return 1;
  }
};

// Get first page of a juz
export const getJuzFirstPage = async (juzNumber: number): Promise<number> => {
  try {
    const quranData = await getQuranMetaData();
    
    if (juzNumber < 1 || juzNumber > 30) {
      return 1;
    }
    
    const [juzSurahId, juzAyah] = quranData.juzs[juzNumber - 1];
    
    // Find the first page that starts this juz
    for (let i = 0; i < quranData.pages.length; i++) {
      const [pageSurahId, pageAyah] = quranData.pages[i];
      
      if (pageSurahId === juzSurahId && pageAyah >= juzAyah) {
        return i + 1;
      }
      if (pageSurahId > juzSurahId) {
        return i + 1;
      }
    }
    
    return 1;
  } catch (error) {
    console.error('Failed to load quran-meta-data.json:', error);
    return 1;
  }
};

// Get first page of a surah
export const getSurahFirstPage = async (surahId: number): Promise<number> => {
  try {
    const quranData = await getQuranMetaData();
    
    for (let i = 0; i < quranData.pages.length; i++) {
      const [pageSurahId] = quranData.pages[i];
      if (pageSurahId === surahId) {
        return i + 1;
      }
    }
    
    return 1;
  } catch (error) {
    console.error('Failed to load quran-meta-data.json:', error);
    return 1;
  }
};

// Get all hizb quarters for a specific surah
export const getSurahHizbQuarters = async (surahId: number): Promise<Array<{index: number; ayah: number}>> => {
  try {
    const quranData = await getQuranMetaData();
    
    const hizbQuarters: Array<{index: number; ayah: number}> = [];
    quranData.hizb_quarters.forEach((hizb: number[], index: number) => {
      const [hSurahId] = hizb;
      if (hSurahId === surahId) {
        hizbQuarters.push({ index: index + 1, ayah: hizb[1] });
      }
    });

    return hizbQuarters;
  } catch (error) {
    console.error('Failed to load hizb quarters:', error);
    return [];
  }
};

// Get all juzs (guza) for a specific surah
export const getSurahJuzs = async (surahId: number): Promise<Array<{number: number; ayah: number}>> => {
  try {
    const quranData = await getQuranMetaData();
    
    const juzs: Array<{number: number; ayah: number}> = [];
    quranData.juzs.forEach((juz: number[], index: number) => {
      const [juzSurahId] = juz;
      if (juzSurahId === surahId) {
        juzs.push({ number: index + 1, ayah: juz[1] });
      }
    });

    return juzs;
  } catch (error) {
    console.error('Failed to load juzs:', error);
    return [];
  }
};

// Get page number for a specific ayah
export const getAyahPage = async (surahId: number, ayahNumber: number): Promise<number> => {
  try {
    console.log('🔍 getAyahPage called with:', { surahId, ayahNumber });
    const quranData = await getQuranMetaData();
    
    console.log('📋 Total pages in data:', quranData.pages.length);
    
    let firstPageOfSurah: number | null = null;
    let firstAyahOnFirstPage: number | null = null;
    
    // Find the page that contains this specific ayah
    for (let i = 0; i < quranData.pages.length; i++) {
      const [pageSurahId, pageStartAyah] = quranData.pages[i];
      const nextPage = quranData.pages[i + 1];
      
      // If this is the surah we're looking for
      if (pageSurahId === surahId) {
        // Track the first page where this surah appears
        if (firstPageOfSurah === null) {
          firstPageOfSurah = i + 1;
          firstAyahOnFirstPage = pageStartAyah;
          
          // If the requested ayah is BEFORE the first ayah on this page,
          // it means the surah started on the PREVIOUS page
          if (ayahNumber < pageStartAyah) {
            console.log(`✅ Ayah ${ayahNumber} is before first recorded ayah (${pageStartAyah}) on page ${i + 1}, so it's on previous page ${i}`);
            return i; // Previous page (i + 1 - 1 = i)
          }
        }
        
        // If there's a next page
        if (nextPage) {
          const [nextSurahId, nextStartAyah] = nextPage;
          
          // If next page is same surah, check if ayah is before next page's start
          if (nextSurahId === surahId) {
            if (ayahNumber >= pageStartAyah && ayahNumber < nextStartAyah) {
              console.log(`✅ Found! Surah ${surahId} Ayah ${ayahNumber} is on page ${i + 1} (range: ${pageStartAyah}-${nextStartAyah - 1})`);
              return i + 1;
            }
          } else {
            // Next page is different surah, so this ayah is on current page if >= pageStartAyah
            if (ayahNumber >= pageStartAyah) {
              console.log(`✅ Found! Surah ${surahId} Ayah ${ayahNumber} is on page ${i + 1} (starts at ayah ${pageStartAyah}, last page of surah)`);
              return i + 1;
            }
          }
        } else {
          // This is the last page
          if (ayahNumber >= pageStartAyah) {
            console.log(`✅ Found! Surah ${surahId} Ayah ${ayahNumber} is on page ${i + 1} (last page in Quran)`);
            return i + 1;
          }
        }
      }
    }
    
    console.error('❌ No page found for surah', surahId, 'ayah', ayahNumber);
    return 1;
  } catch (error) {
    console.error('Failed to get ayah page:', error);
    return 1;
  }
};

// Get all surahs that appear on a specific page
export const getPageSurahs = async (pageNumber: number): Promise<number[]> => {
  try {
    const quranData = await getQuranMetaData();
    
    if (pageNumber < 1 || pageNumber > quranData.pages.length) {
      return [];
    }
    
    const surahs = new Set<number>();
    
    // Add the surah that starts on this page
    const [startSurahId] = quranData.pages[pageNumber - 1];
    surahs.add(startSurahId);
    
    // Check if there's a next page and if it starts with a different surah
    if (pageNumber < quranData.pages.length) {
      const [nextStartSurahId] = quranData.pages[pageNumber];
      if (nextStartSurahId !== startSurahId) {
        // The page might contain ayahs from the previous surah as well
        // Check if the previous page exists and starts with a different surah
        if (pageNumber > 1) {
          const [prevStartSurahId] = quranData.pages[pageNumber - 2];
          if (prevStartSurahId !== startSurahId) {
            surahs.add(prevStartSurahId);
          }
        }
      }
    }
    
    return Array.from(surahs).sort((a, b) => a - b);
  } catch (error) {
    console.error('Failed to get page surahs:', error);
    return [];
  }
};

// Memoized mapping
let cachedMapPromise: Promise<Record<number, string>> | null = null;

export const getSurahImageMap = (): Promise<Record<number, string>> => {
  if (!cachedMapPromise) {
    cachedMapPromise = generateSurahImageMap();
  }
  return cachedMapPromise;
};

