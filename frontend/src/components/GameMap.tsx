import { useEffect, useMemo, useRef, useState } from 'react';
import type { NPC, World } from '../types';
import {
  GRID_W,
  GRID_H,
  TILE_COLORS,
  generateTerrain,
  tileAt,
  type Tile,
} from '../lib/terrain';
import { seedPositions, type NPCPosition } from '../lib/positions';
import { useAnimatedPositions } from '../hooks/useAnimatedPositions';
import { useEvents } from '../hooks/useWorld';
import { buildDisplayEvents, type DisplayEvent } from '../lib/events';
import { useCamera } from '../hooks/useCamera';
import {
  classify,
  drawAvatar,
  drawTree,
  drawRock,
  drawStructure,
  tileAssetsSeed,
} from '../lib/sprites';

interface Props {
  world: World;
  npcs: NPC[];
}

// Structure placements derived from infrastructure keys. Each claim/item
// maps to an approximate tile on the grid so the island feels inhabited.
function layoutStructures(
  infra: Record<string, unknown>,
): Array<{ key: string; x: number; y: number; label: string }> {
  const out: Array<{ key: string; x: number; y: number; label: string }> = [];
  const push = (key: string, x: number, y: number, label: string) =>
    out.push({ key, x, y, label });

  // Central camp cluster
  push('central_camp', GRID_W * 0.5, GRID_H * 0.5, 'camp');

  const keys = Object.keys(infra || {});
  const entries = Object.entries(infra || {});

  for (const [k, v] of entries) {
    const valStr = Array.isArray(v) ? v.join(' ') : String(v);
    if (/palisade/i.test(k)) push(k, GRID_W * 0.45, GRID_H * 0.85, 'palisade');
    else if (/storm_shelter/i.test(k))
      push(k, GRID_W * 0.42, GRID_H * 0.82, 'shelter');
    else if (/watch_post|n_watch/i.test(k)) push(k, GRID_W * 0.5, GRID_H * 0.25, 'watch');
    else if (/ember_spring_station|ember_spring/i.test(k)) push(k, 18, 12, 'Ember Spring');
    else if (/smithy|forge/i.test(k)) push(k, GRID_W * 0.54, GRID_H * 0.48, 'smithy');
    else if (/granary/i.test(valStr)) push('granary', GRID_W * 0.48, GRID_H * 0.48, 'granary');
    else if (/drying/i.test(k)) push(k, GRID_W * 0.52, GRID_H * 0.52, 'drying');
    else if (/cistern/i.test(valStr)) push('cistern', GRID_W * 0.5, GRID_H * 0.52, 'cistern');
  }

  // NW foothold
  const claims = Array.isArray(infra.claims) ? (infra.claims as string[]) : [];
  for (const c of claims) {
    if (/NW|northwest/i.test(c)) push('nw_foothold', GRID_W * 0.28, GRID_H * 0.28, 'NW foothold');
    if (/inland|belt/i.test(c) && !out.find((o) => o.key === 'inland_belt'))
      push('inland_belt', GRID_W * 0.55, GRID_H * 0.55, 'inland belt');
  }

  // S-ridge outpost
  if (keys.some((k) => /zones_claimed|S[- ]?ridge/i.test(k))) {
    push('s_ridge_outpost', GRID_W * 0.42, GRID_H * 0.78, 'S-ridge');
  }
  return out;
}

