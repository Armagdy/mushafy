import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { preloadQuranData } from "./lib/quran-data-service";

// Preload static Quran data early for better performance
preloadQuranData().catch(err => {
  console.error('Failed to preload Quran data:', err);
});

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
