import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultProject } from "../domain/default-project";
import { defaultNode, enableSpatial } from "../domain/spatial";
import type { EditorProject, SceneDefinition } from "../domain/types";
import { useEditorStore } from "./editor-store";

function room(): SceneDefinition {
  return {
    name: "房间",
    aliases: [],
    description: "房间描述",
    exits: [],
    npcs_present: [],
    encounters: [],
    tags: [],
    document: null,
    asset_id: null,
    extensions: {},
  };
}

function referenceProject(): EditorProject {
  const project = enableSpatial(createDefaultProject());
  project.module.scenes.room = room();
  project.module.spatial!.nodes.room = defaultNode();
  project.module.spatial!.items.key = {
    label: "钥匙",
    states: { charge: { initial: 0, minimum: 0, maximum: 1 } },
  };
  project.module.spatial!.connections.door = {
    source_scene_id: "opening_scene",
    target_scene_id: "room",
    bidirectional: true,
    visible_when: { op: "always", value: true },
    requires: {
      op: "item",
      item_id: "key",
      quantity: 1,
      minimum_states: { charge: 1 },
    },
    remember_unlock: true,
    costs: [{ kind: "adjust_item_state", item_id: "key", state: "charge", delta: -1 }],
  };
  project.module.clues.info = {
    text: "信息",
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
  project.module.spatial!.points.desk = {
    scene_id: "opening_scene",
    name: "书桌",
    description: "",
    visible_when: { op: "clue", clue_id: "info" },
    actions: {
      search: {
        intent: "search",
        aliases: [],
        requires: { op: "always", value: true },
        check: null,
        repeat: false,
        success: [
          { kind: "grant_clue", clue_id: "info" },
          { kind: "unlock_connection", connection_id: "door" },
          { kind: "reveal_scene", scene_id: "room" },
        ],
        failure: [],
      },
      read: {
        intent: "read",
        aliases: [],
        requires: { op: "completed", point_id: "desk", action_id: "search" },
        check: null,
        repeat: false,
        success: [],
        failure: [],
      },
    },
  };
  return project;
}

describe("Spatial reference editing", () => {
  beforeEach(() => {
    useEditorStore.getState().replaceProject(referenceProject(), true);
  });

  it("renames scene and clue IDs across nodes, conditions and effects", () => {
    expect(useEditorStore.getState().renameEntity("scene", "opening_scene", "foyer")).toBe(true);
    expect(useEditorStore.getState().renameEntity("clue", "info", "proof")).toBe(true);
    const spatial = useEditorStore.getState().project.module.spatial!;
    expect(spatial.nodes.foyer).toBeDefined();
    expect(spatial.connections.door.source_scene_id).toBe("foyer");
    expect(spatial.points.desk.scene_id).toBe("foyer");
    expect(spatial.points.desk.visible_when).toMatchObject({ clue_id: "proof" });
    expect(spatial.points.desk.actions.search.success[0]).toMatchObject({ clue_id: "proof" });
  });

  it("renames every Spatial-owned ID without leaving stale references", () => {
    const store = useEditorStore.getState();
    expect(store.renameSpatialEntity("item", "key", "brass_key")).toBe(true);
    expect(store.renameSpatialEntity("state", "charge", "charge", "brass_key")).toBe(true);
    expect(store.renameSpatialEntity("state", "charge", "power", "brass_key")).toBe(true);
    expect(store.renameSpatialEntity("connection", "door", "locked_door")).toBe(true);
    expect(store.renameSpatialEntity("point", "desk", "writing_desk")).toBe(true);
    expect(store.renameSpatialEntity("action", "search", "search", "writing_desk")).toBe(true);
    expect(store.renameSpatialEntity("action", "search", "inspect", "writing_desk")).toBe(true);
    const spatial = useEditorStore.getState().project.module.spatial!;
    expect(spatial.connections.locked_door.requires).toMatchObject({
      item_id: "brass_key",
      minimum_states: { power: 1 },
    });
    expect(spatial.connections.locked_door.costs[0]).toMatchObject({
      item_id: "brass_key",
      state: "power",
    });
    expect(spatial.points.writing_desk.actions.read.requires).toMatchObject({
      point_id: "writing_desk",
      action_id: "inspect",
    });
    expect(spatial.points.writing_desk.actions.inspect.success[1]).toMatchObject({
      connection_id: "locked_door",
    });
  });

  it("makes a condition unsatisfiable instead of opening it when its item is deleted", () => {
    useEditorStore.getState().removeSpatialEntity("item", "key");
    const connection = useEditorStore.getState().project.module.spatial!.connections.door;
    expect(connection.requires).toEqual({ op: "always", value: false });
    expect(connection.costs).toEqual([]);
  });

  it("closes every affected composite condition when an item is deleted", () => {
    const project = structuredClone(useEditorStore.getState().project);
    project.module.initial_state.flags.door_found = false;
    const door = project.module.spatial!.connections.door;
    const keyRequirement = door.requires;
    project.module.spatial!.connections = {
      all_door: {
        ...door,
        requires: {
          op: "all",
          conditions: [
            { op: "flag", flag_id: "door_found", value: true },
            keyRequirement,
          ],
        },
      },
      any_door: {
        ...door,
        requires: {
          op: "any",
          conditions: [{ op: "always", value: true }, keyRequirement],
        },
      },
      not_door: {
        ...door,
        requires: { op: "not", condition: keyRequirement },
      },
      nested_door: {
        ...door,
        requires: {
          op: "all",
          conditions: [
            { op: "flag", flag_id: "door_found", value: true },
            {
              op: "any",
              conditions: [
                { op: "always", value: true },
                { op: "not", condition: keyRequirement },
              ],
            },
          ],
        },
      },
    };
    useEditorStore.getState().replaceProject(project, false);
    useEditorStore.getState().removeSpatialEntity("item", "key");
    const connections = useEditorStore.getState().project.module.spatial!.connections;
    for (const id of ["all_door", "any_door", "not_door", "nested_door"]) {
      expect(connections[id].requires).toEqual({ op: "always", value: false });
    }
  });

  it("closes a composite condition instead of dropping a deleted state threshold", () => {
    const project = structuredClone(useEditorStore.getState().project);
    project.module.initial_state.flags.door_found = false;
    project.module.spatial!.connections.door.requires = {
      op: "all",
      conditions: [
        { op: "flag", flag_id: "door_found", value: true },
        project.module.spatial!.connections.door.requires,
      ],
    };
    useEditorStore.getState().replaceProject(project, false);
    useEditorStore.getState().removeSpatialEntity("state", "charge", "key");
    const connection = useEditorStore.getState().project.module.spatial!.connections.door;
    expect(connection.requires).toEqual({ op: "always", value: false });
    expect(connection.costs).toEqual([]);
  });

  it("blocks deleting container parents and cleans dependent entities for leaf deletion", () => {
    const project = structuredClone(useEditorStore.getState().project);
    project.module.scenes.house = room();
    project.module.spatial!.nodes.house = {
      ...defaultNode(),
      kind: "container",
      entry_scene_id: "room",
    };
    project.module.spatial!.nodes.room.parent_scene_id = "house";
    useEditorStore.getState().replaceProject(project, false);
    useEditorStore.getState().removeEntity("scene", "house");
    expect(useEditorStore.getState().project.module.scenes.house).toBeDefined();

    const detachable = structuredClone(useEditorStore.getState().project);
    detachable.module.spatial!.nodes.house.entry_scene_id = "opening_scene";
    useEditorStore.getState().replaceProject(detachable, false);
    useEditorStore.getState().removeEntity("scene", "room");
    const spatial = useEditorStore.getState().project.module.spatial!;
    expect(spatial.nodes.room).toBeUndefined();
    expect(spatial.connections.door).toBeUndefined();
    expect(spatial.points.desk.actions.search.success).toHaveLength(1);
  });
});
