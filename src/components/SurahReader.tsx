import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Surah, alFatihaVerses } from '@/data/surahs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SurahReaderProps {
  surah: Surah;
  onBack: () => void;
}

// Convert number to Arabic numerals
const toArabicNumber = (num: number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().split('').map(digit => arabicNumerals[parseInt(digit)]).join('');
};

// Verse number ornament component
const VerseNumber = ({ number }: { number: number }) => (
  <span 
    className="inline-flex items-center justify-center mx-2 relative"
    style={{ verticalAlign: 'middle' }}
  >
    <svg 
      viewBox="0 0 50 50" 
      className="w-10 h-10 md:w-12 md:h-12"
      style={{ filter: 'drop-shadow(1px 1px 1px rgba(0,0,0,0.2))' }}
    >
      {/* Outer octagonal frame */}
      <polygon 
        points="25,2 40,10 48,25 40,40 25,48 10,40 2,25 10,10" 
        fill="none" 
        stroke="#c9a962" 
        strokeWidth="2"
      />
      {/* Inner circle */}
      <circle cx="25" cy="25" r="14" fill="#fefdf8" stroke="#c9a962" strokeWidth="1.5" />
      {/* Number */}
      <text 
        x="25" 
        y="26" 
        textAnchor="middle" 
        dominantBaseline="middle" 
        fill="#8b6914"
        fontSize="14"
        fontFamily="'Amiri', serif"
        fontWeight="bold"
      >
        {toArabicNumber(number)}
      </text>
    </svg>
  </span>
);

