export const MANIFEST_SCHEMA_URI = "https://trpg-master.local/schemas/module-manifest-v1.json";
export const MODULE_SCHEMA_URI = "https://trpg-master.local/schemas/module-v1.json";

export type ModuleCapability =
  | "custom_skills"
  | "bundled_characters"
  | "scene_documents";

export type ClueCategory = "investigation" | "event" | "task" | "npc";
export type ClueType = "obvious" | "hidden" | "inferred";
export type EndingType = "good" | "neutral" | "bad" | "secret";
export type EntityKind = "manifest" | "scene" | "npc" | "clue" | "ending";

export interface ModuleManifest {
  $schema: typeof MANIFEST_SCHEMA_URI;
  format_version: "1.0";
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
  capabilities: ModuleCapability[];
  tags: string[];
  created_with: string;
  checksums: Record<string, string>;
}

export interface AssetDefinition {
  file: string;
  label: string;
  alt: string;
  media_type: string;
}

export interface AssetGroups {
  npcs: Record<string, AssetDefinition>;
  scenes: Record<string, AssetDefinition>;
  clues: Record<string, AssetDefinition>;
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
  description: string;
  exits: string[];
  npcs_present: string[];
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
  initially_known: boolean;
  discovery_notes: string;
  extensions: Record<string, unknown>;
}

export interface EndingDefinition {
  title: string;
  trigger: string;
  description: string;
  ending_type: EndingType;
}

export interface ClueLinkDefinition {
  from: string;
  to: string;
  reasoning: string;
}

export interface ModuleDefinition {
  $schema: typeof MODULE_SCHEMA_URI;
  format_version: "1.0";
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
    private_memory: {
      goals_and_plans: string;
      hidden_facts: Record<string, string>;
      inference_notes: string;
    };
    extensions: Record<string, unknown>;
  };
  clue_links: ClueLinkDefinition[];
  extensions: Record<string, unknown>;
}

export interface EditorProject {
  editor_version: 1;
  manifest: ModuleManifest;
  module: ModuleDefinition;
  keeperDocument: string;
  theme: Record<string, unknown>;
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
