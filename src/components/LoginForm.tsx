"use client";

import { useState, type FormEvent } from "react";
import { login } from "@/lib/auth"; // אם אין לך alias "@/": החלף ל "../lib/auth"

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email.trim(), pass);
    } catch {
      setErr("התחברות נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="text-sm text-gray-600">אימייל</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl bg-neutral-50 border p-3"
        />
      </div>
      <div>
        <label className="text-sm text-gray-600">סיסמה</label>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          className="mt-1 w-full rounded-xl bg-neutral-50 border p-3"
        />
      </div>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <button
        disabled={busy}
        className="w-full px-4 py-3 rounded-2xl bg-pink-500 text-white font-bold disabled:opacity-60"
      >
        התחבר/י
      </button>
    </form>
  );
}
