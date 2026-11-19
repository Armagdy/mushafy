import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSurahFirstPage, getJuzFirstPage } from '@/lib/quran-mapping';
import { findArabicMatch } from '@/lib/arabic-search';
import { quranSearch } from '@/lib/quran-search';

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

  // Highlight the searched word in text (Arabic match is Uthmani-script aware
  // and maps exactly onto the original text)
  const highlightText = useCallback((text: string, searchWord: string, isArabic: boolean) => {
    const query = searchWord.trim();
    if (!query || !text) return text;

    if (isArabic) {
      const match = findArabicMatch(text, query);
      if (!match) return text;
      return (
        <>
          {text.slice(0, match.start)}
          <span className="bg-yellow-200 dark:bg-yellow-600 font-semibold rounded px-0.5">
            {text.slice(match.start, match.end)}
          </span>
          {text.slice(match.end)}
        </>
      );
    }

    const matchIndex = text.toLowerCase().indexOf(query.toLowerCase());
    if (matchIndex === -1) return text;
    return (
      <>
        {text.slice(0, matchIndex)}
        <span className="bg-yellow-200 dark:bg-yellow-600 font-semibold rounded px-0.5">
          {text.slice(matchIndex, matchIndex + query.length)}
        </span>
        {text.slice(matchIndex + query.length)}
      </>
    );
  }, []);

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

  // Word search functionality - manual search only, supports multiple words.
  // Runs in the Web Worker so the UI thread (and typing) is never blocked.
  const performWordSearch = useCallback((
    searchWord: string,
    _ayahData: any[],
    setWordSearchResults: (results: any[]) => void,
    setIsSearchLoading: (loading: boolean) => void
  ) => {
    const query = searchWord.trim();

    if (query.length >= 2) {
      setIsSearchLoading(true);

      // Detect if user wants exact word matching (search ends with space)
      const exactWordMatch = searchWord.endsWith(' ') && query.length > 0;

      quranSearch.search(query, { wholeWord: exactWordMatch, includeEnglish: true })
        .then(outcome => {
          setWordSearchResults(outcome.results);
          setIsSearchLoading(false);
        })
        .catch(() => {
          setWordSearchResults([]);
          setIsSearchLoading(false);
        });
    } else {
      setWordSearchResults([]);
      setIsSearchLoading(false);
    }
  }, []);

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
