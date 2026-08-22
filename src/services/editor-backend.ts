import type { EditorProject } from "../domain/types";
import { parseEditorProject } from "../features/project/project-io";

/**
 * 模组包的二进制 Content-Type，与主项目 /api/modules/import、
 * /api/editor/projects/import 的上传约定一致。
 */
export const MODULE_PACKAGE_MEDIA_TYPE = "application/vnd.trpg-master.module+zip";

/**
 * vendored 部署（/editor/ 挂载）下与后端天然同源；dev 用
 * VITE_TRPG_MASTER_URL 指向本地后端。file://（Electron 打包）等没有
 * HTTP origin 的场景回退到本地后端。
 */
export function resolveApiBase(envValue: string | undefined, origin: string): string {
  if (envValue) return envValue;
  return origin.startsWith("http") ? origin : "http://127.0.0.1:8765";
}

const API_BASE = resolveApiBase(
  import.meta.env.VITE_TRPG_MASTER_URL,
  typeof window !== "undefined" ? window.location.origin : "",
);

export type ProjectSummary = {
  session_id: string;
  revision: number;
  updated_at: string;
  title: string;
  package_id: string;
  version: string;
};

export type ProjectSession = {
  session_id: string;
  revision: number;
  created_at: string;
  updated_at: string;
  project: EditorProject;
};

export class RevisionConflictError extends Error {
  constructor(readonly current: ProjectSession) {
    super("工程已被其他窗口更新");
  }
}

/** 云端部署要求管理员登录（cookie session），401/403 时抛出。 */
export class AuthRequiredError extends Error {
  constructor(readonly status: 401 | 403) {
    super(status === 401 ? "需要管理员登录" : "当前账号不在管理员名单内");
    this.name = "AuthRequiredError";
  }
}

/** 后端受控校验错误（export/import 的 400 等），携带 error_code 与逐条 details。 */
export class BackendValidationError extends Error {
  constructor(
    readonly errorCode: string,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = "BackendValidationError";
  }
}

function throwAuthIfNeeded(status: number): void {
  if (status === 401 || status === 403) throw new AuthRequiredError(status);
}

function asValidationError(payload: Record<string, unknown>, status: number): Error {
  const message = String(payload.error || `TRPG Master 返回 HTTP ${status}`);
  if (payload.error_code) {
    return new BackendValidationError(
      String(payload.error_code),
      message,
      Array.isArray(payload.details) ? payload.details.map(String) : [],
    );
  }
  return new Error(message);
}

async function request(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  throwAuthIfNeeded(response.status);
  const payload = (await response.json()) as Record<string, unknown>;
  if (response.status === 409 && payload.current) {
    throw new RevisionConflictError(normalizeSession(payload.current));
  }
  if (!response.ok || payload.ok === false) {
    throw asValidationError(payload, response.status);
  }
  return payload;
}

/** 二进制上传约定：裸 body + X-Module-Filename 头（与主站模组导入一致）。 */
async function uploadPackage(path: string, blob: Blob, filename: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": MODULE_PACKAGE_MEDIA_TYPE,
      "X-Module-Filename": encodeURIComponent(filename),
    },
    body: blob,
  });
  throwAuthIfNeeded(response.status);
  let payload: Record<string, unknown>;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new Error(`TRPG Master 返回了无法解析的响应（HTTP ${response.status}）`);
  }
  if (!response.ok || payload.ok === false) {
    throw asValidationError(payload, response.status);
  }
  return payload;
}

/** 解析 Content-Disposition 的文件名（优先 filename*，回退普通 filename）。 */
export function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const encoded = header.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (encoded) {
    const raw = encoded[1].trim().replace(/^"|"$/g, "");
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1].trim() : null;
}

function normalizeSession(value: unknown): ProjectSession {
  const record = value as Record<string, unknown>;
  return {
    session_id: String(record.session_id || ""),
    revision: Number(record.revision || 0),
    created_at: String(record.created_at || ""),
    updated_at: String(record.updated_at || ""),
    project: parseEditorProject(record.project),
  };
}

export async function createProjectSession(project: EditorProject): Promise<ProjectSession> {
  return normalizeSession(await request("/api/editor/projects", {
    method: "POST",
    body: JSON.stringify({ project }),
  }));
}

export async function getProjectSession(sessionId: string): Promise<ProjectSession> {
  return normalizeSession(await request(`/api/editor/projects/${encodeURIComponent(sessionId)}`));
}

export async function updateProjectSession(
  sessionId: string,
  expectedRevision: number,
  project: EditorProject,
): Promise<ProjectSession> {
  return normalizeSession(await request(`/api/editor/projects/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    body: JSON.stringify({ expected_revision: expectedRevision, project }),
  }));
}

export async function listProjectSessions(): Promise<ProjectSummary[]> {
  const payload = await request("/api/editor/projects");
  return Array.isArray(payload.projects) ? payload.projects as ProjectSummary[] : [];
}

export type CompilePreview = {
  ok: boolean;
  compiler_version?: string;
  diagnostics: Array<{ level: string; code?: string; path?: string; message: string }>;
  trace: Array<{ source_path: string; output_path: string; operation: string }>;
  outputs?: Record<string, unknown> | null;
};

export async function compileProject(project: EditorProject): Promise<CompilePreview> {
  return await request("/api/modules/compile", {
    method: "POST",
    body: JSON.stringify({
      manifest: project.manifest,
      module: project.module,
      keeper_document: project.keeperDocument,
      lorebook: project.lorebook,
    }),
  }) as unknown as CompilePreview;
}

export type PackageDownload = {
  blob: Blob;
  filename: string;
};

/**
 * 把工程导出为 .trpgmod 包。export 返回 zip 二进制，不能按 JSON 解析；
 * 文件名取自 Content-Disposition，缺失时回退 <package_id>-<version>.trpgmod。
 */
export async function exportProjectPackage(
  sessionId: string,
  fallbackFilename: string,
): Promise<PackageDownload> {
  const response = await fetch(
    `${API_BASE}/api/editor/projects/${encodeURIComponent(sessionId)}/export`,
    { method: "POST", credentials: "include" },
  );
  throwAuthIfNeeded(response.status);
  if (!response.ok) {
    let payload: Record<string, unknown> = {};
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      // 非 JSON 错误响应按状态码处理
    }
    throw asValidationError(payload, response.status);
  }
  const blob = await response.blob();
  const filename = parseContentDispositionFilename(response.headers.get("Content-Disposition"))
    || fallbackFilename;
  return { blob, filename };
}

/** 反向导入：.trpgmod → 新工程会话（POST /api/editor/projects/import）。 */
export async function importProjectPackage(blob: Blob, filename: string): Promise<ProjectSession> {
  return normalizeSession(await uploadPackage("/api/editor/projects/import", blob, filename));
}

/** 把 .trpgmod 安装到后端模组库（POST /api/modules/import）。 */
export async function installModulePackage(blob: Blob, filename: string): Promise<Record<string, unknown>> {
  return await uploadPackage("/api/modules/import", blob, filename);
}

/**
 * 切换当前模组；云端账号模式返回 409，视为可容忍（模组已安装，仅不可切换）。
 * 返回是否真正发生了切换。
 */
export async function switchActiveModule(packageId: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/api/modules/switch`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ module: packageId }),
  });
  throwAuthIfNeeded(response.status);
  if (response.status === 409) return false;
  if (!response.ok) {
    let payload: Record<string, unknown> = {};
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      // 非 JSON 错误响应按状态码处理
    }
    throw asValidationError(payload, response.status);
  }
  return true;
}
