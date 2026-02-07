 import { motion } from 'framer-motion';
import { Navigation, Search, Bookmark, Settings } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface BottomBarProps {
  showBottomBarText: boolean;
  totalBookmarks: number;
  isMobile: boolean;
  viewMode: 'single' | 'double';
  onGoToClick: () => void;
  onSearchClick: () => void;
  onBookmarkClick: () => void;
  onSettingsClick: () => void;
  onViewModeToggle: () => void;
}

export function BottomBar({
  showBottomBarText,
  totalBookmarks,
  isMobile,
  viewMode,
  onGoToClick,
  onSearchClick,
  onBookmarkClick,
  onSettingsClick,
  onViewModeToggle,
}: BottomBarProps) {
  const { isRTL, t } = useLanguage();

  return (
    <motion.div 
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className={cn(
        "bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg px-2 md:px-6 flex items-stretch justify-between mt-2",
        showBottomBarText ? "py-0.5 md:py-1" : "py-2 md:py-3"
      )}
    >
      {/* Go To */}
      <div className="flex-1 flex justify-center">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onGoToClick}
          className="flex flex-col items-center gap-0.5 md:gap-1 text-gray-600 dark:text-gray-300 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors group"
          title={t('search')}
        >
          <Navigation className="w-7 h-7 md:w-8 md:h-8 group-hover:fill-emerald-500/20" />
          {showBottomBarText && <span className="text-base md:text-xl font-medium">{isRTL ? 'انتقل' : 'Go To'}</span>}
        </motion.button>
      </div>

      {/* Word Search */}
      <div className="flex-1 flex justify-center">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onSearchClick}
          className="flex flex-col items-center gap-0.5 md:gap-1 text-gray-600 dark:text-gray-300 hover:text-purple-500 dark:hover:text-purple-400 transition-colors group"
          title={isRTL ? 'بحث عن كلمة' : 'Word Search'}
        >
          <Search className="w-7 h-7 md:w-8 md:h-8 group-hover:fill-purple-500/20" />
          {showBottomBarText && <span className="text-base md:text-xl font-medium">{isRTL ? ' بحث' : 'Search'}</span>}
        </motion.button>
      </div>

      {/* Bookmark Button */}
      <div className="flex-1 flex justify-center">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onBookmarkClick}
          className="flex flex-col items-center gap-0.5 md:gap-1 text-gray-600 dark:text-gray-300 hover:text-amber-500 dark:hover:text-amber-400 transition-colors group"
          title={t('bookmarks')}
        >
          <div className="relative">
            <Bookmark className="w-7 h-7 md:w-8 md:h-8 group-hover:fill-amber-500/20" />
            {totalBookmarks > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[8px] rounded-full min-w-[12px] h-3 px-1 flex items-center justify-center">
                {totalBookmarks}
              </span>
            )}
          </div>
          {showBottomBarText && <span className="text-base md:text-xl font-medium">{isRTL ? 'علامة' : t('bookmark')}</span>}
        </motion.button>
      </div>

      {/* Settings */}
      <div className="flex-1 flex justify-center">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onSettingsClick}
          className="flex flex-col items-center gap-0.5 md:gap-1 text-gray-600 dark:text-gray-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors group"
          title={t('settings')}
        >
          <Settings className="w-7 h-7 md:w-8 md:h-8 group-hover:fill-indigo-500/20" />
          {showBottomBarText && <span className="text-base md:text-xl font-medium">{t('settings')}</span>}
        </motion.button>
      </div>

      {/* View Mode Toggle - Hidden on mobile */}
      {!isMobile && (
        <div className="flex-1 flex justify-center">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onViewModeToggle}
            className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors group"
            title={viewMode === 'single' ? (isRTL ? 'عرض صفحتين' : 'Two Pages') : (isRTL ? 'صفحة واحدة' : 'Single Page')}
          >
            <div className="relative w-8 h-8">
              {viewMode === 'single' ? (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="7" y="4" width="10" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="4" y="4" width="7" height="16" rx="1" />
                  <rect x="13" y="4" width="7" height="16" rx="1" />
                </svg>
              )}
            </div>
            {showBottomBarText && <span className="text-base md:text-xl font-medium">
              {viewMode === 'single' ? (isRTL ? 'صفحتين' : '2 Pages') : (isRTL ? 'صفحة' : '1 Page')}
            </span>}
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}
