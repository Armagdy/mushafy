import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Bookmark, BookMarked, BookOpen, X, Plus, ChevronLeft, ChevronRight, RefreshCw, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { useToast } from "@/hooks/use-toast";
import { surahs } from "@/data/surahs";
import { cn } from "@/lib/utils";
import { useState, useLayoutEffect, useEffect, useRef } from "react";
import { getPageSurahInfo, getPageOfSurahFirstAyah } from "@/lib/quran-mapping";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";

interface BookmarksViewProps {
  bookmarks: number[];
  memorizationBookmarks: number[];
  readingBookmarks: number[];
  bookmarkPageSurahs: Record<number, string>;
  bookmarkPageAyahs: Record<number, number>;
  bookmarkPageSurahIds: Record<number, number>;
  currentSurahId: number;
  currentPage: number;
  currentPlayingAyah: { surah: number; ayah: number } | null;
  onNavigate: (page: number, surahId?: number, ayahNum?: number) => void;
  onToggleBookmark: (page: number) => void;
  onRemoveMemorizationBookmark: (page: number) => void;
  onRemoveReadingBookmark: (page: number) => void;
  onAddBookmarkByType: (type: string, surahId: number, ayahNum: number) => Promise<void>;
  onUpdateBookmark: (oldPage: number, newPage: number, surahId: number, ayahNum: number, type: string) => Promise<void>;
  initialCategory?: string | null;
}

