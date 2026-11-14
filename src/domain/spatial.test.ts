import { describe, expect, it } from "vitest";
import { createDefaultProject } from "./default-project";
import { enableSpatial } from "./spatial";
import type { EditorProject, SceneDefinition, SpatialDefinition } from "./types";
import { validateProject } from "./validation";

function scene(name: string, exits: string[] = []): SceneDefinition {
  return {
    name,
    aliases: [],
    description: `${name}描述`,
    exits,
    npcs_present: [],
    encounters: [],
    tags: [],
    document: null,
    asset_id: null,
    extensions: {},
  };
}

export function spatialFixture(): EditorProject {
  const project = createDefaultProject();
  project.manifest.min_engine_version = "1.1.0";
  project.manifest.capabilities = ["spatial_investigation"];
  project.module.entry_scene_id = "house";
  project.module.scenes = {
    house: scene("旧寓所"),
    foyer: scene("门厅", ["bedroom"]),
    bedroom: scene("卧室", ["foyer", "secret"]),
    secret: scene("隐藏房间", ["bedroom"]),
  };
  project.module.clues.score = {
    text: "残谱",
    category: "investigation",
    type: "hidden",
    tier: 1,
    source: "bedroom",
    related_npcs: [],
    related_scenes: ["bedroom"],
    asset_id: null,
    granted_item: null,
    flag_effects: {},
    discovery_rules: [],
    initially_known: false,
    discovery_notes: "搜索壁炉",
    extensions: {},
  };
  project.module.initial_state.flags.door_found = false;
  project.module.initial_state.case_clocks.pressure = 0;
  project.module.initial_state.case_clock_definitions = {
    pressure: { name: "外界压力", max: 3 },
  };
  project.module.progression = { essential_clue_ids: ["score"] };
  const spatial: SpatialDefinition = {
    version: 1,
    nodes: {
      house: { kind: "container", parent_scene_id: null, entry_scene_id: "foyer", hidden: false },
      foyer: { kind: "location", parent_scene_id: "house", entry_scene_id: null, hidden: false },
      bedroom: { kind: "location", parent_scene_id: "house", entry_scene_id: null, hidden: false },
      secret: { kind: "location", parent_scene_id: "house", entry_scene_id: null, hidden: true },
    },
    connections: {
      secret_door: {
        source_scene_id: "bedroom",
        target_scene_id: "secret",
        bidirectional: true,
        visible_when: { op: "flag", flag_id: "door_found", value: true },
        requires: {
          op: "all",
          conditions: [
            { op: "flag", flag_id: "door_found", value: true },
            {
              op: "item",
              item_id: "charged_key",
              quantity: 1,
              minimum_states: { charge: 1 },
            },
          ],
        },
        remember_unlock: true,
        costs: [
          { kind: "adjust_item_state", item_id: "charged_key", state: "charge", delta: -1 },
        ],
      },
    },
    points: {
      fireplace: {
        scene_id: "bedroom",
        name: "壁炉",
        description: "仔细搜索",
        visible_when: { op: "always", value: true },
        actions: {
          search: {
            intent: "search",
            aliases: ["侦查"],
            requires: { op: "always", value: true },
            check: { skill: "spot_hidden", difficulty: "regular" },
            repeat: false,
            success: [
              { kind: "set_flag", flag_id: "door_found", value: true },
              { kind: "reveal_scene", scene_id: "secret" },
              { kind: "grant_clue", clue_id: "score" },
            ],
            failure: [
              { kind: "advance_clock", clock_id: "pressure", amount: 1 },
              { kind: "grant_clue", clue_id: "score" },
            ],
          },
        },
      },
      cabinet: {
        scene_id: "foyer",
        name: "衣柜",
        description: "可以取出钥匙",
        visible_when: { op: "always", value: true },
        actions: {
          take: {
            intent: "take",
            aliases: [],
            requires: { op: "always", value: true },
            check: null,
            repeat: false,
            success: [{ kind: "give_item", item_id: "charged_key", quantity: 1 }],
            failure: [],
          },
        },
      },
    },
    items: {
      charged_key: {
        label: "教学钥匙",
        states: { charge: { initial: 0, minimum: 0, maximum: 1 } },
      },
    },
  };
  project.module.spatial = spatial;
  return project;
}

