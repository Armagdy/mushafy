import { useState, useEffect, useRef, ImgHTMLAttributes } from 'react';
import { getCachedAsset, cacheAsset } from '@/lib/asset-cache';

interface CachedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Category for caching (e.g., 'mushaf-mwdoa', 'mushaf-tashel', 'mushaf-madinah') */
  cacheCategory?: string;
  /** Whether to automatically cache when loaded from network */
  autoCache?: boolean;
}

/**
 * Image component that checks IndexedDB cache first before loading from network.
 * Falls back to original src if not cached.
 * Optionally auto-caches images when viewed for offline use.
 */
export function CachedImage({ src, alt, cacheCategory, autoCache = true, ...props }: CachedImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const prevSrcRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip if same src
    if (prevSrcRef.current === src) return;
    prevSrcRef.current = src;

    // Cleanup previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    let cancelled = false;

    const loadImage = async () => {
      try {
        // Check cache first
        const cachedBlob = await getCachedAsset(src);
        
        if (cancelled) return;

        if (cachedBlob) {
          // Found in cache - create blob URL
          const blobUrl = URL.createObjectURL(cachedBlob);
          blobUrlRef.current = blobUrl;
          setImageSrc(blobUrl);
        } else {
          // Not in cache - use original URL and optionally cache it
          setImageSrc(src);
          
          // Auto-cache the image for offline use if enabled
          if (autoCache && cacheCategory && navigator.onLine) {
            // Cache in background without blocking
            cacheAsset(src, cacheCategory).then((success) => {
              if (success) {
                console.log(`Image cached for offline: ${src}`);
              }
            }).catch(err => {
              console.warn('Failed to auto-cache image:', err);
            });
          }
        }
      } catch (error) {
        console.error('Error loading cached image:', error);
        if (!cancelled) {
          setImageSrc(src);
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [src, autoCache, cacheCategory]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  if (!imageSrc) {
    // Return placeholder while loading
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
        <span className="text-gray-400 text-sm">Loading...</span>
      </div>
    );
  }

  return <img src={imageSrc} alt={alt} {...props} />;
}
