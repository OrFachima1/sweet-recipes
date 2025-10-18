// Types for the weighing system

export type Recipe = any;

export interface AggregatedIngredient {
  name: string;
  totalQty: number;
  unit: string;
  sources: string[];
  items: any[];
}

export interface RecipeProgress {
  completed: number;
  total: number;
}

export type ViewMode = 'per-recipe' | 'summary';