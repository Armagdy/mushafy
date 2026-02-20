import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Bookmark, BookMarked, BookOpen, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { useToast } from "@/hooks/use-toast";
import { surahs } from "@/data/surahs";
import { cn } from "@/lib/utils";
import { useState, useLayoutEffect } from "react";
import { getAyahPage, getPageSurahInfo } from "@/lib/quran-mapping";

interface BookmarksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmarks: number[];
  memorizationBookmarks: number[];
  readingBookmarks: number[];
  bookmarkPageSurahs: Record<number, string>;
  bookmarkPageAyahs: Record<number, number>;
  bookmarkPageSurahIds: Record<number, number>;
  currentSurahId: number;
  currentAyahNum: number;
  currentPage: number;
  currentPlayingAyah: { surah: number; ayah: number } | null;
  onNavigate: (page: number, surahId?: number, ayahNum?: number) => void;
  onToggleBookmark: (page: number) => void;
  onRemoveMemorizationBookmark: (page: number) => void;
  onRemoveReadingBookmark: (page: number) => void;
  onAddBookmarkByType: (type: string, surahId: number, ayahNum: number) => Promise<void>;
}

export function BookmarksDialog({
  open,
  onOpenChange,
  bookmarks,
  memorizationBookmarks,
  readingBookmarks,
  bookmarkPageSurahs,
  bookmarkPageAyahs,
  bookmarkPageSurahIds,
  currentSurahId,
  currentAyahNum,
  currentPage,
  currentPlayingAyah,
  onNavigate,
  onToggleBookmark,
  onRemoveMemorizationBookmark,
  onRemoveReadingBookmark,
  onAddBookmarkByType,
}: BookmarksDialogProps) {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);

  const [selectedBookmarkType, setSelectedBookmarkType] = useState<string>('bookmark');
  const [bookmarkPage, setBookmarkPage] = useState(currentPage);
  const [bookmarkSurahId, setBookmarkSurahId] = useState(currentSurahId);
  const [activeTab, setActiveTab] = useState('add');

  // Update dropdowns when dialog opens
  useLayoutEffect(() => {
    if (open) {
      // Reset to add tab when dialog opens
      setActiveTab('add');
      setBookmarkPage(currentPage);
      setBookmarkSurahId(currentSurahId);
      console.log('📖 Bookmark Dialog Opened:', {
        currentPage,
        currentSurahId,
        selectedBookmarkType
      });
    }
  }, [open, currentPage, currentSurahId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "sm:max-w-md md:max-w-lg lg:max-w-xl max-w-[90vw] max-h-[85vh] overflow-y-auto p-0",
          "rounded-xl border-0 bg-[#FBF9F4]",
          isRTL ? "rtl" : "ltr"
        )}
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        <DialogHeader className="bg-gradient-to-b from-emerald-800 to-emerald-600 rounded-t-xl px-4 py-3">
          <DialogTitle className={cn("text-center font-bold text-[#F2E3BB]", textSizeClasses.title)}>
            {t('bookmarks')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-4 space-y-2 sm:space-y-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-11 md:h-12 bg-emerald-100 dark:bg-emerald-900/30">
            <TabsTrigger value="add" className={cn("data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB]", textSizeClasses.text)}>
              {isRTL ? 'اضف علامة جديدة' : 'Add New Bookmark'}
            </TabsTrigger>
            <TabsTrigger value="view" className={cn("data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB]", textSizeClasses.text)}>
              {isRTL ? 'العلامات' : 'Bookmarks'}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="add" className="space-y-4">
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
                    (selectedBookmarkType === 'bookmark' && bookmarks.includes(bookmarkPage)) ||
                    (selectedBookmarkType === 'memorization' && memorizationBookmarks.includes(bookmarkPage)) ||
                    (selectedBookmarkType === 'reading' && readingBookmarks.includes(bookmarkPage));
                  
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
                  
                  // Switch to view tab to show the saved bookmark
                  setActiveTab('view');
                }}
                className={cn("w-full bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB]", textSizeClasses.button)}
              >
                {t('save')}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="view" className="space-y-4">
            <div className="max-h-60 sm:max-h-80 overflow-y-auto">
              {/* Quick Bookmarks */}
              {bookmarks.length > 0 && (
                <div className="px-1 sm:px-2 py-1">
                  <div className={cn("font-semibold text-amber-600 dark:text-amber-400 px-2 py-1", textSizeClasses.text)}>
                    {isRTL ? 'علامات' : 'Bookmarks'} ({bookmarks.length})
                  </div>
                  {bookmarks.map((page) => (
                    <div
                      key={`quick-${page}`}
                      className="flex justify-between items-center py-1 sm:py-1.5 ml-1 sm:ml-2"
                    >
                      <button
                        onClick={() => {
                          onNavigate(page, bookmarkPageSurahIds[page], bookmarkPageAyahs[page]);
                          onOpenChange(false);
                        }}
                        className={`flex items-center gap-1.5 sm:gap-2 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        <Bookmark className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0 font-medium truncate">
                          {bookmarkPageSurahs[page] || '...'}{bookmarkPageAyahs[page] ? ` - ${isRTL ? 'آية' : 'Ayah'} ${bookmarkPageAyahs[page]}` : ''} - {t('page')} {page}
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleBookmark(page);
                        }}
                        className="ml-1 sm:ml-2 text-red-500 hover:text-red-700 flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Memorization Bookmarks */}
              {memorizationBookmarks.length > 0 && (
                <div className="px-1 sm:px-2 py-1">
                  <div className={cn("font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-1", textSizeClasses.text)}>
                    {isRTL ? 'حفظ' : 'Memorization'} ({memorizationBookmarks.length})
                  </div>
                  {memorizationBookmarks.map((page) => (
                    <div
                      key={`mem-${page}`}
                      className="flex justify-between items-center py-1 sm:py-1.5 ml-1 sm:ml-2"
                    >
                      <button
                        onClick={() => {
                          onNavigate(page, bookmarkPageSurahIds[page], bookmarkPageAyahs[page]);
                          onOpenChange(false);
                        }}
                        className={`flex items-center gap-1.5 sm:gap-2 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        <BookMarked className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600 flex-shrink-0" />
                        <div className={cn("flex-1 min-w-0 font-medium truncate", textSizeClasses.text)}>
                          {bookmarkPageSurahs[page] || '...'}{bookmarkPageAyahs[page] ? ` - ${isRTL ? 'آية' : 'Ayah'} ${bookmarkPageAyahs[page]}` : ''} - {t('page')} {page}
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveMemorizationBookmark(page);
                        }}
                        className="ml-1 sm:ml-2 text-red-500 hover:text-red-700 flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Reading Bookmarks */}
              {readingBookmarks.length > 0 && (
                <div className="px-1 sm:px-2 py-1">
                  <div className={cn("font-semibold text-blue-600 dark:text-blue-400 px-2 py-1", textSizeClasses.text)}>
                    {isRTL ? 'قراءة' : 'Reading'} ({readingBookmarks.length})
                  </div>
                  {readingBookmarks.map((page) => (
                    <div
                      key={`read-${page}`}
                      className="flex justify-between items-center py-1 sm:py-1.5 ml-1 sm:ml-2"
                    >
                      <button
                        onClick={() => {
                          onNavigate(page, bookmarkPageSurahIds[page], bookmarkPageAyahs[page]);
                          onOpenChange(false);
                        }}
                        className={`flex items-center gap-1.5 sm:gap-2 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                        <div className={cn("flex-1 min-w-0 font-medium truncate", textSizeClasses.text)}>
                          {bookmarkPageSurahs[page] || '...'}{bookmarkPageAyahs[page] ? ` - ${isRTL ? 'آية' : 'Ayah'} ${bookmarkPageAyahs[page]}` : ''} - {t('page')} {page}
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveReadingBookmark(page);
                        }}
                        className="ml-1 sm:ml-2 text-red-500 hover:text-red-700 flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* No Bookmarks Message */}
              {bookmarks.length === 0 && memorizationBookmarks.length === 0 && readingBookmarks.length === 0 && (
                <div className={cn("px-3 sm:px-4 py-4 sm:py-6 text-emerald-600 dark:text-emerald-400 text-center", textSizeClasses.text)}>
                  {t('noBookmarks')}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
