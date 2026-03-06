import { useEffect, useState, useRef, memo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

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
  surah_name_ar?: string;
  surah_name_en?: string;
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
}

const TartelPage = memo(({ pageNumber, onClick, className = '', onAyahSelect }: TartelPageProps) => {
  const { language, t } = useLanguage();
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [hoveredAyah, setHoveredAyah] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Long-press detection refs
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);
  
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

  // Load page-specific font
  useEffect(() => {
    let mounted = true;

    const loadFont = async () => {
      try {
        const fontName = `p${pageNumber}`;
        
        // Check if font is already loaded in document.fonts
        const existingFont = Array.from(document.fonts).find(
          (font: any) => font.family === fontName
        );
        
        if (existingFont && existingFont.status === 'loaded') {
          if (mounted) {
            console.log(`Font ${fontName} already loaded`);
            setFontLoaded(true);
          }
          return;
        }

        console.log(`Loading font: ${fontName}`);
        const font = new FontFace(
          fontName,
          `url(/assets/fonts/p${pageNumber}.ttf)`
        );

        await font.load();
        document.fonts.add(font);
        
        // Wait for fonts to be fully ready
        await document.fonts.ready;
        
        if (mounted) {
          console.log(`Font ${fontName} loaded and ready`);
          setFontLoaded(true);
        }
      } catch (error) {
        console.error(`Error loading font for page ${pageNumber}:`, error);
        if (mounted) {
          setFontLoaded(true); // Continue with fallback font
        }
      }
    };

    setFontLoaded(false);
    loadFont();

    return () => {
      mounted = false;
    };
  }, [pageNumber]);

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
      
      // Clear any previous selection and highlight the new ayah
      setHoveredAyah(verseKey);
      
      // Extract surah and ayah from verseKey (format: "surahNum:ayahNum")
      const [surahStr, ayahStr] = verseKey.split(':');
      const surahNum = parseInt(surahStr);
      const ayahNum = parseInt(ayahStr);
      
      // Notify parent component of ayah selection
      if (onAyahSelect) {
        onAyahSelect(surahNum, ayahNum);
      }
    }, 400);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Cancel long-press if finger moves (scrolling detected)
    if (touchStartPosRef.current && longPressTimerRef.current) {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);
      
      // If moved more than 10px, cancel the long-press
      if (deltaX > 10 || deltaY > 10) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        longPressTriggeredRef.current = false;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
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
        fontFamily: `'p${pageNumber}', 'Amiri', serif`,
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
                  const isHighlighted = hoveredAyah === word.verse_key;
                  
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
              <div className="surah-header-line text-center">
                <span className="surah-name">
                  {language === 'ar' ? line.surah_name_ar : line.surah_name_en}
                </span>
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

        .surah-header-line {
          font-size: min(max(2vw, 1.5rem), 2.25rem);
          color: #8b7355;
          font-weight: bold;
          padding: 0.5rem 0;
          margin: 0.3rem 0;
        }

        .bismillah-line {
          font-size: min(max(1.8vw, 1.4rem), 2rem);
          color: #8b7355;
          font-weight: 600;
          padding: 0.5rem 0;
          margin: 0.3rem 0;
        }

        @media (min-width: 768px) {
          .line-content {
            font-size: 2.5rem;
            line-height: 2;
          }
          
          .surah-header-line {
            font-size: 2.25rem;
            padding: 1rem 0;
            margin: 0.5rem 0;
          }
          
          .bismillah-line {
            font-size: 2rem;
            padding: 0.75rem 0;
            margin: 0.5rem 0;
          }
        }
      `}</style>
    </div>
  );
});

TartelPage.displayName = 'TartelPage';

export default TartelPage;
