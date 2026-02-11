import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { MushafProvider } from "@/contexts/MushafContext";
import Index from "./pages/Index";
import Surah from "./pages/Surah";
import Test from "./pages/Test";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <MushafProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Surah />} />
              <Route path="/page/:page" element={<Surah />} />
              <Route path="/surah/:id" element={<Surah />} />
              <Route path="/surah/:id/:page" element={<Surah />} />
              <Route path="/test" element={<Test />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </MushafProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
