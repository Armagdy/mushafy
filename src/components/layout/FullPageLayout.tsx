import React from "react";
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
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
    >
      {/* Top Bar with title and back button */}
      <div 
        className="bg-gradient-to-b from-emerald-800 to-emerald-600 px-4 pb-3 flex items-center gap-3 sticky top-0 z-50"
        style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center w-9 h-9 bg-emerald-800/50 hover:bg-emerald-800/70 rounded-lg border border-[#F2E3BB]/30 shadow-md transition-all"
          aria-label="Go back"
        >
          {isRTL ? (
            <ChevronRight className="w-6 h-6 text-[#F2E3BB]" />
          ) : (
            <ChevronLeft className="w-6 h-6 text-[#F2E3BB]" />
          )}
        </button>
        <h1 className={cn("flex-1 text-center font-bold text-[#F2E3BB]", textSizeClasses.title)}>
          {title}
        </h1>
        {/* Placeholder for symmetry */}
        <div className="w-9" />
      </div>
      
      {/* Main Content Area */}
      <div className={cn(
        "flex-1 overflow-y-auto",
        showBottomPadding && "pb-20"
      )}>
        {children}
      </div>
    </div>
  );
}
