import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
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
  
  const [rangeType, setRangeType] = useState<'surah' | 'juz'>('surah');
  const [testMode, setTestMode] = useState<TestMode>('hifz');
  const [difficult, setDifficult] = useState(false);
  const [startSurah, setStartSurah] = useState(1);
  const [endSurah, setEndSurah] = useState(114);
  const [startJuz, setStartJuz] = useState(1);
  const [endJuz, setEndJuz] = useState(30);

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
          "sm:max-w-md md:max-w-lg lg:max-w-xl max-w-[90vw] max-h-[85vh] overflow-y-auto",
          "rounded-xl border border-emerald-500",
          isRTL ? "rtl" : "ltr"
        )}
      >
        <DialogTitle className="text-center text-base md:text-xl font-bold bg-gradient-to-r from-emerald-800 to-emerald-600 bg-clip-text text-transparent">
          {t('testSettings')}
        </DialogTitle>

        <div className="space-y-4 mt-4">
          {/* Test Type Selector */}
          <div className="space-y-2">
            <Label className="text-base md:text-xl font-medium">{t('testType')}</Label>
            <Select
              value={testMode}
              onValueChange={(v) => setTestMode(v as TestMode)}
            >
              <SelectTrigger className={cn("text-base md:text-xl", isRTL && "text-right")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hifz" className="text-base md:text-xl">{t('testTypeHifz')}</SelectItem>
                <SelectItem value="tikrar" className="text-base md:text-xl">{t('testTypeTikrar')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-base md:text-xl text-gray-500 dark:text-gray-400">
              {testMode === 'hifz' ? t('testTypeHifzDesc') : t('testTypeTikrarDesc')}
            </p>
          </div>

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
                "text-base md:text-xl font-medium",
                difficult ? "text-orange-700 dark:text-orange-300" : "text-gray-700 dark:text-gray-300"
              )}>
                {t('difficultMode')}
              </p>
              <p className="text-base md:text-xl text-gray-500 dark:text-gray-400">
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

          <Tabs value={rangeType} onValueChange={(v) => setRangeType(v as 'surah' | 'juz')}>
            <TabsList className="grid w-full grid-cols-2 h-11 md:h-12">
              <TabsTrigger value="surah" className="text-base md:text-xl">{t('surahRange')}</TabsTrigger>
              <TabsTrigger value="juz" className="text-base md:text-xl">{t('juzRange')}</TabsTrigger>
            </TabsList>

            <TabsContent value="surah" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-base md:text-xl font-medium">{t('startSurah')}</Label>
                <Select
                  value={startSurah.toString()}
                  onValueChange={(v) => setStartSurah(parseInt(v))}
                >
                  <SelectTrigger className={cn(isRTL && "text-right")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {surahs.map((surah) => (
                      <SelectItem key={surah.id} value={surah.id.toString()}>
                        {formatNumber(surah.id)}. {language === 'ar' ? surah.name : surah.englishName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-base md:text-xl font-medium">{t('endSurah')}</Label>
                <Select
                  value={endSurah.toString()}
                  onValueChange={(v) => setEndSurah(parseInt(v))}
                >
                  <SelectTrigger className={cn(isRTL && "text-right")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {surahs.filter(s => s.id >= startSurah).map((surah) => (
                      <SelectItem key={surah.id} value={surah.id.toString()}>
                        {formatNumber(surah.id)}. {language === 'ar' ? surah.name : surah.englishName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="juz" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-base md:text-xl font-medium">{t('startJuz')}</Label>
                <Select
                  value={startJuz.toString()}
                  onValueChange={(v) => setStartJuz(parseInt(v))}
                >
                  <SelectTrigger className={cn(isRTL && "text-right")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => (
                      <SelectItem key={juz} value={juz.toString()}>
                        {t('juz')} {formatNumber(juz)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-base md:text-xl font-medium">{t('endJuz')}</Label>
                <Select
                  value={endJuz.toString()}
                  onValueChange={(v) => setEndJuz(parseInt(v))}
                >
                  <SelectTrigger className={cn(isRTL && "text-right")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Array.from({ length: 30 }, (_, i) => i + 1)
                      .filter(juz => juz >= startJuz)
                      .map((juz) => (
                        <SelectItem key={juz} value={juz.toString()}>
                          {t('juz')} {formatNumber(juz)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>

          <Button
            onClick={handleStart}
            className="w-full text-base md:text-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600"
          >
            {t('startTest')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
