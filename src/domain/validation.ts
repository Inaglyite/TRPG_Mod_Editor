import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import manifestSchema from "../../schemas/trpgmod/module-manifest-v1.schema.json";
import moduleSchema from "../../schemas/trpgmod/module-v1.schema.json";
import type {
  Diagnostic,
  EditorProject,
  EntityKind,
  EntitySelection,
} from "./types";

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateManifest = ajv.compile(manifestSchema);
const validateModule = ajv.compile(moduleSchema);

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

function schemaDiagnostic(root: "manifest" | "module", error: ErrorObject, index: number): Diagnostic {
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

  validateManifest(project.manifest);
  diagnostics.push(
    ...(validateManifest.errors ?? []).map((error, index) =>
      schemaDiagnostic("manifest", error, index)),
  );

  validateModule(project.module);
  diagnostics.push(
    ...(validateModule.errors ?? []).map((error, index) =>
      schemaDiagnostic("module", error, index)),
  );

  const { module, manifest } = project;
  const sceneIds = new Set(Object.keys(module.scenes));
  const npcIds = new Set(Object.keys(module.npcs));
  const clueIds = new Set(Object.keys(module.clues));

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
    if (clue.type === "hidden" && !clue.discovery_notes.trim()) {
      pushDiagnostic(
        diagnostics,
        "advice",
        `module.clues.${clueId}.discovery_notes`,
        "隐藏线索尚未写发现条件",
      );
    }
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
