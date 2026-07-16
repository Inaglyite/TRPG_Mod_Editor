import type { EntitySelection } from "../domain/types";
import { ClueEditor } from "../features/editors/ClueEditor";
import { EndingEditor } from "../features/editors/EndingEditor";
import { ManifestEditor } from "../features/editors/ManifestEditor";
import { NpcEditor } from "../features/editors/NpcEditor";
import { SceneEditor } from "../features/editors/SceneEditor";
import { ProjectContentEditor } from "../features/editors/ProjectContentEditor";
import { useEditorStore } from "../store/editor-store";

export function EditorWorkspace({ selection }: { selection: EntitySelection }) {
  const revision = useEditorStore((state) => state.revision);
  return (
    <main className="editor-workspace">
      {selection.kind === "manifest" && <ManifestEditor />}
      {selection.kind === "content" && <ProjectContentEditor key={revision} />}
      {selection.kind === "scene" && selection.id && <SceneEditor id={selection.id} />}
      {selection.kind === "npc" && selection.id && <NpcEditor id={selection.id} />}
      {selection.kind === "clue" && selection.id && <ClueEditor id={selection.id} />}
      {selection.kind === "ending" && selection.id && <EndingEditor id={selection.id} />}
    </main>
  );
}
