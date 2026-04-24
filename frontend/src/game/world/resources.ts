// Resource node management. Harvesting depletes a node and schedules it
// for respawn after a configured cooldown.

import type { ResourceNode, WorldState } from './worldState';

export function addResourceNode(w: WorldState, node: ResourceNode): WorldState {
  return { ...w, resource_nodes: [...w.resource_nodes, node] };
}

export function depleteNode(
  w: WorldState,
  nodeId: string,
  respawnInCycles = 5,
): WorldState {
  const nodes = w.resource_nodes.map((n) =>
    n.id === nodeId
      ? { ...n, depleted: true, respawn_at_cycle: w.cycle + respawnInCycles }
      : n,
  );
  return { ...w, resource_nodes: nodes };
}

// Tick all resource nodes - revive any whose respawn_at_cycle has arrived.
export function tickResourceNodes(w: WorldState): WorldState {
  const nodes = w.resource_nodes.map((n) =>
    n.depleted && n.respawn_at_cycle != null && n.respawn_at_cycle <= w.cycle
      ? { ...n, depleted: false, respawn_at_cycle: undefined }
      : n,
  );
  return { ...w, resource_nodes: nodes };
}

export function availableNodesIn(w: WorldState, regionId: string): ResourceNode[] {
  return w.resource_nodes.filter((n) => n.region_id === regionId && !n.depleted);
}
