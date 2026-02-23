"use client";
import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

export function useUser() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);
  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setLoading(false); }), []);
  return { user, loading };
}

export type UserRole = "manager" | "senior_worker" | "worker" | "unauthorized";

export function useRole(uid?: string | null) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) { setRole(null); setDisplayName(null); return; }
    const ref = doc(db, "roles", uid);
    const unsub = onSnapshot(
      ref,
      snap => {
        if (snap.exists()) {
          const d = snap.data() as any;
          // תמיכה בתפקיד senior_worker (אחמ"ש)
          if (d.role === "manager") {
            setRole("manager");
          } else if (d.role === "senior_worker") {
            setRole("senior_worker");
          } else {
            setRole("worker");
          }
          setDisplayName(d.displayName || null);
        } else {
          setRole("unauthorized"); // אין מסמך roles => חסום
          setDisplayName(null);
        }
      },
      _err => { setRole("unauthorized"); setDisplayName(null); }
    );
    return () => unsub();
  }, [uid]);

  return { role, displayName };
}

export async function login(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email, password);
}
export async function logout() { await signOut(auth); }

// לא משתמשים יותר באנונימי:
export async function ensureAnon() { /* ריק */ }
