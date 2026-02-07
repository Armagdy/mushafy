import { useState, useEffect } from 'react';
import { surahs } from '@/data/surahs';
import { getPageSurahInfo, getAyahPage } from '@/lib/quran-mapping';

interface BookmarkPageMetadata {
  surahs: Record<number, string>;
  ayahs: Record<number, number>;
}

interface UseBookmarksReturn {
  // Bookmark states
  bookmarks: number[];
  memorizationBookmarks: number[];
  readingBookmarks: number[];
  
  // Metadata
  bookmarkPageSurahs: Record<number, string>;
  bookmarkPageAyahs: Record<number, number>;
  
  // Bookmark operations
  toggleBookmark: (page: number) => void;
  addMemorizationBookmark: (page: number) => void;
  removeMemorizationBookmark: (page: number) => void;
  addReadingBookmark: (page: number) => void;
  removeReadingBookmark: (page: number) => void;
  addBookmarkByType: (type: string, surahId: number, ayahNum: number) => Promise<void>;
  
  // Helper functions
  getSurahNameForPage: (page: number) => Promise<string>;
  getTotalBookmarks: () => number;
  isBookmarked: (page: number, type?: 'bookmark' | 'memorization' | 'reading') => boolean;
}

/**
 * Custom hook for managing Quran bookmarks
 * Handles three types of bookmarks: quick bookmarks, memorization bookmarks, and reading bookmarks
 * Persists bookmarks and metadata to localStorage
 */
export function useBookmarks(language: 'ar' | 'en'): UseBookmarksReturn {
  // Quick bookmarks (amber)
  const [bookmarks, setBookmarks] = useState<number[]>(() => {
    const saved = localStorage.getItem('quran-bookmark-bookmarks');
    return saved ? JSON.parse(saved) : [];
  });

  // Memorization bookmarks (emerald)
  const [memorizationBookmarks, setMemorizationBookmarks] = useState<number[]>(() => {
    const saved = localStorage.getItem('quran-memorization-bookmarks');
    return saved ? JSON.parse(saved) : [];
  });

  // Reading bookmarks (blue)
  const [readingBookmarks, setReadingBookmarks] = useState<number[]>(() => {
    const saved = localStorage.getItem('quran-reading-bookmarks');
    return saved ? JSON.parse(saved) : [];
  });

  // Bookmark page metadata (surah names and ayah numbers for display)
  const [bookmarkPageSurahs, setBookmarkPageSurahs] = useState<Record<number, string>>(() => {
    const saved = localStorage.getItem('quran-bookmark-surahs');
    return saved ? JSON.parse(saved) : {};
  });

  const [bookmarkPageAyahs, setBookmarkPageAyahs] = useState<Record<number, number>>(() => {
    const saved = localStorage.getItem('quran-bookmark-ayahs');
    return saved ? JSON.parse(saved) : {};
  });

  // Persist bookmarks to localStorage
  useEffect(() => {
    localStorage.setItem('quran-bookmark-bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('quran-memorization-bookmarks', JSON.stringify(memorizationBookmarks));
  }, [memorizationBookmarks]);

  useEffect(() => {
    localStorage.setItem('quran-reading-bookmarks', JSON.stringify(readingBookmarks));
  }, [readingBookmarks]);

  useEffect(() => {
    localStorage.setItem('quran-bookmark-surahs', JSON.stringify(bookmarkPageSurahs));
  }, [bookmarkPageSurahs]);

  useEffect(() => {
    localStorage.setItem('quran-bookmark-ayahs', JSON.stringify(bookmarkPageAyahs));
  }, [bookmarkPageAyahs]);

  // Get surah name and ayah for a page
  const getSurahNameForPage = async (page: number): Promise<string> => {
    if (bookmarkPageSurahs[page]) {
      return bookmarkPageSurahs[page];
    }
    
    const surahInfo = await getPageSurahInfo(page);
    if (surahInfo) {
      const surah = surahs.find(s => s.id === surahInfo.surahId);
      if (surah) {
        const name = language === 'ar' ? surah.name : surah.englishName;
        setBookmarkPageSurahs(prev => ({ ...prev, [page]: name }));
        setBookmarkPageAyahs(prev => ({ ...prev, [page]: surahInfo.ayah }));
        return name;
      }
    }
    return '';
  };

  // Load surah names for all bookmarks when language changes
  useEffect(() => {
    const loadSurahNames = async () => {
      const allPages = [...new Set([...bookmarks, ...memorizationBookmarks, ...readingBookmarks])];
      for (const page of allPages) {
        await getSurahNameForPage(page);
      }
    };
    loadSurahNames();
  }, [bookmarks, memorizationBookmarks, readingBookmarks, language]);

  // Toggle quick bookmark
  const toggleBookmark = (page: number) => {
    if (bookmarks.includes(page)) {
      // Remove bookmark
      const updated = bookmarks.filter(p => p !== page);
      setBookmarks(updated);
    } else {
      // Add bookmark
      const updated = [...bookmarks, page].sort((a, b) => a - b);
      setBookmarks(updated);
    }
  };

  // Add memorization bookmark
  const addMemorizationBookmark = (page: number) => {
    if (!memorizationBookmarks.includes(page)) {
      const updated = [...memorizationBookmarks, page].sort((a, b) => a - b);
      setMemorizationBookmarks(updated);
    }
  };

  // Remove memorization bookmark
  const removeMemorizationBookmark = (page: number) => {
    const updated = memorizationBookmarks.filter(p => p !== page);
    setMemorizationBookmarks(updated);
  };

  // Add reading bookmark
  const addReadingBookmark = (page: number) => {
    if (!readingBookmarks.includes(page)) {
      const updated = [...readingBookmarks, page].sort((a, b) => a - b);
      setReadingBookmarks(updated);
    }
  };

  // Remove reading bookmark
  const removeReadingBookmark = (page: number) => {
    const updated = readingBookmarks.filter(p => p !== page);
    setReadingBookmarks(updated);
  };

  // Add bookmark by type (for bookmark dialog)
  const addBookmarkByType = async (type: string, surahId: number, ayahNum: number) => {
    const targetPage = await getAyahPage(surahId, ayahNum);
    if (!targetPage) return;
    
    if (type === 'bookmark') {
      toggleBookmark(targetPage);
    } else if (type === 'memorization') {
      addMemorizationBookmark(targetPage);
    } else if (type === 'reading') {
      addReadingBookmark(targetPage);
    }
  };

  // Get total bookmark count (all types)
  const getTotalBookmarks = (): number => {
    return new Set([...bookmarks, ...memorizationBookmarks, ...readingBookmarks]).size;
  };

  // Check if a page is bookmarked (optionally filter by type)
  const isBookmarked = (page: number, type?: 'bookmark' | 'memorization' | 'reading'): boolean => {
    if (type === 'bookmark') return bookmarks.includes(page);
    if (type === 'memorization') return memorizationBookmarks.includes(page);
    if (type === 'reading') return readingBookmarks.includes(page);
    // Check all types if no type specified
    return bookmarks.includes(page) || memorizationBookmarks.includes(page) || readingBookmarks.includes(page);
  };

  return {
    // States
    bookmarks,
    memorizationBookmarks,
    readingBookmarks,
    bookmarkPageSurahs,
    bookmarkPageAyahs,
    
    // Operations
    toggleBookmark,
    addMemorizationBookmark,
    removeMemorizationBookmark,
    addReadingBookmark,
    removeReadingBookmark,
    addBookmarkByType,
    
    // Helpers
    getSurahNameForPage,
    getTotalBookmarks,
    isBookmarked,
  };
}
