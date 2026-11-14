import { describe, expect, it } from "vitest";
import { createDefaultProject } from "../../domain/default-project";
import { enableSpatial } from "../../domain/spatial";
import { parseEditorProject, parseProjectText } from "./project-io";

function projectWithNestedSpatial() {
  const project = enableSpatial(createDefaultProject());
  project.module.scenes.second_room = {
    ...structuredClone(project.module.scenes.opening_scene),
    name: "第二房间",
  };
  project.module.spatial!.nodes.second_room = {
    kind: "location",
    parent_scene_id: null,
    entry_scene_id: null,
    hidden: true,
  };
  project.module.initial_state.flags.unlocked = false;
  project.module.initial_state.case_clocks.pressure = 0;
  project.module.initial_state.case_clock_definitions = { pressure: { max: 3 } };
  project.module.clues.secret = {
    text: "秘密",
    category: "investigation",
    type: "hidden",
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
  project.module.spatial!.items.key = {
    label: "充能钥匙",
    states: { charge: { initial: 0, minimum: 0, maximum: 1 } },
  };
  project.module.spatial!.connections.door = {
    source_scene_id: "opening_scene",
    target_scene_id: "second_room",
    bidirectional: true,
    visible_when: { op: "flag", flag_id: "unlocked", value: true },
    requires: {
      op: "all",
      conditions: [
        { op: "item", item_id: "key", quantity: 1, minimum_states: { charge: 1 } },
        { op: "not", condition: { op: "completed", point_id: "desk", action_id: "read" } },
      ],
    },
    remember_unlock: true,
    costs: [{ kind: "adjust_item_state", item_id: "key", state: "charge", delta: -1 }],
  };
  project.module.spatial!.points.desk = {
    scene_id: "opening_scene",
    name: "书桌",
    description: "公开描述",
    visible_when: { op: "always", value: true },
    actions: {
      read: {
        intent: "read",
        aliases: ["翻阅", "阅读文件"],
        requires: { op: "any", conditions: [{ op: "clue", clue_id: "secret" }] },
        check: { skill: "spot_hidden", difficulty: "hard" },
        repeat: true,
        success: [
          { kind: "grant_clue", clue_id: "secret" },
          { kind: "give_item", item_id: "key", quantity: 1 },
          { kind: "adjust_item_state", item_id: "key", state: "charge", delta: 1 },
          { kind: "set_flag", flag_id: "unlocked", value: true },
          { kind: "reveal_scene", scene_id: "second_room" },
          { kind: "unlock_connection", connection_id: "door" },
          { kind: "advance_clock", clock_id: "pressure", amount: 1 },
        ],
        failure: [{ kind: "advance_clock", clock_id: "pressure", amount: 1 }],
      },
    },
  };
  return project;
}

describe("Spatial project persistence", () => {
  it("round-trips every condition, effect and numeric state without a parallel format", () => {
    const project = projectWithNestedSpatial();
    const opened = parseProjectText(JSON.stringify(project)).project;
    expect(opened.module.spatial).toEqual(project.module.spatial);
    expect(parseEditorProject(JSON.parse(JSON.stringify(opened))).module.spatial).toEqual(
      project.module.spatial,
    );
    expect(opened.manifest.capabilities).toContain("spatial_investigation");
    expect(opened.manifest.min_engine_version).toBe("1.1.0");
  });

  it("fills only model defaults while preserving authored nested values", () => {
    const raw = JSON.parse(JSON.stringify(projectWithNestedSpatial()));
    const point = raw.module.spatial.points.desk;
    const action = point.actions.read;
    delete point.description;
    delete point.visible_when;
    delete action.aliases;
    delete action.requires;
    delete action.repeat;
    delete action.failure;
    delete action.check.difficulty;
    delete raw.module.spatial.nodes.opening_scene.hidden;
    delete raw.module.spatial.items.key.states.charge.initial;

    const opened = parseEditorProject(raw);
    const openedPoint = opened.module.spatial!.points.desk;
    expect(openedPoint.description).toBe("");
    expect(openedPoint.visible_when).toEqual({ op: "always", value: true });
    expect(openedPoint.actions.read).toMatchObject({
      aliases: [],
      requires: { op: "always", value: true },
      repeat: false,
      failure: [],
      check: { skill: "spot_hidden", difficulty: "regular" },
      success: expect.arrayContaining([{ kind: "grant_clue", clue_id: "secret" }]),
    });
    expect(opened.module.spatial!.nodes.opening_scene.hidden).toBe(false);
    expect(opened.module.spatial!.items.key.states.charge.initial).toBe(0);
  });

  it("accepts the reference example's empty asset map without dropping Spatial data", () => {
    const raw = JSON.parse(JSON.stringify(projectWithNestedSpatial()));
    raw.module.assets = {};
    const opened = parseEditorProject(raw);
    expect(opened.module.assets).toEqual({ npcs: {}, scenes: {}, clues: {} });
    expect(opened.module.spatial?.points.desk.actions.read.intent).toBe("read");
    expect(opened.module.spatial?.items.key.states.charge.maximum).toBe(1);
  });

  it("does not add spatial or capabilities to a flat project", () => {
    const project = createDefaultProject();
    const opened = parseEditorProject(JSON.parse(JSON.stringify(project)));
    expect("spatial" in opened.module).toBe(false);
    expect(opened.manifest.capabilities).toEqual([]);
    expect(opened.manifest.min_engine_version).toBe(project.manifest.min_engine_version);
  });
});
