import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions,
} from "electron";
import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { IPC, MENU_CHANNEL, type FileDialogResult, type MenuAction, type SaveDialogResult, type UpdateStatus } from "./ipc";
import { loadSettings, rememberDirectory, saveSettings, type ProjectsSettings } from "./projects-dir";
import { createUpdater } from "./updater";

const IS_DEV = process.env.TRPG_EDITOR_DEV === "1";
const SMOKE_TEST = process.argv.includes("--smoke");

let mainWindow: BrowserWindow | null = null;
let currentUpdateStatus: UpdateStatus | null = null;

function settingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

async function readSettings(): Promise<ProjectsSettings> {
  return loadSettings(settingsPath(), {
    readFile: (filePath) => readFileSync(filePath, "utf8"),
    writeFile: (filePath, content) => void writeFile(filePath, content, "utf8"),
  });
}

async function writeSettings(settings: ProjectsSettings): Promise<void> {
  saveSettings(settingsPath(), settings, {
    readFile: (filePath) => readFileSync(filePath, "utf8"),
    writeFile: (filePath, content) => void writeFile(filePath, content, "utf8"),
  });
}

function windowStatePath(): string {
  return path.join(app.getPath("userData"), "window-state.json");
}

async function loadWindowState(): Promise<{ width: number; height: number; x?: number; y?: number }> {
  try {
    const parsed = JSON.parse(await readFile(windowStatePath(), "utf8")) as {
      width?: unknown;
      height?: unknown;
      x?: unknown;
      y?: unknown;
    };
    return {
      width: typeof parsed.width === "number" ? parsed.width : 1280,
      height: typeof parsed.height === "number" ? parsed.height : 860,
      x: typeof parsed.x === "number" ? parsed.x : undefined,
      y: typeof parsed.y === "number" ? parsed.y : undefined,
    };
  } catch {
    return { width: 1280, height: 860 };
  }
}

async function persistWindowState(window: BrowserWindow): Promise<void> {
  const bounds = window.getNormalBounds();
  await writeFile(windowStatePath(), JSON.stringify(bounds), "utf8");
}

function createWindow(): void {
  void (async () => {
    const state = await loadWindowState();
    mainWindow = new BrowserWindow({
      width: state.width,
      height: state.height,
      x: state.x,
      y: state.y,
      minWidth: 940,
      minHeight: 620,
      title: "TRPG Mod Editor",
      backgroundColor: "#252824",
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    mainWindow.once("ready-to-show", () => {
      mainWindow?.show();
      if (SMOKE_TEST) {
        console.log("[smoke] window ready");
        app.quit();
      }
    });
    mainWindow.on("close", () => {
      if (mainWindow && !SMOKE_TEST) void persistWindowState(mainWindow);
    });
    mainWindow.on("closed", () => {
      mainWindow = null;
    });

    if (IS_DEV) {
      await mainWindow.loadURL("http://127.0.0.1:4173/");
    } else {
      await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
    }
  })();
}

function sendMenu(action: MenuAction): void {
  mainWindow?.webContents.send(MENU_CHANNEL, action);
}

function buildMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "文件",
      submenu: [
        { label: "打开工程…", accelerator: "CmdOrCtrl+O", click: () => sendMenu("open-project") },
        { label: "保存到工程会话", accelerator: "CmdOrCtrl+S", click: () => sendMenu("save-project") },
        { type: "separator" },
        { role: "quit", label: "退出" },
      ],
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "检查更新…",
          click: async () => {
            const status = await checkForUpdates();
            void dialog.showMessageBox(mainWindow!, {
              type: "info",
              title: "检查更新",
              message: status.error
                ? `检查更新失败：${status.error}`
                : status.available
                  ? `发现新版本 ${status.nextVersion}（当前 ${status.currentVersion}）。请从项目主页下载最新安装包。`
                  : `当前已是最新版本（${status.currentVersion}）。`,
            });
          },
        },
        { type: "separator" },
        { label: "关于 TRPG Mod Editor", click: () => void showAbout() },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function showAbout(): Promise<void> {
  void dialog.showMessageBox(mainWindow!, {
    type: "info",
    title: "关于",
    message: `TRPG Mod Editor ${app.getVersion()}`,
    detail: "TRPG Master 的独立模组编辑器。桌面版需要本地或远程 TRPG Master 后端提供工程会话与权威编译。",
  });
}

async function checkForUpdates(): Promise<UpdateStatus> {
  if (!updater) {
    return { enabled: false, checking: false, available: false, currentVersion: app.getVersion(), error: "自动更新未启用" };
  }
  const status = await updater.check();
  currentUpdateStatus = status;
  return status;
}

let updater: ReturnType<typeof createUpdater> | null = null;

function registerIpc(): void {
  ipcMain.handle(IPC.openProjectFile, async (): Promise<FileDialogResult> => {
    const settings = await readSettings();
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: "打开工程",
      defaultPath: settings.projectsDirectory ?? undefined,
      filters: [{ name: "TRPG Mod Editor 工程", extensions: ["json"] }],
      properties: ["openFile"],
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    const filePath = result.filePaths[0];
    try {
      const content = await readFile(filePath, "utf8");
      return { canceled: false, filePath, content };
    } catch (error) {
      void dialog.showErrorBox("无法读取文件", error instanceof Error ? error.message : String(error));
      return { canceled: true };
    }
  });

  ipcMain.handle(IPC.saveProjectFile, async (_event, payload: { content: string; suggestedName: string }): Promise<SaveDialogResult> => {
    const settings = await readSettings();
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: "保存工程",
      defaultPath: path.join(settings.projectsDirectory ?? app.getPath("documents"), payload.suggestedName),
      filters: [{ name: "TRPG Mod Editor 工程", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    try {
      await writeFile(result.filePath, payload.content, "utf8");
      return { canceled: false, filePath: result.filePath };
    } catch (error) {
      void dialog.showErrorBox("无法写入文件", error instanceof Error ? error.message : String(error));
      return { canceled: true };
    }
  });

  ipcMain.handle(IPC.exportReportFile, async (_event, payload: { content: string; suggestedName: string }): Promise<SaveDialogResult> => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: "导出错误报告",
      defaultPath: path.join(app.getPath("documents"), payload.suggestedName),
      filters: [{ name: "JSON 报告", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    try {
      await writeFile(result.filePath, payload.content, "utf8");
      return { canceled: false, filePath: result.filePath };
    } catch (error) {
      void dialog.showErrorBox("无法写入文件", error instanceof Error ? error.message : String(error));
      return { canceled: true };
    }
  });

  ipcMain.handle(IPC.chooseProjectsDirectory, async (): Promise<{ canceled: boolean; directory?: string }> => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: "选择工程目录",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    const settings = await readSettings();
    const updated = rememberDirectory(settings, result.filePaths[0]);
    await writeSettings(updated);
    return { canceled: false, directory: updated.projectsDirectory ?? undefined };
  });

  ipcMain.handle(IPC.getProjectsDirectory, async (): Promise<string | null> => {
    const settings = await readSettings();
    return settings.projectsDirectory;
  });

  ipcMain.handle(IPC.checkUpdates, checkForUpdates);

  ipcMain.handle(IPC.installUpdate, (): void => {
    updater?.install();
  });

  ipcMain.handle(IPC.getAppVersion, (): string => app.getVersion());
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpc();
    if (app.isPackaged) {
      updater = createUpdater({
        onStatus: (status) => {
          currentUpdateStatus = status;
        },
        onError: (message) => {
          currentUpdateStatus = { ...currentUpdateStatus, checking: false, error: message } as UpdateStatus;
        },
      });
    }
    buildMenu();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
