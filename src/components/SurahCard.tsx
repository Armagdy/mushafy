import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Surah } from '@/data/surahs';
import { cn } from '@/lib/utils';

interface SurahCardProps {
  surah: Surah;
  index: number;
}

const SurahCard = ({ surah, index }: SurahCardProps) => {
  const navigate = useNavigate();
  const { t, isRTL, language } = useLanguage();

  const revelationType = surah.revelationType === 'Meccan' ? t('meccan') : t('medinan');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.02 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/page/1`)}
      className="group cursor-pointer"
    >
      <div className="bg-card rounded-2xl p-5 shadow-soft hover:shadow-card transition-all duration-300 border border-border hover:border-primary/20">
        <div className="flex items-center gap-4">
          {/* Surah Number */}
          <div className="verse-number text-primary-foreground font-arabic text-xl sm:text-2xl shrink-0">
            {surah.id}
          </div>

          {/* Surah Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className={cn(
                  "text-xl sm:text-2xl lg:text-2xl font-bold text-foreground group-hover:text-primary transition-colors",
                  isRTL ? "font-arabic" : "font-display"
                )}>
                  {language === 'ar' ? surah.name : surah.englishName}
                </h3>
                <p className="text-base sm:text-lg text-muted-foreground mt-0.5">
                  {language === 'ar' ? surah.englishName : surah.englishNameTranslation}
                </p>
              </div>

              {/* Arabic name for English mode */}
              {language === 'en' && (
                <span className="text-2xl sm:text-3xl font-arabic text-primary/70">
                  {surah.name}
                </span>
              )}
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-3 mt-2 text-sm sm:text-base text-muted-foreground">
              <span className={cn(
                "px-2 py-0.5 rounded-full",
                surah.revelationType === 'Meccan' 
                  ? "bg-primary/10 text-primary" 
                  : "bg-accent/20 text-accent-foreground"
              )}>
                {revelationType}
              </span>
              <span>
                {surah.numberOfAyahs} {t('verses')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SurahCard;
