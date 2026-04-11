import { create } from 'zustand';

export type ActivePanel = 'financial' | 'team' | 'project' | 'events' | 'log';
export type ModalType = 'employee' | 'resume' | 'assignment' | 'event' | null;

interface UIStore {
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;

  modalType: ModalType;
  modalTargetId: string | null;
  openModal: (type: ModalType, targetId?: string | null) => void;
  closeModal: () => void;

  showReport: boolean;
  setShowReport: (v: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activePanel: 'financial',
  setActivePanel: (panel) => set({ activePanel: panel }),

  modalType: null,
  modalTargetId: null,
  openModal: (type, targetId = null) => set({ modalType: type, modalTargetId: targetId }),
  closeModal: () => set({ modalType: null, modalTargetId: null }),

  showReport: false,
  setShowReport: (v) => set({ showReport: v }),
}));
