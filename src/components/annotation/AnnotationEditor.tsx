/**
 * AnnotationEditor
 *
 * Full-screen page editor opened from the reader's quick bar.
 *  - The page appears as a plain image (no swiping while editing).
 *  - Pinch to zoom, drag with the hand tool (or two fingers) to pan.
 *  - Tools: select/move/resize, pen (smooth/straight/ripple/dashed/dotted),
 *    two-point line, highlighter, rounded rectangle (corner radius up to
 *    fully circular), each with any color and thickness.
 *  - Selected shapes can be re-styled (color/thickness/style) — editing
 *    previously saved annotations.
 *  - Undo/redo, delete, clear all.
 *  - Save persists the annotation layer (vector JSON) per page per mushaf
 *    via annotation-storage (same storage location as page images).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X, Save, Undo2, Redo2, MousePointer2, Pen, Minus, Square, Hand,
  Waves, Diameter, Eraser, Loader2, Maximize2, Check, Type,
} from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMushaf } from '@/contexts/MushafContext';
import { useToast } from '@/hooks/use-toast';
import TartelPage from '@/components/quran/TartelPage';
import { isNativePlatform } from '@/lib/native-storage';
import { getCachedAsset, getCachedAssetUri } from '@/lib/asset-cache';
import {
  generateShapeId,
  LINE_STYLES,
  type AnnotationPoint,
  type AnnotationShape,
  type LineStyle,
  type RectShape,
  type StrokeShape,
  type TextShape,
} from '@/lib/annotation-types';
import { savePageAnnotations, loadPageAnnotations } from '@/lib/annotation-storage';
import {
  drawSelection, drawShape, findShapeAt, getBoundsCorners, getShapeBounds,
  moveShape, renderShapes, scaleShape, simplifyPoints, type Bounds,
} from '@/lib/annotation-render';
import { cn } from '@/lib/utils';

type Tool = 'select' | 'pen' | 'line' | 'rect' | 'text' | 'erase' | 'pan';
type Popover = 'color' | 'thickness' | 'style' | 'rect' | null;

interface AnnotationEditorProps {
  page: number;
  /** Full source URL of the page image (image mushafs only). */
  imageSrc?: string;
  /** Asset cache category, e.g. 'mushaf-mwdoa'. */
  cacheCategory?: string;
  onClose: (saved: boolean) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const DEFAULT_THICKNESS = 0.004;
/** Default thickness per drawing tool. */
const TOOL_DEFAULT_THICKNESS: Record<'pen' | 'line' | 'rect', number> = {
  pen: 0.004,
  line: 0.005,
  rect: 0.005,
};
const DEFAULT_TEXT_SIZE = 0.035;
/** Eraser: visual/tolerance radius in CSS px and sample step (normalized). */
const ERASE_RING_PX = 26;
const ERASE_SAMPLE_STEP = 0.008;

const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#fde047', '#22c55e', '#10b981',
  '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f43f5e',
  '#1f2937', '#ffffff',
];

const HANDLE_VISUAL_PX = 18;
const HIT_TOLERANCE_PX = 14;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Small SVG preview for each line style option. */
const LineStylePreview = ({ style }: { style: LineStyle }) => {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round' as const };
  return (
    <svg viewBox="0 0 26 14" className="w-8 h-5">
      {style === 'smooth' && <path {...common} d="M2 10 Q8 2 13 8 T24 7" />}
      {style === 'straight' && <polyline {...common} points="2,11 8,3 13,11 19,3 24,10" />}
      {style === 'ripple' && <path {...common} d="M1 7 q3 -6 6 0 t6 0 t6 0 t6 0" />}
      {style === 'dashed' && <line {...common} x1="2" y1="7" x2="24" y2="7" strokeDasharray="5 4" />}
      {style === 'dotted' && <line {...common} x1="2" y1="7" x2="24" y2="7" strokeDasharray="0.5 4.5" />}
    </svg>
  );
};

