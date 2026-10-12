import { create } from "zustand";

type DraftArea = "source" | "content";
export const useWorkspaceDrafts = create<{
  pending: Record<DraftArea, boolean>;
  setPending: (area: DraftArea, value: boolean) => void;
}>((set) => ({
  pending: { source: false, content: false },
  setPending: (area, value) =>
    set((state) =>
      state.pending[area] === value
        ? state
        : { pending: { ...state.pending, [area]: value } },
    ),
}));
export function hasWorkspaceDrafts() {
  return Object.values(useWorkspaceDrafts.getState().pending).some(Boolean);
}
