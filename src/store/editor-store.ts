import { create } from "zustand";
import { createDefaultProject } from "../domain/default-project";
import type {
  ClueDefinition,
  EditorProject,
  EndingDefinition,
  EntityKind,
  EntitySelection,
  ModuleManifest,
  NpcDefinition,
  SceneDefinition,
} from "../domain/types";
import { loadDraft } from "../features/project/project-io";

const HISTORY_LIMIT = 80;

interface EditorStore {
  project: EditorProject;
  selection: EntitySelection;
  history: EditorProject[];
  future: EditorProject[];
  revision: number;
  savedSnapshot: string;
  select: (selection: EntitySelection) => void;
  replaceProject: (project: EditorProject, markSaved?: boolean) => void;
  resetProject: () => void;
  markSaved: () => void;
  undo: () => void;
  redo: () => void;
  updateManifest: (manifest: ModuleManifest) => void;
  updateOpeningPrompt: (openingPrompt: string) => void;
  updateScene: (id: string, scene: SceneDefinition) => void;
  updateNpc: (id: string, npc: NpcDefinition) => void;
  updateClue: (id: string, clue: ClueDefinition) => void;
  updateEnding: (id: string, ending: EndingDefinition) => void;
  addEntity: (kind: Exclude<EntityKind, "manifest">) => void;
  removeEntity: (kind: Exclude<EntityKind, "manifest">, id: string) => void;
}

function snapshot(project: EditorProject): string {
  return JSON.stringify(project);
}

function nextId(prefix: string, entities: Record<string, unknown>): string {
  let index = Object.keys(entities).length + 1;
  while (`${prefix}_${index}` in entities) index += 1;
  return `${prefix}_${index}`;
}

function commit(
  state: EditorStore,
  project: EditorProject,
  selection: EntitySelection = state.selection,
): Partial<EditorStore> {
  return {
    project,
    selection,
    history: [...state.history.slice(-(HISTORY_LIMIT - 1)), state.project],
    future: [],
    revision: state.revision + 1,
  };
}

function cloneProject(project: EditorProject): EditorProject {
  return structuredClone(project);
}

const initialProject = loadDraft();