export default function BookmarksView({
  bookmarks,
  memorizationBookmarks,
  readingBookmarks,
  bookmarkPageSurahs,
  bookmarkPageAyahs,
  bookmarkPageSurahIds,
  currentSurahId,
  currentPage,
  currentPlayingAyah,
  onNavigate,
  onToggleBookmark,
  onRemoveMemorizationBookmark,
  onRemoveReadingBookmark,
  onAddBookmarkByType,
  onUpdateBookmark,
  initialCategory = null,
}: BookmarksViewProps) {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  const [searchParams, setSearchParams] = useSearchParams();

  // Format numbers based on language
  const formatNumber = (num: number | string): string => {
    const numStr = num.toString();
    if (language === 'ar') {
      // Convert to Eastern Arabic numerals (٠-٩)
      return numStr.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
    }
    return numStr;
  };

  console.log('📖 BookmarksView received props:', { currentPage, currentSurahId });

  // Defensive checks - ensure arrays are always defined
  const safeBookmarks = bookmarks || [];
  const safeMemorizationBookmarks = memorizationBookmarks || [];
  const safeReadingBookmarks = readingBookmarks || [];
  const safeBookmarkPageSurahs = bookmarkPageSurahs || {};
  const safeBookmarkPageAyahs = bookmarkPageAyahs || {};
  const safeBookmarkPageSurahIds = bookmarkPageSurahIds || {};

  const [selectedBookmarkType, setSelectedBookmarkType] = useState<string>('bookmark');
  const [bookmarkPage, setBookmarkPage] = useState(currentPage || 1);
  const [bookmarkSurahId, setBookmarkSurahId] = useState(currentSurahId || 1);
  
  // Refs for auto-scrolling to selected items
  const selectedPageRef = useRef<HTMLButtonElement>(null);
  const selectedSurahRef = useRef<HTMLButtonElement>(null);
  const selectedUpdatePageRef = useRef<HTMLButtonElement>(null);
  const selectedUpdateSurahRef = useRef<HTMLButtonElement>(null);
  
  // Update bookmark state
  const [selectedUpdatePage, setSelectedUpdatePage] = useState<number | null>(null);
  const [updateNewPage, setUpdateNewPage] = useState<number>(currentPage || 1);
  const [updateNewSurahId, setUpdateNewSurahId] = useState<number>(currentSurahId || 1);
  
  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ page: number; type: 'quick' | 'memorization' | 'reading' } | null>(null);

  console.log('📖 BookmarksView state:', { 
    currentPage, 
    currentSurahId,
    bookmarkPage,
    bookmarkSurahId,
    updateNewPage,
    updateNewSurahId
  });
  
  // Active category from URL (null = show list, string = show that category's content)
  const activeCategory = searchParams.get('category');
  
  // Set initial category on mount if provided, otherwise reset to show full list
  useLayoutEffect(() => {
    if (initialCategory) {
      setSearchParams({ category: initialCategory });
    } else {
      setSearchParams({});
    }
  }, [initialCategory]);

  // Auto-scroll to selected page in Add bookmark view (on mount and when page changes)
  useEffect(() => {
    if (activeCategory === 'add' && selectedPageRef.current) {
      selectedPageRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  }, [activeCategory, bookmarkPage]);

  // Auto-scroll to selected surah in Add bookmark view (on mount and when surah changes)
  useEffect(() => {
    if (activeCategory === 'add' && selectedSurahRef.current) {
      selectedSurahRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  }, [activeCategory, bookmarkSurahId]);

  // Auto-scroll to selected page in Update bookmark view (on mount and when page changes)
  useEffect(() => {
    if (activeCategory === 'update' && selectedUpdatePage && selectedUpdatePageRef.current) {
      selectedUpdatePageRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  }, [activeCategory, selectedUpdatePage, updateNewPage]);

  // Auto-scroll to selected surah in Update bookmark view (on mount and when surah changes)
  useEffect(() => {
    if (activeCategory === 'update' && selectedUpdatePage && selectedUpdateSurahRef.current) {
      selectedUpdateSurahRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  }, [activeCategory, selectedUpdatePage, updateNewSurahId]);

  // Update dropdowns when current page/surah changes
  useLayoutEffect(() => {
    console.log('📖 BookmarksView useLayoutEffect: Updating dropdowns with:', { currentPage, currentSurahId });
    setBookmarkPage(currentPage);
    setBookmarkSurahId(currentSurahId);
    // Only update the "new" values if not actively updating a bookmark
    if (selectedUpdatePage === null) {
      setUpdateNewPage(currentPage);
      setUpdateNewSurahId(currentSurahId);
    }
  }, [currentPage, currentSurahId, selectedUpdatePage]);

  // Get bookmark type for a page
  const getBookmarkType = (page: number): string => {
    if (safeBookmarks.includes(page)) return 'bookmark';
    if (safeMemorizationBookmarks.includes(page)) return 'memorization';
    if (safeReadingBookmarks.includes(page)) return 'reading';
    return 'bookmark';
  };

  return (
    <div className={cn("p-4 space-y-2 sm:space-y-3", isRTL ? "rtl" : "ltr")}>
      {/* Show list of bookmark categories if no category selected */}
      {!activeCategory && (
        <div className="divide-y divide-emerald-100 dark:divide-emerald-900">
          {/* Add New Bookmark */}
          <button
            onClick={() => setSearchParams({ category: 'add' })}
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
              {isRTL ? 'إضافة علامة جديدة' : 'Add New Bookmark'}
            </span>
            <Plus className="w-6 h-6 flex-shrink-0 text-emerald-600 dark:text-emerald-500" />
          </button>

          {/* Update Bookmark */}
          <button
            onClick={() => setSearchParams({ category: 'update' })}
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
              {isRTL ? 'تحديث علامة' : 'Update Bookmark'}
            </span>
            <RefreshCw className="w-6 h-6 flex-shrink-0 text-emerald-600 dark:text-emerald-500" />
          </button>

          {/* View Bookmarks */}
          <button
            onClick={() => setSearchParams({ category: 'view' })}
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
              {isRTL ? 'العلامات' : 'Bookmarks'}
            </span>
            <Bookmark className="w-6 h-6 flex-shrink-0 text-emerald-600 dark:text-emerald-500" />
          </button>
        </div>
      )}

      {/* Show content for specific category */}
      {activeCategory === 'add' && (
        <div className="space-y-4">
          {/* Back button with title */}
          <button
            onClick={() => setSearchParams({})}
            className={cn(
              "flex items-center gap-2 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors",
              textSizeClasses.text
            )}
          >
            {isRTL ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
            <span className="font-bold">{isRTL ? 'إضافة علامة جديدة' : 'Add New Bookmark'}</span>
          </button>

          {/* Three Column Scrollable Selection */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col h-full max-h-[calc(100vh-20rem)] md:max-h-[calc(100vh-16rem)]"
          >
            {/* Column Headers */}
            <div className="flex gap-2 mb-2">
              <div className="flex-1 text-center">
                <h3 className={cn("font-semibold text-emerald-800 dark:text-emerald-200", textSizeClasses.label)}>
                  {isRTL ? 'النوع' : 'Type'}
                </h3>
              </div>
              <div className="flex-1 text-center">
                <h3 className={cn("font-semibold text-emerald-800 dark:text-emerald-200", textSizeClasses.label)}>
                  {t('page')}
                </h3>
              </div>
              <div className="flex-1 text-center">
                <h3 className={cn("font-semibold text-emerald-800 dark:text-emerald-200", textSizeClasses.label)}>
                  {isRTL ? 'السورة' : 'Surah'}
                </h3>
              </div>
            </div>

            {/* Three Scrollable Lists Side by Side */}
            <div className="flex gap-2 flex-1 overflow-hidden mb-3">
              {/* Column 1: Bookmark Type */}
              <div className="flex-1 overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg bg-transparent">
                <button
                  onClick={() => setSelectedBookmarkType('bookmark')}
                  className={cn(
                    "w-full px-3 py-3 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 transition-colors",
                    selectedBookmarkType === 'bookmark' && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                    "text-center",
                    textSizeClasses.text
                  )}
                >
                  <div className="flex flex-col items-center gap-2 text-emerald-800 dark:text-emerald-200">
                    <Bookmark className="w-5 h-5 text-amber-500" />
                    <span className={textSizeClasses.text}>{isRTL ? 'علامة' : 'Bookmark'}</span>
                  </div>
                </button>
                <button
                  onClick={() => setSelectedBookmarkType('memorization')}
                  className={cn(
                    "w-full px-3 py-3 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 transition-colors",
                    selectedBookmarkType === 'memorization' && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                    "text-center",
                    textSizeClasses.text
                  )}
                >
                  <div className="flex flex-col items-center gap-2 text-emerald-800 dark:text-emerald-200">
                    <BookMarked className="w-5 h-5 text-emerald-600" />
                    <span className={textSizeClasses.text}>{isRTL ? 'حفظ' : 'Memorization'}</span>
                  </div>
                </button>
                <button
                  onClick={() => setSelectedBookmarkType('reading')}
                  className={cn(
                    "w-full px-3 py-3 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors",
                    selectedBookmarkType === 'reading' && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                    "text-center",
                    textSizeClasses.text
                  )}
                >
                  <div className="flex flex-col items-center gap-2 text-emerald-800 dark:text-emerald-200">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    <span className={textSizeClasses.text}>{isRTL ? 'قراءة' : 'Reading'}</span>
                  </div>
                </button>
              </div>

              {/* Column 2: Page Numbers */}
              <div className="flex-1 overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg bg-transparent">
                {Array.from({ length: 604 }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    ref={bookmarkPage === page ? selectedPageRef : null}
                    onClick={async () => {
                      setBookmarkPage(page);
                      // Update surah based on the page
                      const pageInfo = await getPageSurahInfo(page);
                      if (pageInfo) {
                        setBookmarkSurahId(pageInfo.surahId);
                      }
                    }}
                    className={cn(
                      "w-full px-3 py-2 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors",
                      bookmarkPage === page && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                      "text-center",
                      textSizeClasses.text
                    )}
                  >
                    <div className="text-emerald-800 dark:text-emerald-200">
                      {isRTL ? `صفحة ${page}` : `Page ${page}`}
                    </div>
                  </button>
                ))}
              </div>

              {/* Column 3: Surah List */}
              <div className="flex-1 overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg bg-transparent">
                {surahs.map((surah) => (
                  <button
                    key={surah.id}
                    ref={bookmarkSurahId === surah.id ? selectedSurahRef : null}
                    onClick={async () => {
                      setBookmarkSurahId(surah.id);
                      // Navigate to the page where this surah's first ayah is located
                      const firstAyahPage = await getPageOfSurahFirstAyah(surah.id);
                      setBookmarkPage(firstAyahPage);
                    }}
                    className={cn(
                      "w-full px-3 py-2 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors",
                      bookmarkSurahId === surah.id && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                      textSizeClasses.text
                    )}
                  >
                    <div className={cn("text-emerald-800 dark:text-emerald-200", isRTL ? "text-right" : "text-left")}>
                      {surah.id}. {language === 'ar' ? surah.name : surah.englishName}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Save Button - Fixed at Bottom */}
            <div className="mt-auto pt-3 pb-4 border-t border-emerald-100 dark:border-emerald-900 bg-gradient-to-b from-transparent via-[#FBF9F4]/80 to-[#FBF9F4] dark:from-transparent dark:via-gray-900/80 dark:to-gray-900 flex-shrink-0">
              <Button
                onClick={async () => {
                  console.log('🔖 Save Button Clicked:', {
                    bookmarkSurahId,
                    bookmarkPage,
                    selectedBookmarkType
                  });
                  
                  const selectedSurah = surahs.find(s => s.id === bookmarkSurahId);
                  const surahName = language === 'ar' ? selectedSurah?.name : selectedSurah?.englishName;
                  
                  // Check if bookmark already exists for this page and type
                  const isDuplicate = 
                    (selectedBookmarkType === 'bookmark' && safeBookmarks.includes(bookmarkPage)) ||
                    (selectedBookmarkType === 'memorization' && safeMemorizationBookmarks.includes(bookmarkPage)) ||
                    (selectedBookmarkType === 'reading' && safeReadingBookmarks.includes(bookmarkPage));
                  
                  if (isDuplicate) {
                    const typeLabel = selectedBookmarkType === 'bookmark' 
                      ? (isRTL ? 'علامة' : 'Bookmark')
                      : selectedBookmarkType === 'memorization'
                      ? (isRTL ? 'حفظ' : 'Memorization')
                      : (isRTL ? 'قراءة' : 'Reading');
                    
                    toast({
                      title: isRTL ? 'خطأ' : 'Error',
                      description: isRTL 
                        ? `${typeLabel} موجودة بالفعل لـ صفحة ${formatNumber(bookmarkPage)} - ${surahName}`
                        : `${typeLabel} already exists for Page ${formatNumber(bookmarkPage)} - ${surahName}`,
                      duration: 2000,
                      className: 'bg-red-500 text-white border-red-600',
                    });
                    return;
                  }
                  
                  // Get the first ayah info on the selected page to pass to the bookmark function
                  const pageInfo = await getPageSurahInfo(bookmarkPage);
                  const targetSurahId = pageInfo?.surahId || bookmarkSurahId;
                  const targetAyah = pageInfo?.ayah || 1;
                  
                  await onAddBookmarkByType(selectedBookmarkType, targetSurahId, targetAyah);
                  
                  // Show detailed notification
                  const description = isRTL 
                    ? `تم حفظ العلامة إلى صفحة ${formatNumber(bookmarkPage)} - ${surahName}`
                    : `Saved bookmark to Page ${formatNumber(bookmarkPage)} - ${surahName}`;
                  
                  toast({
                    title: isRTL ? 'تم الحفظ' : 'Saved',
                    description,
                    duration: 2000,
                    className: 'bg-emerald-500 text-white border-emerald-600',
                  });
                  
                  // Switch to view bookmarks
                  setSearchParams({ category: 'view' });
                }}
                className={cn("w-full bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB]", textSizeClasses.button)}
              >
                {t('save')}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {activeCategory === 'update' && (
        <div className="space-y-4">
          {/* Back button with title */}
          <button
            onClick={() => setSearchParams({})}
            className={cn(
              "flex items-center gap-2 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors",
              textSizeClasses.text
            )}
          >
            {isRTL ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
            <span className="font-bold">{isRTL ? 'تحديث علامة' : 'Update Bookmark'}</span>
          </button>

          {!selectedUpdatePage ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col h-full max-h-[calc(100vh-20rem)] md:max-h-[calc(100vh-16rem)]"
            >
              <div className="flex-1 overflow-y-auto">
                {/* Quick Bookmarks */}
                {safeBookmarks.length > 0 && (
                  <div className="px-1 sm:px-2 py-1 space-y-2">
                    <div className={cn("font-semibold text-amber-600 dark:text-amber-400 px-2 py-1", textSizeClasses.text)}>
                      {isRTL ? 'علامات' : 'Bookmarks'} ({safeBookmarks.length})
                    </div>
                    {safeBookmarks.map((page) => (
                      <button
                        key={`update-quick-${page}`}
                        onClick={() => {
                          setSelectedUpdatePage(page);
                          setUpdateNewPage(currentPage);
                          setUpdateNewSurahId(currentSurahId);
                        }}
                        className={cn("w-full flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 rounded-lg transition-colors border border-amber-200 dark:border-amber-800/40 bg-gradient-to-r from-amber-50 to-white dark:from-amber-950/20 dark:to-emerald-950/30 shadow-sm", isRTL ? 'text-right' : 'text-left')}
                      >
                        <Bookmark className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 flex-shrink-0" />
                        <div className={cn("flex-1 min-w-0 font-medium truncate", textSizeClasses.text)}>
                          {t('page')} {formatNumber(page)} - {safeBookmarkPageSurahs[page] || '...'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Memorization Bookmarks */}
                {safeMemorizationBookmarks.length > 0 && (
                  <div className="px-1 sm:px-2 py-1 space-y-2">
                    <div className={cn("font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-1", textSizeClasses.text)}>
                      {isRTL ? 'حفظ' : 'Memorization'} ({safeMemorizationBookmarks.length})
                    </div>
                    {safeMemorizationBookmarks.map((page) => (
                      <button
                        key={`update-mem-${page}`}
                        onClick={() => {
                          setSelectedUpdatePage(page);
                          setUpdateNewPage(currentPage);
                          setUpdateNewSurahId(currentSurahId);
                        }}
                        className={cn("w-full flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors border border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/30 dark:to-emerald-950/30 shadow-sm", isRTL ? 'text-right' : 'text-left')}
                      >
                        <BookMarked className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0" />
                        <div className={cn("flex-1 min-w-0 font-medium truncate", textSizeClasses.text)}>
                          {t('page')} {formatNumber(page)} - {safeBookmarkPageSurahs[page] || '...'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Reading Bookmarks */}
                {safeReadingBookmarks.length > 0 && (
                  <div className="px-1 sm:px-2 py-1 space-y-2">
                    <div className={cn("font-semibold text-blue-600 dark:text-blue-400 px-2 py-1", textSizeClasses.text)}>
                      {isRTL ? 'قراءة' : 'Reading'} ({safeReadingBookmarks.length})
                    </div>
                    {safeReadingBookmarks.map((page) => (
                      <button
                        key={`update-read-${page}`}
                        onClick={() => {
                          setSelectedUpdatePage(page);
                          setUpdateNewPage(currentPage);
                          setUpdateNewSurahId(currentSurahId);
                        }}
                        className={cn("w-full flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-blue-200 dark:border-blue-800/40 bg-gradient-to-r from-blue-50 to-white dark:from-blue-950/20 dark:to-emerald-950/30 shadow-sm", isRTL ? 'text-right' : 'text-left')}
                      >
                        <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                        <div className={cn("flex-1 min-w-0 font-medium truncate", textSizeClasses.text)}>
                          {t('page')} {page} - {safeBookmarkPageSurahs[page] || '...'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* No Bookmarks Message */}
                {safeBookmarks.length === 0 && safeMemorizationBookmarks.length === 0 && safeReadingBookmarks.length === 0 && (
                  <div className={cn("px-3 sm:px-4 py-4 sm:py-6 text-emerald-600 dark:text-emerald-400 text-center", textSizeClasses.text)}>
                    {t('noBookmarks')}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col h-full max-h-[calc(100vh-20rem)] md:max-h-[calc(100vh-16rem)]"
            >
              {/* Current Bookmark Info */}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 sm:p-4 mb-3">
                <div className={cn("text-emerald-700 dark:text-emerald-400", isRTL ? 'text-right' : 'text-left', textSizeClasses.text)}>
                  {isRTL ? 'التحديث من:' : 'Updating from:'} {safeBookmarkPageSurahs[selectedUpdatePage] || '...'} - {t('page')} {formatNumber(selectedUpdatePage)}
                </div>
              </div>

              {/* Column Headers */}
              <div className="flex gap-2 mb-2">
                <div className="flex-1 text-center">
                  <h3 className={cn("font-semibold text-emerald-800 dark:text-emerald-200", textSizeClasses.label)}>
                    {t('page')}
                  </h3>
                </div>
                <div className="flex-1 text-center">
                  <h3 className={cn("font-semibold text-emerald-800 dark:text-emerald-200", textSizeClasses.label)}>
                    {isRTL ? 'السورة' : 'Surah'}
                  </h3>
                </div>
              </div>

              {/* Two Scrollable Lists Side by Side */}
              <div className="flex gap-2 flex-1 overflow-hidden mb-3">
                {/* Column 1: Page Numbers */}
                <div className="flex-1 overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg bg-transparent">
                  {Array.from({ length: 604 }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      ref={updateNewPage === page ? selectedUpdatePageRef : null}
                      onClick={async () => {
                        setUpdateNewPage(page);
                        // Update surah based on the page
                        const pageInfo = await getPageSurahInfo(page);
                        if (pageInfo) {
                          setUpdateNewSurahId(pageInfo.surahId);
                        }
                      }}
                      className={cn(
                        "w-full px-3 py-2 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors",
                        updateNewPage === page && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                        "text-center",
                        textSizeClasses.text
                      )}
                    >
                      <div className="text-emerald-800 dark:text-emerald-200">
                        {isRTL ? `صفحة ${page}` : `Page ${page}`}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Column 2: Surah List */}
                <div className="flex-1 overflow-y-auto border border-emerald-200 dark:border-emerald-800 rounded-lg bg-transparent">
                  {surahs.map((surah) => (
                    <button
                      key={surah.id}
                      ref={updateNewSurahId === surah.id ? selectedUpdateSurahRef : null}
                      onClick={async () => {
                        setUpdateNewSurahId(surah.id);
                        // Navigate to the page where this surah's first ayah is located
                        const firstAyahPage = await getPageOfSurahFirstAyah(surah.id);
                        setUpdateNewPage(firstAyahPage);
                      }}
                      className={cn(
                        "w-full px-3 py-2 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-900 last:border-b-0 transition-colors",
                        updateNewSurahId === surah.id && "bg-emerald-500/20 dark:bg-emerald-500/20 font-semibold",
                        textSizeClasses.text
                      )}
                    >
                      <div className={cn("text-emerald-800 dark:text-emerald-200", isRTL ? "text-right" : "text-left")}>
                        {surah.id}. {language === 'ar' ? surah.name : surah.englishName}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons - Fixed at Bottom */}
              <div className="mt-auto pt-3 pb-4 border-t border-emerald-100 dark:border-emerald-900 bg-gradient-to-b from-transparent via-[#FBF9F4]/80 to-[#FBF9F4] dark:from-transparent dark:via-gray-900/80 dark:to-gray-900 flex-shrink-0">
                <div className="flex gap-2">
                  <Button
                    onClick={() => setSelectedUpdatePage(null)}
                    variant="outline"
                    className={cn("flex-1 border-emerald-500 text-emerald-700 hover:bg-emerald-50", textSizeClasses.button)}
                  >
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button
                    onClick={async () => {
                      const bookmarkType = getBookmarkType(selectedUpdatePage);
                      const selectedSurah = surahs.find(s => s.id === updateNewSurahId);
                      const surahName = language === 'ar' ? selectedSurah?.name : selectedSurah?.englishName;

                      // Check if bookmark already exists at new page with same type
                      const isPageInSameType = 
                        (bookmarkType === 'bookmark' && safeBookmarks.includes(updateNewPage)) ||
                        (bookmarkType === 'memorization' && safeMemorizationBookmarks.includes(updateNewPage)) ||
                        (bookmarkType === 'reading' && safeReadingBookmarks.includes(updateNewPage));
                      
                      if (updateNewPage !== selectedUpdatePage && isPageInSameType) {
                        toast({
                          title: isRTL ? 'خطأ' : 'Error',
                          description: isRTL 
                            ? `توجد علامة من نفس النوع في الصفحة ${formatNumber(updateNewPage)}`
                            : `A bookmark of the same type already exists on page ${formatNumber(updateNewPage)}`,
                          duration: 2000,
                          className: 'bg-red-500 text-white border-red-600',
                        });
                        return;
                      }

                      try {
                        await onUpdateBookmark(selectedUpdatePage, updateNewPage, updateNewSurahId, 1, bookmarkType);
                        
                        toast({
                          title: isRTL ? 'تم التحديث' : 'Updated',
                          description: isRTL 
                            ? `تحدثت العلامة إلى صفحة ${formatNumber(updateNewPage)} - ${surahName}`
                            : `Bookmark updated to Page ${formatNumber(updateNewPage)} - ${surahName}`,
                          duration: 2000,
                          className: 'bg-emerald-500 text-white border-emerald-600',
                        });
                        
                        setSelectedUpdatePage(null);
                        setSearchParams({ category: 'view' });
                      } catch (error) {
                        toast({
                          title: isRTL ? 'خطأ' : 'Error',
                          description: isRTL ? 'فشل تحديث العلامة' : 'Failed to update bookmark',
                          duration: 2000,
                          className: 'bg-red-500 text-white border-red-600',
                        });
                      }
                    }}
                    className={cn("flex-1 bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB]", textSizeClasses.button)}
                  >
                    {isRTL ? 'تحديث' : 'Update'}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {activeCategory === 'view' && (
        <div className="space-y-4">
          {/* Back button with title */}
          <button
            onClick={() => setSearchParams({})}
            className={cn(
              "flex items-center gap-2 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors",
              textSizeClasses.text
            )}
          >
            {isRTL ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
            <span className="font-bold">{isRTL ? 'العلامات' : 'Bookmarks'}</span>
          </button>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col h-full max-h-[calc(100vh-20rem)] md:max-h-[calc(100vh-16rem)]"
          >
            <div className="flex-1 overflow-y-auto">
            {/* Quick Bookmarks */}
            {safeBookmarks.length > 0 && (
              <div className="px-1 sm:px-2 py-1 space-y-2">
                <div className={cn("font-semibold text-amber-600 dark:text-amber-400 px-2 py-1", textSizeClasses.text)}>
                  {isRTL ? 'علامات' : 'Bookmarks'} ({safeBookmarks.length})
                </div>
                {safeBookmarks.map((page) => (
                  <div
                    key={`quick-${page}`}
                    className="flex items-center gap-2"
                  >
                    <div className="flex-1 border border-amber-200 dark:border-amber-800/40 bg-gradient-to-r from-amber-50 to-white dark:from-amber-950/20 dark:to-emerald-950/30 rounded-lg shadow-sm overflow-hidden">
                      <button
                        onClick={() => {
                          onNavigate(page, safeBookmarkPageSurahIds[page], safeBookmarkPageAyahs[page]);
                        }}
                        className={cn("flex items-center gap-1.5 sm:gap-2 w-full py-2 sm:py-2.5 px-3 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors", isRTL ? 'text-right' : 'text-left')}
                      >
                        <Bookmark className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 flex-shrink-0" />
                        <div className={cn("flex-1 min-w-0 font-medium truncate", textSizeClasses.text)}>
                          {t('page')} {formatNumber(page)} - {safeBookmarkPageSurahs[page] || '...'}
                        </div>
                      </button>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmation({ page, type: 'quick' });
                      }}
                      className="self-stretch px-3 text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-400 rounded-lg flex-shrink-0 transition-colors flex items-center justify-center"
                      aria-label="Remove bookmark"
                    >
                      <Trash2 className="w-6 h-6" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Memorization Bookmarks */}
            {safeMemorizationBookmarks.length > 0 && (
              <div className="px-1 sm:px-2 py-1 space-y-2">
                <div className={cn("font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-1", textSizeClasses.text)}>
                  {isRTL ? 'حفظ' : 'Memorization'} ({safeMemorizationBookmarks.length})
                </div>
                {safeMemorizationBookmarks.map((page) => (
                  <div
                    key={`mem-${page}`}
                    className="flex items-center gap-2"
                  >
                    <div className="flex-1 border border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/30 dark:to-emerald-950/30 rounded-lg shadow-sm overflow-hidden">
                      <button
                        onClick={() => {
                          onNavigate(page, safeBookmarkPageSurahIds[page], safeBookmarkPageAyahs[page]);
                        }}
                        className={cn("flex items-center gap-1.5 sm:gap-2 w-full py-2 sm:py-2.5 px-3 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 transition-colors", isRTL ? 'text-right' : 'text-left')}
                      >
                        <BookMarked className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0" />
                        <div className={cn("flex-1 min-w-0 font-medium truncate", textSizeClasses.text)}>
                          {t('page')} {formatNumber(page)} - {safeBookmarkPageSurahs[page] || '...'}
                        </div>
                      </button>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmation({ page, type: 'memorization' });
                      }}
                      className="self-stretch px-3 text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-400 rounded-lg flex-shrink-0 transition-colors flex items-center justify-center"
                      aria-label="Remove memorization bookmark"
                    >
                      <Trash2 className="w-6 h-6" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Reading Bookmarks */}
            {safeReadingBookmarks.length > 0 && (
              <div className="px-1 sm:px-2 py-1 space-y-2">
                <div className={cn("font-semibold text-blue-600 dark:text-blue-400 px-2 py-1", textSizeClasses.text)}>
                  {isRTL ? 'قراءة' : 'Reading'} ({safeReadingBookmarks.length})
                </div>
                {safeReadingBookmarks.map((page) => (
                  <div
                    key={`read-${page}`}
                    className="flex items-center gap-2"
                  >
                    <div className="flex-1 border border-blue-200 dark:border-blue-800/40 bg-gradient-to-r from-blue-50 to-white dark:from-blue-950/20 dark:to-emerald-950/30 rounded-lg shadow-sm overflow-hidden">
                      <button
                        onClick={() => {
                          onNavigate(page, safeBookmarkPageSurahIds[page], safeBookmarkPageAyahs[page]);
                        }}
                        className={cn("flex items-center gap-1.5 sm:gap-2 w-full py-2 sm:py-2.5 px-3 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors", isRTL ? 'text-right' : 'text-left')}
                      >
                        <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                        <div className={cn("flex-1 min-w-0 font-medium truncate", textSizeClasses.text)}>
                          {t('page')} {formatNumber(page)} - {safeBookmarkPageSurahs[page] || '...'}
                        </div>
                      </button>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmation({ page, type: 'reading' });
                      }}
                      className="self-stretch px-3 text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-400 rounded-lg flex-shrink-0 transition-colors flex items-center justify-center"
                      aria-label="Remove reading bookmark"
                    >
                      <Trash2 className="w-6 h-6" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* No Bookmarks Message */}
            {safeBookmarks.length === 0 && safeMemorizationBookmarks.length === 0 && safeReadingBookmarks.length === 0 && (
              <div className={cn("px-3 sm:px-4 py-4 sm:py-6 text-emerald-600 dark:text-emerald-400 text-center", textSizeClasses.text)}>
                {t('noBookmarks')}
              </div>
            )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className={cn("font-bold text-emerald-800 dark:text-emerald-200 text-center", textSizeClasses.label)}>
              {t('confirmDeleteBookmark')}
            </h3>
            <p className={cn("text-emerald-700 dark:text-emerald-300 text-center", textSizeClasses.text)}>
              {t('page')} {formatNumber(deleteConfirmation.page)}
            </p>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setDeleteConfirmation(null)}
                variant="outline"
                className={cn("flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/20", textSizeClasses.button)}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={() => {
                  if (deleteConfirmation.type === 'quick') {
                    onToggleBookmark(deleteConfirmation.page);
                  } else if (deleteConfirmation.type === 'memorization') {
                    onRemoveMemorizationBookmark(deleteConfirmation.page);
                  } else if (deleteConfirmation.type === 'reading') {
                    onRemoveReadingBookmark(deleteConfirmation.page);
                  }
                  setDeleteConfirmation(null);
                }}
                className={cn("flex-1 bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800", textSizeClasses.button)}
              >
                {t('delete')}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
