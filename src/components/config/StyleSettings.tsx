import React from "react";
import { Switch } from "@/components/ui/switch";
import { Book, Menu, Moon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { useDarkMode } from "@/contexts/DarkModeContext";
import { cn } from "@/lib/utils";

interface StyleSettingsProps {
  isMobile: boolean;
  viewMode: 'single' | 'double';
  onViewModeChange: (mode: 'single' | 'double') => void;
  showBottomBarText: boolean;
  onShowBottomBarTextChange: (show: boolean) => void;
}

export function StyleSettings({
  isMobile,
  viewMode,
  onViewModeChange,
  showBottomBarText,
  onShowBottomBarTextChange,
}: StyleSettingsProps) {
  const { t, isRTL } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const { isDarkMode, setIsDarkMode } = useDarkMode();
  
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);

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

      {/* Dark Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Moon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
            {t('darkMode')}
          </span>
        </div>
        <div dir="ltr">
          <Switch
            checked={isDarkMode}
            onCheckedChange={setIsDarkMode}
          />
        </div>
      </div>
    </div>
  );
}
