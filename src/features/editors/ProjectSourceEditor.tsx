import { Braces, Check, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { inspectProjectEdit } from "../../domain/authoring";
import { useEditorStore } from "../../store/editor-store";
import { EditorHeading } from "../../components/EditorHeading";
import { useWorkspaceDrafts } from "../../store/workspace-drafts";

export function ProjectSourceEditor() {
  const project = useEditorStore((state) => state.project);
  const apply = useEditorStore((state) => state.applyProjectEdit);
  const [base, setBase] = useState(() => JSON.stringify(project));
  const [text, setText] = useState(() => JSON.stringify(project, null, 2));
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const changedOutside = base !== JSON.stringify(project);
  useEffect(() => {
    useWorkspaceDrafts
      .getState()
      .setPending("source", text !== JSON.stringify(JSON.parse(base), null, 2));
    return () => useWorkspaceDrafts.getState().setPending("source", false);
  }, [text, base]);
  if (changedOutside && text === JSON.stringify(JSON.parse(base), null, 2)) {
    setBase(JSON.stringify(project));
    setText(JSON.stringify(project, null, 2));
  }
  const inspect = (commit: boolean) => {
    try {
      if (commit && changedOutside)
        throw new Error(
          "工程已在其他位置修改。请先重新载入当前工程，再应用编辑，避免覆盖已有修改。",
        );
      const result = inspectProjectEdit(text);
      if (commit) {
        apply(result.project);
        setBase(JSON.stringify(result.project));
        setText(JSON.stringify(result.project, null, 2));
      }
      const errors = result.diagnostics.filter(
        (item) => item.level === "error",
      ).length;
      setMessage(
        `${commit ? "已应用，可撤销" : "JSON 结构有效"}${errors ? `；仍有 ${errors} 项引用或规则问题，请在工程检查中处理。` : "；结构与引用检查通过。"}`,
      );
      setFailed(false);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "无法读取 JSON。");
    }
  };
  return (
    <div className="editor-document">
      <EditorHeading
        eyebrow="ADVANCED AUTHORING"
        title="完整源码编辑"
        icon={<Braces size={23} />}
      />
      <div className="inline-help">
        自由编辑整个工程，包括扩展字段和规则。应用前会检查 JSON
        结构；成功修改只产生一次撤销记录。
      </div>
      <div className="source-actions">
        <button className="secondary-button" onClick={() => inspect(false)}>
          <Check size={16} /> 检查 JSON
        </button>
        <button
          className="secondary-button"
          onClick={() => {
            if (window.confirm("放弃源码草稿并重新载入当前工程？")) {
              setText(JSON.stringify(project, null, 2));
              setBase(JSON.stringify(project));
              setMessage("");
            }
          }}
        >
          <RotateCcw size={16} /> 重新载入
        </button>
        <button className="primary-button" onClick={() => inspect(true)}>
          应用到工程
        </button>
      </div>
      {changedOutside && (
        <p className="inline-warning">
          当前工程已改变，源码草稿仍保留；重新载入后再应用。
        </p>
      )}
      {message && (
        <p
          className={failed ? "content-save-error" : "inline-success"}
          role="status"
        >
          {message}
        </p>
      )}
      <textarea
        className="source-editor mono-input"
        aria-label="工程 JSON 源码"
        spellCheck={false}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <p className="small-muted">
        自定义字段放入 extensions；模组格式与工程容器版本各自独立。Ctrl / ⌘ + S
        保存已应用的工程。
      </p>
    </div>
  );
}
