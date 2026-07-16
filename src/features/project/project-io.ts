import { createDefaultProject } from "../../domain/default-project";
import type { EditorProject } from "../../domain/types";

export const DRAFT_STORAGE_KEY = "trpg-mod-editor:draft:v2";
const LEGACY_DRAFT_STORAGE_KEY = "trpg-mod-editor:draft:v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseEditorProject(value: unknown): EditorProject {
  if (!isRecord(value) || !isRecord(value.manifest) || !isRecord(value.module)) {
    throw new Error("文件不是有效的 TRPG Mod Editor 工程");
  }
  if (value.editor_version !== 1 && value.editor_version !== 2) {
    throw new Error("当前只支持 editor_version 1 或 2");
  }
  if (!isRecord(value.module.scenes)) {
    throw new Error("工程缺少 module.scenes");
  }
  if (value.editor_version === 1) {
    return {
      ...(structuredClone(value) as unknown as Omit<EditorProject, "editor_version" | "lorebook">),
      editor_version: 2,
      lorebook: isRecord(value.lorebook) ? value.lorebook : null,
    };
  }
  return {
    ...(value as unknown as EditorProject),
    lorebook: isRecord(value.lorebook) ? value.lorebook : null,
  };
}

export function loadDraft(): EditorProject {
  if (typeof window === "undefined") return createDefaultProject();
  const serialized = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    ?? window.localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY);
  if (!serialized) return createDefaultProject();
  try {
    return parseEditorProject(JSON.parse(serialized));
  } catch {
    return createDefaultProject();
  }
}

export function saveDraft(project: EditorProject): void {
  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(project));
}

export async function readProjectFile(file: File): Promise<EditorProject> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch (error) {
    throw new Error("工程文件不是有效 JSON", { cause: error });
  }
  return parseEditorProject(parsed);
}

export function downloadProject(project: EditorProject): void {
  const payload = `${JSON.stringify(project, null, 2)}\n`;
  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${project.manifest.id || "untitled"}.trpgmod-project.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
