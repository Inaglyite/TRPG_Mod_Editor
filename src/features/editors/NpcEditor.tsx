import { CircleUserRound, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { EditorHeading } from "../../components/EditorHeading";
import type { NpcDefinition } from "../../domain/types";
import { useEditorStore } from "../../store/editor-store";
import { FormField } from "./FormControls";

interface KeyValueRow {
  key: string;
  value: number;
}

interface TextRow {
  value: string;
}

interface NpcFormValues {
  name: string;
  visibleTagsText: string;
  current_location: string;
  max_hp: number;
  asset_id: string;
  disposition: string;
  hp: number;
  secret: string;
  notes: string;
  initial_reveal: number;
  attributes: KeyValueRow[];
  skills: KeyValueRow[];
  conditions: TextRow[];
  spells: TextRow[];
  initialRevealEntriesText: string;
}

function toRows(record: Record<string, number>): KeyValueRow[] {
  return Object.entries(record).map(([key, value]) => ({ key, value }));
}

function toForm(npc: NpcDefinition): NpcFormValues {
  return {
    ...npc,
    visibleTagsText: npc.visible_tags.join(", "),
    current_location: npc.current_location ?? "",
    max_hp: npc.max_hp ?? npc.hp,
    asset_id: npc.asset_id ?? "",
    attributes: toRows(npc.attributes),
    skills: toRows(npc.skills),
    conditions: npc.conditions.map((value) => ({ value })),
    spells: npc.spells.map((value) => ({ value })),
    initialRevealEntriesText: JSON.stringify(npc.initial_reveal_entries, null, 2),
  };
}

function toRecord(rows: KeyValueRow[]): Record<string, number> {
  return Object.fromEntries(
    rows
      .map((row) => [row.key.trim(), Number(row.value)] as const)
      .filter(([key, value]) => key !== "" && Number.isFinite(value)),
  );
}

export function NpcEditor({ id }: { id: string }) {
  const project = useEditorStore((state) => state.project);
  const updateNpc = useEditorStore((state) => state.updateNpc);
  const removeEntity = useEditorStore((state) => state.removeEntity);
  const npc = project.module.npcs[id];
  const form = useForm<NpcFormValues>({ defaultValues: npc ? toForm(npc) : undefined });
  const attributes = useFieldArray<NpcFormValues, "attributes">({ control: form.control, name: "attributes" });
  const skills = useFieldArray<NpcFormValues, "skills">({ control: form.control, name: "skills" });
  const conditions = useFieldArray<NpcFormValues, "conditions">({ control: form.control, name: "conditions" });
  const spells = useFieldArray<NpcFormValues, "spells">({ control: form.control, name: "spells" });
  const [entriesError, setEntriesError] = useState("");

  useEffect(() => {
    if (npc) form.reset(toForm(npc));
  }, [form, npc]);

  if (!npc) return null;

  const commit = () => {
    const values = form.getValues();
    let initialRevealEntries: Record<string, unknown>[];
    try {
      initialRevealEntries = values.initialRevealEntriesText.trim()
        ? JSON.parse(values.initialRevealEntriesText) as Record<string, unknown>[]
        : [];
    } catch (caught) {
      setEntriesError(caught instanceof Error ? `JSON 无法保存：${caught.message}` : "JSON 无法保存");
      return;
    }
    if (!Array.isArray(initialRevealEntries)) {
      setEntriesError("初始揭示条目必须是数组");
      return;
    }
    setEntriesError("");
    const next: NpcDefinition = {
      ...values,
      visible_tags: values.visibleTagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
      current_location: values.current_location || null,
      max_hp: Number.isFinite(values.max_hp) ? values.max_hp : null,
      asset_id: values.asset_id.trim() || null,
      attributes: toRecord(values.attributes),
      skills: toRecord(values.skills),
      conditions: values.conditions.map((item) => item.value.trim()).filter(Boolean),
      spells: values.spells.map((item) => item.value.trim()).filter(Boolean),
      initial_reveal_entries: initialRevealEntries,
      extensions: npc.extensions,
    };
    delete (next as NpcDefinition & { visibleTagsText?: string; initialRevealEntriesText?: string }).visibleTagsText;
    delete (next as NpcDefinition & { visibleTagsText?: string; initialRevealEntriesText?: string }).initialRevealEntriesText;
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
        <section className="form-section">
          <h2>属性与技能</h2>
          <div className="form-grid">
            <FormField label="属性" hint="例如 STR / DEX / INT">
              <div className="kv-rows">
                {attributes.fields.map((field, index) => (
                  <div className="kv-row" key={field.id}>
                    <input placeholder="属性名" {...form.register(`attributes.${index}.key`)} />
                    <input type="number" placeholder="0" {...form.register(`attributes.${index}.value`, { valueAsNumber: true })} />
                    <button type="button" className="row-remove" onClick={() => attributes.remove(index)} aria-label="删除属性">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="row-add" onClick={() => attributes.append({ key: "", value: 0 })}>
                <Plus size={12} /> 添加属性
              </button>
            </FormField>
            <FormField label="技能" hint="例如 图书馆使用 75">
              <div className="kv-rows">
                {skills.fields.map((field, index) => (
                  <div className="kv-row" key={field.id}>
                    <input placeholder="技能名" {...form.register(`skills.${index}.key`)} />
                    <input type="number" placeholder="0" {...form.register(`skills.${index}.value`, { valueAsNumber: true })} />
                    <button type="button" className="row-remove" onClick={() => skills.remove(index)} aria-label="删除技能">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="row-add" onClick={() => skills.append({ key: "", value: 0 })}>
                <Plus size={12} /> 添加技能
              </button>
            </FormField>
            <FormField label="状态">
              <div className="kv-rows">
                {conditions.fields.map((field, index) => (
                  <div className="kv-row" style={{ gridTemplateColumns: "minmax(0, 1fr) 26px" }} key={field.id}>
                    <input placeholder="状态名" {...form.register(`conditions.${index}.value`)} />
                    <button type="button" className="row-remove" onClick={() => conditions.remove(index)} aria-label="删除状态">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="row-add" onClick={() => conditions.append({ value: "" })}>
                <Plus size={12} /> 添加状态
              </button>
            </FormField>
            <FormField label="法术">
              <div className="kv-rows">
                {spells.fields.map((field, index) => (
                  <div className="kv-row" style={{ gridTemplateColumns: "minmax(0, 1fr) 26px" }} key={field.id}>
                    <input placeholder="法术名" {...form.register(`spells.${index}.value`)} />
                    <button type="button" className="row-remove" onClick={() => spells.remove(index)} aria-label="删除法术">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="row-add" onClick={() => spells.append({ value: "" })}>
                <Plus size={12} /> 添加法术
              </button>
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
            <FormField label="初始揭示条目" hint="揭示等级大于 0 时逐级填写，JSON 数组" wide>
              <textarea rows={6} className="mono-input" {...form.register("initialRevealEntriesText")} />
              {entriesError && <small className="content-save-error" role="alert">{entriesError}</small>}
            </FormField>
          </div>
        </section>
      </form>
    </div>
  );
}
