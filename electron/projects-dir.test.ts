import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  parseSettings,
  rememberDirectory,
  sanitizeDirectory,
  saveSettings,
  serializeSettings,
} from "./projects-dir";

describe("sanitizeDirectory", () => {
  it("accepts absolute POSIX and Windows paths without trailing slashes", () => {
    expect(sanitizeDirectory("/home/user/projects/")).toBe("/home/user/projects");
    expect(sanitizeDirectory("C:\\Users\\me\\mods\\")).toBe("C:\\Users\\me\\mods");
    expect(sanitizeDirectory("/")).toBe("");
  });

  it("rejects relative, empty and non-string values", () => {
    expect(sanitizeDirectory("relative/path")).toBeNull();
    expect(sanitizeDirectory("")).toBeNull();
    expect(sanitizeDirectory("  ")).toBeNull();
    expect(sanitizeDirectory(42)).toBeNull();
    expect(sanitizeDirectory(null)).toBeNull();
  });
});

describe("rememberDirectory", () => {
  it("deduplicates and keeps the newest directory first", () => {
    const settings = rememberDirectory(DEFAULT_SETTINGS, "/a");
    const second = rememberDirectory(settings, "/b");
    const again = rememberDirectory(second, "/a");
    expect(again.projectsDirectory).toBe("/a");
    expect(again.recentDirectories).toEqual(["/a", "/b"]);
  });

  it("caps recent directories at five entries", () => {
    let settings = DEFAULT_SETTINGS;
    for (let index = 1; index <= 7; index += 1) {
      settings = rememberDirectory(settings, `/dir-${index}`);
    }
    expect(settings.recentDirectories).toHaveLength(5);
    expect(settings.recentDirectories[0]).toBe("/dir-7");
    expect(settings.recentDirectories).not.toContain("/dir-1");
  });

  it("ignores invalid directories", () => {
    const settings = rememberDirectory(DEFAULT_SETTINGS, "not-absolute");
    expect(settings).toBe(DEFAULT_SETTINGS);
  });
});

describe("parseSettings", () => {
  it("returns defaults for malformed input", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{broken")).toEqual(DEFAULT_SETTINGS);
  });

  it("parses persisted settings and filters invalid entries", () => {
    const raw = serializeSettings({
      projectsDirectory: "/home/user/mods/",
      recentDirectories: ["/home/user/mods", "relative", "/tmp/other/"],
    });
    expect(parseSettings(raw)).toEqual({
      projectsDirectory: "/home/user/mods",
      recentDirectories: ["/home/user/mods", "/tmp/other"],
    });
  });
});

describe("settings io", () => {
  it("falls back to defaults when the file is missing", () => {
    const io = {
      readFile: () => { throw new Error("ENOENT"); },
      writeFile: () => {},
    };
    expect(loadSettings("/tmp/settings.json", io)).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips through save and load", () => {
    let stored = "";
    const io = {
      readFile: () => stored,
      writeFile: (filePath: string, content: string) => { stored = content; },
    };
    const settings = rememberDirectory(DEFAULT_SETTINGS, "/home/user/mods");
    saveSettings("/tmp/settings.json", settings, io);
    expect(loadSettings("/tmp/settings.json", io)).toEqual(settings);
  });
});
