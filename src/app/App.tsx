import { useEffect, useMemo, useRef, useState } from "react";
import { DiagnosticsPanel } from "../components/DiagnosticsPanel";
import { EditorWorkspace } from "../components/EditorWorkspace";
import { EntityTree } from "../components/EntityTree";
import { TopBar } from "../components/TopBar";
import { validateProject } from "../domain/validation";
import {
  downloadProject,
  readProjectFile,
  saveDraft,
} from "../features/project/project-io";
import { isProjectDirty, useEditorStore } from "../store/editor-store";

export function App() {
  const project = useEditorStore((state) => state.project);
  const selection = useEditorStore((state) => state.selection);
  const revision = useEditorStore((state) => state.revision);
  const historyLength = useEditorStore((state) => state.history.length);
  const futureLength = useEditorStore((state) => state.future.length);
  const dirty = useEditorStore(isProjectDirty);
  const select = useEditorStore((state) => state.select);
  const addEntity = useEditorStore((state) => state.addEntity);
  const replaceProject = useEditorStore((state) => state.replaceProject);
  const resetProject = useEditorStore((state) => state.resetProject);
  const markSaved = useEditorStore((state) => state.markSaved);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const fileInput = useRef<HTMLInputElement>(null);
  const [statusMessage, setStatusMessage] = useState("本地草稿已启用");

  const diagnostics = useMemo(() => validateProject(project), [project]);
  const errorCount = diagnostics.filter((item) => item.level === "error").length;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        saveDraft(project);
      } catch {
        setStatusMessage("本地草稿保存失败");
      }
    }, 260);
    return () => window.clearTimeout(timer);
  }, [project, revision]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const command = event.ctrlKey || event.metaKey;
      if (!command) return;
      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey)) {
        event.preventDefault();
        redo();
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        downloadProject(useEditorStore.getState().project);
        markSaved();
        setStatusMessage("工程 JSON 已导出");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [markSaved, redo, undo]);

  const handleNew = () => {
    if (dirty && !window.confirm("当前工程有未导出的修改，仍要新建吗？")) return;
    resetProject();
    setStatusMessage("已创建空白模组工程");
  };

  const handleExport = () => {
    downloadProject(project);
    markSaved();
    setStatusMessage("工程 JSON 已导出");
  };

  const handleOpenFile = async (file: File) => {
    try {
      const loaded = await readProjectFile(file);
      replaceProject(loaded, true);
      const loadedErrors = validateProject(loaded).filter((item) => item.level === "error").length;
      setStatusMessage(loadedErrors ? `工程已打开，发现 ${loadedErrors} 项错误` : "工程已打开并通过结构检查");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "工程文件无法打开");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div className="app-shell">
      <TopBar
        title={project.manifest.title}
        version={project.manifest.version}
        dirty={dirty}
        canUndo={historyLength > 0}
        canRedo={futureLength > 0}
        errorCount={errorCount}
        onNew={handleNew}
        onOpen={() => fileInput.current?.click()}
        onExport={handleExport}
        onUndo={undo}
        onRedo={redo}
        onValidate={() => {
          setStatusMessage(errorCount ? `校验完成：${errorCount} 项错误` : "校验完成：结构与引用均有效");
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleOpenFile(file);
        }}
      />
      <div className="workbench-grid">
        <EntityTree
          project={project}
          selection={selection}
          onSelect={select}
          onAdd={addEntity}
        />
        <EditorWorkspace selection={selection} />
        <DiagnosticsPanel diagnostics={diagnostics} project={project} onSelect={select} />
      </div>
      <footer className="status-bar">
        <span className={dirty ? "status-dirty" : "status-saved"}>{dirty ? "已修改" : "已导出"}</span>
        <span>{statusMessage}</span>
        <span className="status-spacer" />
        <code>rev {revision}</code>
        <span>UTF-8</span>
      </footer>
    </div>
  );
}
