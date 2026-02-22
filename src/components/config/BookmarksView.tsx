import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Bookmark, BookMarked, BookOpen, X, Plus, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { useToast } from "@/hooks/use-toast";
import { surahs } from "@/data/surahs";
import { cn } from "@/lib/utils";
import { useState, useLayoutEffect } from "react";
import { getPageSurahInfo } from "@/lib/quran-mapping";
import { useSearchParams } from "react-router-dom";

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
}: BookmarksViewProps) {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  const [searchParams, setSearchParams] = useSearchParams();

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
  
  // Update bookmark state
  const [selectedUpdatePage, setSelectedUpdatePage] = useState<number | null>(null);
  const [updateNewPage, setUpdateNewPage] = useState<number>(currentPage || 1);
  const [updateNewSurahId, setUpdateNewSurahId] = useState<number>(currentSurahId || 1);

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
  
  // Reset search params on mount to always show full list
  useLayoutEffect(() => {
    setSearchParams({});
  }, []);

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
          {/* Back button */}
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
            {isRTL ? 'رجوع' : 'Back'}
          </button>

          <div className="space-y-2 sm:space-y-3">
            {/* Bookmark Type Selector */}
            <div className="space-y-2">
              <Label htmlFor="bookmark-type" className={cn("font-medium text-emerald-800 dark:text-emerald-300", isRTL ? 'text-right' : 'text-left', textSizeClasses.label)}>
                {t('bookmarkType')}
              </Label>
              <Select value={selectedBookmarkType} onValueChange={setSelectedBookmarkType}>
                <SelectTrigger className="w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
                  <SelectItem value="bookmark" className="focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">
                    <div className="flex items-center gap-2">
                      <Bookmark className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500" />
                      <span className={textSizeClasses.text}>{isRTL ? 'علامة' : 'Bookmark'}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="memorization" className="focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">
                    <div className="flex items-center gap-2">
                      <BookMarked className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600" />
                      <span className={textSizeClasses.text}>{isRTL ? 'حفظ' : 'Memorization'}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="reading" className="focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                      <span className={textSizeClasses.text}>{isRTL ? 'قراءة' : 'Reading'}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Surah Selector */}
            <div className="space-y-2">
              <Label htmlFor="bookmark-surah" className={cn("font-medium text-emerald-800 dark:text-emerald-300", isRTL ? 'text-right' : 'text-left', textSizeClasses.label)}>
                {isRTL ? 'السورة' : 'Surah'}
              </Label>
              <Select value={bookmarkSurahId.toString()} onValueChange={(val) => setBookmarkSurahId(parseInt(val))}>
                <SelectTrigger className="w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60 bg-[#FBF9F4] dark:bg-emerald-950">
                  {surahs.map((surah) => (
                    <SelectItem key={surah.id} value={surah.id.toString()} className="focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">
                      <span className={textSizeClasses.text}>
                        {surah.id}. {language === 'ar' ? surah.name : surah.englishName}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Page Selector */}
            <div className="space-y-2">
              <Label htmlFor="bookmark-page" className={cn("font-medium text-emerald-800 dark:text-emerald-300", isRTL ? 'text-right' : 'text-left', textSizeClasses.label)}>
                {t('page')}
              </Label>
              <Select value={bookmarkPage.toString()} onValueChange={(val) => setBookmarkPage(parseInt(val))}>
                <SelectTrigger className="w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60 bg-[#FBF9F4] dark:bg-emerald-950">
                  {Array.from({ length: 604 }, (_, i) => i + 1).map((page) => (
                    <SelectItem key={page} value={page.toString()} className="focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">
                      <span className={textSizeClasses.text}>
                        {page}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                      ? `${typeLabel} موجودة بالفعل لـ ${surahName} - صفحة ${bookmarkPage}`
                      : `${typeLabel} already exists for ${surahName} - Page ${bookmarkPage}`,
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
                  ? `تم حفظ العلامة إلى ${surahName} - صفحة ${bookmarkPage}`
                  : `Saved bookmark to ${surahName} - Page ${bookmarkPage}`;
                
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
        </div>
      )}

      {activeCategory === 'update' && (
        <div className="space-y-4">
          {/* Back button */}
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
            {isRTL ? 'رجوع' : 'Back'}
          </button>

          {!selectedUpdatePage ? (
            <div className="space-y-2 sm:space-y-3">
              <div className={cn("text-base md:text-lg font-medium text-emerald-800 dark:text-emerald-300", isRTL ? 'text-right' : 'text-left')}>
                {isRTL ? 'اختر علامة لتحديثها' : 'Select a bookmark to update'}
              </div>
              
              <div className="max-h-60 sm:max-h-80 overflow-y-auto">
                {/* Quick Bookmarks */}
                {safeBookmarks.length > 0 && (
                  <div className="px-1 sm:px-2 py-1">
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
                        className={cn("w-full flex items-center gap-1.5 sm:gap-2 py-1 sm:py-1.5 px-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors", isRTL ? 'text-right' : 'text-left')}
                      >
                        <Bookmark className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0 font-medium truncate">
                          {safeBookmarkPageSurahs[page] || '...'} - {t('page')} {page}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Memorization Bookmarks */}
                {safeMemorizationBookmarks.length > 0 && (
                  <div className="px-1 sm:px-2 py-1">
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
                        className={cn("w-full flex items-center gap-1.5 sm:gap-2 py-1 sm:py-1.5 px-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors", isRTL ? 'text-right' : 'text-left')}
                      >
                        <BookMarked className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0 font-medium truncate">
                          {safeBookmarkPageSurahs[page] || '...'} - {t('page')} {page}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Reading Bookmarks */}
                {safeReadingBookmarks.length > 0 && (
                  <div className="px-1 sm:px-2 py-1">
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
                        className={cn("w-full flex items-center gap-1.5 sm:gap-2 py-1 sm:py-1.5 px-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors", isRTL ? 'text-right' : 'text-left')}
                      >
                        <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0 font-medium truncate">
                          {safeBookmarkPageSurahs[page] || '...'} - {t('page')} {page}
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
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              <div className={cn("text-base md:text-lg font-medium text-emerald-800 dark:text-emerald-300", isRTL ? 'text-right' : 'text-left')}>
                {isRTL ? 'تحديث إلى صفحة وسورة جديدة' : 'Update to new page and surah'}
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 sm:p-4">
                <div className={cn("text-sm text-emerald-700 dark:text-emerald-400", isRTL ? 'text-right' : 'text-left')}>
                  {isRTL ? 'التحديث من:' : 'Updating from:'} {safeBookmarkPageSurahs[selectedUpdatePage] || '...'} - {t('page')} {selectedUpdatePage}
                </div>
              </div>

              {/* Surah Selector */}
              <div className="space-y-2">
                <Label htmlFor="update-surah" className={cn("font-medium text-emerald-800 dark:text-emerald-300", isRTL ? 'text-right' : 'text-left', textSizeClasses.label)}>
                  {isRTL ? 'السورة الجديدة' : 'New Surah'}
                </Label>
                <Select value={updateNewSurahId.toString()} onValueChange={(val) => setUpdateNewSurahId(parseInt(val))}>
                  <SelectTrigger className="w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 bg-[#FBF9F4] dark:bg-emerald-950">
                    {surahs.map((surah) => (
                      <SelectItem key={surah.id} value={surah.id.toString()} className="focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">
                        <span className={textSizeClasses.text}>
                          {surah.id}. {language === 'ar' ? surah.name : surah.englishName}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Page Selector */}
              <div className="space-y-2">
                <Label htmlFor="update-page" className={cn("font-medium text-emerald-800 dark:text-emerald-300", isRTL ? 'text-right' : 'text-left', textSizeClasses.label)}>
                  {isRTL ? 'الصفحة الجديدة' : 'New Page'}
                </Label>
                <Select value={updateNewPage.toString()} onValueChange={(val) => setUpdateNewPage(parseInt(val))}>
                  <SelectTrigger className="w-full border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 bg-[#FBF9F4] dark:bg-emerald-950">
                    {Array.from({ length: 604 }, (_, i) => i + 1).map((page) => (
                      <SelectItem key={page} value={page.toString()} className="focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100">
                        <span className={textSizeClasses.text}>
                          {page}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                          ? `توجد علامة من نفس النوع في الصفحة ${updateNewPage}`
                          : `A bookmark of the same type already exists on page ${updateNewPage}`,
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
                          ? `تحدثت العلامة إلى ${surahName} - صفحة ${updateNewPage}`
                          : `Bookmark updated to ${surahName} - Page ${updateNewPage}`,
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
          )}
        </div>
      )}

      {activeCategory === 'view' && (
        <div className="space-y-4">
          {/* Back button */}
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
            {isRTL ? 'رجوع' : 'Back'}
          </button>

          <div className="max-h-60 sm:max-h-80 overflow-y-auto">
            {/* Quick Bookmarks */}
            {safeBookmarks.length > 0 && (
              <div className="px-1 sm:px-2 py-1">
                <div className={cn("font-semibold text-amber-600 dark:text-amber-400 px-2 py-1", textSizeClasses.text)}>
                  {isRTL ? 'علامات' : 'Bookmarks'} ({safeBookmarks.length})
                </div>
                {safeBookmarks.map((page) => (
                  <div
                    key={`quick-${page}`}
                    className="flex justify-between items-center py-1 sm:py-1.5 ml-1 sm:ml-2"
                  >
                    <button
                      onClick={() => {
                        onNavigate(page, safeBookmarkPageSurahIds[page], safeBookmarkPageAyahs[page]);
                      }}
                      className={`flex items-center gap-1.5 sm:gap-2 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      <Bookmark className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0 font-medium truncate">
                        {safeBookmarkPageSurahs[page] || '...'} - {t('page')} {page}
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleBookmark(page);
                      }}
                      className="ml-1 sm:ml-2 p-2 bg-red-50 dark:bg-red-900/10 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg flex-shrink-0 transition-colors border border-red-200 dark:border-red-800/40"
                      aria-label="Remove bookmark"
                    >
                      <X className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Memorization Bookmarks */}
            {safeMemorizationBookmarks.length > 0 && (
              <div className="px-1 sm:px-2 py-1">
                <div className={cn("font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-1", textSizeClasses.text)}>
                  {isRTL ? 'حفظ' : 'Memorization'} ({safeMemorizationBookmarks.length})
                </div>
                {safeMemorizationBookmarks.map((page) => (
                  <div
                    key={`mem-${page}`}
                    className="flex justify-between items-center py-1 sm:py-1.5 ml-1 sm:ml-2"
                  >
                    <button
                      onClick={() => {
                        onNavigate(page, safeBookmarkPageSurahIds[page], safeBookmarkPageAyahs[page]);
                      }}
                      className={`flex items-center gap-1.5 sm:gap-2 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      <BookMarked className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600 flex-shrink-0" />
                      <div className={cn("flex-1 min-w-0 font-medium truncate", textSizeClasses.text)}>
                        {safeBookmarkPageSurahs[page] || '...'} - {t('page')} {page}
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveMemorizationBookmark(page);
                      }}
                      className="ml-1 sm:ml-2 p-2 bg-red-50 dark:bg-red-900/10 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg flex-shrink-0 transition-colors border border-red-200 dark:border-red-800/40"
                      aria-label="Remove memorization bookmark"
                    >
                      <X className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Reading Bookmarks */}
            {safeReadingBookmarks.length > 0 && (
              <div className="px-1 sm:px-2 py-1">
                <div className={cn("font-semibold text-blue-600 dark:text-blue-400 px-2 py-1", textSizeClasses.text)}>
                  {isRTL ? 'قراءة' : 'Reading'} ({safeReadingBookmarks.length})
                </div>
                {safeReadingBookmarks.map((page) => (
                  <div
                    key={`read-${page}`}
                    className="flex justify-between items-center py-1 sm:py-1.5 ml-1 sm:ml-2"
                  >
                    <button
                      onClick={() => {
                        onNavigate(page, safeBookmarkPageSurahIds[page], safeBookmarkPageAyahs[page]);
                      }}
                      className={`flex items-center gap-1.5 sm:gap-2 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                      <div className={cn("flex-1 min-w-0 font-medium truncate", textSizeClasses.text)}>
                        {safeBookmarkPageSurahs[page] || '...'} - {t('page')} {page}
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveReadingBookmark(page);
                      }}
                      className="ml-1 sm:ml-2 p-2 bg-red-50 dark:bg-red-900/10 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg flex-shrink-0 transition-colors border border-red-200 dark:border-red-800/40"
                      aria-label="Remove reading bookmark"
                    >
                      <X className="w-5 h-5 md:w-6 md:h-6" />
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
        </div>
      )}
    </div>
  );
}
