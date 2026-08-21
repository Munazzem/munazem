import { create } from 'zustand';

interface AppState {
  selectedChildId: string | null;
  selectedSubjectId: string | null; // null means "All Subjects"
  hasSeenNotificationPrompt: boolean;

  setSelectedChildId: (id: string | null) => void;
  setSelectedSubjectId: (id: string | null) => void;
  setHasSeenNotificationPrompt: (seen: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedChildId: null,
  selectedSubjectId: null,
  hasSeenNotificationPrompt: false,

  setSelectedChildId: (id) => set({ selectedChildId: id, selectedSubjectId: null }),
  setSelectedSubjectId: (id) => set({ selectedSubjectId: id }),
  setHasSeenNotificationPrompt: (seen) => set({ hasSeenNotificationPrompt: seen }),
}));