const SurahReader = ({ surah, onBack }: SurahReaderProps) => {
  const { t, isRTL, language } = useLanguage();

  // For demo purposes, we only have verses for Al-Fatiha
  const verses = surah.id === 1 ? alFatihaVerses : [];

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <section className="min-h-screen py-8 bg-gradient-to-b from-[#f0e6d3] to-[#e8dcc8]">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
          <Button
            variant="ghost"
            onClick={onBack}
            className="gap-2 text-[#5c4a37] hover:bg-[#e8dcc8]"
          >
            <BackIcon className="w-4 h-4" />
            {t('surahs')}
          </Button>
        </motion.div>

        {/* Mushaf Page Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative"
        >
          {/* Outer decorative frame - Gold */}
          <div className="bg-gradient-to-br from-[#d4af37] via-[#c9a962] to-[#b8942e] p-3 md:p-4 rounded-lg shadow-2xl">
            {/* Blue inner frame */}
            <div className="bg-gradient-to-br from-[#1e4d7b] to-[#2a5f8f] p-2 md:p-3 rounded">
              {/* Inner gold frame */}
              <div className="bg-gradient-to-br from-[#d4af37] via-[#c9a962] to-[#b8942e] p-2 rounded">
                {/* Main content area */}
                <div className="bg-[#fefdf8] rounded relative overflow-hidden">
                  {/* Decorative corner patterns */}
                  <div className="absolute top-0 left-0 w-16 h-16 md:w-24 md:h-24 opacity-30">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#2e7d32] to-transparent rounded-br-full" />
                  </div>
                  <div className="absolute top-0 right-0 w-16 h-16 md:w-24 md:h-24 opacity-30">
                    <div className="absolute inset-0 bg-gradient-to-bl from-[#2e7d32] to-transparent rounded-bl-full" />
                  </div>
                  <div className="absolute bottom-0 left-0 w-16 h-16 md:w-24 md:h-24 opacity-30">
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#2e7d32] to-transparent rounded-tr-full" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-16 h-16 md:w-24 md:h-24 opacity-30">
                    <div className="absolute inset-0 bg-gradient-to-tl from-[#2e7d32] to-transparent rounded-tl-full" />
                  </div>

                  <div className="p-6 md:p-10 relative z-10">
                    {/* Surah Header */}
                    <div className="text-center mb-8">
                      <div className="inline-block px-8 py-4 bg-gradient-to-r from-[#c9a962]/20 via-[#c9a962]/40 to-[#c9a962]/20 rounded-lg border-2 border-[#c9a962] relative">
                        {/* Decorative elements */}
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-20 h-1 bg-gradient-to-r from-transparent via-[#c9a962] to-transparent" />
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-1 bg-gradient-to-r from-transparent via-[#c9a962] to-transparent" />
                        
                        <p className="text-base sm:text-lg text-[#8b6914] mb-1">سُورَةُ</p>
                        <h1 
                          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#2c1810]" 
                          style={{ fontFamily: "'Amiri', 'Noto Naskh Arabic', serif" }}
                        >
                          {surah.name}
                        </h1>
                        <p className="text-base sm:text-lg text-[#5c4a37] mt-1">
                          {surah.revelationType === 'Meccan' ? 'مَكِّيَّة' : 'مَدَنِيَّة'}
                        </p>
                      </div>
                    </div>

                    {/* Quran Text - Mushaf Style */}
                    <div className="quran-content" dir="rtl">
                      {verses.length > 0 ? (
                        <div className="space-y-4">
                          {verses.map((verse, index) => (
                            <motion.div
                              key={verse.number}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.2 + index * 0.1 }}
                              className={cn(
                                "text-center py-2 px-4 rounded",
                                // Alternate subtle backgrounds like in the reference
                                index % 3 === 1 && "bg-[#e8f4fc]/50",
                                index % 3 === 2 && "bg-[#f0e6fa]/30"
                              )}
                            >
                              <p 
                                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl leading-[2.2] text-[#2c1810] inline"
                                style={{ 
                                  fontFamily: "'Amiri', 'Noto Naskh Arabic', serif",
                                  wordSpacing: '0.15em'
                                }}
                              >
                                {verse.text}
                                <VerseNumber number={verse.number} />
                              </p>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-16">
                          <p className="text-[#5c4a37] text-xl sm:text-2xl md:text-3xl font-arabic">
                            سيتم إضافة آيات هذه السورة قريباً
                          </p>
                          <p className="text-base sm:text-lg text-[#8b7355] mt-2">
                            حالياً متوفر: سورة الفاتحة
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Translation Section */}
                    {verses.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="mt-10 pt-6 border-t-2 border-[#c9a962]/30"
                      >
                        <div className="bg-[#f8f5ef] rounded-lg p-4 border border-[#c9a962]/20">
                          <h3 className="text-center text-[#8b6914] font-semibold mb-4 text-base sm:text-lg md:text-xl">
                            {isRTL ? 'المعاني' : 'Translation'}
                          </h3>
                          <div className={cn(
                            "space-y-2 text-base sm:text-lg md:text-xl",
                            isRTL ? "text-right" : "text-left"
                          )}>
                            {verses.map((verse) => (
                              <p 
                                key={verse.number}
                                className={cn(
                                  "text-[#4a3c2f] leading-relaxed",
                                  isRTL ? "font-arabic" : "font-body"
                                )}
                              >
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#c9a962]/20 text-[#8b6914] text-xs font-bold mr-2">
                                  {verse.number}
                                </span>
                                {verse.translation}
                              </p>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Page Info */}
                    <div className="text-center mt-6 pt-4 border-t border-[#c9a962]/20">
                      <span className="text-[#8b6914] text-base sm:text-lg font-arabic">
                        {surah.numberOfAyahs} آيات
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Arrows */}
          <div className="flex justify-between items-center mt-6">
            <Button
              variant="outline"
              className="gap-2 border-[#c9a962] text-[#5c4a37] hover:bg-[#c9a962]/10 bg-white/80 text-base sm:text-lg"
              disabled={surah.id <= 1}
            >
              <PrevIcon className="w-4 h-4" />
              {isRTL ? 'السورة التالية' : 'Previous Surah'}
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-[#c9a962] text-[#5c4a37] hover:bg-[#c9a962]/10 bg-white/80 text-base sm:text-lg"
              disabled={surah.id >= 114}
            >
              {isRTL ? 'السورة السابقة' : 'Next Surah'}
              <NextIcon className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default SurahReader;
