import { create } from "zustand";

// Auth state is NOT persisted. Tokens live in Windows Credential Manager
// (keyring) only when the user ticked "Stay signed in" at login; otherwise
// they're in-memory and die with the launcher process. On startup
// ProtectedRoute rehydrates this store from /api/account/me if a token
// is available.
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

export const useAuthStore = create<AuthState>((set) => ({
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
}));
