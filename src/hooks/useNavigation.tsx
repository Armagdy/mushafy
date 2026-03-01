import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSurahFirstPage, getJuzFirstPage } from '@/lib/quran-mapping';

interface NavigationHookProps {
  isAyahNavigation: React.MutableRefObject<boolean>;
  setCurrentPlayingAyah: (ayah: { surah: number; ayah: number } | null) => void;
}

export function useNavigation({ isAyahNavigation, setCurrentPlayingAyah }: NavigationHookProps) {
  const navigate = useNavigate();

  // Normalize Arabic text by removing diacritics and normalizing character variations
  const normalizeArabic = useCallback((text: string) => {
    return text
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, '') // Remove diacritics
      .replace(/[ٱأإآٲٳٵ]/g, 'ا') // Normalize alef variations
      .replace(/[ىي]/g, 'ي') // Normalize yaa
      .replace(/ة/g, 'ه') // Normalize taa marboota
      .replace(/ؤ/g, 'و') // Normalize waw with hamza
      .replace(/ئ/g, 'ي') // Normalize yaa with hamza (ئ → ي, e.g. خطيئة matches خطيـٔته in Uthmani)
      .replace(/([\u0600-\u06ff])\1+/g, '$1') // Collapse consecutive identical Arabic letters (e.g. خطيي→خطي after ئ→ي)
      .replace(/\s+/g, '') // Remove spaces
      .toLowerCase();
  }, []);

  // Highlight exact phrase match in text
  const highlightText = useCallback((text: string, searchWord: string, isArabic: boolean) => {
    if (!searchWord || !text) return text;
    
    const normalizedSearch = isArabic ? normalizeArabic(searchWord.trim()) : searchWord.trim().toLowerCase();
    const normalizedText = isArabic ? normalizeArabic(text) : text.toLowerCase();
    
    // Find the position of the exact match in normalized text
    const matchIndex = normalizedText.indexOf(normalizedSearch);
    
    if (matchIndex === -1) {
      return text; // No match found
    }
    
    // Calculate the actual position in the original text
    // We need to map back from normalized to original text
    let charCount = 0;
    let actualStartIndex = 0;
    let actualEndIndex = text.length;
    
    // Find start position
    for (let i = 0; i < text.length && charCount < matchIndex; i++) {
      const normalized = isArabic ? normalizeArabic(text[i]) : text[i].toLowerCase();
      if (normalized) charCount += normalized.length;
      actualStartIndex = i + 1;
    }
    
    // Find end position
    charCount = 0;
    for (let i = actualStartIndex; i < text.length && charCount < normalizedSearch.length; i++) {
      const normalized = isArabic ? normalizeArabic(text[i]) : text[i].toLowerCase();
      if (normalized) charCount += normalized.length;
      actualEndIndex = i + 1;
    }
    
    // Split text into before, match, and after
    const before = text.substring(0, actualStartIndex);
    const match = text.substring(actualStartIndex, actualEndIndex);
    const after = text.substring(actualEndIndex);
    
    return (
      <>
        {before}
        <span className="bg-yellow-200 dark:bg-yellow-600 font-semibold rounded px-0.5">
          {match}
        </span>
        {after}
      </>
    );
  }, [normalizeArabic]);

  // Helper function to check if search term matches as a complete word
  const matchesWholeWord = useCallback((text: string, searchTerm: string): boolean => {
    // If search term is empty, no match
    if (!searchTerm) return false;
    
    // Create a regex pattern that matches the search term as a whole word
    // Using word boundaries for word matching
    // For Arabic, we handle space-separated words
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Match if the search term:
    // 1. Is at the start of text followed by space or end
    // 2. Is after a space and followed by space or end
    // 3. Is the entire text
    const pattern = `(^|\\s)${escaped}(\\s|$)`;
    const regex = new RegExp(pattern);
    
    return regex.test(text);
  }, []);

  // Word search functionality - manual search only, supports multiple words
  const performWordSearch = useCallback((
    searchWord: string,
    ayahData: any[],
    setWordSearchResults: (results: any[]) => void,
    setIsSearchLoading: (loading: boolean) => void
  ) => {
    if (searchWord.trim().length >= 2 && ayahData.length > 0) {
      setIsSearchLoading(true);
      
      // Detect if user wants exact word matching (search ends with space)
      const exactWordMatch = searchWord.endsWith(' ') && searchWord.trim().length > 0;
      
      // Use setTimeout to allow UI to update with loading state
      setTimeout(() => {
        // Search for the full text phrase
        const normalizedSearchFull = normalizeArabic(searchWord.trim());
        const searchFullLower = searchWord.trim().toLowerCase();
        const results: any[] = [];
        
        ayahData.forEach(surahData => {
          surahData.verses?.forEach((verse: any) => {
            const arabicText = verse.text?.ar || '';
            const normalizedArabic = normalizeArabic(arabicText);
            const englishText = (verse.text?.en || '').toLowerCase();
            
            // Check if the full phrase matches
            let matchesArabic: boolean;
            let matchesEnglish: boolean;
            
            if (exactWordMatch) {
              // Use whole word matching when search ends with space
              matchesArabic = matchesWholeWord(normalizedArabic, normalizedSearchFull);
              matchesEnglish = matchesWholeWord(englishText, searchFullLower);
            } else {
              // Use substring matching for partial searches
              matchesArabic = normalizedArabic.includes(normalizedSearchFull);
              matchesEnglish = englishText.includes(searchFullLower);
            }
            
            if (matchesArabic || matchesEnglish) {
              results.push({
                surahNumber: surahData.number,
                surahName: typeof surahData.name === 'object' ? surahData.name.ar : surahData.name,
                surahNameEn: typeof surahData.name === 'object' ? surahData.name.en : (surahData.englishName || surahData.name),
                ayahNumber: verse.number,
                arabicText: verse.text?.ar,
                englishText: verse.text?.en,
                page: verse.page,
                juz: verse.juz
              });
            }
          });
        });
        
        setWordSearchResults(results);
        setIsSearchLoading(false);
      }, 100);
    } else {
      setWordSearchResults([]);
      setIsSearchLoading(false);
    }
  }, [normalizeArabic, matchesWholeWord]);

  // Navigate to surah and optionally to a specific ayah
  const handleGoToSurah = useCallback(async (
    searchSurah: string,
    searchAyah: string,
    selectedSurahAyahs: any[],
    setSearchSurah: (value: string) => void,
    setSearchAyah: (value: string) => void,
    setSearchOpen: (open: boolean) => void
  ) => {
    if (searchSurah) {
      const surahId = parseInt(searchSurah);
      
      // If ayah is selected, navigate to the page containing that ayah
      if (searchAyah && selectedSurahAyahs.length > 0) {
        const ayahNumber = parseInt(searchAyah);
        const ayahInfo = selectedSurahAyahs.find(v => v.number === ayahNumber);
        if (ayahInfo && ayahInfo.page) {
          isAyahNavigation.current = true;
          setCurrentPlayingAyah({ surah: surahId, ayah: ayahNumber });
          navigate(`/page/${ayahInfo.page}`);
        }
      } else {
        // Otherwise, navigate to the first page of the surah
        const firstPage = await getSurahFirstPage(surahId);
        navigate(`/page/${firstPage}`);
      }
      
      setSearchSurah('');
      setSearchAyah('');
      setSearchOpen(false);
    }
  }, [navigate, isAyahNavigation, setCurrentPlayingAyah]);

  // Navigate to juz, hezb, or quarter
  const handleGoToJuz = useCallback(async (
    searchJuz: string,
    searchJuzHezb: string,
    searchJuzQuarter: string,
    setSearchJuz: (value: string) => void,
    setSearchJuzHezb: (value: string) => void,
    setSearchJuzQuarter: (value: string) => void,
    setSearchOpen: (open: boolean) => void
  ) => {
    const juzNum = parseInt(searchJuz);
    console.log(`🎯 [handleGoToJuz] Navigating to Juz ${juzNum}, Hezb: ${searchJuzHezb}, Quarter: ${searchJuzQuarter}`);
    
    if (juzNum >= 1 && juzNum <= 30) {
      let targetPage;
      
      // Check if Quarter/Hezb were auto-populated (not manually changed by user)
      const expectedFirstHezb = (juzNum - 1) * 2 + 1;
      const expectedFirstQuarter = (expectedFirstHezb - 1) * 4 + 1;
      const isAutoPopulatedHezb = searchJuzHezb === expectedFirstHezb.toString();
      const isAutoPopulatedQuarter = searchJuzQuarter === expectedFirstQuarter.toString();
      
      // If quarter/hezb match auto-populated values, use getJuzFirstPage for accuracy
      // Otherwise, user manually selected a different quarter/hezb, so use their selection
      if (searchJuzQuarter && !isAutoPopulatedQuarter) {
        // User manually changed quarter - use quarter calculation
        const quarterNum = parseInt(searchJuzQuarter);
        targetPage = Math.floor(((quarterNum - 1) * 604) / 240) + 1;
        console.log(`🎯 [handleGoToJuz] Using quarter calculation (manually selected): Quarter ${quarterNum} -> Page ${targetPage}`);
      }
      else if (searchJuzHezb && !isAutoPopulatedHezb) {
        // User manually changed hezb - use hezb calculation
        const hezbNum = parseInt(searchJuzHezb);
        targetPage = Math.floor(((hezbNum - 1) * 604) / 60) + 1;
        console.log(`🎯 [handleGoToJuz] Using hezb calculation (manually selected): Hezb ${hezbNum} -> Page ${targetPage}`);
      }
      else {
        // Navigate to first page of juz (more accurate than quarter/hezb math)
        targetPage = await getJuzFirstPage(juzNum);
        console.log(`🎯 [handleGoToJuz] Using getJuzFirstPage (auto-populated or no quarter/hezb): Juz ${juzNum} -> Page ${targetPage}`);
      }
      
      console.log(`🎯 [handleGoToJuz] Final navigation target: page ${targetPage}`);
      navigate(`/page/${targetPage}`);
      setSearchJuz('');
      setSearchJuzHezb('');
      setSearchJuzQuarter('');
      setSearchOpen(false);
    }
  }, [navigate]);

  // Navigate to specific page number
  const handleGoToSearchPage = useCallback((
    searchPage: string,
    setSearchPage: (value: string) => void,
    setSearchOpen: (open: boolean) => void
  ) => {
    const pageNum = parseInt(searchPage);
    if (pageNum > 0 && pageNum <= 604) {
      navigate(`/page/${pageNum}`);
      setSearchPage('');
      setSearchOpen(false);
    }
  }, [navigate]);

  return {
    normalizeArabic,
    highlightText,
    performWordSearch,
    handleGoToSurah,
    handleGoToJuz,
    handleGoToSearchPage,
  };
}
