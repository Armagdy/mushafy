import { useState, useEffect } from 'react';
import { surahs } from '@/data/surahs';
import { getPageSurahInfo, getAyahPage } from '@/lib/quran-mapping';

interface BookmarkPageMetadata {
  surahs: Record<number, string>;
  ayahs: Record<number, number>;
}

interface BookmarkTimestamps {
  created: Record<number, number>; // page -> timestamp
  lastEdited: Record<number, number>; // page -> timestamp
}

interface UseBookmarksReturn {
  // Bookmark states
  bookmarks: number[];
  memorizationBookmarks: number[];
  readingBookmarks: number[];
  
  // Metadata
  bookmarkPageSurahs: Record<number, string>;
  bookmarkPageAyahs: Record<number, number>;
  bookmarkPageSurahIds: Record<number, number>;
  
  // Timestamps
  bookmarkTimestamps: BookmarkTimestamps;
  memorizationTimestamps: BookmarkTimestamps;
  readingTimestamps: BookmarkTimestamps;
  
  // Bookmark operations
  toggleBookmark: (page: number) => void;
  addMemorizationBookmark: (page: number) => void;
  removeMemorizationBookmark: (page: number) => void;
  addReadingBookmark: (page: number) => void;
  removeReadingBookmark: (page: number) => void;
  addBookmarkByType: (type: string, surahId: number, ayahNum: number) => Promise<void>;
  updateBookmark: (oldPage: number, newPage: number, surahId: number, ayahNum: number, type: string) => Promise<void>;
  
  // Helper functions
  getSurahNameForPage: (page: number) => Promise<string>;
  getTotalBookmarks: () => number;
  isBookmarked: (page: number, type?: 'bookmark' | 'memorization' | 'reading') => boolean;
  getLastBookmark: () => { page: number; type: 'bookmark' | 'memorization' | 'reading' } | null;
  updateLastBookmark: (newPage: number, surahId: number, ayahNum: number) => Promise<boolean>;
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

  const [bookmarkPageSurahIds, setBookmarkPageSurahIds] = useState<Record<number, number>>(() => {
    const saved = localStorage.getItem('quran-bookmark-surah-ids');
    return saved ? JSON.parse(saved) : {};
  });

  // Bookmark timestamps
  const [bookmarkTimestamps, setBookmarkTimestamps] = useState<BookmarkTimestamps>(() => {
    const saved = localStorage.getItem('quran-bookmark-timestamps');
    return saved ? JSON.parse(saved) : { created: {}, lastEdited: {} };
  });

  const [memorizationTimestamps, setMemorizationTimestamps] = useState<BookmarkTimestamps>(() => {
    const saved = localStorage.getItem('quran-memorization-timestamps');
    return saved ? JSON.parse(saved) : { created: {}, lastEdited: {} };
  });

  const [readingTimestamps, setReadingTimestamps] = useState<BookmarkTimestamps>(() => {
    const saved = localStorage.getItem('quran-reading-timestamps');
    return saved ? JSON.parse(saved) : { created: {}, lastEdited: {} };
  });

