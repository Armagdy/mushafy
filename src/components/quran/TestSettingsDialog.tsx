import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { surahs } from "@/data/surahs";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

export type TestMode = 'hifz' | 'tikrar';

export interface TestRange {
  type: 'surah' | 'juz';
  start: number;
  end: number;
  testMode: TestMode;
  difficult: boolean;
  maxQuestions: number;
}

interface TestSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (range: TestRange) => void;
}

export function TestSettingsDialog({
  open,
  onOpenChange,
  onStart,
}: TestSettingsDialogProps) {
  const { t, isRTL, language } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  
  const [rangeType, setRangeType] = useState<'surah' | 'juz'>('surah');
  const [testMode, setTestMode] = useState<TestMode>('hifz');
  const [difficult, setDifficult] = useState(false);
  const [startSurah, setStartSurah] = useState(1);
  const [endSurah, setEndSurah] = useState(114);
  const [startJuz, setStartJuz] = useState(1);
  const [endJuz, setEndJuz] = useState(30);
  const [maxQuestions, setMaxQuestions] = useState(20);

  // Format number based on language
  const formatNumber = (num: number): string => {
    if (language === 'ar') {
      return num.toString().replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
    }
    return num.toString();
  };

  const handleStart = () => {
    const range: TestRange = {
      type: rangeType,
      start: rangeType === 'surah' ? startSurah : startJuz,
      end: rangeType === 'surah' ? endSurah : endJuz,
      testMode,
      difficult,
      maxQuestions: maxQuestions > 0 ? maxQuestions : 20,
    };
    onStart(range);
    onOpenChange(false);
  };

  // Validate ranges
  useEffect(() => {
    if (startSurah > endSurah) {
      setEndSurah(startSurah);
    }
  }, [startSurah, endSurah]);

  useEffect(() => {
    if (startJuz > endJuz) {
      setEndJuz(startJuz);
    }
  }, [startJuz, endJuz]);

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
        <div className="bg-gradient-to-b from-emerald-800 to-emerald-600 rounded-t-xl px-4 py-3">
          <DialogTitle className={cn("text-center font-bold text-[#F2E3BB]", textSizeClasses.title)}>
            {t('testSettings')}
          </DialogTitle>
        </div>

        <div className="space-y-4 p-4">
          {/* Test Type Selector */}
          <div className="space-y-2">
            <Label className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>{t('testType')}</Label>
            <Select
              value={testMode}
              onValueChange={(v) => setTestMode(v as TestMode)}
            >
              <SelectTrigger className={cn("border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500", isRTL && "text-right", textSizeClasses.text)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
                <SelectItem value="hifz" className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100", textSizeClasses.text)}>{t('testTypeHifz')}</SelectItem>
                <SelectItem value="tikrar" className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100", textSizeClasses.text)}>{t('testTypeTikrar')}</SelectItem>
              </SelectContent>
            </Select>
            <p className={cn("text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
              {testMode === 'hifz' ? t('testTypeHifzDesc') : t('testTypeTikrarDesc')}
            </p>
          </div>

          {/* Max Questions Input */}
          <div className="space-y-2">
            <Label className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>{t('maxQuestions')}</Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={maxQuestions}
              onChange={(e) => setMaxQuestions(parseInt(e.target.value) || 20)}
              className={cn("border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500", textSizeClasses.text)}
            />
          </div>

          <Tabs value={rangeType} onValueChange={(v) => setRangeType(v as 'surah' | 'juz')}>
            <TabsList className="grid w-full grid-cols-2 h-11 md:h-12 bg-emerald-100 dark:bg-emerald-900/30">
              <TabsTrigger value="surah" className={cn("data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB]", textSizeClasses.text)}>{t('surahRange')}</TabsTrigger>
              <TabsTrigger value="juz" className={cn("data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB]", textSizeClasses.text)}>{t('juzRange')}</TabsTrigger>
            </TabsList>

            <TabsContent value="surah" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>{t('startSurah')}</Label>
                <Select
                  value={startSurah.toString()}
                  onValueChange={(v) => setStartSurah(parseInt(v))}
                >
                  <SelectTrigger className={cn("border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500", isRTL && "text-right", textSizeClasses.text)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 bg-[#FBF9F4] dark:bg-emerald-950">
                    {surahs.map((surah) => (
                      <SelectItem key={surah.id} value={surah.id.toString()} className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100", textSizeClasses.text)}>
                        {formatNumber(surah.id)}. {language === 'ar' ? surah.name : surah.englishName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>{t('endSurah')}</Label>
                <Select
                  value={endSurah.toString()}
                  onValueChange={(v) => setEndSurah(parseInt(v))}
                >
                  <SelectTrigger className={cn("border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500", isRTL && "text-right", textSizeClasses.text)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 bg-[#FBF9F4] dark:bg-emerald-950">
                    {surahs.filter(s => s.id >= startSurah).map((surah) => (
                      <SelectItem key={surah.id} value={surah.id.toString()} className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100", textSizeClasses.text)}>
                        {formatNumber(surah.id)}. {language === 'ar' ? surah.name : surah.englishName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="juz" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>{t('startJuz')}</Label>
                <Select
                  value={startJuz.toString()}
                  onValueChange={(v) => setStartJuz(parseInt(v))}
                >
                  <SelectTrigger className={cn("border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500", isRTL && "text-right", textSizeClasses.text)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 bg-[#FBF9F4] dark:bg-emerald-950">
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => (
                      <SelectItem key={juz} value={juz.toString()} className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100", textSizeClasses.text)}>
                        {t('juz')} {formatNumber(juz)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>{t('endJuz')}</Label>
                <Select
                  value={endJuz.toString()}
                  onValueChange={(v) => setEndJuz(parseInt(v))}
                >
                  <SelectTrigger className={cn("border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500", isRTL && "text-right", textSizeClasses.text)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 bg-[#FBF9F4] dark:bg-emerald-950">
                    {Array.from({ length: 30 }, (_, i) => i + 1)
                      .filter(juz => juz >= startJuz)
                      .map((juz) => (
                        <SelectItem key={juz} value={juz.toString()} className={cn("focus:bg-emerald-100 focus:text-emerald-900 dark:focus:bg-emerald-800 dark:focus:text-emerald-100", textSizeClasses.text)}>
                          {t('juz')} {formatNumber(juz)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>

          {/* Difficult Mode Toggle */}
          <div
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
              difficult
                ? "border-orange-400 bg-orange-50 dark:bg-orange-900/20"
                : "border-gray-200 bg-gray-50 dark:bg-gray-800"
            )}
            onClick={() => setDifficult(prev => !prev)}
          >
            <div className="space-y-0.5">
              <p className={cn(
                "font-medium",
                difficult ? "text-orange-700 dark:text-orange-300" : "text-gray-700 dark:text-gray-300",
                textSizeClasses.text
              )}>
                {t('difficultMode')}
              </p>
            </div>
            <div className={cn(
              "w-10 h-6 rounded-full transition-colors relative",
              difficult ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"
            )}>
              <div className={cn(
                "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                difficult ? (isRTL ? "left-1" : "right-1") : (isRTL ? "right-1" : "left-1")
              )} />
            </div>
          </div>

          <Button
            onClick={handleStart}
            className={cn("w-full bg-emerald-700 hover:bg-emerald-800 text-[#F2E3BB] rounded-lg border border-emerald-600 shadow-md", textSizeClasses.button)}
          >
            {t('startTest')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
