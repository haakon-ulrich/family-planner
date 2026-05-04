import { create } from 'zustand';

interface VacuumStore {
  selectedRoomId: number | null;
  setSelectedRoomId: (id: number | null) => void;
}

export const useVacuumStore = create<VacuumStore>((set) => ({
  selectedRoomId: null,
  setSelectedRoomId: (id) => set({ selectedRoomId: id }),
}));
