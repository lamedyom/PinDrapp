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

  setActiveTab: (tab: MapTab) => void;
  selectPin: (id: string) => void;
  clearPin: () => void;
  setActivePopup: (id: string | null) => void;
  setUserLocation: (loc: UserLocation) => void;
  setMapCenter: (center: MapCenter) => void;
  flyToPlace: (id: string) => void;
  flyToCoords: (lat: number, lng: number, zoom?: number) => void;
  addSavedPlace: (place: Omit<SavedPlace, 'savedAt'>) => void;
}

const mockSavedPlaces: SavedPlace[] = [
  { id: 'sp1', name: 'Home', emoji: '🏠', type: 'home', lat: 40.7484, lng: -73.9857 },
  { id: 'sp2', name: 'Work', emoji: '💼', type: 'work', lat: 40.7549, lng: -73.984 },
  {
    id: 'sp3',
    name: 'Prime Grill',
    emoji: '🥩',
    type: 'social',
    category: 'food',
    hasDeal: false,
    lat: 40.751,
    lng: -73.982,
    savedAt: new Date(),
  },
  {
    id: 'sp4',
    name: 'Green Garden',
    emoji: '🥗',
    type: 'social',
    category: 'food',
    hasDeal: true,
    lat: 40.749,
    lng: -73.987,
    savedAt: new Date(),
  },
  {
    id: 'sp5',
    name: "Rivka's Boutique",
    emoji: '👗',
    type: 'saved',
    category: 'shopping',
    hasDeal: false,
    lat: 40.753,
    lng: -73.98,
    savedAt: new Date(),
  },
];

const mockExplorePlaces: ExploreBusiness[] = [
  { id: 'e1', name: 'Solo Pizza', emoji: '🍕', category: 'Food', distanceMiles: 0.4, hasDeal: false, lat: 40.7505, lng: -73.9845 },
  { id: 'e2', name: 'Challah Co.', emoji: '🥐', category: 'Bakery', distanceMiles: 0.8, hasDeal: true, lat: 40.7478, lng: -73.988 },
  { id: 'e3', name: 'Café Beit', emoji: '☕', category: 'Coffee', distanceMiles: 0.9, hasDeal: false, lat: 40.752, lng: -73.98 },
  { id: 'e4', name: 'The Kosher Butcher', emoji: '🔪', category: 'Market', distanceMiles: 1.1, hasDeal: false, lat: 40.746, lng: -73.991 },
  { id: 'e5', name: 'Vino & Vine', emoji: '🍷', category: 'Wine', distanceMiles: 1.3, hasDeal: true, lat: 40.7535, lng: -73.978 },
  { id: 'e6', name: 'Sushi Levy', emoji: '🍣', category: 'Japanese', distanceMiles: 1.5, hasDeal: false, lat: 40.7555, lng: -73.976 },
  { id: 'e7', name: 'Gold & Gems', emoji: '💎', category: 'Jewelry', distanceMiles: 1.8, hasDeal: false, lat: 40.7445, lng: -73.993 },
  { id: 'e8', name: 'Fresh Pressery', emoji: '🥤', category: 'Juice Bar', distanceMiles: 2.0, hasDeal: true, lat: 40.757, lng: -73.974 },
  { id: 'e9', name: 'Books & More', emoji: '📚', category: 'Books', distanceMiles: 2.2, hasDeal: false, lat: 40.743, lng: -73.995 },
  { id: 'e10', name: 'Tech Repair Hub', emoji: '📱', category: 'Electronics', distanceMiles: 2.5, hasDeal: false, lat: 40.759, lng: -73.972 },
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
      const all = [...get().savedPlaces, ...get().explorePlaces];
      const target = all.find((p) => p.id === id);
      if (!target) return;
      set((s) => {
        s.flyTarget = { lat: target.lat, lng: target.lng, zoom: 15, ts: Date.now() };
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
