/** Electron 桌面壳的窄权限宿主接口；浏览器环境没有 window.editorHost。 */

export interface FileDialogResult {
  canceled: boolean;
  filePath?: string;
  content?: string;
}

export interface SaveDialogResult {
  canceled: boolean;
  filePath?: string;
}

export interface UpdateStatus {
  enabled: boolean;
  checking: boolean;
  available: boolean;
  currentVersion: string;
  nextVersion?: string;
  error?: string;
}

export interface EditorHost {
  openProjectFile(): Promise<FileDialogResult>;
  saveProjectFile(content: string, suggestedName: string): Promise<SaveDialogResult>;
  exportReportFile(content: string, suggestedName: string): Promise<SaveDialogResult>;
  chooseProjectsDirectory(): Promise<{ canceled: boolean; directory?: string }>;
  getProjectsDirectory(): Promise<string | null>;
  checkUpdates(): Promise<UpdateStatus>;
  installUpdate(): Promise<void>;
  getAppVersion(): Promise<string>;
  onMenu(action: "open-project" | "save-project", handler: () => void): () => void;
}

declare global {
  interface Window {
    editorHost?: EditorHost;
  }
}

export function isElectronHost(): boolean {
  return typeof window !== "undefined" && Boolean(window.editorHost);
}
