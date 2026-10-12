import type { EditorProject } from "../domain/types";
import { updateProjectSession, type ProjectSession } from "./editor-backend";

export class StaleSessionSaveError extends Error {
  constructor() {
    super("工程已切换或存在版本冲突，已跳过旧工程的保存。");
  }
}

export function createProjectSaveQueue(
  read: () => {
    sessionId: string | null;
    remoteRevision: number;
    syncState: string;
  },
  publish: (session: ProjectSession) => void,
  send = updateProjectSession,
) {
  let queue: Promise<void> = Promise.resolve();
  return (sessionId: string, project: EditorProject) => {
    const task = queue.then(async () => {
      const state = read();
      if (state.sessionId !== sessionId || state.syncState === "conflict")
        throw new StaleSessionSaveError();
      const saved = await send(sessionId, state.remoteRevision, project);
      if (read().sessionId !== sessionId || read().syncState === "conflict")
        throw new StaleSessionSaveError();
      publish(saved);
      return saved;
    });
    queue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  };
}
