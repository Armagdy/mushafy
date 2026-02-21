import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Repeat View - Placeholder
 * TODO: Extract repeat settings logic from RepeatDialog.tsx
 */
export default function RepeatView() {
  const { t } = useLanguage();
  
  return (
    <div className="p-4">
      <div className="text-emerald-700 font-medium">
        {t('repeat')}
      </div>
      <p className="text-emerald-600 mt-2">
        Content coming soon...
      </p>
    </div>
  );
}
