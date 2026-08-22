import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultProject } from "../domain/default-project";
import {
  AuthRequiredError,
  BackendValidationError,
  exportProjectPackage,
  importProjectPackage,
  installModulePackage,
  listProjectSessions,
  parseContentDispositionFilename,
  resolveApiBase,
  RevisionConflictError,
  switchActiveModule,
  updateProjectSession,
} from "./editor-backend";

afterEach(() => vi.unstubAllGlobals());

describe("editor backend", () => {
  it("sends optimistic revision with project updates", async () => {
    const project = createDefaultProject();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      session_id: "editor_0123456789abcdef01234567",
      revision: 4,
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:01Z",
      project,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await updateProjectSession("editor_0123456789abcdef01234567", 3, project);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({ expected_revision: 3 });
  });

  it("exposes the current server version on conflict", async () => {
    const project = createDefaultProject();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      current: {
        session_id: "editor_0123456789abcdef01234567",
        revision: 9,
        created_at: "2026-07-16T00:00:00Z",
        updated_at: "2026-07-16T00:00:01Z",
        project,
      },
    }), { status: 409, headers: { "Content-Type": "application/json" } })));

    const error = await updateProjectSession("editor_0123456789abcdef01234567", 3, project).catch((caught) => caught);
    expect(error).toBeInstanceOf(RevisionConflictError);
    expect((error as RevisionConflictError).current.revision).toBe(9);
  });

  it("sends cookies along with session requests", async () => {
    const project = createDefaultProject();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      session_id: "editor_0123456789abcdef01234567",
      revision: 4,
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:01Z",
      project,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await updateProjectSession("editor_0123456789abcdef01234567", 3, project);
    expect((fetchMock.mock.calls[0][1] as RequestInit).credentials).toBe("include");
  });

  it("throws AuthRequiredError on 401 and 403", async () => {
    for (const status of [401, 403]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
        JSON.stringify({ ok: false, error: "forbidden" }),
        { status, headers: { "Content-Type": "application/json" } },
      )));
      const error = await listProjectSessions().catch((caught) => caught);
      expect(error).toBeInstanceOf(AuthRequiredError);
      expect((error as AuthRequiredError).status).toBe(status);
      vi.unstubAllGlobals();
    }
  });
});

describe("resolveApiBase", () => {
  it("prefers the env override", () => {
    expect(resolveApiBase("http://127.0.0.1:8765", "https://trpggame.xyz")).toBe("http://127.0.0.1:8765");
  });

  it("uses the page origin for same-origin deployments", () => {
    expect(resolveApiBase(undefined, "https://trpggame.xyz")).toBe("https://trpggame.xyz");
    expect(resolveApiBase("", "http://192.168.1.10:8443")).toBe("http://192.168.1.10:8443");
  });

  it("falls back to the local backend without an http origin", () => {
    expect(resolveApiBase(undefined, "file://")).toBe("http://127.0.0.1:8765");
    expect(resolveApiBase(undefined, "")).toBe("http://127.0.0.1:8765");
  });
});

describe("parseContentDispositionFilename", () => {
  it("parses plain and RFC 5987 filenames", () => {
    expect(parseContentDispositionFilename('attachment; filename="mod-1.0.trpgmod"')).toBe("mod-1.0.trpgmod");
    expect(parseContentDispositionFilename("attachment; filename*=UTF-8''%E6%A8%A1%E7%BB%84.trpgmod")).toBe("模组.trpgmod");
  });

  it("returns null without a filename", () => {
    expect(parseContentDispositionFilename(null)).toBeNull();
    expect(parseContentDispositionFilename("attachment")).toBeNull();
  });
});

describe("exportProjectPackage", () => {
  it("returns the zip blob with the server-provided filename", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      new Blob(["zip-bytes"]),
      { status: 200, headers: { "Content-Disposition": 'attachment; filename="mod-1.0.trpgmod"' } },
    )));

    const result = await exportProjectPackage("editor_abc", "fallback.trpgmod");
    expect(result.filename).toBe("mod-1.0.trpgmod");
    expect(await result.blob.text()).toBe("zip-bytes");
  });

  it("falls back to the given filename without Content-Disposition", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Blob(["zip-bytes"]), { status: 200 })));

    const result = await exportProjectPackage("editor_abc", "mod-2.0.trpgmod");
    expect(result.filename).toBe("mod-2.0.trpgmod");
  });

  it("surfaces 400 validation errors with details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        ok: false,
        error_code: "invalid_module",
        error: "模组包校验失败",
        details: ["manifest.id 缺失", "module.json 无法解析"],
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )));

    const error = await exportProjectPackage("editor_abc", "fallback.trpgmod").catch((caught) => caught);
    expect(error).toBeInstanceOf(BackendValidationError);
    expect((error as BackendValidationError).errorCode).toBe("invalid_module");
    expect((error as BackendValidationError).details).toEqual(["manifest.id 缺失", "module.json 无法解析"]);
  });

  it("throws AuthRequiredError on 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    const error = await exportProjectPackage("editor_abc", "fallback.trpgmod").catch((caught) => caught);
    expect(error).toBeInstanceOf(AuthRequiredError);
  });
});

describe("package upload helpers", () => {
  it("installs module packages with the binary upload convention", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ ok: true, module: { package_id: "mod" }, inspection: {} }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    await installModulePackage(new Blob(["zip"]), "模组 1.0.trpgmod");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/modules/import");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/vnd.trpg-master.module+zip");
    expect(headers["X-Module-Filename"]).toBe(encodeURIComponent("模组 1.0.trpgmod"));
  });

  it("imports packages into new project sessions", async () => {
    const project = createDefaultProject();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      session_id: "editor_0123456789abcdef01234567",
      revision: 1,
      created_at: "2026-08-22T00:00:00Z",
      updated_at: "2026-08-22T00:00:00Z",
      project,
    }), { status: 201, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const session = await importProjectPackage(new Blob(["zip"]), "mod.trpgmod");
    expect(session.session_id).toBe("editor_0123456789abcdef01234567");
    expect(session.project.manifest.id).toBe(project.manifest.id);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/editor/projects/import");
  });

  it("keeps import error details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ ok: false, error_code: "invalid_archive", error: "无法解包", details: ["zip 损坏"] }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )));

    const error = await importProjectPackage(new Blob(["zip"]), "mod.trpgmod").catch((caught) => caught);
    expect(error).toBeInstanceOf(BackendValidationError);
    expect((error as BackendValidationError).errorCode).toBe("invalid_archive");
    expect((error as BackendValidationError).details).toEqual(["zip 损坏"]);
  });
});

describe("switchActiveModule", () => {
  it("tolerates 409 from cloud account mode", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ ok: false, error: "cloud account mode" }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    )));
    await expect(switchActiveModule("mod")).resolves.toBe(false);
  });

  it("reports success on 2xx and throws on other failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )));
    await expect(switchActiveModule("mod")).resolves.toBe(true);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ ok: false, error: "模组不存在" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    )));
    await expect(switchActiveModule("missing")).rejects.toThrow("模组不存在");
  });
});
