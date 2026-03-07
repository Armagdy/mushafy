import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Virtual, Keyboard, A11y } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/virtual';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Bookmark, BookMarked, BookOpen } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMushaf } from '@/contexts/MushafContext';
import { getPageImageFilename } from '@/lib/quran-mapping';
import { CachedImage } from './CachedImage';
import TartelPage from './TartelPage';
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
  onImageClick: () => void;
  audioSource?: 'everyayah' | 'mp3quran';
  hasAyahTimings?: boolean;
  onLongPressNotification?: () => void;
  onSwiperReady?: (navigateToPage: (page: number) => void) => void;
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
  onImageClick,
  audioSource = 'everyayah',
  hasAyahTimings = true,
  onLongPressNotification,
  onSwiperReady,
}: SwiperPageDisplayProps) {
  const { t, isRTL } = useLanguage();
  const { getMushafPath, mushafType } = useMushaf();
  const { toast } = useToast();
  const swiperRef = useRef<SwiperType | null>(null);
  
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
  
  // Long-press detection for non-Tarteel mushaf
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);
  
  // Handle touch start for long press detection (non-Tarteel mushaf only)
  const handleTouchStart = useCallback((e: React.TouchEvent, pageNum: number) => {
    if (mushafType === 'tarteel') return;
    
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
  
  // Expose navigation method via callback
  useEffect(() => {
    if (swiperRef.current && onSwiperReady) {
      const navigateToPage = (pageNum: number) => {
        if (swiperRef.current) {
          swiperRef.current.slideTo(pageNum - 1, 400);
        }
      };
      onSwiperReady(navigateToPage);
    }
  }, [onSwiperReady]);
  
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
    
    if (mushafType === 'tarteel') {
      return (
        <div className="relative">
          {renderBookmarkIcons(pageNum, isOddPage ? 'right' : 'left')}
          <TartelPage
            pageNumber={pageNum}
            onClick={(e) => {
              if (!longPressTriggeredRef.current) {
                onImageClick();
              }
            }}
            onAyahSelect={onAyahSelect}
            currentPlayingAyah={currentPlayingAyah}
            className="max-w-full max-h-[calc(100dvh-170px)] w-auto h-auto mx-auto cursor-pointer"
          />
        </div>
      );
    }
    
    // For non-Tarteel mushaf, wrap with long-press detection
    return (
      <div className="relative">
        {renderBookmarkIcons(pageNum, isOddPage ? 'right' : 'left')}
        <div
          onTouchStart={(e) => handleTouchStart(e, pageNum)}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <CachedImage
            src={`${getMushafPath()}/${getPageImageFilename(pageNum)}`}
            alt={`${t('page')} ${pageNum}`}
            className="max-w-full max-h-[calc(100dvh-170px)] w-auto h-auto object-contain mx-auto cursor-pointer"
            loading="lazy"
            cacheCategory={cacheCategory}
            onClick={(e) => {
              // Only trigger click if long press wasn't triggered
              if (!longPressTriggeredRef.current) {
                onImageClick();
              }
            }}
          />
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
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    renderBookmarkIcons,
  ]);
  
  // Generate slides array
  const slides = Array.from({ length: 604 }, (_, i) => i + 1);
  
  // Calculate slides per view based on mode
  const slidesPerView = viewMode === 'double' && !isMobile ? 2 : 1;
  const slidesPerGroup = viewMode === 'double' && !isMobile ? 2 : 1;
  
  return (
    <main className="flex-1 flex items-center justify-center overflow-hidden min-h-0 bg-[#FBF9F4]">
      <Swiper
        modules={[Navigation, Virtual, Keyboard, A11y]}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
        }}
        onSlideChange={handleSlideChange}
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
          'w-full h-full max-w-7xl',
          isFullscreen && 'swiper-fullscreen'
        )}
        style={{
          '--swiper-navigation-size': '28px',
        } as React.CSSProperties}
      >
        {slides.map((pageNum) => (
          <SwiperSlide key={pageNum} virtualIndex={pageNum - 1}>
            <div className="flex items-center justify-center h-full w-full py-1">
              {renderPage(pageNum)}
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </main>
  );
}
