import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/router";

export function useRequireAuth(options?: { requireManager?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"manager" | "user" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setRole(null);
        setLoading(false);
        router.replace("/login"); // שנה לנתיב ההתחברות שלך
        return;
      }
      setUser(u);
      // בדיקת role
      try {
        const snap = await getDoc(doc(db, "roles", u.uid));
        const r = (snap.exists() ? snap.data().role : null) as "manager" | "user" | null;
        setRole(r);
        setLoading(false);
        if (!r) router.replace("/no-access"); // אין role → אין גישה
        else if (options?.requireManager && r !== "manager") router.replace("/no-access");
      } catch {
        setLoading(false);
        router.replace("/no-access");
      }
    });
    return () => unsub();
  }, [router, options?.requireManager]);

  return { user, role, loading };
}
