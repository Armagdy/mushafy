import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Virtual, Keyboard, A11y } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/virtual';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Bookmark, BookMarked, BookOpen, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMushaf } from '@/contexts/MushafContext';
import { getPageImageFilename } from '@/lib/quran-mapping';
import { CachedImage } from './CachedImage';
import TartelPage from './TartelPage';
import { AnnotationOverlay } from '@/components/annotation/AnnotationOverlay';
import { useToast } from '@/hooks/use-toast';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { cn } from '@/lib/utils';

interface SwiperPageDisplayProps {
  initialPage: number;
  viewMode: 'single' | 'double';
  isMobile: boolean;
  onPageChange: (pageNumber: number) => void;
  onAyahSelect?: (surah: number, ayah: number) => void;
  currentPlayingAyah?: { surah: number; ayah: number } | null;
  bookmarks: number[];
  memorizationBookmarks: number[];
  readingBookmarks: number[];
  isFullscreen: boolean;
  isFullscreenDarkMode?: boolean;
  onImageClick: () => void;
  audioSource?: 'everyayah' | 'mp3quran';
  hasAyahTimings?: boolean;
  onLongPressNotification?: () => void;
  onSwiperReady?: (navigateToPage: (page: number) => void) => void;
  /**
   * Measured height (px) of the fullscreen quick bar. Only used for text
   * mushafs (tarteel/tajweed) in fullscreen so the page text can fill the
   * entire space between the header and the quick bar.
   */
  fullscreenFooterHeight?: number;
  /**
   * Measured height (px) of the fullscreen header overlay (surah name +
   * page). Same purpose as fullscreenFooterHeight — the text starts right
   * below the header instead of beneath a fixed-size band.
   */
  fullscreenHeaderHeight?: number;
  /**
   * Whether saved page drawings (annotation overlays) are visible in the
   * reader. Toggled from the quick bar (Eye/EyeOff button). Default: true.
   */
  showAnnotations?: boolean;
}

