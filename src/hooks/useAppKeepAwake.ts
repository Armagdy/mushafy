import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';

export const useAppKeepAwake = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const enableKeepAwake = async () => {
      try {
        await KeepAwake.keepAwake();
        console.log('Native keep-awake enabled for app session');
      } catch (error) {
        console.warn('Failed to enable native keep-awake:', error);
      }
    };

    enableKeepAwake();

    return () => {
      KeepAwake.allowSleep().catch(error => {
        console.warn('Failed to release native keep-awake:', error);
      });
    };
  }, []);
};