  // Persist bookmarks to localStorage and notify other components
  useEffect(() => {
    localStorage.setItem('quran-bookmark-bookmarks', JSON.stringify(bookmarks));
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('quran-bookmarks-changed', {
      detail: { type: 'bookmark', bookmarks }
    }));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('quran-memorization-bookmarks', JSON.stringify(memorizationBookmarks));
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('quran-bookmarks-changed', {
      detail: { type: 'memorization', bookmarks: memorizationBookmarks }
    }));
  }, [memorizationBookmarks]);

  useEffect(() => {
    localStorage.setItem('quran-reading-bookmarks', JSON.stringify(readingBookmarks));
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('quran-bookmarks-changed', {
      detail: { type: 'reading', bookmarks: readingBookmarks }
    }));
  }, [readingBookmarks]);

  useEffect(() => {
    localStorage.setItem('quran-bookmark-surahs', JSON.stringify(bookmarkPageSurahs));
  }, [bookmarkPageSurahs]);

  useEffect(() => {
    localStorage.setItem('quran-bookmark-ayahs', JSON.stringify(bookmarkPageAyahs));
  }, [bookmarkPageAyahs]);

  useEffect(() => {
    localStorage.setItem('quran-bookmark-surah-ids', JSON.stringify(bookmarkPageSurahIds));
  }, [bookmarkPageSurahIds]);

  // Persist bookmark timestamps to localStorage
  useEffect(() => {
    localStorage.setItem('quran-bookmark-timestamps', JSON.stringify(bookmarkTimestamps));
    // Dispatch event to notify other hook instances about timestamp changes
    window.dispatchEvent(new CustomEvent('quran-bookmarks-changed', {
      detail: { type: 'bookmark-timestamps', timestamps: bookmarkTimestamps }
    }));
  }, [bookmarkTimestamps]);

  useEffect(() => {
    localStorage.setItem('quran-memorization-timestamps', JSON.stringify(memorizationTimestamps));
    // Dispatch event to notify other hook instances about timestamp changes
    window.dispatchEvent(new CustomEvent('quran-bookmarks-changed', {
      detail: { type: 'memorization-timestamps', timestamps: memorizationTimestamps }
    }));
  }, [memorizationTimestamps]);

  useEffect(() => {
    localStorage.setItem('quran-reading-timestamps', JSON.stringify(readingTimestamps));
    // Dispatch event to notify other hook instances about timestamp changes
    window.dispatchEvent(new CustomEvent('quran-bookmarks-changed', {
      detail: { type: 'reading-timestamps', timestamps: readingTimestamps }
    }));
  }, [readingTimestamps]);

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
        setBookmarkPageSurahIds(prev => ({ ...prev, [page]: surahInfo.surahId }));
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
      // Remove timestamps
      setBookmarkTimestamps(prev => {
        const { created, lastEdited } = prev;
        const newCreated = { ...created };
        const newLastEdited = { ...lastEdited };
        delete newCreated[page];
        delete newLastEdited[page];
        return { created: newCreated, lastEdited: newLastEdited };
      });
    } else {
      // Add bookmark
      const updated = [...bookmarks, page].sort((a, b) => a - b);
      setBookmarks(updated);
      // Set creation timestamp
      const now = Date.now();
      setBookmarkTimestamps(prev => ({
        created: { ...prev.created, [page]: now },
        lastEdited: { ...prev.lastEdited, [page]: now }
      }));
    }
  };

  // Add memorization bookmark
  const addMemorizationBookmark = (page: number) => {
    if (!memorizationBookmarks.includes(page)) {
      const updated = [...memorizationBookmarks, page].sort((a, b) => a - b);
      setMemorizationBookmarks(updated);
      // Set creation timestamp
      const now = Date.now();
      setMemorizationTimestamps(prev => ({
        created: { ...prev.created, [page]: now },
        lastEdited: { ...prev.lastEdited, [page]: now }
      }));
    }
  };

  // Remove memorization bookmark
  const removeMemorizationBookmark = (page: number) => {
    const updated = memorizationBookmarks.filter(p => p !== page);
    setMemorizationBookmarks(updated);
    // Remove timestamps
    setMemorizationTimestamps(prev => {
      const { created, lastEdited } = prev;
      const newCreated = { ...created };
      const newLastEdited = { ...lastEdited };
      delete newCreated[page];
      delete newLastEdited[page];
      return { created: newCreated, lastEdited: newLastEdited };
    });
  };

  // Add reading bookmark
  const addReadingBookmark = (page: number) => {
    if (!readingBookmarks.includes(page)) {
      const updated = [...readingBookmarks, page].sort((a, b) => a - b);
      setReadingBookmarks(updated);
      // Set creation timestamp
      const now = Date.now();
      setReadingTimestamps(prev => ({
        created: { ...prev.created, [page]: now },
        lastEdited: { ...prev.lastEdited, [page]: now }
      }));
    }
  };

  // Remove reading bookmark
  const removeReadingBookmark = (page: number) => {
    const updated = readingBookmarks.filter(p => p !== page);
    setReadingBookmarks(updated);
    // Remove timestamps
    setReadingTimestamps(prev => {
      const { created, lastEdited } = prev;
      const newCreated = { ...created };
      const newLastEdited = { ...lastEdited };
      delete newCreated[page];
      delete newLastEdited[page];
      return { created: newCreated, lastEdited: newLastEdited };
    });
  };

  // Add bookmark by type (for bookmark dialog)
  const addBookmarkByType = async (type: string, surahId: number, ayahNum: number) => {
    console.log('📚 addBookmarkByType called with:', {
      type,
      surahId,
      ayahNum
    });
    
    const targetPage = await getAyahPage(surahId, ayahNum);
    
    console.log('📍 Calculated targetPage:', {
      type,
      surahId,
      ayahNum,
      targetPage
    });
    
    if (!targetPage) return;
    
    // Get surah name for the selected ayah (not the first ayah on the page)
    const surah = surahs.find(s => s.id === surahId);
    if (surah) {
      const name = language === 'ar' ? surah.name : surah.englishName;
      // Save custom metadata for this bookmark with the user-selected ayah
      setBookmarkPageSurahs(prev => ({ ...prev, [targetPage]: name }));
      setBookmarkPageAyahs(prev => ({ ...prev, [targetPage]: ayahNum }));
      setBookmarkPageSurahIds(prev => ({ ...prev, [targetPage]: surahId }));
      console.log('💾 Saved custom metadata:', { page: targetPage, surahName: name, ayah: ayahNum, surahId });
    }
    
    if (type === 'bookmark') {
      toggleBookmark(targetPage);
    } else if (type === 'memorization') {
      addMemorizationBookmark(targetPage);
    } else if (type === 'reading') {
      addReadingBookmark(targetPage);
    }
  };

  // Update bookmark to new page
  const updateBookmark = async (oldPage: number, newPage: number, surahId: number, ayahNum: number, type: string) => {
    console.log('🔄 updateBookmark called with:', {
      oldPage,
      newPage,
      surahId,
      ayahNum,
      type
    });

    // Get surah info for new page
    const surah = surahs.find(s => s.id === surahId);
    if (!surah) return;

    const name = language === 'ar' ? surah.name : surah.englishName;
    const targetPage = newPage; // Use the selected page directly from dropdown
    
    if (!targetPage) return;

    // Update metadata for new page
    setBookmarkPageSurahs(prev => {
      const updated = { ...prev };
      delete updated[oldPage];
      updated[targetPage] = name;
      return updated;
    });

    setBookmarkPageAyahs(prev => {
      const updated = { ...prev };
      delete updated[oldPage];
      updated[targetPage] = ayahNum;
      return updated;
    });

    setBookmarkPageSurahIds(prev => {
      const updated = { ...prev };
      delete updated[oldPage];
      updated[targetPage] = surahId;
      return updated;
    });

    const now = Date.now();

    // Move bookmark from old page to new page
    if (type === 'bookmark') {
      setBookmarks(prev => {
        const updated = prev.filter(p => p !== oldPage);
        if (!updated.includes(targetPage)) {
          updated.push(targetPage);
          updated.sort((a, b) => a - b);
        }
        return updated;
      });
      // Update timestamps - preserve created timestamp, update lastEdited
      setBookmarkTimestamps(prev => {
        const newCreated = { ...prev.created };
        const newLastEdited = { ...prev.lastEdited };
        const createdTime = prev.created[oldPage] || now;
        delete newCreated[oldPage];
        delete newLastEdited[oldPage];
        newCreated[targetPage] = createdTime;
        newLastEdited[targetPage] = now;
        return { created: newCreated, lastEdited: newLastEdited };
      });
    } else if (type === 'memorization') {
      setMemorizationBookmarks(prev => {
        const updated = prev.filter(p => p !== oldPage);
        if (!updated.includes(targetPage)) {
          updated.push(targetPage);
          updated.sort((a, b) => a - b);
        }
        return updated;
      });
      // Update timestamps
      setMemorizationTimestamps(prev => {
        const newCreated = { ...prev.created };
        const newLastEdited = { ...prev.lastEdited };
        const createdTime = prev.created[oldPage] || now;
        delete newCreated[oldPage];
        delete newLastEdited[oldPage];
        newCreated[targetPage] = createdTime;
        newLastEdited[targetPage] = now;
        return { created: newCreated, lastEdited: newLastEdited };
      });
    } else if (type === 'reading') {
      setReadingBookmarks(prev => {
        const updated = prev.filter(p => p !== oldPage);
        if (!updated.includes(targetPage)) {
          updated.push(targetPage);
          updated.sort((a, b) => a - b);
        }
        return updated;
      });
      // Update timestamps
      setReadingTimestamps(prev => {
        const newCreated = { ...prev.created };
        const newLastEdited = { ...prev.lastEdited };
        const createdTime = prev.created[oldPage] || now;
        delete newCreated[oldPage];
        delete newLastEdited[oldPage];
        newCreated[targetPage] = createdTime;
        newLastEdited[targetPage] = now;
        return { created: newCreated, lastEdited: newLastEdited };
      });
    }

    console.log('💾 Bookmark updated from page', oldPage, 'to page', targetPage);
  };

  // Get total bookmark count (all types)
  const getTotalBookmarks = (): number => {
    return bookmarks.length + memorizationBookmarks.length + readingBookmarks.length;
  };

  // Check if a page is bookmarked (optionally filter by type)
  const isBookmarked = (page: number, type?: 'bookmark' | 'memorization' | 'reading'): boolean => {
    if (type === 'bookmark') return bookmarks.includes(page);
    if (type === 'memorization') return memorizationBookmarks.includes(page);
    if (type === 'reading') return readingBookmarks.includes(page);
    // Check all types if no type specified
    return bookmarks.includes(page) || memorizationBookmarks.includes(page) || readingBookmarks.includes(page);
  };

  // Listen for bookmark changes from other components/pages
  useEffect(() => {
    const handleBookmarkChange = () => {
      // Reload bookmarks from localStorage when they change in another component
      const savedBookmarks = localStorage.getItem('quran-bookmark-bookmarks');
      const savedMemorization = localStorage.getItem('quran-memorization-bookmarks');
      const savedReading = localStorage.getItem('quran-reading-bookmarks');
      const savedBookmarkTimestamps = localStorage.getItem('quran-bookmark-timestamps');
      const savedMemorizationTimestamps = localStorage.getItem('quran-memorization-timestamps');
      const savedReadingTimestamps = localStorage.getItem('quran-reading-timestamps');
      
      if (savedBookmarks) {
        const parsed = JSON.parse(savedBookmarks);
        // Only update if different (compare stringified to avoid unnecessary re-renders)
        if (JSON.stringify(parsed) !== JSON.stringify(bookmarks)) {
          setBookmarks(parsed);
        }
      }
      if (savedMemorization) {
        const parsed = JSON.parse(savedMemorization);
        if (JSON.stringify(parsed) !== JSON.stringify(memorizationBookmarks)) {
          setMemorizationBookmarks(parsed);
        }
      }
      if (savedReading) {
        const parsed = JSON.parse(savedReading);
        if (JSON.stringify(parsed) !== JSON.stringify(readingBookmarks)) {
          setReadingBookmarks(parsed);
        }
      }
      
      // Sync timestamps as well to keep last bookmark info accurate
      if (savedBookmarkTimestamps) {
        const parsed = JSON.parse(savedBookmarkTimestamps);
        if (JSON.stringify(parsed) !== JSON.stringify(bookmarkTimestamps)) {
          setBookmarkTimestamps(parsed);
        }
      }
      if (savedMemorizationTimestamps) {
        const parsed = JSON.parse(savedMemorizationTimestamps);
        if (JSON.stringify(parsed) !== JSON.stringify(memorizationTimestamps)) {
          setMemorizationTimestamps(parsed);
        }
      }
      if (savedReadingTimestamps) {
        const parsed = JSON.parse(savedReadingTimestamps);
        if (JSON.stringify(parsed) !== JSON.stringify(readingTimestamps)) {
          setReadingTimestamps(parsed);
        }
      }
    };

    window.addEventListener('quran-bookmarks-changed' as any, handleBookmarkChange);
    
    return () => {
      window.removeEventListener('quran-bookmarks-changed' as any, handleBookmarkChange);
    };
  }, [bookmarks, memorizationBookmarks, readingBookmarks, bookmarkTimestamps, memorizationTimestamps, readingTimestamps]);

  // Get the last edited/created bookmark across all types
  const getLastBookmark = (): { page: number; type: 'bookmark' | 'memorization' | 'reading' } | null => {
    let latestBookmark: { page: number; type: 'bookmark' | 'memorization' | 'reading'; timestamp: number } | null = null;

    // Check quick bookmarks
    bookmarks.forEach((page) => {
      const timestamp = bookmarkTimestamps.lastEdited[page] || bookmarkTimestamps.created[page] || 0;
      if (!latestBookmark || timestamp > latestBookmark.timestamp) {
        latestBookmark = { page, type: 'bookmark', timestamp };
      }
    });

    // Check memorization bookmarks
    memorizationBookmarks.forEach((page) => {
      const timestamp = memorizationTimestamps.lastEdited[page] || memorizationTimestamps.created[page] || 0;
      if (!latestBookmark || timestamp > latestBookmark.timestamp) {
        latestBookmark = { page, type: 'memorization', timestamp };
      }
    });

    // Check reading bookmarks
    readingBookmarks.forEach((page) => {
      const timestamp = readingTimestamps.lastEdited[page] || readingTimestamps.created[page] || 0;
      if (!latestBookmark || timestamp > latestBookmark.timestamp) {
        latestBookmark = { page, type: 'reading', timestamp };
      }
    });

    return latestBookmark ? { page: latestBookmark.page, type: latestBookmark.type } : null;
  };

  // Update the last edited/created bookmark to a new page
  const updateLastBookmark = async (newPage: number, surahId: number, ayahNum: number): Promise<boolean> => {
    const lastBookmark = getLastBookmark();
    if (!lastBookmark) {
      return false;
    }

    // Update the bookmark to the new page
    await updateBookmark(lastBookmark.page, newPage, surahId, ayahNum, lastBookmark.type);
    return true;
  };

  return {
    // States
    bookmarks,
    memorizationBookmarks,
    readingBookmarks,
    bookmarkPageSurahs,
    bookmarkPageAyahs,
    bookmarkPageSurahIds,
    
    // Timestamps
    bookmarkTimestamps,
    memorizationTimestamps,
    readingTimestamps,
    
    // Operations
    toggleBookmark,
    addMemorizationBookmark,
    removeMemorizationBookmark,
    addReadingBookmark,
    removeReadingBookmark,
    addBookmarkByType,
    updateBookmark,
    
    // Helpers
    getSurahNameForPage,
    getTotalBookmarks,
    isBookmarked,
    getLastBookmark,
    updateLastBookmark,
  };
}
