// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  enableIndexedDbPersistence,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

// ---- config שלך ----
const firebaseConfig = {
  apiKey: "AIzaSyDvdEAO8RQnXLnjS7A_GKjyTgseaICEqzE",
  authDomain: "sweetrecipes-11c47.firebaseapp.com",
  projectId: "sweetrecipes-11c47",
  storageBucket: "sweetrecipes-11c47.firebasestorage.app",
  messagingSenderId: "773096728187",
  appId: "1:773096728187:web:f97f3dcca228795066e4de",
  measurementId: "G-R1RRCPKKZL",
};

// אתחול אפליקציה אחת בלבד
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Firestore עם קאש אופליין יציב (עובד גם בכמה טאבים)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// אימות אנונימי (אין מסך התחברות)
export const auth = getAuth(app);
export async function ensureAnonAuth() {
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}
