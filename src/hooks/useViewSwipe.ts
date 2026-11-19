import { useRef } from "react";
import type { TouchEvent } from "react";

export type SwipeDirection = "left" | "right";

interface SwipeHandlers {
  onTouchStart: (e: TouchEvent<HTMLElement>) => void;
  onTouchEnd: (e: TouchEvent<HTMLElement>) => void;
}

/**
 * Detects horizontal swipe gestures on touch screens and reports the
 * physical direction ("left" or "right" — the way the finger moved).
 *
 * Deliberately conservative so normal usage is unaffected:
 * - Vertical movement wins: a gesture must be clearly horizontal
 *   (>= 2.5x more horizontal than vertical) to count, so scrolling —
 *   even slightly diagonal — never triggers a swipe.
 * - Requires a decisive move (>= 80px) within a short time (< 500ms),
 *   so taps, slow drags and tiny jitters never trigger a swipe.
 *
 * Attach the returned handlers to the container that should be
 * swipeable; the caller decides what "left"/"right" means (e.g.
 * mirrored in RTL layouts).
 */
export function useViewSwipe(onSwipe: (direction: SwipeDirection) => void): SwipeHandlers {
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const onTouchStart = (e: TouchEvent<HTMLElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    startRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
  };

  const onTouchEnd = (e: TouchEvent<HTMLElement>) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;

    const touch = e.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const dt = Date.now() - start.t;

    // Horizontal must dominate decisively and the move must be long:
    // this keeps vertical scrolling (even slightly diagonal, common in
    // narrow lists) and taps from ever triggering a swipe.
    if (dt > 500) return;
    if (Math.abs(dx) < 80) return;
    if (Math.abs(dx) < Math.abs(dy) * 2.5) return;

    onSwipe(dx < 0 ? "left" : "right");
  };

  return { onTouchStart, onTouchEnd };
}
