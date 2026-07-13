import { Flag } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { EditorHeading } from "../../components/EditorHeading";
import type { EndingDefinition } from "../../domain/types";
import { useEditorStore } from "../../store/editor-store";
import { FormField } from "./FormControls";

export function EndingEditor({ id }: { id: string }) {
  const ending = useEditorStore((state) => state.project.module.endings[id]);
  const updateEnding = useEditorStore((state) => state.updateEnding);
  const removeEntity = useEditorStore((state) => state.removeEntity);
  const form = useForm<EndingDefinition>({ defaultValues: ending });

  useEffect(() => {
    if (ending) form.reset(ending);
  }, [ending, form]);

  if (!ending) return null;

  const commit = () => {
    const values = form.getValues();
    if (JSON.stringify(values) !== JSON.stringify(ending)) updateEnding(id, values);
  };

  return (
    <div className="editor-document">
      <EditorHeading
        eyebrow="ENDING"
        title={ending.title}
        id={id}
        icon={<Flag size={21} />}
        onDelete={() => {
          if (window.confirm(`删除结局“${ending.title}”？`)) removeEntity("ending", id);
        }}
      />
      <form className="editor-form" onBlur={commit}>
        <section className="form-section">
          <h2>结局定义</h2>
          <div className="form-grid">
            <FormField label="结局标题" wide>
              <input {...form.register("title")} />
            </FormField>
            <FormField label="结局类型">
              <select {...form.register("ending_type")}>
                <option value="good">良好</option>
                <option value="neutral">中性</option>
                <option value="bad">糟糕</option>
                <option value="secret">隐藏</option>
              </select>
            </FormField>
            <FormField label="触发条件" wide>
              <textarea rows={5} {...form.register("trigger")} />
            </FormField>
            <FormField label="结局描述" wide>
              <textarea rows={8} {...form.register("description")} />
            </FormField>
          </div>
        </section>
      </form>
    </div>
  );
}
