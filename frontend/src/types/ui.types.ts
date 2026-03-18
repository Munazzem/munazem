/**
 * UI State Types
 */

export interface UIState {
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    setSidebarOpen: (isOpen: boolean) => void;
    deferredPrompt: any;
    setDeferredPrompt: (prompt: any) => void;
}
