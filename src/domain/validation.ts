import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import manifestV1Schema from "../../schemas/trpgmod/module-manifest-v1.schema.json";
import manifestV2Schema from "../../schemas/trpgmod/module-manifest-v2.schema.json";
import moduleV1Schema from "../../schemas/trpgmod/module-v1.schema.json";
import moduleV2Schema from "../../schemas/trpgmod/module-v2.schema.json";
import lorebookSchema from "../../schemas/trpgmod/lorebook-v3.schema.json";
import type {
  Diagnostic,
  EditorProject,
  EntityKind,
  EntitySelection,
} from "./types";

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateManifestV1 = ajv.compile(manifestV1Schema);
const validateManifestV2 = ajv.compile(manifestV2Schema);
const validateModuleV1 = ajv.compile(moduleV1Schema);
const validateModuleV2 = ajv.compile(moduleV2Schema);
const validateLorebook = ajv.compile(lorebookSchema);

const ENTITY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function selectionFromPath(path: string): EntitySelection | undefined {
  const match = path.match(/^module\.(scenes|npcs|clues|endings)\.([^.]+)/);
  if (!match) return path.startsWith("manifest") ? { kind: "manifest" } : undefined;
  const kindMap: Record<string, EntityKind> = {
    scenes: "scene",
    npcs: "npc",
    clues: "clue",
    endings: "ending",
  };
  return { kind: kindMap[match[1]], id: match[2] };
}

function schemaDiagnostic(root: "manifest" | "module" | "lorebook", error: ErrorObject, index: number): Diagnostic {
  const missing = error.keyword === "required" && "missingProperty" in error.params
    ? `/${String(error.params.missingProperty)}`
    : "";
  const normalizedPath = `${root}${error.instancePath}${missing}`
    .replaceAll("/", ".")
    .replace(/\.([0-9]+)(?=\.|$)/g, "[$1]");
  return {
    id: `schema-${root}-${index}-${error.keyword}-${normalizedPath}`,
    level: "error",
    path: normalizedPath,
    message: schemaMessage(error),
    selection: selectionFromPath(normalizedPath),
  };
}

function schemaMessage(error: ErrorObject): string {
  if (error.keyword === "required" && "missingProperty" in error.params) {
    return `缺少必填字段 ${String(error.params.missingProperty)}`;
  }
  if (error.keyword === "minLength" && "limit" in error.params) {
    return `至少需要 ${String(error.params.limit)} 个字符`;
  }
  if (error.keyword === "maxLength" && "limit" in error.params) {
    return `不能超过 ${String(error.params.limit)} 个字符`;
  }
  if (error.keyword === "minimum" && "limit" in error.params) {
    return `数值不能小于 ${String(error.params.limit)}`;
  }
  if (error.keyword === "maximum" && "limit" in error.params) {
    return `数值不能大于 ${String(error.params.limit)}`;
  }
  if (error.keyword === "pattern") return "字段格式不符合要求";
  if (error.keyword === "type" && "type" in error.params) {
    return `字段类型应为 ${String(error.params.type)}`;
  }
  if (error.keyword === "additionalProperties" && "additionalProperty" in error.params) {
    return `不支持字段 ${String(error.params.additionalProperty)}`;
  }
  if (error.keyword === "enum" || error.keyword === "const") return "字段值不在允许范围内";
  return error.message ?? "字段格式不符合模组 Schema";
}

function pushDiagnostic(
  diagnostics: Diagnostic[],
  level: Diagnostic["level"],
  path: string,
  message: string,
): void {
  diagnostics.push({
    id: `${level}-${path}-${message}`,
    level,
    path,
    message,
    selection: selectionFromPath(path),
  });
}

