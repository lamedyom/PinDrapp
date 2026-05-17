import { create } from 'zustand';

interface ToastState {
  message: string | null;
  show: (message: string, durationMs?: number) => void;
  clear: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  show: (message, durationMs = 2000) => {
    if (timer) clearTimeout(timer);
    set({ message });
    timer = setTimeout(() => set({ message: null }), durationMs);
  },
  clear: () => {
    if (timer) clearTimeout(timer);
    set({ message: null });
  },
}));

export const showToast = (msg: string, durationMs?: number): void =>
  useToastStore.getState().show(msg, durationMs);
