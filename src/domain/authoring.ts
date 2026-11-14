import type {
  Diagnostic,
  EditorProject,
  EntitySelection,
  TreeEntityKind,
} from "./types";
import { parseEditorProject } from "../features/project/project-io";
import { spatialLeafId, spatialReachableTargets } from "./spatial";
import { validateProject } from "./validation";

export const entityLabels: Record<TreeEntityKind, string> = {
  scene: "场景",
  npc: "人物",
  clue: "线索",
  ending: "结局",
};

export function reachableSceneIds(project: EditorProject): Set<string> {
  const reached = new Set<string>();
  const queue = [project.module.entry_scene_id];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (reached.has(id) || !project.module.scenes[id]) continue;
    reached.add(id);
    queue.push(
      ...spatialReachableTargets(project.module, id).filter(
        (next) => !reached.has(next),
      ),
    );
  }
  return reached;
}

export function authoringSteps(project: EditorProject) {
  const scenes = Object.values(project.module.scenes);
  const clues = Object.values(project.module.clues);
  return [
    {
      title: "写下故事的起点",
      description: "完善模组简介、开场和作者信息。",
      done: !!(
        project.manifest.description.trim() &&
        project.manifest.author.trim() &&
        project.module.opening_prompt.trim()
      ),
      selection: { kind: "manifest" } as EntitySelection,
    },
    {
      title: "连接探索路线",
      description: "写好场景，并让入口通往每个地点。",
      done:
        scenes.length > 1 &&
        scenes.every((scene) => scene.description.trim()) &&
        reachableSceneIds(project).size === scenes.length,
      selection: { kind: "graph" } as EntitySelection,
    },
    {
      title: "铺设线索与发现方式",
      description: "为重要线索安排发现规则和失败替代路径。",
      done:
        clues.length > 0 &&
        clues.every(
          (clue) => clue.initially_known || clue.discovery_rules.length > 0,
        ) &&
        (project.module.progression?.essential_clue_ids ?? []).every((id) => {
          const clue = project.module.clues[id];
          return (
            clue &&
            (clue.initially_known ||
              (clue.discovery_rules.length > 0 &&
                clue.discovery_rules.every(
                  (rule) => !rule.requires_success || !!rule.fallback,
                )))
          );
        }),
      selection: {
        kind: "clue",
        id: Object.keys(project.module.clues)[0],
      } as EntitySelection,
    },
    {
      title: "让故事有一个结局",
      description: "填写结局触发条件，再检查玩家可见内容。",
      done: Object.values(project.module.endings).some(
        (ending) => ending.trigger.trim() && ending.description.trim(),
      ),
      selection: {
        kind: "ending",
        id: Object.keys(project.module.endings)[0],
      } as EntitySelection,
    },
  ];
}

export interface StoryNode {
  id: string;
  label: string;
  x: number;
  y: number;
  entry: boolean;
  reachable: boolean;
}
export interface StoryEdge {
  from: string;
  to: string;
  label: string;
}

