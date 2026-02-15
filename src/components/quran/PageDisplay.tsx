import { ChevronLeft, ChevronRight, Bookmark, BookMarked, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMushaf } from '@/contexts/MushafContext';
import { getPageImageFilename } from '@/lib/quran-mapping';
import { CachedImage } from './CachedImage';

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
  onScroll
}: PageDisplayProps) {
  const { t, isRTL } = useLanguage();
  const { getMushafPath, mushafType } = useMushaf();
  
  // All mushaf types now use the same styling
  const isTashelOrMadinah = true;
  
  // Cache category for auto-caching viewed pages
  const cacheCategory = `mushaf-${mushafType}`;

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
          <AnimatePresence mode="wait" initial={false}>
            <motion.div 
              key={`${currentPageNum}-${secondPageNum}`}
              initial={{ x: isRTL ? -100 : 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: isRTL ? 100 : -100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex-1 flex items-center justify-center gap-6 max-w-7xl"
            >
              {/* In LTR: show left page first, then right */}
              {/* In RTL: show right page first, then left (for RTL flex direction) */}
              {!isRTL ? (
                <>
                  {/* Left Page */}
                  {leftPageNum > 0 && leftPageNum <= 604 && (
                    <div className={`flex-1 max-w-[600px] h-full flex items-center justify-center ${isTashelOrMadinah ? 'py-1' : ''}`}>
                      <div className="relative group">
                        {(bookmarks.includes(leftPageNum) || memorizationBookmarks.includes(leftPageNum) || readingBookmarks.includes(leftPageNum)) && (
                          <div className="absolute top-0 left-0 z-10 flex gap-0.5 -translate-x-1">
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
                        <CachedImage
                          src={`${getMushafPath()}/${getPageImageFilename(leftPageNum)}`}
                          alt={`${t('page')} ${leftPageNum}`}
                          className="relative max-w-full max-h-[calc(100dvh-170px)] w-auto h-auto object-contain shadow-2xl rounded-xl border-4 border-white mx-auto"
                          loading="lazy"
                          cacheCategory={cacheCategory}
                        />
                      </div>
                    </div>
                  )}
                  {/* Right Page */}
                  {rightPageNum > 0 && rightPageNum <= 604 && (
                    <div className={`flex-1 max-w-[600px] h-full flex items-center justify-center ${isTashelOrMadinah ? 'py-1' : ''}`}>
                      <div className="relative group">
                        {(bookmarks.includes(rightPageNum) || memorizationBookmarks.includes(rightPageNum) || readingBookmarks.includes(rightPageNum)) && (
                          <div className="absolute top-0 right-0 z-10 flex gap-0.5 translate-x-1">
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
                        <CachedImage
                          src={`${getMushafPath()}/${getPageImageFilename(rightPageNum)}`}
                          alt={`${t('page')} ${rightPageNum}`}
                          className="relative max-w-full max-h-[calc(100dvh-170px)] w-auto h-auto object-contain shadow-2xl rounded-xl border-4 border-white mx-auto"
                          loading="lazy"
                          cacheCategory={cacheCategory}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Right Page (shown first in RTL) */}
                  {rightPageNum > 0 && rightPageNum <= 604 && (
                    <div className={`flex-1 max-w-[600px] h-full flex items-center justify-center ${isTashelOrMadinah ? 'py-1' : ''}`}>
                      <div className="relative group">
                        {(bookmarks.includes(rightPageNum) || memorizationBookmarks.includes(rightPageNum) || readingBookmarks.includes(rightPageNum)) && (
                          <div className="absolute top-0 right-0 z-10 flex gap-0.5 translate-x-1">
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
                        <CachedImage
                          src={`${getMushafPath()}/${getPageImageFilename(rightPageNum)}`}
                          alt={`${t('page')} ${rightPageNum}`}
                          className="relative max-w-full max-h-[calc(100dvh-170px)] w-auto h-auto object-contain shadow-2xl rounded-xl border-4 border-white mx-auto"
                          loading="lazy"
                          cacheCategory={cacheCategory}
                        />
                      </div>
                    </div>
                  )}
                  {/* Left Page (shown second in RTL) */}
                  {leftPageNum > 0 && leftPageNum <= 604 && (
                    <div className={`flex-1 max-w-[600px] h-full flex items-center justify-center ${isTashelOrMadinah ? 'py-1' : ''}`}>
                      <div className="relative group">
                        {(bookmarks.includes(leftPageNum) || memorizationBookmarks.includes(leftPageNum) || readingBookmarks.includes(leftPageNum)) && (
                          <div className="absolute top-0 left-0 z-10 flex gap-0.5 -translate-x-1">
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
                        <CachedImage
                          src={`${getMushafPath()}/${getPageImageFilename(leftPageNum)}`}
                          alt={`${t('page')} ${leftPageNum}`}
                          className="relative max-w-full max-h-[calc(100dvh-170px)] w-auto h-auto object-contain shadow-2xl rounded-xl border-4 border-white mx-auto"
                          loading="lazy"
                          cacheCategory={cacheCategory}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          /* Horizontal Scroll View - Single Page Mode */
          <div 
            ref={scrollContainerRef}
            onScroll={onScroll}
            className="flex-1 w-full h-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth flex"
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
                    <div className={`absolute top-0 ${pageNum % 2 !== 0 ? 'right-0 translate-x-1' : 'left-0 -translate-x-1'} z-10 flex gap-0.5`}>
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
                  <CachedImage
                    src={`${getMushafPath()}/${imageFilename}`}
                    alt={`${t('page')} ${pageNum}`}
                    className="max-w-full max-h-[calc(100dvh-170px)] w-auto h-auto object-contain md:shadow-2xl md:rounded-xl md:border-4 md:border-white mx-auto"
                    loading="eager"
                    cacheCategory={cacheCategory}
                  />
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
