import { describe, expect, it } from "vitest";
import { createDefaultProject } from "../../domain/default-project";
import type { EditorProject } from "../../domain/types";
import { parseEditorProject, parseEditorProjectWithReport } from "./project-io";

function v1Project(): EditorProject {
  const project = structuredClone(createDefaultProject());
  project.manifest.$schema = "https://trpg-master.local/schemas/module-manifest-v1.json";
  project.manifest.format_version = "1.0";
  project.module.$schema = "https://trpg-master.local/schemas/module-v1.json";
  project.module.format_version = "1.0";
  delete project.module.progression;
  project.module.clues.recover_letter = {
    text: "找回失踪的信件。",
    category: "task",
    type: "obvious",
    tier: 0,
    source: null,
    related_npcs: [],
    related_scenes: ["opening_scene"],
    asset_id: null,
    granted_item: null,
    flag_effects: {},
    discovery_rules: [{
      intent: "search",
      targets: ["书房"],
      approach_text: "",
      skill: "spot_hidden",
      check_type: "skill",
      difficulty: "hard",
      requires_success: true,
      sanity_severity: null,
      npc_reveals: [],
      fallback: null,
    }],
    initially_known: false,
    discovery_notes: "",
    extensions: {},
  };
  return project;
}

describe("v1 to v2 migration", () => {
  it("promotes task clues to essential and inserts fallbacks", () => {
    const result = parseEditorProjectWithReport(v1Project());
    const { project, migrationReport } = result;

    expect(project.manifest.format_version).toBe("2.0");
    expect(project.module.format_version).toBe("2.0");
    expect(project.manifest.$schema).toBe("https://trpg-master.local/schemas/module-manifest-v2.json");
    expect(project.module.$schema).toBe("https://trpg-master.local/schemas/module-v2.json");
    expect(project.module.progression?.essential_clue_ids).toEqual(["recover_letter"]);
    expect(project.module.clues.recover_letter.discovery_rules[0].fallback).toMatchObject({
      mode: "grant_clue",
      narrative: expect.stringContaining("不会永久丢失"),
    });
    expect(migrationReport).toEqual({
      from_version: "1.0",
      to_version: "2.0",
      essential_clue_ids: ["recover_letter"],
      inserted_fallbacks: ["module.clues.recover_letter.discovery_rules[0].fallback"],
      skipped_essential: [],
    });
  });

  it("skips task clues without discovery rules instead of failing", () => {
    const project = v1Project();
    project.module.clues.directive = {
      text: "直接交代的任务。",
      category: "task",
      type: "obvious",
      tier: 0,
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

    const { project: migrated, migrationReport } = parseEditorProjectWithReport(project);
    expect(migrated.module.progression?.essential_clue_ids).toEqual(["recover_letter"]);
    expect(migrationReport?.skipped_essential).toEqual(["directive"]);
  });

  it("leaves v2 projects untouched", () => {
    const project = createDefaultProject();
    const { project: parsed, migrationReport } = parseEditorProjectWithReport(project);
    expect(migrationReport).toBeNull();
    expect(parsed.module.format_version).toBe("2.0");
  });

  it("normalizes missing optional fields of older projects", () => {
    const raw = JSON.parse(JSON.stringify(v1Project())) as Record<string, unknown>;
    (raw.module as Record<string, unknown>).scenes = {
      opening_scene: { name: "旧场景", description: "旧描述" },
    };

    const project = parseEditorProject(raw);
    expect(project.module.scenes.opening_scene).toMatchObject({
      name: "旧场景",
      aliases: [],
      exits: [],
      npcs_present: [],
      encounters: [],
      tags: [],
      document: null,
      asset_id: null,
      extensions: {},
    });
    // 迁移必须仍然完成
    expect(project.module.format_version).toBe("2.0");
  });

  it("keeps manifest file references consistent with editor content", () => {
    const project = v1Project();
    project.lorebook = { spec: "lorebook_v3", data: { name: "L", entries: [] } };

    const parsed = parseEditorProject(project);
    expect(parsed.manifest.lorebook).toBe("lorebook.json");
    expect(parsed.manifest.keeper_document).toBe("keeper.md");
    expect(parsed.manifest.theme).toBe("theme.json");
  });

  it("rejects structurally invalid files", () => {
    expect(() => parseEditorProject(null)).toThrow("不是有效的 TRPG Mod Editor 工程");
    expect(() => parseEditorProject({ editor_version: 3, manifest: {}, module: {} })).toThrow("editor_version");
    expect(() => parseEditorProject({ editor_version: 2, manifest: {}, module: { scenes: {} } })).toThrow("format_version");
    expect(() => parseEditorProject({ editor_version: 2, manifest: {}, module: {} })).toThrow("module.scenes");
  });

  it("upgrades editor_version 1 containers", () => {
    const raw = JSON.parse(JSON.stringify(v1Project())) as Record<string, unknown>;
    raw.editor_version = 1;
    delete raw.lorebook;

    const project = parseEditorProject(raw);
    expect(project.editor_version).toBe(2);
    expect(project.lorebook).toBeNull();
    expect(project.module.format_version).toBe("2.0");
  });
});
