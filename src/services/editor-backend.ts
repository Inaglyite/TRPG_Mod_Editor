import type { EditorProject } from "../domain/types";
import { parseEditorProject } from "../features/project/project-io";

const API_BASE = import.meta.env.VITE_TRPG_MASTER_URL || "http://127.0.0.1:8765";

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

async function request(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (response.status === 409 && payload.current) {
    throw new RevisionConflictError(normalizeSession(payload.current));
  }
  if (!response.ok || payload.ok === false) {
    throw new Error(String(payload.error || `TRPG Master 返回 HTTP ${response.status}`));
  }
  return payload;
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
