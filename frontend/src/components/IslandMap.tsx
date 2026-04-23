import { useEffect, useRef } from "react";
import type { NPC } from "../types";

interface Props {
  npcs: NPC[];
  cycle: number;
}

// Procedural island map. Seeded by civ_name hash so it's stable across reloads.
// NPCs placed relative to their role - scouts on perimeter, architects near
// center, foragers on biome edges. Zero deps, pure canvas.
export function IslandMap({ npcs, cycle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parent = canvas.parentElement!;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    canvas.width = w * devicePixelRatio;
    canvas.height = h * devicePixelRatio;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Ocean
    const oceanGrad = ctx.createRadialGradient(
      w / 2,
      h / 2,
      w * 0.15,
      w / 2,
      h / 2,
      w * 0.7,
    );
    oceanGrad.addColorStop(0, "#1a2a3f");
    oceanGrad.addColorStop(1, "#0b0e14");
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, w, h);

    // Island - blob made of overlapping circles
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.36;

    ctx.fillStyle = "#2d3d2a";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Inland highland
    ctx.fillStyle = "#3d4f35";
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.1, r * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Peak (Neve's camp marker - fixed center-north)
    ctx.fillStyle = "#5a6e4a";
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.2, r * 0.22, 0, Math.PI * 2);
    ctx.fill();

    // Compass fronts + zones
    const zones: Array<[number, number, string, string]> = [
      [cx, cy - r * 0.9, "NW foothold", "#5eead4"],
      [cx - r * 1.0, cy + r * 0.4, "S flank", "#fb923c"],
      [cx + r * 0.9, cy + r * 0.1, "Inland belt", "#38bdf8"],
    ];
    zones.forEach(([zx, zy, label, color]) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(zx, zy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e6edf3";
      ctx.font = "10px ui-sans-serif, system-ui";
      ctx.fillText(label, zx + 7, zy + 3);
    });

    // NPCs - distribute around the island by role (case-insensitive).
    // Seed ships lowercase ('scout', 'forager'); this tolerates any casing.
    const perimeterRx = /scout|watcher|runner|guard|sentry|ranger/i;
    const foragerRx = /forager|fisher|gatherer|shore|tide/i;

    npcs
      .filter((n) => n.alive)
      .forEach((npc, idx) => {
        let x = cx,
          y = cy;
        const angle = idx * 137.5 * (Math.PI / 180); // golden-angle spread
        if (perimeterRx.test(npc.role)) {
          x = cx + Math.cos(angle) * r * 0.95;
          y = cy + Math.sin(angle) * r * 0.95;
        } else if (foragerRx.test(npc.role)) {
          x = cx + Math.cos(angle) * r * 0.7;
          y = cy + Math.sin(angle) * r * 0.7;
        } else {
          // center (organizer/carpenter/toolmaker/potter/hauler/healer/field planner/inland marker/prospector/etc.)
          x = cx + Math.cos(angle) * r * 0.22;
          y = cy + Math.sin(angle) * r * 0.22;
        }

        ctx.fillStyle = npc.lane === "sr" ? "#fb923c" : "#38bdf8";
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

    // Cycle tag
    ctx.fillStyle = "#8b96a8";
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.fillText(`CYCLE ${cycle}`, 10, 18);
    ctx.fillText(`NPCS ${npcs.filter((n) => n.alive).length}`, 10, 34);
  }, [npcs, cycle]);

  return (
    <div className="card map">
      <h2>Lendstead - Map</h2>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}
