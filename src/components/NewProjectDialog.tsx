import { useRef, useState } from "react";
import { PackageOpen, X } from "lucide-react";
import { BackendValidationError } from "../services/editor-backend";
import { useDialogFocus } from "./useDialogFocus";

export type NewProjectValues = {
  title: string;
  id: string;
  author: string;
  system: string;
};

export function NewProjectDialog(props: {
  onCreate: (values: NewProjectValues) => void;
  onImportPackage: (file: File) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useDialogFocus<HTMLFormElement>(props.onClose);
  const [values, setValues] = useState<NewProjectValues>({
    title: "未命名模组",
    id: "local.untitled",
    author: "",
    system: "COC7",
  });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const packageInput = useRef<HTMLInputElement>(null);
  const valid =
    values.title.trim() && /^[a-z0-9][a-z0-9._-]+$/i.test(values.id);

  const handleImportFile = async (file: File) => {
    setImporting(true);
    setImportError("");
    try {
      await props.onImportPackage(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : "模组包导入失败";
      const details =
        error instanceof BackendValidationError && error.details.length > 0
          ? `：${error.details.join("；")}`
          : "";
      setImportError(`${message}${details}`);
    } finally {
      setImporting(false);
      if (packageInput.current) packageInput.current.value = "";
    }
  };

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={props.onClose}
    >
      <form
        ref={dialog}
        className="project-dialog new-project-dialog"
        role="dialog"
        aria-label="新建模组工程"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) props.onCreate(values);
        }}
      >
        <header>
          <div>
            <strong>新建模组工程</strong>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={props.onClose}
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </header>
        <div className="new-project-fields">
          <p className="section-help">
            先为故事起一个名字。创建后会打开创作总览，引导你完善场景、线索和结局；随时可以自由跳转。
          </p>
          <label>
            模组名称
            <input
              autoFocus
              value={values.title}
              onChange={(event) =>
                setValues({ ...values, title: event.target.value })
              }
            />
          </label>
          <label>
            包 ID
            <input
              className="mono-input"
              value={values.id}
              onChange={(event) =>
                setValues({ ...values, id: event.target.value })
              }
            />
          </label>
          <small className="small-muted">
            使用字母、数字、点、下划线或短横线，例如
            local.my_story；发布后保持稳定。
          </small>
          <label>
            作者
            <input
              value={values.author}
              onChange={(event) =>
                setValues({ ...values, author: event.target.value })
              }
            />
          </label>
          <label>
            规则系统
            <input
              value={values.system}
              onChange={(event) =>
                setValues({ ...values, system: event.target.value })
              }
            />
          </label>
          <button
            className="primary-button"
            type="submit"
            disabled={!valid || importing}
          >
            创建模组，开始写作
          </button>
          <div className="import-package-block">
            <span className="import-package-title">已有打包好的模组？</span>
            <button
              type="button"
              className="tool-button"
              disabled={importing}
              onClick={() => packageInput.current?.click()}
            >
              <PackageOpen size={15} />
              <span>{importing ? "正在导入…" : "从 .trpgmod 包创建"}</span>
            </button>
            {importError && (
              <p className="import-package-error">{importError}</p>
            )}
          </div>
        </div>
        <input
          ref={packageInput}
          type="file"
          accept=".trpgmod,application/zip"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImportFile(file);
          }}
        />
      </form>
    </div>
  );
}
