import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  getAuth,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";

import { app } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const auth = getAuth(app);

function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState({
    user: null as User | null,
    isAdmin: false,
    loading: true,
  });

  useEffect(() => {
    let requestId = 0;
    let refreshedUid: string | undefined;
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      const id = ++requestId;
      let token = await user?.getIdTokenResult().catch(() => null);
      if (id !== requestId) return;
      if (user && token?.claims.auctionAdmin !== true && refreshedUid !== user.uid) {
        refreshedUid = user.uid;
        token = await user.getIdTokenResult(true).catch(() => token);
      }
      if (id === requestId) {
        setSession({ user, isAdmin: token?.claims.auctionAdmin === true, loading: false });
      }
    });
    return () => {
      requestId += 1;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...session,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email, password);
      },
      signOut: async () => {
        await firebaseSignOut(auth);
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}

export { AuthProvider, useAuth };
