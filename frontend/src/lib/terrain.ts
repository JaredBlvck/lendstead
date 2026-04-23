// Procedural tile-grid terrain. Deterministic from civ_name so the island
// stays stable across reloads. Lives client-side as a fallback; if the
// backend ships a `terrain` JSONB we prefer that so all players see the
// same island.

export type TileType = 'water' | 'beach' | 'plains' | 'forest' | 'mountain';

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  height: number; // 0..1 elevation, drives shading
}

export const GRID_W = 40;
export const GRID_H = 24;

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cheap value noise via random grid + bilinear smoothing. Not perlin but
// reads island-y once we map it to elevation bands.
function valueNoise(rand: () => number, cols: number, rows: number) {
  const grid: number[][] = [];
  for (let y = 0; y < rows; y++) {
    grid.push([]);
    for (let x = 0; x < cols; x++) {
      grid[y].push(rand());
    }
  }
  // One pass box smoothing
  const smoothed: number[][] = [];
  for (let y = 0; y < rows; y++) {
    smoothed.push([]);
    for (let x = 0; x < cols; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
            sum += grid[ny][nx];
            count++;
          }
        }
      }
      smoothed[y].push(sum / count);
    }
  }
  return smoothed;
}

export function generateTerrain(civName: string): Tile[] {
  const rand = mulberry32(hashStr(civName));
  const noise = valueNoise(rand, GRID_W, GRID_H);
  const cx = GRID_W / 2;
  const cy = GRID_H / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  const tiles: Tile[] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      // Radial falloff from center keeps it island-shaped
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      const elev = Math.max(0, noise[y][x] * 1.1 - dist * 0.85);

      let type: TileType;
      if (elev < 0.08) type = 'water';
      else if (elev < 0.14) type = 'beach';
      else if (elev < 0.4) type = 'plains';
      else if (elev < 0.62) type = 'forest';
      else type = 'mountain';

      tiles.push({ x, y, type, height: elev });
    }
  }
  return tiles;
}

export function tileAt(tiles: Tile[], x: number, y: number): Tile | undefined {
  if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return undefined;
  return tiles[y * GRID_W + x];
}

export const TILE_COLORS: Record<TileType, string> = {
  water: '#13263d',
  beach: '#caa86c',
  plains: '#4e5f36',
  forest: '#2d4a28',
  mountain: '#6b6b72',
};
