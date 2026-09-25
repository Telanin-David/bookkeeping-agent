import { create } from 'zustand';

interface ImportsState {
  pendingFile: File | null;
  setPendingFile: (file: File | null) => void;
}

export const useImportsStore = create<ImportsState>()((set) => ({
  pendingFile: null,
  setPendingFile: (file) => set({ pendingFile: file }),
}));
