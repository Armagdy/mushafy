import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { preloadQuranData } from "./lib/quran-data-service";

// Preload static Quran data early for better performance
preloadQuranData().catch(err => {
  console.error('Failed to preload Quran data:', err);
});

createRoot(document.getElementById("root")!).render(<App />);
