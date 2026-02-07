import { motion } from 'framer-motion';
import { Book, Heart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const Footer = () => {
  const { t, isRTL } = useLanguage();

  return (
    <footer className="bg-card border-t border-border py-12">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl gradient-emerald flex items-center justify-center">
              <Book className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className={cn(
              "text-xl sm:text-2xl lg:text-3xl font-bold text-foreground",
              isRTL ? "font-arabic" : "font-display"
            )}>
              {t('appName')}
            </span>
          </div>

          {/* Made with love */}
          <p className="flex items-center justify-center gap-2 text-muted-foreground text-base sm:text-lg">
            {isRTL ? 'صنع بـ' : 'Made with'}
            <Heart className="w-4 h-4 text-destructive fill-destructive" />
            {isRTL ? 'للمسلمين في كل مكان' : 'for Muslims everywhere'}
          </p>

          {/* Copyright */}
          <p className="text-sm sm:text-base text-muted-foreground mt-4">
            © {new Date().getFullYear()} {t('appName')}
          </p>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;
