/**
 * Page Annotation Types
 *
 * Annotations are stored as vector data in NORMALIZED coordinates (0..1
 * relative to the page image width/height). This makes them resolution- and
 * zoom-independent: the same data renders identically on the reader overlay
 * (small) and in the editor (zoomed).
 *
 * Thickness is normalized to the page image WIDTH (e.g. 0.004 = 0.4% of the
 * page width), so strokes scale proportionally on every screen.
 */

export type LineStyle = 'smooth' | 'straight' | 'ripple' | 'dashed' | 'dotted';

export const LINE_STYLES: LineStyle[] = ['smooth', 'straight', 'ripple', 'dashed', 'dotted'];

export type ShapeType = 'pen' | 'line' | 'highlight' | 'rect' | 'text';

/** A point in normalized page coordinates (0..1 relative to the page image). */
export interface AnnotationPoint {
  x: number;
  y: number;
}

interface BaseShape {
  id: string;
  /** Unix ms */
  createdAt: number;
  updatedAt: number;
  /** Any CSS color (hex/rgba/...) */
  color: string;
  /** Stroke thickness as a fraction of the page image width (0..1) */
  thickness: number;
  /** 0..1 stroke opacity */
  opacity: number;
}

/** Freehand strokes: pen, highlighter, and two-point lines. */
export interface StrokeShape extends BaseShape {
  type: 'pen' | 'line' | 'highlight';
  points: AnnotationPoint[];
  style: LineStyle;
}

/** Rectangle with (optionally fully) rounded corners. */
export interface RectShape extends BaseShape {
  type: 'rect';
  /** Top-left corner, normalized (0..1) */
  x: number;
  y: number;
  /** Width/height, normalized (> 0) */
  w: number;
  h: number;
  /**
   * Corner roundness: 0 = sharp corners, 1 = fully circular (pill-shaped)
   * as a fraction of min(w, h)/2.
   */
  cornerRadius: number;
  /** When true the rect is filled with the shape color at low opacity. */
  filled?: boolean;
}

export type AnnotationShape = StrokeShape | RectShape | TextShape;

/** Free-floating text note placed on the page. */
export interface TextShape extends BaseShape {
  type: 'text';
  /** Top-left anchor, normalized (0..1) */
  x: number;
  y: number;
  /** May contain \n line breaks */
  text: string;
  /** Font size as a fraction of the page image width (0..1) */
  fontSize: number;
}

export interface PageAnnotations {
  version: 1;
  mushafType: string;
  page: number;
  shapes: AnnotationShape[];
  updatedAt: number;
}

export const isStrokeShape = (s: AnnotationShape): s is StrokeShape =>
  s.type === 'pen' || s.type === 'line' || s.type === 'highlight';

/** Generate a reasonably unique shape id (no external deps). */
export const generateShapeId = (): string =>
  `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
