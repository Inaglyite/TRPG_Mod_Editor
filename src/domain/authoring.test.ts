import { describe, expect, it } from "vitest";
import { createDefaultProject } from "./default-project";
import {
  authoringSteps,
  inspectProjectEdit,
  playerScenePreview,
  reachableSceneIds,
  storyGraph,
} from "./authoring";
import { useEditorStore } from "../store/editor-store";

describe("authoring workflow", () => {
  it("repairs selection on undo and refactors asset/Lorebook references without losing custom metadata", () => {
    useEditorStore.getState().replaceProject(createDefaultProject());
    useEditorStore.getState().addEntity("scene");
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().selection.kind).toBe("overview");
    const project = createDefaultProject();
    project.module.assets.scenes.cover = {
      file: "assets/cover.webp",
      label: "封面",
      alt: "",
      media_type: "image/webp",
      reveal_on: [
        {
          event: "scene_entered",
          entity_id: "opening_scene",
          match_all: [],
          match_any: [],
        },
      ],
    };
    project.lorebook = {
      data: {
        entries: [
          {
            extensions: {
              trpg_master: { scene_ids: ["opening_scene"], custom: "preserve" },
            },
          },
        ],
      },
    };
    useEditorStore.getState().replaceProject(project);
    expect(
      useEditorStore.getState().renameEntity("scene", "opening_scene", "hall"),
    ).toBe(true);
    const result = useEditorStore.getState().project;
    expect(result.module.assets.scenes.cover.reveal_on[0].entity_id).toBe(
      "hall",
    );
    expect(JSON.stringify(result.lorebook)).toContain('"scene_ids":["hall"]');
    expect(JSON.stringify(result.lorebook)).toContain('"custom":"preserve"');
    useEditorStore.getState().undo();
    expect(
      useEditorStore.getState().project.module.assets.scenes.cover.reveal_on[0]
        .entity_id,
    ).toBe("opening_scene");
  });
  it("finds directed reachability without looping on cyclic scenes", () => {
    const project = createDefaultProject();
    project.module.scenes.second = {
      ...structuredClone(project.module.scenes.opening_scene),
      name: "第二场景",
      exits: ["opening_scene"],
    };
    project.module.scenes.isolated = structuredClone(
      project.module.scenes.opening_scene,
    );
    project.module.scenes.opening_scene.exits = ["second", "missing"];
    expect([...reachableSceneIds(project)]).toEqual([
      "opening_scene",
      "second",
    ]);
    const graph = storyGraph(project, "scene");
    expect(graph.nodes.find((node) => node.id === "isolated")?.reachable).toBe(
      false,
    );
    expect(graph.nodes.find((node) => node.id === "opening_scene")?.entry).toBe(
      true,
    );
    expect(authoringSteps(project)[1].done).toBe(false);
  });

  it("rejects malformed source without changing the project and keeps extensions intact", () => {
    const project = createDefaultProject();
    project.module.scenes.opening_scene.extensions = {
      custom: { route: [1, 2], secret: "author-only" },
    };
    expect(
      inspectProjectEdit(JSON.stringify(project)).project.module.scenes
        .opening_scene.extensions,
    ).toEqual(project.module.scenes.opening_scene.extensions);
    const malformed = structuredClone(project);
    (
      malformed.module.scenes.opening_scene as unknown as { exits: unknown }
    ).exits = "broken";
    expect(() => inspectProjectEdit(JSON.stringify(malformed))).toThrow();
    expect(() =>
      inspectProjectEdit(
        JSON.stringify({
          ...project,
          unexpectedData: "must not silently lose this",
        }),
      ),
    ).toThrow("未知工程字段");
  });

  it("normalizes legal minimal discovery/encounter drafts and array asset reveal rules", () => {
    const project = createDefaultProject();
    const raw = JSON.parse(JSON.stringify(project));
    raw.module.clues.note = {
      text: "记事本",
      discovery_rules: [{ intent: "read", targets: ["记事本"] }],
    };
    raw.module.scenes.opening_scene.encounters = [
      { id: "e1", npc_id: "missing" },
    ];
    raw.module.assets.scenes.room = { file: "assets/room.webp" };
    const parsed = inspectProjectEdit(JSON.stringify(raw));
    expect(
      parsed.project.module.clues.note.discovery_rules[0].npc_reveals,
    ).toEqual([]);
    expect(
      parsed.project.module.scenes.opening_scene.encounters[0].required_flags,
    ).toEqual({});
    expect(parsed.project.module.assets.scenes.room.reveal_on).toEqual([]);
    expect(
      parsed.diagnostics.some((item) => item.path.includes("npc_id")),
    ).toBe(true);
  });

  it("keeps incomplete authoring content editable while diagnosing it", () => {
    const project = createDefaultProject();
    project.module.scenes.opening_scene.description = "";
    const result = inspectProjectEdit(JSON.stringify(project));
    expect(result.project.module.scenes.opening_scene.description).toBe("");
    expect(result.diagnostics.some((item) => item.level === "error")).toBe(
      true,
    );
  });

  it("never includes NPC secrets, hidden clues, discovery notes or private memory in player preview", () => {
    const store = useEditorStore.getState();
    store.replaceProject(createDefaultProject());
    store.addEntity("npc");
    let project = structuredClone(useEditorStore.getState().project);
    const npcId = Object.keys(project.module.npcs)[0];
    project.module.npcs[npcId].secret = "SECRET_NPC";
    project.module.npcs[npcId].notes = "SECRET_NOTES";
    project.module.scenes.opening_scene.npcs_present = [npcId];
    useEditorStore.getState().replaceProject(project);
    useEditorStore.getState().addEntity("clue");
    project = structuredClone(useEditorStore.getState().project);
    const clueId = Object.keys(project.module.clues)[0];
    project.module.clues[clueId].text = "SECRET_CLUE";
    project.module.clues[clueId].discovery_notes = "SECRET_DISCOVERY";
    project.module.initial_state.private_memory.hidden_facts = {
      truth: "SECRET_MEMORY",
    };
    const rendered = JSON.stringify(
      playerScenePreview(project, "opening_scene"),
    );
    expect(rendered).not.toContain("SECRET_");
    project.module.initial_state.known_clue_ids = [clueId];
    expect(playerScenePreview(project, "opening_scene")?.clues).toEqual([
      "SECRET_CLUE",
    ]);
    expect(
      JSON.stringify(playerScenePreview(project, "opening_scene")),
    ).not.toContain("SECRET_DISCOVERY");
  });

  it("records bidirectional connections and bulk source edits as single undoable changes", () => {
    useEditorStore.getState().replaceProject(createDefaultProject());
    useEditorStore.getState().addEntity("scene");
    const id = useEditorStore.getState().selection.id!;
    const before = useEditorStore.getState().history.length;
    useEditorStore.getState().setSceneLink("opening_scene", id, true, true);
    expect(useEditorStore.getState().history).toHaveLength(before + 1);
    expect(useEditorStore.getState().project.module.scenes[id].exits).toEqual([
      "opening_scene",
    ]);
    useEditorStore.getState().undo();
    expect(
      useEditorStore.getState().project.module.scenes.opening_scene.exits,
    ).toEqual([]);
    const edited = structuredClone(useEditorStore.getState().project);
    edited.manifest.title = "完整源码修改";
    useEditorStore.getState().applyProjectEdit(edited);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.manifest.title).toBe("无题调查");
    useEditorStore.getState().setSceneLink("opening_scene", "missing", true);
    expect(
      useEditorStore.getState().project.module.scenes.opening_scene.exits,
    ).toEqual([]);
  });
});
