import type {
  EditorProject,
  ModuleDefinition,
  SpatialAction,
  SpatialCondition,
  SpatialConnection,
  SpatialDefinition,
  SpatialEffect,
  SpatialEntityKind,
  SpatialItemDefinition,
  SpatialNode,
  SpatialPoint,
} from "./types";

export const SPATIAL_CAPABILITY = "spatial_investigation" as const;
export const SPATIAL_MIN_ENGINE_VERSION = "1.1.0";
export const SPATIAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export function engineVersionAtLeast(value: string, minimum: string): boolean {
  const parse = (input: string) =>
    input
      .split(/[-+]/, 1)[0]
      .split(".")
      .map((part) => Number.parseInt(part, 10));
  const actual = parse(value);
  const expected = parse(minimum);
  if (actual.some((part) => !Number.isFinite(part))) return false;
  for (let index = 0; index < Math.max(actual.length, expected.length); index++) {
    const difference = (actual[index] ?? 0) - (expected[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return true;
}

export function defaultNode(): SpatialNode {
  return {
    kind: "location",
    parent_scene_id: null,
    entry_scene_id: null,
    hidden: false,
  };
}

export function alwaysCondition(value = true): SpatialCondition {
  return { op: "always", value };
}

export function createSpatialDefinition(
  scenes: ModuleDefinition["scenes"],
): SpatialDefinition {
  return {
    version: 1,
    nodes: Object.fromEntries(
      Object.keys(scenes).map((id) => [id, defaultNode()]),
    ),
    connections: {},
    points: {},
    items: {},
  };
}

export function enableSpatial(project: EditorProject): EditorProject {
  if (project.module.format_version !== "2.0") return project;
  const next = structuredClone(project);
  if (!next.module.spatial) {
    next.module.spatial = createSpatialDefinition(next.module.scenes);
  }
  next.manifest.format_version = "2.0";
  next.manifest.capabilities = [
    ...new Set([...next.manifest.capabilities, SPATIAL_CAPABILITY]),
  ];
  if (
    !engineVersionAtLeast(
      next.manifest.min_engine_version,
      SPATIAL_MIN_ENGINE_VERSION,
    )
  ) {
    next.manifest.min_engine_version = SPATIAL_MIN_ENGINE_VERSION;
  }
  return next;
}

export function spatialLeafId(spatial: SpatialDefinition, sceneId: string): string {
  const node = spatial.nodes[sceneId];
  return node?.kind === "container" && node.entry_scene_id
    ? node.entry_scene_id
    : sceneId;
}

export function isLeafScene(spatial: SpatialDefinition, sceneId: string): boolean {
  return spatial.nodes[sceneId]?.kind !== "container";
}

export function containerDescendants(
  spatial: SpatialDefinition,
  containerId: string,
): Set<string> {
  const descendants = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, node] of Object.entries(spatial.nodes)) {
      if (
        node.parent_scene_id &&
        (node.parent_scene_id === containerId ||
          descendants.has(node.parent_scene_id)) &&
        !descendants.has(id)
      ) {
        descendants.add(id);
        changed = true;
      }
    }
  }
  return descendants;
}

export function spatialReachableTargets(
  module: ModuleDefinition,
  sceneId: string,
): string[] {
  const targets = [...(module.scenes[sceneId]?.exits ?? [])];
  const spatial = module.spatial;
  if (!spatial) return targets;
  const node = spatial.nodes[sceneId];
  if (node?.entry_scene_id) targets.push(node.entry_scene_id);
  if (node?.parent_scene_id) targets.push(node.parent_scene_id);
  for (const connection of Object.values(spatial.connections)) {
    const source = spatialLeafId(spatial, connection.source_scene_id);
    const target = spatialLeafId(spatial, connection.target_scene_id);
    if (source === sceneId) targets.push(target);
    if (connection.bidirectional && target === sceneId) targets.push(source);
  }
  return targets;
}

export function nextSpatialId(
  prefix: string,
  entities: Record<string, unknown>,
): string {
  let index = Object.keys(entities).length + 1;
  while (`${prefix}_${index}` in entities) index += 1;
  return `${prefix}_${index}`;
}

export function createConnection(project: EditorProject): SpatialConnection {
  const sceneIds = Object.keys(project.module.scenes);
  return {
    source_scene_id: sceneIds[0] ?? "",
    target_scene_id: sceneIds[1] ?? sceneIds[0] ?? "",
    bidirectional: false,
    visible_when: alwaysCondition(),
    requires: alwaysCondition(),
    remember_unlock: false,
    costs: [],
  };
}

