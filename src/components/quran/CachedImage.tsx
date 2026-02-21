import { useState, useEffect, useRef, ImgHTMLAttributes } from 'react';
import { getCachedAsset, getCachedAssetUri, cacheAsset, removeCachedAsset } from '@/lib/asset-cache';
import { isNativePlatform } from '@/lib/native-storage';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from '@/contexts/LanguageContext';

interface CachedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Category for caching (e.g., 'mushaf-mwdoa', 'mushaf-tashel', 'mushaf-madinah') */
  cacheCategory?: string;
  /** Whether to automatically cache when loaded from network */
  autoCache?: boolean;
}

/**
 * Image component that checks cache first before loading from network.
 * Falls back to original src if not cached and online.
 * Shows error state if not cached and offline.
 */
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export function CachedImage({ src, alt, cacheCategory, autoCache = true, ...props }: CachedImageProps) {
  const { t, isRTL } = useLanguage();
  const filename = src.split('/').pop() || 'unknown';
  console.log(`[CachedImage] 🎨 Component function called for: ${filename}`);
  
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [retryKey, setRetryKey] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);
  const blobUrlRef = useRef<string | null>(null);
  const prevSrcRef = useRef<string | null>(null);
  const prevRetryKeyRef = useRef<number>(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Skip if same src and not a retry
    if (prevSrcRef.current === src && prevRetryKeyRef.current === retryKey) return;
    prevSrcRef.current = src;
    prevRetryKeyRef.current = retryKey;

    const filename = src.split('/').pop() || 'unknown';
    console.log(`[CachedImage] 🆕 Component mounted for: ${filename}`);

    // Reset states
    setIsLoading(true);
    setLoadError(false);
    setImageSrc(null);
    // Reset retry count when src changes (but not on manual retry)
    if (prevSrcRef.current !== src) {
      setRetryCount(0);
    }

    // Cleanup previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    // Clear any pending retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    let cancelled = false;

    const loadImage = async () => {
      try {
        console.log(`[CachedImage] Loading image: ${src}`);
        console.log(`[CachedImage] navigator.onLine: ${navigator.onLine}`);
        
        // ALWAYS check cache first (regardless of online status)
        console.log(`[CachedImage] 🔍 Checking cache for: ${src.split('/').pop()}`);
        
        // On native platforms, try to get file URI first (much faster than loading blob)
        if (isNativePlatform()) {
          const fileUri = await getCachedAssetUri(src);
          if (cancelled) return;
          
          if (fileUri) {
            // Convert native file:// URI to WebView-compatible URI
            const webViewUri = Capacitor.convertFileSrc(fileUri);
            console.log(`[CachedImage] ✅ Found cached file URI, attempting to use: ${src.split('/').pop()}`);
            setImageSrc(webViewUri);
            setIsLoading(false);
            // NOTE: Don't return here - if the file URI fails to load, handleImageError will retry from network
            return;
          }
        } else {
          // On web, load blob and create object URL
          const cachedBlob = await getCachedAsset(src);
          if (cancelled) return;
          
          if (cachedBlob) {
            // Found in cache - create blob URL and use it
            console.log(`[CachedImage] ✅ Using cached blob for: ${src}`);
            const blobUrl = URL.createObjectURL(cachedBlob);
            blobUrlRef.current = blobUrl;
            setImageSrc(blobUrl);
            setIsLoading(false);
            return; // Blob URLs are reliable, safe to return
          }
        }
        
        // Not in cache - check if online
        console.log(`[CachedImage] ❌ Not in cache: ${src}`);
        
        if (!navigator.onLine) {
          // Offline and not cached - show error
          console.error(`[CachedImage] 🔴 OFFLINE and not cached: ${src}`);
          setLoadError(true);
          setIsLoading(false);
          return;
        }
        
        // Online - try to load from network
        console.log(`[CachedImage] 🌐 Loading from network: ${src}`);
        setImageSrc(src);
        setIsLoading(false);
        // Note: Auto-caching now happens in handleImageLoad after successful load
      } catch (error) {
        console.error('[CachedImage] ❌ Error loading image:', error);
        if (!cancelled) {
          setLoadError(true);
          setIsLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;
      // Clear any pending retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [src, autoCache, cacheCategory, retryKey]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Listen for online/offline events to retry failed loads
  useEffect(() => {
    const handleOnline = () => {
      console.log('[CachedImage] 🌐 Network came back online');
      if (loadError) {
        console.log('[CachedImage] 🔄 Retrying failed image load...');
        // Reset retry count and increment retryKey to trigger reload
        setRetryCount(0);
        setRetryKey(prev => prev + 1);
      }
    };

    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [loadError]);

  // Handle image load error
  const handleImageError = async (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error(`[CachedImage] ❌ Image failed to load`);
    console.error(`[CachedImage] src: ${imageSrc}`);
    console.error(`[CachedImage] original src: ${src}`);
    console.error(`[CachedImage] navigator.onLine: ${navigator.onLine}`);
    console.error(`[CachedImage] retryCount: ${retryCount}`);
    console.error(`[CachedImage] Error event:`, e);
    
    // Check if this is a failed cached file URI (native platform)
    const isFailedCachedUri = isNativePlatform() && 
                               imageSrc?.includes('_capacitor_file_');
    
    if (isFailedCachedUri) {
      console.warn(`[CachedImage] ⚠️ Cached file URI failed to load, removing from cache and retrying from network`);
      
      // Remove the corrupted/missing cached file
      try {
        await removeCachedAsset(src);
        console.log(`[CachedImage] 🗑️ Removed bad cache entry`);
      } catch (error) {
        console.error(`[CachedImage] Failed to remove bad cache:`, error);
      }
      
      // If online, try loading from network
      if (navigator.onLine) {
        console.log(`[CachedImage] 🌐 Retrying from network after cache failure`);
        setImageSrc(src);
        setIsLoading(false);
        setRetryCount(0); // Reset retry count for network load
        return;
      } else {
        // Offline and cached file is bad - show error
        console.error(`[CachedImage] 🔴 Cached file failed and offline`);
        setLoadError(true);
        setIsLoading(false);
        return;
      }
    }
    
    // If offline and not cached, show error immediately
    if (!navigator.onLine) {
      console.log(`[CachedImage] 🔴 Offline - cannot load image`);
      setLoadError(true);
      setIsLoading(false);
      return;
    }
    
    // If online but failed to load from network, retry with exponential backoff
    if (retryCount < MAX_RETRIES) {
      const nextRetryCount = retryCount + 1;
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount); // Exponential backoff
      
      console.log(`[CachedImage] 🔄 Retry ${nextRetryCount}/${MAX_RETRIES} in ${delay}ms...`);
      
      setRetryCount(nextRetryCount);
      setIsLoading(true);
      
      // Schedule retry after delay
      retryTimeoutRef.current = setTimeout(() => {
        console.log(`[CachedImage] 🔄 Executing retry ${nextRetryCount}...`);
        // Force reload by incrementing retryKey
        setRetryKey(prev => prev + 1);
      }, delay);
    } else {
      // Exhausted all retries
      console.error(`[CachedImage] 🔴 Failed after ${MAX_RETRIES} retries`);
      setLoadError(true);
      setIsLoading(false);
    }
  };

  // Handle image load success
  const handleImageLoad = async () => {
    const isFromCache = imageSrc?.startsWith('blob:') || 
                        (isNativePlatform() && imageSrc?.includes('_capacitor_file_'));
    
    console.log(`[CachedImage] ✅ Image loaded successfully from: ${isFromCache ? 'CACHE' : 'NETWORK'}`);
    setLoadError(false);
    setIsLoading(false);
    setRetryCount(0); // Reset retry count on success
    
    // If loaded from network and autoCache is enabled, cache it now
    if (!isFromCache && autoCache && cacheCategory && imageSrc === src) {
      console.log(`[CachedImage] 📦 Caching image after successful network load: ${src}`);
      try {
        const success = await cacheAsset(src, cacheCategory);
        if (success) {
          console.log(`[CachedImage] ✅ Successfully cached: ${src}`);
        } else {
          console.warn(`[CachedImage] ⚠️ Failed to cache: ${src}`);
        }
      } catch (error) {
        console.error(`[CachedImage] ❌ Error caching image:`, error);
      }
    }
  };

  // Show error state if offline and not cached
  if (loadError) {
    const filename = src.split('/').pop() || 'image';
    return (
      <div 
        className={props.className}
        style={{ 
          backgroundColor: '#f3f4f6',
          minHeight: '200px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          textAlign: 'center'
        }}
      >
        <svg 
          className="w-12 h-12 text-gray-400 mb-2" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
        </svg>
        <span className={`text-gray-500 text-sm md:text-base font-semibold mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
          {navigator.onLine ? t('failedToLoadImage') : t('offlinePageNotCached')}
        </span>
      </div>
    );
  }

  // Show loading state (including during retries)
  if (isLoading || !imageSrc) {
    return (
      <div 
        className={props.className}
        style={{ 
          backgroundColor: '#e5e7eb',
          minHeight: '200px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem'
        }}
      >
        <span className="text-gray-400 text-sm md:text-base">{t('loading')}</span>
        {retryCount > 0 && (
          <span className="text-gray-500 text-xs md:text-sm">
            {isRTL ? `محاولة ${retryCount}/${MAX_RETRIES}` : `Retry ${retryCount}/${MAX_RETRIES}`}
          </span>
        )}
      </div>
    );
  }

  return (
    <img 
      ref={imgRef}
      src={imageSrc} 
      alt={alt} 
      onError={handleImageError}
      onLoad={handleImageLoad}
      {...props} 
    />
  );
}
