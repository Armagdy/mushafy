import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { preloadQuranData } from "./lib/quran-data-service";

// Preload static Quran data early for better performance
preloadQuranData().catch(err => {
  console.error('Failed to preload Quran data:', err);
});

// Helper function to pre-cache critical assets after SW is active
async function preCacheAppShell(registration: ServiceWorkerRegistration) {
  // Wait for the service worker to be active
  const sw = registration.active || registration.waiting || registration.installing;
  if (!sw) return;
  
  try {
    // Open the app shell cache and add the current page's assets
    const cache = await caches.open('mushafy-shell-v1');
    
    // Get all script and style tags from the current page
    const scripts = Array.from(document.querySelectorAll('script[src]'))
      .map((el) => (el as HTMLScriptElement).src)
      .filter((src) => src.includes(window.location.origin));
    
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((el) => (el as HTMLLinkElement).href)
      .filter((href) => href.includes(window.location.origin));
    
    // Add all assets to cache
    const allAssets = [...scripts, ...styles];
    await Promise.all(allAssets.map(async (url) => {
      try {
        const cached = await cache.match(url);
        if (!cached) {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
          }
        }
      } catch (e) {
        console.warn('Failed to cache asset:', url, e);
      }
    }));
    
    console.log('App shell cached for offline use');
  } catch (error) {
    console.warn('Failed to pre-cache app shell:', error);
  }
}

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Use base URL for correct path in both dev and production
    const swPath = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swPath)
      .then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope);
        
        // Pre-cache app shell assets after registration
        if (registration.active) {
          preCacheAppShell(registration);
        } else {
          // Wait for service worker to activate
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  preCacheAppShell(registration);
                }
              });
            }
          });
        }
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
