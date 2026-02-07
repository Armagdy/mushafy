import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Bookmark, BookMarked, BookOpen, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { surahs } from "@/data/surahs";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface BookmarksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmarks: number[];
  memorizationBookmarks: number[];
  readingBookmarks: number[];
  bookmarkPageSurahs: Record<number, string>;
  bookmarkPageAyahs: Record<number, number>;
  onNavigate: (page: number) => void;
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
  onNavigate,
  onToggleBookmark,
  onRemoveMemorizationBookmark,
  onRemoveReadingBookmark,
  onAddBookmarkByType,
}: BookmarksDialogProps) {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();

  const [selectedBookmarkType, setSelectedBookmarkType] = useState<string>('bookmark');
  const [bookmarkSurahId, setBookmarkSurahId] = useState(1);
  const [bookmarkAyahNum, setBookmarkAyahNum] = useState(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "sm:max-w-md max-w-[90vw] max-h-[85vh] overflow-y-auto",
        "rounded-xl border border-emerald-500",
        isRTL ? "rtl" : "ltr"
      )}>
        <DialogHeader>
          <DialogTitle className="font-bold bg-gradient-to-r from-emerald-800 to-emerald-600 bg-clip-text text-transparent">
            {t('bookmarks')}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="add" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-11 md:h-12">
            <TabsTrigger value="add" className="text-base md:text-xl">
              {isRTL ? 'اضف علامة جديدة' : 'Add New Bookmark'}
            </TabsTrigger>
            <TabsTrigger value="view" className="text-base md:text-xl">
              {isRTL ? 'العلامات' : 'Bookmarks'}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="add" className="space-y-4">
            <div className="space-y-2 sm:space-y-3">
              {/* Bookmark Type Selector */}
              <div className="space-y-2">
                <Label htmlFor="bookmark-type" className={`text-base md:text-xl font-medium ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('bookmarkType')}
                </Label>
                <Select value={selectedBookmarkType} onValueChange={setSelectedBookmarkType}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bookmark">
                      <div className="flex items-center gap-2">
                        <Bookmark className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500" />
                        <span className="text-base md:text-xl">{isRTL ? 'علامة' : 'Bookmark'}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="memorization">
                      <div className="flex items-center gap-2">
                        <BookMarked className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600" />
                        <span className="text-base md:text-xl">{isRTL ? 'حفظ' : 'Memorization'}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="reading">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                        <span className="text-base md:text-xl">{isRTL ? 'قراءة' : 'Reading'}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Surah Selector */}
              <div className="space-y-2">
                <Label htmlFor="bookmark-surah" className={`text-base md:text-xl font-medium ${isRTL ? 'text-right' : 'text-left'}`}>
                  {isRTL ? 'السورة' : 'Surah'}
                </Label>
                <Select value={bookmarkSurahId.toString()} onValueChange={(val) => {
                  setBookmarkSurahId(parseInt(val));
                  // Reset ayah to 1 when surah changes
                  setBookmarkAyahNum(1);
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {surahs.map((surah) => (
                      <SelectItem key={surah.id} value={surah.id.toString()}>
                        <span className="text-base md:text-xl">
                          {surah.id}. {language === 'ar' ? surah.name : surah.englishName}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ayah Selector */}
              <div className="space-y-2">
                <Label htmlFor="bookmark-ayah" className={`text-base md:text-xl font-medium ${isRTL ? 'text-right' : 'text-left'}`}>
                  {isRTL ? 'الآية' : 'Ayah'}
                </Label>
                <Select value={bookmarkAyahNum.toString()} onValueChange={(val) => setBookmarkAyahNum(parseInt(val))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Array.from({ length: surahs.find(s => s.id === bookmarkSurahId)?.numberOfAyahs || 1 }, (_, i) => i + 1).map((ayahNum) => (
                      <SelectItem key={ayahNum} value={ayahNum.toString()}>
                        <span className="text-base md:text-xl">
                          {isRTL ? 'آية' : 'Ayah'} {ayahNum}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Save Button */}
              <Button
                onClick={async () => {
                  await onAddBookmarkByType(selectedBookmarkType, bookmarkSurahId, bookmarkAyahNum);
                  toast({
                    title: isRTL ? 'تم الحفظ' : 'Saved',
                    description: isRTL ? 'تمت إضافة علامة جديدة بنجاح' : 'New bookmark saved successfully',
                    duration: 1000,
                    className: 'bg-emerald-500 text-white border-emerald-600',
                  });
                  onOpenChange(false);
                }}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 py-2 text-base md:text-xl"
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
                  <div className="font-semibold text-amber-600 dark:text-amber-400 px-2 py-1">
                    {isRTL ? 'علامات' : 'Bookmarks'} ({bookmarks.length})
                  </div>
                  {bookmarks.map((page) => (
                    <div
                      key={`quick-${page}`}
                      className="flex justify-between items-center py-1 sm:py-1.5 ml-1 sm:ml-2"
                    >
                      <button
                        onClick={() => {
                          onNavigate(page);
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
                  <div className="font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-1">
                    {isRTL ? 'حفظ' : 'Memorization'} ({memorizationBookmarks.length})
                  </div>
                  {memorizationBookmarks.map((page) => (
                    <div
                      key={`mem-${page}`}
                      className="flex justify-between items-center py-1 sm:py-1.5 ml-1 sm:ml-2"
                    >
                      <button
                        onClick={() => {
                          onNavigate(page);
                          onOpenChange(false);
                        }}
                        className={`flex items-center gap-1.5 sm:gap-2 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        <BookMarked className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0 font-medium truncate">
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
                  <div className="font-semibold text-blue-600 dark:text-blue-400 px-2 py-1">
                    {isRTL ? 'قراءة' : 'Reading'} ({readingBookmarks.length})
                  </div>
                  {readingBookmarks.map((page) => (
                    <div
                      key={`read-${page}`}
                      className="flex justify-between items-center py-1 sm:py-1.5 ml-1 sm:ml-2"
                    >
                      <button
                        onClick={() => {
                          onNavigate(page);
                          onOpenChange(false);
                        }}
                        className={`flex items-center gap-1.5 sm:gap-2 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0 font-medium truncate">
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
                <div className="px-3 sm:px-4 py-4 sm:py-6 text-gray-500 dark:text-gray-400 text-center">
                  {t('noBookmarks')}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