export function createAction(): SpatialAction {
  return {
    intent: "examine",
    aliases: [],
    requires: alwaysCondition(),
    check: null,
    repeat: false,
    success: [],
    failure: [],
  };
}

export function createPoint(project: EditorProject): SpatialPoint {
  const spatial = project.module.spatial!;
  const sceneId =
    Object.keys(project.module.scenes).find((id) => isLeafScene(spatial, id)) ?? "";
  return {
    scene_id: sceneId,
    name: "新调查点",
    description: "",
    visible_when: alwaysCondition(),
    actions: { examine: createAction() },
  };
}

export function createItem(project: EditorProject): SpatialItemDefinition {
  return { label: `新物品 ${Object.keys(project.module.spatial?.items ?? {}).length + 1}`, states: {} };
}

function rewriteKey<T>(
  entities: Record<string, T>,
  id: string,
  next: string | null,
): void {
  if (!(id in entities)) return;
  if (next) {
    const value = entities[id];
    delete entities[id];
    entities[next] = value;
  } else {
    delete entities[id];
  }
}

function rewriteCondition(
  condition: SpatialCondition,
  kind: SpatialEntityKind | "scene" | "clue" | "flag" | "clock",
  id: string,
  next: string | null,
  parentId?: string,
): SpatialCondition | null {
  if (condition.op === "all" || condition.op === "any") {
    const conditions: SpatialCondition[] = [];
    for (const child of condition.conditions) {
      const rewritten = rewriteCondition(child, kind, id, next, parentId);
      if (rewritten === null) return null;
      conditions.push(rewritten);
    }
    return conditions.length ? { ...condition, conditions } : alwaysCondition(false);
  }
  if (condition.op === "not") {
    const child = rewriteCondition(condition.condition, kind, id, next, parentId);
    return child ? { op: "not", condition: child } : null;
  }
  if (condition.op === "flag" && kind === "flag" && condition.flag_id === id) {
    return next ? { ...condition, flag_id: next } : null;
  }
  if (condition.op === "clock" && kind === "clock" && condition.clock_id === id) {
    return next ? { ...condition, clock_id: next } : null;
  }
  if (condition.op === "clue" && kind === "clue" && condition.clue_id === id) {
    return next ? { ...condition, clue_id: next } : null;
  }
  if (condition.op === "item") {
    if (kind === "item" && condition.item_id === id) {
      return next ? { ...condition, item_id: next } : null;
    }
    if (kind === "state" && condition.item_id === parentId) {
      const states = { ...condition.minimum_states };
      if (id in states) {
        if (!next) return null;
        states[next] = states[id];
        delete states[id];
      }
      return { ...condition, minimum_states: states };
    }
  }
  if (condition.op === "completed") {
    if (kind === "point" && condition.point_id === id) {
      return next ? { ...condition, point_id: next } : null;
    }
    if (
      kind === "action" &&
      condition.point_id === parentId &&
      condition.action_id === id
    ) {
      return next ? { ...condition, action_id: next } : null;
    }
  }
  return condition;
}

function rewriteEffect(
  effect: SpatialEffect,
  kind: SpatialEntityKind | "scene" | "clue" | "flag" | "clock",
  id: string,
  next: string | null,
  parentId?: string,
): SpatialEffect | null {
  if (effect.kind === "grant_clue" && kind === "clue" && effect.clue_id === id) {
    return next ? { ...effect, clue_id: next } : null;
  }
  if (
    (effect.kind === "give_item" || effect.kind === "adjust_item_state") &&
    kind === "item" &&
    effect.item_id === id
  ) {
    return next ? { ...effect, item_id: next } : null;
  }
  if (
    effect.kind === "adjust_item_state" &&
    kind === "state" &&
    effect.item_id === parentId &&
    effect.state === id
  ) {
    return next ? { ...effect, state: next } : null;
  }
  if (effect.kind === "set_flag" && kind === "flag" && effect.flag_id === id) {
    return next ? { ...effect, flag_id: next } : null;
  }
  if (effect.kind === "advance_clock" && kind === "clock" && effect.clock_id === id) {
    return next ? { ...effect, clock_id: next } : null;
  }
  if (effect.kind === "reveal_scene" && kind === "scene" && effect.scene_id === id) {
    return next ? { ...effect, scene_id: next } : null;
  }
  if (
    effect.kind === "unlock_connection" &&
    kind === "connection" &&
    effect.connection_id === id
  ) {
    return next ? { ...effect, connection_id: next } : null;
  }
  return effect;
}

