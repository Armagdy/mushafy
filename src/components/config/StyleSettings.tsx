import React, { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Book, Menu, Moon, Palette, PenLine, Type, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses, type DialogTextSize } from "@/contexts/DialogTextSizeContext";
import { useDarkMode } from "@/contexts/DarkModeContext";
import { useAnnotationsVisible } from "@/hooks/useAnnotations";
import { cn } from "@/lib/utils";

interface StyleSettingsProps {
  isMobile: boolean;
  viewMode: 'single' | 'double';
  onViewModeChange: (mode: 'single' | 'double') => void;
  showBottomBarText: boolean;
  onShowBottomBarTextChange: (show: boolean) => void;
}

/** Full-width tappable settings row: icon + label + trailing Switch. Tapping anywhere on the row toggles. */
export function SettingsToggleRow({
  icon: Icon,
  label,
  checked,
  onCheckedChange,
}: {
  icon: LucideIcon;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);

  return (
    <div
      onClick={() => onCheckedChange(!checked)}
      className="w-full flex items-center justify-between gap-3 min-h-[56px] px-3 py-2 rounded-xl transition-colors active:bg-emerald-100 dark:active:bg-emerald-900/40 cursor-pointer"
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className={cn("font-medium text-emerald-800 dark:text-emerald-300 text-start", textSizeClasses.label)}>
          {label}
        </span>
      </div>
      {/* Stop propagation so tapping the switch itself doesn't double-toggle via the row */}
      <div dir="ltr" onClick={(e) => e.stopPropagation()} className="shrink-0">
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );
}

/** Settings row: icon + label + trailing segmented pill control (44px+ targets). */
export function SettingsSegmentRow({
  icon: Icon,
  label,
  options,
  value,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);

  return (
    <div className="w-full flex items-center justify-between gap-3 min-h-[56px] px-3 py-2 rounded-xl">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className={cn("font-medium text-emerald-800 dark:text-emerald-300 text-start", textSizeClasses.label)}>
          {label}
        </span>
      </div>
      <div className="flex gap-2 shrink-0">
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              aria-pressed={isActive}
              className={cn(
                "flex items-center justify-center min-h-[44px] rounded-lg border px-3 py-1.5 font-medium transition-all active:scale-[0.97]",
                isActive
                  ? "bg-emerald-700 text-[#F2E3BB] border-emerald-600 shadow-md"
                  : "bg-white dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900",
                textSizeClasses.button
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StyleSettings({
  isMobile,
  viewMode,
  onViewModeChange,
  showBottomBarText,
  onShowBottomBarTextChange,
}: StyleSettingsProps) {
  const { t } = useLanguage();
  const { dialogTextSize, setDialogTextSize } = useDialogTextSize();
  const { isDarkMode, setIsDarkMode } = useDarkMode();
  const { annotationsVisible, setAnnotationsVisible } = useAnnotationsVisible();

  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);

  // Header/footer chrome theme: 'green' (classic) | 'glass' (frosted translucent)
  const [chromeTheme, setChromeTheme] = useState<'green' | 'glass'>(() => {
    const saved = localStorage.getItem('quran-chrome-theme');
    return saved === 'glass' ? 'glass' : 'green';
  });

  const updateChromeTheme = (theme: 'green' | 'glass') => {
    setChromeTheme(theme);
    localStorage.setItem('quran-chrome-theme', theme);
    window.dispatchEvent(new CustomEvent('quran-setting-changed', {
      detail: { key: 'quran-chrome-theme', value: theme }
    }));
  };

  return (
    <div className="flex flex-col gap-1">
      {/* View Mode (desktop only — mobile is always single page) */}
      {!isMobile && (
        <SettingsSegmentRow
          icon={Book}
          label={t('viewMode')}
          value={viewMode}
          onChange={(value) => onViewModeChange(value as 'single' | 'double')}
          options={[
            { value: 'single', label: t('singlePage') },
            { value: 'double', label: t('doublePage') },
          ]}
        />
      )}

      {/* Bottom Bar Text Toggle */}
      <SettingsToggleRow
        icon={Menu}
        label={t('showBottomBarText')}
        checked={showBottomBarText}
        onCheckedChange={onShowBottomBarTextChange}
      />

      {/* Header/Footer Theme */}
      <SettingsSegmentRow
        icon={Palette}
        label={t('barTheme')}
        value={chromeTheme}
        onChange={(value) => updateChromeTheme(value as 'green' | 'glass')}
        options={[
          { value: 'green', label: t('greenTheme') },
          { value: 'glass', label: t('glassTheme') },
        ]}
      />

      {/* Dark Mode Toggle */}
      <SettingsToggleRow
        icon={Moon}
        label={t('darkMode')}
        checked={isDarkMode}
        onCheckedChange={setIsDarkMode}
      />

      {/* Show/hide page drawings (annotations) while reading */}
      <SettingsToggleRow
        icon={PenLine}
        label={t('showAnnotations')}
        checked={annotationsVisible}
        onCheckedChange={setAnnotationsVisible}
      />

      {/* Dialog text size */}
      <div className="flex flex-col gap-2 px-3 pt-3 pb-1">
        <div className="flex items-center gap-2 sm:gap-3">
          <Type className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className={cn("font-medium text-emerald-800 dark:text-emerald-300", textSizeClasses.label)}>
            {t('dialogTextSize')}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['small', 'medium', 'large'] as DialogTextSize[]).map((size) => {
            const isActive = dialogTextSize === size;
            const label =
              size === 'small' ? t('textSizeSmall') :
              size === 'medium' ? t('textSizeMedium') :
              t('textSizeLarge');
            return (
              <button
                key={size}
                onClick={() => setDialogTextSize(size)}
                aria-pressed={isActive}
                className={cn(
                  "flex items-center justify-center px-3 min-h-[44px] rounded-lg border transition-all font-medium active:scale-[0.97]",
                  textSizeClasses.button,
                  isActive
                    ? "bg-emerald-700 text-[#F2E3BB] border-emerald-600 shadow-md"
                    : "bg-white dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
