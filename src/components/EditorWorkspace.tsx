import type { EntitySelection } from "../domain/types";
import { ClueEditor } from "../features/editors/ClueEditor";
import { EndingEditor } from "../features/editors/EndingEditor";
import { ManifestEditor } from "../features/editors/ManifestEditor";
import { NpcEditor } from "../features/editors/NpcEditor";
import { SceneEditor } from "../features/editors/SceneEditor";
import { SkillsEditor } from "../features/editors/SkillsEditor";
import { ProjectContentEditor } from "../features/editors/ProjectContentEditor";
import { SpatialEditor } from "../features/editors/spatial/SpatialEditor";
import { Overview } from "../features/editors/Overview";
import { StoryGraph } from "../features/editors/StoryGraph";
import { PlayerPreview } from "../features/editors/PlayerPreview";
import { ProjectSourceEditor } from "../features/editors/ProjectSourceEditor";
import { useEditorStore } from "../store/editor-store";

export function EditorWorkspace({ selection }: { selection: EntitySelection }) {
  const epoch = useEditorStore((state) => state.projectEpoch);
  return (
    <main className="editor-workspace">
      {selection.kind === "overview" && <Overview />}
      <StoryGraph key={`graph:${epoch}`} active={selection.kind === "graph"} />
      {selection.kind === "preview" && <PlayerPreview />}
      <div key={`source:${epoch}`} hidden={selection.kind !== "source"}>
        <ProjectSourceEditor />
      </div>
      {selection.kind === "manifest" && <ManifestEditor />}
      <div key={`content:${epoch}`} hidden={selection.kind !== "content"}>
        <ProjectContentEditor />
      </div>
      {selection.kind === "spatial" && <SpatialEditor />}
      {selection.kind === "skills" && <SkillsEditor />}
      {selection.kind === "scene" && selection.id && (
        <SceneEditor key={selection.id} id={selection.id} />
      )}
      {selection.kind === "npc" && selection.id && (
        <NpcEditor key={selection.id} id={selection.id} />
      )}
      {selection.kind === "clue" && selection.id && (
        <ClueEditor key={selection.id} id={selection.id} />
      )}
      {selection.kind === "ending" && selection.id && (
        <EndingEditor key={selection.id} id={selection.id} />
      )}
    </main>
  );
}
