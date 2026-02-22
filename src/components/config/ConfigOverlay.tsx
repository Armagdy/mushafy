import { useLanguage } from "@/contexts/LanguageContext";
import { useBookmarks } from "@/hooks/useBookmarks";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { motion } from 'framer-motion';

// Import different configuration views
import SettingsView from "@/components/config/SettingsView";
import BookmarksView from "@/components/config/BookmarksView";
import NavigationView from "@/components/config/NavigationView";
import ReciterView from "@/components/config/ReciterView";
import TafseerView from "@/components/config/TafseerView";
import RepeatView from "@/components/config/RepeatView";
import SearchView from "@/components/config/SearchView";
import { BottomBar } from "@/components/quran/BottomBar";

export type ConfigType = 'settings' | 'bookmarks' | 'navigation' | 'reciter' | 'tafseer' | 'repeat' | 'search';

interface ConfigOverlayProps {
  type: ConfigType;
  onClose: () => void;
  onChangeView: (view: ConfigType) => void;
  currentPage: number;
  currentSurahId: number;
  currentPlayingAyah: { surah: number; ayah: number } | null;
  onNavigate: (page: number) => void;
  viewMode: 'single' | 'double';
  onViewModeToggle: () => void;
  showBottomBarText: boolean;
  isMobile: boolean;
  initialNavigationType?: 'surah' | 'juz' | 'page';
  initialNavigationSurah?: number;
  initialNavigationJuz?: number;
  initialNavigationPage?: number;
  
  // Audio player props for ReciterView
  audioSource: 'everyayah' | 'mp3quran';
  onAudioSourceChange: (source: 'everyayah' | 'mp3quran') => void;
  selectedReciter: any;
  filteredReciters: any[];
  uniqueReciterNames: any[];
  filterReciterName: string;
  filterReading: string;
  filterStyle: string;
  filterQuality: string;
  availableReadings: string[];
  availableStyles: string[];
  availableQualities: string[];
  onFilterReciterNameChange: (value: string) => void;
  onFilterReadingChange: (value: string) => void;
  onFilterStyleChange: (value: string) => void;
  onFilterQualityChange: (value: string) => void;
  mp3QuranReciters: any[];
  mp3QuranRecitersAr: any[];
  selectedMp3QuranReciter: any;
  selectedMoshaf: any;
  onMp3QuranReciterChange: (reciter: any) => void;
  onMoshafChange: (moshaf: any) => void;
  onReciterListen: () => void;
  onReciterNavigateToSurah: (surahId: number) => Promise<void>;
  onStopAudio: () => void;
  
  // Repeat props
  ayahData: any[];
  repeatStartSurah: number;
  repeatStartAyah: number;
  repeatEndSurah: number;
  repeatEndAyah: number;
  repeatPassageCount: number;
  repeatAyahCount: number;
  hasAyahTimings?: boolean;
  onRepeatStartSurahChange: (value: number) => void;
  onRepeatStartAyahChange: (value: number) => void;
  onRepeatEndSurahChange: (value: number) => void;
  onRepeatEndAyahChange: (value: number) => void;
  onRepeatPassageCountChange: (value: number) => void;
  onRepeatAyahCountChange: (value: number) => void;
  onStartRepeat: () => void;
}

/**
 * ConfigOverlay - Full-screen overlay for all configuration views
 * Appears on top of the Surah view without changing the URL
 */
