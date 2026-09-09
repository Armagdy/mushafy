import { useCallback, useEffect, useLayoutEffect, useState, useRef, memo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { surahs } from '@/data/surahs';
import { loadCachedFont, preloadAdjacentFonts } from '@/lib/font-cache';

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
  isFullscreen?: boolean;
  isFullscreenDarkMode?: boolean;
}

// Cache for the complete Quran pages data (loaded once, used for all pages)
let cachedQuranData: QuranData | null = null;
let dataLoadingPromise: Promise<QuranData> | null = null;

// Function to load and cache the Quran pages data
const loadQuranPagesData = async (): Promise<QuranData> => {
  // If already cached, return immediately
  if (cachedQuranData) {
    console.log('[TartelPage] ✅ Using cached Quran page data (instant access)');
    return cachedQuranData;
  }
  
  // If already loading, wait for the existing promise
  if (dataLoadingPromise) {
    console.log('[TartelPage] ⏳ Waiting for in-progress data load');
    return dataLoadingPromise;
  }
  
  // Start loading
  console.log('[TartelPage] 📥 Loading quran_pages_lines.json (first time)');
  dataLoadingPromise = (async () => {
    try {
      const response = await fetch('/assets/quran_pages_lines.json');
      if (!response.ok) {
        throw new Error(`Failed to load page data: ${response.status}`);
      }
      const data: QuranData = await response.json();
      cachedQuranData = data;  // Cache the data
      console.log('[TartelPage] ✅ Quran page data cached successfully');
      return data;
    } catch (error) {
      dataLoadingPromise = null;  // Reset on error so it can be retried
      console.error('[TartelPage] ❌ Failed to load page data:', error);
      throw error;
    }
  })();
  
  return dataLoadingPromise;
};

