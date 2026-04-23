# Lendstead - Frontend

Live dashboard for the Lendstead island civilization. Vite + React + TanStack Query, polling the Lendstead backend every 3s. Deploys to Railway as a static preview.

## Stack
- Vite 5 + React 18 + TypeScript (strict)
- TanStack Query v5 for polling
- Canvas-rendered procedural island (no map libs)
- Zero runtime deps beyond react + tanstack

## Contract with backend
Frontend talks to these endpoints:
- `GET /api/world` - civ header + resources/infra
- `GET /api/npcs` - all NPCs with lane/role/status
- `GET /api/logs?cycle=N` - decision feed
- `GET /api/events?since=ISO` - event stream (reserved for v2)
- `POST /api/cycle/advance` - advance to next cycle
- `POST /api/decisions` - leader decisions (used by Sr/Jr Claudes, not the UI)

## Local dev
```bash
npm install
VITE_API_URL=http://localhost:3000 npm run dev
```

Open http://localhost:5173.

## Railway deploy

1. Create new service in the `lendstead` project, connect this repo's `/frontend` subfolder.
2. Set env var `VITE_API_URL` to the backend's public URL (e.g. `https://backend-production-01bb.up.railway.app`).
3. Railway runs `npm run build` then `npm start` - `start` is `vite preview --host 0.0.0.0 --port $PORT`.
4. Generate a domain for the service; the dashboard is live.

## Layout
```
+------------- Header -------------+
|  Map   |  Stats  |     NPCs      |
|        |---------|               |
|        |  Logs   |               |
+----------------------------------+
```
Grid collapses to single-column on narrow viewports.

## Files
- `src/main.tsx` - QueryClient (3s refetch)
- `src/App.tsx` - layout + error states
- `src/api.ts` - typed fetch wrapper
- `src/types.ts` - shared types with backend
- `src/hooks/useWorld.ts` - useWorld/useNPCs/useLogs/useAdvanceCycle
- `src/components/IslandMap.tsx` - canvas island + NPC markers
- `src/components/StatsCard.tsx` - cycle/pop + resources/infra + advance button
- `src/components/NPCList.tsx` - lane-colored roster
- `src/components/LogsFeed.tsx` - decision feed, lane-colored border
