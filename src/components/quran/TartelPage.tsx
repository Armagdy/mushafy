import { useEffect, useState, useRef, memo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { surahs } from '@/data/surahs';
import { loadCachedFont } from '@/lib/font-cache';

interface Word {
  word_id: number;
  position: number;
  text: string;
  surah: number;
  ayah: number;
  verse_key: string;
  location: string;
}

interface Line {
  line_number: number;
  line_type: 'ayah' | 'surah_name' | 'basmallah';
  is_centered: boolean;
  words?: Word[];
  surah_number?: number;
}

interface PageData {
  page_number: number;
  lines: Line[];
}

interface QuranData {
  pages: PageData[];
  total_pages: number;
}

interface TartelPageProps {
  pageNumber: number;
  onClick?: () => void;
  className?: string;
  onAyahSelect?: (surah: number, ayah: number) => void;
  currentPlayingAyah?: { surah: number; ayah: number } | null;
  mushafType?: 'tarteel' | 'tajweed';
}

const TartelPage = memo(({ pageNumber, onClick, className = '', onAyahSelect, currentPlayingAyah, mushafType = 'tarteel' }: TartelPageProps) => {
  const { language, t, isRTL } = useLanguage();
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hoveredAyah, setHoveredAyah] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Function to remove Arabic diacritics (tashkil)
  const removeTashkil = (text: string): string => {
    // Remove all Arabic diacritical marks (U+064B to U+065F, U+0670, U+06D6 to U+06ED)
    return text.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
  };
  
  // Long-press detection refs
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);
  const isSwipingRef = useRef(false); // Track if user is performing a swipe gesture
  const [fontLoadTrigger, setFontLoadTrigger] = useState(0);
  
  // Detect if device has touch capability
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Load page data
  useEffect(() => {
    let mounted = true;

    const loadPageData = async () => {
      try {
        const response = await fetch('/assets/quran_pages_lines.json');
        if (!response.ok) {
          throw new Error(`Failed to load page data: ${response.status}`);
        }
        const data: QuranData = await response.json();
        
        if (mounted && pageNumber >= 1 && pageNumber <= 604) {
          setPageData(data.pages[pageNumber - 1]);
        }
      } catch (error) {
        console.error('Error loading page data:', error);
      }
    };

    loadPageData();

    return () => {
      mounted = false;
    };
  }, [pageNumber]);

  // Load page-specific font from cache/network
  useEffect(() => {
    let mounted = true;
    let abortController = new AbortController();

    const loadFont = async () => {
      try {
        // Load font with caching (downloads if not cached)
        const fontName = await loadCachedFont(pageNumber, mushafType, abortController.signal);
        
        if (mounted) {
          console.log(`Font ${fontName} loaded successfully`);
          setFontLoaded(true);
          setLoadError(false);
        }
      } catch (error: any) {
        console.error(`Error loading font for page ${pageNumber}:`, error);
        if (mounted) {
          // If font is not cached and we're offline, show error
          if (error.message === 'FONT_NOT_CACHED_OFFLINE') {
            setLoadError(true);
            setFontLoaded(false);
          } else {
            // For other errors, continue with fallback (network errors, etc.)
            setFontLoaded(true);
            setLoadError(false);
          }
        }
      }
    };

    setFontLoaded(false);
    setLoadError(false);
    loadFont();

    return () => {
      mounted = false;
      abortController.abort();
    };
  }, [pageNumber, mushafType, fontLoadTrigger]);

  // Listen for online/offline events to retry failed loads
  useEffect(() => {
    const handleOnline = () => {
      console.log('[TartelPage] 🌐 Network came back online');
      if (loadError) {
        console.log('[TartelPage] 🔄 Retrying failed font load...');
        setFontLoadTrigger(prev => prev + 1);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [loadError]);

  const handleWordHover = (verseKey: string) => {
    // Only allow hover on non-touch devices (desktop)
    if (!isTouchDevice) {
      setHoveredAyah(verseKey);
    }
  };

  const handleWordLeave = () => {
    // Only clear hover on non-touch devices (desktop)
    if (!isTouchDevice) {
      setHoveredAyah(null);
    }
  };

  // Long-press handlers for mobile
  const handleTouchStart = (e: React.TouchEvent, verseKey: string) => {
    // Don't prevent default - let single tap bubble up to parent onClick
    
    // Reset swipe tracking
    isSwipingRef.current = false;
    
    // Store touch start position
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    longPressTriggeredRef.current = false;

    // Clear any existing timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Start long-press timer (400ms)
    longPressTimerRef.current = setTimeout(async () => {
      longPressTriggeredRef.current = true;
      
      // Trigger haptic feedback
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (error) {
        // Haptics may not be available on web
        console.log('Haptics not available:', error);
      }
      
      // Extract surah and ayah from verseKey (format: "surahNum:ayahNum")
      const [surahStr, ayahStr] = verseKey.split(':');
      const surahNum = parseInt(surahStr);
      const ayahNum = parseInt(ayahStr);
      
      // Notify parent component of ayah selection
      // Parent's currentPlayingAyah will now handle the highlighting
      if (onAyahSelect) {
        onAyahSelect(surahNum, ayahNum);
      }
      
      // Clear local hover state - parent's currentPlayingAyah will maintain the highlight
      // This ensures only one ayah is highlighted at a time
      setHoveredAyah(null);
    }, 400);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Cancel long-press if finger moves (scrolling detected)
    if (touchStartPosRef.current && longPressTimerRef.current) {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);
      
      // Detect horizontal swipe (for Swiper navigation)
      if (deltaX > 15 && deltaX > deltaY) {
        // This is a horizontal swipe - allow it to pass through to Swiper
        isSwipingRef.current = true;
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        longPressTriggeredRef.current = false;
        // Don't prevent default - let Swiper handle the swipe
        return;
      }
      
      // If moved more than 10px vertically, cancel the long-press
      if (deltaY > 10) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        longPressTriggeredRef.current = false;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // If this was a horizontal swipe, don't prevent it - let Swiper handle it
    if (isSwipingRef.current) {
      isSwipingRef.current = false;
      touchStartPosRef.current = null;
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      // Don't prevent default or stop propagation - let Swiper navigate
      return;
    }
    
    // Clear timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    // If long-press was triggered, keep the highlight (don't clear it)
    if (longPressTriggeredRef.current) {
      e.preventDefault();
      e.stopPropagation(); // Prevent onClick from firing on long-press
      longPressTriggeredRef.current = false;
      // NOTE: hoveredAyah remains set - selection persists until another action
    }
    // If NOT long-press, let the tap bubble up to parent onClick (toggle bars)
    
    touchStartPosRef.current = null;
  };

  const handleTouchCancel = () => {
    // Clean up on touch cancel
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setHoveredAyah(null);
    touchStartPosRef.current = null;
    longPressTriggeredRef.current = false;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Show error state if font not cached and offline
  if (loadError) {
    return (
      <div 
        className={className}
        style={{ 
          backgroundColor: '#f3f4f6',
          minHeight: '200px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          textAlign: 'center'
        }}
      >
        <svg 
          className="w-12 h-12 text-gray-400 mb-2" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
        </svg>
        <span className={`text-gray-500 text-sm md:text-base font-semibold mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('offlinePageNotCached')}
        </span>
        <span className="text-gray-400 text-sm md:text-base">{t('page')} {pageNumber}</span>
      </div>
    );
  }

  // Show loading state
  if (!pageData || !fontLoaded) {
    return (
      <div className={`flex items-center justify-center bg-[#FBF9F4] ${className}`}>
        <div className="text-emerald-700 text-lg">{t('loading')}</div>
      </div>
    );
  }

  // Find last word of each ayah for green markers
  const ayahLastWords = new Map<string, number>();
  pageData.lines.forEach(line => {
    if (line.line_type === 'ayah' && line.words) {
      line.words.forEach(word => {
        const current = ayahLastWords.get(word.verse_key) || 0;
        if (word.position > current) {
          ayahLastWords.set(word.verse_key, word.position);
        }
      });
    }
  });

  return (
    <div
      ref={containerRef}
      className={`tartel-page flex flex-col items-center justify-center bg-transparent ${className}`}
      style={{ 
        fontFamily: `'p${pageNumber}-${mushafType}', 'Amiri', serif`,
        direction: 'rtl',
        maxHeight: '100%',
        height: 'auto',
      }}
      onClick={onClick}
    >
      <div className="w-full flex flex-col justify-center px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4" style={{ maxHeight: '100%' }}>
        {pageData.lines.map((line, idx) => (
          <div key={idx} className="line-container mb-0.5 sm:mb-1">
            {line.line_type === 'ayah' && line.words ? (
              <div className={`line-content ${line.is_centered ? 'text-center' : 'text-center'}`}>
                {line.words.map((word, widx) => {
                  const isLastWord = word.position === ayahLastWords.get(word.verse_key);
                  // Highlight if locally hovered OR if it matches the currently selected ayah from parent
                  const isCurrentlySelected = currentPlayingAyah && 
                    word.verse_key === `${currentPlayingAyah.surah}:${currentPlayingAyah.ayah}`;
                  const isHighlighted = hoveredAyah === word.verse_key || isCurrentlySelected;
                  
                  return (
                    <span
                      key={widx}
                      className={`char-word ${isLastWord ? 'char-end' : ''} ${isHighlighted ? 'ayah-highlighted' : ''}`}
                      data-ayah={word.verse_key}
                      data-surah={word.surah}
                      data-ayah-num={word.ayah}
                      onMouseEnter={() => handleWordHover(word.verse_key)}
                      onMouseLeave={handleWordLeave}
                      onTouchStart={(e) => handleTouchStart(e, word.verse_key)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      onTouchCancel={handleTouchCancel}
                    >
                      {word.text}
                    </span>
                  );
                })}
              </div>
            ) : line.line_type === 'surah_name' ? (
              // Surah name decorative header with icon and text overlay
              <div className="surah-header-container text-center">
                <div className="surah-icon-wrapper">
                  <img 
                    src="/surahicon.png" 
                    alt={line.surah_number && surahs[line.surah_number - 1] 
                      ? `سُورَةُ ${surahs[line.surah_number - 1].name}`
                      : 'Surah Header'}
                    className="surah-icon"
                    loading="lazy"
                  />
                  <span className="surah-name-overlay">
                    {line.surah_number && surahs[line.surah_number - 1] 
                      ? removeTashkil(`سورة ${surahs[line.surah_number - 1].name}`)
                      : ''}
                  </span>
                </div>
              </div>
            ) : line.line_type === 'basmallah' ? (
              <div className="bismillah-line text-center">
                بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <style>{`
        .tartel-page {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
          font-kerning: none;
          -webkit-font-kerning: none;
          font-feature-settings: normal;
          -webkit-font-feature-settings: normal;
        }

        .line-container {
          display: block;
          width: 100%;
          margin: 0;
          padding: 0;
        }

        .line-content {
          font-size: min(max(2.5vw, 1.75rem), 2.5rem);
          line-height: 1.75;
          padding: 0;
          margin: 0;
          text-align: center;
          letter-spacing: 0;
          white-space: nowrap;
          overflow: visible;
        }

        @media (min-width: 640px) {
          .line-content {
            font-size: min(max(2.2vw, 2rem), 2.5rem);
            line-height: 1.85;
          }
        }

        .char-word {
          display: inline;
          margin: 0 1px;
          padding: 0;
          cursor: pointer;
          transition: none;
          letter-spacing: 0;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          -webkit-tap-highlight-color: transparent;
        }

        .char-word::selection {
          background: transparent;
          color: inherit;
        }

        .char-word::-moz-selection {
          background: transparent;
          color: inherit;
        }

        /* Green color and bold for last word of ayah (verse end marker) */
        .char-word.char-end {
          color: #0a8500;
          font-weight: bold;
        }

        /* Highlight on hover/touch */
        .char-word.ayah-highlighted {
          background-color: rgba(9, 176, 0, 0.15);
          margin: 0;
          padding: 0 1px;
          display: inline-block;
          vertical-align: baseline;
        }

        .surah-header-container {
          padding: 0.5rem 0;
          margin: 0;
          line-height: 1.75;
          height: auto;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
        }

        .surah-icon-wrapper {
          position: relative;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .surah-icon {
          width: 100%;
          max-width: 100%;
          height: auto;
          display: block;
        }

        .surah-name-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-family: 'Scheherazade New', 'Amiri Quran', 'Amiri', 'Traditional Arabic', 'Noto Naskh Arabic', serif;
          font-size: min(max(2vw, 1.4rem), 2rem);
          font-weight: 700;
          color: #065f46;
          white-space: nowrap;
          text-shadow: 0 0 4px rgba(255, 255, 255, 0.9), 0 1px 2px rgba(255, 255, 255, 0.7);
          pointer-events: none;
          z-index: 1;
          letter-spacing: 0.02em;
        }

        @media (min-width: 640px) {
          .surah-name-overlay {
            font-size: min(max(2.2vw, 1.6rem), 2.2rem);
          }
        }

        @media (min-width: 768px) {
          .surah-name-overlay {
            font-size: min(max(2.5vw, 1.8rem), 2.5rem);
          }
          
          .surah-header-container {
            padding: 0.75rem 0;
          }
        }

        .bismillah-line {
          font-size: min(max(1.8vw, 1.4rem), 2rem);
          color: #8b7355;
          font-weight: 600;
          padding: 0;
          margin: 0;
          line-height: 1.75;
        }

        /* Slightly smaller font sizes for tajweed mushaf */
        ${mushafType === 'tajweed' ? `
          .line-content {
            font-size: min(max(2.2vw, 1.55rem), 2.2rem);
          }

          @media (min-width: 640px) {
            .line-content {
              font-size: min(max(2vw, 1.75rem), 2.2rem);
            }
          }

          .surah-name-overlay {
            font-size: min(max(1.8vw, 1.25rem), 1.8rem);
          }

          @media (min-width: 640px) {
            .surah-name-overlay {
              font-size: min(max(2vw, 1.45rem), 2rem);
            }
          }

          @media (min-width: 768px) {
            .surah-name-overlay {
              font-size: min(max(2.2vw, 1.6rem), 2.2rem);
            }
          }

          .bismillah-line {
            font-size: min(max(1.6vw, 1.25rem), 1.8rem);
          }
        ` : ''}

        @media (min-width: 768px) {
          .line-content {
            font-size: 2.5rem;
            line-height: 2;
          }
          
          .surah-header-container {
            padding: 0.75rem 0;
            line-height: 2;
          }
          
          .bismillah-line {
            font-size: 2rem;
            padding: 0;
            margin: 0;
            line-height: 2;
          }

          /* Smaller sizes for tajweed at larger screens */
          ${mushafType === 'tajweed' ? `
            .line-content {
              font-size: 2.2rem;
            }
            
            .surah-name-overlay {
              font-size: 2.2rem;
            }
            
            .bismillah-line {
              font-size: 1.8rem;
            }
          ` : ''}
        }
      `}</style>
    </div>
  );
});

TartelPage.displayName = 'TartelPage';

export default TartelPage;
