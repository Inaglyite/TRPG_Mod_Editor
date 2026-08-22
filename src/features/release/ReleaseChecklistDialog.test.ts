import { describe, expect, it } from "vitest";
import { createDefaultProject } from "../../domain/default-project";
import { buildChecklist } from "./release-checklist";

describe("buildChecklist", () => {
  it("flags missing license and author on the default project", () => {
    const items = buildChecklist(createDefaultProject(), []);
    const license = items.find((item) => item.label.includes("许可证"));
    const author = items.find((item) => item.label.includes("作者"));
    const errors = items.find((item) => item.label.includes("零错误"));
    const semver = items.find((item) => item.label.includes("SemVer"));

    expect(license?.status).toBe("warn");
    expect(author?.status).toBe("warn");
    expect(errors?.status).toBe("pass");
    expect(semver?.status).toBe("pass");
  });

  it("fails when diagnostics contain errors", () => {
    const project = createDefaultProject();
    const items = buildChecklist(project, [{
      id: "x",
      level: "error",
      path: "module.scenes.opening_scene.exits",
      message: "出口场景 missing 不存在",
    }]);
    expect(items.find((item) => item.label.includes("零错误"))?.status).toBe("fail");
  });

  it("fails on non-semver versions", () => {
    const project = createDefaultProject();
    project.manifest.version = "1.0";
    const items = buildChecklist(project, []);
    expect(items.find((item) => item.label.includes("SemVer"))?.status).toBe("fail");
  });

  it("warns when min_engine_version exceeds the engine baseline", () => {
    const project = createDefaultProject();
    project.manifest.min_engine_version = "2.0.0";
    const items = buildChecklist(project, []);
    expect(items.find((item) => item.label.includes("最低引擎版本"))?.status).toBe("warn");
  });

  it("passes asset references when no asset diagnostics exist", () => {
    const items = buildChecklist(createDefaultProject(), []);
    expect(items.find((item) => item.label.includes("素材映射"))?.status).toBe("pass");
  });
});
