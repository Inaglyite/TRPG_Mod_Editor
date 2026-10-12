import { create } from "zustand";
import { createDefaultProject } from "../domain/default-project";
import type {
  ClueDefinition,
  EditorProject,
  EndingDefinition,
  EntitySelection,
  ModuleManifest,
  ModuleDefinition,
  NpcDefinition,
  SceneDefinition,
  SkillDraft,
  TreeEntityKind,
} from "../domain/types";
import { loadDraft } from "../features/project/project-io";

const HISTORY_LIMIT = 80;

interface EditorStore {
  project: EditorProject;
  selection: EntitySelection;
  history: EditorProject[];
  future: EditorProject[];
  revision: number;
  projectEpoch: number;
  savedSnapshot: string;
  select: (selection: EntitySelection) => void;
  replaceProject: (project: EditorProject, markSaved?: boolean) => void;
  resetProject: () => void;
  markSaved: () => void;
  undo: () => void;
  redo: () => void;
  updateManifest: (manifest: ModuleManifest) => void;
  updateOpeningPrompt: (openingPrompt: string) => void;
  updateProjectContent: (
    content: Pick<EditorProject, "keeperDocument" | "theme" | "lorebook"> & {
      initialState: ModuleDefinition["initial_state"];
      assets: ModuleDefinition["assets"];
      progression: NonNullable<ModuleDefinition["progression"]>;
    },
  ) => void;
  updateScene: (id: string, scene: SceneDefinition) => void;
  updateNpc: (id: string, npc: NpcDefinition) => void;
  updateClue: (id: string, clue: ClueDefinition) => void;
  updateEnding: (id: string, ending: EndingDefinition) => void;
  updateSkills: (skills: SkillDraft[]) => void;
  applyProjectEdit: (project: EditorProject) => void;
  setEntryScene: (id: string) => void;
  setSceneLink: (
    from: string,
    to: string,
    enabled: boolean,
    bidirectional?: boolean,
  ) => void;
  setClueLink: (from: string, to: string, reasoning: string | null) => void;
  addEntity: (kind: TreeEntityKind) => void;
  removeEntity: (kind: TreeEntityKind, id: string) => void;
  renameEntity: (kind: TreeEntityKind, id: string, nextId: string) => boolean;
  duplicateEntity: (kind: TreeEntityKind, id: string) => void;
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
  if (snapshot(project) === snapshot(state.project)) return { selection };
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

function validSelection(
  project: EditorProject,
  selection: EntitySelection,
): EntitySelection {
  const collection =
    selection.kind === "scene"
      ? project.module.scenes
      : selection.kind === "npc"
        ? project.module.npcs
        : selection.kind === "clue"
          ? project.module.clues
          : selection.kind === "ending"
            ? project.module.endings
            : null;
  return collection && (!selection.id || !collection[selection.id])
    ? { kind: "overview" }
    : selection;
}

function rewriteAuthorReferences(
  project: EditorProject,
  kind: TreeEntityKind,
  id: string,
  next: string | null,
) {
  const event =
    kind === "scene"
      ? "scene_entered"
      : kind === "npc"
        ? "npc_revealed"
        : kind === "clue"
          ? "clue_discovered"
          : null;
  if (event) {
    for (const group of ["scenes", "npcs", "clues"] as const)
      for (const asset of Object.values(project.module.assets[group])) {
        asset.reveal_on = asset.reveal_on.flatMap((trigger) =>
          trigger.event === event && trigger.entity_id === id
            ? next
              ? [{ ...trigger, entity_id: next }]
              : []
            : [trigger],
        );
      }
  }
  const referenceKey =
    kind === "scene"
      ? "scene_ids"
      : kind === "npc"
        ? "npc_ids"
        : kind === "clue"
          ? "required_clue_ids"
          : null;
  const data = project.lorebook?.data;
  if (referenceKey && data && typeof data === "object") {
    const entries = (data as { entries?: unknown }).entries;
    if (Array.isArray(entries))
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue;
        const extensions = (
          entry as { extensions?: { trpg_master?: Record<string, unknown> } }
        ).extensions?.trpg_master;
        if (extensions && Array.isArray(extensions[referenceKey]))
          extensions[referenceKey] = (
            extensions[referenceKey] as unknown[]
          ).flatMap((value) => (value === id ? (next ? [next] : []) : [value]));
      }
  }
}

const initialProject = loadDraft();

