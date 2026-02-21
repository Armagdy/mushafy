import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { surahs } from "@/data/surahs";
import { TestRange, TestMode } from "./TestSettingsDialog";

interface TestViewSettingsProps {
  testRange: TestRange;
  testMode: TestMode;
  difficult: boolean;
  maxQuestions: number;
}

export function TestViewSettings({
  testRange,
  testMode,
  difficult,
  maxQuestions,
}: TestViewSettingsProps) {
  const { t, language } = useLanguage();

  // Format number based on language
  const formatNumber = (num: number): string => {
    if (language === 'ar') {
      return num.toString().replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
    }
    return num.toString();
  };

  return (
    <Card className="p-8 text-center border-0 bg-white dark:bg-gray-800 shadow-md space-y-6">
      <h2 className="text-xl md:text-2xl font-bold text-emerald-800 dark:text-emerald-300 mb-6">
        {t('testSettings')}
      </h2>
      
      {/* Test Mode */}
      <div className="space-y-2">
        <Label className="text-base md:text-lg font-semibold text-emerald-700 dark:text-emerald-400">
          {t('testType')}
        </Label>
        <p className="text-base md:text-xl text-emerald-900 dark:text-emerald-200">
          {testMode === 'hifz' ? t('testTypeHifz') : t('testTypeTikrar')}
        </p>
      </div>

      {/* Range */}
      <div className="space-y-2">
        <Label className="text-base md:text-lg font-semibold text-emerald-700 dark:text-emerald-400">
          {t('rangeType')}
        </Label>
        <p className="text-base md:text-xl text-emerald-900 dark:text-emerald-200">
          {testRange.type === 'surah' ? (
            <>
              {language === 'ar' ? 'من سورة ' : 'From Surah '}
              {testRange.type === 'surah' 
                ? (language === 'ar' 
                    ? surahs[testRange.start - 1]?.name 
                    : surahs[testRange.start - 1]?.englishName)
                : formatNumber(testRange.start)}
              {language === 'ar' ? ' إلى سورة ' : ' to Surah '}
              {testRange.type === 'surah' 
                ? (language === 'ar' 
                    ? surahs[testRange.end - 1]?.name 
                    : surahs[testRange.end - 1]?.englishName)
                : formatNumber(testRange.end)}
            </>
          ) : (
            <>
              {language === 'ar' ? 'من الجزء ' : 'From Juz '}
              {formatNumber(testRange.start)}
              {language === 'ar' ? ' إلى الجزء ' : ' to Juz '}
              {formatNumber(testRange.end)}
            </>
          )}
        </p>
      </div>

      {/* Difficulty */}
      <div className="space-y-2">
        <Label className="text-base md:text-lg font-semibold text-emerald-700 dark:text-emerald-400">
          {t('difficultMode')}
        </Label>
        <p className="text-base md:text-xl text-emerald-900 dark:text-emerald-200">
          {difficult ? (language === 'ar' ? 'نعم' : 'Yes') : (language === 'ar' ? 'لا' : 'No')}
        </p>
      </div>

      {/* Max Questions */}
      <div className="space-y-2">
        <Label className="text-base md:text-lg font-semibold text-emerald-700 dark:text-emerald-400">
          {t('maxQuestions')}
        </Label>
        <p className="text-base md:text-xl text-emerald-900 dark:text-emerald-200">
          {formatNumber(maxQuestions)}
        </p>
      </div>
    </Card>
  );
}
