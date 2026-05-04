import { create } from 'zustand';
import type { FanSpeed, MopIntensity } from './api';

interface VacuumStore {
  selectedRoomIds: number[];
  toggleRoomId: (id: number) => void;
  clearRooms: () => void;
  fanSpeed: FanSpeed;
  setFanSpeed: (speed: FanSpeed) => void;
  mopIntensity: MopIntensity;
  setMopIntensity: (intensity: MopIntensity) => void;
}

export const useVacuumStore = create<VacuumStore>((set) => ({
  selectedRoomIds: [],
  toggleRoomId: (id) =>
    set((s) => ({
      selectedRoomIds: s.selectedRoomIds.includes(id)
        ? s.selectedRoomIds.filter((r) => r !== id)
        : [...s.selectedRoomIds, id],
    })),
  clearRooms: () => set({ selectedRoomIds: [] }),
  fanSpeed: 'max',
  setFanSpeed: (fanSpeed) => set({ fanSpeed }),
  mopIntensity: 'high',
  setMopIntensity: (mopIntensity) => set({ mopIntensity }),
}));
