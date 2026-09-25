import { create } from 'zustand';

interface ChatState {
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  activeSessionId: null,
  setActiveSessionId: (id) => set({ activeSessionId: id }),
}));
