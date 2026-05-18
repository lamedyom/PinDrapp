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
  setSearchedLocation: (loc: SearchedLocation | null) => void;
}

// All seed locations are placed around Hollywood, FL so the app's directions,
// save-to-map and explore features can be exercised from a Hollywood-area device.
// Downtown Hollywood / Young Circle ≈ 26.0118, -80.1495
// Hollywood Beach Broadwalk        ≈ 26.0170, -80.1150
// Residential west of downtown     ≈ 26.0080, -80.1700
const mockSavedPlaces: SavedPlace[] = [
  { id: 'sp1', name: 'Home', emoji: '🏠', type: 'home', lat: 26.008, lng: -80.17 },
  { id: 'sp2', name: 'Work', emoji: '💼', type: 'work', lat: 26.0118, lng: -80.149 },
  {
    id: 'sp3',
    name: "GG's Waterfront",
    emoji: '🥩',
    type: 'social',
    category: 'food',
    hasDeal: false,
    lat: 26.0177,
    lng: -80.1148,
    savedAt: new Date(),
  },
  {
    id: 'sp4',
    name: 'Green Garden Bowls',
    emoji: '🥗',
    type: 'social',
    category: 'food',
    hasDeal: true,
    lat: 26.0098,
    lng: -80.1465,
    savedAt: new Date(),
  },
  {
    id: 'sp5',
    name: "Hollywood Boulevard Boutique",
    emoji: '👗',
    type: 'saved',
    category: 'shopping',
    hasDeal: false,
    lat: 26.0125,
    lng: -80.1502,
    savedAt: new Date(),
  },
];

const mockExplorePlaces: ExploreBusiness[] = [
  { id: 'e1', name: 'Solo Pizza Napoletana', emoji: '🍕', category: 'Food', distanceMiles: 0.3, hasDeal: false, lat: 26.0107, lng: -80.148 },
  { id: 'e2', name: 'Sage Bagel & Deli', emoji: '🥐', category: 'Bakery', distanceMiles: 0.6, hasDeal: true, lat: 26.015, lng: -80.152 },
  { id: 'e3', name: 'Tap 42 Hollywood', emoji: '☕', category: 'Coffee', distanceMiles: 0.4, hasDeal: false, lat: 26.0095, lng: -80.1455 },
  { id: 'e4', name: 'Hollywood Meat Market', emoji: '🔪', category: 'Market', distanceMiles: 0.9, hasDeal: false, lat: 26.008, lng: -80.1545 },
  { id: 'e5', name: 'Vino & Vine Wine Bar', emoji: '🍷', category: 'Wine', distanceMiles: 0.5, hasDeal: true, lat: 26.0135, lng: -80.145 },
  { id: 'e6', name: 'Sushi Song Hollywood', emoji: '🍣', category: 'Japanese', distanceMiles: 0.8, hasDeal: false, lat: 26.0162, lng: -80.1395 },
  { id: 'e7', name: 'Hollywood Gold & Gems', emoji: '💎', category: 'Jewelry', distanceMiles: 0.2, hasDeal: false, lat: 26.0118, lng: -80.1505 },
  { id: 'e8', name: 'The Juice Lab Broadwalk', emoji: '🥤', category: 'Juice Bar', distanceMiles: 1.7, hasDeal: true, lat: 26.0173, lng: -80.1153 },
  { id: 'e9', name: 'Books & Books Hollywood', emoji: '📚', category: 'Books', distanceMiles: 0.4, hasDeal: false, lat: 26.0089, lng: -80.148 },
  { id: 'e10', name: 'Hollywood Tech Repair', emoji: '📱', category: 'Electronics', distanceMiles: 1.1, hasDeal: false, lat: 26.0058, lng: -80.1525 },
];

export const useMapStore = create<MapState>()(
  immer((set, get) => ({
    savedPlaces: mockSavedPlaces,
    explorePlaces: mockExplorePlaces,
    activeTab: 'myPlaces',
    selectedPinId: null,
    activePopupId: null,
    userLocation: null,
    mapCenter: { lat: 40.7484, lng: -73.9857, zoom: 13 },
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
  })),
);
