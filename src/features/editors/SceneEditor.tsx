import { Clapperboard } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { EditorHeading } from "../../components/EditorHeading";
import type { SceneDefinition } from "../../domain/types";
import { useEditorStore } from "../../store/editor-store";
import { CheckGrid, FormField } from "./FormControls";

interface SceneFormValues extends Omit<SceneDefinition, "tags" | "document" | "asset_id"> {
  tagsText: string;
  document: string;
  asset_id: string;
}

function toForm(scene: SceneDefinition): SceneFormValues {
  return {
    ...scene,
    tagsText: scene.tags.join(", "),
    document: scene.document ?? "",
    asset_id: scene.asset_id ?? "",
  };
}

export function SceneEditor({ id }: { id: string }) {
  const project = useEditorStore((state) => state.project);
  const updateScene = useEditorStore((state) => state.updateScene);
  const removeEntity = useEditorStore((state) => state.removeEntity);
  const scene = project.module.scenes[id];
  const form = useForm<SceneFormValues>({ defaultValues: scene ? toForm(scene) : undefined });

  useEffect(() => {
    if (scene) form.reset(toForm(scene));
  }, [form, scene]);

  if (!scene) return null;

  const commit = () => {
    const values = form.getValues();
    const next: SceneDefinition = {
      ...values,
      tags: values.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
      document: values.document.trim() || null,
      asset_id: values.asset_id.trim() || null,
    };
    delete (next as SceneDefinition & { tagsText?: string }).tagsText;
    if (JSON.stringify(next) !== JSON.stringify(scene)) updateScene(id, next);
  };

  const deleteScene = () => {
    if (id === project.module.entry_scene_id) return;
    if (window.confirm(`删除场景“${scene.name}”及其引用？`)) removeEntity("scene", id);
  };

  return (
    <div className="editor-document">
      <EditorHeading
        eyebrow="SCENE"
        title={scene.name}
        id={id}
        icon={<Clapperboard size={21} />}
        onDelete={deleteScene}
        deleteDisabled={id === project.module.entry_scene_id}
      />
      <form className="editor-form" onBlur={commit}>
        <section className="form-section">
          <h2>场景内容</h2>
          <div className="form-grid">
            <FormField label="显示名称" wide>
              <input {...form.register("name")} />
            </FormField>
            <FormField label="玩家可见描述" wide>
              <textarea rows={8} {...form.register("description")} />
            </FormField>
            <FormField label="标签" hint="使用英文逗号分隔">
              <input {...form.register("tagsText")} />
            </FormField>
            <FormField label="补充文档">
              <input className="mono-input" placeholder="scenes/example.md" {...form.register("document")} />
            </FormField>
            <FormField label="场景素材 ID" wide>
              <input className="mono-input" {...form.register("asset_id")} />
            </FormField>
          </div>
        </section>
        <section className="form-section split-checks">
          <CheckGrid label="可前往场景" emptyText="没有出口">
            {Object.entries(project.module.scenes)
              .filter(([sceneId]) => sceneId !== id)
              .map(([sceneId, candidate]) => (
                <label className="check-option" key={sceneId}>
                  <input type="checkbox" value={sceneId} {...form.register("exits")} />
                  <span>{candidate.name}</span>
                </label>
              ))}
          </CheckGrid>
          <CheckGrid label="在场人物" emptyText="没有人物">
            {Object.entries(project.module.npcs).map(([npcId, npc]) => (
              <label className="check-option" key={npcId}>
                <input type="checkbox" value={npcId} {...form.register("npcs_present")} />
                <span>{npc.name}</span>
              </label>
            ))}
          </CheckGrid>
        </section>
      </form>
    </div>
  );
}
