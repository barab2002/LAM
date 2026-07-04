import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { firebaseConfigured } from '../lib/config';
import {
  createUserWithEmailAndPassword,
  getFirebaseAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type FirebaseUser,
} from '../lib/firebase';

const DEV_USER_KEY = 'lam.devUser';

export interface AuthState {
  /** null = signed out, undefined = still restoring */
  email: string | null | undefined;
  firebaseUser: FirebaseUser | null;
  /** True when running without Firebase (x-dev-user header mode) */
  devMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  /** Authorization material for API calls */
  getAuthHeaders: () => Promise<Record<string, string>>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const devMode = !firebaseConfigured;

  useEffect(() => {
    if (devMode) {
      AsyncStorage.getItem(DEV_USER_KEY).then((stored) => setEmail(stored ?? null));
      return;
    }
    const auth = getFirebaseAuth()!;
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setEmail(user?.email ?? null);
    });
  }, [devMode]);

  const signIn = useCallback(
    async (userEmail: string, password: string) => {
      if (devMode) {
        // Local dev identity — no password check; the server auto-provisions
        await AsyncStorage.setItem(DEV_USER_KEY, userEmail);
        setEmail(userEmail);
        return;
      }
      await signInWithEmailAndPassword(getFirebaseAuth()!, userEmail, password);
    },
    [devMode],
  );

  const signUp = useCallback(
    async (userEmail: string, password: string) => {
      if (devMode) {
        await AsyncStorage.setItem(DEV_USER_KEY, userEmail);
        setEmail(userEmail);
        return;
      }
      await createUserWithEmailAndPassword(getFirebaseAuth()!, userEmail, password);
    },
    [devMode],
  );

  const logOut = useCallback(async () => {
    if (devMode) {
      await AsyncStorage.removeItem(DEV_USER_KEY);
      setEmail(null);
      return;
    }
    await signOut(getFirebaseAuth()!);
  }, [devMode]);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (devMode) {
      const stored = await AsyncStorage.getItem(DEV_USER_KEY);
      return stored ? { 'x-dev-user': stored } : {};
    }
    const user = getFirebaseAuth()?.currentUser;
    if (!user) return {};
    return { authorization: `Bearer ${await user.getIdToken()}` };
  }, [devMode]);

  const value = useMemo(
    () => ({ email, firebaseUser, devMode, signIn, signUp, logOut, getAuthHeaders }),
    [email, firebaseUser, devMode, signIn, signUp, logOut, getAuthHeaders],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
