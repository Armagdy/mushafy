/**
 * Annotation Canvas Renderer
 *
 * Pure canvas drawing / geometry helpers shared by:
 *  - AnnotationOverlay (read-only layer on top of the page while reading)
 *  - AnnotationEditor  (interactive editing with selection handles)
 *
 * All shapes are stored normalized (0..1); this module converts to the pixel
 * space of whatever canvas it is asked to draw on.
 */

import type { AnnotationShape, AnnotationPoint, RectShape, StrokeShape, TextShape } from './annotation-types';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/** Arabic-friendly font stack used for text annotations. */
export const TEXT_FONT_STACK = `"Amiri", "Segoe UI", system-ui, sans-serif`;
/** Line height multiplier for multi-line text annotations. */
export const TEXT_LINE_HEIGHT = 1.3;

let measureCtx: CanvasRenderingContext2D | null = null;
const getMeasureCtx = (): CanvasRenderingContext2D | null => {
  if (!measureCtx) {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
  }
  return measureCtx;
};

const textLinesOf = (s: TextShape): string[] => s.text.split('\n');

/** Measured text bounds, normalized to the page (needs canvasW for scaling). */
const textBounds = (s: TextShape, canvasW: number, canvasH: number): Bounds => {
  const ctx = getMeasureCtx();
  let maxLinePx = 0;
  if (ctx) {
    ctx.font = `${s.fontSize * canvasW}px ${TEXT_FONT_STACK}`;
    for (const line of textLinesOf(s)) {
      maxLinePx = Math.max(maxLinePx, ctx.measureText(line).width);
    }
  } else {
    maxLinePx = s.text.length * s.fontSize * canvasW * 0.5;
  }
  const heightPx = textLinesOf(s).length * s.fontSize * canvasW * TEXT_LINE_HEIGHT;
  return {
    minX: s.x,
    minY: s.y,
    maxX: s.x + maxLinePx / canvasW,
    maxY: s.y + heightPx / canvasH,
  };
};

// ---------------------------------------------------------------------------
// Path generation (line styles)
// ---------------------------------------------------------------------------

/** Drop points that are closer than minDist (px) to the previous kept point. */
export const simplifyPoints = (points: AnnotationPoint[], canvasW: number, canvasH: number, minDistPx = 3): AnnotationPoint[] => {
  if (points.length <= 2) return points;
  const out: AnnotationPoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1];
    const dx = (points[i].x - prev.x) * canvasW;
    const dy = (points[i].y - prev.y) * canvasH;
    if (Math.hypot(dx, dy) >= minDistPx) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
};

interface PxPoint { x: number; y: number }

const toPx = (p: AnnotationPoint, w: number, h: number): PxPoint => ({ x: p.x * w, y: p.y * h });

/**
 * Displace a polyline perpendicular to its direction with a sinusoid —
 * the "ripple" line style. Works in pixel space so the wave shape stays
 * uniform regardless of page dimensions.
 */
const buildRipplePath = (pts: PxPoint[], amplitudePx: number, wavelengthPx: number): PxPoint[] => {
  if (pts.length < 2) return pts;
  const minWl = Math.max(wavelengthPx, 4);
  const out: PxPoint[] = [pts[0]];
  let arc = 0;

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 0.001) continue;

    const dx = (b.x - a.x) / len;
    const dy = (b.y - a.y) / len;
    const nx = -dy;
    const ny = dx;

    const steps = Math.max(2, Math.ceil(len / (minWl / 8)));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const traveled = arc + len * t;
      const offset = amplitudePx * Math.sin((2 * Math.PI * traveled) / minWl);
      out.push({
        x: a.x + dx * len * t + nx * offset,
        y: a.y + dy * len * t + ny * offset,
      });
    }
    arc += len;
  }
  return out;
};

/** Trace a smooth (quadratic mid-point) path through freehand points. */
const traceSmoothPath = (ctx: CanvasRenderingContext2D, pts: PxPoint[]) => {
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
    return;
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) / 2;
    const midY = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
};

/** Trace a straight-segment polyline. */
const traceStraightPath = (ctx: CanvasRenderingContext2D, pts: PxPoint[]) => {
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
};

const traceStrokePath = (ctx: CanvasRenderingContext2D, pts: PxPoint[], style: string) => {
  if (style === 'straight') traceStraightPath(ctx, pts);
  else traceSmoothPath(ctx, pts);
};

/** Manually rounded rect (avoids relying on ctx.roundRect availability). */
const traceRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radiusPx: number
) => {
  const maxR = Math.min(w, h) / 2;
  const r = Math.max(0, Math.min(radiusPx, maxR));
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
};

// ---------------------------------------------------------------------------
// Shape drawing
// ---------------------------------------------------------------------------

