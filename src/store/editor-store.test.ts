import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultProject } from "../domain/default-project";
import { useEditorStore } from "./editor-store";

describe("editor store", () => {
  beforeEach(() => {
    useEditorStore.getState().replaceProject(createDefaultProject(), true);
  });

  it("adds entities and supports undo and redo", () => {
    const store = useEditorStore.getState();
    store.addEntity("scene");

    expect(Object.keys(useEditorStore.getState().project.module.scenes)).toHaveLength(2);
    expect(useEditorStore.getState().selection.kind).toBe("scene");

    useEditorStore.getState().undo();
    expect(Object.keys(useEditorStore.getState().project.module.scenes)).toHaveLength(1);

    useEditorStore.getState().redo();
    expect(Object.keys(useEditorStore.getState().project.module.scenes)).toHaveLength(2);
  });

  it("cascades NPC deletion through scenes and clues", () => {
    const store = useEditorStore.getState();
    store.addEntity("npc");
    const npcId = useEditorStore.getState().selection.id!;
    const project = structuredClone(useEditorStore.getState().project);
    project.module.scenes.opening_scene.npcs_present = [npcId];
    project.module.clues.witness = {
      text: "证人看见了来访者。",
      category: "npc",
      type: "obvious",
      tier: 1,
      source: null,
      related_npcs: [npcId],
      related_scenes: [],
      asset_id: null,
      granted_item: null,
      flag_effects: {},
      discovery_rules: [],
      initially_known: false,
      discovery_notes: "",
      extensions: {},
    };
    store.replaceProject(project, false);

    useEditorStore.getState().removeEntity("npc", npcId);
    const updated = useEditorStore.getState().project;

    expect(updated.module.npcs[npcId]).toBeUndefined();
    expect(updated.module.scenes.opening_scene.npcs_present).toEqual([]);
    expect(updated.module.clues.witness.related_npcs).toEqual([]);
  });

  it("renames scene IDs and rewrites references atomically", () => {
    const project = structuredClone(useEditorStore.getState().project);
    project.module.npcs.keeper = {
      name: "守门人", visible_tags: [], secret: "", hp: 10, max_hp: 10,
      disposition: "neutral", current_location: "opening_scene", attributes: {}, skills: {},
      conditions: [], spells: [], notes: "", asset_id: null, initial_reveal: 0,
      initial_reveal_entries: [], extensions: {},
    };
    useEditorStore.getState().replaceProject(project, false);

    expect(useEditorStore.getState().renameEntity("scene", "opening_scene", "prologue")).toBe(true);
    const updated = useEditorStore.getState().project.module;
    expect(updated.entry_scene_id).toBe("prologue");
    expect(updated.npcs.keeper.current_location).toBe("prologue");
    expect(updated.scenes.prologue).toBeDefined();
  });

  it("duplicates an entity into an independent copy", () => {
    useEditorStore.getState().duplicateEntity("scene", "opening_scene");
    const selected = useEditorStore.getState().selection.id!;
    useEditorStore.getState().project.module.scenes[selected].name = "mutated outside action";
    expect(useEditorStore.getState().project.module.scenes.opening_scene.name).not.toBe("mutated outside action");
  });

  it("registers duplicated initially-known clues in known_clue_ids", () => {
    const project = structuredClone(useEditorStore.getState().project);
    project.module.clues.rumor = {
      text: "流传的传闻。",
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
    project.module.initial_state.known_clue_ids = ["rumor"];
    useEditorStore.getState().replaceProject(project, false);

    useEditorStore.getState().duplicateEntity("clue", "rumor");
    const updated = useEditorStore.getState().project;
    const duplicatedId = useEditorStore.getState().selection.id!;

    expect(updated.module.clues[duplicatedId].initially_known).toBe(true);
    expect(updated.module.initial_state.known_clue_ids).toContain(duplicatedId);
  });

  it("cascades NPC deletion through encounters and reveal effects", () => {
    const store = useEditorStore.getState();
    store.addEntity("npc");
    const npcId = useEditorStore.getState().selection.id!;
    const project = structuredClone(useEditorStore.getState().project);
    project.module.scenes.opening_scene.encounters = [{
      id: "meet_guard",
      npc_id: npcId,
      availability: "guaranteed",
      required_flags: {},
      forbidden_flags: {},
      luck_difficulty: "regular",
      repeat: "once",
      on_present_text: "",
      on_absent_text: "",
    }];
    project.module.clues.trail = {
      text: "追踪痕迹。",
      category: "investigation",
      type: "obvious",
      tier: 1,
      source: null,
      related_npcs: [],
      related_scenes: [],
      asset_id: null,
      granted_item: null,
      flag_effects: {},
      discovery_rules: [{
        intent: "talk",
        targets: ["门卫"],
        approach_text: "",
        skill: null,
        check_type: null,
        difficulty: "regular",
        requires_success: false,
        sanity_severity: null,
        npc_reveals: [{ npc_id: npcId, tier: 1, entry_text: "门卫提起昨夜的事。" }],
        fallback: null,
      }],
      initially_known: false,
      discovery_notes: "",
      extensions: {},
    };
    store.replaceProject(project, false);

    useEditorStore.getState().removeEntity("npc", npcId);
    const updated = useEditorStore.getState().project;

    expect(updated.module.scenes.opening_scene.encounters).toEqual([]);
    expect(updated.module.clues.trail.discovery_rules[0].npc_reveals).toEqual([]);
  });

  it("rewrites encounter and reveal references when renaming an NPC", () => {
    const store = useEditorStore.getState();
    store.addEntity("npc");
    const npcId = useEditorStore.getState().selection.id!;
    const project = structuredClone(useEditorStore.getState().project);
    project.module.scenes.opening_scene.encounters = [{
      id: "meet_guard",
      npc_id: npcId,
      availability: "guaranteed",
      required_flags: {},
      forbidden_flags: {},
      luck_difficulty: "regular",
      repeat: "once",
      on_present_text: "",
      on_absent_text: "",
    }];
    store.replaceProject(project, false);

    expect(useEditorStore.getState().renameEntity("npc", npcId, "renamed_guard")).toBe(true);
    const updated = useEditorStore.getState().project;
    expect(updated.module.scenes.opening_scene.encounters[0].npc_id).toBe("renamed_guard");
  });
});
