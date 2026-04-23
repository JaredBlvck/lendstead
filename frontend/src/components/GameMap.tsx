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

interface Props {
  world: World;
  npcs: NPC[];
}

export function GameMap({ world, npcs }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);

  // Backend is source of truth for events now.
  const eventsQuery = useEvents();
  const firstSeenRef = useRef<Map<number, number>>(new Map());
  const [displayEvents, setDisplayEvents] = useState<DisplayEvent[]>([]);

  // Rebuild display events whenever the /api/events payload changes, and
  // also tick once per second so expired events drop out of the list.
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

  // Terrain: prefer backend-shipped grid; fall back to deterministic client
  // generation keyed by civ_name while backend is warming up.
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

  // NPC target positions: use backend x/y if all alive NPCs have them,
  // otherwise seed client-side. Backend has them as of migration 002 so
  // this branch is the common path now.
  const targetPositions = useMemo<NPCPosition[]>(() => {
    const alive = npcs.filter((n) => n.alive);
    const withXY = alive.filter((n) => n.x != null && n.y != null);
    if (withXY.length === alive.length && alive.length > 0) {
      return withXY.map((n) => ({ id: n.id, x: n.x!, y: n.y! }));
    }
    return seedPositions(npcs, tiles, world.cycle);
  }, [npcs, tiles, world.cycle]);

  const positions = useAnimatedPositions(npcs, targetPositions);

  // Container resize observer
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

    const TS = Math.min(size.w / GRID_W, size.h / GRID_H);
    const offsetX = (size.w - GRID_W * TS) / 2;
    const offsetY = (size.h - GRID_H * TS) / 2;

    let raf = 0;

    const draw = () => {
      const now = performance.now();
      ctx.resetTransform();
      ctx.scale(dpr, dpr);

      // Backdrop
      ctx.fillStyle = '#07090f';
      ctx.fillRect(0, 0, size.w, size.h);

      // Tiles
      for (const tile of tiles) {
        const px = offsetX + tile.x * TS;
        const py = offsetY + tile.y * TS;
        const base = TILE_COLORS[tile.type];
        ctx.fillStyle = base;
        ctx.fillRect(px, py, TS + 0.5, TS + 0.5);

        if (tile.type !== 'water') {
          const shade = Math.min(0.25, Math.max(0, tile.height - 0.3) * 0.6);
          ctx.fillStyle = `rgba(255,255,255,${shade})`;
          ctx.fillRect(px, py, TS + 0.5, TS + 0.5);
        }

        if (tile.type === 'water') {
          const ripple = 0.04 + 0.03 * Math.sin(now / 800 + tile.x * 0.4 + tile.y * 0.5);
          ctx.fillStyle = `rgba(94,234,212,${ripple})`;
          ctx.fillRect(px, py, TS + 0.5, TS + 0.5);
        }
      }

      // Claimed territory overlay (derived from infra.claims strings)
      const claims = Array.isArray(world.infrastructure.claims)
        ? (world.infrastructure.claims as string[])
        : [];
      if (claims.length > 0) {
        const centers: Array<[number, number]> = [];
        claims.forEach((c, i) => {
          if (/NW|northwest/i.test(c)) centers.push([GRID_W * 0.28, GRID_H * 0.28]);
          else if (/inland|belt|center/i.test(c)) centers.push([GRID_W * 0.5, GRID_H * 0.5]);
          else if (/S[- ]?flank|south|ridge/i.test(c)) centers.push([GRID_W * 0.45, GRID_H * 0.82]);
          else centers.push([GRID_W * (0.35 + 0.3 * (i % 2)), GRID_H * (0.3 + 0.25 * i)]);
        });
        ctx.save();
        centers.forEach(([cx, cy]) => {
          const gx = offsetX + cx * TS;
          const gy = offsetY + cy * TS;
          const radius = TS * 5;
          const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
          grad.addColorStop(0, 'rgba(94,234,212,0.22)');
          grad.addColorStop(1, 'rgba(94,234,212,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(gx - radius, gy - radius, radius * 2, radius * 2);
        });
        ctx.restore();
      }

      // Events layer: storms below NPCs (atmospheric), discoveries & threats above
      const storms = displayEvents.filter((e) => e.kind === 'storm');
      for (const e of storms) {
        const life = Math.min(1, (now - e.seenAt) / e.lifespanMs);
        const fade = life < 0.15 ? life / 0.15 : life > 0.85 ? (1 - life) / 0.15 : 1;
        const cx = offsetX + e.x * TS;
        const cy = offsetY + e.y * TS;
        const radius = e.radius * TS;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, `rgba(10,14,26,${0.55 * fade})`);
        grad.addColorStop(1, 'rgba(10,14,26,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

        // Rain particles
        ctx.strokeStyle = `rgba(180,200,220,${0.35 * fade})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < 40; i++) {
          const a = (i * 73 + now / 30) % (radius * 2);
          const rx = cx - radius + a;
          const ry = cy - radius + ((i * 41 + now / 25) % (radius * 2));
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - 2, ry + 4);
          ctx.stroke();
        }
      }

      // NPCs
      positions.forEach((pos, id) => {
        const npc = npcs.find((n) => n.id === id);
        if (!npc || !npc.alive) return;
        const px = offsetX + (pos.x + 0.5) * TS;
        const py = offsetY + (pos.y + 0.5) * TS;
        const color = npc.lane === 'sr' ? '#fb923c' : '#38bdf8';
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1;
        const size = Math.max(3, TS * 0.32);
        drawNPCShape(ctx, npc.role, px, py, size);

        if (npc.skill >= 6) {
          ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.2 * Math.sin(now / 500 + id)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(px, py, size + 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      // Discovery + threat pings above NPCs
      for (const e of displayEvents) {
        if (e.kind === 'storm') continue;
        const life = Math.min(1, (now - e.seenAt) / e.lifespanMs);
        const pulse = 0.5 + 0.5 * Math.sin(now / 200);
        const cx = offsetX + (e.x + 0.5) * TS;
        const cy = offsetY + (e.y + 0.5) * TS;
        const ringRadius = TS * (1.2 + life * 2.5);
        const color = e.kind === 'discovery' ? '94,234,212' : '239,68,68';
        ctx.strokeStyle = `rgba(${color},${(1 - life) * 0.9})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();

        if (e.kind === 'discovery') {
          ctx.fillStyle = `rgba(${color},${0.6 + 0.4 * pulse})`;
          drawStar(ctx, cx, cy, TS * 0.4, 5);
        } else {
          ctx.fillStyle = `rgba(${color},${0.6 + 0.4 * pulse})`;
          ctx.beginPath();
          ctx.arc(cx, cy, TS * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = `rgba(230,237,243,${(1 - life) * 0.9})`;
        ctx.font = '11px ui-sans-serif, system-ui';
        ctx.fillText(e.label, cx + 10, cy - 4);
      }

      // Hover tile readout
      if (hoverTile) {
        const t = tileAt(tiles, hoverTile.x, hoverTile.y);
        if (t) {
          const px = offsetX + hoverTile.x * TS;
          const py = offsetY + hoverTile.y * TS;
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);

          ctx.fillStyle = 'rgba(11,14,20,0.9)';
          ctx.fillRect(8, 8, 120, 34);
          ctx.fillStyle = '#e6edf3';
          ctx.font = '11px ui-sans-serif, system-ui';
          ctx.fillText(`${t.type} (${t.x},${t.y})`, 16, 22);
          ctx.fillStyle = '#8b96a8';
          ctx.fillText(`elev ${t.height.toFixed(2)}`, 16, 36);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [tiles, size, positions, npcs, displayEvents, hoverTile, world.infrastructure]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const TS = Math.min(size.w / GRID_W, size.h / GRID_H);
    const offsetX = (size.w - GRID_W * TS) / 2;
    const offsetY = (size.h - GRID_H * TS) / 2;
    const tx = Math.floor((e.clientX - rect.left - offsetX) / TS);
    const ty = Math.floor((e.clientY - rect.top - offsetY) / TS);
    if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) {
      setHoverTile(null);
    } else {
      setHoverTile({ x: tx, y: ty });
    }
  };

  return (
    <div className="card map">
      <h2>
        Lendstead - Map
        <span className="legend">
          <span className="dot sr" /> Sr
          <span className="dot jr" /> Jr
          <span style={{ marginLeft: 10, color: 'var(--text-dim)', fontSize: 10 }}>
            events: {displayEvents.length}
          </span>
        </span>
      </h2>
      <div
        ref={containerRef}
        style={{ position: 'relative', flex: 1, minHeight: 0 }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
          onMouseMove={onMove}
          onMouseLeave={() => setHoverTile(null)}
        />
      </div>
    </div>
  );
}

function drawNPCShape(
  ctx: CanvasRenderingContext2D,
  role: string,
  x: number,
  y: number,
  s: number,
) {
  const isScout = /scout|watcher|runner|guard|sentry|ranger/i.test(role);
  const isForager = /forager|fisher|gatherer|shore|tide|trader/i.test(role);
  const isBuilder = /carpenter|toolmaker|potter|organizer|field|planner|prospector|hauler|healer|inland|marker/i.test(role);

  ctx.beginPath();
  if (isScout) {
    ctx.moveTo(x, y - s);
    ctx.lineTo(x - s * 0.85, y + s * 0.7);
    ctx.lineTo(x + s * 0.85, y + s * 0.7);
    ctx.closePath();
  } else if (isBuilder) {
    ctx.rect(x - s * 0.8, y - s * 0.8, s * 1.6, s * 1.6);
  } else if (isForager) {
    ctx.arc(x, y, s, 0, Math.PI * 2);
  } else {
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s, y);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
}

function drawStar(
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