export function rewriteSpatialReferences(
  spatial: SpatialDefinition,
  kind: SpatialEntityKind | "scene" | "clue" | "flag" | "clock",
  id: string,
  next: string | null,
  parentId?: string,
): void {
  if (kind === "scene") {
    const removedConnections = next
      ? []
      : Object.entries(spatial.connections)
          .filter(([, connection]) =>
            [connection.source_scene_id, connection.target_scene_id].includes(id),
          )
          .map(([connectionId]) => connectionId);
    const removedPoints = next
      ? []
      : Object.values(spatial.points)
          .filter((point) => point.scene_id === id)
          .map((point) =>
            Object.entries(spatial.points).find(([, candidate]) => candidate === point)![0],
          );
    rewriteKey(spatial.nodes, id, next);
    for (const node of Object.values(spatial.nodes)) {
      if (node.parent_scene_id === id) node.parent_scene_id = next;
      if (node.entry_scene_id === id) node.entry_scene_id = next;
    }
    for (const connectionId of removedConnections) {
      rewriteSpatialReferences(spatial, "connection", connectionId, null);
    }
    for (const pointId of removedPoints) {
      rewriteSpatialReferences(spatial, "point", pointId, null);
    }
    for (const connection of Object.values(spatial.connections)) {
      if (connection.source_scene_id === id) connection.source_scene_id = next!;
      if (connection.target_scene_id === id) connection.target_scene_id = next!;
    }
    for (const point of Object.values(spatial.points)) {
      if (point.scene_id === id && next) point.scene_id = next;
    }
  } else if (kind === "connection") {
    rewriteKey(spatial.connections, id, next);
  } else if (kind === "point") {
    rewriteKey(spatial.points, id, next);
  } else if (kind === "item") {
    rewriteKey(spatial.items, id, next);
  } else if (kind === "action" && parentId && spatial.points[parentId]) {
    rewriteKey(spatial.points[parentId].actions, id, next);
  } else if (kind === "state" && parentId && spatial.items[parentId]) {
    rewriteKey(spatial.items[parentId].states, id, next);
  }

  for (const connection of Object.values(spatial.connections)) {
    const visible = rewriteCondition(connection.visible_when, kind, id, next, parentId);
    const requires = rewriteCondition(connection.requires, kind, id, next, parentId);
    connection.visible_when = visible ?? alwaysCondition(false);
    connection.requires = requires ?? alwaysCondition(false);
    connection.costs = connection.costs
      .map((effect) => rewriteEffect(effect, kind, id, next, parentId))
      .filter(
        (effect): effect is Extract<SpatialEffect, { kind: "adjust_item_state" }> =>
          effect?.kind === "adjust_item_state",
      );
  }
  for (const point of Object.values(spatial.points)) {
    const visible = rewriteCondition(point.visible_when, kind, id, next, parentId);
    point.visible_when = visible ?? alwaysCondition(false);
    for (const action of Object.values(point.actions)) {
      const requires = rewriteCondition(action.requires, kind, id, next, parentId);
      action.requires = requires ?? alwaysCondition(false);
      action.success = action.success
        .map((effect) => rewriteEffect(effect, kind, id, next, parentId))
        .filter((effect): effect is SpatialEffect => effect !== null);
      action.failure = action.failure
        .map((effect) => rewriteEffect(effect, kind, id, next, parentId))
        .filter((effect): effect is SpatialEffect => effect !== null);
    }
  }
}

export function sceneRemovalBlockers(
  project: EditorProject,
  sceneId: string,
): string[] {
  const spatial = project.module.spatial;
  if (!spatial) return [];
  const blockers: string[] = [];
  for (const [id, node] of Object.entries(spatial.nodes)) {
    if (id === sceneId) continue;
    if (node.parent_scene_id === sceneId) {
      blockers.push(`子场景 ${id} 仍以它为父场景`);
    }
    if (node.entry_scene_id === sceneId) {
      blockers.push(`容器 ${id} 仍以它为入口`);
    }
  }
  return blockers;
}

export function actionGrantsClue(
  action: SpatialAction,
  clueId: string,
  branch: "success" | "failure",
): boolean {
  return action[branch].some(
    (effect) => effect.kind === "grant_clue" && effect.clue_id === clueId,
  );
}