export default function ConfigOverlay({
  type,
  onClose,
  onChangeView,
  currentPage,
  currentSurahId,
  currentPlayingAyah,
  onNavigate,
  viewMode,
  onViewModeToggle,
  showBottomBarText,
  isMobile,
  initialNavigationType,
  initialNavigationSurah,
  initialNavigationJuz,
  initialNavigationPage,
  audioSource,
  onAudioSourceChange,
  selectedReciter,
  filteredReciters,
  uniqueReciterNames,
  filterReciterName,
  filterReading,
  filterStyle,
  filterQuality,
  availableReadings,
  availableStyles,
  availableQualities,
  onFilterReciterNameChange,
  onFilterReadingChange,
  onFilterStyleChange,
  onFilterQualityChange,
  mp3QuranReciters,
  mp3QuranRecitersAr,
  selectedMp3QuranReciter,
  selectedMoshaf,
  onMp3QuranReciterChange,
  onMoshafChange,
  onReciterListen,
  onReciterNavigateToSurah,
  onStopAudio,
  ayahData,
  repeatStartSurah,
  repeatStartAyah,
  repeatEndSurah,
  repeatEndAyah,
  repeatPassageCount,
  repeatAyahCount,
  hasAyahTimings,
  onRepeatStartSurahChange,
  onRepeatStartAyahChange,
  onRepeatEndSurahChange,
  onRepeatEndAyahChange,
  onRepeatPassageCountChange,
  onRepeatAyahCountChange,
  onStartRepeat,
}: ConfigOverlayProps) {
  const { t, language, isRTL } = useLanguage();
  
  // Get bookmarks data
  const {
    bookmarks,
    memorizationBookmarks,
    readingBookmarks,
    bookmarkPageSurahs,
    bookmarkPageAyahs,
    bookmarkPageSurahIds,
    toggleBookmark,
    removeMemorizationBookmark,
    removeReadingBookmark,
    addBookmarkByType,
    updateBookmark,
    getTotalBookmarks,
  } = useBookmarks(language);
  
  // Handle Android hardware back button
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const handleBackButton = App.addListener('backButton', () => {
        onClose();
      });
      
      return () => {
        handleBackButton.then(listener => listener.remove());
      };
    }
  }, [onClose]);
  
  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);
  
  // Get page title based on type
  const getTitle = (): string => {
    switch (type) {
      case 'settings':
        return t('settings');
      case 'bookmarks':
        return t('bookmarks');
      case 'navigation':
        return isRTL ? 'انتقل' : 'Navigate';
      case 'search':
        return t('search');
      case 'reciter':
        return t('audio');
      case 'tafseer':
        return t('tafseer');
      case 'repeat':
        return t('repeatSettings');
      default:
        return '';
    }
  };
  
  // Render appropriate view based on type
  const renderView = () => {
    switch (type) {
      case 'settings':
        return <SettingsView />;
      case 'bookmarks':
        return (
          <BookmarksView
            bookmarks={bookmarks}
            memorizationBookmarks={memorizationBookmarks}
            readingBookmarks={readingBookmarks}
            bookmarkPageSurahs={bookmarkPageSurahs}
            bookmarkPageAyahs={bookmarkPageAyahs}
            bookmarkPageSurahIds={bookmarkPageSurahIds}
            currentSurahId={currentSurahId}
            currentPage={currentPage}
            currentPlayingAyah={currentPlayingAyah}
            onNavigate={(page) => {
              onNavigate(page);
              onClose();
            }}
            onToggleBookmark={toggleBookmark}
            onRemoveMemorizationBookmark={removeMemorizationBookmark}
            onRemoveReadingBookmark={removeReadingBookmark}
            onAddBookmarkByType={addBookmarkByType}
            onUpdateBookmark={updateBookmark}
          />
        );
      case 'navigation':
        return (
          <NavigationView 
            onNavigate={onNavigate} 
            onClose={onClose} 
            initialType={initialNavigationType}
            initialSurah={initialNavigationSurah}
            initialJuz={initialNavigationJuz}
            initialPage={initialNavigationPage}
          />
        );
      case 'search':
        return <SearchView onNavigate={onNavigate} onClose={onClose} />;
      case 'reciter':
        return (
          <ReciterView
            audioSource={audioSource}
            onAudioSourceChange={onAudioSourceChange}
            selectedReciter={selectedReciter}
            filteredReciters={filteredReciters}
            uniqueReciterNames={uniqueReciterNames}
            filterReciterName={filterReciterName}
            filterReading={filterReading}
            filterStyle={filterStyle}
            filterQuality={filterQuality}
            availableReadings={availableReadings}
            availableStyles={availableStyles}
            availableQualities={availableQualities}
            onFilterReciterNameChange={onFilterReciterNameChange}
            onFilterReadingChange={onFilterReadingChange}
            onFilterStyleChange={onFilterStyleChange}
            onFilterQualityChange={onFilterQualityChange}
            mp3QuranReciters={mp3QuranReciters}
            mp3QuranRecitersAr={mp3QuranRecitersAr}
            selectedMp3QuranReciter={selectedMp3QuranReciter}
            selectedMoshaf={selectedMoshaf}
            onMp3QuranReciterChange={onMp3QuranReciterChange}
            onMoshafChange={onMoshafChange}
            currentPlayingAyah={currentPlayingAyah}
            currentSurahId={currentSurahId}
            onListen={onReciterListen}
            onNavigateToSurah={onReciterNavigateToSurah}
          />
        );
      case 'tafseer':
        return <TafseerView />;
      case 'repeat':
        return (
          <RepeatView
            ayahData={ayahData}
            repeatStartSurah={repeatStartSurah}
            repeatStartAyah={repeatStartAyah}
            repeatEndSurah={repeatEndSurah}
            repeatEndAyah={repeatEndAyah}
            repeatPassageCount={repeatPassageCount}
            repeatAyahCount={repeatAyahCount}
            audioSource={audioSource}
            hasAyahTimings={hasAyahTimings}
            onRepeatStartSurahChange={onRepeatStartSurahChange}
            onRepeatStartAyahChange={onRepeatStartAyahChange}
            onRepeatEndSurahChange={onRepeatEndSurahChange}
            onRepeatEndAyahChange={onRepeatEndAyahChange}
            onRepeatPassageCountChange={onRepeatPassageCountChange}
            onRepeatAyahCountChange={onRepeatAyahCountChange}
            onStartRepeat={onStartRepeat}
            onClose={onClose}
          />
        );
      default:
        return null;
    }
  };
  
  return (
    <>
      {/* Sliding content (header + main view) */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
        className="fixed inset-0 z-50 flex flex-col bg-[#FBF9F4] dark:bg-emerald-950"
      >
        {/* Header with close button */}
        <div 
          className="sticky top-0 z-10 bg-gradient-to-b from-emerald-800 to-emerald-600 shadow-lg"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 0.5rem)' }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-[#F2E3BB] hover:bg-emerald-700/50"
            >
              <X className="w-6 h-6" />
            </Button>
            
            <h1 className="text-xl md:text-2xl font-bold text-[#F2E3BB]">
              {getTitle()}
            </h1>
            
            {/* Empty div for centering title */}
            <div className="w-10" />
          </div>
        </div>
        
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto pb-20">
          {renderView()}
        </div>
      </motion.div>

      {/* Bottom Navigation Bar - Fixed, doesn't slide */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-emerald-800 to-emerald-600 z-[60] pt-2">
        <BottomBar
          showBottomBarText={showBottomBarText}
          totalBookmarks={getTotalBookmarks()}
          isMobile={isMobile}
          viewMode={viewMode}
          onGoToClick={() => type === 'navigation' ? onClose() : onChangeView('navigation')}
          onSearchClick={() => type === 'search' ? onClose() : onChangeView('search')}
          onBookmarkClick={() => type === 'bookmarks' ? onClose() : onChangeView('bookmarks')}
          onSettingsClick={() => type === 'settings' ? onClose() : onChangeView('settings')}
          onTafseerClick={() => type === 'tafseer' ? onClose() : onChangeView('tafseer')}
          onViewModeToggle={onViewModeToggle}
        />
      </div>
    </>
  );
}
