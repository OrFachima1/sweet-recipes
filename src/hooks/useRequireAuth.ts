import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/router";
import type { UserRole } from "@/lib/auth";

export function useRequireAuth(options?: { requireManager?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setRole(null);
        setLoading(false);
        router.replace("/login");
        return;
      }
      setUser(u);
      // בדיקת role
      try {
        const snap = await getDoc(doc(db, "roles", u.uid));
        const data = snap.exists() ? snap.data() : null;
        let r: UserRole | null = null;

        if (data?.role === "manager") {
          r = "manager";
        } else if (data?.role === "senior_worker") {
          r = "senior_worker";
        } else if (data?.role === "worker") {
          r = "worker";
        }

        setRole(r);
        setLoading(false);

        if (!r) {
          router.replace("/no-access"); // אין role → אין גישה
        } else if (options?.requireManager && r !== "manager") {
          router.replace("/no-access");
        }
      } catch {
        setLoading(false);
        router.replace("/no-access");
      }
    });
    return () => unsub();
  }, [router, options?.requireManager]);

  return { user, role, loading };
}
