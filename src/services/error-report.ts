/** 错误报告组装（纯函数）：把诊断与工程元数据汇成可导出的 JSON。 */

export interface ReportDiagnostic {
  level: "error" | "warning" | "advice";
  path: string;
  message: string;
}

export interface ReportSource {
  appVersion: string;
  host: "browser" | "electron";
  generatedAt: string;
  project: {
    id: string;
    version: string;
    title: string;
    formatVersion: string;
  };
  diagnostics: ReportDiagnostic[];
  session: {
    syncState: string;
    revision: number;
  };
}

export interface ErrorReport {
  filename: string;
  content: string;
}

function timestampLabel(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

export function summarizeDiagnostics(diagnostics: ReportDiagnostic[]): {
  errors: number;
  warnings: number;
  advices: number;
} {
  return {
    errors: diagnostics.filter((item) => item.level === "error").length,
    warnings: diagnostics.filter((item) => item.level === "warning").length,
    advices: diagnostics.filter((item) => item.level === "advice").length,
  };
}

export function buildErrorReport(source: ReportSource): ErrorReport {
  const generatedAt = new Date();
  const summary = summarizeDiagnostics(source.diagnostics);
  const payload = {
    app: {
      version: source.appVersion,
      host: source.host,
    },
    generatedAt: generatedAt.toISOString(),
    project: source.project,
    session: source.session,
    summary,
    diagnostics: source.diagnostics,
  };
  return {
    filename: `trpg-editor-report-${timestampLabel(generatedAt)}.json`,
    content: `${JSON.stringify(payload, null, 2)}\n`,
  };
}