export function GameMap({ world, npcs }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);
  const [focusedNPCId, setFocusedNPCId] = useState<number | null>(null);
  const dragStateRef = useRef<{ x: number; y: number; camX: number; camY: number } | null>(null);

  const { cam, focus, resetView, zoomAt, panBy } = useCamera(GRID_W / 2, GRID_H / 2);

  const eventsQuery = useEvents();
  const firstSeenRef = useRef<Map<number, number>>(new Map());
  const [displayEvents, setDisplayEvents] = useState<DisplayEvent[]>([]);

  useEffect(() => {
    const rebuild = () => {
      const now = performance.now();
      const src = eventsQuery.data ?? [];
      setDisplayEvents(buildDisplayEvents(src, firstSeenRef.current, now));
    };
    rebuild();
    const id = window.setInterval(rebuild, 1000);
    return () => window.clearInterval(id);
  }, [eventsQuery.data]);

  const tiles = useMemo<Tile[]>(() => {
    if (world.terrain && world.terrain.length === GRID_W * GRID_H) {
      return world.terrain.map((t) => ({
        x: t.x,
        y: t.y,
        type: (t.type as Tile['type']) || 'plains',
        height: t.height ?? 0.3,
      }));
    }
    return generateTerrain(world.civ_name);
  }, [world.terrain, world.civ_name]);

  const targetPositions = useMemo<NPCPosition[]>(() => {
    const alive = npcs.filter((n) => n.alive);
    const withXY = alive.filter((n) => n.x != null && n.y != null);
    if (withXY.length === alive.length && alive.length > 0) {
      return withXY.map((n) => ({ id: n.id, x: n.x!, y: n.y! }));
    }
    return seedPositions(npcs, tiles, world.cycle);
  }, [npcs, tiles, world.cycle]);

  const entities = useAnimatedPositions(npcs, targetPositions);

  const structures = useMemo(
    () => layoutStructures(world.infrastructure as unknown as Record<string, unknown>),
    [world.infrastructure],
  );

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Follow focused NPC
  useEffect(() => {
    if (focusedNPCId == null) return;
    const e = entities.get(focusedNPCId);
    if (!e) return;
    // Light follow: don't re-animate every frame, but if they drift far
    // from cam center, re-focus. Check every 300ms.
    const id = window.setInterval(() => {
      const ent = entities.get(focusedNPCId);
      if (!ent) return;
      const dx = ent.x - cam.x;
      const dy = ent.y - cam.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        focus(ent.x, ent.y, cam.zoom);
      }
    }, 300);
    return () => window.clearInterval(id);
  }, [focusedNPCId, entities, cam.x, cam.y, cam.zoom, focus]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;

    const baseTS = Math.min(size.w / GRID_W, size.h / GRID_H);

    let raf = 0;

    const worldToScreen = (wx: number, wy: number) => {
      const TS = baseTS * cam.zoom;
      const sx = size.w / 2 + (wx - cam.x) * TS;
      const sy = size.h / 2 + (wy - cam.y) * TS;
      return { sx, sy, TS };
    };

    const draw = () => {
      const now = performance.now();
      ctx.resetTransform();
      ctx.scale(dpr, dpr);

      // Backdrop
      ctx.fillStyle = '#07090f';
      ctx.fillRect(0, 0, size.w, size.h);

      const TS = baseTS * cam.zoom;

      // Cull offscreen tiles for perf (zoom-in with many tiles)
      const minTX = Math.floor(cam.x - size.w / (2 * TS)) - 1;
      const maxTX = Math.ceil(cam.x + size.w / (2 * TS)) + 1;
      const minTY = Math.floor(cam.y - size.h / (2 * TS)) - 1;
      const maxTY = Math.ceil(cam.y + size.h / (2 * TS)) + 1;

      for (const tile of tiles) {
        if (tile.x < minTX || tile.x > maxTX || tile.y < minTY || tile.y > maxTY) continue;
        const { sx, sy } = worldToScreen(tile.x, tile.y);
        ctx.fillStyle = TILE_COLORS[tile.type];
        ctx.fillRect(sx, sy, TS + 0.5, TS + 0.5);

        if (tile.type !== 'water') {
          const shade = Math.min(0.25, Math.max(0, tile.height - 0.3) * 0.6);
          ctx.fillStyle = `rgba(255,255,255,${shade})`;
          ctx.fillRect(sx, sy, TS + 0.5, TS + 0.5);
        } else {
          const ripple = 0.04 + 0.03 * Math.sin(now / 800 + tile.x * 0.4 + tile.y * 0.5);
          ctx.fillStyle = `rgba(94,234,212,${ripple})`;
          ctx.fillRect(sx, sy, TS + 0.5, TS + 0.5);
        }
      }

      // Environmental assets (trees, rocks) - culled + density-limited
      if (cam.zoom >= 0.8) {
        for (const tile of tiles) {
          if (tile.x < minTX || tile.x > maxTX || tile.y < minTY || tile.y > maxTY) continue;
          const { sx, sy } = worldToScreen(tile.x + 0.5, tile.y + 0.5);
          if (tile.type === 'forest') {
            for (const asset of tileAssetsSeed(tile.x, tile.y, 0.9)) {
              drawTree(ctx, sx + asset.ox * TS, sy + asset.oy * TS, TS, asset.seed);
            }
          } else if (tile.type === 'mountain') {
            for (const asset of tileAssetsSeed(tile.x, tile.y, 0.7)) {
              drawRock(ctx, sx + asset.ox * TS, sy + asset.oy * TS, TS, asset.seed);
            }
          } else if (tile.type === 'beach') {
            // shore edge highlight
            ctx.fillStyle = 'rgba(255,230,170,0.2)';
            ctx.fillRect(sx - TS * 0.5, sy - TS * 0.5, TS, TS);
          }
        }
      }

      // Claimed-territory radial glows
      const claims = Array.isArray(world.infrastructure.claims)
        ? (world.infrastructure.claims as string[])
        : [];
      if (claims.length > 0) {
        ctx.save();
        const centers: Array<[number, number]> = [];
        claims.forEach((c, i) => {
          if (/NW|northwest/i.test(c)) centers.push([GRID_W * 0.28, GRID_H * 0.28]);
          else if (/inland|belt|center/i.test(c)) centers.push([GRID_W * 0.5, GRID_H * 0.5]);
          else if (/S[- ]?flank|south|ridge/i.test(c)) centers.push([GRID_W * 0.45, GRID_H * 0.82]);
          else centers.push([GRID_W * (0.35 + 0.3 * (i % 2)), GRID_H * (0.3 + 0.25 * i)]);
        });
        centers.forEach(([cx, cy]) => {
          const { sx, sy } = worldToScreen(cx, cy);
          const radius = TS * 5;
          const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
          grad.addColorStop(0, 'rgba(94,234,212,0.22)');
          grad.addColorStop(1, 'rgba(94,234,212,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
        });
        ctx.restore();
      }

      // Storm overlays (below sprites)
      for (const e of displayEvents) {
        if (e.kind !== 'storm') continue;
        const life = Math.min(1, (now - e.seenAt) / e.lifespanMs);
        const fade = life < 0.15 ? life / 0.15 : life > 0.85 ? (1 - life) / 0.15 : 1;
        const { sx, sy } = worldToScreen(e.x, e.y);
        const radius = e.radius * TS;
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
        grad.addColorStop(0, `rgba(10,14,26,${0.55 * fade})`);
        grad.addColorStop(1, 'rgba(10,14,26,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
        ctx.strokeStyle = `rgba(180,200,220,${0.35 * fade})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < 30; i++) {
          const a = (i * 73 + now / 30) % (radius * 2);
          const rx = sx - radius + a;
          const ry = sy - radius + ((i * 41 + now / 25) % (radius * 2));
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - 2, ry + 4);
          ctx.stroke();
        }
      }

      // Structures
      for (const s of structures) {
        const { sx, sy } = worldToScreen(s.x, s.y);
        drawStructure(ctx, sx, sy, TS, s.key, cam.zoom >= 1.1 ? s.label : undefined);
      }

      // NPC avatars (depth-sorted by y so closer sprites overlap correctly)
      const sortedEntities = Array.from(entities.entries()).sort(
        (a, b) => a[1].y - b[1].y,
      );
      for (const [id, ent] of sortedEntities) {
        const npc = npcs.find((n) => n.id === id);
        if (!npc || !npc.alive) continue;
        const { sx, sy } = worldToScreen(ent.x + 0.5, ent.y + 0.5);
        const highlighted =
          npc.skill >= 6 || focusedNPCId === id;
        drawAvatar({
          ctx,
          x: sx,
          y: sy,
          size: Math.max(10, TS * 0.85),
          lane: npc.lane,
          archetype: classify(npc.role),
          facing: ent.facing,
          phase: ent.phase,
          highlighted,
        });

        // NPC name label when zoomed in
        if (cam.zoom >= 1.6) {
          ctx.fillStyle = 'rgba(230,237,243,0.85)';
          ctx.font = '10px ui-sans-serif, system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(npc.name, sx, sy + TS * 0.55);
        }
      }

      // Leader avatars (synthetic, drawn above NPCs)
      const srLeaderPos = { x: GRID_W * 0.42, y: GRID_H * 0.78 };
      const jrLeaderPos = { x: GRID_W * 0.5, y: GRID_H * 0.5 };
      const leaderPhase = ((now + 500) % 2600) / 2600;
      const pos1 = worldToScreen(srLeaderPos.x, srLeaderPos.y);
      drawAvatar({
        ctx,
        x: pos1.sx,
        y: pos1.sy,
        size: Math.max(14, TS * 1.2),
        lane: 'sr',
        archetype: 'leader',
        facing: Math.PI / 4,
        phase: leaderPhase,
        leader: true,
      });
      ctx.fillStyle = '#fbbf24';
      ctx.font = '10px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Sr', pos1.sx, pos1.sy - TS * 0.9);

      const pos2 = worldToScreen(jrLeaderPos.x, jrLeaderPos.y);
      drawAvatar({
        ctx,
        x: pos2.sx,
        y: pos2.sy,
        size: Math.max(14, TS * 1.2),
        lane: 'jr',
        archetype: 'leader',
        facing: -Math.PI / 2,
        phase: leaderPhase,
        leader: true,
      });
      ctx.fillStyle = '#7dd3fc';
      ctx.font = '10px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Jr', pos2.sx, pos2.sy - TS * 0.9);

      // Discovery + threat pings above everything
      for (const e of displayEvents) {
        if (e.kind === 'storm') continue;
        const life = Math.min(1, (now - e.seenAt) / e.lifespanMs);
        const pulse = 0.5 + 0.5 * Math.sin(now / 200);
        const { sx, sy } = worldToScreen(e.x + 0.5, e.y + 0.5);
        const ringRadius = TS * (1.2 + life * 2.5);
        const color = e.kind === 'discovery' ? '94,234,212' : '239,68,68';
        ctx.strokeStyle = `rgba(${color},${(1 - life) * 0.9})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(${color},${0.6 + 0.4 * pulse})`;
        if (e.kind === 'discovery') drawStarPath(ctx, sx, sy, TS * 0.4, 5);
        else {
          ctx.beginPath();
          ctx.arc(sx, sy, TS * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(230,237,243,${(1 - life) * 0.9})`;
        ctx.font = '11px ui-sans-serif, system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(e.label, sx + 10, sy - 4);
      }

      // Hover tile outline + readout (fixed-position, independent of camera)
      if (hoverTile) {
        const t = tileAt(tiles, hoverTile.x, hoverTile.y);
        if (t) {
          const { sx, sy } = worldToScreen(hoverTile.x, hoverTile.y);
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + 0.5, sy + 0.5, TS - 1, TS - 1);

          ctx.fillStyle = 'rgba(11,14,20,0.9)';
          ctx.fillRect(8, 8, 140, 34);
          ctx.fillStyle = '#e6edf3';
          ctx.font = '11px ui-sans-serif, system-ui';
          ctx.textAlign = 'left';
          ctx.fillText(`${t.type} (${t.x},${t.y})`, 16, 22);
          ctx.fillStyle = '#8b96a8';
          ctx.fillText(`zoom ${cam.zoom.toFixed(2)}x`, 16, 36);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [
    tiles, size, entities, npcs, displayEvents, hoverTile, world.infrastructure,
    cam, structures, focusedNPCId,
  ]);

  // Screen->tile converter for input handlers
  const screenToTile = (sx: number, sy: number): { x: number; y: number } => {
    const baseTS = Math.min(size.w / GRID_W, size.h / GRID_H);
    const TS = baseTS * cam.zoom;
    return {
      x: (sx - size.w / 2) / TS + cam.x,
      y: (sy - size.h / 2) / TS + cam.y,
    };
  };

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Drag-pan
    const drag = dragStateRef.current;
    if (drag) {
      const baseTS = Math.min(size.w / GRID_W, size.h / GRID_H);
      const TS = baseTS * cam.zoom;
      const dxTiles = (drag.x - sx) / TS;
      const dyTiles = (drag.y - sy) / TS;
      panBy(dxTiles, dyTiles);
      dragStateRef.current = { x: sx, y: sy, camX: cam.x, camY: cam.y };
      return;
    }

    const t = screenToTile(sx, sy);
    const tx = Math.floor(t.x);
    const ty = Math.floor(t.y);
    if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) {
      setHoverTile(null);
    } else {
      setHoverTile({ x: tx, y: ty });
    }
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    dragStateRef.current = { x: sx, y: sy, camX: cam.x, camY: cam.y };
  };

  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragStateRef.current;
    dragStateRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Treat as click if moved less than 4px
    const wasClick = drag && Math.abs(drag.x - sx) < 4 && Math.abs(drag.y - sy) < 4;
    if (!wasClick) return;

    // Find NPC nearest to click in world-space
    const t = screenToTile(sx, sy);
    let nearest: { id: number; dist: number } | null = null;
    entities.forEach((ent, id) => {
      const dx = ent.x + 0.5 - t.x;
      const dy = ent.y + 0.5 - t.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (!nearest || dist < nearest.dist) nearest = { id, dist };
    });
    if (nearest && (nearest as { id: number; dist: number }).dist < 0.8) {
      const picked = nearest as { id: number; dist: number };
      const ent = entities.get(picked.id)!;
      setFocusedNPCId(picked.id);
      focus(ent.x + 0.5, ent.y + 0.5, 2.2);
    } else {
      setFocusedNPCId(null);
    }
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const pivot = screenToTile(sx, sy);
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomAt(factor, pivot.x, pivot.y);
  };

  const focusedNPC = focusedNPCId != null ? npcs.find((n) => n.id === focusedNPCId) : null;

  return (
    <div className="card map">
      <h2>
        Lendstead - Map
        <span className="legend">
          <span className="dot sr" /> Sr
          <span className="dot jr" /> Jr
          <span style={{ marginLeft: 10, color: 'var(--text-dim)', fontSize: 10 }}>
            events: {displayEvents.length} &middot; {cam.zoom.toFixed(1)}x
          </span>
        </span>
      </h2>
      <div ref={containerRef} style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            cursor: dragStateRef.current ? 'grabbing' : 'grab',
          }}
          onMouseMove={onMove}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={() => {
            setHoverTile(null);
            dragStateRef.current = null;
          }}
          onWheel={onWheel}
        />
        <div className="map-controls">
          <button onClick={() => zoomAt(1.25, cam.x, cam.y)} title="Zoom in">+</button>
          <button onClick={() => zoomAt(1 / 1.25, cam.x, cam.y)} title="Zoom out">-</button>
          <button onClick={() => { setFocusedNPCId(null); resetView(); }} title="Fit to island">
            ◌
          </button>
        </div>
        {focusedNPC && (
          <div className="focus-card">
            <div className="focus-name">{focusedNPC.name}</div>
            <div className="focus-role">
              {focusedNPC.role} &middot; Skill {focusedNPC.skill} &middot; {focusedNPC.lane.toUpperCase()}
            </div>
            <div className="focus-status">{focusedNPC.status}</div>
            <button className="focus-clear" onClick={() => setFocusedNPCId(null)}>
              release camera
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function drawStarPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  spikes: number,
) {
  const step = Math.PI / spikes;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = i * step - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}
