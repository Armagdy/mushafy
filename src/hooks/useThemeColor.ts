import { useEffect } from 'react';

/**
 * Hook to dynamically update the PWA theme color based on system preference.
 * This makes the Android status bar seamlessly match the app's TopBar.
 * 
 * Colors:
 * - Uses emerald-800 (#065f46) to match the TopBar gradient
 */
export function useThemeColor() {
  useEffect(() => {
    const updateThemeColor = () => {
      // Use emerald-800 color to match the app's gradient theme
      const themeColor = '#065f46';
      
      // Update the default theme-color meta tag (fallback)
      const metaTheme = document.querySelector('meta[name="theme-color"]:not([media])');
      if (metaTheme) {
        metaTheme.setAttribute('content', themeColor);
      }
    };

    // Initial update
    updateThemeColor();
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
