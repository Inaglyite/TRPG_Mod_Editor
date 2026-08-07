import { autoUpdater } from "electron-updater";
import { devUpdateStatus, type UpdateStatus } from "./ipc";

export interface UpdaterEvents {
  onStatus: (status: UpdateStatus) => void;
  onError: (message: string) => void;
}

/**
 * 自动更新封装。只对已安装（打包）的应用启用；dev 运行（未打包）时
 * 返回占位状态，避免 electron-updater 在开发模式报错。
 */
export function createUpdater(events: UpdaterEvents): {
  check: () => Promise<UpdateStatus>;
  install: () => void;
} {
  let checking = false;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    checking = true;
    events.onStatus({ ...devUpdateStatus(autoUpdater.currentVersion), enabled: true, checking: true });
  });
  autoUpdater.on("update-available", (info) => {
    checking = false;
    events.onStatus({
      enabled: true,
      checking: false,
      available: true,
      currentVersion: autoUpdater.currentVersion,
      nextVersion: info.version,
    });
  });
  autoUpdater.on("update-not-available", () => {
    checking = false;
    events.onStatus({ ...devUpdateStatus(autoUpdater.currentVersion), enabled: true, checking: false });
  });
  autoUpdater.on("error", (error) => {
    checking = false;
    events.onError(error?.message ?? String(error));
  });

  return {
    check: async (): Promise<UpdateStatus> => {
      if (!autoUpdater.isUpdaterActive()) {
        return devUpdateStatus(autoUpdater.currentVersion);
      }
      if (checking) {
        return { ...devUpdateStatus(autoUpdater.currentVersion), enabled: true, checking: true };
      }
      await autoUpdater.checkForUpdates();
      return { ...devUpdateStatus(autoUpdater.currentVersion), enabled: true, checking: true };
    },
    install: () => {
      autoUpdater.quitAndInstall();
    },
  };
}
