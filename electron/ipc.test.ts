import { describe, expect, it } from "vitest";
import { devUpdateStatus, IPC } from "./ipc";

describe("ipc channels", () => {
  it("exposes stable channel names", () => {
    expect(IPC.openProjectFile).toBe("editor-host:open-project-file");
    expect(IPC.saveProjectFile).toBe("editor-host:save-project-file");
    expect(IPC.exportReportFile).toBe("editor-host:export-report-file");
    expect(IPC.checkUpdates).toBe("editor-host:check-updates");
  });

  it("reports dev builds as update-disabled", () => {
    const status = devUpdateStatus("0.3.0");
    expect(status).toMatchObject({
      enabled: false,
      checking: false,
      available: false,
      currentVersion: "0.3.0",
    });
    expect(status.error).toContain("已安装");
  });
});
