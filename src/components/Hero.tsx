import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const Hero = () => {
  const { t, isRTL } = useLanguage();

  const scrollToSurahs = () => {
    document.getElementById('surahs')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden gradient-hero islamic-pattern">
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-20 left-10 w-64 h-64 rounded-full bg-primary/5 blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-accent/10 blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-3xl mx-auto">
          {/* Bismillah */}
          <motion.p
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-arabic text-primary mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            ﷽
          </motion.p>

          {/* Main Title */}
          <motion.h1
            className={cn(
              "text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold text-foreground mb-6",
              isRTL ? "font-arabic" : "font-display"
            )}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {t('heroTitle')}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className={cn(
              "text-xl sm:text-2xl md:text-3xl lg:text-4xl text-muted-foreground mb-12",
              isRTL ? "font-arabic" : "font-body"
            )}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {t('heroSubtitle')}
          </motion.p>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Button
              size="lg"
              onClick={scrollToSurahs}
              className="gradient-emerald text-primary-foreground px-8 py-6 text-xl sm:text-2xl rounded-xl shadow-elevated hover:shadow-card transition-all duration-300 hover:scale-105"
            >
              {t('exploreQuran')}
              <ChevronDown className={cn("w-5 h-5", isRTL ? "mr-2" : "ml-2")} />
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="grid grid-cols-3 gap-8 mt-16 max-w-lg mx-auto"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-primary font-display">114</p>
              <p className="text-sm text-muted-foreground mt-1">{t('totalSurahs')}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-primary font-display">6,236</p>
              <p className="text-sm text-muted-foreground mt-1">{t('totalVerses')}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-primary font-display">30</p>
              <p className="text-sm text-muted-foreground mt-1">{t('totalJuz')}</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ChevronDown className="w-6 h-6 text-muted-foreground" />
      </motion.div>
    </section>
  );
};

export default Hero;
