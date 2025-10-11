// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  setLogLevel,
  doc,
  setDoc,
} from "firebase/firestore";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  connectAuthEmulator,
} from "firebase/auth";
import { getStorage, connectStorageEmulator } from "firebase/storage";

// ---- Firebase config ----
const firebaseConfig = {
  apiKey: "AIzaSyDvdEAO8RQnXLnjS7A_GKjyTgseaICEqzE",
  authDomain: "sweetrecipes-11c47.firebaseapp.com",
  projectId: "sweetrecipes-11c47",
  storageBucket: "sweetrecipes-11c47.firebasestorage.app",
  messagingSenderId: "773096728187",
  appId: "1:773096728187:web:f97f3dcca228795066e4de",
  measurementId: "G-R1RRCPKKZL",
};

// Single app
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Firestore with persistent cache (multi-tab safe)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// Auth & Storage
export const auth = getAuth(app);
export const storage = getStorage(app);

// ====== DEV flags ======
const USE_EMU = process.env.NEXT_PUBLIC_USE_EMULATOR === "1";
const FS_DEBUG = process.env.NEXT_PUBLIC_FS_DEBUG === "1";

console.log("[FS] firebase.ts loaded", { USE_EMU, FS_DEBUG });
if (FS_DEBUG) setLogLevel("debug");

// Connect emulators (works in server & client)
if (USE_EMU) {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  console.log("[EMULATORS] FS:8080 AUTH:9099 STORAGE:9199");
}

// Auto anonymous sign-in on client (for emulator/dev)
if (typeof window !== "undefined" && USE_EMU) {
  onAuthStateChanged(auth, (u) => {
    if (!u) {
      signInAnonymously(auth).catch((e) =>
        console.warn("[AUTH] anonymous sign-in failed", e)
      );
    }
  });
}

// Helper for manual anonymous sign-in (usable in prod too)
export async function ensureAnonAuth() {
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

// Small probe to verify connectivity from browser console
declare global {
  interface Window {
    __fsProbe?: () => Promise<void>;
  }
}
if (typeof window !== "undefined") {
  window.__fsProbe = async () => {
    await setDoc(doc(db, "__probe", "ping"), { t: Date.now() });
    console.log("[PROBE] wrote to __probe/ping");
  };
  console.log("[FS] window.__fsProbe ready");
}
