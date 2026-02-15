import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cacheTafseer, getCachedTafseer } from '@/lib/tafseer-cache';

export interface TafseerInfo {
  id: number;
  name: string;
  language: string;
  author: string;
  book_name: string;
}

export interface TafseerText {
  tafseer_id: number;
  tafseer_name: string;
  ayah_url: string;
  ayah_number: number;
  text: string;
}

// Primary API: Quran.com (HTTPS, more tafseers, better maintained)
const QURAN_COM_API_BASE = 'https://api.quran.com/api/v4';
// Fallback API: HTTP endpoint (in case Quran.com is unavailable)
const TAFSEER_API_BASE = 'http://api.quran-tafseer.com';

// Arabic names mapping for Arabic tafseers from Quran.com API
const ARABIC_TAFSEER_NAMES: Record<number, string> = {
  16: 'التفسير الميسر',
  93: 'التفسير الوسيط',
  164: 'التفسير الوسيط لطنطاوي',
  14: 'تفسير ابن كثير',
  15: 'تفسير الطبري',
  90: 'تفسير القرطبي',
  91: 'تفسير السعدي',
  94: 'تفسير البغوي',
  17: 'تفسير السعدي',
  169: 'تفسير ابن كثير',
  166: 'تفسير القرطبي',
};

// Fallback tafseer list in case both APIs are unavailable
const FALLBACK_TAFSEERS: TafseerInfo[] = [
  { id: 16, name: 'التفسير الميسر', language: 'ar', author: 'نخبة من العلماء', book_name: 'التفسير الميسر' },
  { id: 93, name: 'تفسير الجلالين', language: 'ar', author: 'جلال الدين المحلي و السيوطي', book_name: 'تفسير الجلالين' },
  { id: 17, name: 'تفسير السعدي', language: 'ar', author: 'عبد الرحمن بن ناصر السعدي', book_name: 'تيسير الكريم الرحمن' },
  { id: 169, name: 'تفسير ابن كثير', language: 'ar', author: 'ابن كثير', book_name: 'تفسير القرآن العظيم' },
  { id: 164, name: 'تفسير الوسيط لطنطاوي', language: 'ar', author: 'محمد سيد طنطاوي', book_name: 'التفسير الوسيط' },
  { id: 94, name: 'تفسير البغوي', language: 'ar', author: 'البغوي', book_name: 'معالم التنزيل' },
  { id: 166, name: 'تفسير القرطبي', language: 'ar', author: 'القرطبي', book_name: 'الجامع لأحكام القرآن' },
  { id: 15, name: 'تفسير الطبري', language: 'ar', author: 'الطبري', book_name: 'جامع البيان' },
  { id: 171, name: 'Arberry', language: 'en', author: 'A. J. Arberry', book_name: 'The Koran Interpreted' },
  { id: 206, name: 'Yusuf Ali', language: 'en', author: 'Abdullah Yusuf Ali', book_name: 'The Holy Quran' },
];

