import { DatabaseZap } from "lucide-react";
import { useState } from "react";
import { EditorHeading } from "../../components/EditorHeading";
import type { EditorProject, ModuleDefinition } from "../../domain/types";
import { useEditorStore } from "../../store/editor-store";
import { FormField } from "./FormControls";

type JsonKey = "theme" | "initialState" | "assets" | "lorebook" | "progression";
type Draft = Record<JsonKey, string> & { keeperDocument: string };

function format(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function makeDraft(project: EditorProject): Draft {
  return {
    keeperDocument: project.keeperDocument,
    theme: format(project.theme),
    initialState: format(project.module.initial_state),
    assets: format(project.module.assets),
    lorebook: format(project.lorebook),
    progression: format(project.module.progression ?? {}),
  };
}

export function ProjectContentEditor() {
  const project = useEditorStore((state) => state.project);
  const update = useEditorStore((state) => state.updateProjectContent);
  const [draft, setDraft] = useState(() => makeDraft(project));
  const [error, setError] = useState("");

  const set = (key: keyof Draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const save = () => {
    try {
      const content = {
        keeperDocument: draft.keeperDocument,
        theme: JSON.parse(draft.theme) as Record<string, unknown>,
        initialState: JSON.parse(draft.initialState) as ModuleDefinition["initial_state"],
        assets: JSON.parse(draft.assets) as ModuleDefinition["assets"],
        lorebook: JSON.parse(draft.lorebook) as Record<string, unknown> | null,
        progression: JSON.parse(draft.progression) as Record<string, unknown>,
      };
      update(content);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? `JSON 无法保存：${caught.message}` : "JSON 无法保存");
    }
  };

  return (
    <div className="editor-document">
      <EditorHeading eyebrow="PROJECT CONTENT" title="世界、规则与素材" icon={<DatabaseZap size={21} />} />
      <div className="editor-form">
        <section className="form-section">
          <h2>Keeper 文档</h2>
          <div className="keeper-grid">
            <FormField label="Markdown 源文档">
              <textarea rows={18} value={draft.keeperDocument} onChange={(event) => set("keeperDocument", event.target.value)} />
            </FormField>
            <FormField label="安全预览" hint="预览按纯文本渲染，不执行 HTML、脚本或远程资源">
              <article className="keeper-preview">{draft.keeperDocument || "尚未编写 Keeper 文档"}</article>
            </FormField>
          </div>
        </section>
        <section className="form-section">
          <h2>结构化配置</h2>
          <p className="section-help">E1 保留完整结构并在保存时校验 JSON；后续可在不改变工程契约的前提下继续拆成细粒度控件。</p>
          <div className="content-json-grid">
            {([
              ["initialState", "初始调查员、Flags 与案件时钟"],
              ["assets", "素材映射"],
              ["lorebook", "Lorebook v3"],
              ["progression", "Progression"],
              ["theme", "主题"],
            ] as Array<[JsonKey, string]>).map(([key, label]) => (
              <FormField key={key} label={label} wide>
                <textarea className="mono-input" rows={key === "initialState" ? 16 : 9} value={draft[key]} onChange={(event) => set(key, event.target.value)} />
              </FormField>
            ))}
          </div>
          {error && <p className="content-save-error" role="alert">{error}</p>}
          <button type="button" className="primary-button" onClick={save}>保存世界与素材</button>
        </section>
      </div>
    </div>
  );
}
