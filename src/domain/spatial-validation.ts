import {
  actionGrantsClue,
  engineVersionAtLeast,
  SPATIAL_CAPABILITY,
  SPATIAL_MIN_ENGINE_VERSION,
  spatialLeafId,
} from "./spatial";
import type {
  Diagnostic,
  EditorProject,
  ModuleDefinition,
  SpatialCondition,
  SpatialEffect,
} from "./types";

type PushDiagnostic = (
  level: Diagnostic["level"],
  path: string,
  message: string,
) => void;

function sameScalarType(left: unknown, right: unknown): boolean {
  if (typeof left !== typeof right) return false;
  if (typeof left === "number") {
    return Number.isInteger(left) && Number.isInteger(right);
  }
  return ["boolean", "string"].includes(typeof left);
}

function validateCondition(
  condition: SpatialCondition,
  module: ModuleDefinition,
  path: string,
  push: PushDiagnostic,
  depth = 0,
): void {
  const spatial = module.spatial!;
  if (depth > 8) {
    push("error", path, "条件树超过 8 层");
    return;
  }
  if (condition.op === "all" || condition.op === "any") {
    condition.conditions.forEach((child, index) =>
      validateCondition(child, module, `${path}.conditions[${index}]`, push, depth + 1),
    );
    return;
  }
  if (condition.op === "not") {
    validateCondition(condition.condition, module, `${path}.condition`, push, depth + 1);
    return;
  }
  if (condition.op === "flag") {
    const flags = module.initial_state.flags;
    if (!(condition.flag_id in flags)) {
      push("error", `${path}.flag_id`, `条件旗标 ${condition.flag_id} 未预声明`);
    } else if (!sameScalarType(flags[condition.flag_id], condition.value)) {
      push("error", `${path}.value`, "旗标条件值必须与初始声明类型一致");
    }
    return;
  }
  if (condition.op === "clue") {
    if (!(condition.clue_id in module.clues)) {
      push("error", `${path}.clue_id`, `条件线索 ${condition.clue_id} 不存在`);
    }
    return;
  }
  if (condition.op === "clock") {
    if (!(condition.clock_id in module.initial_state.case_clocks)) {
      push("error", `${path}.clock_id`, `条件时钟 ${condition.clock_id} 不存在`);
    }
    return;
  }
  if (condition.op === "completed") {
    const point = spatial.points[condition.point_id];
    if (!point || !(condition.action_id in point.actions)) {
      push(
        "error",
        `${path}.action_id`,
        `completed 引用了不存在的调查动作 ${condition.point_id}/${condition.action_id}`,
      );
    }
    return;
  }
  if (condition.op !== "item") return;
  const item = spatial.items[condition.item_id];
  if (!item) {
    push("error", `${path}.item_id`, `条件物品 ${condition.item_id} 不存在`);
    return;
  }
  for (const [state, minimum] of Object.entries(condition.minimum_states)) {
    const definition = item.states[state];
    if (!definition) {
      push("error", `${path}.minimum_states.${state}`, `物品状态 ${state} 不存在`);
    } else if (minimum < definition.minimum || minimum > definition.maximum) {
      push(
        "error",
        `${path}.minimum_states.${state}`,
        `状态门槛 ${minimum} 超出 ${definition.minimum}–${definition.maximum}`,
      );
    }
  }
}