export function AnnotationEditor({ page, imageSrc, onClose }: AnnotationEditorProps) {
  const { t } = useLanguage();
  const { mushafType } = useMushaf();
  const { toast } = useToast();

  // Text mushafs (tarteel/tajweed) render via TartelPage instead of an image
  const isTextMushaf = mushafType === 'tarteel' || mushafType === 'tajweed';

  // ---------------------------------------------------------------- state ---
  const [shapes, setShapes] = useState<AnnotationShape[]>([]);
  const shapesRef = useRef<AnnotationShape[]>([]);
  const applyShapes = useCallback((next: AnnotationShape[]) => {
    shapesRef.current = next;
    setShapes(next);
  }, []);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#ef4444');
  // Thickness remembered per drawing tool
  const [toolThickness, setToolThickness] =
    useState<Record<'pen' | 'line' | 'rect', number>>(() => ({
      ...TOOL_DEFAULT_THICKNESS,
    }));
  const [textSize, setTextSize] = useState(DEFAULT_TEXT_SIZE);
  const [lineStyle, setLineStyle] = useState<LineStyle>('smooth');
  const [rectRadius, setRectRadius] = useState(1); // 1 = fully circular corners
  const [rectFilled, setRectFilled] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [popover, setPopover] = useState<Popover>(null);
  // Text tool: draft position (new) or shape id (editing existing text)
  const [textDraft, setTextDraft] = useState<{ pos: AnnotationPoint; id?: string } | null>(null);
  const [textValue, setTextValue] = useState('');

  /** Thickness used for NEW shapes with the active tool. */
  const activeThickness =
    (toolThickness as Partial<Record<Tool, number>>)[tool] ?? DEFAULT_THICKNESS;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  const [historyIndex, setHistoryIndex] = useState(0);
  const historyRef = useRef<AnnotationShape[][]>([]);
  const historyIndexRef = useRef(0);
  const savedIndexRef = useRef(0);
  const [dirty, setDirty] = useState(false);

  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [imgError, setImgError] = useState(false);
  // Real available height of the canvas area (between header and toolbar,
  // incl. safe-area insets) — used to size the page image on phones where a
  // hard-coded calc() overflows because the toolbar wraps to multiple rows.
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);

  // Keep the measured stage height in sync with layout changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setAvailableHeight(el.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const [annotationsLoaded, setAnnotationsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ------------------------------------------------------------- constants ---
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // -------------------------------------------------------- history helpers ---
  const pushHistory = useCallback((snapshot: AnnotationShape[]) => {
    const h = historyRef.current.slice(0, historyIndexRef.current + 1);
    h.push(snapshot);
    while (h.length > 60) h.shift();
    historyRef.current = h;
    historyIndexRef.current = h.length - 1;
    setHistoryIndex(h.length - 1);
    setDirty(h.length - 1 !== savedIndexRef.current);
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    setHistoryIndex(historyIndexRef.current);
    applyShapes(historyRef.current[historyIndexRef.current]);
    setSelectedId(null);
    setDirty(historyIndexRef.current !== savedIndexRef.current);
  }, [applyShapes]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    setHistoryIndex(historyIndexRef.current);
    applyShapes(historyRef.current[historyIndexRef.current]);
    setSelectedId(null);
    setDirty(historyIndexRef.current !== savedIndexRef.current);
  }, [applyShapes]);

  // ------------------------------------------------------------- load data ---
  useEffect(() => {
    let cancelled = false;

    // Existing annotations of this page
    (async () => {
      const data = await loadPageAnnotations(mushafType, page);
      if (cancelled) return;
      const initial = data?.shapes ?? [];
      historyRef.current = [initial];
      historyIndexRef.current = 0;
      savedIndexRef.current = 0;
      setHistoryIndex(0);
      setDirty(false);
      applyShapes(initial);
      setAnnotationsLoaded(true);
    })();

    // Page image: prefer the offline cache, fall back to network src.
    // Text mushafs render via TartelPage instead — no image to resolve.
    if (!isTextMushaf && imageSrc) {
      (async () => {
        try {
          if (isNativePlatform()) {
            const uri = await getCachedAssetUri(imageSrc);
            if (cancelled) return;
            if (uri) {
              setDisplaySrc(Capacitor.convertFileSrc(uri));
              return;
            }
          } else {
            const blob = await getCachedAsset(imageSrc);
            if (cancelled) return;
            if (blob) {
              const url = URL.createObjectURL(blob);
              blobUrlRef.current = url;
              setDisplaySrc(url);
              return;
            }
          }
        } catch (error) {
          console.warn('[AnnotationEditor] cache lookup failed, using network src', error);
        }
        if (!cancelled) setDisplaySrc(imageSrc);
      })();
    }

    return () => {
      cancelled = true;
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, [mushafType, page, imageSrc, applyShapes, isTextMushaf]);

  // ------------------------------------------------------------- rendering ---
  const redrawRef = useRef<() => void>(() => {});
  const redrawScheduledRef = useRef(false);
  const scheduleRedraw = useCallback(() => {
    if (redrawScheduledRef.current) return;
    redrawScheduledRef.current = true;
    requestAnimationFrame(() => {
      redrawScheduledRef.current = false;
      redrawRef.current();
    });
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const current = shapesRef.current;
    renderShapes(ctx, current, canvas.width, canvas.height);

    const draft = draftRef.current;
    if (draft) drawShape(ctx, draft, canvas.width, canvas.height);

    const selected = selectedId ? current.find((s) => s.id === selectedId) : null;
    if (selected && tool === 'select') {
      const stage = stageRef.current;
      const rect = stage?.getBoundingClientRect();
      const handlePx = rect && rect.width > 0
        ? HANDLE_VISUAL_PX * (canvas.width / rect.width)
        : 14;
      drawSelection(ctx, selected, canvas.width, canvas.height, {
        handleSizePx: handlePx,
        accent: '#0ea5e9',
      });
    }

    // Eraser cursor ring — shows the erase reach while sweeping
    if (gestureRef.current.mode === 'erase' && eraseStrokeRef.current) {
      const stage = stageRef.current;
      const rect = stage?.getBoundingClientRect();
      const radius = rect && rect.width > 0
        ? ERASE_RING_PX * (canvas.width / rect.width)
        : 20;
      const p = eraseStrokeRef.current.lastPoint;
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x * canvas.width, p.y * canvas.height, radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = Math.max(2, radius * 0.06);
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.restore();
    }
  }, [selectedId, tool]);

  redrawRef.current = redraw;
  useEffect(() => { scheduleRedraw(); }, [shapes, selectedId, tool, scheduleRedraw]);

  const handleImageLoad = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    // Backing store: natural image size (capped) for crisp strokes
    const W = Math.min(img.naturalWidth || 1024, 1800);
    const H = Math.round(W * ((img.naturalHeight || 1600) / (img.naturalWidth || 1024)));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    setImageReady(true);
    scheduleRedraw();
  }, [scheduleRedraw]);

  // Text mushafs: the "page" is the rendered TartelPage box — size the canvas
  // backing store from it and keep it matched as fonts/layout settle (the
  // ResizeObserver sees layout size, which transforms don't affect).
  useEffect(() => {
    if (!isTextMushaf) return;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const resize = () => {
      const w = stage.offsetWidth;
      const h = stage.offsetHeight;
      if (w < 2 || h < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const W = Math.min(Math.round(w * dpr), 2048);
      const H = Math.round((W * h) / w);
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      setImageReady(true);
      scheduleRedraw();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [isTextMushaf, page, scheduleRedraw]);

  // --------------------------------------------------------- gesture state ---
  const draftRef = useRef<AnnotationShape | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchLingerRef = useRef(false);
  // Eraser sweep: shapes erased during the current drag (one undo step per sweep)
  const eraseStrokeRef = useRef<{ erasedIds: Set<string>; lastPoint: AnnotationPoint } | null>(null);

  interface GestureState {
    mode: 'none' | 'draw' | 'move' | 'resize' | 'pan' | 'pinch' | 'erase';
    startPoint?: AnnotationPoint;
    startClient?: { x: number; y: number };
    startShape?: AnnotationShape;
    startBounds?: Bounds;
    anchor?: AnnotationPoint;
    /** Whether the shape was actually moved/resized (history only on change). */
    moved?: boolean;
    /** Tap on an already-selected text shape opens its text editor. */
    pressedSelectedText?: boolean;
    pinchStart?: { dist: number; mid: { x: number; y: number }; zoom: number; panX: number; panY: number };
  }
  const gestureRef = useRef<GestureState>({ mode: 'none' });

  const getNormalizedPoint = (clientX: number, clientY: number): AnnotationPoint | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: clamp((clientX - rect.left) / rect.width, 0, 1),
      y: clamp((clientY - rect.top) / rect.height, 0, 1),
    };
  };

  const containerCenter = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: 0, y: 0 };
  };

  /** (Re)start a pinch from the currently tracked fingers — also used to
   *  rebase when a finger is added or lifted mid-gesture, so zoom never jumps. */
  const beginPinch = () => {
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return;
    gestureRef.current = {
      mode: 'pinch',
      pinchStart: {
        dist: Math.max(dist(pts[0], pts[1]), 1),
        mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
        zoom: zoomRef.current,
        panX: panRef.current.x,
        panY: panRef.current.y,
      },
    };
    pinchLingerRef.current = true;
  };

  const clampPan = useCallback((p: { x: number; y: number }, z: number) => {
    const container = containerRef.current;
    const stage = stageRef.current;
    if (!container || !stage) return p;
    const cRect = container.getBoundingClientRect();
    const sRect = stage.getBoundingClientRect();
    const stageW = sRect.width / (z || 1);
    const stageH = sRect.height / (z || 1);
    const maxX = cRect.width / 2 + (stageW * z) / 2;
    const maxY = cRect.height / 2 + (stageH * z) / 2;
    return { x: clamp(p.x, -maxX, maxX), y: clamp(p.y, -maxY, maxY) };
  }, []);

  const setZoomPan = useCallback((z: number, p: { x: number; y: number }) => {
    zoomRef.current = z;
    panRef.current = p;
    setZoom(z);
    setPan(p);
  }, []);

  /** Zoom keeping the screen point `m` anchored (pinch & wheel). */
  const zoomAt = useCallback((m: { x: number; y: number }, newZoom: number) => {
    const z0 = zoomRef.current;
    const p0 = panRef.current;
    const c = containerCenter();
    // stage-local offset of the anchor under the CURRENT transform
    const lx = (m.x - c.x - p0.x) / z0;
    const ly = (m.y - c.y - p0.y) / z0;
    const z1 = clamp(newZoom, MIN_ZOOM, MAX_ZOOM);
    const raw = { x: m.x - c.x - lx * z1, y: m.y - c.y - ly * z1 };
    setZoomPan(z1, clampPan(raw, z1));
  }, [clampPan, setZoomPan]);

  // Non-passive wheel listener so ctrl+wheel doesn't browser-zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt({ x: e.clientX, y: e.clientY }, zoomRef.current * Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const resetZoom = useCallback(() => {
    setZoomPan(1, { x: 0, y: 0 });
  }, [setZoomPan]);

  // ------------------------------------------------------ shape finalizers ---
  const finalizeDraft = useCallback((): AnnotationShape | null => {
    const draft = draftRef.current;
    draftRef.current = null;
    if (!draft) return null;

    if (draft.type === 'rect') {
      const w = Math.abs(draft.w);
      const h = Math.abs(draft.h);
      if (w < 0.004 && h < 0.004) return null; // accidental tap
      return {
        ...draft,
        x: Math.min(draft.x, draft.x + draft.w),
        y: Math.min(draft.y, draft.y + draft.h),
        w: Math.max(w, 0.002),
        h: Math.max(h, 0.002),
      };
    }

    if (draft.type === 'line') {
      const [a, b] = draft.points;
      if (dist(a, b) < 0.004) return null;
      return draft;
    }

    // pen / highlight
    const canvas = canvasRef.current;
    const simplified = canvas
      ? simplifyPoints(draft.points, canvas.width, canvas.height, 2.5)
      : draft.points;
    if (simplified.length === 0) return null;
    return { ...draft, points: simplified };
  }, []);

  // -------------------------------------------------------- pointer events ---

  /** Erase the topmost shape under a point (used by the eraser tool sweep). */
  const eraseAt = (pt: AnnotationPoint) => {
    const eraseState = eraseStrokeRef.current;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!eraseState || !canvas || !stage) return;
    const rect = stage.getBoundingClientRect();
    const tolerance = rect.width > 0
      ? ERASE_RING_PX * (canvas.width / rect.width)
      : 10;
    const hit = findShapeAt(shapesRef.current, pt, canvas.width, canvas.height, tolerance);
    if (!hit || eraseState.erasedIds.has(hit.id)) return;
    applyShapes(shapesRef.current.filter((s) => s.id !== hit.id));
    eraseState.erasedIds.add(hit.id);
    try {
      Haptics.impact({ style: ImpactStyle.Light });
    } catch { /* haptics not available on web */ }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (popover) setPopover(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two fingers → pinch zoom/pan (cancels any stroke in progress)
    if (pointersRef.current.size === 2) {
      draftRef.current = null;
      setSelectedId(null);
      beginPinch();
      scheduleRedraw();
      return;
    }
    // Extra finger joined mid-pinch — rebase so zoom doesn't jump
    if (pointersRef.current.size > 2) {
      if (gestureRef.current.mode === 'pinch') beginPinch();
      return;
    }
    if (pinchLingerRef.current) return; // wait for all fingers to lift

    const pt = getNormalizedPoint(e.clientX, e.clientY);
    if (!pt) return;
    const g = gestureRef.current;
    g.startPoint = pt;
    g.startClient = { x: e.clientX, y: e.clientY };

    const base = () => ({
      id: generateShapeId(),
      color,
      thickness: activeThickness,
      opacity: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    switch (tool) {
      case 'pen': {
        const draft: StrokeShape = {
          ...base(),
          type: 'pen',
          points: [pt],
          style: 'smooth',
        };
        draftRef.current = draft;
        g.mode = 'draw';
        scheduleRedraw();
        break;
      }
      case 'line': {
        const draft: StrokeShape = {
          ...base(),
          type: 'line',
          points: [pt, { ...pt }],
          style: lineStyle,
        };
        draftRef.current = draft;
        g.mode = 'draw';
        scheduleRedraw();
        break;
      }
      case 'rect': {
        const draft: RectShape = {
          ...base(),
          type: 'rect',
          x: pt.x,
          y: pt.y,
          w: 0,
          h: 0,
          cornerRadius: rectRadius,
          filled: rectFilled,
        };
        draftRef.current = draft;
        g.mode = 'draw';
        scheduleRedraw();
        break;
      }
      case 'pan':
        g.mode = 'pan';
        break;
      case 'text': {
        // Tap places a new text note — the actual text is entered in a dialog
        setTextValue('');
        setTextDraft({ pos: pt });
        g.mode = 'none';
        break;
      }
      case 'erase': {
        // Sweep erase: shapes under the pointer are removed as it moves
        g.mode = 'erase';
        g.moved = false;
        g.pressedSelectedText = false;
        eraseStrokeRef.current = { erasedIds: new Set(), lastPoint: pt };
        eraseAt(pt);
        scheduleRedraw();
        break;
      }
      case 'select': {
        // 1) resize handles of the current selection
        const current = shapesRef.current;
        const sel = selectedId ? current.find((s) => s.id === selectedId) : null;
        const stage = stageRef.current;
        const canvas = canvasRef.current;
        if (sel && stage && canvas) {
          const rect = stage.getBoundingClientRect();
          const corners = getBoundsCorners(getShapeBounds(sel, canvas.width, canvas.height));
          for (let i = 0; i < 4; i++) {
            const hx = rect.left + corners[i].x * rect.width;
            const hy = rect.top + corners[i].y * rect.height;
            if (Math.hypot(e.clientX - hx, e.clientY - hy) <= HANDLE_VISUAL_PX + 4) {
              g.mode = 'resize';
              g.moved = false;
              g.startShape = sel;
              g.startBounds = getShapeBounds(sel, canvas.width, canvas.height);
              g.anchor = corners[(i + 2) % 4];
              return;
            }
          }
        }
        // 2) shape hit test (topmost first)
        if (canvas && stage) {
          const rect = stage.getBoundingClientRect();
          const tolerance = rect.width > 0
            ? HIT_TOLERANCE_PX * (canvas.width / rect.width)
            : 8;
          const hit = findShapeAt(current, pt, canvas.width, canvas.height, tolerance);
          if (hit) {
            // Tap on an already-selected text shape → open its text editor
            g.pressedSelectedText = hit.type === 'text' && hit.id === selectedId;
            g.moved = false;
            setSelectedId(hit.id);
            g.mode = 'move';
            g.startShape = hit;
            return;
          }
        }
        setSelectedId(null);
        g.mode = 'none';
        break;
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gestureRef.current;

    if (g.mode === 'pinch' && pointersRef.current.size >= 2) {
      const pts = [...pointersRef.current.values()];
      const s = g.pinchStart!;
      const d = Math.max(dist(pts[0], pts[1]), 1);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const newZoom = clamp(s.zoom * (d / s.dist), MIN_ZOOM, MAX_ZOOM);
      zoomAt(mid, newZoom);
      return;
    }

    const pt = getNormalizedPoint(e.clientX, e.clientY);
    if (!pt || !g.startPoint) return;

    switch (g.mode) {
      case 'draw': {
        const draft = draftRef.current;
        if (!draft) break;
        if (draft.type === 'rect') {
          draft.w = pt.x - g.startPoint.x;
          draft.h = pt.y - g.startPoint.y;
        } else if (draft.type === 'line') {
          draft.points[1] = pt;
        } else {
          const last = draft.points[draft.points.length - 1];
          if (!last || dist(last, pt) > 0.0015) draft.points.push(pt);
        }
        scheduleRedraw();
        break;
      }
      case 'erase': {
        const eraseState = eraseStrokeRef.current;
        if (!eraseState) break;
        // Interpolate samples along the movement so fast sweeps don't skip
        // over thin shapes between two pointer events.
        const last = eraseState.lastPoint;
        const steps = Math.max(1, Math.ceil(dist(pt, last) / ERASE_SAMPLE_STEP));
        for (let i = 1; i <= steps; i++) {
          const s = i / steps;
          eraseAt({ x: last.x + (pt.x - last.x) * s, y: last.y + (pt.y - last.y) * s });
        }
        eraseState.lastPoint = pt;
        scheduleRedraw();
        break;
      }
      case 'move': {
        const orig = g.startShape!;
        const dx = pt.x - g.startPoint.x;
        const dy = pt.y - g.startPoint.y;
        if (!g.moved && dist(pt, g.startPoint) > 0.004) g.moved = true;
        applyShapes(shapesRef.current.map((s) =>
          s.id === orig.id ? moveShape(orig, dx, dy) : s
        ));
        break;
      }
      case 'resize': {
        const orig = g.startShape!;
        const anchor = g.anchor!;
        const from = g.startBounds!;
        const to: Bounds = {
          minX: Math.min(anchor.x, pt.x),
          minY: Math.min(anchor.y, pt.y),
          maxX: Math.max(anchor.x, pt.x),
          maxY: Math.max(anchor.y, pt.y),
        };
        if (to.maxX - to.minX < 1e-4 || to.maxY - to.minY < 1e-4) break;
        g.moved = true;
        applyShapes(shapesRef.current.map((s) =>
          s.id === orig.id ? scaleShape(orig, from, to) : s
        ));
        break;
      }
      case 'pan': {
        const last = g.startClient!;
        setZoomPan(zoomRef.current, {
          x: panRef.current.x + (e.clientX - last.x),
          y: panRef.current.y + (e.clientY - last.y),
        });
        g.startClient = { x: e.clientX, y: e.clientY };
        break;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    const g = gestureRef.current;

    if (g.mode === 'pinch') {
      if (pointersRef.current.size >= 2) {
        // A finger lifted but pinch continues — rebase from the remaining pair
        beginPinch();
      } else {
        g.mode = 'none';
        // snap back to 1x when fully zoomed out
        if (zoomRef.current < 1.05) resetZoom();
      }
      if (pointersRef.current.size === 0) pinchLingerRef.current = false;
      return;
    }

    switch (g.mode) {
      case 'draw': {
        const final = finalizeDraft();
        if (final) {
          const next = [...shapesRef.current, final];
          applyShapes(next);
          pushHistory(next);
          // Auto-switch to Select so the freshly drawn shape can be
          // moved/resized immediately (freehand pen keeps drawing).
          if (final.type === 'line' || final.type === 'rect') {
            setTool('select');
            setSelectedId(final.id);
          }
        } else {
          scheduleRedraw();
        }
        break;
      }
      case 'erase': {
        // One undo entry per eraser sweep (not per erased shape)
        const eraseState = eraseStrokeRef.current;
        eraseStrokeRef.current = null;
        if (eraseState && eraseState.erasedIds.size > 0) {
          pushHistory(shapesRef.current);
          setSelectedId(null);
        }
        scheduleRedraw();
        break;
      }
      case 'move': {
        // Tap (no drag) on an already-selected text shape → edit its text
        if (g.pressedSelectedText && !g.moved) {
          const s = g.startShape;
          if (s && s.type === 'text') {
            setTextValue(s.text);
            setTextDraft({ pos: { x: s.x, y: s.y }, id: s.id });
          }
        } else if (g.moved) {
          pushHistory(shapesRef.current);
        }
        break;
      }
      case 'resize': {
        if (g.moved) pushHistory(shapesRef.current);
        break;
      }
    }

    g.mode = 'none';
    if (pointersRef.current.size === 0) pinchLingerRef.current = false;
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 0) pinchLingerRef.current = false;
    const g = gestureRef.current;
    if (g.mode === 'draw') {
      draftRef.current = null;
      scheduleRedraw();
    }
    if (g.mode === 'erase') {
      const eraseState = eraseStrokeRef.current;
      eraseStrokeRef.current = null;
      if (eraseState && eraseState.erasedIds.size > 0) {
        pushHistory(shapesRef.current);
        setSelectedId(null);
      }
      scheduleRedraw();
    }
    g.mode = 'none';
  };

  // ------------------------------------------------------- shape mutations ---
  const selectedShape = selectedId ? shapes.find((s) => s.id === selectedId) : null;

  const updateSelected = useCallback((patch: Partial<StrokeShape> | Partial<RectShape> | Partial<TextShape>) => {
    if (!selectedId) return;
    const next = shapesRef.current.map((s) =>
      s.id === selectedId ? { ...s, ...patch, updatedAt: Date.now() } as AnnotationShape : s
    );
    applyShapes(next);
    pushHistory(next);
  }, [selectedId, applyShapes, pushHistory]);

  const pickColor = (c: string) => {
    setColor(c);
    if (selectedShape) updateSelected({ color: c });
  };
  const pickThickness = (v: number) => {
    // Remember the thickness for the active drawing tool…
    setToolThickness((prev) => ({ ...prev, [tool]: v } as typeof prev));
    // …and restyle the selected shape (if any)
    if (selectedShape && selectedShape.type !== 'text') updateSelected({ thickness: v });
  };
  const pickTextSize = (v: number) => {
    setTextSize(v);
    if (selectedShape && selectedShape.type === 'text') updateSelected({ fontSize: v });
  };
  const pickLineStyle = (s: LineStyle) => {
    setLineStyle(s);
    if (selectedShape && selectedShape.type === 'line') updateSelected({ style: s });
  };
  const pickRectRadius = (r: number) => {
    setRectRadius(r);
    if (selectedShape && selectedShape.type === 'rect') updateSelected({ cornerRadius: r });
  };
  const toggleRectFilled = () => {
    const next = !rectFilled;
    setRectFilled(next);
    if (selectedShape && selectedShape.type === 'rect') updateSelected({ filled: next });
  };

  // ------------------------------------------------------------- text tool ---
  const commitTextDraft = () => {
    const draft = textDraft;
    const value = textValue.trim();
    setTextDraft(null);
    if (!draft) return;

    // Editing an existing text shape
    if (draft.id) {
      const existing = shapesRef.current.find((s) => s.id === draft.id);
      if (!existing) return;
      if (!value) {
        // Cleared the text field → remove the shape
        const next = shapesRef.current.filter((s) => s.id !== draft.id);
        applyShapes(next);
        pushHistory(next);
        setSelectedId(null);
        return;
      }
      if (existing.type === 'text' && existing.text === value) return;
      const next = shapesRef.current.map((s) =>
        s.id === draft.id ? ({ ...s, text: value, updatedAt: Date.now() } as AnnotationShape) : s
      );
      applyShapes(next);
      pushHistory(next);
      // Auto-switch to Select so the text can be moved/resized immediately
      setTool('select');
      setSelectedId(draft.id);
      return;
    }

    // New text shape at the tapped position
    if (!value) return;
    const shape: TextShape = {
      id: generateShapeId(),
      type: 'text',
      color,
      thickness: 0,
      opacity: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      x: draft.pos.x,
      y: draft.pos.y,
      text: value,
      fontSize: textSize,
    };
    const next = [...shapesRef.current, shape];
    applyShapes(next);
    pushHistory(next);
    // Auto-switch to Select so the new text can be moved/resized immediately
    setTool('select');
    setSelectedId(shape.id);
  };

  // ------------------------------------------------------------ save/close ---
  // Line pattern (smooth/straight/ripple/dashed/dotted) applies to the
  // LINE tool only — pen/highlight are always smooth freehand strokes.
  const isLineContext = tool === 'line' || (selectedShape !== null && selectedShape.type === 'line');
  const isRectContext = tool === 'rect' || (selectedShape !== null && selectedShape.type === 'rect');
  const isTextSelection = selectedShape !== null && selectedShape.type === 'text';
  // Style controls are meaningless for navigation/erase tools with no selection
  const showStyleGroup =
    tool === 'pen' || tool === 'line' || tool === 'rect' ||
    tool === 'text' || selectedShape !== null;
  // The thickness popover becomes a font-size popover for text
  const isTextSizing = selectedShape ? selectedShape.type === 'text' : tool === 'text';
  const thicknessSliderValue = selectedShape && selectedShape.type !== 'text'
    ? selectedShape.thickness
    : activeThickness;
  const textSizeSliderValue = isTextSelection ? (selectedShape as TextShape).fontSize : textSize;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await savePageAnnotations(mushafType, page, shapesRef.current);
      savedIndexRef.current = historyIndexRef.current;
      setDirty(false);
      toast({ title: t('annotationsSaved'), description: `${t('page')} ${page}` });
      onClose(true);
    } catch (error) {
      console.error('[AnnotationEditor] save failed', error);
      toast({ title: t('saveFailed'), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = useCallback(() => {
    if (dirty && !window.confirm(t('unsavedChangesExit'))) return;
    onClose(false);
  }, [dirty, onClose, t]);

  // Escape closes; ctrl+z/y for desktop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose, undo, redo]);

  // --------------------------------------------------------------- render ---
  const toolButton = (key: Tool, Icon: typeof Pen, label: string) => (
    <button
      key={key}
      onClick={() => { setTool(key); setSelectedId(null); setPopover(null); }}
      title={label}
      className={cn(
        'p-2 sm:p-2.5 rounded-lg transition-colors',
        tool === key
          ? 'bg-emerald-600 text-white shadow'
          : 'text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
      )}
    >
      <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
    </button>
  );

  const disabledUndo = historyIndex <= 0;
  const disabledRedo = historyIndex >= historyRef.current.length - 1;

  return (
    <div
      className="fixed inset-0 z-[200] bg-[#FBF9F4] dark:bg-gray-950 flex flex-col select-none"
      style={{
        // Respect notches / status bar / Android gesture-nav area
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* ---------------------------------------------------------- header */}
      <header className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-emerald-800 dark:bg-emerald-950 text-[#F2E3BB] shadow z-10">
        <button
          onClick={handleClose}
          className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 transition-colors"
          title={t('close')}
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm sm:text-base font-bold truncate">{t('editPage')}</div>
          <div className="text-[10px] sm:text-xs opacity-80">
            {t('page')} {page} · {shapes.length} {t('annotationsCount')}
          </div>
        </div>

        <button onClick={undo} disabled={disabledUndo} title={t('undo')}
          className={cn('p-1.5 sm:p-2 rounded-lg hover:bg-white/10 transition-colors', disabledUndo && 'opacity-40 cursor-not-allowed')}>
          <Undo2 className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <button onClick={redo} disabled={disabledRedo} title={t('redo')}
          className={cn('p-1.5 sm:p-2 rounded-lg hover:bg-white/10 transition-colors', disabledRedo && 'opacity-40 cursor-not-allowed')}>
          <Redo2 className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <button onClick={resetZoom} title={t('resetZoom')}
          className="px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg hover:bg-white/10 transition-colors text-xs sm:text-sm font-semibold tabular-nums">
          {Math.round(zoom * 100)}% <Maximize2 className="inline w-3.5 h-3.5 sm:w-4 sm:h-4 -mt-0.5" />
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || !annotationsLoaded}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold transition-colors',
            'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow',
            (isSaving || !annotationsLoaded) && 'opacity-60 cursor-not-allowed'
          )}
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          <span className="hidden sm:inline">{t('save')}</span>
        </button>
      </header>

      {/* ------------------------------------------------------ canvas area */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!imageReady && !imgError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
          </div>
        )}

        {imgError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <Eraser className="w-12 h-12 text-emerald-600" />
            <p className="text-emerald-800 dark:text-emerald-200 font-semibold">
              {t('failedToLoadImage')}
            </p>
          </div>
        )}

        {isTextMushaf ? (
          /* Text mushafs: render the page exactly like the reader slide
             (same max-width + paddings, isFullscreen like the reader's
             always-enlarged text pages) so saved drawings align with the
             same lines when reading. */
          <div className="absolute inset-0 flex items-start justify-center">
            <div className="w-full max-w-7xl px-3 md:px-6">
              <div className="w-full px-2 md:px-4">
                <div
                  ref={stageRef}
                  className="relative"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'top center',
                  }}
                  // Neutralize TartelPage's internal touch handlers
                  // (long-press ayah selection) — the editor's container
                  // handles all gestures via pointer events.
                  onTouchStartCapture={(e) => e.stopPropagation()}
                  onTouchMoveCapture={(e) => e.stopPropagation()}
                  onTouchEndCapture={(e) => e.stopPropagation()}
                  onTouchCancelCapture={(e) => e.stopPropagation()}
                >
                  <TartelPage
                    pageNumber={page}
                    mushafType={mushafType as 'tarteel' | 'tajweed'}
                    isFullscreen
                  />
                  <canvas
                    ref={canvasRef}
                    className={cn(
                      'absolute inset-0 w-full h-full',
                      tool === 'select' ? 'cursor-default' : tool === 'pan' ? 'cursor-grab' : tool === 'erase' ? 'cursor-cell' : 'cursor-crosshair'
                    )}
                    style={{ visibility: imageReady ? 'visible' : 'hidden' }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            ref={stageRef}
            className="relative shadow-xl bg-white"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              visibility: displaySrc ? 'visible' : 'hidden',
            }}
          >
            <img
              ref={imgRef}
              src={displaySrc ?? undefined}
              alt={`page ${page}`}
              draggable={false}
              onLoad={handleImageLoad}
              onError={() => setImgError(true)}
              className="block max-w-full object-contain"
              style={{
                WebkitUserDrag: 'none',
                maxHeight: availableHeight && availableHeight > 120 ? availableHeight - 12 : 'calc(100dvh - 190px)',
              } as React.CSSProperties}
            />
            <canvas
              ref={canvasRef}
              className={cn(
                'absolute inset-0 w-full h-full',
                tool === 'select' ? 'cursor-default' : tool === 'pan' ? 'cursor-grab' : tool === 'erase' ? 'cursor-cell' : 'cursor-crosshair'
              )}
              style={{ visibility: imageReady ? 'visible' : 'hidden' }}
            />
          </div>
        </div>
        )}

        {imageReady && shapes.length === 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-2xl bg-emerald-700/90 text-white text-xs sm:text-sm shadow pointer-events-none max-w-[94%] text-center">
            {t('annotationEditorHint')}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------ bottom bar */}
      <div className="relative z-20 bg-white dark:bg-gray-900 border-t border-emerald-200 dark:border-emerald-800 shadow-lg">
        {/* popover backdrop */}
        {popover && (
          <div className="fixed inset-0 z-10" onPointerDown={(e) => { e.stopPropagation(); setPopover(null); }} />
        )}

        {popover && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-emerald-200 dark:border-emerald-700 p-3 w-[280px]">
            {popover === 'color' && (
              <div>
                <div className="text-sm font-semibold mb-2 text-emerald-800 dark:text-emerald-200">{t('color')}</div>
                <div className="grid grid-cols-7 gap-2 mb-3">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() => pickColor(c)}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-transform',
                        color.toLowerCase() === c ? 'border-emerald-600 scale-110' : 'border-black/10'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-emerald-800 dark:text-emerald-200">{t('customColor')}</span>
                  <input
                    type="color"
                    value={color.startsWith('#') ? color : '#ef4444'}
                    onChange={(e) => pickColor(e.target.value)}
                    className="w-10 h-8 rounded cursor-pointer bg-transparent"
                  />
                </div>
              </div>
            )}

            {popover === 'thickness' && isTextSizing && (
              <div>
                <div className="text-sm font-semibold mb-2 text-emerald-800 dark:text-emerald-200">{t('fontSize')}</div>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={15} max={120} step={5}
                    value={Math.round(textSizeSliderValue * 1000)}
                    onChange={(e) => pickTextSize(parseFloat(e.target.value) / 1000)}
                    className="flex-1 accent-emerald-600"
                  />
                  <div className="w-14 h-14 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/40 overflow-hidden">
                    <span
                      className="font-bold leading-none"
                      style={{
                        fontSize: `${Math.min(42, Math.max(10, textSizeSliderValue * 300))}px`,
                        color,
                      }}
                    >
                      أA
                    </span>
                  </div>
                </div>
              </div>
            )}

            {popover === 'thickness' && !isTextSizing && (
              <div>
                <div className="text-sm font-semibold mb-2 text-emerald-800 dark:text-emerald-200">{t('thickness')}</div>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={1} max={30} step={0.5}
                    value={Math.round(thicknessSliderValue * 1000 * 10) / 10}
                    onChange={(e) => pickThickness(parseFloat(e.target.value) / 1000)}
                    className="flex-1 accent-emerald-600"
                  />
                  <div className="w-14 h-14 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/40">
                    <div
                      className="rounded-full"
                      style={{ width: `${Math.max(4, thicknessSliderValue * 300)}px`, height: `${Math.max(4, thicknessSliderValue * 300)}px`, backgroundColor: color }}
                    />
                  </div>
                </div>
              </div>
            )}

            {popover === 'style' && (
              <div>
                <div className="text-sm font-semibold mb-2 text-emerald-800 dark:text-emerald-200">{t('lineStyle')}</div>
                <div className="flex flex-col gap-1">
                  {LINE_STYLES.map((s) => (
                    <button
                      key={s}
                      onClick={() => pickLineStyle(s)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                        lineStyle === s
                          ? 'bg-emerald-600 text-white'
                          : 'text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                      )}
                    >
                      <LineStylePreview style={s} />
                      <span className="text-sm font-medium">{t(`lineStyle_${s}` as const)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {popover === 'rect' && (
              <div>
                <div className="text-sm font-semibold mb-2 text-emerald-800 dark:text-emerald-200">{t('cornerRadius')}</div>
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={rectRadius}
                    onChange={(e) => pickRectRadius(parseFloat(e.target.value))}
                    className="flex-1 accent-emerald-600"
                  />
                  <div
                    className="w-10 h-10 border-[3px]"
                    style={{
                      borderColor: color,
                      borderRadius: `${rectRadius * 50}%`,
                    }}
                  />
                </div>
                <button
                  onClick={toggleRectFilled}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors',
                    rectFilled ? 'bg-emerald-600 text-white' : 'text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                  )}
                >
                  <span className="text-sm font-medium">{t('filledShape')}</span>
                  {rectFilled && <Check className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Groups wrap to multiple rows on narrow phones so every tool stays visible */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2.5 px-1.5 sm:px-2 py-1.5 sm:py-2">
          {/* Navigation: select & pan next to each other */}
          <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-xl bg-emerald-50 dark:bg-emerald-900/40">
            {toolButton('select', MousePointer2, t('toolSelect'))}
            {toolButton('pan', Hand, t('toolPan'))}
          </div>

          {/* Freehand: pen & text */}
          <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-xl bg-emerald-50 dark:bg-emerald-900/40">
            {toolButton('pen', Pen, t('toolPen'))}
            {toolButton('text', Type, t('toolText'))}
          </div>

          {/* Shapes: line & rectangle */}
          <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-xl bg-emerald-50 dark:bg-emerald-900/40">
            {toolButton('line', Minus, t('toolLine'))}
            {toolButton('rect', Square, t('toolRect'))}
          </div>

          {/* Style controls: color, thickness/size, contextual options */}
          {showStyleGroup && (
          <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-xl bg-emerald-50 dark:bg-emerald-900/40">
            {/* color */}
            <button
              onClick={() => setPopover(popover === 'color' ? null : 'color')}
              title={t('color')}
              className="p-2 sm:p-2.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
            >
              <span
                className="block w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-black/10 shadow-inner"
                style={{ backgroundColor: color }}
              />
            </button>
            {/* thickness / font size */}
            <button
              onClick={() => setPopover(popover === 'thickness' ? null : 'thickness')}
              title={isTextSizing ? t('fontSize') : t('thickness')}
              className={cn('p-2 sm:p-2.5 rounded-lg text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50', popover === 'thickness' && 'bg-emerald-100 dark:bg-emerald-900/50')}
            >
              <Diameter className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            {/* line pattern — Line tool only */}
            {isLineContext && (
              <button
                onClick={() => setPopover(popover === 'style' ? null : 'style')}
                title={t('lineStyle')}
                className={cn('p-2 sm:p-2.5 rounded-lg text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50', popover === 'style' && 'bg-emerald-100 dark:bg-emerald-900/50')}
              >
                <Waves className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
            {/* rect options */}
            {isRectContext && (
              <button
                onClick={() => setPopover(popover === 'rect' ? null : 'rect')}
                title={t('cornerRadius')}
                className={cn('p-2 sm:p-2.5 rounded-lg text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50', popover === 'rect' && 'bg-emerald-100 dark:bg-emerald-900/50')}
              >
                <div
                  className="w-5 h-5 sm:w-6 sm:h-6 border-[2.5px] border-current"
                  style={{ borderRadius: `${rectRadius * 50}%` }}
                />
              </button>
            )}
            {/* edit selected text */}
            {isTextSelection && (
              <button
                onClick={() => {
                  const s = selectedShape as TextShape;
                  setTextValue(s.text);
                  setTextDraft({ pos: { x: s.x, y: s.y }, id: s.id });
                }}
                title={t('editText')}
                className={cn('p-2 sm:p-2.5 rounded-lg text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50')}
              >
                <Type className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
          </div>
          )}

          {/* Eraser — own group, last in the row so it sits at the far left in RTL */}
          <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-xl bg-emerald-50 dark:bg-emerald-900/40">
            {toolButton('erase', Eraser, t('toolErase'))}
          </div>
        </div>

        {/* Text input dialog (text tool) */}
        {textDraft && (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-emerald-200 dark:border-emerald-700 p-4 w-full max-w-sm">
              <div className="text-base font-bold mb-2 text-emerald-800 dark:text-emerald-200">
                {textDraft.id ? t('editText') : t('addText')}
              </div>
              <textarea
                autoFocus
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                rows={3}
                dir="auto"
                placeholder={t('enterText')}
                className="w-full rounded-lg border border-emerald-300 dark:border-emerald-600 bg-white dark:bg-gray-900 p-2 text-base text-emerald-900 dark:text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => setTextDraft(null)}
                  className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium hover:opacity-90"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={commitTextDraft}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow"
                >
                  {t('save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
