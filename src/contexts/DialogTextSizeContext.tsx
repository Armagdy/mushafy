/**
 * DialogTextSizeContext - Global dialog text size management
 * 
 * This context provides a centralized way to control text sizes across all dialogs in the app.
 * 
 * Usage in dialog components:
 * 
 * 1. Import the hook and helper:
 *    import { useDialogTextSize, getDialogTextSizeClasses } from '@/contexts/DialogTextSizeContext';
 * 
 * 2. Get the text size classes:
 *    const { dialogTextSize } = useDialogTextSize();
 *    const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
 * 
 * 3. Apply to dialog elements:
 *    - Dialog title: className={cn("...", textSizeClasses.title)}
 *    - Labels: className={cn("...", textSizeClasses.label)}
 *    - Regular text: className={cn("...", textSizeClasses.text)}
 *    - Buttons: className={cn("...", textSizeClasses.button)}
 * 
 * Example:
 *    <DialogTitle className={cn("text-center font-bold", textSizeClasses.title)}>
 *      {t('settings')}
 *    </DialogTitle>
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

export type DialogTextSize = 'small' | 'medium' | 'large';

interface DialogTextSizeContextType {
  dialogTextSize: DialogTextSize;
  setDialogTextSize: (size: DialogTextSize) => void;
}

const DialogTextSizeContext = createContext<DialogTextSizeContextType | undefined>(undefined);

export function DialogTextSizeProvider({ children }: { children: React.ReactNode }) {
  const [dialogTextSize, setDialogTextSizeState] = useState<DialogTextSize>(() => {
    const saved = localStorage.getItem('quran-dialog-text-size');
    return (saved as DialogTextSize) || 'medium';
  });

  useEffect(() => {
    localStorage.setItem('quran-dialog-text-size', dialogTextSize);
  }, [dialogTextSize]);

  const setDialogTextSize = (size: DialogTextSize) => {
    setDialogTextSizeState(size);
  };

  return (
    <DialogTextSizeContext.Provider value={{ dialogTextSize, setDialogTextSize }}>
      {children}
    </DialogTextSizeContext.Provider>
  );
}

export function useDialogTextSize() {
  const context = useContext(DialogTextSizeContext);
  if (context === undefined) {
    throw new Error('useDialogTextSize must be used within a DialogTextSizeProvider');
  }
  return context;
}

// Helper function to get text size classes based on the current size setting
export function getDialogTextSizeClasses(size: DialogTextSize) {
  switch (size) {
    case 'small':
      return {
        text: 'text-sm md:text-base',
        title: 'text-base md:text-lg',
        label: 'text-sm md:text-base',
        button: 'text-sm md:text-base',
      };
    case 'medium':
      return {
        text: 'text-base md:text-xl',
        title: 'text-base md:text-xl',
        label: 'text-base md:text-xl',
        button: 'text-base md:text-xl',
      };
    case 'large':
      return {
        text: 'text-lg md:text-2xl',
        title: 'text-xl md:text-3xl',
        label: 'text-lg md:text-2xl',
        button: 'text-lg md:text-2xl',
      };
  }
}
