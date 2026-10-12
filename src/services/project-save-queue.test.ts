import { describe, expect, it, vi } from "vitest";
import { createDefaultProject } from "../domain/default-project";
import {
  createProjectSaveQueue,
  StaleSessionSaveError,
} from "./project-save-queue";
import type { ProjectSession } from "./editor-backend";

function session(revision: number): ProjectSession {
  return {
    session_id: "local-session",
    revision,
    created_at: "2026-10-12",
    updated_at: "2026-10-12",
    project: createDefaultProject(),
  };
}

describe("project save serialization", () => {
  it("serializes autosave and manual save with the latest acknowledged revision", async () => {
    const state = {
      sessionId: "local-session",
      remoteRevision: 0,
      syncState: "saved",
    };
    let finish!: (value: ProjectSession) => void;
    const first = new Promise<ProjectSession>((resolve) => {
      finish = resolve;
    });
    const send = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(session(2));
    const save = createProjectSaveQueue(
      () => state,
      (saved) => {
        state.remoteRevision = saved.revision;
      },
      send,
    );
    const a = save(state.sessionId, createDefaultProject());
    const b = save(state.sessionId, createDefaultProject());
    await Promise.resolve();
    expect(send).toHaveBeenCalledTimes(1);
    finish(session(1));
    await Promise.all([a, b]);
    expect(send.mock.calls.map((args) => args[1])).toEqual([0, 1]);
    expect(state.remoteRevision).toBe(2);
  });

  it("does not publish a late response into a different project session", async () => {
    const state = {
      sessionId: "local-session",
      remoteRevision: 0,
      syncState: "saved",
    };
    let finish!: (value: ProjectSession) => void;
    const response = new Promise<ProjectSession>((resolve) => {
      finish = resolve;
    });
    const publish = vi.fn();
    const save = createProjectSaveQueue(
      () => state,
      publish,
      vi.fn().mockReturnValue(response),
    );
    const pending = save(state.sessionId, createDefaultProject());
    await Promise.resolve();
    state.sessionId = "other-session";
    finish(session(1));
    await expect(pending).rejects.toBeInstanceOf(StaleSessionSaveError);
    expect(publish).not.toHaveBeenCalled();
  });

  it("does not send queued saves after a real revision conflict", async () => {
    const state = {
      sessionId: "local-session",
      remoteRevision: 0,
      syncState: "conflict",
    };
    const send = vi.fn();
    const save = createProjectSaveQueue(() => state, vi.fn(), send);
    await expect(
      save(state.sessionId, createDefaultProject()),
    ).rejects.toBeInstanceOf(StaleSessionSaveError);
    expect(send).not.toHaveBeenCalled();
  });
});
