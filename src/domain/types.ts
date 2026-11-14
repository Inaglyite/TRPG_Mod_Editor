export const MANIFEST_SCHEMA_V1_URI =
  "https://trpg-master.local/schemas/module-manifest-v1.json";
export const MANIFEST_SCHEMA_V2_URI =
  "https://trpg-master.local/schemas/module-manifest-v2.json";
export const MODULE_SCHEMA_V1_URI =
  "https://trpg-master.local/schemas/module-v1.json";
export const MODULE_SCHEMA_V2_URI =
  "https://trpg-master.local/schemas/module-v2.json";
export const LOREBOOK_SCHEMA_URI =
  "https://trpg-master.local/schemas/lorebook-v3.json";

export type ModuleFormatVersion = "1.0" | "2.0";

export type ModuleCapability =
  | "custom_skills"
  | "bundled_characters"
  | "scene_documents"
  | "spatial_investigation";

export type ClueCategory = "investigation" | "event" | "task" | "npc";
export type ClueType = "obvious" | "hidden" | "inferred";
export type EndingType = "good" | "neutral" | "bad" | "secret";
export type EntityKind =
  | "overview"
  | "graph"
  | "preview"
  | "source"
  | "manifest"
  | "content"
  | "spatial"
  | "skills"
  | "scene"
  | "npc"
  | "clue"
  | "ending";
/** 实体树里以 ID 管理的内容实体（skills 是工程级列表，不在其中）。 */
export type TreeEntityKind = "scene" | "npc" | "clue" | "ending";

/** 旗标与案件时钟的取值：布尔、整数或短文本。 */
export type FlagValue = boolean | number | string;

export interface ModuleManifest {
  $schema: typeof MANIFEST_SCHEMA_V1_URI | typeof MANIFEST_SCHEMA_V2_URI;
  format_version: ModuleFormatVersion;
  id: string;
  version: string;
  title: string;
  author: string;
  description: string;
  system: string;
  era: string;
  language: string;
  license: string;
  homepage: string;
  min_engine_version: string;
  entry: "module.json";
  keeper_document: "keeper.md" | null;
  theme: "theme.json" | null;
  lorebook?: "lorebook.json" | null;
  capabilities: ModuleCapability[];
  tags: string[];
  created_with: string;
  checksums: Record<string, string>;
}

export interface AssetRevealTrigger {
  event:
    "npc_revealed" | "scene_entered" | "clue_discovered" | "sanity_triggered";
  entity_id: string | null;
  match_all: string[];
  match_any: string[];
}

export interface AssetDefinition {
  file: string;
  label: string;
  alt: string;
  media_type: string;
  reveal_on: AssetRevealTrigger[];
}

export interface AssetGroups {
  npcs: Record<string, AssetDefinition>;
  scenes: Record<string, AssetDefinition>;
  clues: Record<string, AssetDefinition>;
}

export interface NpcRevealEffectDefinition {
  npc_id: string;
  tier: number;
  entry_text: string;
}

export interface DiscoveryFallbackDefinition {
  mode: "grant_clue" | "alternate_clue";
  clue_id: string | null;
  narrative: string;
  cost_clock: string | null;
  cost_amount: number;
}

export interface DiscoveryRuleDefinition {
  intent: "examine" | "search" | "read" | "take" | "talk" | "enter" | "use";
  targets: string[];
  approach_text: string;
  skill: string | null;
  check_type: "skill" | "luck" | null;
  difficulty: "regular" | "hard" | "extreme";
  requires_success: boolean;
  sanity_severity: "minor" | "moderate" | "major" | null;
  npc_reveals: NpcRevealEffectDefinition[];
  fallback: DiscoveryFallbackDefinition | null;
}

export interface EncounterDefinition {
  id: string;
  npc_id: string;
  availability: "guaranteed" | "conditional" | "luck" | "unavailable";
  required_flags: Record<string, FlagValue>;
  forbidden_flags: Record<string, FlagValue>;
  luck_difficulty: "regular" | "hard" | "extreme";
  repeat: "once" | "always";
  on_present_text: string;
  on_absent_text: string;
}

export interface NpcDefinition {
  name: string;
  visible_tags: string[];
  secret: string;
  hp: number;
  max_hp: number | null;
  disposition: string;
  current_location: string | null;
  attributes: Record<string, number>;
  skills: Record<string, number>;
  conditions: string[];
  spells: string[];
  notes: string;
  asset_id: string | null;
  initial_reveal: number;
  initial_reveal_entries: Record<string, unknown>[];
  extensions: Record<string, unknown>;
}

export interface SceneDefinition {
  name: string;
  aliases: string[];
  description: string;
  exits: string[];
  npcs_present: string[];
  encounters: EncounterDefinition[];
  tags: string[];
  document: string | null;
  asset_id: string | null;
  extensions: Record<string, unknown>;
}

export interface ClueDefinition {
  text: string;
  category: ClueCategory;
  type: ClueType;
  tier: number;
  source: string | null;
  related_npcs: string[];
  related_scenes: string[];
  asset_id: string | null;
  granted_item: string | null;
  flag_effects: Record<string, FlagValue>;
  discovery_rules: DiscoveryRuleDefinition[];
  initially_known: boolean;
  discovery_notes: string;
  extensions: Record<string, unknown>;
}