function errors(project: EditorProject) {
  return validateProject(project).filter((diagnostic) => diagnostic.level === "error");
}

describe("Spatial v1 validation", () => {
  it("accepts the charged-key investigation without a custom Skill", () => {
    const project = spatialFixture();
    expect(errors(project)).toEqual([]);
    expect(project.skills).toBeUndefined();
    expect(project.manifest.capabilities).not.toContain("custom_skills");
  });

  it("keeps legacy projects flat until Spatial is explicitly enabled", () => {
    const legacy = createDefaultProject();
    expect(legacy.module.spatial).toBeUndefined();
    const enabled = enableSpatial(legacy);
    expect(enabled.module.spatial?.version).toBe(1);
    expect(enabled.manifest.capabilities).toContain("spatial_investigation");
    expect(enabled.manifest.min_engine_version).toBe("1.1.0");
    expect(legacy.module.spatial).toBeUndefined();
  });

  it("rejects parent cycles and container entry ownership errors", () => {
    const project = spatialFixture();
    project.module.spatial!.nodes.house.parent_scene_id = "house";
    expect(errors(project)).toContainEqual(expect.objectContaining({
      path: "module.spatial.nodes.house.parent_scene_id",
      message: expect.stringContaining("循环"),
    }));

    const wrongEntry = spatialFixture();
    const bedroom = wrongEntry.module.spatial!.nodes.bedroom;
    bedroom.kind = "container";
    bedroom.entry_scene_id = "bedroom";
    expect(errors(wrongEntry)).toContainEqual(expect.objectContaining({
      path: "module.spatial.nodes.bedroom.entry_scene_id",
    }));
  });

  it("rejects dangling condition and effect references", () => {
    const project = spatialFixture();
    project.module.spatial!.connections.secret_door.requires = {
      op: "item",
      item_id: "missing_key",
      quantity: 1,
      minimum_states: {},
    };
    project.module.spatial!.points.fireplace.actions.search.success.push({
      kind: "unlock_connection",
      connection_id: "missing_door",
    });
    const messages = errors(project).map((diagnostic) => diagnostic.message).join("\n");
    expect(messages).toContain("missing_key");
    expect(messages).toContain("missing_door");
  });

  it("requires a real fallback for essential checked point actions", () => {
    const project = spatialFixture();
    project.module.spatial!.points.fireplace.actions.search.failure = [
      { kind: "advance_clock", clock_id: "pressure", amount: 1 },
    ];
    expect(errors(project)).toContainEqual(expect.objectContaining({
      path: "module.spatial.points",
      message: expect.stringContaining("score"),
    }));
  });

  it("rejects container duplicate edges and shared stateful item quantities", () => {
    const project = spatialFixture();
    project.module.spatial!.connections.duplicate = {
      ...project.module.spatial!.connections.secret_door,
      costs: [],
    };
    project.module.spatial!.points.cabinet.actions.take.success[0] = {
      kind: "give_item",
      item_id: "charged_key",
      quantity: 2,
    };
    const messages = errors(project).map((diagnostic) => diagnostic.message).join("\n");
    expect(messages).toContain("重复定义");
    expect(messages).toContain("每个实例数量必须为 1");
  });

  it.each([
    { initial: 2, minimum: 0, maximum: 1, field: "initial" },
    { initial: 0, minimum: 1, maximum: 2, field: "initial" },
    { initial: 1, minimum: 2, maximum: 1, field: "minimum" },
  ])(
    "rejects inconsistent numeric state ranges: %j",
    ({ initial, minimum, maximum, field }) => {
      const project = spatialFixture();
      project.module.spatial!.items.charged_key.states.charge = {
        initial,
        minimum,
        maximum,
      };
      expect(errors(project)).toContainEqual(expect.objectContaining({
        path: `module.spatial.items.charged_key.states.charge.${field}`,
        message: expect.stringContaining(field === "initial" ? "初值" : "下限"),
      }));
    },
  );
});
