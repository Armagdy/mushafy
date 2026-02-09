import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { BookOpen, Book, Navigation, Menu } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMushaf, MushafType } from "@/contexts/MushafContext";
import { cn } from "@/lib/utils";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  viewMode: 'single' | 'double';
  onViewModeChange: (mode: 'single' | 'double') => void;
  pagesToLoad: number;
  onPagesToLoadChange: (pages: number) => void;
  showBottomBarText: boolean;
  onShowBottomBarTextChange: (show: boolean) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  isMobile,
  viewMode,
  onViewModeChange,
  pagesToLoad,
  onPagesToLoadChange,
  showBottomBarText,
  onShowBottomBarTextChange,
}: SettingsDialogProps) {
  const { t, isRTL, language } = useLanguage();
  const { mushafType, setMushafType } = useMushaf();

  const updatePagesToLoad = (pages: number) => {
    onPagesToLoadChange(pages);
    localStorage.setItem('quran-pages-to-load', String(pages));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "sm:max-w-md max-w-[90vw] max-h-[85vh] overflow-y-auto",
        "rounded-xl border border-emerald-500",
        isRTL ? "rtl" : "ltr"
      )}>
        <DialogHeader>
          <DialogTitle className="text-center text-base md:text-xl font-bold bg-gradient-to-r from-emerald-800 to-emerald-600 bg-clip-text text-transparent">
            {t('settings')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2 sm:space-y-3">
          {/* Mushaf Type Setting */}
          <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-2 sm:gap-3">
              <BookOpen className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              <span className="text-base md:text-xl font-medium">{t('mushafType')}</span>
            </div>
            <Select value={mushafType} onValueChange={(value) => setMushafType(value as MushafType)}>
              <SelectTrigger className="w-full h-8 sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mwdoa">{t('mushafMwdoa')}</SelectItem>
                <SelectItem value="tashel">{t('mushafTashel')}</SelectItem>
                <SelectItem value="madinah">{t('mushafMadinah')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Mode Setting - Hide on mobile */}
          {!isMobile && (
            <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-2 sm:gap-3">
                <Book className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                <span className="text-base md:text-xl font-medium">{isRTL ? 'وضع العرض' : 'View Mode'}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewModeChange(viewMode === 'single' ? 'double' : 'single')}
                className="flex items-center gap-2 h-7 sm:h-8 px-2 sm:px-3 text-base md:text-xl"
              >
                <span>
                  {viewMode === 'single' ? (isRTL ? 'صفحتين' : '2 Pages') : (isRTL ? 'صفحة' : '1 Page')}
                </span>
              </Button>
            </div>
          )}

          {/* Pages to Load Setting - Only show in single page mode or mobile */}
          {(viewMode === 'single' || isMobile) && (
            <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-2 sm:gap-3">
                <Navigation className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                <span className="text-base md:text-xl font-medium">
                  {isRTL ? 'الصفحات المحملة' : 'Swipe Sensitivity'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pagesToLoad > 1 && updatePagesToLoad(pagesToLoad - 1)}
                    disabled={pagesToLoad <= 1}
                    className="h-8 w-8 p-0 text-base md:text-xl"
                  >
                    -
                  </Button>
                  <div className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-900 rounded-md border border-gray-300 dark:border-gray-600">
                    <span className="text-base md:text-xl font-medium">{pagesToLoad}</span>
                    <span className="text-base md:text-xl text-gray-500">
                      {pagesToLoad === 1 ? (isRTL ? 'صفحة' : 'page') : (isRTL ? 'صفحات' : 'pages')}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pagesToLoad < 5 && updatePagesToLoad(pagesToLoad + 1)}
                    disabled={pagesToLoad >= 5}
                    className="h-8 w-8 p-0 text-base md:text-xl"
                  >
                    +
                  </Button>
                </div>
                <p className="text-base md:text-xl text-gray-500 dark:text-gray-400">
                  {isRTL 
                    ? 'يحدد عدد الصفحات التي يمكنك التمرير إليها بحركة واحدة' 
                    : 'Controls how many pages you can swipe at once'}
                </p>
              </div>
            </div>
          )}

          {/* Bottom Bar Text Toggle */}
          <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-2 sm:gap-3">
              <Menu className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              <span className="text-base md:text-xl font-medium">
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
      </DialogContent>
    </Dialog>
  );
}
