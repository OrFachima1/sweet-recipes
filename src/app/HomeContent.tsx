"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "firebase/auth";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  setDoc,
  serverTimestamp,
  orderBy,
  query,
  doc,
} from "firebase/firestore";

import AutocompleteInput from "@/components/AutocompleteInput";
import { useIngredientDict } from "@/hooks/useIngredientDict";
import { useCategoryDict } from "@/hooks/useCategoryDict";
import { useUnitDict } from "@/hooks/useUnitDict";
import { logout } from "@/lib/auth";
import InstallPrompt from "../components/InstallPrompt";

// ===== Types =====
type Ingredient = { id: string; name: string; qty: string; unit: string };
type IngredientGroup = { id: string; groupName: string; items: Ingredient[] };
type Step = { id: string; text: string };

type Recipe = {
  id: string;
  title: string;
  category: string;
  note?: string | null;
  imageDataUrl?: string | null;
  ingredients: IngredientGroup[];
  steps: Step[];
  createdAt?: any;
};

type CategoryDoc = {
  id: string;
  key: string; // lowercase
  name: string;
  imageDataUrl?: string | null;
  color?: string | null;
  order?: number | null;
  active?: boolean | null;
};

// ===== Helpers =====
const uid = () =>
  typeof crypto !== "undefined" && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2);

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function downscaleImage(dataUrl: string, maxW = 1280, quality = 0.8): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });
  const scale = Math.min(1, maxW / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

// דחיסה אגרסיבית יותר לתמונות קטגוריה
async function downscaleForCategory(dataUrl: string): Promise<string> {
  let out = await downscaleImage(dataUrl, 800, 0.7);
  const bytes = Math.ceil((out.length * 3) / 4);
  if (bytes > 900 * 1024) {
    out = await downscaleImage(out, 600, 0.6);
  }
  return out;
}

// קיצורי מקלדת ל-**בולד** ו-__קו__
function toggleWrapSelection(
  el: HTMLTextAreaElement | null,
  open: string,
  close = open
): { value: string; start: number; end: number } | null {
  if (!el) return null;
  const s0 = el.selectionStart ?? 0;
  const e0 = el.selectionEnd ?? s0;
  const value = el.value;
  const before = value.slice(0, s0);
  const mid = value.slice(s0, e0);
  const after = value.slice(e0);

  const hasBefore = before.endsWith(open);
  const hasAfter = after.startsWith(close);

  if (hasBefore && hasAfter) {
    const newBefore = before.slice(0, before.length - open.length);
    const newAfter = after.slice(close.length);
    const next = newBefore + mid + newAfter;
    const start = newBefore.length;
    const end = start + mid.length;
    return { value: next, start, end };
  } else {
    const next = before + open + mid + close + after;
    const start = before.length + open.length;
    const end = start + mid.length;
    return { value: next, start, end };
  }
}
function handleRichKeys(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  el: HTMLTextAreaElement | null,
  apply: (next: string, start: number, end: number) => void
) {
  const isMeta = e.ctrlKey || e.metaKey;
  if (!isMeta) return;
  const k = e.key.toLowerCase();
  if (k === "b" || k === "u") {
    e.preventDefault();
    const token = k === "b" ? "**" : "__";
    const res = toggleWrapSelection(el, token);
    if (res) apply(res.value, res.start, res.end);
  }
}

export default function HomeContent({
  isManager,
  user,
  displayName,
}: { isManager: boolean; user: import("firebase/auth").User; displayName?: string }) {  const router = useRouter();

  // מילונים לאוטוקומפליט
  const { names: ingredientDict } = useIngredientDict();
  const { names: categoryDict } = useCategoryDict();
  const { names: unitDict } = useUnitDict();

  // בחירה למצב שקילה
  const [weighSel, setWeighSel] = useState<Record<string, { title: string }>>({});
  function addToWeigh(id: string, title: string) {
    setWeighSel((m) => ({ ...m, [id]: { title } }));
  }
  function removeFromWeigh(id: string) {
    setWeighSel((m) => {
      const n = { ...m };
      delete n[id];
      return n;
    });
  }
  function openWeigh() {
    const ids = Object.keys(weighSel);
    if (ids.length === 0) return;
    router.push(`/weigh?ids=${ids.join(",")}`);
  }

  // --- נתונים מהענן (מתכונים) ---
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  useEffect(() => {
    // כאן אין ensureAnonAuth — כבר מחוברים ומורשים להגיע לכאן
    const qCol = query(collection(db, "recipes"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qCol, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Recipe[];
      setRecipes(list);
    });
    return () => unsub();
  }, []);

  // --- חיפוש ---
  const [q, setQ] = useState("");

  // --- הוספת מתכון ---
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>();
  const [groups, setGroups] = useState<IngredientGroup[]>([
    { id: uid(), groupName: "קבוצה", items: [{ id: uid(), name: "", qty: "", unit: "" }] },
  ]);
  const [steps, setSteps] = useState<Step[]>([{ id: uid(), text: "" }]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function addGroup() {
    setGroups((g) => [...g, { id: uid(), groupName: "קבוצה", items: [] }]);
  }
  function removeGroup(groupId: string) {
    setGroups((g) => g.filter((x) => x.id !== groupId));
  }
  function setGroupName(groupId: string, v: string) {
    setGroups((g) => g.map((x) => (x.id === groupId ? { ...x, groupName: v } : x)));
  }
  function addItem(groupId: string) {
    setGroups((g) =>
      g.map((x) =>
        x.id === groupId
          ? { ...x, items: [...x.items, { id: uid(), name: "", qty: "", unit: "" }] }
          : x
      )
    );
  }
  function removeItem(groupId: string, itemId: string) {
    setGroups((g) =>
      g.map((x) => (x.id === groupId ? { ...x, items: x.items.filter((it) => it.id !== itemId) } : x))
    );
  }
  function setItemField(groupId: string, itemId: string, field: keyof Ingredient, v: string) {
    setGroups((g) =>
      g.map((x) =>
        x.id === groupId
          ? {
              ...x,
              items: x.items.map((it) => (it.id === itemId ? { ...it, [field]: v } : it)),
            }
          : x
      )
    );
  }
  function addStep() {
    setSteps((s) => [...s, { id: uid(), text: "" }]);
  }
  function removeStep(id: string) {
    setSteps((s) => s.filter((x) => x.id !== id));
  }
  function setStepText(id: string, v: string) {
    setSteps((s) => s.map((x) => (x.id === id ? { ...x, text: v } : x)));
  }

  async function onSelectImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await fileToDataUrl(f);
    const compressed = await downscaleImage(dataUrl, 1280, 0.8);
    setImageDataUrl(compressed);
  }

  function resetForm() {
    setTitle("");
    setCategory("");
    setNote("");
    setImageDataUrl(undefined);
    setGroups([{ id: uid(), groupName: "קבוצה", items: [{ id: uid(), name: "", qty: "", unit: "" }] }]);
    setSteps([{ id: uid(), text: "" }]);
  }

  async function saveRecipe() {
    if (!title.trim()) return alert("חסר שם מתכון");
    const hasAnyIng = groups.some((g) => g.items.some((i) => i.name.trim()));
    if (!hasAnyIng) return alert("הוסף לפחות רכיב אחד");

    const created = await addDoc(collection(db, "recipes"), {
      title: title.trim(),
      category: (category || "").trim(),
      note: note.trim() || null,
      imageDataUrl: imageDataUrl || null,
      ingredients: groups,
      steps: steps.filter((s) => s.text.trim()),
      createdAt: serverTimestamp(),
    });

    setShowForm(false);
    resetForm();
    setQ("");
    router.push(`/recipes/${created.id}`);
  }

  // --- קטגוריות (ניהול + איסוף דינמי) ---
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [catsDocs, setCatsDocs] = useState<CategoryDoc[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catImage, setCatImage] = useState<string | undefined>();
  const catFileRef = useRef<HTMLInputElement | null>(null);
  const catFileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function onCatFileChange(catKey: string, catLabel: string, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await fileToDataUrl(f);
    const compressed = await downscaleForCategory(dataUrl);
    await setDoc(
      doc(db, "categories", catKey),
      { key: catKey, name: catLabel, imageDataUrl: compressed, active: true },
      { merge: true }
    );
    if (catFileRefs.current[catKey]) catFileRefs.current[catKey]!.value = "";
  }
  function triggerCatUpload(catKey: string) {
    catFileRefs.current[catKey]?.click();
  }

  useEffect(() => {
    const qCol = query(collection(db, "categories"));
    const unsub = onSnapshot(qCol, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CategoryDoc[];
      setCatsDocs(list);
    });
    return () => unsub();
  }, []);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recipes) {
      let c = (r.category || "").trim();
      if (!c) c = "ללא קטגוריה";
      const key = c.toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const map: Record<
      string,
      { key: string; label: string; count: number; imageDataUrl?: string | null; order?: number | null; active?: boolean | null }
    > = {};

    for (const [key, count] of counts.entries()) {
      map[key] = { key, label: key === "ללא קטגוריה" ? "ללא קטגוריה" : key, count };
    }
    for (const cd of catsDocs) {
      const k = (cd.key || cd.name || "").toLowerCase().trim();
      if (!k) continue;
      if (!map[k]) map[k] = { key: k, label: cd.name || k, count: 0 };
      map[k].label = cd.name || map[k].label;
      map[k].imageDataUrl = cd.imageDataUrl ?? map[k].imageDataUrl;
      map[k].order = cd.order ?? map[k].order;
      map[k].active = cd.active ?? true;
    }

    let arr = Object.values(map).filter((x) => x.active !== false);
    arr.sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return (b.count || 0) - (a.count || 0);
    });
    arr = arr.filter((c) => c.key !== "ללא קטגוריה");
    return arr;
  }, [recipes, catsDocs]);

  async function handleSelectCatImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await fileToDataUrl(f);
    const compressed = await downscaleForCategory(dataUrl);
    setCatImage(compressed);
  }

  async function saveCategoryDoc() {
    const name = catName.trim();
    if (!name) return alert("הקלד/י שם קטגוריה");
    const key = name.toLowerCase();

    await setDoc(
      doc(db, "categories", key),
      { key, name, imageDataUrl: catImage || null, active: true } as CategoryDoc
    );

    setCatName("");
    setCatImage(undefined);
    if (catFileRef.current) catFileRef.current.value = "";
    alert("הקטגוריה נשמרה");
  }

  // --- הצעות חיפוש ---
  const suggestions = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let list = recipes;

    if (selectedCat) {
      list = list.filter((r) => {
        const c = (r.category || "").trim().toLowerCase() || "ללא קטגוריה";
        return c === selectedCat;
      });
    }
    if (!qq) return list.slice(0, 6);

    return list
      .filter((r) => r.title?.toLowerCase().includes(qq) || (r.category || "")?.toLowerCase().includes(qq))
      .slice(0, 6);
  }, [q, recipes, selectedCat]);

  function openRecipe(id: string) {
    router.push(`/recipes/${id}`);
  }

  return (
    <div className="min-h-screen" dir="rtl" lang="he">
      {/* ► פס עליון: שלום + התנתקות */}
        <header className="relative px-4 pt-4">
<div className="flex items-center">
  <button
    onClick={logout}
    className="mr-auto px-4 py-2 rounded-xl bg-pink-500 text-white font-bold hover:shadow active:scale-[0.98]"
  >
    התנתקות
  </button>
</div>


  {/* הברכה – ימין, בתוך קונטיינר העמוד */}
  <div className="max-w-5xl mx-auto text-right">
    {/* כאן משחקים עם המיקום: mt/mr/translate לפי הצורך */}
    <div
      className="
        font-extrabold leading-none
        text-4xl md:text-5xl lg:text-6xl
        mr-0 mt-0
      "
      // אפשר גם לכוונן עדין עם translate:
      // style={{ transform: "translate(6px, 2px)" }}
    >
      שלום, {displayName || user.email || "עובד/ת"}
    </div>
  </div>
</header>



      {/* לוגו */}
      <section className="pt-6 pb-6 flex flex-col items-center text-center">
        <img
          src="/logo-web.png"
          alt="Logo"
          className="w-[280px] md:w-[380px] lg:w-[460px] h-auto object-contain"
        />
      </section>
        <InstallPrompt />
      {/* חיפוש + הוספת מתכון */}
      <section className="px-4 flex flex-col items-center relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && suggestions[0]) openRecipe(suggestions[0].id);
          }}
          placeholder="חיפוש מתכון…"
          className="w-full max-w-2xl rounded-2xl bg-white shadow border px-4 py-3 text-right"
        />
        {q && suggestions.length > 0 && (
          <div className="absolute top-[52px] w-full max-w-2xl bg-white border rounded-2xl shadow overflow-hidden z-20">
            {suggestions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2">
                <button onClick={() => openRecipe(s.id)} className="flex-1 text-right px-4 py-2 hover:bg-pink-50">
                  <div className="font-semibold">{s.title}</div>
                  <div className="text-xs text-gray-500">{s.category}</div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addToWeigh(s.id, s.title);
                  }}
                  className="mx-2 my-1 h-9 w-9 rounded-xl border bg-white hover:bg-neutral-100 grid place-items-center"
                  title="הוסף למצב שקילה"
                >
                  ＋
                </button>
              </div>
            ))}
          </div>
        )}

        {isManager && (
          <button
            onClick={() => {
              setShowForm((v) => !v);
              setQ("");
            }}
            className="mt-4 px-5 py-3 rounded-2xl bg-pink-500 text-white font-bold shadow hover:shadow-md active:scale-[0.98]"
          >
            ➕ הוסף מתכון
          </button>
        )}
      </section>

      {/* טופס הוספה (מתקפל) */}
      {isManager && showForm && (
        <section className="mt-6 px-4 relative z-20">
          <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow p-4 md:p-6">
            <h2 className="text-xl font-extrabold">הוספת מתכון חדש</h2>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600">מה מכינים *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-neutral-50 border p-3"
                  placeholder="שם המתכון"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">קטגוריה</label>
                <AutocompleteInput
                  value={category}
                  onChange={setCategory}
                  dictionary={categoryDict}
                  placeholder="עוגות / עוגיות / מאפים…"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">הערה (אופציונלי)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) =>
                    handleRichKeys(e, e.currentTarget, (next, start, end) => {
                      setNote(next);
                      setTimeout(() => e.currentTarget.setSelectionRange(start, end), 0);
                    })
                  }
                  className="mt-1 w-full rounded-xl bg-neutral-50 border p-3"
                  rows={3}
                  placeholder="כאן ניתן לרשום הערות כלליות על המתכון, למשל: מספיק ל15 סועדים"
                />
              </div>
            </div>

            {/* תמונת מתכון (אופציונלי) */}
            <div className="mt-4">
              <label className="text-sm text-gray-600">תמונה (אופציונלי)</label>
              <div className="mt-1 flex items-center gap-3">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={onSelectImage} className="text-sm" />
                {imageDataUrl && (
                  <img src={imageDataUrl} alt="תצוגה" className="h-16 w-16 object-contain rounded-xl border bg-white" />
                )}
              </div>
            </div>

            {/* מצרכים בקבוצות */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">מצרכים</h3>
                <button onClick={addGroup} className="px-3 py-2 rounded-xl bg-black text-white text-sm">
                  + הוסף קבוצה
                </button>
              </div>

              <div className="mt-3 space-y-4">
                {groups.map((g) => (
                  <div key={g.id} className="rounded-2xl border p-4 bg-white">
                    <div className="flex items-center gap-2">
                      <input
                        value={g.groupName}
                        onChange={(e) => setGroupName(g.id, e.target.value)}
                        className="w-full rounded-xl bg-neutral-50 border p-2 font-semibold"
                        placeholder="שם קבוצה (למשל: בצק / מילוי / סירופ)"
                      />
                      <button onClick={() => removeGroup(g.id)} className="px-2 py-2 rounded-lg text-sm bg-neutral-100 border">
                        מחק
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2">
                      {g.items.map((it) => (
                        <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-6">
                            <AutocompleteInput
                              value={it.name}
                              onChange={(v) => setItemField(g.id, it.id, "name", v)}
                              dictionary={ingredientDict}
                              placeholder="שם רכיב"
                            />
                          </div>

                          <input
                            value={it.qty}
                            onChange={(e) => setItemField(g.id, it.id, "qty", e.target.value)}
                            className="col-span-3 rounded-xl bg-neutral-50 border p-2 text-left"
                            placeholder="כמות"
                          />

                          <div className="col-span-2">
                            <AutocompleteInput
                              value={it.unit}
                              onChange={(v) => setItemField(g.id, it.id, "unit", v)}
                              dictionary={unitDict}
                              placeholder="יח׳ / גרם / מ״ל…"
                            />
                          </div>

                          <button onClick={() => removeItem(g.id, it.id)} className="col-span-1 px-2 py-2 rounded-lg text-sm bg-neutral-100 border">
                            ✕
                          </button>
                        </div>
                      ))}

                      <div>
                        <button onClick={() => addItem(g.id)} className="mt-2 px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm">
                          + הוסף רכיב
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* שלבים */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">איך מכינים — שלבים</h3>
                <button onClick={() => addStep()} className="px-3 py-2 rounded-xl bg-black text-white text-sm">
                  + הוסף שלב
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {steps.map((s, idx) => (
                  <div key={s.id} className="flex items-start gap-2">
                    <div className="w-10 text-center font-semibold">{idx + 1}.</div>
                    <textarea
                      value={s.text}
                      onChange={(e) => setStepText(s.id, e.target.value)}
                      onKeyDown={(e) =>
                        handleRichKeys(e, e.currentTarget, (next, start, end) => {
                          setStepText(s.id, next);
                          setTimeout(() => e.currentTarget.setSelectionRange(start, end), 0);
                        })
                      }
                      className="flex-1 rounded-xl bg-neutral-50 border p-2"
                      rows={2}
                      placeholder="מה עושים בכל שלב?!"
                    />
                    <button onClick={() => removeStep(s.id)} className="px-2 py-2 rounded-lg text-sm bg-neutral-100 border">
                      מחק
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* פעולות */}
            <div className="mt-6 flex gap-3">
              <button onClick={saveRecipe} className="px-5 py-3 rounded-2xl bg-pink-500 text-white font-bold shadow hover:shadow-md active:scale-[0.98]">
                שמור מתכון
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="px-5 py-3 rounded-2xl bg-white border font-semibold"
              >
                ביטול
              </button>
            </div>
          </div>
        </section>
      )}

      {/* קטגוריות */}
      <section className="px-4 mt-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-extrabold">קטגוריות</h2>
            <div className="text-sm text-gray-600">לחץ על קטגוריה כדי לפתוח רשימת מתכונים</div>
          </div>

          {categories.length === 0 ? (
            <div className="text-gray-600">עוד אין קטגוריות. הוסיפו מתכון ראשון 🙂</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {categories.map((cat) => (
                <div
                  key={cat.key}
                  className="
                    relative group overflow-hidden rounded-3xl
                    shadow border text-right bg-white
                    transition duration-200 ease-out
                    hover:shadow-xl hover:-translate-y-0.5 hover:border-pink-300
                    pb-10 sm:pb-11
                  "
                  title={`${cat.label} (${cat.count})`}
                >
                  <div className="pointer-events-none absolute inset-0 bg-pink-400/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

                  {cat.imageDataUrl ? (
                    <div className="h-28 sm:h-32 md:h-36 w-full bg-white flex items-center justify-center p-2">
                      <img
                        src={cat.imageDataUrl}
                        alt=""
                        className="max-h-full max-w-full object-contain transition-transform duration-200 ease-out group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="h-28 sm:h-32 md:h-36 w-full bg-gradient-to-br from-[#fde2e4] to-[#f8cbd2] flex items-center justify-center transition-transform duration-200 ease-out group-hover:scale-[1.02]">
                      <div className="text-lg md:text-xl font-extrabold text-[#2b2b2b] px-2 text-center">{cat.label}</div>
                    </div>
                  )}

                  {/* פס תחתון (גובה קבוע, התמונה לא מכוסה) */}
                  <div className="absolute inset-x-0 bottom-0 h-10 sm:h-11 bg-white/90 backdrop-blur px-3 flex items-center justify-between pointer-events-none">
                    <div className="font-bold truncate">{cat.label}</div>
                    <div className="text-xs opacity-70">{cat.count}</div>
                  </div>

                  {/* כפתור ניווט שקוף לכל הכרטיס */}
                  <button
                    type="button"
                    aria-label={`פתח קטגוריה ${cat.label}`}
                    onClick={() => router.push(`/category/${encodeURIComponent(cat.key)}`)}
                    className="absolute inset-0 z-10"
                  />

                  {/* קלט קובץ חבוי */}
                  <input
                    type="file"
                    accept="image/*"
                    ref={(el) => {
                      catFileRefs.current[cat.key] = el;
                    }}
                    onChange={(e) => onCatFileChange(cat.key, cat.label, e)}
                    className="hidden"
                  />

                  {/* כפתור מצלמה (רק למנהל) */}
                  {isManager && (
                    <button
                      type="button"
                      aria-label={`העלאת לוגו לקטגוריה ${cat.label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        triggerCatUpload(cat.key);
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                      }}
                      className="absolute top-2 left-2 z-10 inline-flex items-center justify-center h-8 w-8 rounded-full bg-white/90 border shadow hover:bg-white"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5 text-pink-600" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M9 3l1.5 2H14l1.5-2H18a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h3zm3 14a4 4 0 100-8 4 4 0 000 8z"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* בחירה למצב שקילה – סרגל קבוע בתחתית כשיש בחירות */}
      {Object.keys(weighSel).length > 0 && (
        <div className="fixed bottom-3 inset-x-3 z-50 bg-white/95 backdrop-blur rounded-2xl shadow-lg border p-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {Object.entries(weighSel).map(([id, v]) => (
                <span key={id} className="px-2 py-1 rounded-xl bg-pink-100 text-pink-900 text-sm">
                  {v.title}
                  <button className="ml-2 text-pink-700" onClick={() => removeFromWeigh(id)}>
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setWeighSel({})} className="px-3 py-2 rounded-xl border bg-white">
                נקה
              </button>
              <button onClick={openWeigh} className="px-4 py-2 rounded-2xl bg-pink-500 text-white font-bold">
                פתח מצב שקילה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
