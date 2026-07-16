import { create } from "zustand";
import type { ProjectSession, ProjectSummary } from "../services/editor-backend";

export type SyncState = "local" | "connecting" | "saving" | "saved" | "conflict" | "offline";

type SessionState = {
  sessionId: string | null;
  remoteRevision: number;
  syncState: SyncState;
  syncMessage: string;
  conflict: ProjectSession | null;
  recentProjects: ProjectSummary[];
  connect: (session: ProjectSession) => void;
  setSync: (syncState: SyncState, syncMessage: string) => void;
  setConflict: (session: ProjectSession) => void;
  setRecentProjects: (projects: ProjectSummary[]) => void;
  disconnect: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  remoteRevision: 0,
  syncState: "local",
  syncMessage: "本地草稿已启用",
  conflict: null,
  recentProjects: [],
  connect: (session) => set({
    sessionId: session.session_id,
    remoteRevision: session.revision,
    syncState: "saved",
    syncMessage: "已同步到工程会话",
    conflict: null,
  }),
  setSync: (syncState, syncMessage) => set({ syncState, syncMessage }),
  setConflict: (session) => set({
    syncState: "conflict",
    syncMessage: "检测到其他窗口的修改",
    conflict: session,
  }),
  setRecentProjects: (recentProjects) => set({ recentProjects }),
  disconnect: () => set({
    sessionId: null,
    remoteRevision: 0,
    syncState: "local",
    syncMessage: "本地草稿已启用",
    conflict: null,
  }),
}));
