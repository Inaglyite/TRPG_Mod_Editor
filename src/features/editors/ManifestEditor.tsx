import { Settings2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { ModuleCapability, ModuleManifest } from "../../domain/types";
import { useEditorStore } from "../../store/editor-store";
import { EditorHeading } from "../../components/EditorHeading";
import { CheckGrid, FormField } from "./FormControls";

interface ManifestFormValues extends Omit<ModuleManifest, "tags"> {
  tagsText: string;
  openingPrompt: string;
}

const capabilities: Array<{ id: ModuleCapability; label: string }> = [
  { id: "custom_skills", label: "自定义 Skill" },
  { id: "bundled_characters", label: "内置调查员" },
  { id: "scene_documents", label: "场景文档" },
];

function toForm(manifest: ModuleManifest, openingPrompt: string): ManifestFormValues {
  return { ...manifest, tagsText: manifest.tags.join(", "), openingPrompt };
}

export function ManifestEditor() {
  const manifest = useEditorStore((state) => state.project.manifest);
  const openingPrompt = useEditorStore((state) => state.project.module.opening_prompt);
  const updateManifest = useEditorStore((state) => state.updateManifest);
  const updateOpeningPrompt = useEditorStore((state) => state.updateOpeningPrompt);
  const form = useForm<ManifestFormValues>({ defaultValues: toForm(manifest, openingPrompt) });

  useEffect(() => {
    form.reset(toForm(manifest, openingPrompt));
  }, [form, manifest, openingPrompt]);

  const commit = () => {
    const values = form.getValues();
    const nextManifest: ModuleManifest = {
      ...values,
      tags: values.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
    };
    delete (nextManifest as ModuleManifest & { tagsText?: string; openingPrompt?: string }).tagsText;
    delete (nextManifest as ModuleManifest & { openingPrompt?: string }).openingPrompt;
    if (JSON.stringify(nextManifest) !== JSON.stringify(manifest)) updateManifest(nextManifest);
    if (values.openingPrompt !== openingPrompt) updateOpeningPrompt(values.openingPrompt);
  };

  return (
    <div className="editor-document">
      <EditorHeading
        eyebrow="MODULE MANIFEST"
        title={manifest.title}
        id={manifest.id}
        icon={<Settings2 size={21} />}
      />
      <form className="editor-form" onBlur={commit}>
        <section className="form-section">
          <h2>基本信息</h2>
          <div className="form-grid">
            <FormField label="模组名称" wide>
              <input {...form.register("title")} />
            </FormField>
            <FormField label="包 ID" hint="发布后应保持稳定">
              <input className="mono-input" {...form.register("id")} />
            </FormField>
            <FormField label="版本">
              <input className="mono-input" {...form.register("version")} />
            </FormField>
            <FormField label="作者">
              <input {...form.register("author")} />
            </FormField>
            <FormField label="规则系统">
              <input {...form.register("system")} />
            </FormField>
            <FormField label="时代">
              <input {...form.register("era")} />
            </FormField>
            <FormField label="语言">
              <input className="mono-input" {...form.register("language")} />
            </FormField>
            <FormField label="简介" wide>
              <textarea rows={4} {...form.register("description")} />
            </FormField>
            <FormField label="标签" hint="使用英文逗号分隔" wide>
              <input {...form.register("tagsText")} />
            </FormField>
          </div>
        </section>

        <section className="form-section">
          <h2>开场与兼容</h2>
          <div className="form-grid">
            <FormField label="开场指令" wide>
              <textarea rows={5} {...form.register("openingPrompt")} />
            </FormField>
            <FormField label="最低引擎版本">
              <input className="mono-input" {...form.register("min_engine_version")} />
            </FormField>
            <FormField label="许可证">
              <input {...form.register("license")} />
            </FormField>
            <FormField label="项目主页" wide>
              <input type="url" {...form.register("homepage")} />
            </FormField>
          </div>
          <CheckGrid label="包能力" emptyText="无额外能力">
            {capabilities.map((capability) => (
              <label className="check-option" key={capability.id}>
                <input
                  type="checkbox"
                  value={capability.id}
                  {...form.register("capabilities")}
                />
                <span>{capability.label}</span>
              </label>
            ))}
          </CheckGrid>
        </section>
      </form>
    </div>
  );
}
