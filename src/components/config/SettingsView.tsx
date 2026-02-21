import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BookOpen, Book, Navigation, Menu, GraduationCap, Palette, HardDriveDownload, Type, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMushaf, MushafType } from "@/contexts/MushafContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Download } from "./Download";
import { StyleSettings } from "./StyleSettings";

/**
 * Settings View Component
 * Used by Configuration page for /config/settings
 */
export default function SettingsView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, isRTL, language } = useLanguage();
  const { mushafType, setMushafType } = useMushaf();
  const { toast } = useToast();
  const { dialogTextSize, setDialogTextSize } = useDialogTextSize();
  
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  
  // Active category from URL (null = show list, string = show that category's content)
  const activeCategory = searchParams.get('category');
  
  const [selectedMushaf, setSelectedMushaf] = useState<MushafType>(mushafType);
  const hasUnsavedChanges = selectedMushaf !== mushafType;
  
  const [isMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [viewMode, setViewMode] = useState<'single' | 'double'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'single';
    const saved = localStorage.getItem('quran-view-mode');
    return (saved as 'single' | 'double') || 'double';
  });
  const [pagesToLoad, setPagesToLoad] = useState<number>(() => {
    const saved = localStorage.getItem('quran-pages-to-load');
    return saved ? parseInt(saved) : 1;
  });
  const [showBottomBarText, setShowBottomBarText] = useState<boolean>(() => {
    const saved = localStorage.getItem('quran-show-bottom-bar-text');
    return saved !== null ? saved === 'true' : true;
  });
  
  const handleSaveMushaf = () => {
    setMushafType(selectedMushaf);
    toast({
      title: isRTL ? 'تم التحديث' : 'Updated',
      description: isRTL ? 'تم تغيير المصحف بنجاح' : 'Mushaf changed successfully',
    });
  };
  
  const updatePagesToLoad = (pages: number) => {
    setPagesToLoad(pages);
    localStorage.setItem('quran-pages-to-load', String(pages));
  };
  
  const updateViewMode = (mode: 'single' | 'double') => {
    setViewMode(mode);
    localStorage.setItem('quran-view-mode', mode);
  };
  
  const settingsCategories = [
    { id: 'mushaf', icon: BookOpen, label: isRTL ? 'المصحف' : 'Mushaf' },
    { id: 'style', icon: Palette, label: isRTL ? 'العرض' : 'Style' },
    { id: 'download', icon: HardDriveDownload, label: t('download') },
    { id: 'test', icon: GraduationCap, label: isRTL ? 'اختبار' : 'Test' },
  ];
  
  // Render list of categories
  const renderCategoriesList = () => {
    return (
      <div className="divide-y divide-emerald-100 dark:divide-emerald-900">
        {settingsCategories.map((category) => {
          const Icon = category.icon;
          
          return (
            <button
              key={category.id}
              onClick={() => {
                if (category.id === 'test') {
                  navigate('/test');
                } else {
                  setSearchParams({ category: category.id });
                }
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors",
                isRTL ? "justify-start" : "justify-end"
              )}
            >
              {isRTL ? (
                <ChevronLeft className="w-6 h-6 text-emerald-500" />
              ) : (
                <ChevronRight className="w-6 h-6 text-emerald-500" />
              )}
              <span className={cn(
                "font-medium text-emerald-700 dark:text-emerald-400",
                textSizeClasses.label
              )}>
                {category.label}
              </span>
              <Icon className="w-6 h-6 flex-shrink-0 text-emerald-600 dark:text-emerald-500" />
            </button>
          );
        })}
      </div>
    );
  };
  
  // Render content for specific category
  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'mushaf':
        return (
          <div className="space-y-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>{t('mushafType')}</span>
              </div>
              <Select value={selectedMushaf} onValueChange={(value) => setSelectedMushaf(value as MushafType)}>
                <SelectTrigger className={cn("w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500", textSizeClasses.text)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
                  <SelectItem value="mwdoa" className={cn("focus:bg-emerald-100 focus:text-emerald-900", textSizeClasses.text)}>{t('mushafMwdoa')}</SelectItem>
                  <SelectItem value="tashel" className={cn("focus:bg-emerald-100 focus:text-emerald-900", textSizeClasses.text)}>{t('mushafTashel')}</SelectItem>
                  <SelectItem value="madinah" className={cn("focus:bg-emerald-100 focus:text-emerald-900", textSizeClasses.text)}>{t('mushafMadinah')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <button
              onClick={handleSaveMushaf}
              disabled={!hasUnsavedChanges}
              className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3 md:px-4 h-12 border border-emerald-600 shadow-md transition-all"
            >
              <span className={cn("text-[#F2E3BB] font-bold", textSizeClasses.button)}>
                {isRTL ? 'حفظ' : 'Save'}
              </span>
            </button>
          </div>
        );
        
      case 'style':
        return (
          <div className="space-y-10">
            <StyleSettings
              isMobile={isMobile}
              viewMode={viewMode}
              onViewModeChange={updateViewMode}
              pagesToLoad={pagesToLoad}
              onPagesToLoadChange={(pages) => {
                setPagesToLoad(pages);
                localStorage.setItem('quran-pages-to-load', String(pages));
                // Notify other components about the setting change
                window.dispatchEvent(new CustomEvent('quran-setting-changed', {
                  detail: { key: 'quran-pages-to-load', value: String(pages) }
                }));
              }}
              showBottomBarText={showBottomBarText}
              onShowBottomBarTextChange={(checked) => {
                setShowBottomBarText(checked);
                localStorage.setItem('quran-show-bottom-bar-text', String(checked));
                // Notify other components about the setting change
                window.dispatchEvent(new CustomEvent('quran-setting-changed', {
                  detail: { key: 'quran-show-bottom-bar-text', value: String(checked) }
                }));
              }}
            />

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <Type className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
                  {t('dialogTextSize')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setDialogTextSize('small')}
                  className={cn(
                    "flex items-center justify-center px-3 py-2 rounded-lg border transition-all font-medium",
                    textSizeClasses.button,
                    dialogTextSize === 'small'
                      ? "bg-emerald-700 text-[#F2E3BB] border-emerald-600 shadow-md"
                      : "bg-white dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900"
                  )}
                >
                  {t('textSizeSmall')}
                </button>
                <button
                  onClick={() => setDialogTextSize('medium')}
                  className={cn(
                    "flex items-center justify-center px-3 py-2 rounded-lg border transition-all font-medium",
                    textSizeClasses.button,
                    dialogTextSize === 'medium'
                      ? "bg-emerald-700 text-[#F2E3BB] border-emerald-600 shadow-md"
                      : "bg-white dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900"
                  )}
                >
                  {t('textSizeMedium')}
                </button>
                <button
                  onClick={() => setDialogTextSize('large')}
                  className={cn(
                    "flex items-center justify-center px-3 py-2 rounded-lg border transition-all font-medium",
                    textSizeClasses.button,
                    dialogTextSize === 'large'
                      ? "bg-emerald-700 text-[#F2E3BB] border-emerald-600 shadow-md"
                      : "bg-white dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900"
                  )}
                >
                  {t('textSizeLarge')}
                </button>
              </div>
            </div>
          </div>
        );
        
      case 'download':
        return <Download />;
        
      case 'test':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <GraduationCap className="w-5 h-5" />
              <span className={cn("font-medium", textSizeClasses.label)}>
                {isRTL ? 'قريباً' : 'Coming soon'}
              </span>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="h-full overflow-hidden bg-[#FBF9F4]">
      {activeCategory === null ? (
        /* Show categories list */
        <div className="h-full overflow-y-auto">
          {renderCategoriesList()}
        </div>
      ) : (
        /* Show category content with back button */
        <div className="h-full overflow-y-auto">
          {/* Back button header */}
          <div className="sticky top-0 z-10 bg-[#FBF9F4] border-b border-emerald-200 dark:border-emerald-800">
            <button
              onClick={() => setSearchParams({})}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-4 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors",
                isRTL ? "justify-start" : "justify-end"
              )}
            >
              {isRTL ? (
                <>
                  <ChevronRight className="w-7 h-7 text-emerald-600" />
                  <span className={cn(
                    "font-medium text-emerald-800 dark:text-emerald-300",
                    textSizeClasses.label
                  )}>
                    {settingsCategories.find(c => c.id === activeCategory)?.label}
                  </span>
                  {(() => {
                    const category = settingsCategories.find(c => c.id === activeCategory);
                    const Icon = category?.icon;
                    return Icon ? <Icon className="w-6 h-6 text-emerald-600 dark:text-emerald-500" /> : null;
                  })()}
                </>
              ) : (
                <>
                  {(() => {
                    const category = settingsCategories.find(c => c.id === activeCategory);
                    const Icon = category?.icon;
                    return Icon ? <Icon className="w-6 h-6 text-emerald-600 dark:text-emerald-500" /> : null;
                  })()}
                  <span className={cn(
                    "font-medium text-emerald-800 dark:text-emerald-300",
                    textSizeClasses.label
                  )}>
                    {settingsCategories.find(c => c.id === activeCategory)?.label}
                  </span>
                  <ChevronLeft className="w-7 h-7 text-emerald-600" />
                </>
              )}
            </button>
          </div>
          
          {/* Category content */}
          <div className="p-5">
            {renderCategoryContent()}
          </div>
        </div>
      )}
    </div>
  );
}
