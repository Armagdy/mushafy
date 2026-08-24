 import { motion } from 'framer-motion';
import { Navigation, Search, Bookmark, Settings, BookText, GraduationCap } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

type ActiveBottomButton = 'navigation' | 'search' | 'tafseer' | 'bookmarks' | 'settings' | null;

interface BottomBarProps {
  showBottomBarText: boolean;
  totalBookmarks: number;
  isMobile: boolean;
  viewMode: 'single' | 'double';
  activeButton?: ActiveBottomButton;
  theme?: 'green' | 'glass';
  onGoToClick: () => void;
  onSearchClick: () => void;
  onBookmarkClick: () => void;
  onSettingsClick: () => void;
  onTafseerClick: () => void;
  onViewModeToggle: () => void;
}

export function BottomBar({
  showBottomBarText,
  totalBookmarks,
  isMobile,
  viewMode,
  activeButton = null,
  theme = 'green',
  onGoToClick,
  onSearchClick,
  onBookmarkClick,
  onSettingsClick,
  onTafseerClick,
  onViewModeToggle,
}: BottomBarProps) {
  const { isRTL, t } = useLanguage();

  const activeIconClass = "text-emerald-800";
  const inactiveIconClass = theme === 'glass'
    ? "text-emerald-800 group-hover:text-emerald-900"
    : "text-[#F2E3BB] group-hover:text-white";
  const inactiveTextClass = theme === 'glass'
    ? "text-emerald-800 group-hover:text-emerald-900"
    : "text-[#F2E3BB] group-hover:text-white";
  const viewToggleClass = theme === 'glass'
    ? "text-emerald-800 hover:text-emerald-900"
    : "text-[#F2E3BB] hover:text-white";

  const buttons = [
    { key: 'navigation' as const, icon: Navigation, label: isRTL ? 'انتقل' : 'Go To', onClick: onGoToClick, title: t('search') },
    { key: 'search' as const, icon: Search, label: isRTL ? 'بحث' : 'Search', onClick: onSearchClick, title: isRTL ? 'بحث عن كلمة' : 'Word Search' },
    { key: 'tafseer' as const, icon: BookText, label: t('tafseer'), onClick: onTafseerClick, title: t('tafseer') },
    { key: 'bookmarks' as const, icon: Bookmark, label: isRTL ? 'علامة' : t('bookmark'), onClick: onBookmarkClick, title: t('bookmarks') },
    { key: 'settings' as const, icon: Settings, label: t('settings'), onClick: onSettingsClick, title: t('settings') },
  ];

  return (
    <div 
      className={cn(
        "px-2 md:px-6 flex items-stretch justify-between",
        showBottomBarText ? "pt-1 md:pt-1.5 pb-0.5 md:pb-1" : "pt-1.5 md:pt-2 pb-2 md:pb-3"
      )}
      style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + 0.25rem)` }}
    >
      {buttons.map(({ key, icon: Icon, label, onClick, title }) => {
        const isActive = activeButton === key;
        return (
          <div key={key} className="flex-1 flex justify-center relative">
            {/* Animated shared background — slides between buttons via layoutId */}
            {isActive && (
              <motion.div
                layoutId="bottom-bar-active-bg"
                className="absolute inset-0 bg-[#F2E3BB] rounded-xl pt-1.5"
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
            )}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={onClick}
              className="relative flex flex-col items-center gap-0.5 md:gap-1 transition-colors group w-full py-1.5 pt-2"
              title={title}
            >
              {key === 'bookmarks' ? (
                <div className="relative">
                  <Icon className={cn("w-7 h-7 md:w-8 md:h-8 transition-colors", isActive ? activeIconClass : inactiveIconClass)} />
                  {totalBookmarks > 0 && (
                    <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[8px] rounded-full min-w-[12px] h-3 px-1 flex items-center justify-center">
                      {totalBookmarks}
                    </span>
                  )}
                </div>
              ) : (
                <Icon className={cn("w-7 h-7 md:w-8 md:h-8 transition-colors", isActive ? activeIconClass : inactiveIconClass)} />
              )}
              {showBottomBarText && (
                <span className={cn("text-base md:text-xl font-medium transition-colors", isActive ? activeIconClass : inactiveTextClass)}>
                  {label}
                </span>
              )}
            </motion.button>
          </div>
        );
      })}

      {/* View Mode Toggle - Hidden on mobile */}
      {!isMobile && (
        <div className="flex-1 flex justify-center">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onViewModeToggle}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors group",
              viewToggleClass
            )}
            title={viewMode === 'single' ? (isRTL ? 'عرض صفحتين' : 'Two Pages') : (isRTL ? 'صفحة واحدة' : 'Single Page')}
          >
            <div className={cn("relative w-8 h-8", viewToggleClass)}>
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
    </div>
  );
}
