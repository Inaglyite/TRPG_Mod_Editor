/** 工程目录记忆：读写 userData/settings.json，文件 IO 注入以便单测。 */

export const RECENT_DIRECTORY_LIMIT = 5;

export interface ProjectsSettings {
  projectsDirectory: string | null;
  recentDirectories: string[];
}

export const DEFAULT_SETTINGS: ProjectsSettings = {
  projectsDirectory: null,
  recentDirectories: [],
};

/** 规范化目录路径：必须是绝对路径，去掉尾部斜杠，非法返回 null。 */
export function sanitizeDirectory(candidate: unknown): string | null {
  if (typeof candidate !== "string" || candidate.trim() === "") return null;
  if (!candidate.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(candidate)) return null;
  return candidate.replace(/[\\/]+$/, "");
}

export function rememberDirectory(
  settings: ProjectsSettings,
  directory: string,
): ProjectsSettings {
  const normalized = sanitizeDirectory(directory);
  if (!normalized) return settings;
  const recent = [
    normalized,
    ...settings.recentDirectories.filter((item) => item !== normalized),
  ].slice(0, RECENT_DIRECTORY_LIMIT);
  return { projectsDirectory: normalized, recentDirectories: recent };
}

export function parseSettings(raw: string | null | undefined): ProjectsSettings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<ProjectsSettings>;
    return {
      projectsDirectory: sanitizeDirectory(parsed.projectsDirectory),
      recentDirectories: Array.isArray(parsed.recentDirectories)
        ? parsed.recentDirectories
            .map(sanitizeDirectory)
            .filter((item): item is string => item !== null)
            .slice(0, RECENT_DIRECTORY_LIMIT)
        : [],
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function serializeSettings(settings: ProjectsSettings): string {
  return JSON.stringify(settings, null, 2);
}

export interface SettingsIo {
  readFile: (filePath: string) => string;
  writeFile: (filePath: string, content: string) => void;
}

export function loadSettings(settingsPath: string, io: SettingsIo): ProjectsSettings {
  try {
    return parseSettings(io.readFile(settingsPath));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settingsPath: string, settings: ProjectsSettings, io: SettingsIo): void {
  io.writeFile(settingsPath, serializeSettings(settings));
}