export function validateProject(project: EditorProject): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { module, manifest } = project;
  const isV2 = manifest.format_version === "2.0";

  const validateManifest = isV2 ? validateManifestV2 : validateManifestV1;
  const validateModule = isV2 ? validateModuleV2 : validateModuleV1;

  validateManifest(manifest);
  diagnostics.push(
    ...(validateManifest.errors ?? []).map((error, index) =>
      schemaDiagnostic("manifest", error, index)),
  );

  validateModule(module);
  diagnostics.push(
    ...(validateModule.errors ?? []).map((error, index) =>
      schemaDiagnostic("module", error, index)),
  );

  if (project.lorebook !== null && project.lorebook !== undefined) {
    validateLorebook(project.lorebook);
    diagnostics.push(
      ...(validateLorebook.errors ?? []).map((error, index) =>
        schemaDiagnostic("lorebook", error, index)),
    );
  }

  const sceneIds = new Set(Object.keys(module.scenes));
  const npcIds = new Set(Object.keys(module.npcs));
  const clueIds = new Set(Object.keys(module.clues));
  const flagKeys = new Set(Object.keys(module.initial_state.flags));
  const clockKeys = new Set(Object.keys(module.initial_state.case_clocks));

  if (!sceneIds.has(module.entry_scene_id)) {
    pushDiagnostic(
      diagnostics,
      "error",
      "module.entry_scene_id",
      `入口场景 ${module.entry_scene_id} 不存在`,
    );
  }

  for (const [sceneId, scene] of Object.entries(module.scenes)) {
    for (const exitId of scene.exits) {
      if (!sceneIds.has(exitId)) {
        pushDiagnostic(
          diagnostics,
          "error",
          `module.scenes.${sceneId}.exits`,
          `出口场景 ${exitId} 不存在`,
        );
      }
    }
    for (const npcId of scene.npcs_present) {
      if (!npcIds.has(npcId)) {
        pushDiagnostic(
          diagnostics,
          "error",
          `module.scenes.${sceneId}.npcs_present`,
          `在场 NPC ${npcId} 不存在`,
        );
      }
    }
    scene.encounters.forEach((encounter, index) => {
      const prefix = `module.scenes.${sceneId}.encounters[${index}]`;
      if (!ENTITY_ID_PATTERN.test(encounter.id)) {
        pushDiagnostic(
          diagnostics,
          "error",
          `${prefix}.id`,
          `遭遇 ID ${encounter.id || "（空）"} 不符合稳定 ID 格式`,
        );
      }
      if (!npcIds.has(encounter.npc_id)) {
        pushDiagnostic(
          diagnostics,
          "error",
          `${prefix}.npc_id`,
          `遭遇 NPC ${encounter.npc_id} 不存在`,
        );
      }
      if (encounter.availability === "conditional" &&
          Object.keys(encounter.required_flags).length === 0 &&
          Object.keys(encounter.forbidden_flags).length === 0) {
        pushDiagnostic(
          diagnostics,
          "error",
          `${prefix}.required_flags`,
          "conditional 遭遇必须至少声明一个旗标条件",
        );
      }
      for (const flag of Object.keys(encounter.required_flags)) {
        if (!flagKeys.has(flag)) {
          pushDiagnostic(
            diagnostics,
            "error",
            `${prefix}.required_flags`,
            `旗标 ${flag} 未预声明于 initial_state.flags`,
          );
        }
      }
      for (const flag of Object.keys(encounter.forbidden_flags)) {
        if (!flagKeys.has(flag)) {
          pushDiagnostic(
            diagnostics,
            "error",
            `${prefix}.forbidden_flags`,
            `旗标 ${flag} 未预声明于 initial_state.flags`,
          );
        }
      }
    });
  }

  for (const [npcId, npc] of Object.entries(module.npcs)) {
    if (npc.current_location && !sceneIds.has(npc.current_location)) {
      pushDiagnostic(
        diagnostics,
        "error",
        `module.npcs.${npcId}.current_location`,
        `所在场景 ${npc.current_location} 不存在`,
      );
    }
    if (npc.asset_id && !(npc.asset_id in module.assets.npcs)) {
      pushDiagnostic(
        diagnostics,
        "error",
        `module.npcs.${npcId}.asset_id`,
        `素材 ${npc.asset_id} 未声明于 assets.npcs`,
      );
    }
    if (npc.initial_reveal > 0 && npc.initial_reveal_entries.length === 0) {
      pushDiagnostic(
        diagnostics,
        "advice",
        `module.npcs.${npcId}.initial_reveal_entries`,
        `初始揭示等级大于 0，尚未填写揭示条目`,
      );
    }
  }

  for (const [clueId, clue] of Object.entries(module.clues)) {
    for (const npcId of clue.related_npcs) {
      if (!npcIds.has(npcId)) {
        pushDiagnostic(
          diagnostics,
          "error",
          `module.clues.${clueId}.related_npcs`,
          `关联 NPC ${npcId} 不存在`,
        );
      }
    }
    for (const sceneId of clue.related_scenes) {
      if (!sceneIds.has(sceneId)) {
        pushDiagnostic(
          diagnostics,
          "error",
          `module.clues.${clueId}.related_scenes`,
          `关联场景 ${sceneId} 不存在`,
        );
      }
    }
    if (clue.asset_id && !(clue.asset_id in module.assets.clues)) {
      pushDiagnostic(
        diagnostics,
        "error",
        `module.clues.${clueId}.asset_id`,
        `素材 ${clue.asset_id} 未声明于 assets.clues`,
      );
    }
    for (const flag of Object.keys(clue.flag_effects)) {
      if (!flagKeys.has(flag)) {
        pushDiagnostic(
          diagnostics,
          "error",
          `module.clues.${clueId}.flag_effects`,
          `旗标 ${flag} 未预声明于 initial_state.flags`,
        );
      }
    }
    if (clue.type === "hidden" && !clue.discovery_notes.trim()) {
      pushDiagnostic(
        diagnostics,
        "advice",
        `module.clues.${clueId}.discovery_notes`,
        "隐藏线索尚未写发现条件",
      );
    }
    if (clue.initially_known && !module.initial_state.known_clue_ids.includes(clueId)) {
      pushDiagnostic(
        diagnostics,
        "warning",
        `module.clues.${clueId}.initially_known`,
        "线索标记为初始已知，但未列入 initial_state.known_clue_ids",
      );
    }
    clue.discovery_rules.forEach((rule, ruleIndex) => {
      const rulePath = `module.clues.${clueId}.discovery_rules[${ruleIndex}]`;
      for (const reveal of rule.npc_reveals) {
        if (!npcIds.has(reveal.npc_id)) {
          pushDiagnostic(
            diagnostics,
            "error",
            `${rulePath}.npc_reveals`,
            `揭示 NPC ${reveal.npc_id} 不存在`,
          );
        }
      }
      const fallback = rule.fallback;
      if (!fallback) return;
      if (fallback.cost_clock && !clockKeys.has(fallback.cost_clock)) {
        pushDiagnostic(
          diagnostics,
          "error",
          `${rulePath}.fallback.cost_clock`,
          `案件时钟 ${fallback.cost_clock} 未预声明于 initial_state.case_clocks`,
        );
      }
      if (fallback.mode === "alternate_clue") {
        if (!fallback.clue_id || !clueIds.has(fallback.clue_id)) {
          pushDiagnostic(
            diagnostics,
            "error",
            `${rulePath}.fallback.clue_id`,
            `替代线索 ${fallback.clue_id ?? "（空）"} 不存在`,
          );
        } else {
          const alternate = module.clues[fallback.clue_id];
          if (!alternate.initially_known && alternate.discovery_rules.length === 0) {
            pushDiagnostic(
              diagnostics,
              "error",
              `${rulePath}.fallback.clue_id`,
              `替代线索 ${fallback.clue_id} 自身没有发现路径`,
            );
          }
        }
      }
    });
  }

  for (const clueId of module.initial_state.known_clue_ids) {
    if (!clueIds.has(clueId)) {
      pushDiagnostic(
        diagnostics,
        "error",
        "module.initial_state.known_clue_ids",
        `初始线索 ${clueId} 不存在`,
      );
    }
  }

  for (const [endingId, ending] of Object.entries(module.endings)) {
    for (const flag of Object.keys(ending.required_flags)) {
      if (!flagKeys.has(flag)) {
        pushDiagnostic(
          diagnostics,
          "error",
          `module.endings.${endingId}.required_flags`,
          `旗标 ${flag} 未预声明于 initial_state.flags`,
        );
      }
    }
  }

  for (const [index, link] of module.clue_links.entries()) {
    const linkPath = `module.clue_links[${index}]`;
    if (!clueIds.has(link.from)) {
      pushDiagnostic(diagnostics, "error", `${linkPath}.from`, `线索关联起点 ${link.from} 不存在`);
    }
    if (!clueIds.has(link.to)) {
      pushDiagnostic(diagnostics, "error", `${linkPath}.to`, `线索关联终点 ${link.to} 不存在`);
    }
  }

  for (const group of ["npcs", "scenes", "clues"] as const) {
    for (const [assetId, asset] of Object.entries(module.assets[group])) {
      if (!asset.file.startsWith("assets/")) {
        pushDiagnostic(
          diagnostics,
          "error",
          `module.assets.${group}.${assetId}.file`,
          `素材文件必须位于 assets/ 目录：${asset.file}`,
        );
      }
    }
  }

  for (const [sceneId, scene] of Object.entries(module.scenes)) {
    if (scene.document && !scene.document.startsWith("scenes/")) {
      pushDiagnostic(
        diagnostics,
        "error",
        `module.scenes.${sceneId}.document`,
        `补充文档必须位于 scenes/ 目录：${scene.document}`,
      );
    }
    if (scene.asset_id && !(scene.asset_id in module.assets.scenes)) {
      pushDiagnostic(
        diagnostics,
        "error",
        `module.scenes.${sceneId}.asset_id`,
        `素材 ${scene.asset_id} 未声明于 assets.scenes`,
      );
    }
  }

  if (isV2 && module.progression) {
    for (const clueId of module.progression.essential_clue_ids) {
      if (!clueIds.has(clueId)) {
        pushDiagnostic(
          diagnostics,
          "error",
          "module.progression.essential_clue_ids",
          `主线线索 ${clueId} 不存在`,
        );
        continue;
      }
      const clue = module.clues[clueId];
      if (!clue.initially_known && clue.discovery_rules.length === 0) {
        pushDiagnostic(
          diagnostics,
          "error",
          `module.clues.${clueId}.discovery_rules`,
          `主线线索 ${clueId} 没有发现规则`,
        );
      }
      for (const [ruleIndex, rule] of clue.discovery_rules.entries()) {
        if (rule.requires_success && !rule.fallback) {
          pushDiagnostic(
            diagnostics,
            "error",
            `module.clues.${clueId}.discovery_rules[${ruleIndex}].fallback`,
            "主线线索的检定失败路径缺少 fallback",
          );
        }
      }
    }

    const reachable = new Set<string>([module.entry_scene_id]);
    const frontier = [module.entry_scene_id];
    while (frontier.length > 0) {
      const current = frontier.pop()!;
      for (const target of module.scenes[current]?.exits ?? []) {
        if (!reachable.has(target)) {
          reachable.add(target);
          frontier.push(target);
        }
      }
    }
    for (const sceneId of Object.keys(module.scenes)) {
      if (!reachable.has(sceneId)) {
        pushDiagnostic(
          diagnostics,
          "error",
          `module.scenes.${sceneId}.exits`,
          `入口场景无法到达该场景`,
        );
      }
    }
  }

  if (project.lorebook) {
    const data = (project.lorebook as { data?: unknown }).data;
    const entries = data && typeof data === "object"
      ? (data as { entries?: unknown[] }).entries
      : undefined;
    if (Array.isArray(entries)) {
      entries.forEach((entry, index) => {
        if (typeof entry !== "object" || entry === null) return;
        const record = entry as Record<string, unknown>;
        const extension = (record.extensions as Record<string, unknown> | undefined)?.trpg_master as
          | { scene_ids?: unknown; npc_ids?: unknown; required_clue_ids?: unknown }
          | undefined;
        if (!extension) return;
        for (const sceneId of Array.isArray(extension.scene_ids) ? extension.scene_ids : []) {
          if (!sceneIds.has(String(sceneId))) {
            pushDiagnostic(
              diagnostics,
              "error",
              `lorebook.data.entries[${index}].extensions.trpg_master.scene_ids`,
              `Lorebook 场景 ${String(sceneId)} 不存在`,
            );
          }
        }
        for (const npcId of Array.isArray(extension.npc_ids) ? extension.npc_ids : []) {
          if (!npcIds.has(String(npcId))) {
            pushDiagnostic(
              diagnostics,
              "error",
              `lorebook.data.entries[${index}].extensions.trpg_master.npc_ids`,
              `Lorebook NPC ${String(npcId)} 不存在`,
            );
          }
        }
        for (const clueId of Array.isArray(extension.required_clue_ids) ? extension.required_clue_ids : []) {
          if (!clueIds.has(String(clueId))) {
            pushDiagnostic(
              diagnostics,
              "error",
              `lorebook.data.entries[${index}].extensions.trpg_master.required_clue_ids`,
              `Lorebook 线索 ${String(clueId)} 不存在`,
            );
          }
        }
      });
    }
  }

  if (!manifest.license.trim()) {
    pushDiagnostic(diagnostics, "warning", "manifest.license", "尚未声明内容许可证");
  }
  if (!manifest.author.trim()) {
    pushDiagnostic(diagnostics, "advice", "manifest.author", "尚未填写作者信息");
  }
  if (manifest.capabilities.includes("custom_skills")) {
    pushDiagnostic(
      diagnostics,
      "warning",
      "manifest.capabilities",
      "自定义 Skill 会进入守秘人上下文",
    );
  }

  const levelOrder: Record<Diagnostic["level"], number> = { error: 0, warning: 1, advice: 2 };
  return diagnostics.sort((left, right) => levelOrder[left.level] - levelOrder[right.level]);
}
