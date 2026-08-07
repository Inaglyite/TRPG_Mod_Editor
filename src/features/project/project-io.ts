import { createDefaultProject } from "../../domain/default-project";
import {
  MANIFEST_SCHEMA_V2_URI,
  MODULE_SCHEMA_V2_URI,
  type ClueDefinition,
  type EditorProject,
  type EndingDefinition,
  type ModuleManifest,
  type NpcDefinition,
  type SceneDefinition,
} from "../../domain/types";

export const DRAFT_STORAGE_KEY = "trpg-mod-editor:draft:v2";
const LEGACY_DRAFT_STORAGE_KEY = "trpg-mod-editor:draft:v1";
const MIGRATION_BACKUP_PREFIX = "trpg-mod-editor:migration-backup:v1";
const MIGRATION_BACKUP_LIMIT = 5;

export interface MigrationReport {
  from_version: "1.0";
  to_version: "2.0";
  essential_clue_ids: string[];
  inserted_fallbacks: string[];
  /** 候选主线线索因缺少发现规则而被跳过，避免迁移产出不可编译的 v2 工程。 */
  skipped_essential: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fillDefaults<T extends object>(target: Record<string, unknown>, defaults: T): void {
  for (const [key, value] of Object.entries(defaults)) {
    if (!(key in target)) target[key] = structuredClone(value);
  }
}

const NPC_DEFAULTS: Omit<NpcDefinition, "name"> = {
  visible_tags: [],
  secret: "",
  hp: 10,
  max_hp: null,
  disposition: "neutral",
  current_location: null,
  attributes: {},
  skills: {},
  conditions: [],
  spells: [],
  notes: "",
  asset_id: null,
  initial_reveal: 0,
  initial_reveal_entries: [],
  extensions: {},
};

const SCENE_DEFAULTS: Omit<SceneDefinition, "name" | "description"> = {
  aliases: [],
  exits: [],
  npcs_present: [],
  encounters: [],
  tags: [],
  document: null,
  asset_id: null,
  extensions: {},
};

const CLUE_DEFAULTS: Omit<ClueDefinition, "text"> = {
  category: "investigation",
  type: "obvious",
  tier: 1,
  source: null,
  related_npcs: [],
  related_scenes: [],
  asset_id: null,
  granted_item: null,
  flag_effects: {},
  discovery_rules: [],
  initially_known: false,
  discovery_notes: "",
  extensions: {},
};

const ENDING_DEFAULTS: Omit<EndingDefinition, "title" | "trigger" | "description"> = {
  ending_type: "neutral",
  required_flags: {},
};

const MANIFEST_DEFAULTS: Partial<ModuleManifest> = {
  author: "",
  description: "",
  system: "COC 第七版",
  era: "",
  language: "zh-CN",
  license: "",
  homepage: "",
  min_engine_version: "0.1.0",
  entry: "module.json",
  keeper_document: "keeper.md",
  theme: "theme.json",
  capabilities: [],
  tags: [],
  created_with: "",
  checksums: {},
};

/** 补齐旧工程缺失的可选字段，保证编辑器内部始终面对完整结构。 */
export function normalizeProject(project: EditorProject): EditorProject {
  const manifest = project.manifest as unknown as Record<string, unknown>;
  fillDefaults(manifest, MANIFEST_DEFAULTS);
  if (!("lorebook" in manifest)) manifest.lorebook = null;

  const module = project.module as unknown as Record<string, unknown>;
  fillDefaults(module, {
    opening_prompt: "",
    npcs: {},
    clues: {},
    endings: {},
    rules: {},
    assets: { npcs: {}, scenes: {}, clues: {} },
    initial_state: createDefaultProject().module.initial_state,
    clue_links: [],
    extensions: {},
  });
  if (manifest.format_version === "2.0" && !("progression" in module)) {
    module.progression = { essential_clue_ids: [] };
  }

  const moduleDef = project.module;
  for (const npc of Object.values(moduleDef.npcs)) fillDefaults(npc as unknown as Record<string, unknown>, NPC_DEFAULTS);
  for (const scene of Object.values(moduleDef.scenes)) fillDefaults(scene as unknown as Record<string, unknown>, SCENE_DEFAULTS);
  for (const clue of Object.values(moduleDef.clues)) fillDefaults(clue as unknown as Record<string, unknown>, CLUE_DEFAULTS);
  for (const ending of Object.values(moduleDef.endings)) fillDefaults(ending as unknown as Record<string, unknown>, ENDING_DEFAULTS);
  for (const group of ["npcs", "scenes", "clues"] as const) {
    for (const asset of Object.values(moduleDef.assets[group])) {
      fillDefaults(asset as unknown as Record<string, unknown>, {
        label: "",
        alt: "",
        media_type: "",
        reveal_on: null,
      });
    }
  }

  // 编辑器内容是包文件路径的单一事实来源，打开工程时收敛 manifest 引用。
  manifest.keeper_document = project.keeperDocument.trim() ? "keeper.md" : null;
  manifest.theme = project.theme && Object.keys(project.theme).length > 0 ? "theme.json" : null;
  manifest.lorebook = project.lorebook ? "lorebook.json" : null;
  return project;
}

/**
 * 无损迁移 v1 工程到 v2，算法对齐 TRPG Master `module_migrations.migrate_v1_to_v2`：
 * task 线索选为主线、为缺 fallback 的检定失败路径插入 grant_clue。候选主线线索
 * 没有发现规则时跳过而不是报错，保证迁移永远产出可编译工程。
 */
export function migrateV1ToV2(
  project: EditorProject,
): { project: EditorProject; report: MigrationReport | null } {
  if (project.manifest.format_version !== "1.0" || project.module.format_version !== "1.0") {
    return { project, report: null };
  }
  const manifest = structuredClone(project.manifest);
  const module = structuredClone(project.module);

  const essential: string[] = [];
  const skipped: string[] = [];
  for (const [clueId, clue] of Object.entries(module.clues)) {
    if (clue.category !== "task" || clue.initially_known) continue;
    if ((clue.discovery_rules ?? []).length === 0) {
      skipped.push(clueId);
      continue;
    }
    essential.push(clueId);
  }

  const insertedFallbacks: string[] = [];
  for (const clueId of essential) {
    for (const [index, rule] of (module.clues[clueId].discovery_rules ?? []).entries()) {
      if (rule.requires_success && !rule.fallback) {
        rule.fallback = {
          mode: "grant_clue",
          clue_id: null,
          narrative: "检定失败会带来叙事代价，但不会永久丢失主线线索。",
          cost_clock: null,
          cost_amount: 0,
        };
        insertedFallbacks.push(`module.clues.${clueId}.discovery_rules[${index}].fallback`);
      }
    }
  }

  manifest.$schema = MANIFEST_SCHEMA_V2_URI;
  manifest.format_version = "2.0";
  module.$schema = MODULE_SCHEMA_V2_URI;
  module.format_version = "2.0";
  module.progression = { essential_clue_ids: essential };

  return {
    project: { ...project, manifest, module },
    report: {
      from_version: "1.0",
      to_version: "2.0",
      essential_clue_ids: essential,
      inserted_fallbacks: insertedFallbacks,
      skipped_essential: skipped,
    },
  };
}

function backupMigratedSource(value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    const key = `${MIGRATION_BACKUP_PREFIX}:${Date.now()}`;
    window.localStorage.setItem(key, JSON.stringify(value));
    const backupKeys = Object.keys(window.localStorage)
      .filter((item) => item.startsWith(MIGRATION_BACKUP_PREFIX))
      .sort();
    for (const old of backupKeys.slice(0, -MIGRATION_BACKUP_LIMIT)) {
      window.localStorage.removeItem(old);
    }
  } catch {
    // 备份失败不阻断迁移
  }
}

