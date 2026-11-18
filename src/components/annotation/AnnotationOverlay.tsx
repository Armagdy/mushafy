/**
 * AnnotationOverlay
 *
 * Read-only canvas that renders the saved annotation layer of a page on top
 * of the page image while reading. Sits inside the page container next to
 * <CachedImage> with `absolute inset-0 w-full h-full pointer-events-none`,
 * and sizes its backing store to the displayed page via a ResizeObserver.
 */

import { useEffect, useRef } from 'react';
import { useMushaf } from '@/contexts/MushafContext';
import { usePageAnnotations, useAnnotationsVisible } from '@/hooks/useAnnotations';
import { renderShapes } from '@/lib/annotation-render';
import { cn } from '@/lib/utils';

interface AnnotationOverlayProps {
  page: number;
  className?: string;
}

export function AnnotationOverlay({ page, className }: AnnotationOverlayProps) {
  const { mushafType } = useMushaf();
  const { shapes, isLoading } = usePageAnnotations(mushafType, page);
  const { annotationsVisible } = useAnnotationsVisible();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // (Re)draw whenever data or visibility changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const draw = () => {
      if (shapes.length === 0 || !annotationsVisible) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const rect = container.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const needW = Math.round(rect.width * dpr);
      const needH = Math.round(rect.height * dpr);
      if (canvas.width !== needW || canvas.height !== needH) {
        canvas.width = needW;
        canvas.height = needH;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      renderShapes(ctx, shapes, canvas.width, canvas.height);
    };

    draw();

    // Page container resizes on window/orientation changes and when the
    // image finishes loading — keep the canvas matched to it.
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => observer.disconnect();
  }, [shapes, annotationsVisible, isLoading]);

  // Nothing to render — skip the canvas entirely (tiny perf win in the reader)
  if (shapes.length === 0 || !annotationsVisible) return null;

  return (
    <div ref={containerRef} className={cn('absolute inset-0 pointer-events-none', className)}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