const TartelPage = memo(({ pageNumber, onClick, className = '', onAyahSelect, currentPlayingAyah, mushafType = 'tarteel', isFullscreen = false, isFullscreenDarkMode = false }: TartelPageProps) => {
  const { language, t, isRTL } = useLanguage();
  // NOTE: text mushafs are ALWAYS rendered enlarged (see SwiperPageDisplay `pageEnlarged`).
  // A new TartelPage instance mounts for every swiped-to page, so any async gap
  // (loading placeholder, null line-height) is visible as shrink-then-enlarge.
  // Initial states below are therefore seeded synchronously to the enlarged
  // layout so the incoming page paints at full size on the first frame.
  const [pageData, setPageData] = useState<PageData | null>(() => {
    try {
      if (cachedQuranData && pageNumber >= 1 && pageNumber <= 604) {
        return cachedQuranData.pages[pageNumber - 1] ?? null;
      }
    } catch { /* ignore - async load below covers it */ }
    return null;
  });
  const isFontCssInjected = useCallback(() => {
    try {
      return !!document.getElementById(`font-p${pageNumber}-${mushafType}`);
    } catch {
      return false;
    }
  }, [pageNumber, mushafType]);
  // Start loaded when the @font-face is already injected (preloaded neighbor
  // pages). This skips the tiny "loading" flash that caused the shrink.
  const [fontLoaded, setFontLoaded] = useState(() => isFontCssInjected());
  const [loadError, setLoadError] = useState(false);
  const [hoveredAyah, setHoveredAyah] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dynamicLineHeight, setDynamicLineHeight] = useState<number | null>(null);
  
  // Track fullscreen state changes for smooth transitions
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevFullscreenRef = useRef(isFullscreen);
  
  // Highlight rectangles for the currently highlighted ayah
  const [highlightRects, setHighlightRects] = useState<{top: number, left: number, width: number, height: number}[]>([]);
  // Trigger to force recalculation of highlight positions
  const [highlightRecalcTrigger, setHighlightRecalcTrigger] = useState(0);
  
  // Handle fullscreen transition timing
  useEffect(() => {
    if (prevFullscreenRef.current !== isFullscreen) {
      setIsTransitioning(true);
      prevFullscreenRef.current = isFullscreen;
      
      // Clear transitioning state after animation completes
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        // Trigger highlight recalculation after transition
        setHighlightRecalcTrigger(prev => prev + 1);
      }, 350); // Match the CSS transition duration
      
      return () => clearTimeout(timer);
    }
  }, [isFullscreen]);
  
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

  // Load page data (using cached data for instant access)
  useEffect(() => {
    let mounted = true;

    const loadPageData = async () => {
      try {
        // Load from cache (instant if already loaded)
        const data = await loadQuranPagesData();
        
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

  // Load page-specific font from cache/network (non-blocking)
  useEffect(() => {
    let mounted = true;
    const abortController = new AbortController();

    const loadFont = async () => {
      try {
        // Load font with caching (downloads if not cached)
        // This injects CSS @font-face rule
        const fontName = await loadCachedFont(pageNumber, mushafType, abortController.signal);
        
        if (!mounted) return;
        
        // Wait for the font to actually be loaded and ready to render
        // This prevents FOUC (Flash of Unstyled Content)
        try {
          await document.fonts.load(`1em ${fontName}`);
          console.log(`✅ Font ${fontName} loaded and ready for rendering`);
        } catch (fontLoadError) {
          // Font Loading API failed, but CSS is injected - proceed anyway
          console.warn(`⚠️ Font Loading API failed for ${fontName}, proceeding with CSS fallback`);
        }
        
        if (mounted) {
          setFontLoaded(true);
          setLoadError(false);
          
          // Preload adjacent pages' fonts in the background (non-blocking)
          // This makes swiping to nearby pages instant
          preloadAdjacentFonts(pageNumber, mushafType, 2).catch(() => {
            // Silently fail - preloading is optional
          });
        }
      } catch (error: any) {
        console.error(`❌ Error loading font for page ${pageNumber}:`, error);
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

    // Reset fontLoaded only when the font CSS is NOT already injected.
    // Resetting unconditionally flashed the small "loading" placeholder on
    // every swipe (shrink), then enlarged again once the async load finished.
    if (!isFontCssInjected()) {
      setFontLoaded(false);
    } else {
      // Font CSS present: verify readiness in background, render now.
      setFontLoaded(true);
    }
    setLoadError(false);
    loadFont();

    return () => {
      mounted = false;
      abortController.abort();
    };
  }, [pageNumber, mushafType, fontLoadTrigger, isFontCssInjected]);

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

  // Calculate dynamic line-height for fullscreen mode.
  // IMPORTANT: never reset to null while a new page loads — that collapsed the
  // line-height back to the 1.75 fallback and was visible as shrink-then-grow
  // on every swipe. We keep the last value and overwrite it synchronously
  // (layout effect, before paint) once the new page is measurable.
  useLayoutEffect(() => {
    if (!isFullscreen || !pageData || !fontLoaded) {
      return;
    }

    const calculateLineHeight = () => {
      const container = containerRef.current;
      if (!container) return;

      // Get available height, accounting for fullscreen overlay header/footer.
      // Surah.tsx reserves pt-[108px]/pb-[128px] (md: 116/136) for these
      // overlays, so the text must fit in the space BETWEEN them — never
      // beneath them.
      const headerHeight = 112;
      const footerHeight = 132;
      const availableHeight = window.innerHeight - headerHeight - footerHeight;
      
      // Count total lines on this page
      const totalLines = pageData.lines.length;
      if (totalLines === 0) return;

      // Get actual computed font size from the first line-content element
      const lineContentEl = container.querySelector('.line-content');
      let actualFontSize = 28; // fallback
      if (lineContentEl) {
        const computed = window.getComputedStyle(lineContentEl);
        actualFontSize = parseFloat(computed.fontSize) || 28;
      }
      
      // Calculate line-height needed to fill available space
      // Total height = totalLines * fontSize * lineHeight
      // So: lineHeight = availableHeight / (totalLines * fontSize)
      const calculatedLineHeight = availableHeight / (totalLines * actualFontSize);
      
      // Clamp between 1.8 and 6.0 for readability
      const clampedLineHeight = Math.max(1.8, Math.min(6.0, calculatedLineHeight));
      
      // Only update state when the value actually changed (avoids re-render loop,
      // which itself flashed the layout).
      setDynamicLineHeight((prev) =>
        prev === null || Math.abs(prev - clampedLineHeight) > 0.01 ? clampedLineHeight : prev
      );
    };

    // Measure synchronously before paint (no 50ms delay) so the incoming page
    // never paints one frame at the fallback line-height (the "shrink" frame).
    // requestAnimationFrame covers the case where the custom font swaps in a
    // tick later; resize keeps it correct on rotation.
    calculateLineHeight();
    const rafId = requestAnimationFrame(calculateLineHeight);

    // Recalculate on resize
    window.addEventListener('resize', calculateLineHeight);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', calculateLineHeight);
    };
  }, [isFullscreen, pageData, fontLoaded]);

  // Stretch the surah header frame to fill the full element width.
  // The icon-font glyph has an intrinsic width, so flex centering alone
  // leaves gaps at the sides. Measure the glyph and grow/shrink the
  // font-size until the glyph width matches the container width
  // (proportional scaling like responsive type — no scaleX distortion).
  useLayoutEffect(() => {
    if (!pageData || !fontLoaded) return;

    const fitHeaders = () => {
      const root = containerRef.current;
      if (!root) return;
      const headers = root.querySelectorAll('.quran-icon-surah-header');
      headers.forEach((header) => {
        const el = header as HTMLElement;
        const container = el.parentElement;
        const glyph = el.querySelector('.surah-header-glyph') as HTMLElement | null;
        if (!container || !glyph) return;
        const target = container.clientWidth;
        if (!target) return;
        // Measure from the CSS base size (clear previous fit first to avoid
        // compounding on repeated calls).
        el.style.fontSize = '';
        const base = parseFloat(window.getComputedStyle(el).fontSize) || 0;
        const glyphWidth = glyph.offsetWidth;
        if (!base || !glyphWidth) return;
        const scale = target / glyphWidth;
        const clamped = Math.min(2.5, Math.max(0.5, scale));
        if (Math.abs(clamped - 1) > 0.01) {
          el.style.fontSize = `${base * clamped}px`;
        }
      });
    };

    fitHeaders();
    const raf = requestAnimationFrame(fitHeaders);
    // Glyph metrics change once the icon font finishes loading — re-fit then.
    try {
      (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready?.then(() => {
        fitHeaders();
      });
    } catch { /* fonts API unavailable — initial fit stands */ }
    window.addEventListener('resize', fitHeaders);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fitHeaders);
    };
  }, [pageData, fontLoaded]);

  // Calculate highlight rectangles for the currently highlighted ayah
  useEffect(() => {
    // Determine which ayah is highlighted
    const highlightedVerseKey = hoveredAyah || 
      (currentPlayingAyah ? `${currentPlayingAyah.surah}:${currentPlayingAyah.ayah}` : null);
    
    if (!highlightedVerseKey || !containerRef.current) {
      setHighlightRects([]);
      return;
    }
    
    // Use a small delay to ensure layout has settled after fullscreen toggle
    const calculateRects = () => {
      if (!containerRef.current) return;
      
      // Find all word elements for this ayah
      const wordElements = containerRef.current.querySelectorAll(`[data-ayah="${highlightedVerseKey}"]`);
      if (wordElements.length === 0) {
        setHighlightRects([]);
        return;
      }
      
      const containerRect = containerRef.current.getBoundingClientRect();
      
      // Group words by line (similar top position)
      const lineGroups: Map<number, Element[]> = new Map();
      wordElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        // Round top to group words on same line (within 5px tolerance)
        const lineTop = Math.round(rect.top / 5) * 5;
        if (!lineGroups.has(lineTop)) {
          lineGroups.set(lineTop, []);
        }
        lineGroups.get(lineTop)!.push(el);
      });
      
      // Calculate bounding rect for each line group
      const rects: {top: number, left: number, width: number, height: number}[] = [];
      lineGroups.forEach((elements) => {
        let minLeft = Infinity;
        let maxRight = -Infinity;
        let minTop = Infinity;
        let maxBottom = -Infinity;
        
        elements.forEach(el => {
          const rect = el.getBoundingClientRect();
          minLeft = Math.min(minLeft, rect.left);
          maxRight = Math.max(maxRight, rect.right);
          minTop = Math.min(minTop, rect.top);
          maxBottom = Math.max(maxBottom, rect.bottom);
        });
        
        // Convert to container-relative coordinates
        rects.push({
          top: minTop - containerRect.top,
          left: minLeft - containerRect.left,
          width: maxRight - minLeft,
          height: maxBottom - minTop
        });
      });
      
      setHighlightRects(rects);
    };
    
    // Small delay to allow layout to settle after fullscreen toggle
    const timeoutId = setTimeout(calculateRects, 50);
    return () => clearTimeout(timeoutId);
  }, [hoveredAyah, currentPlayingAyah, fontLoaded, pageData, isFullscreen, dynamicLineHeight, highlightRecalcTrigger]);

  // Recalculate highlight positions after layout changes (resize)
  useEffect(() => {
    const recalculateHighlights = () => {
      // Trigger recalculation by incrementing the trigger
      setHighlightRecalcTrigger(prev => prev + 1);
    };
    
    window.addEventListener('resize', recalculateHighlights);
    return () => window.removeEventListener('resize', recalculateHighlights);
  }, []);

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

  // Loading skeleton: keep the EXACT enlarged footprint (same max-h class +
  // full-height min-height) so a swiped-to page never paints as a small box
  // that then jumps to full size. Previously this was a collapsed flex box —
  // the visible "shrink then enlarge".
  if (!pageData || !fontLoaded) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 'calc(100dvh - 250px)',
          fontFamily: `'p${pageNumber}-${mushafType}', 'Amiri', serif`,
          direction: 'rtl',
        }}
      >
        <div className="text-emerald-700 text-lg opacity-60">{t('loading')}</div>
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
      className={`tartel-page tartel-page-transition flex flex-col items-center bg-transparent ${isFullscreenDarkMode ? 'tartel-dark-mode' : ''} ${isTransitioning ? 'tartel-transitioning' : ''} ${className}`}
      style={{
        fontFamily: `'p${pageNumber}-${mushafType}', 'Amiri', serif`,
        direction: 'rtl',
        // Size from viewport (same in normal + fullscreen) so toggling the
        // view never shrinks the page. Parent slide scrolls if taller than
        // its content box; Surah.tsx padding guarantees it starts after the
        // header instead of beneath it.
        maxHeight: 'none',
        height: 'auto',
        // Lock the enlarged footprint even before the font/line-height settles,
        // so swipe-incoming pages can't collapse for a frame (no shrink).
        minHeight: 'calc(100dvh - 250px)',
        width: '100%',
        position: 'relative',
        justifyContent: isFullscreen ? 'space-between' : 'center',
      }}
    >
      {/* Highlight overlay rectangles */}
      {highlightRects.map((rect, idx) => (
        <div
          key={idx}
          className="ayah-highlight-overlay"
          style={{
            position: 'absolute',
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            backgroundColor: isFullscreenDarkMode ? 'rgba(5, 150, 105, 0.25)' : 'rgba(9, 176, 0, 0.15)',
            borderRadius: '3px',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      ))}
      <div 
        className={`tartel-content-wrapper w-full flex flex-col px-2 sm:px-4 md:px-6`}
        style={{
          maxHeight: 'none',
          position: 'relative',
          zIndex: 1,
          flex: isFullscreen ? '1' : 'none',
          justifyContent: isFullscreen ? 'space-between' : 'center',
          paddingTop: isFullscreen ? '0' : undefined,
          paddingBottom: isFullscreen ? '0' : undefined,
        }}
      >
        {pageData.lines.map((line, idx) => (
          <div key={idx} className="line-container">
            {line.line_type === 'ayah' && line.words ? (
              <div className={`line-content ${line.is_centered ? 'text-center' : 'text-center'}`}>
                {line.words.map((word, widx) => {
                  const isLastWord = word.position === ayahLastWords.get(word.verse_key);
                  
                  return (
                    <span
                      key={widx}
                      className={`char-word ${isLastWord ? 'char-end' : ''}`}
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
              // Surah name decorative header with icon fonts.
              // The glyph span is measured by the auto-fit effect below so the
              // frame stretches to fill the full element width (not just
              // centered at its intrinsic size like ayah lines fill via
              // space-between).
              <div className="surah-header-container text-center">
                <div className="quran-icon-surah-header">
                  <span className="surah-header-glyph" aria-hidden="true">header</span>
                  <div className="surah-icon-overlay">
                    <span className="surah-name-v4-icon">
                      {`surah${String(line.surah_number || 1).padStart(3, '0')}`}
                    </span>
                  </div>
                </div>
              </div>
            ) : line.line_type === 'basmallah' ? (
              <div className="bismillah-line text-center">
                ﷽
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
        
        /* Smooth fullscreen transition styles */
        .tartel-page-transition {
          transition: height 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                      justify-content 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          will-change: height, justify-content;
        }
        
        .tartel-content-wrapper {
          transition: flex 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                      justify-content 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                      padding 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          will-change: flex, justify-content, padding;
          /* Establish a container so the surah header (cqw units below)
             scales with the PAGE width (incl. side padding) instead of the
             viewport — it follows the same width as the ayah lines. */
          container-type: inline-size;
        }
        
        /* While transitioning, ensure smooth line-height changes */
        .tartel-transitioning .line-content,
        .tartel-transitioning .surah-header-container,
        .tartel-transitioning .bismillah-line {
          transition: line-height 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .line-container {
          display: block;
          width: 100%;
          margin: 0;
          padding: 0;
        }

        .line-content {
          font-size: ${mushafType === 'tajweed' ? 'min(max(2.3vw, 1.6rem), 2.3rem)' : 'min(max(2.5vw, 1.75rem), 2.5rem)'};
          line-height: ${dynamicLineHeight || 1.75};
          padding: 0;
          margin: 0;
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          letter-spacing: 0;
          overflow: visible;
        }

        @media (min-width: 640px) {
          .line-content {
            font-size: ${mushafType === 'tajweed' ? 'min(max(2vw, 1.85rem), 2.3rem)' : 'min(max(2.2vw, 2rem), 2.5rem)'};
            line-height: ${dynamicLineHeight || 1.85};
          }
        }

        .char-word {
          display: inline;
          margin: 0;
          padding: 0;
          transition: none;
          letter-spacing: 0;
          font-weight: ${mushafType === 'tajweed' ? '600' : '500'};
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

        .surah-header-container {
          padding: 0;
          margin: 0 auto;
          line-height: ${dynamicLineHeight || 1.65};
          height: auto;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          max-width: 100%;
          overflow: hidden;
          pointer-events: none;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }

        .quran-icon-surah-header {
          position: relative;
          font-family: quran-icon;
          font-size: min(max(9.5cqw, 3.56rem), 5.94rem);
          color: #065f46;
          line-height: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          max-width: 100%;
        }

        /* Measurable glyph run for the auto-fit effect: inline-block so
           offsetWidth reports the true glyph width (not the stretched
           100% flex-box width), nowrap so it never wraps mid-frame. */
        .surah-header-glyph {
          display: inline-block;
          white-space: nowrap;
          line-height: 1;
        }

        .surah-icon-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 1;
        }

        .surah-name-v4-icon {
          font-family: surah-name-v4;
          font-size: min(max(8cqw, 2.8rem), 4.5rem);
          color: #065f46;
          line-height: 1;
        }

        @media (min-width: 640px) {
          .surah-header-container {
            line-height: ${dynamicLineHeight || 1.75};
          }
          .quran-icon-surah-header {
            font-size: min(max(12.5cqw, 5rem), 7.5rem);
          }
          .surah-name-v4-icon {
            font-size: min(max(9.5cqw, 3.4rem), 5.6rem);
          }
        }

        @media (min-width: 768px) {
          .quran-icon-surah-header {
            font-size: min(max(15cqw, 6.25rem), 8.75rem);
          }
          .surah-name-v4-icon {
            font-size: min(max(11cqw, 4rem), 6.5rem);
          }
          
          .surah-header-container {
            padding: 0;
          }
        }

        .bismillah-line {
          font-size: min(max(1.8vw, 1.4rem), 2rem);
          color: #8b7355;
          font-weight: 600;
          padding: 0;
          margin: 0;
          line-height: ${dynamicLineHeight || 1.75};
          pointer-events: none;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }

        @media (min-width: 768px) {
          .line-content {
            font-size: ${mushafType === 'tajweed' ? '2.3rem' : '2.5rem'};
            line-height: ${dynamicLineHeight || 2};
          }
          
          .surah-header-container {
            padding: 0.75rem 0;
            line-height: ${dynamicLineHeight || 2};
          }
          
          .bismillah-line {
            font-size: 2rem;
            padding: 0;
            margin: 0;
            line-height: ${dynamicLineHeight || 2};
          }
        }
      `}</style>
    </div>
  );
});

TartelPage.displayName = 'TartelPage';

export default TartelPage;
