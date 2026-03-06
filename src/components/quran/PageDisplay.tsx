import { ChevronLeft, ChevronRight, Bookmark, BookMarked, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMushaf } from '@/contexts/MushafContext';
import { getPageImageFilename } from '@/lib/quran-mapping';
import { CachedImage } from './CachedImage';
import TartelPage from './TartelPage';
import { useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface PageDisplayProps {
  currentPageNum: number;
  secondPageNum: number;
  leftPageNum: number;
  rightPageNum: number;
  viewMode: 'single' | 'double';
  isMobile: boolean;
  bookmarks: number[];
  memorizationBookmarks: number[];
  readingBookmarks: number[];
  pagesToLoad: number;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onScroll: () => void;
  isFullscreen: boolean;
  onImageClick: () => void;
  onAyahSelect?: (surah: number, ayah: number) => void;
  currentPlayingAyah?: { surah: number; ayah: number } | null;
  onLongPressNotification?: () => void;
  audioSource?: 'everyayah' | 'mp3quran';
  hasAyahTimings?: boolean;
}

export function PageDisplay({
  currentPageNum,
  secondPageNum,
  leftPageNum,
  rightPageNum,
  viewMode,
  isMobile,
  bookmarks,
  memorizationBookmarks,
  readingBookmarks,
  pagesToLoad,
  scrollContainerRef,
  onPreviousPage,
  onNextPage,
  onScroll,
  isFullscreen,
  onImageClick,
  onAyahSelect,
  currentPlayingAyah,
  onLongPressNotification,
  audioSource = 'everyayah',
  hasAyahTimings = true
}: PageDisplayProps) {
  const { t, isRTL } = useLanguage();
  const { getMushafPath, mushafType } = useMushaf();
  const { toast } = useToast();
  
  // All mushaf types now use the same styling
  const isTashelOrMadinah = true;
  
  // Cache category for auto-caching viewed pages
  const cacheCategory = `mushaf-${mushafType}`;
  
  // Long-press detection for non-Tarteel mushaf
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);
  
  // Handle touch start for long press detection (non-Tarteel mushaf only)
  const handleTouchStart = (e: React.TouchEvent) => {
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
    }, 500); // 500ms long press
  };
  
  // Handle touch move - cancel long press if finger moves too much
  const handleTouchMove = (e: React.TouchEvent) => {
    if (mushafType === 'tarteel' || !touchStartPosRef.current) return;
    
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
  };
  
  // Handle touch end - cleanup
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (mushafType === 'tarteel') return;
    
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    // If long press was triggered, prevent click event
    if (longPressTriggeredRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    touchStartPosRef.current = null;
  };

  // Helper to render the appropriate page component based on mushaf type
  const renderPage = (pageNum: number) => {
    if (mushafType === 'tarteel') {
      return (
        <TartelPage
          pageNumber={pageNum}
          onClick={onImageClick}
          onAyahSelect={onAyahSelect}
          currentPlayingAyah={currentPlayingAyah}
          className="relative max-w-full max-h-[calc(100dvh-170px)] w-auto h-auto mx-auto cursor-pointer"
        />
      );
    }

    // For non-Tarteel mushaf, wrap with long-press detection
    return (
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <CachedImage
          src={`${getMushafPath()}/${getPageImageFilename(pageNum)}`}
          alt={`${t('page')} ${pageNum}`}
          className="relative max-w-full max-h-[calc(100dvh-170px)] w-auto h-auto object-contain mx-auto cursor-pointer"
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
    );
  };

  return (
    <main className="flex-1 flex items-center justify-center gap-6 overflow-hidden min-h-0 bg-[#FBF9F4]">
      {/* Navigation Arrow Left - Hidden on mobile */}
      <motion.button
        whileHover={{ scale: 1.1, x: -5 }}
        whileTap={{ scale: 0.9 }}
        onClick={onPreviousPage}
        disabled={currentPageNum <= 2}
        className="hidden md:flex w-14 h-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-700 to-emerald-600 text-[#F2E3BB] hover:from-emerald-800 hover:to-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl border border-emerald-500/30 disabled:hover:scale-100"
        aria-label="Previous pages"
      >
        <ChevronRight className="w-7 h-7" />
      </motion.button>

      {/* Page Display Container */}
      <div className="flex-1 flex items-center justify-center gap-6 max-w-7xl">
        {viewMode === 'double' && !isMobile ? (
          <div 
            key={`${currentPageNum}-${secondPageNum}`}
            className="flex-1 flex items-center justify-center gap-6 max-w-7xl"
          >
              {/* In LTR: show left page first, then right */}
              {/* In RTL: show right page first, then left (for RTL flex direction) */}
              {!isRTL ? (
                <>
                  {/* Left Page */}
                  {leftPageNum > 0 && leftPageNum <= 604 && (
                    <div key={`left-${leftPageNum}`} className={`flex-1 max-w-[600px] h-full flex items-center justify-center ${isTashelOrMadinah ? 'py-1' : ''}`}>
                      <div className="relative group">
                        {(bookmarks.includes(leftPageNum) || memorizationBookmarks.includes(leftPageNum) || readingBookmarks.includes(leftPageNum)) && (
                          <div key={`left-icons-${leftPageNum}-${bookmarks.includes(leftPageNum)}-${memorizationBookmarks.includes(leftPageNum)}-${readingBookmarks.includes(leftPageNum)}`} className="absolute top-0 left-0 z-10 flex gap-0.5 -translate-x-1">
                            {bookmarks.includes(leftPageNum) && (
                              <Bookmark className="w-6 h-6 md:w-8 md:h-8 fill-amber-500 text-amber-500 drop-shadow-lg" />
                            )}
                            {memorizationBookmarks.includes(leftPageNum) && (
                              <BookMarked className="w-6 h-6 md:w-8 md:h-8 fill-emerald-600 text-emerald-600 drop-shadow-lg" />
                            )}
                            {readingBookmarks.includes(leftPageNum) && (
                              <BookOpen className="w-6 h-6 md:w-8 md:h-8 fill-blue-600 text-blue-600 drop-shadow-lg" />
                            )}
                          </div>
                        )}
                        {renderPage(leftPageNum)}
                      </div>
                    </div>
                  )}
                  {/* Right Page */}
                  {rightPageNum > 0 && rightPageNum <= 604 && (
                    <div key={`right-${rightPageNum}`} className={`flex-1 max-w-[600px] h-full flex items-center justify-center ${isTashelOrMadinah ? 'py-1' : ''}`}>
                      <div className="relative group">
                        {(bookmarks.includes(rightPageNum) || memorizationBookmarks.includes(rightPageNum) || readingBookmarks.includes(rightPageNum)) && (
                          <div key={`right-icons-${rightPageNum}-${bookmarks.includes(rightPageNum)}-${memorizationBookmarks.includes(rightPageNum)}-${readingBookmarks.includes(rightPageNum)}`} className="absolute top-0 right-0 z-10 flex gap-0.5 translate-x-1">
                            {bookmarks.includes(rightPageNum) && (
                              <Bookmark className="w-6 h-6 md:w-8 md:h-8 fill-amber-500 text-amber-500 drop-shadow-lg" />
                            )}
                            {memorizationBookmarks.includes(rightPageNum) && (
                              <BookMarked className="w-6 h-6 md:w-8 md:h-8 fill-emerald-600 text-emerald-600 drop-shadow-lg" />
                            )}
                            {readingBookmarks.includes(rightPageNum) && (
                              <BookOpen className="w-6 h-6 md:w-8 md:h-8 fill-blue-600 text-blue-600 drop-shadow-lg" />
                            )}
                          </div>
                        )}
                        {renderPage(rightPageNum)}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Right Page (shown first in RTL) */}
                  {rightPageNum > 0 && rightPageNum <= 604 && (
                    <div key={`right-rtl-${rightPageNum}`} className={`flex-1 max-w-[600px] h-full flex items-center justify-center ${isTashelOrMadinah ? 'py-1' : ''}`}>
                      <div className="relative group">
                        {(bookmarks.includes(rightPageNum) || memorizationBookmarks.includes(rightPageNum) || readingBookmarks.includes(rightPageNum)) && (
                          <div key={`right-rtl-icons-${rightPageNum}-${bookmarks.includes(rightPageNum)}-${memorizationBookmarks.includes(rightPageNum)}-${readingBookmarks.includes(rightPageNum)}`} className="absolute top-0 right-0 z-10 flex gap-0.5 translate-x-1">
                            {bookmarks.includes(rightPageNum) && (
                              <Bookmark className="w-6 h-6 md:w-8 md:h-8 fill-amber-500 text-amber-500 drop-shadow-lg" />
                            )}
                            {memorizationBookmarks.includes(rightPageNum) && (
                              <BookMarked className="w-6 h-6 md:w-8 md:h-8 fill-emerald-600 text-emerald-600 drop-shadow-lg" />
                            )}
                            {readingBookmarks.includes(rightPageNum) && (
                              <BookOpen className="w-6 h-6 md:w-8 md:h-8 fill-blue-600 text-blue-600 drop-shadow-lg" />
                            )}
                          </div>
                        )}
                        {renderPage(rightPageNum)}
                      </div>
                    </div>
                  )}
                  {/* Left Page (shown second in RTL) */}
                  {leftPageNum > 0 && leftPageNum <= 604 && (
                    <div key={`left-rtl-${leftPageNum}`} className={`flex-1 max-w-[600px] h-full flex items-center justify-center ${isTashelOrMadinah ? 'py-1' : ''}`}>
                      <div className="relative group">
                        {(bookmarks.includes(leftPageNum) || memorizationBookmarks.includes(leftPageNum) || readingBookmarks.includes(leftPageNum)) && (
                          <div key={`left-rtl-icons-${leftPageNum}-${bookmarks.includes(leftPageNum)}-${memorizationBookmarks.includes(leftPageNum)}-${readingBookmarks.includes(leftPageNum)}`} className="absolute top-0 left-0 z-10 flex gap-0.5 -translate-x-1">
                            {bookmarks.includes(leftPageNum) && (
                              <Bookmark className="w-6 h-6 md:w-8 md:h-8 fill-amber-500 text-amber-500 drop-shadow-lg" />
                            )}
                            {memorizationBookmarks.includes(leftPageNum) && (
                              <BookMarked className="w-6 h-6 md:w-8 md:h-8 fill-emerald-600 text-emerald-600 drop-shadow-lg" />
                            )}
                            {readingBookmarks.includes(leftPageNum) && (
                              <BookOpen className="w-6 h-6 md:w-8 md:h-8 fill-blue-600 text-blue-600 drop-shadow-lg" />
                            )}
                          </div>
                        )}
                        {renderPage(leftPageNum)}
                      </div>
                    </div>
                  )}
                </>
              )}
          </div>
        ) : (
          /* Horizontal Scroll View - Single Page Mode */
          <div 
            ref={scrollContainerRef}
            onScroll={onScroll}
            className="flex-1 w-full h-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory flex"
            style={{ 
              scrollbarWidth: 'none', 
              msOverflowStyle: 'none',
              direction: isRTL ? 'rtl' : 'ltr'
            }}
          >
            <style>{`
              div::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            {/* Only render current page and adjacent pages based on pagesToLoad setting */}
            {(() => {
              const pages: (number | null)[] = [];
              // Add previous pages
              for (let i = pagesToLoad; i >= 1; i--) {
                const pageNum = currentPageNum - i;
                pages.push(pageNum >= 1 ? pageNum : null);
              }
              // Add current page
              pages.push(currentPageNum);
              // Add next pages
              for (let i = 1; i <= pagesToLoad; i++) {
                const pageNum = currentPageNum + i;
                pages.push(pageNum <= 604 ? pageNum : null);
              }
              return pages.filter((pageNum): pageNum is number => pageNum !== null);
            })().map((pageNum, index) => {
              const imageFilename = getPageImageFilename(pageNum);
              const isOddPage = pageNum % 2 !== 0; // Odd pages are right pages
              console.log(`Rendering page ${pageNum}: ${getMushafPath()}/${imageFilename}`);
              return (
              <div
                key={pageNum}
                id={`page-${pageNum}`}
                className={`flex-shrink-0 h-full flex items-center justify-center snap-center ${isTashelOrMadinah ? 'py-1' : ''}`}
                style={{ width: '100%', minWidth: '100%' }}
              >
                <div className={`relative flex items-center justify-center ${mushafType === 'tashel' ? 'px-2' : ''}`}>
                  {/* Bookmark indicator */}
                  {(bookmarks.includes(pageNum) || memorizationBookmarks.includes(pageNum) || readingBookmarks.includes(pageNum)) && (
                    <div key={`single-icons-${pageNum}-${bookmarks.includes(pageNum)}-${memorizationBookmarks.includes(pageNum)}-${readingBookmarks.includes(pageNum)}`} className={`absolute top-0 ${pageNum % 2 !== 0 ? 'right-0 translate-x-1' : 'left-0 -translate-x-1'} z-10 flex gap-0.5`}>
                      {bookmarks.includes(pageNum) && (
                        <Bookmark className="w-6 h-6 md:w-8 md:h-8 fill-amber-500 text-amber-500 drop-shadow-lg" />
                      )}
                      {memorizationBookmarks.includes(pageNum) && (
                        <BookMarked className="w-6 h-6 md:w-8 md:h-8 fill-emerald-600 text-emerald-600 drop-shadow-lg" />
                      )}
                      {readingBookmarks.includes(pageNum) && (
                        <BookOpen className="w-6 h-6 md:w-8 md:h-8 fill-blue-600 text-blue-600 drop-shadow-lg" />
                      )}
                    </div>
                  )}
                  {/* Page marker/bookmark icon */}
                  <div 
                    className={`absolute top-0 ${isOddPage ? 'left-0' : 'right-0'} z-10 pointer-events-none`}
                    style={{ 
                      filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
                    }}
                  >
                    <svg 
                      width="10" 
                      height="70" 
                      viewBox="0 0 10 70" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                      className="opacity-80"
                    >
                      {/* Bookmark ribbon shape */}
                      <path 
                        d="M0 0 L10 0 L10 70 L5 60 L0 70 Z" 
                        fill="url(#bookmarkGradient)" 
                        stroke="#000000"
                        strokeWidth="0.5"
                      />
                      <defs>
                        <linearGradient id="bookmarkGradient" x1="5" y1="0" x2="5" y2="70">
                          <stop offset="0%" stopColor="#166534" />
                          <stop offset="100%" stopColor="#14532d" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  {renderPage(pageNum)}
                </div>
              </div>
            );})}
          </div>
        )}
      </div>

      {/* Navigation Arrow Right - Hidden on mobile */}
      <motion.button
        whileHover={{ scale: 1.1, x: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={onNextPage}
        disabled={currentPageNum >= 604}
        className="hidden md:flex w-14 h-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-700 to-emerald-600 text-[#F2E3BB] hover:from-emerald-800 hover:to-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl border border-emerald-500/30 disabled:hover:scale-100"
        aria-label="Next pages"
      >
        <ChevronLeft className="w-7 h-7" />
      </motion.button>
    </main>
  );
}
