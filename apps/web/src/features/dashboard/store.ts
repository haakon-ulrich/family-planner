import { create } from 'zustand';

interface DashboardStore {
  isMuted: boolean;
  setMuted: (v: boolean) => void;
  toggleMuted: () => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  isMuted: false,
  setMuted: (v) => set({ isMuted: v }),
  toggleMuted: () => set((s) => ({ isMuted: !s.isMuted })),
}));