function validateEffect(
  effect: SpatialEffect,
  module: ModuleDefinition,
  path: string,
  push: PushDiagnostic,
): void {
  const spatial = module.spatial!;
  if (effect.kind === "grant_clue" && !(effect.clue_id in module.clues)) {
    push("error", `${path}.clue_id`, `效果线索 ${effect.clue_id} 不存在`);
  } else if (effect.kind === "give_item") {
    const item = spatial.items[effect.item_id];
    if (!item) {
      push("error", `${path}.item_id`, `效果物品 ${effect.item_id} 不存在`);
    } else if (Object.keys(item.states).length > 0 && effect.quantity !== 1) {
      push("error", `${path}.quantity`, "带数值状态的物品每个实例数量必须为 1");
    }
  } else if (effect.kind === "adjust_item_state") {
    const item = spatial.items[effect.item_id];
    if (!item || !(effect.state in item.states)) {
      push(
        "error",
        `${path}.state`,
        `效果引用不存在的物品状态 ${effect.item_id}/${effect.state}`,
      );
    }
  } else if (effect.kind === "set_flag") {
    const flags = module.initial_state.flags;
    if (!(effect.flag_id in flags)) {
      push("error", `${path}.flag_id`, `效果旗标 ${effect.flag_id} 未预声明`);
    } else if (!sameScalarType(flags[effect.flag_id], effect.value)) {
      push("error", `${path}.value`, "旗标效果值必须与初始声明类型一致");
    }
  } else if (effect.kind === "reveal_scene" && !(effect.scene_id in module.scenes)) {
    push("error", `${path}.scene_id`, `揭示场景 ${effect.scene_id} 不存在`);
  } else if (
    effect.kind === "unlock_connection" &&
    !(effect.connection_id in spatial.connections)
  ) {
    push("error", `${path}.connection_id`, `解锁通路 ${effect.connection_id} 不存在`);
  } else if (effect.kind === "advance_clock") {
    if (!(effect.clock_id in module.initial_state.case_clocks)) {
      push("error", `${path}.clock_id`, `推进时钟 ${effect.clock_id} 不存在`);
      return;
    }
    const definition = module.initial_state.case_clock_definitions?.[effect.clock_id];
    if (!Number.isInteger(definition?.max)) {
      push("error", `${path}.clock_id`, "调查代价时钟必须声明整数 max，确保实际可支付");
    }
    if (effect.clock_id === "clue_clarity" || definition?.time_advance) {
      push(
        "error",
        `${path}.clock_id`,
        "自动线索/时间型时钟由本体推进，不可作为空间效果重复推进",
      );
    }
  }
}

export function spatialEssentialStatus(
  module: ModuleDefinition,
  clueId: string,
): "missing" | "valid" | "unsafe" {
  if (!module.spatial) return "missing";
  const producers: boolean[] = [];
  for (const point of Object.values(module.spatial.points)) {
    for (const action of Object.values(point.actions)) {
      const success = actionGrantsClue(action, clueId, "success");
      const failure = actionGrantsClue(action, clueId, "failure");
      if (success || failure) {
        producers.push(success && (action.check === null || failure));
      }
    }
  }
  if (!producers.length) return "missing";
  return producers.some(Boolean) ? "valid" : "unsafe";
}

