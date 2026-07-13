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
});
