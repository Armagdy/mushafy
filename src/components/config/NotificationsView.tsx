import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  Bell, BellOff, BookOpen, BookOpenCheck, Headphones, Pencil, Plus, Sparkles, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { cn } from "@/lib/utils";
import {
  UserCustomNotification,
  UserNotificationKind,
  UserNotificationSettings,
  allocateCustomSlot,
  createCustomId,
  loadUserNotificationSettings,
  saveUserNotificationSettings,
  syncUserNotifications,
} from "@/lib/user-notifications";
import type { TranslationKey } from "@/i18n/translations";

/**
 * Notifications settings (تنبيهات) — daily reminder times for reading,
 * listening, revision and dhikr, plus fully custom reminders with a
 * user-defined name, message and time.
 * Rendered by SettingsView for /config/settings?category=notifications
 */

const KIND_META: { kind: UserNotificationKind; icon: typeof BookOpen; labelKey: TranslationKey }[] = [
  { kind: 'reading', icon: BookOpen, labelKey: 'notificationsReading' },
  { kind: 'listening', icon: Headphones, labelKey: 'notificationsListening' },
  { kind: 'revise', icon: BookOpenCheck, labelKey: 'notificationsRevise' },
  { kind: 'zekr', icon: Sparkles, labelKey: 'notificationsZekr' },
];

const DEFAULT_CUSTOM_TIME = '09:00';

interface CustomFormState {
  /** editing an existing reminder by id, null = adding a new one */
  editId: string | null;
  name: string;
  text: string;
  time: string;
}

