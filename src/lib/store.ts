import { create } from "zustand";

interface AppState {
  adminSelectedTournamentId: string | null;
  setAdminSelectedTournamentId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  adminSelectedTournamentId: null,
  setAdminSelectedTournamentId: (id) => set({ adminSelectedTournamentId: id }),
}));
