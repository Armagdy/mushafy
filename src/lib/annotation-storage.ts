/**
 * Annotation Storage Service
 *
 * Persists the per-page annotation layer for each mushaf, following the same
 * hybrid storage pattern as the rest of the app: Capacitor Filesystem
 * (Directory.Data) on native Android/iOS and IndexedDB on web — i.e. data is
 * saved in the SAME location as cached page images and other app data.
 *
 * Key layout:  anno-{mushafType}-{page padded to 4 digits}
 * e.g.         anno-mwdoa-0007
 *
 * Cross-component sync mirrors the bookmarks pattern: a
 * 'quran-annotations-changed' CustomEvent is dispatched after every write so
 * open readers (overlay canvases, indicator badges) refresh themselves.
 */

import { NativeStorage } from './native-storage';
import type { PageAnnotations, AnnotationShape } from './annotation-types';

const ANNOTATION_STORAGE_DB = 'quran-annotations';
const KEY_PREFIX = 'anno-';

const storage = new NativeStorage(ANNOTATION_STORAGE_DB);

/** In-memory index of annotated pages per mushaf (avoids repeated async IO). */
const annotatedPagesCache = new Map<string, Set<number>>();

export const annotationStorageKey = (mushafType: string, page: number): string =>
  `${KEY_PREFIX}${mushafType}-${String(page).padStart(4, '0')}`;

const pageFromKey = (key: string): number | null => {
  const match = key.match(new RegExp(`^${KEY_PREFIX}[^-]+-(\\d{4})$`));
  return match ? parseInt(match[1], 10) : null;
};

/** Load the annotation layer of one page. Returns [] when nothing is saved. */
export const loadPageAnnotations = async (
  mushafType: string,
  page: number
): Promise<PageAnnotations | null> => {
  try {
    const item = await storage.getItem(annotationStorageKey(mushafType, page));
    if (!item || typeof item.data !== 'string') return null;
    const parsed = JSON.parse(item.data) as PageAnnotations;
    if (!parsed || !Array.isArray(parsed.shapes)) return null;
    return parsed;
  } catch (error) {
    console.error(`[annotations] Failed to load page ${page} (${mushafType}):`, error);
    return null;
  }
};

/** Persist (or clear, when shapes is empty) the annotation layer of one page. */
export const savePageAnnotations = async (
  mushafType: string,
  page: number,
  shapes: AnnotationShape[]
): Promise<void> => {
  const key = annotationStorageKey(mushafType, page);

  if (shapes.length === 0) {
    await storage.removeItem(key);
  } else {
    const payload: PageAnnotations = {
      version: 1,
      mushafType,
      page,
      shapes,
      updatedAt: Date.now(),
    };
    await storage.setItem(key, JSON.stringify(payload), {
      category: `annotations-${mushafType}`,
      page,
      mushafType,
    });
  }

  // Update in-memory index
  const cached = annotatedPagesCache.get(mushafType);
  if (cached) {
    if (shapes.length > 0) cached.add(page);
    else cached.delete(page);
  }

  // Notify listeners (reader overlays, indicator badges, ...)
  window.dispatchEvent(
    new CustomEvent('quran-annotations-changed', { detail: { mushafType, page } })
  );
};

/**
 * Get the set of pages that have annotations for a mushaf.
 * The first call scans storage keys; afterwards the cache is kept in sync by
 * savePageAnnotations and the 'quran-annotations-changed' event.
 */
export const getAnnotatedPages = async (mushafType: string): Promise<Set<number>> => {
  const cached = annotatedPagesCache.get(mushafType);
  if (cached) return cached;

  const pages = new Set<number>();
  try {
    const keys = await storage.keys();
    for (const key of keys) {
      if (!key.startsWith(`${KEY_PREFIX}${mushafType}-`)) continue;
      const page = pageFromKey(key);
      if (page !== null) pages.add(page);
    }
  } catch (error) {
    console.error('[annotations] Failed to list annotated pages:', error);
  }

  annotatedPagesCache.set(mushafType, pages);
  return pages;
};
