import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BookOpen, Book, Navigation, Menu, GraduationCap, Palette } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMushaf, MushafType } from "@/contexts/MushafContext";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

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
  const { t, isRTL } = useLanguage();
  const { mushafType, setMushafType } = useMushaf();
  
  const [activeTab, setActiveTab] = useState<string>(() => {
    const saved = localStorage.getItem('quran-settings-tab');
    return saved || 'mushaf';
  });
  
  // Local state for mushaf selection (only applied on save)
  const [selectedMushaf, setSelectedMushaf] = useState<MushafType>(mushafType);
  const hasUnsavedChanges = selectedMushaf !== mushafType;

  // Reset selected mushaf when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedMushaf(mushafType);
    }
  }, [open, mushafType]);

  useEffect(() => {
    localStorage.setItem('quran-settings-tab', activeTab);
  }, [activeTab]);
  
  const handleSaveMushaf = () => {
    setMushafType(selectedMushaf);
  };

  const updatePagesToLoad = (pages: number) => {
    onPagesToLoadChange(pages);
    localStorage.setItem('quran-pages-to-load', String(pages));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "sm:max-w-md md:max-w-lg max-w-[90vw] max-h-[85vh] overflow-y-auto p-0",
          "rounded-xl border-0 bg-[#FBF9F4]",
          isRTL ? "rtl" : "ltr"
        )}
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        <DialogHeader className="bg-gradient-to-b from-emerald-800 to-emerald-600 rounded-t-xl px-4 py-3">
          <DialogTitle className="text-center text-base md:text-xl font-bold text-[#F2E3BB]">
            {t('settings')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-11 md:h-12 bg-emerald-100 dark:bg-emerald-900/30">
              <TabsTrigger 
                value="mushaf" 
                className="text-base md:text-xl data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB]"
              >
                <BookOpen className="w-4 h-4 mr-1.5" />
                {isRTL ? 'المصحف' : 'Mushaf'}
              </TabsTrigger>
              <TabsTrigger 
                value="style" 
                className="text-base md:text-xl data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB]"
              >
                <Palette className="w-4 h-4 mr-1.5" />
                {isRTL ? 'العرض' : 'Style'}
              </TabsTrigger>
              <TabsTrigger 
                value="test" 
                className="text-base md:text-xl data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB]"
              >
                <GraduationCap className="w-4 h-4 mr-1.5" />
                {isRTL ? 'اختبار' : 'Test'}
              </TabsTrigger>
            </TabsList>

            {/* Mushaf Tab */}
            <TabsContent value="mushaf" className="space-y-4 mt-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-300">{t('mushafType')}</span>
                </div>
                <Select value={selectedMushaf} onValueChange={(value) => setSelectedMushaf(value as MushafType)}>
                  <SelectTrigger className="w-full text-base md:text-xl border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
                    <SelectItem value="mwdoa" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('mushafMwdoa')}</SelectItem>
                    <SelectItem value="tashel" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('mushafTashel')}</SelectItem>
                    <SelectItem value="madinah" className="text-base md:text-xl focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">{t('mushafMadinah')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Save Button - always visible, disabled when no changes */}
              <button
                onClick={handleSaveMushaf}
                disabled={!hasUnsavedChanges}
                className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3 md:px-4 h-10 md:h-12 border border-emerald-600 shadow-md transition-all"
              >
                <span className="text-[#F2E3BB] text-base md:text-xl font-bold">
                  {isRTL ? 'حفظ' : 'Save'}
                </span>
              </button>
            </TabsContent>

            {/* Style Tab */}
            <TabsContent value="style" className="space-y-4 mt-4">
              {/* View Mode Setting - Hide on mobile */}
              {!isMobile && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Book className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-300">{isRTL ? 'وضع العرض' : 'View Mode'}</span>
                  </div>
                  <button
                    onClick={() => onViewModeChange(viewMode === 'single' ? 'double' : 'single')}
                    className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 rounded-lg px-3 md:px-4 h-8 md:h-10 border border-emerald-600 shadow-md transition-all text-base md:text-xl"
                  >
                    <span className="text-[#F2E3BB] font-bold">
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
                    <span className="text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-300">
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
                        <span className="text-[#F2E3BB] text-xl md:text-2xl font-bold">-</span>
                      </button>
                      <div className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-white dark:bg-emerald-950 rounded-md border border-emerald-300 dark:border-emerald-700">
                        <span className="text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-200">{pagesToLoad}</span>
                        <span className="text-base md:text-xl text-emerald-600 dark:text-emerald-400">
                          {pagesToLoad === 1 ? (isRTL ? 'صفحة' : 'page') : (isRTL ? 'صفحات' : 'pages')}
                        </span>
                      </div>
                      <button
                        onClick={() => pagesToLoad < 5 && updatePagesToLoad(pagesToLoad + 1)}
                        disabled={pagesToLoad >= 5}
                        className="flex items-center justify-center bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg h-10 md:h-12 w-10 md:w-12 border border-emerald-600 shadow-md transition-all"
                      >
                        <span className="text-[#F2E3BB] text-xl md:text-2xl font-bold">+</span>
                      </button>
                    </div>
                    <p className="text-base md:text-xl text-emerald-600 dark:text-emerald-400">
                      {isRTL 
                        ? 'يحدد عدد الصفحات التي يمكنك التمرير إليها بحركة واحدة' 
                        : 'Controls how many pages you can swipe at once'}
                    </p>
                  </div>
                </div>
              )}

              {/* Bottom Bar Text Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Menu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-base md:text-xl font-medium text-emerald-800 dark:text-emerald-300">
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
            </TabsContent>

            {/* Test Tab */}
            <TabsContent value="test" className="space-y-4 mt-4">
              <div className="flex flex-col gap-3">
                <p className="text-base md:text-xl text-emerald-700 dark:text-emerald-300">
                  {isRTL 
                    ? 'اختبر حفظك للقرآن الكريم من خلال تمارين تفاعلية.'
                    : 'Test your Quran memorization with interactive exercises.'}
                </p>
                <Link to="/test" className="block">
                  <button
                    onClick={() => onOpenChange(false)}
                    className="w-full flex items-center justify-center gap-2 sm:gap-3 bg-emerald-700 hover:bg-emerald-800 rounded-lg px-3 md:px-4 h-10 md:h-12 border border-emerald-600 shadow-md transition-all"
                  >
                    <GraduationCap className="w-5 h-5 md:w-6 md:h-6 text-[#F2E3BB]" />
                    <span className="text-[#F2E3BB] text-base md:text-xl font-bold">
                      {t('testFeature')}
                    </span>
                  </button>
                </Link>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
