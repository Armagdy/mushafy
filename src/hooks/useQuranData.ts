import { useState, useEffect } from 'react';
import { getQuranMetaData, getAyahMetaData } from '@/lib/quran-data-service';

interface AyahVerse {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  page: number;
  hizbQuarter: number;
}

interface SurahData {
  number: number;
  name: {
    ar: string;
    en: string;
    transliteration: string;
  };
  englishName?: string; // Optional for backward compatibility
  englishNameTranslation?: string; // Optional for backward compatibility
  numberOfAyahs: number;
  revelationType: string;
  verses: AyahVerse[];
}

interface QuranMetaData {
  pages: {
    [pageNumber: string]: {
      surah: number;
      ayah: number;
      juz: number;
    };
  };
}

interface UseQuranDataReturn {
  // Data states
  ayahData: SurahData[];
  quranMetaData: QuranMetaData | null;
  
  // Loading states
  isAyahDataLoading: boolean;
  isMetaDataLoading: boolean;
  
  // Error states
  ayahDataError: Error | null;
  metaDataError: Error | null;
  
  // Helper functions
  reloadAyahData: () => void;
  reloadMetaData: () => void;
}

/**
 * Custom hook for fetching and caching Quran data
 * Loads ayah metadata (verse text, juz, page info) and page metadata
 */
export function useQuranData(): UseQuranDataReturn {
  const [ayahData, setAyahData] = useState<SurahData[]>([]);
  const [quranMetaData, setQuranMetaData] = useState<QuranMetaData | null>(null);
  
  const [isAyahDataLoading, setIsAyahDataLoading] = useState(false);
  const [isMetaDataLoading, setIsMetaDataLoading] = useState(false);
  
  const [ayahDataError, setAyahDataError] = useState<Error | null>(null);
  const [metaDataError, setMetaDataError] = useState<Error | null>(null);

  // Load ayah metadata (verse text and details)
  const loadAyahData = () => {
    setIsAyahDataLoading(true);
    setAyahDataError(null);
    
    getAyahMetaData()
      .then(data => {
        setAyahData(data);
        setIsAyahDataLoading(false);
      })
      .catch(err => {
        console.error('Failed to load ayah data:', err);
        setAyahDataError(err);
        setIsAyahDataLoading(false);
      });
  };

  // Load quran page metadata (page to surah/ayah mapping)
  const loadQuranMetaData = () => {
    setIsMetaDataLoading(true);
    setMetaDataError(null);
    
    getQuranMetaData()
      .then(data => {
        setQuranMetaData(data);
        setIsMetaDataLoading(false);
      })
      .catch(err => {
        console.error('Failed to load quran metadata:', err);
        setMetaDataError(err);
        setIsMetaDataLoading(false);
      });
  };

  // Load data on mount
  useEffect(() => {
    loadAyahData();
    loadQuranMetaData();
  }, []);

  return {
    // Data
    ayahData,
    quranMetaData,
    
    // Loading states
    isAyahDataLoading,
    isMetaDataLoading,
    
    // Error states
    ayahDataError,
    metaDataError,
    
    // Reload functions
    reloadAyahData: loadAyahData,
    reloadMetaData: loadQuranMetaData,
  };
}