export function storyGraph(project: EditorProject, mode: "scene" | "clue") {
  const entries =
    mode === "scene"
      ? Object.entries(project.module.scenes).map(
          ([id, scene]) => [id, scene.name] as const,
        )
      : Object.entries(project.module.clues).map(
          ([id, clue]) => [id, clue.text] as const,
        );
  let edges: StoryEdge[];
  if (mode === "scene") {
    const explicitPairs = new Set<string>();
    const spatialEdges: StoryEdge[] = [];
    for (const connection of Object.values(project.module.spatial?.connections ?? {})) {
      const source = spatialLeafId(project.module.spatial!, connection.source_scene_id);
      const target = spatialLeafId(project.module.spatial!, connection.target_scene_id);
      const directions = [[source, target]];
      if (connection.bidirectional) directions.push([target, source]);
      for (const [from, to] of directions) {
        const pair = `${from}→${to}`;
        if (explicitPairs.has(pair)) continue;
        explicitPairs.add(pair);
        spatialEdges.push({
          from,
          to,
          label: connection.remember_unlock || connection.costs.length
            ? "显式通路 · 记住开锁/代价"
            : connection.requires.op === "always" && connection.requires.value
              ? "显式通路"
              : "显式通路 · 有条件",
        });
      }
    }
    edges = [
      ...Object.entries(project.module.scenes).flatMap(([id, scene]) =>
        scene.exits
          .filter((to) => !explicitPairs.has(`${id}→${to}`))
          .map((to) => ({ from: id, to, label: "旧出口" })),
      ),
      ...spatialEdges,
    ];
  } else {
    edges = project.module.clue_links.map((link) => ({
      from: link.from,
      to: link.to,
      label: link.reasoning,
    }));
  }
  const reached = reachableSceneIds(project);
  const layers = new Map<string, number>();
  if (mode === "scene") {
    const queue = [project.module.entry_scene_id];
    layers.set(project.module.entry_scene_id, 0);
    for (let i = 0; i < queue.length; i++) {
      for (const to of spatialReachableTargets(project.module, queue[i])) {
        if (!layers.has(to) && project.module.scenes[to]) {
          layers.set(to, (layers.get(queue[i]) ?? 0) + 1);
          queue.push(to);
        }
      }
    }
  }
  const rows = new Map<number, number>();
  const nodes: StoryNode[] = entries.map(([id, label], index) => {
    const col = mode === "scene" ? Math.min(layers.get(id) ?? 0, 5) : index % 3;
    const row = rows.get(col) ?? 0;
    rows.set(col, row + 1);
    return {
      id,
      label,
      x: 32 + col * 260,
      y: 36 + row * 130,
      entry: mode === "scene" && id === project.module.entry_scene_id,
      reachable: mode === "clue" || reached.has(id),
    };
  });
  return {
    nodes,
    edges,
    width: Math.max(550, ...nodes.map((node) => node.x + 260)),
    height: Math.max(290, ...nodes.map((node) => node.y + 130)),
  };
}

/** 编辑源码只接受已知工程容器，防止规范化静默删除未知顶层内容。 */
export function inspectProjectEdit(text: string): {
  project: EditorProject;
  diagnostics: Diagnostic[];
} {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("工程必须是 JSON 对象。");
  const record = value as Record<string, unknown>;
  const unknown = Object.keys(record).filter(
    (key) =>
      ![
        "editor_version",
        "manifest",
        "module",
        "keeperDocument",
        "theme",
        "lorebook",
        "skills",
      ].includes(key),
  );
  if (unknown.length)
    throw new Error(
      `未知工程字段：${unknown.join("、")}。自定义数据请放入 extensions。`,
    );
  if (record.editor_version !== 2)
    throw new Error(
      "源码编辑保持 editor_version 为 2；旧版工程请通过打开工程迁移。",
    );
  if (
    typeof record.keeperDocument !== "string" ||
    !record.theme ||
    typeof record.theme !== "object" ||
    Array.isArray(record.theme) ||
    !(
      record.lorebook === null ||
      (record.lorebook &&
        typeof record.lorebook === "object" &&
        !Array.isArray(record.lorebook))
    )
  )
    throw new Error(
      "请保留 keeperDocument 文本、theme 对象及 lorebook 对象或 null。",
    );
  const project = parseEditorProject(value);
  const diagnostics = validateProject(project);
  const structural = diagnostics.filter(
    (diagnostic) =>
      diagnostic.id.startsWith("schema-") &&
      /-(type|required|additionalProperties|enum|const|anyOf)-/.test(
        diagnostic.id,
      ) &&
      diagnostic.level === "error",
  );
  if (structural.length)
    throw new Error(
      structural
        .slice(0, 4)
        .map((item) => `${item.path}：${item.message}`)
        .join("\n"),
    );
  return { project, diagnostics };
}

export function playerScenePreview(project: EditorProject, sceneId: string) {
  const scene = project.module.scenes[sceneId];
  if (!scene) return null;
  const known = new Set(project.module.initial_state.known_clue_ids);
  return {
    name: scene.name,
    description: scene.description,
    people: scene.npcs_present.flatMap((id) => {
      const npc = project.module.npcs[id];
      return npc
        ? [
            {
              name: npc.initial_reveal > 0 ? npc.name : "尚未认识的人物",
              tags: npc.visible_tags,
            },
          ]
        : [];
    }),
    clues: Object.entries(project.module.clues)
      .filter(
        ([id, clue]) =>
          (known.has(id) || clue.initially_known) &&
          (!clue.related_scenes.length ||
            clue.related_scenes.includes(sceneId)),
      )
      .map(([, clue]) => clue.text),
  };
}