export function validateSpatial(project: EditorProject, push: PushDiagnostic): void {
  const { module, manifest } = project;
  const spatial = module.spatial;
  if (!spatial) return;
  if (!manifest.capabilities.includes(SPATIAL_CAPABILITY)) {
    push(
      "error",
      "manifest.capabilities",
      "启用 spatial 必须声明 spatial_investigation capability",
    );
  }
  if (!engineVersionAtLeast(manifest.min_engine_version, SPATIAL_MIN_ENGINE_VERSION)) {
    push(
      "error",
      "manifest.min_engine_version",
      `Spatial v1 需要 min_engine_version >= ${SPATIAL_MIN_ENGINE_VERSION}`,
    );
  }

  const labels = new Map<string, string>();
  for (const [itemId, item] of Object.entries(spatial.items)) {
    const previous = labels.get(item.label);
    if (previous) {
      push(
        "error",
        `module.spatial.items.${itemId}.label`,
        `物品 label 与 ${previous} 重复，会导致旧背包绑定歧义`,
      );
    } else {
      labels.set(item.label, itemId);
    }
    for (const [stateId, state] of Object.entries(item.states)) {
      const path = `module.spatial.items.${itemId}.states.${stateId}`;
      if (state.minimum > state.maximum) {
        push(
          "error",
          `${path}.minimum`,
          `状态下限 ${state.minimum} 不能大于上限 ${state.maximum}`,
        );
      }
      if (state.initial < state.minimum || state.initial > state.maximum) {
        push(
          "error",
          `${path}.initial`,
          `状态初值 ${state.initial} 必须在 ${state.minimum}–${state.maximum} 范围内`,
        );
      }
    }
  }

  for (const [sceneId, node] of Object.entries(spatial.nodes)) {
    const path = `module.spatial.nodes.${sceneId}`;
    if (!(sceneId in module.scenes)) {
      push("error", path, `节点引用了不存在的场景 ${sceneId}`);
    }
    const seen = new Set([sceneId]);
    let parent = node.parent_scene_id;
    let validParentChain = true;
    while (parent) {
      if (!(parent in module.scenes) || seen.has(parent) || seen.size >= 8) {
        push(
          "error",
          `${path}.parent_scene_id`,
          `场景父链非法、循环或超过 8 层：${sceneId}`,
        );
        validParentChain = false;
        break;
      }
      seen.add(parent);
      const ancestor = spatial.nodes[parent];
      if (!ancestor || ancestor.kind !== "container") {
        push("error", `${path}.parent_scene_id`, `父场景必须声明为 container：${parent}`);
        validParentChain = false;
        break;
      }
      parent = ancestor.parent_scene_id;
    }
    if (node.kind === "container") {
      const entry = node.entry_scene_id ? spatial.nodes[node.entry_scene_id] : undefined;
      if (!entry || entry.kind !== "location") {
        push("error", `${path}.entry_scene_id`, "容器入口必须指向已声明的叶场景");
      } else if (validParentChain) {
        const parents = new Set<string>();
        let current = entry.parent_scene_id;
        while (current && !parents.has(current)) {
          parents.add(current);
          const ancestor = spatial.nodes[current];
          if (!ancestor) {
            push("error", `${path}.entry_scene_id`, `容器入口父链缺少节点声明：${current}`);
            break;
          }
          current = ancestor.parent_scene_id;
        }
        if (!parents.has(sceneId)) {
          push("error", `${path}.entry_scene_id`, "容器入口必须是该容器的子孙叶场景");
        }
      }
    } else if (node.entry_scene_id) {
      push("error", `${path}.entry_scene_id`, "location 不可声明 entry_scene_id");
    }
  }

  const pairs = new Set<string>();
  for (const [connectionId, connection] of Object.entries(spatial.connections)) {
    const path = `module.spatial.connections.${connectionId}`;
    if (
      !(connection.source_scene_id in module.scenes) ||
      !(connection.target_scene_id in module.scenes)
    ) {
      push("error", path, "通路起点或终点场景不存在");
    }
    if (connection.source_scene_id === connection.target_scene_id) {
      push("error", `${path}.target_scene_id`, "通路不能连接自身");
    }
    const source = spatialLeafId(spatial, connection.source_scene_id);
    const target = spatialLeafId(spatial, connection.target_scene_id);
    if (source === target && connection.source_scene_id !== connection.target_scene_id) {
      push("error", `${path}.target_scene_id`, "容器入口解析后不能连接自身");
    }
    const directions = [`${source}→${target}`];
    if (connection.bidirectional) directions.push(`${target}→${source}`);
    for (const pair of directions) {
      if (pairs.has(pair)) {
        push("error", path, `同一有向通路重复定义：${pair.replace("→", " → ")}`);
      }
      pairs.add(pair);
    }
    validateCondition(connection.visible_when, module, `${path}.visible_when`, push);
    validateCondition(connection.requires, module, `${path}.requires`, push);
    connection.costs.forEach((effect, index) => {
      validateEffect(effect, module, `${path}.costs[${index}]`, push);
      if (effect.delta >= 0) {
        push("error", `${path}.costs[${index}].delta`, "通路代价必须是负数状态消耗");
      }
    });
    const legacyPairs = directions.filter((pair) => {
      const [from, to] = pair.split("→");
      return module.scenes[from]?.exits.includes(to);
    });
    if (legacyPairs.length) {
      push(
        "advice",
        path,
        "同一方向同时保留旧 exits；本体以显式通路为准，不会生成绕过门锁的开放连接",
      );
    }
  }

  for (const [pointId, point] of Object.entries(spatial.points)) {
    const path = `module.spatial.points.${pointId}`;
    if (!(point.scene_id in module.scenes)) {
      push("error", `${path}.scene_id`, `调查点场景 ${point.scene_id} 不存在`);
    } else if (spatial.nodes[point.scene_id]?.kind === "container") {
      push("error", `${path}.scene_id`, "调查点只能属于 location 叶场景，不能属于容器");
    }
    validateCondition(point.visible_when, module, `${path}.visible_when`, push);
    for (const [actionId, action] of Object.entries(point.actions)) {
      const actionPath = `${path}.actions.${actionId}`;
      validateCondition(action.requires, module, `${actionPath}.requires`, push);
      for (const branch of ["success", "failure"] as const) {
        action[branch].forEach((effect, index) =>
          validateEffect(effect, module, `${actionPath}.${branch}[${index}]`, push),
        );
      }
    }
  }
}
