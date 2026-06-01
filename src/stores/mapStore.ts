import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type SavedPlaceType = 'home' | 'work' | 'saved' | 'social';
export type MapTab = 'myPlaces' | 'explore';

export interface SavedPlace {
  id: string;
  name: string;
  emoji: string;
  type: SavedPlaceType;
  category?: string;
  hasDeal?: boolean;
  /** The business this place maps to, when it's a real business (not home/work). */
  businessId?: string;
  isPro?: boolean;
  /** Full geocoded address — populated when the user picks a place via search. */
  placeName?: string;
  lat: number;
  lng: number;
  savedAt?: Date;
}

export interface ExploreBusiness {
  id: string;
  name: string;
  emoji: string;
  category: string;
  distanceMiles: number;
  hasDeal: boolean;
  isPro?: boolean;
  lat: number;
  lng: number;
}

export interface UserLocation {
  lat: number;
  lng: number;
}

export interface SearchedLocation {
  id: string;
  name: string;
  emoji: string;
  placeName?: string;
  category?: string;
  /** Set when the searched pin is a Pindrapp business (enables View Profile). */
  businessId?: string;
  lat: number;
  lng: number;
}

export interface MapCenter {
  lat: number;
  lng: number;
  zoom: number;
}

interface MapState {
  savedPlaces: SavedPlace[];
  explorePlaces: ExploreBusiness[];
  activeTab: MapTab;
  selectedPinId: string | null;
  activePopupId: string | null;
  userLocation: UserLocation | null;
  mapCenter: MapCenter;
  flyTarget: { lat: number; lng: number; zoom?: number; ts: number } | null;
  searchQuery: string;
  searchedLocation: SearchedLocation | null;

  setSearchQuery: (q: string) => void;
  setActiveTab: (tab: MapTab) => void;
  selectPin: (id: string) => void;
  clearPin: () => void;
  setActivePopup: (id: string | null) => void;
  setUserLocation: (loc: UserLocation) => void;
  setMapCenter: (center: MapCenter) => void;
  flyToPlace: (id: string) => void;
  flyToCoords: (lat: number, lng: number, zoom?: number) => void;
  addSavedPlace: (place: Omit<SavedPlace, 'savedAt'>) => void;
  removeSavedPlace: (id: string) => void;
  updateSavedPlace: (id: string, partial: Partial<Omit<SavedPlace, 'id'>>) => void;
  hydrateSaved: (places: SavedPlace[]) => void;
  hydrateExplore: (places: ExploreBusiness[]) => void;
  setSearchedLocation: (loc: SearchedLocation | null) => void;
}


export const useMapStore = create<MapState>()(
  immer((set, get) => ({
    savedPlaces: [],
    explorePlaces: [],
    activeTab: 'myPlaces',
    selectedPinId: null,
    activePopupId: null,
    userLocation: null,
    // Neutral world view; the real center comes from GPS on map mount.
    mapCenter: { lat: 39.8283, lng: -98.5795, zoom: 3 },
    flyTarget: null,
    searchQuery: '',
    searchedLocation: null,

    setSearchQuery: (q) =>
      set((s) => {
        s.searchQuery = q;
        if (q.trim().length > 0) s.activeTab = 'explore';
      }),

    setSearchedLocation: (loc) =>
      set((s) => {
        s.searchedLocation = loc;
        if (loc) {
          s.flyTarget = { lat: loc.lat, lng: loc.lng, zoom: 15, ts: Date.now() };
          s.selectedPinId = loc.id;
          s.activePopupId = loc.id;
        }
      }),

    setActiveTab: (tab) =>
      set((s) => {
        s.activeTab = tab;
      }),

    selectPin: (id) =>
      set((s) => {
        s.selectedPinId = id;
        s.activePopupId = id;
      }),

    clearPin: () =>
      set((s) => {
        s.selectedPinId = null;
        s.activePopupId = null;
      }),

    setActivePopup: (id) =>
      set((s) => {
        s.activePopupId = id;
      }),

    setUserLocation: (loc) =>
      set((s) => {
        s.userLocation = loc;
      }),

    setMapCenter: (center) =>
      set((s) => {
        s.mapCenter = center;
      }),

    flyToPlace: (id) => {
      const state = get();
      const candidate =
        state.savedPlaces.find((p) => p.id === id) ??
        state.explorePlaces.find((p) => p.id === id) ??
        (state.searchedLocation?.id === id ? state.searchedLocation : null);
      if (!candidate) return;
      set((s) => {
        s.flyTarget = { lat: candidate.lat, lng: candidate.lng, zoom: 15, ts: Date.now() };
        s.selectedPinId = id;
        s.activePopupId = id;
      });
    },

    flyToCoords: (lat, lng, zoom) =>
      set((s) => {
        s.flyTarget = { lat, lng, zoom, ts: Date.now() };
      }),

    addSavedPlace: (place) =>
      set((s) => {
        if (s.savedPlaces.some((p) => p.id === place.id)) return;
        s.savedPlaces.push({ ...place, savedAt: new Date() });
      }),

    removeSavedPlace: (id) =>
      set((s) => {
        s.savedPlaces = s.savedPlaces.filter((p) => p.id !== id);
        if (s.selectedPinId === id) {
          s.selectedPinId = null;
          s.activePopupId = null;
        }
      }),

    updateSavedPlace: (id, partial) =>
      set((s) => {
        const idx = s.savedPlaces.findIndex((p) => p.id === id);
        if (idx === -1) return;
        const existing = s.savedPlaces[idx];
        // Don't allow callers to change identity/type permanence — `type`
        // CAN be overridden (e.g. saved → home), but `id` stays put.
        s.savedPlaces[idx] = { ...existing, ...partial, id: existing.id };
      }),

    hydrateSaved: (places) =>
      set((s) => {
        s.savedPlaces = places;
      }),

    hydrateExplore: (places) =>
      set((s) => {
        s.explorePlaces = places;
      }),
  })),
);
