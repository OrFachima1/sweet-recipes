"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import HomeButton from "@/components/HomeButton";

// Hooks
import { useKeepAwake } from "./hooks/useKeepAwake";
import { useWeighProgress } from "./hooks/useWeighProgress";
import { useRecipes, useAllRecipes } from "./hooks/useRecipes";
import { 
  useAggregatedIngredients, 
  useBaseQuantities, 
  useRecipeProgress 
} from "./hooks/useAggregatedIngredients";

// Components
import { ConfettiCelebration } from "./components/ConfettiCelebration";
import { RecipePicker } from "./components/RecipePicker";
import { FocusMode } from "./components/FocusMode";
import { ProgressHeader } from "./components/ProgressHeader";
import { WorkModeToggle } from "./components/WorkModeToggle";
import { ViewModeSelector } from "./components/ViewModeSelector";
import { SummaryView } from "./components/SummaryView";
import { PerRecipeView } from "./components/PerRecipeView";

// Types
import type { ViewMode } from "./utils/types";
import LoadingScreen from "@/components/LoadingScreen";

export default function WeighClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const initialIds = (sp.get("ids") || "").split(",").filter(Boolean);

  // Recipe management
  const { 
    recipes, 
    currentIds, 
    setCurrentIds, 
    loading, 
    addMultipleRecipes, 
    removeRecipe 
  } = useRecipes(initialIds);
  const allRecipesForPicker = useAllRecipes();

  // Scale management
  const [scales, setScales] = useState<Record<string, number>>({});
  const setScaleFor = (id: string, v: number) =>
    setScales(s => ({ ...s, [id]: !Number.isFinite(v) || v < 0 ? 1 : v }));

  // Weighing progress
  const {
    weighed,
    toggleWeighed,
    clearProgress,
    showConfetti,
    setShowConfetti,
    checkCompletion,
  } = useWeighProgress();

  // Aggregated data
  const aggregatedIngredients = useAggregatedIngredients(recipes, scales);
  const baseQty = useBaseQuantities(recipes);
  const recipeProgress = useRecipeProgress(recipes, weighed);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('per-recipe');
  const [showPicker, setShowPicker] = useState(false);
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [highlightedIngredient, setHighlightedIngredient] = useState<string | null>(null);

  // Highlight ingredient (for focus mode)
  const highlightIngredient = (ingredientName: string | null) => {
    setHighlightedIngredient(ingredientName);
    // Don't auto-clear - let user clear manually
  };

  const clearHighlight = () => setHighlightedIngredient(null);

  // Work mode (keep screen awake)
  const [workMode, setWorkMode] = useState(false);
  useKeepAwake(workMode);

  async function handleWorkModeToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const on = e.target.checked;
    setWorkMode(on);
    if (on) {
      try {
        const mod = await import("nosleep.js");
        const NoSleep = mod.default;
        (window as any).__nosleep ||= new NoSleep();
        (window as any).__nosleep.enable();
      } catch {}
    } else {
      try {
        (window as any).__nosleep?.disable?.();
      } catch {}
    }
  }

  // Update URL when IDs change
  useEffect(() => {
    if (currentIds.length > 0) {
      router.replace(`/weigh?ids=${currentIds.join(",")}`, { scroll: false });
    }
  }, [currentIds, router]);

  // Check for completion
  useEffect(() => {
    checkCompletion(aggregatedIngredients.length);
  }, [weighed.size, aggregatedIngredients.length, checkCompletion]);

  // Focus mode navigation
  const navigateFocus = (direction: number) => {
    const newIndex = focusedIndex + direction;
    if (newIndex >= 0 && newIndex < aggregatedIngredients.length) {
      setFocusedIndex(newIndex);
    }
  };

  const openFocusMode = (index: number) => {
    setFocusedIndex(index);
    setFocusModeOpen(true);
  };

  // Empty state
  if (currentIds.length === 0) {
    return (
      <div className="p-6" dir="rtl" lang="he">
        <HomeButton />
        <div className="text-center py-12">
          <div className="text-xl mb-4">לא נבחרו מתכונים</div>
          <button
            onClick={() => setShowPicker(true)}
            className="px-6 py-3 rounded-xl bg-pink-500 text-white font-bold hover:bg-pink-600"
          >
            הוסף מתכונים
          </button>
        </div>
        {showPicker && (
          <RecipePicker
            allRecipes={allRecipesForPicker}
            currentIds={currentIds}
            onAddMultiple={addMultipleRecipes}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    );
  }

  // Loading state
  if (loading)  return <LoadingScreen />;

  // Focus Mode
  if (focusModeOpen && aggregatedIngredients[focusedIndex]) {
    return (
      <FocusMode
        ingredient={aggregatedIngredients[focusedIndex]}
        index={focusedIndex}
        total={aggregatedIngredients.length}
        weighed={weighed}
        onToggleWeighed={toggleWeighed}
        onNavigate={navigateFocus}
        onClose={() => setFocusModeOpen(false)}
        allIngredients={aggregatedIngredients}
        onJumpToIndex={setFocusedIndex}
      />
    );
  }

  return (
    <div className="max-w-full mx-auto p-3 sm:p-4 pb-20 sm:pb-24" dir="rtl" lang="he">
      {showConfetti && <ConfettiCelebration onDone={() => setShowConfetti(false)} />}
      
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 sm:mb-4 gap-3">
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <HomeButton />
          <WorkModeToggle workMode={workMode} onChange={handleWorkModeToggle} />
        </div>
        
        <div className="flex items-center justify-center">
          <ViewModeSelector viewMode={viewMode} onChange={setViewMode} />
        </div>

        <button
          onClick={() => setShowPicker(true)}
className="w-full sm:w-auto sm:relative sm:left-16 px-4 py-2 rounded-lg sm:rounded-xl bg-pink-500 text-white text-sm sm:text-base font-bold hover:bg-pink-600"        >
          + הוסף מתכון
        </button>
      </div>

      {/* Progress Header - Only in summary view */}
      {viewMode === 'summary' && (
        <ProgressHeader
          weighed={weighed}
          total={aggregatedIngredients.length}
          onClearProgress={clearProgress}
          onStartFocus={() => aggregatedIngredients.length > 0 && openFocusMode(0)}
        />
      )}

      {/* Content */}
      {viewMode === 'per-recipe' ? (
        <PerRecipeView
          recipes={recipes}
          weighed={weighed}
          scales={scales}
          baseQty={baseQty}
          recipeProgress={recipeProgress}
          onToggleWeighed={toggleWeighed}
          onSetScale={setScaleFor}
          onRemoveRecipe={removeRecipe}
          highlightedIngredient={highlightedIngredient}
          onHighlight={highlightIngredient}
          onClearHighlight={clearHighlight}
        />
      ) : (
        <SummaryView
          ingredients={aggregatedIngredients}
          weighed={weighed}
          selected={new Set()}
          onToggleWeighed={toggleWeighed}
        />
      )}

      {/* Recipe Picker Modal */}
      {showPicker && (
        <RecipePicker
          allRecipes={allRecipesForPicker}
          currentIds={currentIds}
          onAddMultiple={addMultipleRecipes}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}