export function SwiperPageDisplay({
  initialPage,
  viewMode,
  isMobile,
  onPageChange,
  onAyahSelect,
  currentPlayingAyah,
  bookmarks,
  memorizationBookmarks,
  readingBookmarks,
  isFullscreen,
  isFullscreenDarkMode = false,
  onImageClick,
  audioSource = 'everyayah',
  hasAyahTimings = true,
  onLongPressNotification,
  onSwiperReady,
  fullscreenFooterHeight,
  fullscreenHeaderHeight,
  showAnnotations = true,
}: SwiperPageDisplayProps) {
  const { t, isRTL } = useLanguage();
  const { getMushafPath, mushafType } = useMushaf();
  const { toast } = useToast();
  const swiperRef = useRef<SwiperType | null>(null);
  // Text mushafs in fullscreen: real overlay bands — the measured header
  // height (+ container pt + slide py) and HALF the measured quick-bar
  // height (+ container pb + slide py) — so the page text fills the ENTIRE
  // space down into the quick bar's transparent upper area (the bar floats
  // OVER the page with no background, so reserving its full height left a
  // dead band). The slide uses py-0.5 in fullscreen, so these reserves
  // exactly match where the slide's content box starts/ends. Normal mode
  // uses undefined — TartelPage falls back to its classic fixed reserves.
  // Memoized: TartelPage is memo-wrapped, so the object identity must stay
  // stable across renders. Every swiped slide gets the same values, so all
  // pages render identically.
  const isTextMushaf = mushafType === 'tarteel' || mushafType === 'tajweed';
  const fillReserves = useMemo(
    () =>
      isFullscreen && isTextMushaf
        ? {
            // Page top offset: container pt (header + 4) + slide py-0.5 (2).
            header: (fullscreenHeaderHeight ?? 40) + 6,
            // Page bottom offset: container pb (half the bar + 8) + slide
            // py-0.5 (2) — matches Surah.tsx's conditional paddingBottom.
            footer: Math.round((fullscreenFooterHeight ?? 120) / 2) + 10,
          }
        : undefined,
    [isFullscreen, isTextMushaf, fullscreenHeaderHeight, fullscreenFooterHeight]
  );
  // Image mushafs in fullscreen: cap the image at the ENTIRE band between
  // the measured header and quick bar — the same "fill the stage" sizing the
  // annotation editor uses (its measured stage height minus a 12px slack).
  // The old fixed calc(100dvh-250px) reserved ~150px more than the actual
  // overlays, so the fullscreen page rendered visibly smaller than the
  // editor's. Derived from the MEASURED overlay heights so safe-area insets
  // and icon-size changes are included. Returns the px reserve subtracted
  // from 100dvh — applied as an inline style because the value is dynamic
  // (a Tailwind arbitrary-value class built at runtime wouldn't be
  // JIT-compiled). Memoized: renderPage is a callback consuming this value.
  const fullscreenImageReservePx = useMemo(() => {
    if (!isFullscreen) return undefined;
    const headerReserve = (fullscreenHeaderHeight ?? 40) + 4; // container pt
    const footerReserve = (fullscreenFooterHeight ?? 56) + 8; // container pb
    const slidePadding = 8; // slide py-1 (top + bottom)
    const editorSlack = 12; // same -12px slack as the editor's stage
    return Math.round(headerReserve + footerReserve + slidePadding + editorSlack);
  }, [isFullscreen, fullscreenHeaderHeight, fullscreenFooterHeight]);
  
  // Track if we're currently transitioning between slides
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Loading gate: the Swiper's Virtual module skips positioning at the
  // initial slide during init (swiper bug/quirk: `beforeInit && initialSlide
  // > 0 → return`), so the first rendered frame comes from the window at
  // slide 0 (page 1). The index is only corrected post-paint. Until then the
  // stage shows an opaque loading overlay instead of flashing page 1.
  //
  // IMPORTANT: swiper/react initializes in a useLayoutEffect — BEFORE the
  // browser paints — so readiness must NOT be set in onSwiper (the overlay
  // would be removed before a single paint, making the loading invisible).
  // It is set from a post-paint useEffect timer instead, with a minimum
  // visible duration so the loading state is actually perceptible.
  const MIN_LOADING_MS = 400;
  // Safety cap for the loading gate — see the readiness effect below.
  const MAX_LOADING_MS = 3000;
  const swiperKey = `swiper-${isFullscreenDarkMode}`;
  const [initializedSwiperKey, setInitializedSwiperKey] = useState<string | null>(null);
  // Latest mount key (read via ref from the timer callback).
  const swiperKeyRef = useRef(swiperKey);
  swiperKeyRef.current = swiperKey;
  const isSwiperReady = initializedSwiperKey === swiperKey;
  // Swiper instance kept in STATE (not just the ref): setting it from
  // onSwiper triggers the re-render that lets the post-paint effect below
  // schedule the readiness timer.
  const [swiperInstance, setSwiperInstance] = useState<SwiperType | null>(null);
  // When the current Swiper instance initialized — used to enforce the
  // minimum visible duration of the loading overlay.
  const swiperMountedAtRef = useRef(Date.now());

  // Declare the swiper "ready" (hide the loading overlay) only once it is
  // VERIFIED to be showing the requested page — and at least MIN_LOADING_MS
  // after the instance initialized (so the loading state is perceptible).
  //
  // A fixed delay is NOT enough on Android: the Virtual module skips
  // positioning at `initialSlide` on init, and the WebView's layout/resize
  // timing means the library's own self-correction can land well after the
  // first paints. So we poll every 100ms, force-correct the position
  // ourselves (slideTo / virtual.update), and lift the overlay only when
  // BOTH the active index and the rendered virtual window match the target
  // page. The MAX_LOADING_MS cap guarantees the overlay never gets stuck.
  useEffect(() => {
    if (isSwiperReady || !swiperInstance) return;
    const targetIndex = initialPage - 1;
    const verifyShowingTargetPage = () => {
      if (!swiperInstance.initialized) return false;
      if (swiperInstance.realIndex !== targetIndex) {
        // Force the swiper onto the requested page — never trust
        // initialSlide + virtual to have done it (they don't, on init).
        swiperInstance.slideTo(targetIndex, 0);
        return false;
      }
      const virtual = swiperInstance.virtual;
      if (
        virtual &&
        typeof virtual.from === 'number' &&
        typeof virtual.to === 'number' &&
        !(virtual.from <= targetIndex && targetIndex <= virtual.to)
      ) {
        // Active index is right but the rendered window isn't showing it —
        // recompute the virtual window.
        virtual.update(true);
        return false;
      }
      return true;
    };
    const poll = setInterval(() => {
      const elapsed = Date.now() - swiperMountedAtRef.current;
      // Safety cap: never trap the user on the loading screen.
      if (elapsed >= MAX_LOADING_MS) {
        clearInterval(poll);
        setInitializedSwiperKey(swiperKeyRef.current);
        return;
      }
      if (!verifyShowingTargetPage()) return;
      if (elapsed < MIN_LOADING_MS) return;
      clearInterval(poll);
      setInitializedSwiperKey(swiperKeyRef.current);
    }, 100);
    return () => clearInterval(poll);
  }, [isSwiperReady, swiperInstance, initialPage]);
  
  // Track which pages are loaded (for virtual slides optimization)
  const [loadedPages, setLoadedPages] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    // Load initial page and adjacent pages
    initial.add(initialPage);
    if (initialPage > 1) initial.add(initialPage - 1);
    if (initialPage < 604) initial.add(initialPage + 1);
    if (viewMode === 'double') {
      // For double page mode, also load the pair
      const pairPage = initialPage % 2 === 0 ? initialPage - 1 : initialPage + 1;
      if (pairPage >= 1 && pairPage <= 604) initial.add(pairPage);
    }
    return initial;
  });
  
  // Cache category for images
  const cacheCategory = `mushaf-${mushafType}`;
  
  // Long-press detection for non-Tarteel and non-Tajweed mushaf
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);
  
  // Handle touch start for long press detection (non-Tarteel and non-Tajweed mushaf only)
  const handleTouchStart = useCallback((e: React.TouchEvent, pageNum: number) => {
    if (mushafType === 'tarteel' || mushafType === 'tajweed') return;
    
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    longPressTriggeredRef.current = false;
    
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      
      // Haptic feedback
      try {
        Haptics.impact({ style: ImpactStyle.Medium });
      } catch (error) {
        console.log('Haptics not supported');
      }
      
      // Check if ayah selection is available with current reciter
      if (audioSource === 'mp3quran' && !hasAyahTimings) {
        // Reciter doesn't support ayah timing - show error
        toast({
          title: t('cannotSelectAyahWithReciter'),
          description: t('pleaseChooseAnotherReciter'),
          duration: 3000,
          variant: 'destructive',
        });
        // Don't trigger flash animation since ayah picker won't work
      } else {
        // Ayah selection is available - guide user to ayah picker
        toast({
          title: t('ayahSelectionNotAvailableForMushaf'),
          duration: 3000,
        });
        
        // Trigger flash animation on ayah picker icon
        if (onLongPressNotification) {
          onLongPressNotification();
        }
      }
    }, 500); // 500ms for long press
  }, [mushafType, audioSource, hasAyahTimings, toast, t, onLongPressNotification]);
  
  // Handle touch move - cancel long press if moved too much
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);
    
    // Cancel if moved more than 10px
    if (deltaX > 10 || deltaY > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  }, []);
  
  // Handle touch end - cleanup
  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  }, []);
  
  // Pre-load adjacent pages when slide changes
  const handleSlideChange = useCallback((swiper: SwiperType) => {
    const currentPage = swiper.realIndex + 1; // Swiper is 0-indexed
    setIsTransitioning(true); // Mark as transitioning
    onPageChange(currentPage);
    
    // Mark current page and adjacent pages as loaded
    const pagesToLoad = new Set<number>();
    
    if (viewMode === 'double') {
      // In double mode, load both pages of the spread
      const isOddPage = currentPage % 2 !== 0;
      const leftPage = isOddPage ? currentPage : currentPage - 1;
      const rightPage = isOddPage ? currentPage + 1 : currentPage;
      
      if (leftPage >= 1) pagesToLoad.add(leftPage);
      if (rightPage <= 604) pagesToLoad.add(rightPage);
      
      // Also load adjacent spreads
      if (leftPage - 2 >= 1) pagesToLoad.add(leftPage - 2);
      if (leftPage - 1 >= 1) pagesToLoad.add(leftPage - 1);
      if (rightPage + 1 <= 604) pagesToLoad.add(rightPage + 1);
      if (rightPage + 2 <= 604) pagesToLoad.add(rightPage + 2);
    } else {
      // Single mode - load current ± 2 pages
      for (let i = -2; i <= 2; i++) {
        const page = currentPage + i;
        if (page >= 1 && page <= 604) {
          pagesToLoad.add(page);
        }
      }
    }
    
    setLoadedPages(pagesToLoad);
  }, [onPageChange, viewMode]);
  
  // Handle transition end - enable highlighting after animation completes
  const handleTransitionEnd = useCallback(() => {
    setIsTransitioning(false);
  }, []);
  
  // Sync Swiper position when initialPage changes (e.g., on app reopen)
  useEffect(() => {
    if (swiperRef.current && swiperRef.current.realIndex !== initialPage - 1) {
      // Navigate to the correct page without animation (0ms) to avoid flashing
      swiperRef.current.slideTo(initialPage - 1, 0);
    }
  }, [initialPage]);
  
  // Track if we've already called onSwiperReady to prevent infinite loop
  const hasCalledSwiperReadyRef = useRef(false);
  
  // Handle swiper initialization
  const handleSwiperInit = useCallback((swiper: SwiperType) => {
    swiperRef.current = swiper;
    // Do NOT declare readiness here: this callback fires from Swiper's
    // useLayoutEffect, i.e. BEFORE the browser paints — the overlay would
    // never be visible. Storing the instance in state re-renders this
    // component so the post-patch readiness effect can schedule the timer
    // that eventually hides the loading overlay (after MIN_LOADING_MS).
    swiperMountedAtRef.current = Date.now();
    setSwiperInstance(swiper);
    
    // Call onSwiperReady once and only once
    if (onSwiperReady && !hasCalledSwiperReadyRef.current) {
      const navigateToPage = (pageNum: number) => {
        if (swiperRef.current) {
          swiperRef.current.slideTo(pageNum - 1, 400);
        }
      };
      onSwiperReady(navigateToPage);
      hasCalledSwiperReadyRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Note: onSwiperReady is intentionally excluded to prevent infinite loop
    // This callback should only set up the swiper ref and call onSwiperReady once
  }, []);
  
  // Render bookmark icons for a page
  const renderBookmarkIcons = useCallback((pageNum: number, position: 'left' | 'right') => {
    const hasBookmark = bookmarks.includes(pageNum);
    const hasMemorization = memorizationBookmarks.includes(pageNum);
    const hasReading = readingBookmarks.includes(pageNum);
    
    if (!hasBookmark && !hasMemorization && !hasReading) return null;
    
    return (
      <div 
        className={cn(
          'absolute top-0 z-10 flex gap-0.5',
          position === 'right' ? 'right-0 translate-x-1' : 'left-0 -translate-x-1'
        )}
      >
        {hasBookmark && (
          <Bookmark className="w-6 h-6 md:w-8 md:h-8 fill-amber-500 text-amber-500 drop-shadow-lg" />
        )}
        {hasMemorization && (
          <BookMarked className="w-6 h-6 md:w-8 md:h-8 fill-emerald-600 text-emerald-600 drop-shadow-lg" />
        )}
        {hasReading && (
          <BookOpen className="w-6 h-6 md:w-8 md:h-8 fill-blue-600 text-blue-600 drop-shadow-lg" />
        )}
      </div>
    );
  }, [bookmarks, memorizationBookmarks, readingBookmarks]);
  
  // Render page content
  const renderPage = useCallback((pageNum: number) => {
    // Only render if page is in loaded set (lazy loading)
    if (!loadedPages.has(pageNum)) {
      return (
        <div className="flex items-center justify-center h-full min-h-[300px]">
          <div className="text-emerald-600 text-base">{t('loading')}...</div>
        </div>
      );
    }
    
    const isOddPage = pageNum % 2 !== 0;
    
    // Text mushafs (tarteel/tajweed) are always enlarged, regardless of fullscreen chrome state
    const isTextMushaf = mushafType === 'tarteel' || mushafType === 'tajweed';
    const pageEnlarged = isFullscreen || isTextMushaf;

    // Dynamic max-height: must fit inside the available space BETWEEN the
    // header and footer bands reserved by Surah.tsx. Image mushafs in
    // fullscreen drop the fixed class cap and use the MEASURED band
    // (fullscreenImageStyle) so the image fills the whole space between
    // header and quick bar — same size/view as the annotation editor's
    // stage. Text mushafs keep the classic cap (their fill comes from
    // fillReserves inside TartelPage). Normal mode keeps the classic
    // bars-visible cap.
    const measuredImageStyle =
      !isTextMushaf && fullscreenImageReservePx
        ? { maxHeight: `calc(100dvh - ${fullscreenImageReservePx}px)` }
        : undefined;
    const imageMaxHeight = measuredImageStyle
      ? undefined // inline maxHeight (measured band) takes over
      : pageEnlarged
        ? 'max-h-[calc(100dvh-250px)] md:max-h-[calc(100dvh-265px)]'
        : 'max-h-[calc(100dvh-170px)]'; // Normal mode with bars visible
    
    if (mushafType === 'tarteel' || mushafType === 'tajweed') {
      // h-auto + min-h-full: size to content (identical in both modes) instead
      // of stretching to the parent box (which differs normal vs fullscreen
      // and caused the shrink on toggle). Parent slide scrolls on overflow.
      // fillReserves (see above) sizes the text to fill the whole band
      // between the header and the quick bar when the reader is fullscreen.
      return (
        <div className={cn(
          "relative w-full h-auto min-h-full flex flex-col justify-start box-border",
          // Fullscreen: just a slim 4px gutter — the page spans nearly the
          // full slide width (slide is px-0; TartelPage adds another 4px
          // internally, ~8px total per side vs 28–64px before).
          // Normal mode keeps the classic gutters.
          isFullscreen ? "px-1" : "px-2 md:px-4"
        )}>
          {renderBookmarkIcons(pageNum, isOddPage ? 'right' : 'left')}
          <div
            aria-hidden="true"
            className={cn(
              'absolute top-0 z-[5] w-3 h-8 md:w-5 md:h-10 bg-emerald-800 shadow-sm',
              isOddPage ? 'left-0' : 'right-0'
            )}
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%)' }}
          />
          <div className="relative w-full">
            <TartelPage
              pageNumber={pageNum}
              onClick={() => {
                if (!longPressTriggeredRef.current) {
                  onImageClick();
                }
              }}
              onAyahSelect={onAyahSelect}
              currentPlayingAyah={isTransitioning ? null : currentPlayingAyah}
              mushafType={mushafType as 'tarteel' | 'tajweed'}
              isFullscreen={pageEnlarged}
              isFullscreenDarkMode={isFullscreenDarkMode}
              fillReserves={fillReserves}
              className={cn(
                "max-w-full w-auto h-auto mx-auto cursor-pointer transition-all duration-300 ease-out",
                imageMaxHeight
              )}
            />
            {/* Saved annotation layer (drawings) on top of the page —
                toggleable from the quick bar (Eye/EyeOff button) */}
            {showAnnotations && <AnnotationOverlay page={pageNum} />}
          </div>
        </div>
      );
    }
    
    // For non-Tarteel/Tajweed mushaf, wrap with long-press detection
    return (
      <div className="relative">
        {renderBookmarkIcons(pageNum, isOddPage ? 'right' : 'left')}
        <div
          aria-hidden="true"
          className={cn(
            'absolute top-0 z-[5] w-3 h-8 md:w-5 md:h-10 bg-emerald-800 shadow-sm',
            isOddPage ? 'left-0' : 'right-0'
          )}
          style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%)' }}
        />
        <div
          onTouchStart={(e) => handleTouchStart(e, pageNum)}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <div className="relative w-fit max-w-full mx-auto">
            <CachedImage
              src={`${getMushafPath()}/${getPageImageFilename(pageNum)}`}
              alt={`${t('page')} ${pageNum}`}
              className={cn(
                "block max-w-full w-auto h-auto object-contain cursor-pointer transition-all duration-300 ease-out",
                imageMaxHeight,
                isFullscreenDarkMode && "invert sepia-[0.2] brightness-[0.85]"
              )}
              // Fullscreen (image mushafs): measured band as max-height —
              // same fill-the-stage sizing as the annotation editor.
              style={measuredImageStyle}
              loading="lazy"
              cacheCategory={cacheCategory}
              onClick={(e) => {
                // Only trigger click if long press wasn't triggered
                if (!longPressTriggeredRef.current) {
                  onImageClick();
                }
              }}
            />
            {/* Saved annotation layer (drawings) on top of the page —
                toggleable from the quick bar (Eye/EyeOff button) */}
            {showAnnotations && <AnnotationOverlay page={pageNum} />}
          </div>
        </div>
      </div>
    );
  }, [
    loadedPages, 
    mushafType, 
    getMushafPath, 
    cacheCategory, 
    t, 
    onImageClick,
    onAyahSelect,
    currentPlayingAyah,
    isTransitioning,
    isFullscreen,
    isFullscreenDarkMode,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    renderBookmarkIcons,
    showAnnotations,
    fillReserves,
    fullscreenImageReservePx,
  ]);
  
  // Generate slides array
  const slides = Array.from({ length: 604 }, (_, i) => i + 1);
  
  // Calculate slides per view based on mode
  const slidesPerView = viewMode === 'double' && !isMobile ? 2 : 1;
  const slidesPerGroup = viewMode === 'double' && !isMobile ? 2 : 1;
  
  return (
    <main className={cn(
      "relative flex-1 flex items-center justify-center overflow-hidden min-h-0",
      isFullscreenDarkMode ? "bg-black" : "bg-[#FBF9F4]"
    )}>
      <Swiper
        key={swiperKey}
        modules={[Navigation, Virtual, Keyboard, A11y]}
        onSwiper={handleSwiperInit}
        onSlideChange={handleSlideChange}
        onTransitionEnd={handleTransitionEnd}
        initialSlide={initialPage - 1} // Swiper is 0-indexed
        slidesPerView={slidesPerView}
        slidesPerGroup={slidesPerGroup}
        spaceBetween={viewMode === 'double' && !isMobile ? 24 : 0}
        virtual={{
          enabled: true,
          addSlidesAfter: slidesPerGroup,
          addSlidesBefore: slidesPerGroup,
        }}
        dir={isRTL ? 'rtl' : 'ltr'}
        navigation={{
          enabled: !isMobile,
        }}
        keyboard={{
          enabled: true,
          onlyInViewport: true,
        }}
        speed={400}
        watchSlidesProgress={true}
        className={cn(
          'w-full h-full',
          // Fullscreen text mushafs: drop the 1280px cap so the page spans
          // the whole viewport width (edge-to-edge, no side margins on wide
          // screens). Everything else keeps the classic centered max-width.
          isFullscreen && isTextMushaf ? 'max-w-none' : 'max-w-7xl',
          isFullscreen && 'swiper-fullscreen',
          isFullscreenDarkMode && 'swiper-fullscreen-dark'
        )}
        style={{
          '--swiper-navigation-size': '28px',
        } as React.CSSProperties}
      >
        {slides.map((pageNum) => (
          <SwiperSlide key={pageNum} virtualIndex={pageNum - 1}>
            <div className={cn(
              "flex justify-center h-full w-full overflow-y-auto box-border",
              // Fullscreen (ALL mushaf types): no side padding so the page
              // spans the FULL viewport width — same as the annotation
              // editor's stage (a full-width absolute inset-0 flex box).
              // Text mushafs previously kept their side padding in
              // fullscreen, which left visible bands left/right of the
              // page. Normal mode keeps the classic side padding.
              isFullscreen ? "px-0" : "px-3 md:px-6",
              // Fullscreen text mushafs: a slim 2px breathing gap instead of
              // the classic 4px, so the text starts just below the header
              // overlay and ends just above the quick bar (fillReserves
              // matches this exactly).
              isFullscreen && isTextMushaf ? "py-0.5" : "py-1",
              // Text mushafs fill the content box from the top (after the
              // header) instead of centering over the full viewport.
              mushafType === 'tarteel' || mushafType === 'tajweed'
                ? "items-start"
                : "items-center",
              isFullscreenDarkMode ? "bg-black" : "bg-[#FBF9F4]"
            )}>
              {renderPage(pageNum)}
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
      {/* Loading gate: until the Swiper has initialized and applied the
          translate for the saved page, its DOM shows slide 0 (page 1). Cover
          the stage with an opaque loading overlay so the user never sees the
          wrong page — they see a brief loading state instead. */}
      {!isSwiperReady && (
        <div
          className={cn(
            "absolute inset-0 z-20 flex flex-col items-center justify-center gap-3",
            isFullscreenDarkMode ? "bg-black" : "bg-[#FBF9F4]"
          )}
        >
          <Loader2 className="w-10 h-10 animate-spin text-emerald-700" />
          <span className={cn(
            "text-sm select-none",
            isFullscreenDarkMode ? "text-neutral-300" : "text-emerald-900/70"
          )}>
            {t('loading')}
          </span>
        </div>
      )}
    </main>
  );
}
