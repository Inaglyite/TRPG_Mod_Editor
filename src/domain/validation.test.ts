import { describe, expect, it } from "vitest";
import { createDefaultProject } from "./default-project";
import { validateProject } from "./validation";

describe("validateProject", () => {
  it("accepts the default project without blocking errors", () => {
    const diagnostics = validateProject(createDefaultProject());
    expect(diagnostics.filter((item) => item.level === "error")).toEqual([]);
    expect(diagnostics.some((item) => item.path === "manifest.license")).toBe(true);
  });

  it("reports dangling scene references with an editor selection", () => {
    const project = createDefaultProject();
    project.module.scenes.opening_scene.exits = ["missing_room"];

    const diagnostic = validateProject(project).find((item) =>
      item.message.includes("missing_room"));

    expect(diagnostic?.level).toBe("error");
    expect(diagnostic?.selection).toEqual({ kind: "scene", id: "opening_scene" });
  });

  it("translates common schema diagnostics into Chinese", () => {
    const project = createDefaultProject();
    project.module.scenes.opening_scene.description = "";

    expect(validateProject(project)).toContainEqual(expect.objectContaining({
      level: "error",
      path: "module.scenes.opening_scene.description",
      message: "至少需要 1 个字符",
    }));
  });

  it("advises authors to define discovery rules for hidden clues", () => {
    const project = createDefaultProject();
    project.module.clues.hidden_note = {
      text: "抽屉夹层里有一张便笺。",
      category: "investigation",
      type: "hidden",
      tier: 1,
      source: null,
      related_npcs: [],
      related_scenes: ["opening_scene"],
      asset_id: null,
      granted_item: null,
      flag_effects: {},
      discovery_rules: [],
      initially_known: false,
      discovery_notes: "",
      extensions: {},
    };

    expect(validateProject(project)).toContainEqual(expect.objectContaining({
      level: "advice",
      path: "module.clues.hidden_note.discovery_notes",
    }));
  });

  it("creates new projects with format version 2.0 by default", () => {
    const project = createDefaultProject();
    expect(project.manifest.format_version).toBe("2.0");
    expect(project.module.format_version).toBe("2.0");
    expect(project.module.progression).toEqual({ essential_clue_ids: [] });
  });

  it("reports dangling essential clues for v2 progression", () => {
    const project = createDefaultProject();
    project.module.progression = { essential_clue_ids: ["missing_clue"] };

    expect(validateProject(project)).toContainEqual(expect.objectContaining({
      level: "error",
      path: "module.progression.essential_clue_ids",
      message: expect.stringContaining("missing_clue"),
    }));
  });

  it("requires fallback for essential clues with requires_success rules", () => {
    const project = createDefaultProject();
    project.module.progression = { essential_clue_ids: ["main_thread"] };
    project.module.clues.main_thread = {
      text: "关键线索。",
      category: "task",
      type: "obvious",
      tier: 1,
      source: null,
      related_npcs: [],
      related_scenes: ["opening_scene"],
      asset_id: null,
      granted_item: null,
      flag_effects: {},
      discovery_rules: [{
        intent: "search",
        targets: ["书桌"],
        approach_text: "",
        skill: "spot_hidden",
        check_type: "skill",
        difficulty: "regular",
        requires_success: true,
        sanity_severity: null,
        npc_reveals: [],
        fallback: null,
      }],
      initially_known: false,
      discovery_notes: "",
      extensions: {},
    };

    expect(validateProject(project)).toContainEqual(expect.objectContaining({
      level: "error",
      path: "module.clues.main_thread.discovery_rules[0].fallback",
      message: expect.stringContaining("fallback"),
    }));
  });

  it("reports flags that are not pre-declared in initial_state", () => {
    const project = createDefaultProject();
    project.module.endings.ending_a = {
      title: "结局",
      trigger: "触发",
      description: "描述",
      ending_type: "good",
      required_flags: { never_declared: true },
    };

    expect(validateProject(project)).toContainEqual(expect.objectContaining({
      level: "error",
      path: "module.endings.ending_a.required_flags",
      message: expect.stringContaining("never_declared"),
    }));
  });

  it("warns when an initially known clue is missing from known_clue_ids", () => {
    const project = createDefaultProject();
    project.module.clues.known_but_unlisted = {
      text: "一开始就知道的事。",
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
      initially_known: true,
      discovery_notes: "",
      extensions: {},
    };

    expect(validateProject(project)).toContainEqual(expect.objectContaining({
      level: "warning",
      path: "module.clues.known_but_unlisted.initially_known",
    }));
  });

  it("reports unreachable scenes for v2 projects", () => {
    const project = createDefaultProject();
    project.module.scenes.lost_room = {
      name: "孤岛房间",
      aliases: [],
      description: "没有任何出口通往这里。",
      exits: [],
      npcs_present: [],
      encounters: [],
      tags: [],
      document: null,
      asset_id: null,
      extensions: {},
    };

    expect(validateProject(project)).toContainEqual(expect.objectContaining({
      level: "error",
      path: "module.scenes.lost_room.exits",
      message: expect.stringContaining("无法到达"),
    }));
  });

  it("validates lorebook v3 structure against its schema", () => {
    const project = createDefaultProject();
    project.lorebook = {
      $schema: "https://trpg-master.local/schemas/lorebook-v3.json",
      spec: "lorebook_v3",
      data: {
        name: "测试",
        description: "",
        scan_depth: 2,
        token_budget: 600,
        recursive_scanning: false,
        extensions: {},
        entries: [],
      },
    };

    expect(validateProject(project).filter((item) => item.level === "error")).toEqual([]);

    project.lorebook = { spec: "wrong_spec", data: {} };
    expect(validateProject(project)).toContainEqual(expect.objectContaining({
      level: "error",
      path: "lorebook.spec",
    }));
  });

  it("reports lorebook entries referencing missing entities", () => {
    const project = createDefaultProject();
    project.lorebook = {
      $schema: "https://trpg-master.local/schemas/lorebook-v3.json",
      spec: "lorebook_v3",
      data: {
        name: "测试",
        description: "",
        scan_depth: 2,
        token_budget: 600,
        recursive_scanning: false,
        extensions: {},
        entries: [{
          keys: ["古宅"],
          content: "古宅的回廊总比外面更长。",
          enabled: true,
          insertion_order: 10,
          use_regex: false,
          extensions: {
            trpg_master: {
              kind: "fact",
              scene_ids: ["missing_scene"],
              npc_ids: ["missing_npc"],
              required_clue_ids: ["missing_clue"],
            },
          },
        }],
      },
    };

    const diagnostics = validateProject(project);
    expect(diagnostics).toContainEqual(expect.objectContaining({
      level: "error",
      message: expect.stringContaining("Lorebook 场景 missing_scene 不存在"),
    }));
    expect(diagnostics).toContainEqual(expect.objectContaining({
      level: "error",
      message: expect.stringContaining("Lorebook NPC missing_npc 不存在"),
    }));
  });
});