export function useTafseer() {
  const { language } = useLanguage();
  const [tafseers, setTafseers] = useState<TafseerInfo[]>(FALLBACK_TAFSEERS);
  const [selectedTafseerId, setSelectedTafseerId] = useState<number | null>(null);
  const [tafseerText, setTafseerText] = useState<TafseerText | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available tafseers list on mount
  useEffect(() => {
    const fetchTafseers = async () => {
      try {
        // Try Quran.com API first - use language parameter (arabic/english)
        const languageName = language === 'ar' ? 'arabic' : 'english';
        const response = await fetch(`${QURAN_COM_API_BASE}/resources/tafsirs`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Transform Quran.com API response to our TafseerInfo format
        // Filter on the language_name field in the response
        if (data && data.tafsirs && Array.isArray(data.tafsirs) && data.tafsirs.length > 0) {
          const transformedTafseers: TafseerInfo[] = data.tafsirs
            .filter((t: any) => t.language_name === languageName)
            .map((t: any) => {
              // Use Arabic name mapping for Arabic tafseers when interface is in Arabic
              const displayName = (language === 'ar' && ARABIC_TAFSEER_NAMES[t.id]) 
                ? ARABIC_TAFSEER_NAMES[t.id]
                : (t.translated_name?.name || t.name);
              
              return {
                id: t.id,
                name: displayName,
                language: t.language_name || languageName,
                author: t.author_name || '',
                book_name: t.name || '',
              };
            });
          setTafseers(transformedTafseers);
        }
        
        // Auto-select a tafseer based on current language
        const savedTafseerId = localStorage.getItem('quran-selected-tafseer-id');
        if (savedTafseerId) {
          setSelectedTafseerId(parseInt(savedTafseerId));
        } else {
          // Default tafseer: ID 16 (التفسير الميسر) for Arabic, ID 171 (Arberry) for English
          const defaultId = language === 'ar' ? 16 : 171;
          setSelectedTafseerId(defaultId);
        }
      } catch (err) {
        console.warn('Unable to fetch tafseers from Quran.com API, using fallback data:', err);
        // Use fallback data - already set in useState
        // Auto-select default tafseer
        const savedTafseerId = localStorage.getItem('quran-selected-tafseer-id');
        if (savedTafseerId) {
          setSelectedTafseerId(parseInt(savedTafseerId));
        } else {
          const defaultId = language === 'ar' ? 16 : 171;
          setSelectedTafseerId(defaultId);
        }
      }
    };

    fetchTafseers();
  }, [language]); // Refetch when language changes

  // Save selected tafseer to localStorage when it changes
  useEffect(() => {
    if (selectedTafseerId !== null) {
      localStorage.setItem('quran-selected-tafseer-id', selectedTafseerId.toString());
    }
  }, [selectedTafseerId]);

  // Fetch tafseer text for a specific ayah
  const fetchTafseerForAyah = async (surahNumber: number, ayahNumber: number) => {
    if (selectedTafseerId === null) {
      setError('Please select a tafseer first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check cache first for offline support
      const cached = await getCachedTafseer(selectedTafseerId, surahNumber, ayahNumber);
      if (cached) {
        console.log('Tafseer loaded from cache');
        setTafseerText({
          tafseer_id: selectedTafseerId,
          tafseer_name: cached.tafseer_name,
          ayah_url: '',
          ayah_number: ayahNumber,
          text: cached.text,
        });
        setIsLoading(false);
        return;
      }

      // Try Quran.com API first
      const response = await fetch(
        `${QURAN_COM_API_BASE}/tafsirs/${selectedTafseerId}/by_ayah/${surahNumber}:${ayahNumber}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform Quran.com API response to our TafseerText format
      // Strip HTML tags from the text for clean display
      const cleanText = data.tafsir?.text?.replace(/<[^>]*>/g, '') || '';
      const tafseerName = data.tafsir?.resource_name || '';
      
      const transformedData: TafseerText = {
        tafseer_id: data.tafsir?.resource_id || selectedTafseerId,
        tafseer_name: tafseerName,
        ayah_url: '',
        ayah_number: ayahNumber,
        text: cleanText,
      };
      
      // Cache for offline use
      if (cleanText) {
        await cacheTafseer(selectedTafseerId, tafseerName, surahNumber, ayahNumber, cleanText);
        console.log('Tafseer cached for offline use');
      }
      
      setTafseerText(transformedData);
    } catch (err) {
      console.error('Error fetching tafseer from Quran.com:', err);
      
      // Fallback to old API
      try {
        console.log('Trying fallback API...');
        const response = await fetch(
          `${TAFSEER_API_BASE}/tafseer/${selectedTafseerId}/${surahNumber}/${ayahNumber}`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: TafseerText = await response.json();
        
        // Cache for offline use
        if (data.text) {
          await cacheTafseer(selectedTafseerId, data.tafseer_name || '', surahNumber, ayahNumber, data.text);
          console.log('Tafseer cached from fallback API');
        }
        
        setTafseerText(data);
      } catch (fallbackErr) {
        console.error('Error fetching tafseer from fallback API:', fallbackErr);
        // Check if we're offline
        if (!navigator.onLine) {
          setError('You are offline. This tafseer has not been cached yet. View it while online first.');
        } else {
          const errorMessage = fallbackErr instanceof Error ? fallbackErr.message : 'Failed to load tafseer';
          setError(`Unable to load tafseer. ${errorMessage}. Please try again later.`);
        }
        setTafseerText(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Get tafseer info by language
  const getTafseersByLanguage = (lang: string) => {
    return tafseers.filter(t => t.language === lang);
  };

  // Get currently selected tafseer info
  const selectedTafseerInfo = tafseers.find(t => t.id === selectedTafseerId) || null;

  return {
    tafseers,
    selectedTafseerId,
    setSelectedTafseerId,
    selectedTafseerInfo,
    tafseerText,
    isLoading,
    error,
    fetchTafseerForAyah,
    getTafseersByLanguage,
  };
}
