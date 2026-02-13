import { useEffect } from 'react';

/**
 * Hook to dynamically update the PWA theme color based on system preference.
 * This makes the Android status bar seamlessly match the app's TopBar.
 * 
 * Colors:
 * - Light mode: #ffffff (white - matches TopBar bg-white)
 * - Dark mode: #111827 (gray-900 - matches TopBar dark:bg-gray-900)
 */
export function useThemeColor() {
  useEffect(() => {
    const updateThemeColor = () => {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const themeColor = isDark ? '#111827' : '#ffffff';
      
      // Update the default theme-color meta tag (fallback)
      const metaTheme = document.querySelector('meta[name="theme-color"]:not([media])');
      if (metaTheme) {
        metaTheme.setAttribute('content', themeColor);
      }
    };

    // Initial update
    updateThemeColor();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateThemeColor);

    return () => {
      mediaQuery.removeEventListener('change', updateThemeColor);
    };
  }, []);
}

/**
 * Utility function to manually set theme color.
 * Useful for dynamic theme changes within the app.
 */
export function setThemeColor(color: string) {
  const metaTags = document.querySelectorAll('meta[name="theme-color"]');
  metaTags.forEach((meta) => {
    meta.setAttribute('content', color);
  });
}
