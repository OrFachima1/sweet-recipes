"use client";
import React, { useState, useMemo, useEffect } from 'react';

interface Recipe {
  id: string;
  title: string;
  ingredients: IngredientGroup[];
}

interface IngredientGroup {
  groupName: string;
  items: Ingredient[];
}

interface Ingredient {
  id: string;
  name: string;
  qty: string;
  unit: string;
}

interface RecipeSettings {
  recipeId: string;
  recipeName: string;
  menuItemName: string;
  multiplier: number;
  enabled: boolean;
  customIngredients: CustomIngredient[];
  originalRecipeId?: string;
}

interface CustomIngredient {
  name: string;
  qty: number;
  unit: string;
  enabled: boolean;
  originalQty?: number;
}

interface ShoppingListSettingsProps {
  show: boolean;
  onClose: () => void;
  menuItems: string[];
  recipes: Recipe[];
  recipeLinks: Record<string, string>;
  onSave: (settings: RecipeSettings[]) => void;
  initialSettings?: RecipeSettings[];
}

export default function ShoppingListSettings({
  show,
  onClose,
  menuItems,
  recipes,
  recipeLinks,
  onSave,
  initialSettings = []
}: ShoppingListSettingsProps) {
  const [recipeSettings, setRecipeSettings] = useState<RecipeSettings[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);

  // עדכון הגדרות כשמקבלים מנות חדשות
  useEffect(() => {
    if (menuItems.length === 0) return;
    
    console.log('🔍 Debugging:', { 
      menuItemsCount: menuItems.length,
      recipesCount: recipes.length,
      recipeLinksCount: Object.keys(recipeLinks).length,
      recipeLinks 
    });
    
    const existingSettingsMap = new Map(
      initialSettings.map(s => [s.menuItemName, s])
    );
    
    const newSettings = menuItems.map((menuItemName) => {
      // אם יש הגדרה קיימת - בדוק אם צריך לטעון מתכון
      const existingSetting = existingSettingsMap.get(menuItemName);
      if (existingSetting) {
        // אם יש originalRecipeId אבל אין רכיבים - טען אותם עכשיו
        if (existingSetting.originalRecipeId && existingSetting.customIngredients.length === 0) {
          const recipe = recipes.find(r => r.id === existingSetting.originalRecipeId);
          if (recipe) {
            const ingredients: CustomIngredient[] = [];
            recipe.ingredients.forEach(group => {
              group.items.forEach(ing => {
                ingredients.push({
                  name: ing.name,
                  qty: parseFloat(ing.qty) || 0,
                  unit: ing.unit,
                  enabled: true,
                  originalQty: parseFloat(ing.qty) || 0
                });
              });
            });
            return {
              ...existingSetting,
              recipeName: recipe.title,
              customIngredients: ingredients
            };
          }
        }
        return existingSetting;
      }
      
      // אחרת - צור הגדרה חדשה
      const recipeId = recipeLinks[menuItemName];
      const recipe = recipeId ? recipes.find(r => r.id === recipeId) : null;
      const ingredients: CustomIngredient[] = [];
      
      console.log(`📝 Creating setting for ${menuItemName}:`, { recipeId, foundRecipe: !!recipe });
      
      if (recipe) {
        recipe.ingredients.forEach(group => {
          group.items.forEach(ing => {
            ingredients.push({
              name: ing.name,
              qty: parseFloat(ing.qty) || 0,
              unit: ing.unit,
              enabled: true,
              originalQty: parseFloat(ing.qty) || 0
            });
          });
        });
      }
      
      return {
        recipeId: recipeId ? `${recipeId}_${menuItemName}` : `no_recipe_${menuItemName}`,
        recipeName: recipe?.title || 'ללא מתכון',
        menuItemName: menuItemName,
        multiplier: 1,
        enabled: true,
        customIngredients: ingredients,
        originalRecipeId: recipeId
      };
    });
    
    console.log('✅ Settings created:', newSettings.length);
    setRecipeSettings(newSettings);
  }, [menuItems.length, recipes.length, initialSettings]);

  const filteredSettings = useMemo(() => {
    if (!searchTerm) return recipeSettings;
    const term = searchTerm.toLowerCase();
    return recipeSettings.filter(s => 
      s.menuItemName.toLowerCase().includes(term) ||
      s.recipeName.toLowerCase().includes(term)
    );
  }, [recipeSettings, searchTerm]);

  const updateRecipeSetting = (recipeId: string, field: keyof RecipeSettings, value: any) => {
    setRecipeSettings(prev => 
      prev.map(s => s.recipeId === recipeId ? { ...s, [field]: value } : s)
    );
  };

  const updateIngredient = (recipeId: string, oldName: string, field: keyof CustomIngredient, value: any) => {
    setRecipeSettings(prev => 
      prev.map(s => {
        if (s.recipeId !== recipeId) return s;
        return {
          ...s,
          customIngredients: s.customIngredients.map((ing, idx) => 
            ing.name === oldName || (oldName === '' && s.customIngredients[idx] === ing)
              ? { ...ing, [field]: value } 
              : ing
          )
        };
      })
    );
  };

  const addCustomIngredient = (recipeId: string) => {
    setRecipeSettings(prev => 
      prev.map(s => {
        if (s.recipeId !== recipeId) return s;
        return {
          ...s,
          customIngredients: [
            ...s.customIngredients,
            { name: '', qty: 0, unit: '', enabled: true }
          ]
        };
      })
    );
  };

  const removeIngredient = (recipeId: string, ingredientName: string) => {
    setRecipeSettings(prev => 
      prev.map(s => {
        if (s.recipeId !== recipeId) return s;
        return {
          ...s,
          customIngredients: s.customIngredients.filter(ing => ing.name !== ingredientName)
        };
      })
    );
  };

  const linkRecipe = (menuItemName: string, newRecipeId: string) => {
    if (!newRecipeId) {
      // ניתוק מתכון - מעבר למצב ידני
      setRecipeSettings(prev => 
        prev.map(s => {
          if (s.menuItemName !== menuItemName) return s;
          return {
            ...s,
            recipeId: `manual_${menuItemName}`,
            recipeName: 'הגדרה ידנית',
            originalRecipeId: undefined,
            customIngredients: [],
            enabled: true
          };
        })
      );
      return;
    }

    const recipe = recipes.find(r => r.id === newRecipeId);
    if (!recipe) return;

    setRecipeSettings(prev => 
      prev.map(s => {
        if (s.menuItemName !== menuItemName) return s;
        
        const ingredients: CustomIngredient[] = [];
        recipe.ingredients.forEach(group => {
          group.items.forEach(ing => {
            ingredients.push({
              name: ing.name,
              qty: parseFloat(ing.qty) || 0,
              unit: ing.unit,
              enabled: true,
              originalQty: parseFloat(ing.qty) || 0
            });
          });
        });

        return {
          ...s,
          recipeId: `${newRecipeId}_${menuItemName}`,
          recipeName: recipe.title,
          originalRecipeId: newRecipeId,
          customIngredients: ingredients,
          enabled: true
        };
      })
    );
  };

  const handleSave = () => {
    onSave(recipeSettings);
    onClose();
  };

  if (!show) return null;

  const selectedSetting = selectedRecipe 
    ? recipeSettings.find(s => s.recipeId === selectedRecipe)
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-3xl font-bold text-gray-900">הגדרות מתכונים</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-2xl"
            >
              ✕
            </button>
          </div>
          
          <input
            type="text"
            placeholder="🔍 חפש מנה או מתכון..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/3 border-l border-gray-200 overflow-y-auto p-4">
            <div className="space-y-2">
              {filteredSettings.map((setting) => (
                <div
                  key={setting.recipeId}
                  onClick={() => setSelectedRecipe(setting.recipeId)}
                  className={`p-4 rounded-xl cursor-pointer transition-all ${
                    selectedRecipe === setting.recipeId
                      ? 'bg-amber-100 border-2 border-amber-400'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{setting.menuItemName}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        {setting.originalRecipeId ? (
                          <span className="text-emerald-600">🔗 {setting.recipeName}</span>
                        ) : setting.recipeName === 'הגדרה ידנית' ? (
                          <span className="text-blue-600">✍️ הגדרה ידנית</span>
                        ) : (
                          <span className="text-orange-500">⚠️ ללא מתכון</span>
                        )}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={setting.enabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateRecipeSetting(setting.recipeId, 'enabled', e.target.checked);
                      }}
                      className="w-5 h-5 rounded border-2 border-amber-400 text-amber-600"
                    />
                  </div>
                  {setting.originalRecipeId && (
                    <div className="text-xs text-amber-600">
                      מכפיל: ×{setting.multiplier} | רכיבים: {setting.customIngredients.length}
                    </div>
                  )}
                </div>
              ))}
              
              {filteredSettings.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  לא נמצאו תוצאות
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {!selectedSetting ? (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p>בחר מנה מהרשימה</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6">
                <h4 className="text-xl font-bold text-gray-900 mb-4 sticky top-0 bg-white pb-2 z-20">{selectedSetting.menuItemName}</h4>
                
                <div className="bg-amber-50 rounded-xl p-4 border-2 border-amber-200 mb-4">
                  <label className="block text-sm font-semibold text-amber-900 mb-2">
                    בחר מתכון או הגדר ידנית ({recipes.length} מתכונים זמינים)
                  </label>
                  <select
                    value={selectedSetting.originalRecipeId || ''}
                    onChange={(e) => linkRecipe(selectedSetting.menuItemName, e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border-2 border-amber-300 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">✍️ הגדרה ידנית (ללא מתכון)</option>
                    {recipes
                      .sort((a, b) => a.title.localeCompare(b.title, 'he'))
                      .map(recipe => (
                        <option key={recipe.id} value={recipe.id}>
                          {recipe.title}
                        </option>
                      ))}
                  </select>
                </div>

                {selectedSetting.originalRecipeId && (
                  <div className="bg-amber-50 rounded-xl p-4 border-2 border-amber-200 mb-6">
                    <label className="block text-sm font-semibold text-amber-900 mb-2">
                      מכפיל מתכון (כמה יחידות המתכון מייצר?)
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={selectedSetting.multiplier}
                        onChange={(e) => updateRecipeSetting(selectedSetting.recipeId, 'multiplier', parseFloat(e.target.value) || 1)}
                        className="w-32 px-4 py-2 rounded-xl border-2 border-amber-300 focus:border-amber-500 focus:outline-none text-center text-lg font-bold"
                      />
                      <div className="text-sm text-gray-600">
                        <p>💡 לדוגמה: אם המתכון מייצר 20 עוגיות, הכנס 20</p>
                        <p className="text-amber-700 font-semibold mt-1">
                          הכמויות ברשימה יחולקו ב-{selectedSetting.multiplier}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="text-lg font-bold text-gray-900">
                      רכיבים ({selectedSetting.customIngredients.length})
                    </h5>
                    <button
                      onClick={() => addCustomIngredient(selectedSetting.recipeId)}
                      className="px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all flex items-center gap-2"
                    >
                      <span>+</span>
                      <span>הוסף רכיב</span>
                    </button>
                  </div>

                  {selectedSetting.customIngredients.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-lg mb-2">אין רכיבים עדיין</p>
                      <p className="text-sm">לחץ על "הוסף רכיב" כדי להתחיל</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedSetting.customIngredients.map((ingredient, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            ingredient.enabled
                              ? 'bg-white border-gray-200'
                              : 'bg-gray-50 border-gray-300 opacity-60'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={ingredient.enabled}
                              onChange={(e) => updateIngredient(selectedSetting.recipeId, ingredient.name, 'enabled', e.target.checked)}
                              className="mt-1 w-5 h-5 rounded border-2 border-amber-400 text-amber-600"
                            />
                            
                            <div className="flex-1 grid grid-cols-3 gap-3">
                              <input
                                type="text"
                                placeholder="שם רכיב"
                                value={ingredient.name}
                                onChange={(e) => updateIngredient(selectedSetting.recipeId, ingredient.name, 'name', e.target.value)}
                                className="px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-amber-500 focus:outline-none"
                              />
                              <input
                                type="number"
                                placeholder="כמות"
                                value={ingredient.qty || ''}
                                onChange={(e) => updateIngredient(selectedSetting.recipeId, ingredient.name, 'qty', parseFloat(e.target.value) || 0)}
                                className="px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-amber-500 focus:outline-none"
                              />
                              <input
                                type="text"
                                placeholder="יחידה"
                                value={ingredient.unit}
                                onChange={(e) => updateIngredient(selectedSetting.recipeId, ingredient.name, 'unit', e.target.value)}
                                className="px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-amber-500 focus:outline-none"
                              />
                            </div>

                            <button
                              onClick={() => removeIngredient(selectedSetting.recipeId, ingredient.name)}
                              className="mt-1 w-8 h-8 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition-colors"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="text-sm text-gray-600">
            {recipeSettings.filter(s => s.enabled).length} מתכונים פעילים מתוך {recipeSettings.length}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold transition-all"
            >
              ביטול
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-3 rounded-xl bg-gradient-to-l from-amber-500 to-yellow-500 text-white font-semibold hover:shadow-lg transition-all"
            >
              שמור והחל
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}