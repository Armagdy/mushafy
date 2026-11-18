/**
 * Annotation hooks
 *
 *  - usePageAnnotations:   loads one page's annotation layer (with live sync)
 *  - useAnnotatedPages:    which pages of the current mushaf have annotations
 *                          (drives the pen indicator badge in the reader)
 *  - useAnnotationsVisible: reading-time show/hide toggle, persisted in
 *                          localStorage and synced across components
 */

import { useCallback, useEffect, useState } from 'react';
import type { PageAnnotations } from '@/lib/annotation-types';
import { loadPageAnnotations, getAnnotatedPages } from '@/lib/annotation-storage';

const VISIBLE_KEY = 'quran-annotations-visible';
const VISIBLE_EVENT = 'quran-annotations-visibility-changed';

/** Annotation layer of a single page; re-reads when the change event fires. */
export const usePageAnnotations = (mushafType: string, page: number) => {
  const [annotations, setAnnotations] = useState<PageAnnotations | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const refresh = async () => {
      const data = await loadPageAnnotations(mushafType, page);
      if (!cancelled) {
        setAnnotations(data);
        setIsLoading(false);
      }
    };

    refresh();

    const handleChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return refresh();
      if (detail.mushafType === mushafType && detail.page === page) refresh();
    };

    window.addEventListener('quran-annotations-changed', handleChange);
    return () => {
      cancelled = true;
      window.removeEventListener('quran-annotations-changed', handleChange);
    };
  }, [mushafType, page]);

  return { annotations, shapes: annotations?.shapes ?? [], isLoading };
};

/** Set of pages that have annotations for a mushaf (for indicator badges). */
export const useAnnotatedPages = (mushafType: string) => {
  const [pages, setPages] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const result = await getAnnotatedPages(mushafType);
      if (!cancelled) setPages(new Set(result));
    };

    refresh();

    const handleChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.mushafType === mushafType) refresh();
    };

    window.addEventListener('quran-annotations-changed', handleChange);
    return () => {
      cancelled = true;
      window.removeEventListener('quran-annotations-changed', handleChange);
    };
  }, [mushafType]);

  return pages;
};

/** Whether annotations render on pages during normal reading. */
export const useAnnotationsVisible = () => {
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem(VISIBLE_KEY);
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem(VISIBLE_KEY);
      setVisible(saved === null ? true : saved === 'true');
    };
    window.addEventListener(VISIBLE_EVENT, handler);
    return () => window.removeEventListener(VISIBLE_EVENT, handler);
  }, []);

  const setVisiblePersisted = useCallback((next: boolean) => {
    localStorage.setItem(VISIBLE_KEY, String(next));
    setVisible(next);
    window.dispatchEvent(new CustomEvent(VISIBLE_EVENT));
  }, []);

  return { annotationsVisible: visible, setAnnotationsVisible: setVisiblePersisted };
};
