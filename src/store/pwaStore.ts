import { create } from 'zustand';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface PWAState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
  isIOSSafari: boolean;
  isInstallable: boolean;
  installDismissed: boolean;

  setDeferredPrompt: (e: BeforeInstallPromptEvent | null) => void;
  setInstalled: (v: boolean) => void;
  setIOSSafari: (v: boolean) => void;
  triggerInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export const usePWAStore = create<PWAState>()((set, get) => ({
  deferredPrompt: null,
  isInstalled: false,
  isIOSSafari: false,
  isInstallable: false,
  installDismissed: false,

  setDeferredPrompt: (e) =>
    set({ deferredPrompt: e, isInstallable: e !== null }),

  setInstalled: (v) =>
    set({ isInstalled: v, isInstallable: v ? false : get().isInstallable }),

  setIOSSafari: (v) => set({ isIOSSafari: v }),

  triggerInstall: async () => {
    const { deferredPrompt } = get();
    if (!deferredPrompt) return 'unavailable';

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        set({ isInstalled: true, deferredPrompt: null, isInstallable: false, installDismissed: false });
        return 'accepted';
      } else {
        set({ deferredPrompt: null, isInstallable: false, installDismissed: true });
        return 'dismissed';
      }
    } catch (err) {
      console.error('[PWA] triggerInstall error:', err);
      set({ deferredPrompt: null, isInstallable: false });
      return 'unavailable';
    }
  },
}));
