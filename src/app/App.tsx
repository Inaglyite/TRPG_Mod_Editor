import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { DiagnosticsPanel } from "../components/DiagnosticsPanel";
import { EditorWorkspace } from "../components/EditorWorkspace";
import { EntityTree } from "../components/EntityTree";
import { TopBar } from "../components/TopBar";
import { RecentProjectsDialog } from "../components/RecentProjectsDialog";
import { NewProjectDialog, type NewProjectValues } from "../components/NewProjectDialog";
import { validateProject } from "../domain/validation";
import type { MigrationReport } from "../features/project/project-io";
import {
  downloadProject,
  parseProjectText,
  readProjectFile,
  saveDraft,
} from "../features/project/project-io";
import { ReleaseChecklistDialog } from "../features/release/ReleaseChecklistDialog";
import {
  ExportPackageDialog,
  type ExportDialogData,
  type InstallState,
} from "../features/release/ExportPackageDialog";
import { isProjectDirty, useEditorStore } from "../store/editor-store";
import {
  AuthRequiredError,
  BackendValidationError,
  compileProject,
  createProjectSession,
  exportProjectPackage,
  getProjectSession,
  importProjectPackage,
  installModulePackage,
  listProjectSessions,
  RevisionConflictError,
  switchActiveModule,
  updateProjectSession,
} from "../services/editor-backend";
import { buildErrorReport } from "../services/error-report";
import { isElectronHost, type UpdateStatus } from "../services/host";
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
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [exportDialog, setExportDialog] = useState<ExportDialogData | null>(null);
  const [installState, setInstallState] = useState<InstallState>({ busy: false, message: "", failed: false });
  const [recentOpen, setRecentOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [appVersion, setAppVersion] = useState("0.3.0");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
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

  /** 401/403 时进入「需要管理员登录」空态，其余错误回落到状态栏。 */
  const reportError = useCallback((error: unknown, fallback: string) => {
    if (error instanceof AuthRequiredError) {
      setAuthMessage(error.message);
      return;
    }
    setStatusMessage(error instanceof Error ? error.message : fallback);
  }, []);

  const [connectNonce, setConnectNonce] = useState(0);

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
        setAuthMessage(null);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof AuthRequiredError) {
          setAuthMessage(error.message);
          useSessionStore.getState().setSync("offline", "需要管理员登录");
        } else {
          useSessionStore.getState().setSync("offline", "工程服务不可用，本地草稿仍会保存");
        }
      } finally {
        initialized.current = true;
      }
    }
    void connect();
    return () => { cancelled = true; };
  }, [replaceProject, connectNonce]);

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
        else if (error instanceof AuthRequiredError) setAuthMessage(error.message);
        else useSessionStore.getState().setSync("offline", "自动保存失败，本地草稿已保留");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [markSaved, project, revision, session.sessionId]);

  const handleSave = useCallback(async () => {
    const session = useSessionStore.getState();
    const currentProject = useEditorStore.getState().project;
    if (session.sessionId && session.syncState !== "conflict") {
      try {
        session.setSync("saving", "正在保存…");
        const saved = await updateProjectSession(session.sessionId, session.remoteRevision, currentProject);
        useSessionStore.getState().connect(saved);
        markSaved();
        setStatusMessage("已保存到工程会话");
      } catch (error) {
        if (error instanceof RevisionConflictError) useSessionStore.getState().setConflict(error.current);
        else if (error instanceof AuthRequiredError) setAuthMessage(error.message);
        else setStatusMessage("保存失败，本地草稿已保留");
      }
    } else {
      saveDraft(currentProject);
      markSaved();
      setStatusMessage("已保存到本地草稿");
    }
  }, [markSaved]);

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
        void handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, markSaved, redo, undo]);

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
    } catch (error) {
      if (error instanceof AuthRequiredError) setAuthMessage(error.message);
      else setStatusMessage("无法读取最近工程，请确认 TRPG Master 已启动");
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
      reportError(error, "工程无法打开");
    }
  };

  const handleCompile = async () => {
    setStatusMessage("正在调用 TRPG Master 权威编译器…");
    try {
      const result = await compileProject(project);
      const errors = result.diagnostics.filter((item) => item.level === "error").length;
      setStatusMessage(errors ? `编译完成：${errors} 项错误` : `编译通过 · ${result.compiler_version || "compiler"} · ${result.trace.length} 条 trace`);
    } catch (error) {
      reportError(error, "权威编译失败");
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

  const handleExport = async () => {
    const payload = `${JSON.stringify(project, null, 2)}\n`;
    const host = window.editorHost;
    if (host) {
      const result = await host.saveProjectFile(payload, `${project.manifest.id || "untitled"}.trpgmod-project.json`);
      setStatusMessage(result.canceled ? "已取消导出" : `工程 JSON 已导出：${result.filePath}`);
    } else {
      downloadProject(project);
      setStatusMessage("工程 JSON 已导出");
    }
  };

  /** 导出 .trpgmod：先 flush 未保存的自动保存（700ms 防抖可能仍有在途修改），再请求打包。 */
  const handleExportModule = async () => {
    const session = useSessionStore.getState();
    if (!session.sessionId || session.syncState === "conflict") {
      setStatusMessage("工程服务未连接，无法导出 .trpgmod");
      return;
    }
    setStatusMessage("正在保存并打包 .trpgmod…");
    try {
      const saved = await updateProjectSession(
        session.sessionId,
        session.remoteRevision,
        useEditorStore.getState().project,
      );
      useSessionStore.getState().connect(saved);
      markSaved();
    } catch (error) {
      if (error instanceof RevisionConflictError) useSessionStore.getState().setConflict(error.current);
      else reportError(error, "保存失败，无法导出");
      return;
    }
    try {
      const current = useEditorStore.getState().project;
      const fallback = `${current.manifest.id || "module"}-${current.manifest.version || "0"}.trpgmod`;
      const result = await exportProjectPackage(session.sessionId, fallback);
      setInstallState({ busy: false, message: "", failed: false });
      setExportDialog({ kind: "ready", ...result });
      setStatusMessage(`已导出 ${result.filename}`);
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        setAuthMessage(error.message);
      } else if (error instanceof BackendValidationError) {
        setInstallState({ busy: false, message: "", failed: false });
        setExportDialog({
          kind: "failed",
          message: `导出失败：${error.message}（${error.errorCode}）`,
          details: error.details,
        });
      } else {
        reportError(error, "导出失败");
      }
    }
  };

  const handleDownloadPackage = () => {
    if (!exportDialog || exportDialog.kind !== "ready") return;
    const url = URL.createObjectURL(exportDialog.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = exportDialog.filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatusMessage(`已下载 ${exportDialog.filename}`);
  };

  /** 把刚导出的包安装到后端模组库并切换，然后新标签打开游戏。 */
  const handleInstallAndPlay = async () => {
    if (!exportDialog || exportDialog.kind !== "ready" || installState.busy) return;
    const { blob, filename } = exportDialog;
    setInstallState({ busy: true, message: "正在安装到后端模组库…", failed: false });
    try {
      await installModulePackage(blob, filename);
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        setAuthMessage(error.message);
        return;
      }
      const details = error instanceof BackendValidationError && error.details.length > 0
        ? `：${error.details.join("；")}`
        : "";
      setInstallState({
        busy: false,
        message: `安装失败：${error instanceof Error ? error.message : "未知错误"}${details}`,
        failed: true,
      });
      return;
    }
    setInstallState({ busy: true, message: "安装完成，正在切换当前模组…", failed: false });
    let switched: boolean;
    try {
      switched = await switchActiveModule(useEditorStore.getState().project.manifest.id);
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        setAuthMessage(error.message);
        return;
      }
      setInstallState({
        busy: false,
        message: `模组已安装，但切换失败：${error instanceof Error ? error.message : "未知错误"}`,
        failed: true,
      });
      return;
    }
    setInstallState({
      busy: false,
      message: switched
        ? "已安装并切换为当前模组，正在打开游戏…"
        : "已安装（云端账号模式不可切换模组，请在主站手动选择），正在打开游戏…",
      failed: false,
    });
    window.open("/", "_blank", "noopener");
  };

  /** 反向导入：.trpgmod → 新工程会话（NewProjectDialog 内联展示错误）。 */
  const handleImportPackage = async (file: File) => {
    let remote;
    try {
      remote = await importProjectPackage(file, file.name);
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        setAuthMessage(error.message);
        return;
      }
      throw error;
    }
    replaceProject(remote.project, true);
    useSessionStore.getState().connect(remote);
    window.localStorage.setItem(SESSION_KEY, remote.session_id);
    setNewProjectOpen(false);
    setStatusMessage(`已从 ${file.name} 创建工程：${remote.project.manifest.title}`);
  };

  const applyLoadedProject = (loaded: typeof project, migrationReport: MigrationReport | null) => {
    replaceProject(loaded, true);
    const loadedErrors = validateProject(loaded).filter((item) => item.level === "error").length;
    const migratedText = migrationReport
      ? `；已从 v1 无损迁移至 v2（原工程已备份到浏览器），主线线索 ${migrationReport.essential_clue_ids.length} 条、补插 fallback ${migrationReport.inserted_fallbacks.length} 处`
      : "";
    setStatusMessage(
      loadedErrors
        ? `工程已打开，发现 ${loadedErrors} 项错误${migratedText}`
        : `工程已打开并通过结构检查${migratedText}`,
    );
  };

  const openProjectText = async (text: string) => {
    try {
      const { project: loaded, migrationReport } = parseProjectText(text);
      applyLoadedProject(loaded, migrationReport);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "工程文件无法打开");
    }
  };

  const handleOpenFile = async (file: File) => {
    try {
      const { project: loaded, migrationReport } = await readProjectFile(file);
      applyLoadedProject(loaded, migrationReport);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "工程文件无法打开");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleOpenProject = async () => {
    if (isElectronHost()) {
      const result = await window.editorHost!.openProjectFile();
      if (result.canceled || result.content === undefined) return;
      await openProjectText(result.content);
    } else {
      fileInput.current?.click();
    }
  };

  const handleCheckUpdates = async () => {
    const host = window.editorHost;
    if (!host) {
      setStatusMessage("浏览器版没有自动更新");
      return;
    }
    setStatusMessage("正在检查更新…");
    try {
      const status = await host.checkUpdates();
      setUpdateStatus(status);
      setStatusMessage(
        status.error ? `检查更新失败：${status.error}` :
          status.available ? `发现新版本 ${status.nextVersion}（当前 ${status.currentVersion}）` :
            `已是最新版本（${status.currentVersion}）`,
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "检查更新失败");
    }
  };

  const handleExportReport = async () => {
    const report = buildErrorReport({
      appVersion,
      host: isElectronHost() ? "electron" : "browser",
      generatedAt: new Date().toISOString(),
      project: {
        id: project.manifest.id,
        version: project.manifest.version,
        title: project.manifest.title,
        formatVersion: project.module.format_version,
      },
      diagnostics: diagnostics.map((item) => ({ level: item.level, path: item.path, message: item.message })),
      session: { syncState: session.syncState, revision },
    });
    const host = window.editorHost;
    if (host) {
      const result = await host.exportReportFile(report.content, report.filename);
      setStatusMessage(result.canceled ? "已取消导出报告" : `错误报告已导出：${result.filePath}`);
    } else {
      const blob = new Blob([report.content], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = report.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatusMessage("错误报告已导出");
    }
  };

  useEffect(() => {
    const host = window.editorHost;
    if (!host) return;
    void host.getAppVersion().then(setAppVersion).catch(() => {});
    const offOpen = host.onMenu("open-project", () => void handleOpenProject());
    const offSave = host.onMenu("save-project", () => void handleSave());
    return () => {
      offOpen();
      offSave();
    };
    // handleOpenProject 依赖的 zustand 动作与 setStatusMessage 都稳定，
    // 首次渲染闭包对后续工程始终有效，无需随渲染重建监听。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSave]);

  if (authMessage) {
    return (
      <div className="app-shell auth-shell">
        <main className="auth-required">
          <ShieldAlert size={40} strokeWidth={1.6} />
          <h1>需要管理员登录</h1>
          <p>
            {authMessage}。云端部署的模组工坊只对管理员开放；编辑器与主站同源，
            登录 Cookie 自动共享。请在新标签页完成主站登录，然后回到本页重试。
          </p>
          <div className="auth-actions">
            <a className="primary-button" href="/?mode=online" target="_blank" rel="noreferrer">
              前往主站登录
            </a>
            <button
              type="button"
              className="tool-button"
              onClick={() => { setAuthMessage(null); setConnectNonce((nonce) => nonce + 1); }}
            >
              我已登录，重试
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TopBar
        title={project.manifest.title}
        version={project.manifest.version}
        formatVersion={project.module.format_version}
        dirty={dirty}
        canUndo={historyLength > 0}
        canRedo={futureLength > 0}
        errorCount={errorCount}
        onNew={() => {
          if (!dirty || window.confirm("当前工程有未保存修改，仍要新建吗？")) setNewProjectOpen(true);
        }}
        onOpen={() => void handleOpenProject()}
        onExport={() => void handleExport()}
        onExportModule={() => void handleExportModule()}
        onUndo={undo}
        onRedo={redo}
        onValidate={() => {
          setStatusMessage(errorCount ? `校验完成：${errorCount} 项错误` : "校验完成：结构与引用均有效");
        }}
        onRecent={() => void handleRecent()}
        onCompile={() => void handleCompile()}
        onSaveAs={() => void handleSaveAs()}
        onRelease={() => setReleaseOpen(true)}
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
        <span className={dirty ? "status-dirty" : "status-saved"}>{dirty ? "已修改" : "已保存"}</span>
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
      {newProjectOpen && <NewProjectDialog onCreate={(values) => void handleNew(values)} onImportPackage={handleImportPackage} onClose={() => setNewProjectOpen(false)} />}
      {exportDialog && (
        <ExportPackageDialog
          data={exportDialog}
          installState={installState}
          onDownload={handleDownloadPackage}
          onInstall={() => void handleInstallAndPlay()}
          onClose={() => setExportDialog(null)}
        />
      )}
      {releaseOpen && (
        <ReleaseChecklistDialog
          project={project}
          diagnostics={diagnostics}
          appVersion={appVersion}
          isElectron={isElectronHost()}
          updateStatus={updateStatus}
          onCheckUpdates={() => void handleCheckUpdates()}
          onExportReport={() => void handleExportReport()}
          onClose={() => setReleaseOpen(false)}
        />
      )}
    </div>
  );
}
