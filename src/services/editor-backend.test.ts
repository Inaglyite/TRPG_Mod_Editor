import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultProject } from "../domain/default-project";
import { RevisionConflictError, updateProjectSession } from "./editor-backend";

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
});
