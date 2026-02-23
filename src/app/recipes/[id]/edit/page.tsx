"use client";
import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, ensureAnonAuth } from "../../../../lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import AutocompleteInput from "../../../../components/AutocompleteInput";
import { useIngredientDict } from "../../../../hooks/useIngredientDict";
import { invalidateRecipesCache } from "../../../../hooks/useShoppingList";
import HomeButton from "../../../../components/HomeButton";
import { useCategoryDict } from "../../../../hooks/useCategoryDict";
import { useUnitDict } from "../../../../hooks/useUnitDict";
import {generateId} from  "@/utils/imageHelpers";

type Ingredient = { id: string; name: string; qty: string; unit: string };
type IngredientGroup = { id: string; groupName: string; items: Ingredient[] };
type Step = { id: string; text: string };



// דחיסה
async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function downscaleImage(
  dataUrl: string,
  maxW = 1280,
  quality = 0.8
): Promise<string> {
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

export default function EditRecipePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { names: ingredientDict } = useIngredientDict();
  const { names: categoryDict } = useCategoryDict();
  const { names: unitDict } = useUnitDict();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  const [groups, setGroups] = useState<IngredientGroup[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await ensureAnonAuth();
      const ref = doc(db, "recipes", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setLoading(false);
        return;
      }
      const d = snap.data() as any;
      setTitle(d.title || "");
      setCategory(d.category || "");
      setNote(d.note || "");
      setImageDataUrl(d.imageDataUrl || null);
      setGroups((d.ingredients || []) as IngredientGroup[]);
      setSteps((d.steps || []) as Step[]);
      setLoading(false);
    })();
  }, [id]);

  async function onSelectImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await fileToDataUrl(f);
    const compressed = await downscaleImage(dataUrl, 1280, 0.8);
    setImageDataUrl(compressed);
  }

  // --- עזר לעריכת קבוצות/שלבים ---
  function addGroup() { setGroups((g) => [...g, { id: generateId(), groupName: "קבוצה", items: [] }]); }
  function removeGroup(groupId: string) { setGroups((g) => g.filter((x) => x.id !== groupId)); }
  function setGroupName(groupId: string, v: string) { setGroups((g) => g.map((x) => (x.id === groupId ? { ...x, groupName: v } : x))); }
  function addItem(groupId: string) { setGroups((g) => g.map((x) => (x.id === groupId ? { ...x, items: [...x.items, { id: generateId(), name: "", qty: "", unit: "" }] } : x))); }
  function removeItem(groupId: string, itemId: string) { setGroups((g) => g.map((x) => (x.id === groupId ? { ...x, items: x.items.filter((it) => it.id !== itemId) } : x))); }
  function setItemField(groupId: string, itemId: string, field: keyof Ingredient, v: string) {
    setGroups((g) => g.map((x) =>
      x.id === groupId
        ? { ...x, items: x.items.map((it) => (it.id === itemId ? { ...it, [field]: v } : it)) }
        : x
    ));
  }
  function addStep() { setSteps((s) => [...s, { id: generateId(), text: "" }]); }
  function removeStep(id2: string) { setSteps((s) => s.filter((x) => x.id !== id2)); }
  function setStepText(id2: string, v: string) { setSteps((s) => s.map((x) => (x.id === id2 ? { ...x, text: v } : x))); }

  async function saveChanges() {
    if (!title.trim()) return alert("חסר שם מתכון");
    await ensureAnonAuth();
    await updateDoc(doc(db, "recipes", id), {
      title: title.trim(),
      category: (category || "").trim(),
      note: note.trim() || null,
      imageDataUrl: imageDataUrl || null,
      ingredients: groups,
      steps: steps.filter((s) => s.text.trim()),
      updatedAt: serverTimestamp(),
    });
    // 🚀 ניקוי cache של מתכונים כדי שרשימת הקניות תראה את השינויים
    invalidateRecipesCache();
    router.push(`/recipes/${id}`);
  }

  if (loading) return <div className="p-6">טוען…</div>;

  return (
    <div className="max-w-3xl mx-auto p-4" dir="rtl" lang="he">
      <HomeButton />
      <button onClick={() => router.back()} className="mb-3 text-sm underline">⬅ חזרה</button>
      <h1 className="text-2xl font-extrabold mb-3">עריכת מתכון</h1>

      <div className="bg-white rounded-3xl shadow p-4 md:p-6">
        {/* שדות בסיס */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-600">מה מכינים *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-xl bg-neutral-50 border p-3" />
          </div>
          <div>
            <label className="text-sm text-gray-600">קטגוריה</label>
            <div>
              <AutocompleteInput
                value={category}
                onChange={setCategory}
                dictionary={categoryDict}
                placeholder="עוגות / עוגיות / מאפים…"
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-gray-600">הערה</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-xl bg-neutral-50 border p-3" rows={2} />
          </div>
        </div>

        {/* תצוגה מקדימה פשוטה */}
        {imageDataUrl && (
          <div className="mt-4 w-full h-[240px] overflow-hidden rounded-xl border bg-neutral-100">
            <img src={imageDataUrl} alt="" className="w-full h-full object-contain object-center" />
          </div>
        )}

        {/* תמונה – העלאה/הסרה */}
        <div className="mt-4">
          <label className="text-sm text-gray-600">תמונה</label>
          <div className="mt-1 flex items-center gap-3">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onSelectImage} className="text-sm" />
            {imageDataUrl && <button onClick={() => setImageDataUrl(null)} className="text-sm underline">הסר תמונה</button>}
          </div>
        </div>

        {/* מצרכים */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">מצרכים</h3>
            <button onClick={addGroup} className="px-3 py-2 rounded-xl bg-black text-white text-sm">+ הוסף קבוצה</button>
          </div>
          <div className="mt-3 space-y-4">
            {groups.map((g) => (
              <div key={g.id} className="rounded-2xl border p-4 bg-white">
                <div className="flex items-center gap-2">
                  <input value={g.groupName} onChange={(e) => setGroupName(g.id, e.target.value)} className="w-full rounded-xl bg-neutral-50 border p-2 font-semibold" placeholder="שם קבוצה" />
                  <button onClick={() => removeGroup(g.id)} className="px-2 py-2 rounded-lg text-sm bg-neutral-100 border">מחק</button>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {g.items.map((it) => (
                    <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                  {/* שם רכיב – עם אוטוקומפליט דינמי */}
                  <div className="col-span-6">
                    <AutocompleteInput
                      value={it.name}
                      onChange={(v) => setItemField(g.id, it.id, "name", v)}
                      dictionary={ingredientDict}
                      placeholder="שם רכיב"
                    />
                  </div>
                      <input value={it.qty} onChange={(e) => setItemField(g.id, it.id, "qty", e.target.value)} className="col-span-3 rounded-xl bg-neutral-50 border p-2 text-left" placeholder="כמות" />
{/* יחידה */}
<div className="col-span-2">
  <AutocompleteInput
    value={it.unit}
    onChange={(v) => setItemField(g.id, it.id, "unit", v)}
    dictionary={unitDict}
    placeholder="יח׳ / גרם / מ״ל…"
  />
</div>
                      <button onClick={() => removeItem(g.id, it.id)} className="col-span-1 px-2 py-2 rounded-lg text-sm bg-neutral-100 border">✕</button>
                    </div>
                  ))}
                  <div>
                    <button onClick={() => addItem(g.id)} className="mt-2 px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm">+ הוסף רכיב</button>
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
            <button onClick={() => addStep()} className="px-3 py-2 rounded-xl bg-black text-white text-sm">+ הוסף שלב</button>
          </div>
        <div className="mt-3 space-y-2">
            {steps.map((s, idx) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className="w-10 text-center font-semibold">{idx + 1}.</div>
                <input value={s.text} onChange={(e) => setStepText(s.id, e.target.value)} className="flex-1 rounded-xl bg-neutral-50 border p-2" placeholder="תיאור שלב" />
                <button onClick={() => removeStep(s.id)} className="px-2 py-2 rounded-lg text-sm bg-neutral-100 border">מחק</button>
              </div>
            ))}
          </div>
        </div>

        {/* פעולות */}
        <div className="mt-6 flex gap-3">
          <button onClick={saveChanges} className="px-5 py-3 rounded-2xl bg-pink-500 text-white font-bold shadow hover:shadow-md active:scale-[0.98]">שמור</button>
          <button onClick={() => router.push(`/recipes/${id}`)} className="px-5 py-3 rounded-2xl bg-white border font-semibold">ביטול</button>
        </div>
      </div>
    </div>
  );
}
