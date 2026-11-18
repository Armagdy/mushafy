/**
 * Chrome theme helpers
 *
 * Shared "liquid glass" card styling for the floating overlay bars
 * (reader fullscreen header/footer quick bar and the annotation editor's
 * header/toolbar), driven by the persisted chrome theme:
 *   'green' — classic emerald tint
 *   'glass' — pale grayish frosted glass
 */

import { cn } from '@/lib/utils';

export type ChromeTheme = 'green' | 'glass';

/** Fullscreen chrome glass card styling, per chrome theme. */
export const getChromeCardClass = (theme: ChromeTheme, isDarkMode: boolean): string =>
  cn(
    'relative isolate rounded-2xl',
    theme === 'glass'
      ? isDarkMode
        ? 'bg-[#9CA3AF]/15 border border-gray-300/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_2px_12px_rgba(0,0,0,0.4)]'
        : 'bg-[#E7E6E2]/30 border border-[#8A8578]/25 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6),0_2px_12px_rgba(87,70,36,0.12)]'
      : isDarkMode
        ? 'bg-emerald-400/10 border border-emerald-200/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_2px_12px_rgba(0,0,0,0.35)]'
        : 'bg-emerald-600/10 border border-emerald-800/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7),0_2px_12px_rgba(6,78,59,0.10)]'
  );

/** Icon/label color used by buttons sitting on a chrome card. */
export const getChromeTextClass = (isDarkMode: boolean): string =>
  isDarkMode
    ? 'text-[#F2E3BB] hover:text-[#FBF9F4]'
    : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300';