export const drawShape = (
  ctx: CanvasRenderingContext2D,
  shape: AnnotationShape,
  canvasW: number,
  canvasH: number
) => {
  const thicknessPx = Math.max(1, shape.thickness * canvasW);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = shape.color;
  ctx.fillStyle = shape.color;
  ctx.globalAlpha = shape.type === 'highlight' ? shape.opacity * 0.45 : shape.opacity;
  ctx.lineWidth = shape.type === 'highlight' ? thicknessPx * 3.5 : thicknessPx;

  if (shape.type === 'rect') {
    const x = shape.x * canvasW;
    const y = shape.y * canvasH;
    const w = shape.w * canvasW;
    const h = shape.h * canvasH;
    ctx.beginPath();
    traceRoundedRect(ctx, x, y, w, h, (shape.cornerRadius * Math.min(w, h)) / 2);

    if (shape.filled) {
      ctx.save();
      ctx.globalAlpha *= 0.25;
      ctx.fill();
      ctx.restore();
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (shape.type === 'text') {
    ctx.save();
    ctx.globalAlpha = shape.opacity;
    ctx.fillStyle = shape.color;
    ctx.font = `${shape.fontSize * canvasW}px ${TEXT_FONT_STACK}`;
    ctx.textBaseline = 'top';
    const lines = textLinesOf(shape);
    const lineHeight = shape.fontSize * canvasW * TEXT_LINE_HEIGHT;
    lines.forEach((line, i) => {
      ctx.fillText(line, shape.x * canvasW, shape.y * canvasH + i * lineHeight);
    });
    ctx.restore();
    return;
  }

  // Stroke shapes
  const pts = shape.points.map((p) => toPx(p, canvasW, canvasH));
  if (pts.length === 0) {
    ctx.restore();
    return;
  }

  // Single-tap dot: draw a round dot instead of an invisible zero-length line
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = shape.color;
    ctx.fill();
    ctx.restore();
    return;
  }

  const style = shape.style;
  ctx.beginPath();

  if (style === 'ripple') {
    const ripplePts = buildRipplePath(pts, thicknessPx * 1.1, Math.max(thicknessPx * 7, 6));
    traceStraightPath(ctx, ripplePts);
  } else if (style === 'dashed') {
    ctx.setLineDash([thicknessPx * 4, thicknessPx * 3]);
    traceStrokePath(ctx, pts, 'smooth');
  } else if (style === 'dotted') {
    ctx.setLineDash([0.1, thicknessPx * 2]);
    traceStrokePath(ctx, pts, 'smooth');
  } else {
    traceStrokePath(ctx, pts, style);
  }

  ctx.stroke();
  ctx.restore();
};

/** Draw all shapes in order. */
export const renderShapes = (
  ctx: CanvasRenderingContext2D,
  shapes: AnnotationShape[],
  canvasW: number,
  canvasH: number
) => {
  ctx.clearRect(0, 0, canvasW, canvasH);
  for (const shape of shapes) drawShape(ctx, shape, canvasW, canvasH);
};

// ---------------------------------------------------------------------------
// Geometry / hit-testing
// ---------------------------------------------------------------------------

/** Bounding box in normalized coordinates (canvasW/H needed to measure text). */
export const getShapeBounds = (
  shape: AnnotationShape,
  canvasW = 1024,
  canvasH = 1638
): Bounds => {
  if (shape.type === 'rect') {
    const minX = Math.min(shape.x, shape.x + shape.w);
    const minY = Math.min(shape.y, shape.y + shape.h);
    return { minX, minY, maxX: minX + Math.abs(shape.w), maxY: minY + Math.abs(shape.h) };
  }
  if (shape.type === 'text') {
    return textBounds(shape, canvasW, canvasH);
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of shape.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (shape.points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
};

const pointToSegmentDistance = (
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): number => {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

/**
 * Hit-test a shape at a normalized point.
 * `thresholdPx` is the touch tolerance in CANVAS pixels (callers scale this
 * for finger size and zoom level).
 */
export const hitTestShape = (
  shape: AnnotationShape,
  point: AnnotationPoint,
  canvasW: number,
  canvasH: number,
  thresholdPx: number
): boolean => {
  const px = point.x * canvasW;
  const py = point.y * canvasH;
  const thicknessPx = shape.thickness * canvasW;

  if (shape.type === 'text') {
    const b = textBounds(shape, canvasW, canvasH);
    return (
      px >= b.minX * canvasW - thresholdPx && px <= b.maxX * canvasW + thresholdPx &&
      py >= b.minY * canvasH - thresholdPx && py <= b.maxY * canvasH + thresholdPx
    );
  }

  if (shape.type === 'rect') {
    const x = shape.x * canvasW;
    const y = shape.y * canvasH;
    const w = shape.w * canvasW;
    const h = shape.h * canvasH;
    if (shape.filled) {
      return px >= x - thresholdPx && px <= x + w + thresholdPx &&
             py >= y - thresholdPx && py <= y + h + thresholdPx;
    }
    // Near one of the 4 border edges
    const inner = {
      left: px - (x + thresholdPx),
      right: (x + w - thresholdPx) - px,
      top: py - (y + thresholdPx),
      bottom: (y + h - thresholdPx) - py,
    };
    const insideOuter = px >= x - thresholdPx && px <= x + w + thresholdPx &&
                        py >= y - thresholdPx && py <= y + h + thresholdPx;
    const insideInner = inner.left > 0 && inner.right > 0 && inner.top > 0 && inner.bottom > 0;
    return insideOuter && !insideInner;
  }

  if (shape.points.length === 1) {
    const p = toPx(shape.points[0], canvasW, canvasH);
    return Math.hypot(px - p.x, py - p.y) <= thicknessPx * 1.75 + thresholdPx;
  }

  const halfStroke = Math.max(thicknessPx / 2, 1.5) + thresholdPx;
  for (let i = 1; i < shape.points.length; i++) {
    const a = toPx(shape.points[i - 1], canvasW, canvasH);
    const b = toPx(shape.points[i], canvasW, canvasH);
    if (pointToSegmentDistance(px, py, a.x, a.y, b.x, b.y) <= halfStroke) return true;
  }
  return false;
};

/**
 * Topmost shape under a point (searches from last drawn to first).
 */
export const findShapeAt = (
  shapes: AnnotationShape[],
  point: AnnotationPoint,
  canvasW: number,
  canvasH: number,
  thresholdPx: number
): AnnotationShape | null => {
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (hitTestShape(shapes[i], point, canvasW, canvasH, thresholdPx)) return shapes[i];
  }
  return null;
};

// ---------------------------------------------------------------------------
// Editing transforms
// ---------------------------------------------------------------------------

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Move a shape by a normalized delta (returns a new shape). */
export const moveShape = (shape: AnnotationShape, dx: number, dy: number): AnnotationShape => {
  if (shape.type === 'rect' || shape.type === 'text') {
    return { ...shape, x: clamp01(shape.x + dx), y: clamp01(shape.y + dy), updatedAt: Date.now() };
  }
  return {
    ...shape,
    points: shape.points.map((p) => ({ x: clamp01(p.x + dx), y: clamp01(p.y + dy) })),
    updatedAt: Date.now(),
  };
};

/**
 * Rescale a shape so its old bounds map onto new bounds.
 * Used by the editor's corner-handle resizing. Also scales stroke thickness.
 */
export const scaleShape = (shape: AnnotationShape, from: Bounds, to: Bounds): AnnotationShape => {
  const fromW = Math.max(from.maxX - from.minX, 1e-6);
  const fromH = Math.max(from.maxY - from.minY, 1e-6);
  const toW = Math.max(to.maxX - to.minX, 1e-6);
  const toH = Math.max(to.maxY - to.minY, 1e-6);
  const sx = toW / fromW;
  const sy = toH / fromH;
  const mapX = (x: number) => to.minX + (x - from.minX) * sx;
  const mapY = (y: number) => to.minY + (y - from.minY) * sy;
  const thicknessScale = Math.sqrt(Math.abs(sx * sy));

  if (shape.type === 'text') {
    return {
      ...shape,
      x: mapX(shape.x),
      y: mapY(shape.y),
      fontSize: Math.max(0.008, shape.fontSize * thicknessScale),
      updatedAt: Date.now(),
    };
  }
  if (shape.type === 'rect') {
    return {
      ...shape,
      x: mapX(shape.x),
      y: mapY(shape.y),
      w: shape.w * sx,
      h: shape.h * sy,
      thickness: Math.max(0.0005, shape.thickness * thicknessScale),
      updatedAt: Date.now(),
    };
  }
  return {
    ...shape,
    points: shape.points.map((p) => ({ x: mapX(p.x), y: mapY(p.y) })),
    thickness: Math.max(0.0005, shape.thickness * thicknessScale),
    updatedAt: Date.now(),
  };
};

/** The 4 bbox corners of a shape, in normalized coordinates. */
export const getBoundsCorners = (b: Bounds): AnnotationPoint[] => [
  { x: b.minX, y: b.minY },
  { x: b.maxX, y: b.minY },
  { x: b.maxX, y: b.maxY },
  { x: b.minX, y: b.maxY },
];

// ---------------------------------------------------------------------------
// Selection rendering (editor only)
// ---------------------------------------------------------------------------

export interface SelectionStyle {
  /** Handle size in CANVAS pixels (caller keeps visual size constant). */
  handleSizePx: number;
  accent: string;
}

/** Dashed bbox + 4 corner handles for the currently selected shape. */
export const drawSelection = (
  ctx: CanvasRenderingContext2D,
  shape: AnnotationShape,
  canvasW: number,
  canvasH: number,
  style: SelectionStyle
) => {
  const b = getShapeBounds(shape, canvasW, canvasH);
  const x = b.minX * canvasW;
  const y = b.minY * canvasH;
  const w = (b.maxX - b.minX) * canvasW;
  const h = (b.maxY - b.minY) * canvasH;
  const hs = style.handleSizePx;

  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = style.accent;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);

  ctx.setLineDash([]);
  ctx.fillStyle = style.accent;
  const corners: Array<[number, number]> = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    // Circular handles — visible even over dark page content
    ctx.arc(cx, cy, hs / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
  ctx.restore();
};

/** Recompute bounds for a stroke/rect after points changed (editor helper). */
export const shapeBoundsFromPoints = (points: AnnotationPoint[]): Bounds => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
};

export type { RectShape, StrokeShape, TextShape };
