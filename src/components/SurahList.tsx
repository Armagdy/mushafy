import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { surahs } from '@/data/surahs';
import { Input } from '@/components/ui/input';
import SurahCard from './SurahCard';
import { cn } from '@/lib/utils';

const SurahList = () => {
  const { t, isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSurahs = useMemo(() => {
    if (!searchQuery.trim()) return surahs;
    
    const query = searchQuery.toLowerCase();
    return surahs.filter(
      surah =>
        surah.name.includes(searchQuery) ||
        surah.englishName.toLowerCase().includes(query) ||
        surah.englishNameTranslation.toLowerCase().includes(query) ||
        surah.id.toString() === query
    );
  }, [searchQuery]);

  return (
    <section id="surahs" className="py-16 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className={cn(
            "text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4",
            isRTL ? "font-arabic" : "font-display"
          )}>
            {t('surahs')}
          </h2>
          
          {/* Search */}
          <div className="max-w-md mx-auto relative">
            <Search className={cn(
              "absolute top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground",
              isRTL ? "right-4" : "left-4"
            )} />
            <Input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "h-12 sm:h-14 text-base sm:text-lg lg:text-xl rounded-xl bg-card border-border",
                isRTL ? "pr-12 font-arabic" : "pl-12"
              )}
            />
          </div>
        </motion.div>

        {/* Surahs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSurahs.map((surah, index) => (
            <SurahCard
              key={surah.id}
              surah={surah}
              index={index}
            />
          ))}
        </div>

        {filteredSurahs.length === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-muted-foreground py-12"
          >
            {isRTL ? 'لم يتم العثور على نتائج' : 'No results found'}
          </motion.p>
        )}
      </div>
    </section>
  );
};

export default SurahList;
