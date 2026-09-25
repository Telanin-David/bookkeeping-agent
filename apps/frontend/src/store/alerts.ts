import { create } from 'zustand';

interface AlertsState {
  activeCount: number;
  setActiveCount: (n: number) => void;
  increment: () => void;
  decrement: () => void;
}

export const useAlertsStore = create<AlertsState>((set) => ({
  activeCount: 0,
  setActiveCount: (n) => set({ activeCount: n }),
  increment: () => set((s) => ({ activeCount: s.activeCount + 1 })),
  decrement: () => set((s) => ({ activeCount: Math.max(0, s.activeCount - 1) })),
}));
