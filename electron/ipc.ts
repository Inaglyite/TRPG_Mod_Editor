/** 主进程与渲染进程共享的 IPC 通道常量与请求/响应类型。 */

export const IPC = {
  openProjectFile: "editor-host:open-project-file",
  saveProjectFile: "editor-host:save-project-file",
  exportReportFile: "editor-host:export-report-file",
  chooseProjectsDirectory: "editor-host:choose-projects-directory",
  getProjectsDirectory: "editor-host:get-projects-directory",
  checkUpdates: "editor-host:check-updates",
  installUpdate: "editor-host:install-update",
  getAppVersion: "editor-host:get-app-version",
} as const;

/** 原生菜单动作，主进程 → 渲染进程广播。 */
export const MENU_CHANNEL = "editor-host:menu";

export type MenuAction = "open-project" | "save-project";

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
  /** 桌面版是否已启用自动更新（未打包的 dev 运行返回 false）。 */
  enabled: boolean;
  checking: boolean;
  available: boolean;
  currentVersion: string;
  nextVersion?: string;
  error?: string;
}

export function devUpdateStatus(currentVersion: string): UpdateStatus {
  return {
    enabled: false,
    checking: false,
    available: false,
    currentVersion,
    error: "自动更新仅对已安装的桌面版启用",
  };
}