export interface EndingDefinition {
  title: string;
  trigger: string;
  description: string;
  ending_type: EndingType;
  required_flags: Record<string, FlagValue>;
}

export interface ClueLinkDefinition {
  from: string;
  to: string;
  reasoning: string;
}

export interface ProgressionDefinition {
  essential_clue_ids: string[];
}

export type SpatialCondition =
  | { op: "always"; value: boolean }
  | { op: "all" | "any"; conditions: SpatialCondition[] }
  | { op: "not"; condition: SpatialCondition }
  | { op: "flag"; flag_id: string; value: FlagValue }
  | {
      op: "item";
      item_id: string;
      quantity: number;
      minimum_states: Record<string, number>;
    }
  | { op: "clue"; clue_id: string }
  | { op: "clock"; clock_id: string; minimum: number }
  | { op: "completed"; point_id: string; action_id: string };

export type SpatialEffect =
  | { kind: "grant_clue"; clue_id: string }
  | { kind: "give_item"; item_id: string; quantity: number }
  | {
      kind: "adjust_item_state";
      item_id: string;
      state: string;
      delta: number;
    }
  | { kind: "set_flag"; flag_id: string; value: FlagValue }
  | { kind: "reveal_scene"; scene_id: string }
  | { kind: "unlock_connection"; connection_id: string }
  | { kind: "advance_clock"; clock_id: string; amount: number };

export interface SpatialNode {
  kind: "container" | "location";
  parent_scene_id: string | null;
  entry_scene_id: string | null;
  hidden: boolean;
}

export interface SpatialConnection {
  source_scene_id: string;
  target_scene_id: string;
  bidirectional: boolean;
  visible_when: SpatialCondition;
  requires: SpatialCondition;
  remember_unlock: boolean;
  costs: Extract<SpatialEffect, { kind: "adjust_item_state" }>[];
}

export interface SpatialAction {
  intent: "examine" | "search" | "read" | "take" | "talk" | "enter" | "use";
  aliases: string[];
  requires: SpatialCondition;
  check: {
    skill: string;
    difficulty: "regular" | "hard" | "extreme";
  } | null;
  repeat: boolean;
  success: SpatialEffect[];
  failure: SpatialEffect[];
}

export interface SpatialPoint {
  scene_id: string;
  name: string;
  description: string;
  visible_when: SpatialCondition;
  actions: Record<string, SpatialAction>;
}

export interface SpatialItemDefinition {
  label: string;
  states: Record<
    string,
    { initial: number; minimum: number; maximum: number }
  >;
}

export interface SpatialDefinition {
  version: 1;
  nodes: Record<string, SpatialNode>;
  connections: Record<string, SpatialConnection>;
  points: Record<string, SpatialPoint>;
  items: Record<string, SpatialItemDefinition>;
}

export type SpatialEntityKind =
  | "connection"
  | "point"
  | "action"
  | "item"
  | "state";

export interface ModuleDefinition {
  $schema: typeof MODULE_SCHEMA_V1_URI | typeof MODULE_SCHEMA_V2_URI;
  format_version: ModuleFormatVersion;
  entry_scene_id: string;
  opening_prompt: string;
  npcs: Record<string, NpcDefinition>;
  scenes: Record<string, SceneDefinition>;
  clues: Record<string, ClueDefinition>;
  endings: Record<string, EndingDefinition>;
  rules: Record<string, unknown>;
  assets: AssetGroups;
  initial_state: {
    pc: {
      name: string;
      occupation: string;
      hp: number;
      max_hp: number;
      san: number;
      max_san: number;
      attributes: Record<string, number>;
      skills: Record<string, number>;
      inventory: unknown[];
      conditions: string[];
      psychological_profile: {
        traits: unknown[];
        key_relationships: unknown[];
        phobias: unknown[];
        manias: unknown[];
      };
      extensions: Record<string, unknown>;
    };
    known_clue_ids: string[];
    flags: Record<string, unknown>;
    case_clocks: Record<string, number>;
    case_clock_definitions?: Record<string, Record<string, unknown>>;
    private_memory: {
      goals_and_plans: string;
      hidden_facts: Record<string, string>;
      inference_notes: string;
    };
    extensions: Record<string, unknown>;
  };
  clue_links: ClueLinkDefinition[];
  extensions: Record<string, unknown>;
  progression?: ProgressionDefinition;
  spatial?: SpatialDefinition | null;
}

/**
 * 工程级自定义 Skill 草稿，字段与后端 src/editor_projects.py 的
 * EditorSkillDraft 对齐；导出时写为包内 skills/<name>.skill。
 */
export interface SkillDraft {
  name: string;
  body: string;
  version?: string;
  description?: string;
  required_tools?: string[];
  allowed_tools?: string[];
}

export interface EditorProject {
  editor_version: 2;
  manifest: ModuleManifest;
  module: ModuleDefinition;
  keeperDocument: string;
  theme: Record<string, unknown>;
  lorebook: Record<string, unknown> | null;
  skills?: SkillDraft[];
}

export interface EntitySelection {
  kind: EntityKind;
  id?: string;
}

export type DiagnosticLevel = "error" | "warning" | "advice";

export interface Diagnostic {
  id: string;
  level: DiagnosticLevel;
  path: string;
  message: string;
  selection?: EntitySelection;
}
