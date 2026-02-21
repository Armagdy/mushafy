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
    <header className="sticky top-0 z-50 bg-gradient-to-b from-emerald-800 to-emerald-600 shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <motion.div 
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Book className="w-5 h-5 text-white" />
            </div>
            <span className={cn(
              "text-xl sm:text-2xl lg:text-3xl font-bold text-white",
              isRTL ? "font-arabic" : "font-display"
            )}>
              {t('appName')}
            </span>
          </motion.div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <a 
              href="#surahs" 
              className="text-base sm:text-lg lg:text-xl text-white/80 hover:text-white transition-colors"
            >
              {t('surahs')}
            </a>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 text-white hover:bg-white/20 hover:text-white border border-white/30"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>{mushafType === 'mwdoa' ? t('mushafMwdoa') : mushafType === 'tashel' ? t('mushafTashel') : t('mushafMadinah')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                <DropdownMenuLabel>{t('mushafType')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setMushafType('mwdoa')}
                  className={cn(mushafType === 'mwdoa' && 'bg-emerald-100')}
                >
                  {t('mushafMwdoa')}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setMushafType('tashel')}
                  className={cn(mushafType === 'tashel' && 'bg-emerald-100')}
                >
                  {t('mushafTashel')}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setMushafType('madinah')}
                  className={cn(mushafType === 'madinah' && 'bg-emerald-100')}
                >
                  {t('mushafMadinah')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="flex items-center gap-2 text-white hover:bg-white/20 hover:text-white border border-white/30"
            >
              <Globe className="w-4 h-4" />
              <span>{language === 'ar' ? 'English' : 'العربية'}</span>
            </Button>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-white"
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
            className="md:hidden py-4 border-t border-white/20"
          >
            <nav className="flex flex-col gap-4">
              <a 
                href="#surahs" 
                className="text-white/80 hover:text-white transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('surahs')}
              </a>
              
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-white">{t('mushafType')}</span>
                <div className="flex gap-2">
                  <Button
                    variant={mushafType === 'mwdoa' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setMushafType('mwdoa')}
                    className={cn("flex-1", mushafType === 'mwdoa' ? 'bg-white text-emerald-800' : 'text-white hover:bg-white/20')}
                  >
                    {t('mushafMwdoa')}
                  </Button>
                  <Button
                    variant={mushafType === 'tashel' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setMushafType('tashel')}
                    className={cn("flex-1", mushafType === 'tashel' ? 'bg-white text-emerald-800' : 'text-white hover:bg-white/20')}
                  >
                    {t('mushafTashel')}
                  </Button>
                  <Button
                    variant={mushafType === 'madinah' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setMushafType('madinah')}
                    className={cn("flex-1", mushafType === 'madinah' ? 'bg-white text-emerald-800' : 'text-white hover:bg-white/20')}
                  >
                    {t('mushafMadinah')}
                  </Button>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  toggleLanguage();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 w-fit text-white hover:bg-white/20 border border-white/30"
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
