import { motion } from 'framer-motion';
import { Book, Globe, Menu, X, BookOpen } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMushaf } from '@/contexts/MushafContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Header = () => {
  const { language, setLanguage, t, isRTL } = useLanguage();
  const { mushafType, setMushafType } = useMushaf();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <motion.div 
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-10 h-10 rounded-xl gradient-emerald flex items-center justify-center">
              <Book className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className={cn(
              "text-xl sm:text-2xl lg:text-3xl font-bold text-foreground",
              isRTL ? "font-arabic" : "font-display"
            )}>
              {t('appName')}
            </span>
          </motion.div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <a 
              href="#surahs" 
              className="text-base sm:text-lg lg:text-xl text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('surahs')}
            </a>
            DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>{mushafType === 'mwdoa' ? t('mushafMwdoa') : t('mushafTashel')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                <DropdownMenuLabel>{t('mushafType')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setMushafType('mwdoa')}
                  className={cn(mushafType === 'mwdoa' && 'bg-accent')}
                >
                  {t('mushafMwdoa')}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setMushafType('tashel')}
                  className={cn(mushafType === 'tashel' && 'bg-accent')}
                >
                  {t('mushafTashel')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLanguage}
              className="flex items-center gap-2"
            >
              <Globe className="w-4 h-4" />
              <span>{language === 'ar' ? 'English' : 'العربية'}</span>
            </Bdiv className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t('mushafType')}</span>
                <div className="flex gap-2">
                  <Button
                    variant={mushafType === 'mwdoa' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMushafType('mwdoa')}
                    className="flex-1"
                  >
                    {t('mushafMwdoa')}
                  </Button>
                  <Button
                    variant={mushafType === 'tashel' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMushafType('tashel')}
                    className="flex-1"
                  >
                    {t('mushafTashel')}
                  </Button>
                </div>
              </div>
              
              <utton>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden py-4 border-t border-border"
          >
            <nav className="flex flex-col gap-4">
              <a 
                href="#surahs" 
                className="text-muted-foreground hover:text-foreground transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('surahs')}
              </a>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  toggleLanguage();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 w-fit"
              >
                <Globe className="w-4 h-4" />
                <span>{language === 'ar' ? 'English' : 'العربية'}</span>
              </Button>
            </nav>
          </motion.div>
        )}
      </div>
    </header>
  );
};

export default Header;
