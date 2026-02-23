"use client";
import { createContext, useContext, ReactNode } from "react";
import { useUser, useRole, UserRole } from "@/lib/auth";
import { User } from "firebase/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: UserRole | null;
  displayName: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  role: null,
  displayName: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();
  const { role, displayName } = useRole(user?.uid);

  return (
    <AuthContext.Provider value={{ user, loading, role, displayName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Helper hooks for common use cases
export function useCurrentUser() {
  const { user, loading } = useAuth();
  return { user, loading };
}

export function useCurrentRole() {
  const { role, displayName } = useAuth();
  return { role, displayName };
}
