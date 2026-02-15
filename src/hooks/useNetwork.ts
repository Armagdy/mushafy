import { useState, useEffect } from 'react';

/**
 * Hook to detect network connectivity status
 * Returns online status and provides a check function for pre-download validation
 */
export const useNetwork = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      console.log('✅ Network: Online');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('❌ Network: Offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
};

/**
 * Utility function to check network status before downloads
 * Throws an error if offline
 */
export const checkNetworkBeforeDownload = () => {
  if (!navigator.onLine) {
    throw new Error('NETWORK_OFFLINE');
  }
};

/**
 * Check if error is network-related
 */
export const isNetworkError = (error: any): boolean => {
  if (!error) return false;
  
  const message = error.message || error.toString();
  return (
    message === 'NETWORK_OFFLINE' ||
    message.includes('NetworkError') ||
    message.includes('Failed to fetch') ||
    error.name === 'TypeError' && message.includes('fetch')
  );
};