export function parseEditorProject(value: unknown): EditorProject {
  return parseEditorProjectWithReport(value).project;
}

export function parseEditorProjectWithReport(
  value: unknown,
): { project: EditorProject; migrationReport: MigrationReport | null } {
  if (!isRecord(value) || !isRecord(value.manifest) || !isRecord(value.module)) {
    throw new Error("文件不是有效的 TRPG Mod Editor 工程");
  }
  if (value.editor_version !== 1 && value.editor_version !== 2) {
    throw new Error("当前只支持 editor_version 1 或 2");
  }
  if (!isRecord(value.module.scenes)) {
    throw new Error("工程缺少 module.scenes");
  }
  const manifestVersion = value.manifest.format_version;
  const moduleVersion = value.module.format_version;
  if (manifestVersion !== "1.0" && manifestVersion !== "2.0") {
    throw new Error("工程 manifest 缺少可识别的 format_version");
  }
  if (moduleVersion !== "1.0" && moduleVersion !== "2.0") {
    throw new Error("工程 module 缺少可识别的 format_version");
  }
  const base = structuredClone(value) as Record<string, unknown>;
  const parsed: EditorProject = {
    editor_version: 2,
    manifest: base.manifest as EditorProject["manifest"],
    module: base.module as EditorProject["module"],
    keeperDocument: typeof base.keeperDocument === "string" ? base.keeperDocument : "",
    theme: isRecord(base.theme) ? base.theme : {},
    lorebook: isRecord(base.lorebook) ? base.lorebook : null,
  };
  const migrated = migrateV1ToV2(parsed);
  if (migrated.report) backupMigratedSource(value);
  return {
    project: normalizeProject(migrated.project),
    migrationReport: migrated.report,
  };
}

export function loadDraft(): EditorProject {
  if (typeof window === "undefined") return createDefaultProject();
  const serialized = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    ?? window.localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY);
  if (!serialized) return createDefaultProject();
  try {
    return parseEditorProject(JSON.parse(serialized));
  } catch {
    return createDefaultProject();
  }
}

export function saveDraft(project: EditorProject): void {
  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(project));
}

export async function readProjectFile(
  file: File,
): Promise<{ project: EditorProject; migrationReport: MigrationReport | null }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch (error) {
    throw new Error("工程文件不是有效 JSON", { cause: error });
  }
  return parseEditorProjectWithReport(parsed);
}

export function downloadProject(project: EditorProject): void {
  const payload = `${JSON.stringify(project, null, 2)}\n`;
  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${project.manifest.id || "untitled"}.trpgmod-project.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
