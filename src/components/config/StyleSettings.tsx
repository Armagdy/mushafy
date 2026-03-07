import React from "react";
import { Switch } from "@/components/ui/switch";
import { Book, Navigation, Menu } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { cn } from "@/lib/utils";

interface StyleSettingsProps {
  isMobile: boolean;
  viewMode: 'single' | 'double';
  onViewModeChange: (mode: 'single' | 'double') => void;
  pagesToLoad: number;
  onPagesToLoadChange: (pages: number) => void;
  showBottomBarText: boolean;
  onShowBottomBarTextChange: (show: boolean) => void;
}

export function StyleSettings({
  isMobile,
  viewMode,
  onViewModeChange,
  pagesToLoad,
  onPagesToLoadChange,
  showBottomBarText,
  onShowBottomBarTextChange,
}: StyleSettingsProps) {
  const { t, isRTL } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);

  const updatePagesToLoad = (pages: number) => {
    onPagesToLoadChange(pages);
    localStorage.setItem('quran-pages-to-load', pages.toString());
  };

  return (
    <div className="space-y-4">
      {/* View Mode Setting - Hide on mobile */}
      {!isMobile && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Book className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
              {isRTL ? 'وضع العرض' : 'View Mode'}
            </span>
          </div>
          <button
            onClick={() => onViewModeChange(viewMode === 'single' ? 'double' : 'single')}
            className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 rounded-lg px-3 md:px-4 h-8 md:h-10 border border-emerald-600 shadow-md transition-all"
          >
            <span className={cn("text-[#F2E3BB] font-bold", textSizeClasses.button)}>
              {viewMode === 'single' ? (isRTL ? 'صفحتين' : '2 Pages') : (isRTL ? 'صفحة' : '1 Page')}
            </span>
          </button>
        </div>
      )}

      {/* Pages to Load Setting - Only show in single page mode or mobile */}
      {(viewMode === 'single' || isMobile) && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <Navigation className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
              {isRTL ? 'الصفحات المحملة' : 'Swipe Sensitivity'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => pagesToLoad > 1 && updatePagesToLoad(pagesToLoad - 1)}
                disabled={pagesToLoad <= 1}
                className="flex items-center justify-center bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg h-10 md:h-12 w-10 md:w-12 border border-emerald-600 shadow-md transition-all"
              >
                <span className={cn("text-[#F2E3BB] font-bold", textSizeClasses.button)}>-</span>
              </button>
              <div className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-white dark:bg-emerald-950 rounded-md border border-emerald-300 dark:border-emerald-700">
                  <span className={cn("font-medium text-emerald-800 dark:text-emerald-200", textSizeClasses.text)}>{pagesToLoad}</span>
                  <span className={cn("text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
                  {pagesToLoad === 1 ? (isRTL ? 'صفحة' : 'page') : (isRTL ? 'صفحات' : 'pages')}
                </span>
              </div>
              <button
                onClick={() => pagesToLoad < 5 && updatePagesToLoad(pagesToLoad + 1)}
                disabled={pagesToLoad >= 5}
                className="flex items-center justify-center bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg h-10 md:h-12 w-10 md:w-12 border border-emerald-600 shadow-md transition-all"
              >
                <span className={cn("text-[#F2E3BB] font-bold", textSizeClasses.button)}>+</span>
              </button>
            </div>
            <p className={cn("text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
              {isRTL 
                ? 'يحدد عدد الصفحات التي يمكنك التمرير إليها بحركة واحدة' 
                : 'Controls how many pages you can swipe at once'}
            </p>
          </div>
        </div>
      )}

      {/* Swiper Mode Toggle (Hidden - Swiper is now default) */}

      {/* Bottom Bar Text Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Menu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
            {isRTL ? 'إظهار نص الشريط السفلي' : 'Show Bottom Bar Text'}
          </span>
        </div>
        <div dir="ltr">
          <Switch
            checked={showBottomBarText}
            onCheckedChange={(checked) => {
              onShowBottomBarTextChange(checked);
              localStorage.setItem('quran-show-bottom-bar-text', String(checked));
            }}
          />
        </div>
      </div>
    </div>
  );
}
