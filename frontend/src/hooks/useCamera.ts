import { useCallback, useEffect, useRef, useState } from 'react';

// Viewport camera for the tile grid. Stores zoom + pan offset in tile
// units. Supports: wheel zoom (centered on cursor), drag pan, and
// animated focus on a tile or entity.
//
// World coords (tile x,y) are converted to screen by:
//   sx = offsetX + (tileX - cam.x) * TS * cam.zoom
// where TS is the base tile size.

export interface CameraState {
  x: number;       // camera center in tile units (world-space)
  y: number;
  zoom: number;    // 1 = fit-to-grid baseline
}

interface AnimTarget {
  toX: number;
  toY: number;
  toZoom: number;
  fromX: number;
  fromY: number;
  fromZoom: number;
  startedAt: number;
  durationMs: number;
}

const ANIM_MS = 700;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 3.0;

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function useCamera(defaultX: number, defaultY: number) {
  const [cam, setCam] = useState<CameraState>({
    x: defaultX,
    y: defaultY,
    zoom: 1,
  });
  const camRef = useRef(cam);
  camRef.current = cam;

  const animRef = useRef<AnimTarget | null>(null);

  // Drive animation frame
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const anim = animRef.current;
      if (anim) {
        const now = performance.now();
        const t = Math.min(1, (now - anim.startedAt) / anim.durationMs);
        const e = ease(t);
        setCam({
          x: anim.fromX + (anim.toX - anim.fromX) * e,
          y: anim.fromY + (anim.toY - anim.fromY) * e,
          zoom: anim.fromZoom + (anim.toZoom - anim.fromZoom) * e,
        });
        if (t >= 1) animRef.current = null;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const focus = useCallback((tileX: number, tileY: number, zoom = 2.0) => {
    const now = performance.now();
    const current = camRef.current;
    animRef.current = {
      fromX: current.x,
      fromY: current.y,
      fromZoom: current.zoom,
      toX: tileX,
      toY: tileY,
      toZoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)),
      startedAt: now,
      durationMs: ANIM_MS,
    };
  }, []);

  const resetView = useCallback(() => {
    const now = performance.now();
    const current = camRef.current;
    animRef.current = {
      fromX: current.x,
      fromY: current.y,
      fromZoom: current.zoom,
      toX: defaultX,
      toY: defaultY,
      toZoom: 1,
      startedAt: now,
      durationMs: ANIM_MS,
    };
  }, [defaultX, defaultY]);

  const panBy = useCallback((dxTiles: number, dyTiles: number) => {
    animRef.current = null;
    setCam((c) => ({ ...c, x: c.x + dxTiles, y: c.y + dyTiles }));
  }, []);

  const zoomAt = useCallback(
    (factor: number, pivotTileX: number, pivotTileY: number) => {
      animRef.current = null;
      setCam((c) => {
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, c.zoom * factor));
        if (nextZoom === c.zoom) return c;
        // Keep pivot tile under cursor after zoom: translate so pivot stays fixed
        const ratio = c.zoom / nextZoom;
        return {
          zoom: nextZoom,
          x: pivotTileX + (c.x - pivotTileX) * ratio,
          y: pivotTileY + (c.y - pivotTileY) * ratio,
        };
      });
    },
    [],
  );

  return { cam, focus, resetView, panBy, zoomAt };
}