export const useEditorStore = create<EditorStore>((set, get) => ({
  project: initialProject,
  selection: { kind: "manifest" },
  history: [],
  future: [],
  revision: 0,
  savedSnapshot: snapshot(initialProject),

  select: (selection) => set({ selection }),

  replaceProject: (project, markSaved = true) =>
    set((state) => ({
      project: cloneProject(project),
      selection: { kind: "manifest" },
      history: [],
      future: [],
      revision: state.revision + 1,
      savedSnapshot: markSaved ? snapshot(project) : state.savedSnapshot,
    })),

  resetProject: () => {
    const project = createDefaultProject();
    set((state) => ({
      project,
      selection: { kind: "manifest" },
      history: [],
      future: [],
      revision: state.revision + 1,
      savedSnapshot: snapshot(project),
    }));
  },

  markSaved: () => set((state) => ({ savedSnapshot: snapshot(state.project) })),

  undo: () => {
    const state = get();
    const previous = state.history.at(-1);
    if (!previous) return;
    set({
      project: previous,
      history: state.history.slice(0, -1),
      future: [state.project, ...state.future].slice(0, HISTORY_LIMIT),
      revision: state.revision + 1,
    });
  },

  redo: () => {
    const state = get();
    const next = state.future[0];
    if (!next) return;
    set({
      project: next,
      history: [...state.history.slice(-(HISTORY_LIMIT - 1)), state.project],
      future: state.future.slice(1),
      revision: state.revision + 1,
    });
  },

  updateManifest: (manifest) =>
    set((state) => {
      const project = cloneProject(state.project);
      project.manifest = manifest;
      return commit(state, project);
    }),

  updateOpeningPrompt: (openingPrompt) =>
    set((state) => {
      if (state.project.module.opening_prompt === openingPrompt) return state;
      const project = cloneProject(state.project);
      project.module.opening_prompt = openingPrompt;
      return commit(state, project);
    }),

  updateScene: (id, scene) =>
    set((state) => {
      const project = cloneProject(state.project);
      project.module.scenes[id] = scene;
      return commit(state, project);
    }),

  updateNpc: (id, npc) =>
    set((state) => {
      const project = cloneProject(state.project);
      project.module.npcs[id] = npc;
      return commit(state, project);
    }),

  updateClue: (id, clue) =>
    set((state) => {
      const project = cloneProject(state.project);
      project.module.clues[id] = clue;
      const known = new Set(project.module.initial_state.known_clue_ids);
      if (clue.initially_known) known.add(id);
      else known.delete(id);
      project.module.initial_state.known_clue_ids = [...known];
      return commit(state, project);
    }),

  updateEnding: (id, ending) =>
    set((state) => {
      const project = cloneProject(state.project);
      project.module.endings[id] = ending;
      return commit(state, project);
    }),

  addEntity: (kind) =>
    set((state) => {
      const project = cloneProject(state.project);
      let id: string;
      if (kind === "scene") {
        id = nextId("scene", project.module.scenes);
        project.module.scenes[id] = {
          name: "新场景",
          description: "",
          exits: [],
          npcs_present: [],
          tags: [],
          document: null,
          asset_id: null,
          extensions: {},
        };
      } else if (kind === "npc") {
        id = nextId("npc", project.module.npcs);
        project.module.npcs[id] = {
          name: "新人物",
          visible_tags: [],
          secret: "",
          hp: 10,
          max_hp: 10,
          disposition: "neutral",
          current_location: project.module.entry_scene_id,
          attributes: {},
          skills: {},
          conditions: [],
          spells: [],
          notes: "",
          asset_id: null,
          initial_reveal: 0,
          initial_reveal_entries: [],
          extensions: {},
        };
      } else if (kind === "clue") {
        id = nextId("clue", project.module.clues);
        project.module.clues[id] = {
          text: "新线索",
          category: "investigation",
          type: "obvious",
          tier: 1,
          source: null,
          related_npcs: [],
          related_scenes: [],
          asset_id: null,
          initially_known: false,
          discovery_notes: "",
          extensions: {},
        };
      } else {
        id = nextId("ending", project.module.endings);
        project.module.endings[id] = {
          title: "新结局",
          trigger: "",
          description: "",
          ending_type: "neutral",
        };
      }
      return commit(state, project, { kind, id });
    }),

  removeEntity: (kind, id) =>
    set((state) => {
      if (kind === "scene" && id === state.project.module.entry_scene_id) return state;
      const project = cloneProject(state.project);
      if (kind === "scene") {
        delete project.module.scenes[id];
        for (const scene of Object.values(project.module.scenes)) {
          scene.exits = scene.exits.filter((exitId) => exitId !== id);
        }
        for (const npc of Object.values(project.module.npcs)) {
          if (npc.current_location === id) npc.current_location = null;
        }
        for (const clue of Object.values(project.module.clues)) {
          clue.related_scenes = clue.related_scenes.filter((sceneId) => sceneId !== id);
        }
      } else if (kind === "npc") {
        delete project.module.npcs[id];
        for (const scene of Object.values(project.module.scenes)) {
          scene.npcs_present = scene.npcs_present.filter((npcId) => npcId !== id);
        }
        for (const clue of Object.values(project.module.clues)) {
          clue.related_npcs = clue.related_npcs.filter((npcId) => npcId !== id);
        }
      } else if (kind === "clue") {
        delete project.module.clues[id];
        project.module.initial_state.known_clue_ids =
          project.module.initial_state.known_clue_ids.filter((clueId) => clueId !== id);
        project.module.clue_links = project.module.clue_links.filter(
          (link) => link.from !== id && link.to !== id,
        );
      } else {
        delete project.module.endings[id];
      }
      return commit(state, project, { kind: "manifest" });
    }),
}));

export function isProjectDirty(state: Pick<EditorStore, "project" | "savedSnapshot">): boolean {
  return snapshot(state.project) !== state.savedSnapshot;
}
