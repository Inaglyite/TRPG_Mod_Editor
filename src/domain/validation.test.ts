import { describe, expect, it } from "vitest";
import { createDefaultProject } from "./default-project";
import { validateProject } from "./validation";

describe("validateProject", () => {
  it("accepts the default project without blocking errors", () => {
    const diagnostics = validateProject(createDefaultProject());
    expect(diagnostics.filter((item) => item.level === "error")).toEqual([]);
    expect(diagnostics.some((item) => item.path === "manifest.license")).toBe(true);
  });

  it("reports dangling scene references with an editor selection", () => {
    const project = createDefaultProject();
    project.module.scenes.opening_scene.exits = ["missing_room"];

    const diagnostic = validateProject(project).find((item) =>
      item.message.includes("missing_room"));

    expect(diagnostic?.level).toBe("error");
    expect(diagnostic?.selection).toEqual({ kind: "scene", id: "opening_scene" });
  });

  it("translates common schema diagnostics into Chinese", () => {
    const project = createDefaultProject();
    project.module.scenes.opening_scene.description = "";

    expect(validateProject(project)).toContainEqual(expect.objectContaining({
      level: "error",
      path: "module.scenes.opening_scene.description",
      message: "至少需要 1 个字符",
    }));
  });

  it("advises authors to define discovery rules for hidden clues", () => {
    const project = createDefaultProject();
    project.module.clues.hidden_note = {
      text: "抽屉夹层里有一张便笺。",
      category: "investigation",
      type: "hidden",
      tier: 1,
      source: null,
      related_npcs: [],
      related_scenes: ["opening_scene"],
      asset_id: null,
      initially_known: false,
      discovery_notes: "",
      extensions: {},
    };

    expect(validateProject(project)).toContainEqual(expect.objectContaining({
      level: "advice",
      path: "module.clues.hidden_note.discovery_notes",
    }));
  });
});
