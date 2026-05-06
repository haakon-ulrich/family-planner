import { create } from 'zustand';

interface MediaStore {
  selectedArtistId: string | null;
  setSelectedArtist: (id: string | null) => void;
  loadingAlbumBrowseId: string | null;
  setLoadingAlbum: (id: string | null) => void;
}

export const useMediaStore = create<MediaStore>((set) => ({
  selectedArtistId: null,
  setSelectedArtist: (id) => set({ selectedArtistId: id }),
  loadingAlbumBrowseId: null,
  setLoadingAlbum: (id) => set({ loadingAlbumBrowseId: id }),
}));
