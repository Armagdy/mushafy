import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { cn } from "@/lib/utils";

interface FullPageLayoutProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  showBottomPadding?: boolean;
}

/**
 * Shared layout for full-page views that were previously dialogs.
 * Provides consistent header with back button and styling.
 */
export function FullPageLayout({ 
  title, 
  children, 
  className,
  showBottomPadding = true 
}: FullPageLayoutProps) {
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  
  return (
    <div 
      className={cn("min-h-screen bg-[#FBF9F4] flex flex-col", className)} 
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Top App Bar - Android-style: plain back icon + start-aligned title.
          Phone: full-width gradient band (unchanged). Desktop: a centered
          floating panel, same treatment as the reader's TopBar — the page
          background shows on either side and the title stays near the
          content column. */}
      <motion.div 
        className="sticky top-0 z-50 md:px-3"
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div
          className="bg-gradient-to-b from-emerald-800 to-emerald-600 px-2 pb-3 flex items-center gap-1 max-w-4xl w-full mx-auto md:rounded-b-2xl md:shadow-lg"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center w-12 h-12 rounded-full shrink-0 transition-colors active:bg-emerald-950/30"
            aria-label="Go back"
          >
            {isRTL ? (
              <ChevronRight className="w-7 h-7 text-[#F2E3BB]" />
            ) : (
              <ChevronLeft className="w-7 h-7 text-[#F2E3BB]" />
            )}
          </button>
          <h1 className={cn("flex-1 font-bold text-[#F2E3BB] truncate", textSizeClasses.title)}>
            {title}
          </h1>
        </div>
      </motion.div>
      
      {/* Main Content Area — capped to the same desktop column width
          (md:px-3 keeps it aligned with the header panel between
          768-896px viewports). */}
      <div className={cn(
        "flex-1 overflow-y-auto md:px-3",
        showBottomPadding && "pb-20"
      )}>
        <div className="max-w-4xl w-full mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
