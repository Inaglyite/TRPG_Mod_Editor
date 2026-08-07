import { contextBridge, ipcRenderer } from "electron";
import { IPC, MENU_CHANNEL, type FileDialogResult, type MenuAction, type SaveDialogResult, type UpdateStatus } from "./ipc";

/**
 * 窄权限桥：渲染进程只能拿到白名单方法，文件读写全部由主进程
 * 通过系统对话框完成，不暴露 Node/fs API。
 */
const host = {
  openProjectFile: (): Promise<FileDialogResult> => ipcRenderer.invoke(IPC.openProjectFile),
  saveProjectFile: (content: string, suggestedName: string): Promise<SaveDialogResult> =>
    ipcRenderer.invoke(IPC.saveProjectFile, { content, suggestedName }),
  exportReportFile: (content: string, suggestedName: string): Promise<SaveDialogResult> =>
    ipcRenderer.invoke(IPC.exportReportFile, { content, suggestedName }),
  chooseProjectsDirectory: (): Promise<{ canceled: boolean; directory?: string }> =>
    ipcRenderer.invoke(IPC.chooseProjectsDirectory),
  getProjectsDirectory: (): Promise<string | null> => ipcRenderer.invoke(IPC.getProjectsDirectory),
  checkUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke(IPC.checkUpdates),
  installUpdate: (): Promise<void> => ipcRenderer.invoke(IPC.installUpdate),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke(IPC.getAppVersion),
  onMenu: (action: MenuAction, handler: () => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, received: MenuAction): void => {
      if (received === action) handler();
    };
    ipcRenderer.on(MENU_CHANNEL, listener);
    return () => ipcRenderer.removeListener(MENU_CHANNEL, listener);
  },
};

contextBridge.exposeInMainWorld("editorHost", host);
