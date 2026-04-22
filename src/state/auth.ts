import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface AuthState {
  username: string | null;
  displayName: string | null;
  has2fa: boolean;
  pendingToken: string | null;

  setAuthed: (opts: { username: string; displayName?: string; has2fa?: boolean }) => void;
  setPending: (token: string | null, username: string) => void;
  update2fa: (enabled: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      username: null,
      displayName: null,
      has2fa: false,
      pendingToken: null,

      setAuthed: ({ username, displayName, has2fa }) =>
        set({
          username,
          displayName: displayName ?? username,
          has2fa: has2fa ?? false,
          pendingToken: null,
        }),
      setPending: (token, username) => set({ pendingToken: token, username }),
      update2fa: (enabled) => set({ has2fa: enabled }),
      clear: () =>
        set({
          username: null,
          displayName: null,
          has2fa: false,
          pendingToken: null,
        }),
    }),
    {
      name: "starfall.auth",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
