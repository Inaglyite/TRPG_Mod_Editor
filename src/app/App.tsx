import { useEffect, useMemo, useRef, useState } from "react";
import { DiagnosticsPanel } from "../components/DiagnosticsPanel";
import { EditorWorkspace } from "../components/EditorWorkspace";
import { EntityTree } from "../components/EntityTree";
import { TopBar } from "../components/TopBar";
import { RecentProjectsDialog } from "../components/RecentProjectsDialog";
import { NewProjectDialog, type NewProjectValues } from "../components/NewProjectDialog";
import { validateProject } from "../domain/validation";
import {
  downloadProject,
  readProjectFile,
  saveDraft,
} from "../features/project/project-io";
import { isProjectDirty, useEditorStore } from "../store/editor-store";
import {
  compileProject,
  createProjectSession,
  getProjectSession,
  listProjectSessions,
  RevisionConflictError,
  updateProjectSession,
} from "../services/editor-backend";
import { useSessionStore } from "../store/session-store";

const SESSION_KEY = "trpg-mod-editor:active-session:v1";

export function App() {
  const project = useEditorStore((state) => state.project);
  const selection = useEditorStore((state) => state.selection);
  const revision = useEditorStore((state) => state.revision);
  const historyLength = useEditorStore((state) => state.history.length);
  const futureLength = useEditorStore((state) => state.future.length);
  const dirty = useEditorStore(isProjectDirty);
  const select = useEditorStore((state) => state.select);
  const addEntity = useEditorStore((state) => state.addEntity);
  const renameEntity = useEditorStore((state) => state.renameEntity);
  const duplicateEntity = useEditorStore((state) => state.duplicateEntity);
  const replaceProject = useEditorStore((state) => state.replaceProject);
  const resetProject = useEditorStore((state) => state.resetProject);
  const markSaved = useEditorStore((state) => state.markSaved);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const fileInput = useRef<HTMLInputElement>(null);
  const [statusMessage, setStatusMessage] = useState("本地草稿已启用");
  const [recentOpen, setRecentOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const initialized = useRef(false);
  const session = useSessionStore();

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
    let cancelled = false;
    async function connect() {
      useSessionStore.getState().setSync("connecting", "正在连接工程服务…");
      try {
        const remembered = window.localStorage.getItem(SESSION_KEY);
        const remote = remembered
          ? await getProjectSession(remembered)
          : await createProjectSession(useEditorStore.getState().project);
        if (cancelled) return;
        window.localStorage.setItem(SESSION_KEY, remote.session_id);
        replaceProject(remote.project, true);
        useSessionStore.getState().connect(remote);
      } catch {
        if (!cancelled) useSessionStore.getState().setSync("offline", "工程服务不可用，本地草稿仍会保存");
      } finally {
        initialized.current = true;
      }
    }
    void connect();
    return () => { cancelled = true; };
  }, [replaceProject]);

  useEffect(() => {
    if (!initialized.current || !session.sessionId || useSessionStore.getState().syncState === "conflict") return;
    const timer = window.setTimeout(async () => {
      const current = useSessionStore.getState();
      if (!current.sessionId || current.syncState === "conflict") return;
      current.setSync("saving", "正在自动保存…");
      try {
        const saved = await updateProjectSession(current.sessionId, current.remoteRevision, project);
        useSessionStore.getState().connect(saved);
        markSaved();
      } catch (error) {
        if (error instanceof RevisionConflictError) useSessionStore.getState().setConflict(error.current);
        else useSessionStore.getState().setSync("offline", "自动保存失败，本地草稿已保留");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [markSaved, project, revision, session.sessionId]);

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

  useEffect(() => {
    const warnBeforeClose = (event: BeforeUnloadEvent) => {
      if (!isProjectDirty(useEditorStore.getState())) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeClose);
    return () => window.removeEventListener("beforeunload", warnBeforeClose);
  }, []);

  const handleNew = async (values: NewProjectValues) => {
    resetProject();
    const fresh = structuredClone(useEditorStore.getState().project);
    fresh.manifest.title = values.title.trim();
    fresh.manifest.id = values.id.trim();
    fresh.manifest.author = values.author.trim();
    fresh.manifest.system = values.system.trim();
    replaceProject(fresh, true);
    setNewProjectOpen(false);
    try {
      const created = await createProjectSession(useEditorStore.getState().project);
      window.localStorage.setItem(SESSION_KEY, created.session_id);
      useSessionStore.getState().connect(created);
      setStatusMessage("已创建空白模组工程");
    } catch {
      useSessionStore.getState().disconnect();
      setStatusMessage("已创建本地工程；服务恢复后可继续同步");
    }
  };

  const handleSaveAs = async () => {
    try {
      const created = await createProjectSession(project);
      window.localStorage.setItem(SESSION_KEY, created.session_id);
      useSessionStore.getState().connect(created);
      markSaved();
      setStatusMessage("已另存为新的工程会话");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "另存为失败");
    }
  };

  const handleRecent = async () => {
    try {
      const projects = await listProjectSessions();
      useSessionStore.getState().setRecentProjects(projects);
      setRecentOpen(true);
    } catch {
      setStatusMessage("无法读取最近工程，请确认 TRPG Master 已启动");
    }
  };

  const openRemoteProject = async (sessionId: string) => {
    try {
      const remote = await getProjectSession(sessionId);
      replaceProject(remote.project, true);
      useSessionStore.getState().connect(remote);
      window.localStorage.setItem(SESSION_KEY, remote.session_id);
      setRecentOpen(false);
      setStatusMessage(`已打开 ${remote.project.manifest.title}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "工程无法打开");
    }
  };

  const handleCompile = async () => {
    setStatusMessage("正在调用 TRPG Master 权威编译器…");
    try {
      const result = await compileProject(project);
      const errors = result.diagnostics.filter((item) => item.level === "error").length;
      setStatusMessage(errors ? `编译完成：${errors} 项错误` : `编译通过 · ${result.compiler_version || "compiler"} · ${result.trace.length} 条 trace`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "权威编译失败");
    }
  };

  const acceptRemote = () => {
    const conflict = useSessionStore.getState().conflict;
    if (!conflict) return;
    replaceProject(conflict.project, true);
    useSessionStore.getState().connect(conflict);
    setStatusMessage("已载入服务器版本");
  };

  const overwriteRemote = async () => {
    const current = useSessionStore.getState();
    if (!current.sessionId || !current.conflict) return;
    try {
      const saved = await updateProjectSession(current.sessionId, current.conflict.revision, project);
      useSessionStore.getState().connect(saved);
      markSaved();
      setStatusMessage("已用本地版本覆盖服务器版本");
    } catch (error) {
      if (error instanceof RevisionConflictError) useSessionStore.getState().setConflict(error.current);
      else setStatusMessage("冲突处理失败，本地内容未丢失");
    }
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
        onNew={() => {
          if (!dirty || window.confirm("当前工程有未保存修改，仍要新建吗？")) setNewProjectOpen(true);
        }}
        onOpen={() => fileInput.current?.click()}
        onExport={handleExport}
        onUndo={undo}
        onRedo={redo}
        onValidate={() => {
          setStatusMessage(errorCount ? `校验完成：${errorCount} 项错误` : "校验完成：结构与引用均有效");
        }}
        onRecent={() => void handleRecent()}
        onCompile={() => void handleCompile()}
        onSaveAs={() => void handleSaveAs()}
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
          onRename={renameEntity}
          onDuplicate={duplicateEntity}
        />
        <EditorWorkspace selection={selection} />
        <DiagnosticsPanel diagnostics={diagnostics} project={project} onSelect={select} />
      </div>
      <footer className="status-bar">
        <span className={dirty ? "status-dirty" : "status-saved"}>{dirty ? "已修改" : "已导出"}</span>
        <span>{statusMessage}</span>
        <span className={`sync-state sync-${session.syncState}`}>{session.syncMessage}</span>
        {session.syncState === "conflict" && <>
          <button type="button" onClick={acceptRemote}>载入服务器版本</button>
          <button type="button" onClick={() => void overwriteRemote()}>保留本地版本</button>
        </>}
        <span className="status-spacer" />
        <code>rev {revision}</code>
        <span>UTF-8</span>
      </footer>
      {recentOpen && <RecentProjectsDialog projects={session.recentProjects} onOpen={(id) => void openRemoteProject(id)} onClose={() => setRecentOpen(false)} />}
      {newProjectOpen && <NewProjectDialog onCreate={(values) => void handleNew(values)} onClose={() => setNewProjectOpen(false)} />}
    </div>
  );
}
