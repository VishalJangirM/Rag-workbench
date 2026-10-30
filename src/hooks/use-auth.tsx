import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authService, type Session } from "@/services/auth";
import type { UserProfile } from "@/types";

interface AuthContextValue {
  user: UserProfile | null;
  stats: Session["stats"] | null;
  isAuthenticated: boolean;
  ready: boolean;
  signIn: (identifier: string, password: string, remember?: boolean) => Promise<void>;
  signUp: (input: {
    fullName: string;
    username: string;
    email: string;
    password: string;
  }) => Promise<void>;
  updateProfile: (profile: UserProfile) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(authService.getSession());
    setReady(true);
  }, []);

  const signIn = useCallback(async (identifier: string, password: string, remember = true) => {
    const next = await authService.signIn(identifier, password);
    authService.persist(next, remember);
    setSession(next);
  }, []);

  const signUp = useCallback<AuthContextValue["signUp"]>(async (input) => {
    const next = await authService.signUp(input);
    authService.persist(next);
    setSession(next);
  }, []);

  const updateProfile = useCallback(async (profile: UserProfile) => {
    const saved = await authService.updateProfile(profile);
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, user: saved };
      authService.persist(next);
      return next;
    });
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    authService.persist(null);
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      stats: session?.stats ?? null,
      isAuthenticated: Boolean(session),
      ready,
      signIn,
      signUp,
      updateProfile,
      signOut,
    }),
    [session, ready, signIn, signUp, updateProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

export function initials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
