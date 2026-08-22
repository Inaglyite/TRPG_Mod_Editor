import { Plus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { EditorHeading } from "../../components/EditorHeading";
import type { SkillDraft } from "../../domain/types";
import { useEditorStore } from "../../store/editor-store";
import { FormField } from "./FormControls";

interface SkillFormValues {
  name: string;
  version: string;
  description: string;
  body: string;
  requiredToolsText: string;
  allowedToolsText: string;
}

function toForm(skill: SkillDraft): SkillFormValues {
  return {
    name: skill.name,
    version: skill.version ?? "0",
    description: skill.description ?? "",
    body: skill.body,
    requiredToolsText: (skill.required_tools ?? []).join(", "),
    allowedToolsText: (skill.allowed_tools ?? []).join(", "),
  };
}

function parseToolList(text: string): string[] {
  return text.split(",").map((item) => item.trim()).filter(Boolean);
}

function nextSkillName(skills: SkillDraft[]): string {
  let index = skills.length + 1;
  while (skills.some((skill) => skill.name === `skill_${index}`)) index += 1;
  return `skill_${index}`;
}

/** 工程级自定义 Skill 列表编辑器（对应包内 skills/<name>.skill）。 */
export function SkillsEditor() {
  const skills = useEditorStore((state) => state.project.skills) ?? [];
  const updateSkills = useEditorStore((state) => state.updateSkills);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeIndex = Math.min(selectedIndex, Math.max(skills.length - 1, 0));
  const skill = skills[activeIndex];
  const form = useForm<SkillFormValues>({ defaultValues: skill ? toForm(skill) : undefined });

  useEffect(() => {
    if (skill) form.reset(toForm(skill));
  }, [form, skill]);

  const addSkill = () => {
    const next: SkillDraft[] = [
      ...skills,
      {
        name: nextSkillName(skills),
        body: "# 新 Skill\n\n在这里编写 Skill 正文。",
        version: "0",
        description: "",
        required_tools: [],
        allowed_tools: [],
      },
    ];
    updateSkills(next);
    setSelectedIndex(next.length - 1);
  };

  const deleteSkill = () => {
    if (!skill) return;
    if (!window.confirm(`删除 Skill ${skill.name}？`)) return;
    const next = skills.filter((_, index) => index !== activeIndex);
    updateSkills(next);
    setSelectedIndex(Math.max(activeIndex - 1, 0));
  };

  const commit = () => {
    if (!skill) return;
    const values = form.getValues();
    const next: SkillDraft = {
      name: values.name.trim(),
      body: values.body,
      version: values.version.trim() || "0",
      description: values.description.trim(),
      required_tools: parseToolList(values.requiredToolsText),
      allowed_tools: parseToolList(values.allowedToolsText),
    };
    if (JSON.stringify(next) === JSON.stringify(skill)) return;
    updateSkills(skills.map((item, index) => (index === activeIndex ? next : item)));
  };

  return (
    <div className="editor-document">
      <EditorHeading
        eyebrow="CUSTOM SKILLS"
        title="自定义 Skill"
        icon={<Sparkles size={21} />}
      />
      <p className="section-help">
        Skill 会打包为 skills/&lt;name&gt;.skill 进入守秘人上下文；required/allowed_tools
        目前只做声明与形状校验，暂不影响运行时行为。
      </p>
      <div className="skills-layout">
        <aside className="skills-list" aria-label="Skill 列表">
          {skills.map((item, index) => (
            <button
              type="button"
              key={`${item.name}-${index}`}
              className={`skills-list-item${index === activeIndex && skill ? " is-active" : ""}`}
              onClick={() => setSelectedIndex(index)}
            >
              <span>{item.description || item.name}</span>
              <code>{item.name}</code>
            </button>
          ))}
          {skills.length === 0 && <div className="tree-empty">暂无 Skill</div>}
          <button type="button" className="tool-button" onClick={addSkill}>
            <Plus size={15} />
            <span>新建 Skill</span>
          </button>
        </aside>
        {skill && (
          <form className="editor-form skills-form" onBlur={commit}>
            <div className="form-grid">
              <FormField label="名称" hint="小写字母/数字/下划线，对应 skills/<name>.skill">
                <input className="mono-input" {...form.register("name")} />
              </FormField>
              <FormField label="版本">
                <input className="mono-input" {...form.register("version")} />
              </FormField>
              <FormField label="描述" wide>
                <input {...form.register("description")} />
              </FormField>
              <FormField label="声明所需工具" hint="英文逗号分隔；仅声明，运行时暂未生效">
                <input className="mono-input" {...form.register("requiredToolsText")} />
              </FormField>
              <FormField label="声明允许工具" hint="英文逗号分隔；仅声明，运行时暂未生效">
                <input className="mono-input" {...form.register("allowedToolsText")} />
              </FormField>
              <FormField label="正文（Markdown）" wide>
                <textarea rows={16} className="mono-input" {...form.register("body")} />
              </FormField>
            </div>
            <div className="release-actions">
              <button type="button" className="tool-button" onClick={deleteSkill}>删除该 Skill</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