export const useEditorStore = create<EditorStore>((set, get) => ({
  project: initialProject,
  selection: { kind: "overview" },
  history: [],
  future: [],
  revision: 0,
  projectEpoch: 0,
  savedSnapshot: snapshot(initialProject),

  select: (selection) => set({ selection }),

  replaceProject: (project, markSaved = true) =>
    set((state) => ({
      project: cloneProject(project),
      selection: { kind: "overview" },
      history: [],
      future: [],
      revision: state.revision + 1,
      projectEpoch: state.projectEpoch + 1,
      savedSnapshot: markSaved ? snapshot(project) : state.savedSnapshot,
    })),

  resetProject: () => {
    const project = createDefaultProject();
    set((state) => ({
      project,
      selection: { kind: "overview" },
      history: [],
      future: [],
      revision: state.revision + 1,
      projectEpoch: state.projectEpoch + 1,
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
      selection: validSelection(previous, state.selection),
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
      selection: validSelection(next, state.selection),
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

  updateProjectContent: (content) =>
    set((state) => {
      const project = cloneProject(state.project);
      project.keeperDocument = content.keeperDocument;
      project.theme = content.theme;
      project.lorebook = content.lorebook;
      project.module.initial_state = content.initialState;
      project.module.assets = content.assets;
      project.module.progression = content.progression;
      // 编辑器内容是包文件路径的单一事实来源：有正文才声明对应文件。
      project.manifest.keeper_document = project.keeperDocument.trim()
        ? "keeper.md"
        : null;
      project.manifest.theme =
        project.theme && Object.keys(project.theme).length > 0
          ? "theme.json"
          : null;
      project.manifest.lorebook = project.lorebook ? "lorebook.json" : null;
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

  updateSkills: (skills) =>
    set((state) => {
      if (JSON.stringify(state.project.skills ?? []) === JSON.stringify(skills))
        return state;
      const project = cloneProject(state.project);
      project.skills = skills;
      return commit(state, project);
    }),

  applyProjectEdit: (edited) =>
    set((state) => {
      if (snapshot(edited) === snapshot(state.project)) return state;
      return commit(state, cloneProject(edited));
    }),

  setEntryScene: (id) =>
    set((state) => {
      if (
        !(id in state.project.module.scenes) ||
        id === state.project.module.entry_scene_id
      )
        return state;
      const project = cloneProject(state.project);
      project.module.entry_scene_id = id;
      return commit(state, project);
    }),

  setSceneLink: (from, to, enabled, bidirectional = false) =>
    set((state) => {
      if (
        from === to ||
        !state.project.module.scenes[from] ||
        !state.project.module.scenes[to]
      )
        return state;
      const project = cloneProject(state.project);
      for (const [source, target] of bidirectional
        ? [
            [from, to],
            [to, from],
          ]
        : [[from, to]]) {
        const scene = project.module.scenes[source];
        scene.exits = enabled
          ? [...new Set([...scene.exits, target])]
          : scene.exits.filter((id) => id !== target);
      }
      if (snapshot(project) === snapshot(state.project)) return state;
      return commit(state, project);
    }),

  setClueLink: (from, to, reasoning) =>
    set((state) => {
      if (
        from === to ||
        !state.project.module.clues[from] ||
        !state.project.module.clues[to]
      )
        return state;
      const project = cloneProject(state.project);
      project.module.clue_links = project.module.clue_links.filter(
        (link) => link.from !== from || link.to !== to,
      );
      if (reasoning !== null)
        project.module.clue_links.push({ from, to, reasoning });
      if (snapshot(project) === snapshot(state.project)) return state;
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
          aliases: [],
          description: "",
          exits: [],
          npcs_present: [],
          encounters: [],
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
          granted_item: null,
          flag_effects: {},
          discovery_rules: [],
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
          required_flags: {},
        };
      }
      return commit(state, project, { kind, id });
    }),

  removeEntity: (kind, id) =>
    set((state) => {
      if (kind === "scene" && id === state.project.module.entry_scene_id)
        return state;
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
          clue.related_scenes = clue.related_scenes.filter(
            (sceneId) => sceneId !== id,
          );
        }
      } else if (kind === "npc") {
        delete project.module.npcs[id];
        for (const scene of Object.values(project.module.scenes)) {
          scene.npcs_present = scene.npcs_present.filter(
            (npcId) => npcId !== id,
          );
          scene.encounters = scene.encounters.filter(
            (encounter) => encounter.npc_id !== id,
          );
        }
        for (const clue of Object.values(project.module.clues)) {
          clue.related_npcs = clue.related_npcs.filter((npcId) => npcId !== id);
          for (const rule of clue.discovery_rules) {
            rule.npc_reveals = rule.npc_reveals.filter(
              (reveal) => reveal.npc_id !== id,
            );
          }
        }
      } else if (kind === "clue") {
        delete project.module.clues[id];
        project.module.initial_state.known_clue_ids =
          project.module.initial_state.known_clue_ids.filter(
            (clueId) => clueId !== id,
          );
        project.module.clue_links = project.module.clue_links.filter(
          (link) => link.from !== id && link.to !== id,
        );
        for (const clue of Object.values(project.module.clues)) {
          for (const rule of clue.discovery_rules) {
            if (
              rule.fallback?.mode === "alternate_clue" &&
              rule.fallback.clue_id === id
            ) {
              rule.fallback = null;
            }
          }
        }
        if (project.module.progression) {
          project.module.progression.essential_clue_ids =
            project.module.progression.essential_clue_ids.filter(
              (clueId) => clueId !== id,
            );
        }
      } else {
        delete project.module.endings[id];
      }
      rewriteAuthorReferences(project, kind, id, null);
      return commit(state, project, { kind: "overview" });
    }),

  renameEntity: (kind, id, requestedId) => {
    const next = requestedId.trim();
    if (!/^[a-z][a-z0-9_-]*$/i.test(next)) return false;
    const state = get();
    const collection =
      kind === "scene"
        ? state.project.module.scenes
        : kind === "npc"
          ? state.project.module.npcs
          : kind === "clue"
            ? state.project.module.clues
            : state.project.module.endings;
    if (!(id in collection) || (next !== id && next in collection))
      return false;
    if (next === id) return true;
    const project = cloneProject(state.project);
    if (kind === "scene") {
      project.module.scenes[next] = project.module.scenes[id];
      delete project.module.scenes[id];
      if (project.module.entry_scene_id === id)
        project.module.entry_scene_id = next;
      for (const scene of Object.values(project.module.scenes))
        scene.exits = scene.exits.map((value) => (value === id ? next : value));
      for (const npc of Object.values(project.module.npcs))
        if (npc.current_location === id) npc.current_location = next;
      for (const clue of Object.values(project.module.clues))
        clue.related_scenes = clue.related_scenes.map((value) =>
          value === id ? next : value,
        );
    } else if (kind === "npc") {
      project.module.npcs[next] = project.module.npcs[id];
      delete project.module.npcs[id];
      for (const scene of Object.values(project.module.scenes)) {
        scene.npcs_present = scene.npcs_present.map((value) =>
          value === id ? next : value,
        );
        for (const encounter of scene.encounters) {
          if (encounter.npc_id === id) encounter.npc_id = next;
        }
      }
      for (const clue of Object.values(project.module.clues)) {
        clue.related_npcs = clue.related_npcs.map((value) =>
          value === id ? next : value,
        );
        for (const rule of clue.discovery_rules) {
          for (const reveal of rule.npc_reveals) {
            if (reveal.npc_id === id) reveal.npc_id = next;
          }
        }
      }
    } else if (kind === "clue") {
      project.module.clues[next] = project.module.clues[id];
      delete project.module.clues[id];
      project.module.initial_state.known_clue_ids =
        project.module.initial_state.known_clue_ids.map((value) =>
          value === id ? next : value,
        );
      project.module.clue_links = project.module.clue_links.map((link) => ({
        ...link,
        from: link.from === id ? next : link.from,
        to: link.to === id ? next : link.to,
      }));
      if (project.module.progression) {
        project.module.progression.essential_clue_ids =
          project.module.progression.essential_clue_ids.map((value) =>
            value === id ? next : value,
          );
      }
      for (const clue of Object.values(project.module.clues)) {
        for (const rule of clue.discovery_rules) {
          if (rule.fallback?.clue_id === id) rule.fallback.clue_id = next;
        }
      }
    } else {
      project.module.endings[next] = project.module.endings[id];
      delete project.module.endings[id];
    }
    rewriteAuthorReferences(project, kind, id, next);
    set(commit(state, project, { kind, id: next }));
    return true;
  },

  duplicateEntity: (kind, id) =>
    set((state) => {
      const project = cloneProject(state.project);
      const collection =
        kind === "scene"
          ? project.module.scenes
          : kind === "npc"
            ? project.module.npcs
            : kind === "clue"
              ? project.module.clues
              : project.module.endings;
      if (!(id in collection)) return state;
      const next = nextId(id, collection);
      collection[next] = structuredClone(collection[id]) as never;
      const entity = collection[next] as {
        name?: string;
        title?: string;
        text?: string;
      };
      if (entity.name) entity.name += "（副本）";
      else if (entity.title) entity.title += "（副本）";
      else if (entity.text) entity.text += "（副本）";
      if (kind === "clue") {
        const clone = collection[next] as { initially_known: boolean };
        if (
          clone.initially_known &&
          !project.module.initial_state.known_clue_ids.includes(next)
        ) {
          project.module.initial_state.known_clue_ids.push(next);
        }
      }
      return commit(state, project, { kind, id: next });
    }),
}));

export function isProjectDirty(
  state: Pick<EditorStore, "project" | "savedSnapshot">,
): boolean {
  return snapshot(state.project) !== state.savedSnapshot;
}
