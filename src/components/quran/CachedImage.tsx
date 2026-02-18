import { useState, useEffect, useRef, ImgHTMLAttributes } from 'react';
import { getCachedAsset, cacheAsset } from '@/lib/asset-cache';
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
export function CachedImage({ src, alt, cacheCategory, autoCache = true, ...props }: CachedImageProps) {
  const { t, isRTL } = useLanguage();
  const filename = src.split('/').pop() || 'unknown';
  console.log(`[CachedImage] 🎨 Component function called for: ${filename}`);
  
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [retryKey, setRetryKey] = useState<number>(0);
  const blobUrlRef = useRef<string | null>(null);
  const prevSrcRef = useRef<string | null>(null);
  const prevRetryKeyRef = useRef<number>(0);
  const imgRef = useRef<HTMLImageElement | null>(null);

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

    // Cleanup previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    let cancelled = false;

    const loadImage = async () => {
      try {
        console.log(`[CachedImage] Loading image: ${src}`);
        console.log(`[CachedImage] navigator.onLine: ${navigator.onLine}`);
        
        // ALWAYS check cache first (regardless of online status)
        console.log(`[CachedImage] 🔍 Checking cache for: ${src.split('/').pop()}`);
        const cachedBlob = await getCachedAsset(src);
        
        if (cancelled) return;

        if (cachedBlob) {
          // Found in cache - create blob URL and use it
          console.log(`[CachedImage] ✅ Using cached blob for: ${src}`);
          const blobUrl = URL.createObjectURL(cachedBlob);
          blobUrlRef.current = blobUrl;
          setImageSrc(blobUrl);
          setIsLoading(false);
          return; // IMPORTANT: Return here to avoid trying network
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
        
        // Auto-cache the image for offline use if enabled
        if (autoCache && cacheCategory) {
          // Cache in background without blocking
          cacheAsset(src, cacheCategory).then((success) => {
            if (success) {
              console.log(`[CachedImage] ✅ Cached for offline: ${src}`);
            }
          }).catch(err => {
            console.warn('[CachedImage] ❌ Failed to auto-cache:', err);
          });
        }
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
    };
  }, [src, autoCache, cacheCategory, retryKey]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  // Listen for online/offline events to retry failed loads
  useEffect(() => {
    const handleOnline = () => {
      console.log('[CachedImage] 🌐 Network came back online');
      if (loadError) {
        console.log('[CachedImage] 🔄 Retrying failed image load...');
        // Increment retryKey to trigger reload in main useEffect
        setRetryKey(prev => prev + 1);
      }
    };

    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [loadError]);

  // Handle image load error
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error(`[CachedImage] ❌ Image failed to load`);
    console.error(`[CachedImage] src: ${imageSrc}`);
    console.error(`[CachedImage] navigator.onLine: ${navigator.onLine}`);
    console.error(`[CachedImage] Error event:`, e);
    
    // If loading from network failed and we're offline, try cache again
    if (!navigator.onLine && imageSrc === src) {
      console.log(`[CachedImage] 🔄 Retrying from cache...`);
      // Reset and let useEffect retry
      setImageSrc(null);
      setIsLoading(true);
      prevSrcRef.current = null; // Force reload
    } else {
      setLoadError(true);
    }
  };

  // Handle image load success
  const handleImageLoad = () => {
    console.log(`[CachedImage] ✅ Image loaded successfully from: ${imageSrc?.startsWith('blob:') ? 'CACHE (blob URL)' : 'NETWORK'}`);
    setLoadError(false);
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

  // Show loading state
  if (isLoading || !imageSrc) {
    return (
      <div 
        className={props.className}
        style={{ 
          backgroundColor: '#e5e7eb',
          minHeight: '200px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <span className="text-gray-400 text-sm md:text-base">{t('loading')}</span>
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
