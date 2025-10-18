"use client";

import { useState, useRef } from "react";
import AutocompleteInput from "@/components/AutocompleteInput";
import { fileToDataUrl, compressImage, generateId } from "@/utils/imageHelpers";

type Ingredient = { id: string; name: string; qty: string; unit: string };
type IngredientGroup = { id: string; groupName: string; items: Ingredient[] };
type Step = { id: string; text: string };

type RecipeFormProps = {
  ingredientDict: string[];
  categoryDict: string[];
  unitDict: string[];
  onSave: (recipe: {
    title: string;
    category: string;
    note: string;
    imageDataUrl?: string;
    groups: IngredientGroup[];
    steps: Step[];
  }) => Promise<void>;
  onCancel: () => void;
};

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
    
    const s0 = el?.selectionStart ?? 0;
    const e0 = el?.selectionEnd ?? s0;
    const value = el?.value || "";
    const before = value.slice(0, s0);
    const mid = value.slice(s0, e0);
    const after = value.slice(e0);

    const hasBefore = before.endsWith(token);
    const hasAfter = after.startsWith(token);

    if (hasBefore && hasAfter) {
      const newBefore = before.slice(0, before.length - token.length);
      const newAfter = after.slice(token.length);
      const next = newBefore + mid + newAfter;
      const start = newBefore.length;
      const end = start + mid.length;
      apply(next, start, end);
    } else {
      const next = before + token + mid + token + after;
      const start = before.length + token.length;
      const end = start + mid.length;
      apply(next, start, end);
    }
  }
}

export default function RecipeForm({
  ingredientDict,
  categoryDict,
  unitDict,
  onSave,
  onCancel,
}: RecipeFormProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>();
  const [groups, setGroups] = useState<IngredientGroup[]>([
    { id: generateId(), groupName: "קבוצה", items: [{ id: generateId(), name: "", qty: "", unit: "" }] },
  ]);
  const [steps, setSteps] = useState<Step[]>([{ id: generateId(), text: "" }]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function addGroup() {
    setGroups((g) => [...g, { id: generateId(), groupName: "קבוצה", items: [] }]);
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
          ? { ...x, items: [...x.items, { id: generateId(), name: "", qty: "", unit: "" }] }
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
    setSteps((s) => [...s, { id: generateId(), text: "" }]);
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
    const compressed = await compressImage(dataUrl, 1280, 0.8);
    setImageDataUrl(compressed);
  }

  async function handleSave() {
    if (!title.trim()) return alert("חסר שם מתכון");
    const hasAnyIng = groups.some((g) => g.items.some((i) => i.name.trim()));
    if (!hasAnyIng) return alert("הוסף לפחות רכיב אחד");

    await onSave({
      title: title.trim(),
      category: category.trim(),
      note: note.trim(),
      imageDataUrl,
      groups,
      steps: steps.filter((s) => s.text.trim()),
    });
  }

  return (
    <section className="px-4 pb-8 animate-fadeIn">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl border border-gray-200 p-6 md:p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">מתכון חדש</h2>

        <div className="space-y-6">
          {/* שם וקטגוריה */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">שם המתכון *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-12 rounded-xl bg-gray-50 border border-gray-200 px-4 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent transition-all"
                placeholder="למשל: עוגת שוקולד"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">קטגוריה</label>
              <AutocompleteInput
                value={category}
                onChange={setCategory}
                dictionary={categoryDict}
                placeholder="עוגות / מאפים..."
              />
            </div>
          </div>

          {/* הערה */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">הערות</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) =>
                handleRichKeys(e, e.currentTarget, (next, start, end) => {
                  setNote(next);
                  setTimeout(() => e.currentTarget.setSelectionRange(start, end), 0);
                })
              }
              className="w-full rounded-xl bg-gray-50 border border-gray-200 p-4 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent transition-all resize-none"
              rows={3}
              placeholder="הערות כלליות..."
            />
          </div>

          {/* תמונה */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">תמונה</label>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onSelectImage}
                className="text-sm"
              />
              {imageDataUrl && (
                <img
                  src={imageDataUrl}
                  alt="תצוגה"
                  className="h-20 w-20 object-cover rounded-xl border border-gray-200"
                />
              )}
            </div>
          </div>

          {/* מצרכים */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">מצרכים</h3>
              <button
                onClick={addGroup}
                className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 transition-all"
              >
                + הוסף קבוצה
              </button>
            </div>

            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.id} className="rounded-2xl border border-gray-200 p-5 bg-gray-50">
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      value={g.groupName}
                      onChange={(e) => setGroupName(g.id, e.target.value)}
                      className="flex-1 h-10 rounded-lg bg-white border border-gray-200 px-3 font-semibold focus:outline-none focus:ring-2 focus:ring-pink-400"
                      placeholder="שם הקבוצה"
                    />
                    <button
                      onClick={() => removeGroup(g.id)}
                      className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm hover:bg-gray-100 transition-all"
                    >
                      מחק
                    </button>
                  </div>

                  <div className="space-y-3">
                    {g.items.map((it) => (
                      <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-6">
                          <AutocompleteInput
                            value={it.name}
                            onChange={(v) => setItemField(g.id, it.id, "name", v)}
                            dictionary={ingredientDict}
                            placeholder="שם הרכיב"
                          />
                        </div>
                        <input
                          value={it.qty}
                          onChange={(e) => setItemField(g.id, it.id, "qty", e.target.value)}
                          className="col-span-3 h-10 rounded-lg bg-white border border-gray-200 px-3 text-left focus:outline-none focus:ring-2 focus:ring-pink-400"
                          placeholder="כמות"
                        />
                        <div className="col-span-2">
                          <AutocompleteInput
                            value={it.unit}
                            onChange={(v) => setItemField(g.id, it.id, "unit", v)}
                            dictionary={unitDict}
                            placeholder="יח'"
                          />
                        </div>
                        <button
                          onClick={() => removeItem(g.id, it.id)}
                          className="col-span-1 h-10 rounded-lg bg-white border border-gray-300 text-sm hover:bg-gray-100 transition-all"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={() => addItem(g.id)}
                      className="mt-2 px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 transition-all"
                    >
                      + הוסף רכיב
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* שלבים */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">שלבי הכנה</h3>
              <button
                onClick={addStep}
                className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 transition-all"
              >
                + הוסף שלב
              </button>
            </div>

            <div className="space-y-3">
              {steps.map((s, idx) => (
                <div key={s.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-pink-500 text-white font-bold flex items-center justify-center text-sm shrink-0 mt-2">
                    {idx + 1}
                  </div>
                  <textarea
                    value={s.text}
                    onChange={(e) => setStepText(s.id, e.target.value)}
                    onKeyDown={(e) =>
                      handleRichKeys(e, e.currentTarget, (next, start, end) => {
                        setStepText(s.id, next);
                        setTimeout(() => e.currentTarget.setSelectionRange(start, end), 0);
                      })
                    }
                    className="flex-1 rounded-xl bg-white border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none"
                    rows={2}
                    placeholder="תאר את השלב..."
                  />
                  <button
                    onClick={() => removeStep(s.id)}
                    className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm hover:bg-gray-100 transition-all shrink-0 mt-2"
                  >
                    מחק
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* פעולות */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold shadow-lg hover:shadow-xl hover:from-pink-600 hover:to-rose-600 active:scale-[0.98] transition-all"
            >
              שמור מתכון
            </button>
            <button
              onClick={onCancel}
              className="px-8 py-3 rounded-xl bg-white border border-gray-300 font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              ביטול
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
    </section>
  );
}