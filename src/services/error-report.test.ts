import { describe, expect, it } from "vitest";
import { buildErrorReport, summarizeDiagnostics, type ReportDiagnostic } from "./error-report";

const sampleDiagnostics: ReportDiagnostic[] = [
  { level: "error", path: "module.scenes.room.exits", message: "出口不存在" },
  { level: "warning", path: "manifest.license", message: "尚未声明内容许可证" },
  { level: "advice", path: "manifest.author", message: "尚未填写作者" },
];

describe("summarizeDiagnostics", () => {
  it("counts diagnostics by level", () => {
    expect(summarizeDiagnostics(sampleDiagnostics)).toEqual({ errors: 1, warnings: 1, advices: 1 });
  });
});

describe("buildErrorReport", () => {
  it("produces a JSON report with metadata and summary", () => {
    const report = buildErrorReport({
      appVersion: "0.3.0",
      host: "electron",
      generatedAt: "2026-08-07T00:00:00Z",
      project: { id: "example.mod", version: "1.0.0", title: "示例", formatVersion: "2.0" },
      diagnostics: sampleDiagnostics,
      session: { syncState: "offline", revision: 3 },
    });

    expect(report.filename).toMatch(/^trpg-editor-report-\d{8}-\d{6}\.json$/);
    const payload = JSON.parse(report.content) as {
      app: { host: string };
      project: { id: string };
      summary: { errors: number };
      diagnostics: unknown[];
    };
    expect(payload.app.host).toBe("electron");
    expect(payload.project.id).toBe("example.mod");
    expect(payload.summary.errors).toBe(1);
    expect(payload.diagnostics).toHaveLength(3);
  });
});
