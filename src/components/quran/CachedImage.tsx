import { useState, useEffect, useRef, ImgHTMLAttributes } from 'react';
import { getCachedAsset } from '@/lib/asset-cache';

interface CachedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
}

/**
 * Image component that checks IndexedDB cache first before loading from network.
 * Falls back to original src if not cached.
 */
export function CachedImage({ src, alt, ...props }: CachedImageProps) {
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
          // Not in cache - use original URL
          setImageSrc(src);
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
  }, [src]);

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