export default function NotificationsView() {
  const { t } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  const [settings, setSettings] = useState<UserNotificationSettings>(() => loadUserNotificationSettings());
  const [form, setForm] = useState<CustomFormState | null>(null);

  const persist = (next: UserNotificationSettings) => {
    setSettings(next);
    saveUserNotificationSettings(next);
  };

  /** Ask web permission from a user gesture; returns false when denied. */
  const ensureWebPermission = async (): Promise<boolean> => {
    if (Capacitor.isNativePlatform() || typeof Notification === 'undefined') return true;
    if (Notification.permission === 'default') {
      return (await Notification.requestPermission()) === 'granted';
    }
    return Notification.permission === 'granted';
  };

  const handleToggle = async (kind: UserNotificationKind) => {
    const next: UserNotificationSettings = {
      ...settings,
      [kind]: { ...settings[kind], enabled: !settings[kind].enabled },
    };

    if (next[kind].enabled && !(await ensureWebPermission())) {
      toast.error(t('notificationsPermissionDenied'));
      return;
    }

    persist(next);
    const result = await syncUserNotifications(true);
    if (result === 'denied') toast.error(t('notificationsPermissionDenied'));
  };

  const handleTimeChange = (kind: UserNotificationKind, value: string) => {
    if (!value) return;
    persist({
      ...settings,
      [kind]: { ...settings[kind], time: value },
    });
    syncUserNotifications(false).catch(() => {});
  };

  // -------------------------------------------------------- custom reminders

  const handleCustomToggle = async (custom: UserCustomNotification) => {
    const next: UserNotificationSettings = {
      ...settings,
      customs: settings.customs.map(c =>
        c.id === custom.id ? { ...c, enabled: !c.enabled } : c),
    };

    const turningOn = !custom.enabled;
    if (turningOn && !(await ensureWebPermission())) {
      toast.error(t('notificationsPermissionDenied'));
      return;
    }

    persist(next);
    const result = await syncUserNotifications(true);
    if (result === 'denied') toast.error(t('notificationsPermissionDenied'));
  };

  const handleCustomTimeChange = (custom: UserCustomNotification, value: string) => {
    if (!value) return;
    persist({
      ...settings,
      customs: settings.customs.map(c =>
        c.id === custom.id ? { ...c, time: value } : c),
    });
    syncUserNotifications(false).catch(() => {});
  };

  const handleDeleteCustom = (custom: UserCustomNotification) => {
    persist({
      ...settings,
      customs: settings.customs.filter(c => c.id !== custom.id),
    });
    syncUserNotifications(false).catch(() => {});
    toast.success(t('notificationsCustomDeleted'));
  };

  const openAddForm = () => {
    setForm({ editId: null, name: '', text: '', time: DEFAULT_CUSTOM_TIME });
  };

  const openEditForm = (custom: UserCustomNotification) => {
    setForm({ editId: custom.id, name: custom.name, text: custom.text, time: custom.time });
  };

  const submitForm = async () => {
    if (!form) return;
    const name = form.name.trim();
    const text = form.text.trim();
    if (!name) {
      toast.error(t('notificationsCustomNameRequired'));
      return;
    }
    if (!text) {
      toast.error(t('notificationsCustomTextRequired'));
      return;
    }

    if (form.editId === null) {
      // add a new custom reminder (enabled right away)
      const slot = allocateCustomSlot(settings);
      if (slot === null) {
        toast.error(t('notificationsCustomSlotsFull'));
        return;
      }
      if (!(await ensureWebPermission())) {
        toast.error(t('notificationsPermissionDenied'));
        return;
      }
      persist({
        ...settings,
        customs: [
          ...settings.customs,
          { id: createCustomId(), idNum: slot, name, text, time: form.time, enabled: true },
        ],
      });
      const result = await syncUserNotifications(true);
      if (result === 'denied') toast.error(t('notificationsPermissionDenied'));
      toast.success(t('notificationsCustomAdded'));
    } else {
      persist({
        ...settings,
        customs: settings.customs.map(c =>
          c.id === form.editId ? { ...c, name, text, time: form.time } : c),
      });
      syncUserNotifications(false).catch(() => {});
      toast.success(t('notificationsCustomUpdated'));
    }
    setForm(null);
  };

  const inputClass = cn(
    "w-full min-h-[44px] px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700",
    "bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100",
    textSizeClasses.button
  );

  const rowClass = cn(
    "flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl border shadow-sm",
    "bg-white dark:bg-emerald-950 border-emerald-100 dark:border-emerald-900"
  );

  const timeInputClass = cn(
    "min-h-[40px] px-2 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700",
    "bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100",
    textSizeClasses.button
  );

  return (
    <div className="space-y-3 pb-12">
      <p className={cn("text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
        {t('notificationsHint')}
      </p>

      {KIND_META.map(({ kind, icon: Icon, labelKey }) => {
        const item = settings[kind];

        return (
          <div key={kind} className={rowClass}>
            <button
              onClick={() => handleToggle(kind)}
              className={cn(
                "flex items-center gap-2 min-h-[44px] font-medium active:scale-[0.97] transition-all",
                textSizeClasses.button,
                item.enabled
                  ? "text-emerald-800 dark:text-emerald-200"
                  : "text-emerald-500 dark:text-emerald-500"
              )}
            >
              {item.enabled
                ? <Bell className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                : <BellOff className="w-5 h-5 shrink-0" />}
              <Icon className="w-5 h-5 shrink-0" />
              {t(labelKey)}
            </button>

            <label className={cn("flex flex-col items-center gap-0.5 shrink-0", !item.enabled && "opacity-50")}>
              <input
                type="time"
                value={item.time}
                onChange={e => handleTimeChange(kind, e.target.value)}
                disabled={!item.enabled}
                aria-label={t(labelKey)}
                className={timeInputClass}
              />
            </label>
          </div>
        );
      })}

      {/* ------------------------------------------------ custom reminders */}
      <div className="pt-4 border-t border-emerald-100 dark:border-emerald-900">
        <button
          onClick={openAddForm}
          disabled={form !== null}
          className={cn(
            "w-full flex items-center justify-center gap-1 min-h-[44px] px-3 rounded-lg font-medium active:scale-[0.97] transition-all",
            "bg-emerald-700 text-[#F2E3BB] shadow-md disabled:opacity-50",
            textSizeClasses.button
          )}
        >
          <Plus className="w-5 h-5 shrink-0" />
          {t('notificationsAddCustom')}
        </button>

        {/* add/edit form */}
        {form !== null && (
          <div className={cn(
            "space-y-3 p-3 mb-3 rounded-2xl border shadow-sm",
            "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800"
          )}>
            <div className="flex items-center justify-between">
              <span className={cn("font-medium text-emerald-800 dark:text-emerald-200", textSizeClasses.label)}>
                {form.editId === null ? t('notificationsAddCustom') : t('notificationsEditCustom')}
              </span>
              <button
                onClick={() => setForm(null)}
                aria-label={t('cancel')}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-emerald-600 dark:text-emerald-400 active:scale-[0.97] transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <label className="flex flex-col gap-1">
              <span className={cn("text-xs text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
                {t('notificationsName')}
              </span>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => f && { ...f, name: e.target.value })}
                placeholder={t('notificationsNamePlaceholder')}
                maxLength={60}
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className={cn("text-xs text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
                {t('notificationsText')}
              </span>
              <textarea
                value={form.text}
                onChange={e => setForm(f => f && { ...f, text: e.target.value })}
                placeholder={t('notificationsTextPlaceholder')}
                rows={2}
                maxLength={200}
                className={cn(inputClass, "resize-none min-h-[60px]")}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className={cn("text-xs text-emerald-600 dark:text-emerald-400", textSizeClasses.text)}>
                {t('notificationsTime')}
              </span>
              <input
                type="time"
                value={form.time}
                onChange={e => setForm(f => f && { ...f, time: e.target.value || DEFAULT_CUSTOM_TIME })}
                className={timeInputClass}
              />
            </label>

            <div className="flex gap-2">
              <button
                onClick={submitForm}
                className={cn(
                  "flex-1 min-h-[44px] rounded-lg bg-emerald-700 hover:bg-emerald-600 text-[#F2E3BB] font-semibold shadow-md active:scale-[0.97] transition-all",
                  textSizeClasses.button
                )}
              >
                {t('save')}
              </button>
              <button
                onClick={() => setForm(null)}
                className={cn(
                  "min-h-[44px] px-4 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-medium active:scale-[0.97] transition-all",
                  textSizeClasses.button
                )}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        {/* existing custom reminders */}
        {settings.customs.map(custom => (
          <div key={custom.id} className={cn(rowClass, "mb-2")}>
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <button
                onClick={() => handleCustomToggle(custom)}
                aria-label={t('notificationsToggleCustom')}
                className={cn(
                  "p-2 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 active:scale-[0.97] transition-all",
                  custom.enabled
                    ? "text-emerald-800 dark:text-emerald-200"
                    : "text-emerald-500 dark:text-emerald-500"
                )}
              >
                {custom.enabled
                  ? <Bell className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  : <BellOff className="w-5 h-5" />}
              </button>
              <button
                onClick={() => openEditForm(custom)}
                className="flex flex-col items-start min-w-0 flex-1 py-1 text-start active:scale-[0.97] transition-all"
              >
                <span className={cn(
                  "font-medium truncate",
                  custom.enabled
                    ? "text-emerald-800 dark:text-emerald-200"
                    : "text-emerald-500 dark:text-emerald-500",
                  textSizeClasses.button
                )}>
                  {custom.name}
                </span>
                <span className={cn("text-xs text-emerald-600 dark:text-emerald-400 truncate", textSizeClasses.text)}>
                  {custom.text}
                </span>
              </button>
              <button
                onClick={() => openEditForm(custom)}
                aria-label={t('notificationsEditCustom')}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400 active:scale-[0.97] transition-all"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteCustom(custom)}
                aria-label={t('delete')}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 text-red-500 dark:text-red-400 active:scale-[0.97] transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <label className={cn("flex flex-col items-center gap-0.5 shrink-0", !custom.enabled && "opacity-50")}>
              <input
                type="time"
                value={custom.time}
                onChange={e => handleCustomTimeChange(custom, e.target.value)}
                disabled={!custom.enabled}
                aria-label={custom.name}
                className={timeInputClass}
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
