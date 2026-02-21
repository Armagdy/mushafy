import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { MushafProvider } from "@/contexts/MushafContext";
import { DialogTextSizeProvider } from "@/contexts/DialogTextSizeContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAppKeepAwake } from "@/hooks/useAppKeepAwake";
import Index from "./pages/Index";
import Surah from "./pages/Surah";
import Test from "./pages/Test";
import Configuration from "./pages/Configuration";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Inner component that uses the theme color hook
function AppContent() {
  // Dynamically update PWA theme color to match system dark/light mode
  useThemeColor();
  useAppKeepAwake();

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Surah />} />
          <Route path="/page/:page" element={<Surah />} />
          <Route path="/surah/:id" element={<Surah />} />
          <Route path="/surah/:id/:page" element={<Surah />} />
          <Route path="/config/:type" element={<Configuration />} />
          {/* Legacy routes - redirect to config */}
          <Route path="/settings" element={<Configuration />} />
          <Route path="/bookmarks" element={<Configuration />} />
          <Route path="/test" element={<Test />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <MushafProvider>
        <DialogTextSizeProvider>
          <AppContent />
        </DialogTextSizeProvider>
      </MushafProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
