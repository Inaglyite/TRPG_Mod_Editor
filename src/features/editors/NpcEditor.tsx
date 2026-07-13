import { CircleUserRound } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { EditorHeading } from "../../components/EditorHeading";
import type { NpcDefinition } from "../../domain/types";
import { useEditorStore } from "../../store/editor-store";
import { FormField } from "./FormControls";

interface NpcFormValues extends Omit<NpcDefinition, "visible_tags" | "current_location" | "max_hp" | "asset_id"> {
  visibleTagsText: string;
  current_location: string;
  max_hp: number;
  asset_id: string;
}

function toForm(npc: NpcDefinition): NpcFormValues {
  return {
    ...npc,
    visibleTagsText: npc.visible_tags.join(", "),
    current_location: npc.current_location ?? "",
    max_hp: npc.max_hp ?? npc.hp,
    asset_id: npc.asset_id ?? "",
  };
}

export function NpcEditor({ id }: { id: string }) {
  const project = useEditorStore((state) => state.project);
  const updateNpc = useEditorStore((state) => state.updateNpc);
  const removeEntity = useEditorStore((state) => state.removeEntity);
  const npc = project.module.npcs[id];
  const form = useForm<NpcFormValues>({ defaultValues: npc ? toForm(npc) : undefined });

  useEffect(() => {
    if (npc) form.reset(toForm(npc));
  }, [form, npc]);

  if (!npc) return null;

  const commit = () => {
    const values = form.getValues();
    const next: NpcDefinition = {
      ...values,
      visible_tags: values.visibleTagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
      current_location: values.current_location || null,
      max_hp: Number.isFinite(values.max_hp) ? values.max_hp : null,
      asset_id: values.asset_id.trim() || null,
    };
    delete (next as NpcDefinition & { visibleTagsText?: string }).visibleTagsText;
    if (JSON.stringify(next) !== JSON.stringify(npc)) updateNpc(id, next);
  };

  const deleteNpc = () => {
    if (window.confirm(`删除人物“${npc.name}”及其引用？`)) removeEntity("npc", id);
  };

  return (
    <div className="editor-document">
      <EditorHeading
        eyebrow="NON-PLAYER CHARACTER"
        title={npc.name}
        id={id}
        icon={<CircleUserRound size={21} />}
        onDelete={deleteNpc}
      />
      <form className="editor-form" onBlur={commit}>
        <section className="form-section">
          <h2>公开信息</h2>
          <div className="form-grid">
            <FormField label="姓名" wide>
              <input {...form.register("name")} />
            </FormField>
            <FormField label="公开标签" hint="使用英文逗号分隔" wide>
              <input {...form.register("visibleTagsText")} />
            </FormField>
            <FormField label="初始位置">
              <select {...form.register("current_location")}>
                <option value="">未指定</option>
                {Object.entries(project.module.scenes).map(([sceneId, scene]) => (
                  <option key={sceneId} value={sceneId}>{scene.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="初始态度">
              <select {...form.register("disposition")}>
                <option value="friendly">友善</option>
                <option value="cooperative">合作</option>
                <option value="neutral">中立</option>
                <option value="guarded">戒备</option>
                <option value="hostile">敌对</option>
              </select>
            </FormField>
            <FormField label="HP">
              <input type="number" min={0} {...form.register("hp", { valueAsNumber: true })} />
            </FormField>
            <FormField label="最大 HP">
              <input type="number" min={0} {...form.register("max_hp", { valueAsNumber: true })} />
            </FormField>
            <FormField label="肖像素材 ID" wide>
              <input className="mono-input" {...form.register("asset_id")} />
            </FormField>
          </div>
        </section>
        <section className="form-section keeper-section">
          <h2>守秘人信息</h2>
          <div className="form-grid">
            <FormField label="秘密" wide>
              <textarea rows={7} {...form.register("secret")} />
            </FormField>
            <FormField label="作者备注" wide>
              <textarea rows={4} {...form.register("notes")} />
            </FormField>
            <FormField label="初始揭示等级">
              <select {...form.register("initial_reveal", { valueAsNumber: true })}>
                <option value={0}>0 · 未揭示</option>
                <option value={1}>1 · 初步认识</option>
                <option value={2}>2 · 深入了解</option>
                <option value={3}>3 · 完全揭示</option>
              </select>
            </FormField>
          </div>
        </section>
      </form>
    </div>
  );
}
