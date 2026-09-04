import { create } from 'zustand';
import { StorageService } from '../services/storage.service';
import { ChildCardSummary } from '../types/child.types';

const SELECTED_CHILD_KEY = 'monazem_selected_child_id';
const SELECTED_CHILD_DATA_KEY = 'monazem_selected_child_data';
const SELECTED_SUBJECT_KEY = 'monazem_selected_subject_id';

interface ChildState {
  selectedChildId: string | null;
  selectedChild: ChildCardSummary | null;
  selectedSubjectId: string | null;
  isHydrated: boolean;

  // Actions
  hydrateSelectedChild: () => Promise<void>;
  setSelectedChild: (child: ChildCardSummary) => Promise<void>;
  setSelectedSubjectId: (subjectId: string | null) => void;
  updateSelectedChildData: (child: ChildCardSummary) => void;
  clearSelectedChild: () => Promise<void>;
}

export const useChildStore = create<ChildState>((set, get) => ({
  selectedChildId: null,
  selectedChild: null,
  selectedSubjectId: null,
  isHydrated: false,

  hydrateSelectedChild: async () => {
    try {
      const [id, dataJson, subjectId] = await Promise.all([
        StorageService.getItem(SELECTED_CHILD_KEY),
        StorageService.getItem(SELECTED_CHILD_DATA_KEY),
        StorageService.getItem(SELECTED_SUBJECT_KEY),
      ]);
      const child = dataJson ? (JSON.parse(dataJson) as ChildCardSummary) : null;
      const initialSubjectId =
        subjectId || child?.subjects?.[0]?.studentId || null;

      set({
        selectedChildId: id ?? null,
        selectedChild: child,
        selectedSubjectId: initialSubjectId,
        isHydrated: true,
      });
    } catch {
      set({ isHydrated: true });
    }
  },

  setSelectedChild: async (child: ChildCardSummary) => {
    const initialSubjectId = child.subjects?.[0]?.studentId || null;
    await Promise.all([
      StorageService.setItem(SELECTED_CHILD_KEY, child.id),
      StorageService.setItem(SELECTED_CHILD_DATA_KEY, JSON.stringify(child)),
      initialSubjectId
        ? StorageService.setItem(SELECTED_SUBJECT_KEY, initialSubjectId)
        : StorageService.deleteItem(SELECTED_SUBJECT_KEY),
    ]);
    set({
      selectedChildId: child.id,
      selectedChild: child,
      selectedSubjectId: initialSubjectId,
    });
  },

  setSelectedSubjectId: (subjectId: string | null) => {
    if (subjectId) {
      StorageService.setItem(SELECTED_SUBJECT_KEY, subjectId).catch(() => {});
    } else {
      StorageService.deleteItem(SELECTED_SUBJECT_KEY).catch(() => {});
    }
    set({ selectedSubjectId: subjectId });
  },

  updateSelectedChildData: (child: ChildCardSummary) => {
    const currentSubjectId = get().selectedSubjectId;
    const exists = child.subjects?.some((s) => s.studentId === currentSubjectId);
    const resolvedSubjectId = exists
      ? currentSubjectId
      : child.subjects?.[0]?.studentId || null;

    set({ selectedChild: child, selectedSubjectId: resolvedSubjectId });
  },

  clearSelectedChild: async () => {
    await Promise.all([
      StorageService.deleteItem(SELECTED_CHILD_KEY),
      StorageService.deleteItem(SELECTED_CHILD_DATA_KEY),
      StorageService.deleteItem(SELECTED_SUBJECT_KEY),
    ]);
    set({ selectedChildId: null, selectedChild: null, selectedSubjectId: null });
  },
}));
