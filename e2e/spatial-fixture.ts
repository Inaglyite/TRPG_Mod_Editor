import { createDefaultProject } from "../src/domain/default-project";
import type { SceneDefinition } from "../src/domain/types";

function scene(name: string, exits: string[] = []): SceneDefinition {
  return {
    name,
    aliases: [],
    description: `${name}的公开描述。`,
    exits,
    npcs_present: [],
    encounters: [],
    tags: [],
    document: null,
    asset_id: null,
    extensions: {},
  };
}

export function spatialFixture() {
  const project = createDefaultProject();
  Object.assign(project.manifest, {
    id: "example.spatial-investigation",
    title: "寓所调查：空间机制示例",
    author: "模组作者",
    license: "CC BY 4.0",
    min_engine_version: "1.1.0",
    capabilities: ["spatial_investigation"],
  });
  project.module.entry_scene_id = "house";
  project.module.scenes = {
    house: scene("旧寓所"),
    foyer: scene("门厅", ["bedroom"]),
    bedroom: scene("卧室", ["foyer", "secret"]),
    secret: scene("隐藏房间", ["bedroom"]),
  };
  project.module.clues.score = {
    text: "残谱写着一段反复涂改的节拍。",
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
  project.module.initial_state.flags = { door_found: false };
  project.module.initial_state.case_clocks = { pressure: 0 };
  project.module.initial_state.case_clock_definitions = { pressure: { name: "外界压力", max: 3 } };
  project.module.progression = { essential_clue_ids: ["score"] };
  project.module.spatial = {
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
            { op: "item", item_id: "charged_key", quantity: 1, minimum_states: { charge: 1 } },
          ],
        },
        remember_unlock: true,
        costs: [{ kind: "adjust_item_state", item_id: "charged_key", state: "charge", delta: -1 }],
      },
    },
    points: {
      cabinet: {
        scene_id: "foyer",
        name: "门边衣柜",
        description: "可以打开的普通衣柜。",
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
      lamp: {
        scene_id: "foyer",
        name: "充能灯",
        description: "锁板配套的教学装置。",
        visible_when: { op: "always", value: true },
        actions: {
          charge: {
            intent: "use",
            aliases: [],
            requires: { op: "item", item_id: "charged_key", quantity: 1, minimum_states: {} },
            check: null,
            repeat: true,
            success: [{ kind: "adjust_item_state", item_id: "charged_key", state: "charge", delta: 1 }],
            failure: [],
          },
        },
      },
      fireplace: {
        scene_id: "bedroom",
        name: "壁炉与写字台",
        description: "需要仔细搜索的调查点。",
        visible_when: { op: "always", value: true },
        actions: {
          search: {
            intent: "search",
            aliases: [],
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
    },
    items: {
      charged_key: { label: "教学钥匙", states: { charge: { initial: 0, minimum: 0, maximum: 1 } } },
    },
  };
  return project;
}
