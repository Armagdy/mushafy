import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, Navigation, Menu, GraduationCap, Palette, HardDriveDownload, ChevronLeft, ChevronRight, Sunrise, BookOpenCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMushaf, MushafType } from "@/contexts/MushafContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { cn } from "@/lib/utils";
import { Download } from "./Download";
import { StyleSettings } from "./StyleSettings";
import MemorizeView from "./MemorizeView";
import Azkar from "@/pages/Azkar";
import Test from "@/pages/Test";

/**
 * Settings View Component
 * Used by Configuration page for /config/settings
 */
interface SettingsViewProps {
  onNavigateToPage?: (page: number) => void;
  currentPage?: number;
}

export default function SettingsView({ onNavigateToPage, currentPage }: SettingsViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, isRTL, language } = useLanguage();
  const { mushafType, setMushafType } = useMushaf();
  const { dialogTextSize } = useDialogTextSize();
  
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  
  // Active category from URL (null = show list, string = show that category's content)
  const activeCategory = searchParams.get('category');
  
  // Reset search params on mount to always show full list
  useEffect(() => {
    setSearchParams({});
  }, []);
  
  const [isMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [viewMode, setViewMode] = useState<'single' | 'double'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'single';
    const saved = localStorage.getItem('quran-view-mode');
    return (saved as 'single' | 'double') || 'double';
  });
  const [showBottomBarText, setShowBottomBarText] = useState<boolean>(() => {
    const saved = localStorage.getItem('quran-show-bottom-bar-text');
    return saved !== null ? saved === 'true' : true;
  });
  // Swiper mode is now always enabled (default)
  
  const handleMushafChange = (mushaf: MushafType) => {
    setMushafType(mushaf);
  };
  
  const updateViewMode = (mode: 'single' | 'double') => {
    setViewMode(mode);
    localStorage.setItem('quran-view-mode', mode);
  };
  
  const settingsCategories = [
    { id: 'mushaf', icon: BookOpen, label: isRTL ? 'المصحف' : 'Mushaf' },
    { id: 'azkar', icon: Sunrise, label: isRTL ? 'الأذكار' : 'Azkar' },
    { id: 'memorize', icon: BookOpenCheck, label: isRTL ? 'الحفظ' : 'Memorization' },
    { id: 'style', icon: Palette, label: isRTL ? 'العرض' : 'Style' },
    { id: 'download', icon: HardDriveDownload, label: t('download') },
    { id: 'test', icon: GraduationCap, label: isRTL ? 'اختبار' : 'Test' },
  ];
  
  // Render list of categories (Material-style settings list)
  const renderCategoriesList = () => {
    return (
      <div className="w-full max-w-2xl mx-auto pt-2 px-3 pb-4">
        {settingsCategories.map((category) => {
          const Icon = category.icon;
          
          return (
            <button
              key={category.id}
              onClick={() => setSearchParams({ category: category.id })}
              className="w-full flex items-center gap-4 min-h-[64px] px-3 py-3 rounded-2xl transition-colors active:bg-emerald-100 dark:active:bg-emerald-900/40"
            >
              {/* Leading icon in app-themed container - consistent placement for scanning */}
              <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-b from-emerald-800 to-emerald-600 shadow-md shrink-0">
                <Icon className="w-6 h-6 text-[#F2E3BB]" />
              </span>
              {/* Primary label */}
              <span className={cn(
                "flex-1 text-start font-medium text-emerald-800 dark:text-emerald-200",
                textSizeClasses.label
              )}>
                {category.label}
              </span>
              {/* Trailing chevron - mirrors automatically in RTL */}
              {isRTL ? (
                <ChevronLeft className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <ChevronRight className="w-5 h-5 text-emerald-400 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    );
  };
  
  // Render content for specific category
  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'mushaf': {
        const mushafOptions: { value: MushafType; label: string; image: string }[] = [
          { value: 'mwdoa', label: t('mushafMwdoa'), image: '/assets/mushaf_snippets/mwdoaa.jpg' },
          { value: 'tashel', label: t('mushafTashel'), image: '/assets/mushaf_snippets/tayseer.jpg' },
          { value: 'madinah', label: t('mushafMadinah'), image: '/assets/mushaf_snippets/madinah.jpg' },
          { value: 'tarteel', label: t('mushafTarteel'), image: '/assets/mushaf_snippets/tarteel.jpg' },
          { value: 'tajweed', label: t('mushafTajweed'), image: '/assets/mushaf_snippets/tajweed.jpg' },
        ];
        
        return (
          <div className="space-y-5 pb-12">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>{t('mushafType')}</span>
              </div>
              
              {/* Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 pb-4">
                {mushafOptions.map((option) => {
                  const isSelected = mushafType === option.value;
                  
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleMushafChange(option.value)}
                      className={cn(
                        "relative flex flex-col gap-2 p-2 rounded-lg border-2 transition-all duration-200 hover:shadow-lg active:scale-[0.97] overflow-hidden",
                        isSelected 
                          ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 shadow-md" 
                          : "border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-800 hover:border-emerald-400"
                      )}
                    >
                      {/* Image */}
                      <div className="relative w-full aspect-[3/4] rounded overflow-hidden bg-emerald-50 dark:bg-emerald-900/20">
                        <img 
                          src={option.image} 
                          alt={option.label}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {/* Selected Overlay */}
                        {isSelected && (
                          <div className="absolute inset-0 bg-emerald-600/20 dark:bg-emerald-500/30 flex items-center justify-center">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center shadow-lg">
                              <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Title */}
                      <div className={cn(
                        "text-center font-medium px-1",
                        isSelected 
                          ? "text-emerald-800 dark:text-emerald-200 font-semibold" 
                          : "text-emerald-700 dark:text-emerald-300",
                        textSizeClasses.text
                      )}>
                        {option.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      }

      case 'style':
        return (
          <StyleSettings
            isMobile={isMobile}
            viewMode={viewMode}
            onViewModeChange={updateViewMode}
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
        );
        
      case 'download':
        return <Download />;
        
      case 'azkar':
        return <Azkar embedded />;
        
      case 'memorize':
        return (
          <MemorizeView
            currentPage={currentPage}
            onNavigateToPage={onNavigateToPage}
          />
        );
        
      case 'test':
        return <Test embedded />;
        
      default:
        return null;
    }
  };
  
  return (
    <div className="h-full overflow-hidden bg-[#FBF9F4] dark:bg-black">
      {activeCategory === null ? (
        /* Show categories list */
        <div className="h-full overflow-y-auto">
          {renderCategoriesList()}
        </div>
      ) : (
        /* Show category content with back button */
        <div className="h-full overflow-y-auto">
          {/* Sub-screen app bar - back arrow + title */}
          <div className="sticky top-0 z-10 bg-[#FBF9F4] dark:bg-black border-b border-emerald-100 dark:border-emerald-900 pt-2">
            <button
              onClick={() => setSearchParams({})}
              className="w-full flex items-center gap-1 px-2 py-1 min-h-[56px] transition-colors active:bg-emerald-100 dark:active:bg-emerald-900/40"
            >
              {isRTL ? (
                <ChevronRight className="w-7 h-7 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <ChevronLeft className="w-7 h-7 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              <span className={cn(
                "flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-200",
                textSizeClasses.label
              )}>
                {(() => {
                  const category = settingsCategories.find(c => c.id === activeCategory);
                  const Icon = category?.icon;
                  return Icon ? <Icon className="w-5 h-5 text-emerald-500 dark:text-emerald-400" /> : null;
                })()}
                {settingsCategories.find(c => c.id === activeCategory)?.label}
              </span>
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
