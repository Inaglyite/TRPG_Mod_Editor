import { BookKey } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { EditorHeading } from "../../components/EditorHeading";
import type { ClueDefinition } from "../../domain/types";
import { useEditorStore } from "../../store/editor-store";
import { CheckGrid, FormField } from "./FormControls";

interface ClueFormValues extends Omit<ClueDefinition, "source" | "asset_id"> {
  source: string;
  asset_id: string;
}

function toForm(clue: ClueDefinition): ClueFormValues {
  return { ...clue, source: clue.source ?? "", asset_id: clue.asset_id ?? "" };
}

export function ClueEditor({ id }: { id: string }) {
  const project = useEditorStore((state) => state.project);
  const updateClue = useEditorStore((state) => state.updateClue);
  const removeEntity = useEditorStore((state) => state.removeEntity);
  const clue = project.module.clues[id];
  const form = useForm<ClueFormValues>({ defaultValues: clue ? toForm(clue) : undefined });

  useEffect(() => {
    if (clue) form.reset(toForm(clue));
  }, [form, clue]);

  if (!clue) return null;

  const commit = () => {
    const values = form.getValues();
    const next: ClueDefinition = {
      ...values,
      source: values.source.trim() || null,
      asset_id: values.asset_id.trim() || null,
    };
    if (JSON.stringify(next) !== JSON.stringify(clue)) updateClue(id, next);
  };

  const deleteClue = () => {
    if (window.confirm("删除这条线索及其关系？")) removeEntity("clue", id);
  };

  return (
    <div className="editor-document">
      <EditorHeading
        eyebrow="CLUE"
        title={clue.text || "未命名线索"}
        id={id}
        icon={<BookKey size={21} />}
        onDelete={deleteClue}
      />
      <form className="editor-form" onBlur={commit}>
        <section className="form-section">
          <h2>线索定义</h2>
          <div className="form-grid">
            <FormField label="玩家可见文本" wide>
              <textarea rows={6} {...form.register("text")} />
            </FormField>
            <FormField label="分类">
              <select {...form.register("category")}>
                <option value="investigation">调查证据</option>
                <option value="event">重要事件</option>
                <option value="task">任务目标</option>
                <option value="npc">人物信息</option>
              </select>
            </FormField>
            <FormField label="发现类型">
              <select {...form.register("type")}>
                <option value="obvious">显性</option>
                <option value="hidden">隐藏</option>
                <option value="inferred">推断</option>
              </select>
            </FormField>
            <FormField label="层级">
              <select {...form.register("tier", { valueAsNumber: true })}>
                <option value={0}>0 · 背景</option>
                <option value={1}>1 · 普通</option>
                <option value={2}>2 · 关键</option>
                <option value={3}>3 · 核心</option>
              </select>
            </FormField>
            <FormField label="来源">
              <input {...form.register("source")} />
            </FormField>
            <FormField label="线索素材 ID" wide>
              <input className="mono-input" {...form.register("asset_id")} />
            </FormField>
            <FormField label="发现条件" wide>
              <textarea rows={4} {...form.register("discovery_notes")} />
            </FormField>
          </div>
          <label className="switch-row">
            <input type="checkbox" {...form.register("initially_known")} />
            <span>新游戏开始时已知</span>
          </label>
        </section>
        <section className="form-section split-checks">
          <CheckGrid label="关联场景" emptyText="没有场景">
            {Object.entries(project.module.scenes).map(([sceneId, scene]) => (
              <label className="check-option" key={sceneId}>
                <input type="checkbox" value={sceneId} {...form.register("related_scenes")} />
                <span>{scene.name}</span>
              </label>
            ))}
          </CheckGrid>
          <CheckGrid label="关联人物" emptyText="没有人物">
            {Object.entries(project.module.npcs).map(([npcId, npc]) => (
              <label className="check-option" key={npcId}>
                <input type="checkbox" value={npcId} {...form.register("related_npcs")} />
                <span>{npc.name}</span>
              </label>
            ))}
          </CheckGrid>
        </section>
      </form>
    </div>
  );
}
