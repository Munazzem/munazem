import { create } from 'zustand';
import type { UIState } from '@/types/ui.types';

/**
 * Zustand Store for Global UI State (Mobile Sidebar Toggle, Theme, etc.)
 */
export const useUIStore = create<UIState>((set) => ({
    isSidebarOpen: false,
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
}));
