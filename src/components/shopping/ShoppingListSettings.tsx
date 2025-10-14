"use client";
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';

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
  qty: number | string;
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
  const [isSaving, setIsSaving] = useState(false);

  // State עבור ה-autocomplete
  const [focusedInput, setFocusedInput] = useState<{
    recipeId: string;
    index: number;
    field: 'name' | 'unit';
  } | null>(null);

  const [autocompleteSearch, setAutocompleteSearch] = useState('');
  const autocompleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // אוסף את כל שמות הרכיבים והיחידות - רק מרכיבים מסומנים!
  const allIngredientNames = useMemo(() => {
    const names = new Set<string>();
    recipes.forEach(recipe => {
      recipe.ingredients.forEach(group => {
        group.items.forEach(ing => {
          if (ing.name.trim()) names.add(ing.name.trim());
        });
      });
    });
    recipeSettings.forEach(setting => {
      if (setting.enabled) {  // רק הגדרות מסומנות
        setting.customIngredients.forEach(ing => {
          if (ing.enabled && ing.name.trim()) {  // רק רכיבים מסומנים
            names.add(ing.name.trim());
          }
        });
      }
    });
    return Array.from(names).sort();
  }, [recipes, recipeSettings]);

  const allUnits = useMemo(() => {
    const units = new Set<string>();
    recipes.forEach(recipe => {
      recipe.ingredients.forEach(group => {
        group.items.forEach(ing => {
          if (ing.unit.trim()) units.add(ing.unit.trim());
        });
      });
    });
    recipeSettings.forEach(setting => {
      if (setting.enabled) {  // רק הגדרות מסומנות
        setting.customIngredients.forEach(ing => {
          if (ing.enabled && ing.unit.trim()) {  // רק רכיבים מסומנים
            units.add(ing.unit.trim());
          }
        });
      }
    });
    return Array.from(units).sort();
  }, [recipes, recipeSettings]);

  // סינון ההצעות לפי החיפוש
  const filteredSuggestions = useMemo(() => {
    if (!focusedInput || !autocompleteSearch) return [];
    
    const list = focusedInput.field === 'name' ? allIngredientNames : allUnits;
    const search = autocompleteSearch.toLowerCase();
    
    return list
      .filter(item => item.toLowerCase().includes(search))
      .slice(0, 5);
  }, [focusedInput, autocompleteSearch, allIngredientNames, allUnits]);

  // גלול כדי להציג את הדרופדאון
  useEffect(() => {
    if (focusedInput && filteredSuggestions.length > 0 && dropdownRef.current && scrollContainerRef.current) {
      const dropdown = dropdownRef.current;
      const container = scrollContainerRef.current;
      
      const dropdownRect = dropdown.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      if (dropdownRect.bottom > containerRect.bottom) {
        const scrollAmount = dropdownRect.bottom - containerRect.bottom + 20;
        container.scrollTop += scrollAmount;
      }
    }
  }, [focusedInput, filteredSuggestions.length]);

  // פונקציה לסגירת autocomplete
  const closeAutocomplete = useCallback(() => {
    if (autocompleteTimeoutRef.current) {
      clearTimeout(autocompleteTimeoutRef.current);
    }
    autocompleteTimeoutRef.current = setTimeout(() => {
      setFocusedInput(null);
    }, 150);
  }, []);

  // פונקציה לבחירת הצעה
  const selectSuggestion = useCallback((recipeId: string, index: number, field: 'name' | 'unit', value: string) => {
    if (autocompleteTimeoutRef.current) {
      clearTimeout(autocompleteTimeoutRef.current);
    }
    updateIngredient(recipeId, index, field, value);
    setFocusedInput(null);
  }, []);

  // עדכון הגדרות כשמקבלים מנות חדשות
  useEffect(() => {
    if (menuItems.length === 0) return;
    
    const existingSettingsMap = new Map(
      initialSettings.map(s => [s.menuItemName, s])
    );
    
    const newSettings = menuItems.map((menuItemName) => {
      const existingSetting = existingSettingsMap.get(menuItemName);
      if (existingSetting) {
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
      
      const recipeId = recipeLinks[menuItemName];
      const recipe = recipeId ? recipes.find(r => r.id === recipeId) : null;
      const ingredients: CustomIngredient[] = [];
      
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

  const updateIngredient = (recipeId: string, ingredientIndex: number, field: keyof CustomIngredient, value: any) => {
    setRecipeSettings(prev => 
      prev.map(s => {
        if (s.recipeId !== recipeId) return s;
        return {
          ...s,
          customIngredients: s.customIngredients.map((ing, idx) => 
            idx === ingredientIndex 
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
            { name: '', qty: '', unit: '', enabled: true }
          ]
        };
      })
    );
  };

  const removeIngredient = (recipeId: string, ingredientIndex: number) => {
    setRecipeSettings(prev => 
      prev.map(s => {
        if (s.recipeId !== recipeId) return s;
        return {
          ...s,
          customIngredients: s.customIngredients.filter((_, idx) => idx !== ingredientIndex)
        };
      })
    );
  };

  const linkRecipe = (menuItemName: string, newRecipeId: string) => {
    if (!newRecipeId) {
      setRecipeSettings(prev => 
        prev.map(s => {
          if (s.menuItemName !== menuItemName) return s;
          return {
            ...s,
            recipeId: `manual_${menuItemName}`,
            recipeName: 'הגדרה ידנית',
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

  const cleanUndefinedValues = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefinedValues(item));
  }
  
  const cleaned: any = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined) {
      cleaned[key] = typeof value === 'object' && value !== null 
        ? cleanUndefinedValues(value)
        : value;
    }
  });
  
  return cleaned;
};

const handleSave = async () => {
  setIsSaving(true);
  try {
    // נקה את כל ה-undefined values
    const cleanedSettings = cleanUndefinedValues(recipeSettings);
    
    // הדפס לקונסול כדי לראות מה נשמר
    console.log('💾 שומר הגדרות:', cleanedSettings);
    
    await onSave(cleanedSettings);
    onClose();
  } catch (error) {
    console.error('שגיאה בשמירה:', error);
    alert('שגיאה בשמירת ההגדרות. נסה שוב.');
  } finally {
    setIsSaving(false);
  }
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
        {/* Header */}
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

        {/* Content */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* רשימת מנות */}
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
                          <span className="text-blue-600">✏️ הגדרה ידנית</span>
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

          {/* פרטי מנה */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative z-0">
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
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6">
                <h4 className="text-xl font-bold text-gray-900 mb-4 sticky top-0 bg-white pb-2 z-20">{selectedSetting.menuItemName}</h4>
                
                {/* בחירת מתכון */}
                <div className="bg-amber-50 rounded-xl p-4 border-2 border-amber-200 mb-4">
                  <label className="block text-sm font-semibold text-amber-900 mb-2">
                    בחר מתכון או הגדר ידנית ({recipes.length} מתכונים זמינים)
                  </label>
                  <select
                    value={selectedSetting.originalRecipeId || ''}
                    onChange={(e) => linkRecipe(selectedSetting.menuItemName, e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border-2 border-amber-300 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">✏️ הגדרה ידנית (ללא מתכון)</option>
                    {recipes
                      .sort((a, b) => a.title.localeCompare(b.title, 'he'))
                      .map(recipe => (
                        <option key={recipe.id} value={recipe.id}>
                          {recipe.title}
                        </option>
                      ))}
                  </select>
                </div>

                {/* מכפיל מתכון */}
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
                        <p>💡 לדוגמא: אם המתכון מייצר 20 עוגיות, הכנס 20</p>
                        <p className="text-amber-700 font-semibold mt-1">
                          הכמויות ברשימה יחולקו ב-{selectedSetting.multiplier}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* רכיבים */}
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
                      {selectedSetting.customIngredients.map((ingredient, index) => {
                        const isNameFocused = focusedInput?.recipeId === selectedSetting.recipeId && 
                                              focusedInput?.index === index && 
                                              focusedInput?.field === 'name';
                        const isUnitFocused = focusedInput?.recipeId === selectedSetting.recipeId && 
                                              focusedInput?.index === index && 
                                              focusedInput?.field === 'unit';

                        return (
                          <div
                            key={index}
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
                                onChange={(e) => updateIngredient(
                                  selectedSetting.recipeId, 
                                  index,
                                  'enabled', 
                                  e.target.checked
                                )}
                                className="mt-1 w-5 h-5 rounded border-2 border-amber-400 text-amber-600"
                              />
                              
                              <div className="flex-1 grid grid-cols-3 gap-3">
                                <div className="relative">
                                  <input
                                    type="text"
                                    placeholder="שם רכיב"
                                    value={ingredient.name}
                                    onChange={(e) => {
                                      updateIngredient(selectedSetting.recipeId, index, 'name', e.target.value);
                                      setAutocompleteSearch(e.target.value);
                                    }}
                                    onFocus={() => {
                                      if (autocompleteTimeoutRef.current) {
                                        clearTimeout(autocompleteTimeoutRef.current);
                                      }
                                      setFocusedInput({ recipeId: selectedSetting.recipeId, index, field: 'name' });
                                      setAutocompleteSearch(ingredient.name);
                                    }}
                                    onBlur={closeAutocomplete}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Tab' && filteredSuggestions.length > 0) {
                                        e.preventDefault();
                                        selectSuggestion(selectedSetting.recipeId, index, 'name', filteredSuggestions[0]);
                                      }
                                      if (e.key === 'Enter' && filteredSuggestions.length > 0) {
                                        e.preventDefault();
                                        selectSuggestion(selectedSetting.recipeId, index, 'name', filteredSuggestions[0]);
                                      }
                                      if (e.key === 'Escape') {
                                        setFocusedInput(null);
                                      }
                                    }}
                                    className="w-full px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-amber-500 focus:outline-none"
                                  />
                                  
                                  {isNameFocused && filteredSuggestions.length > 0 && (
                                    <div 
                                      ref={isNameFocused ? dropdownRef : null}
                                      className="absolute z-[9999] w-full mt-1 bg-white border-2 border-amber-400 rounded-lg shadow-xl max-h-48 overflow-y-auto"
                                    >
                                      {filteredSuggestions.map((suggestion, idx) => (
                                        <div
                                          key={idx}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            selectSuggestion(selectedSetting.recipeId, index, 'name', suggestion);
                                          }}
                                          className="px-3 py-2 hover:bg-amber-50 cursor-pointer transition-colors text-right"
                                        >
                                          {suggestion}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="כמות"
                                  value={ingredient.qty || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                      updateIngredient(selectedSetting.recipeId, index, 'qty', value === '' ? '' : value);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const value = e.target.value;
                                    if (value === '' || value === '.') {
                                      updateIngredient(selectedSetting.recipeId, index, 'qty', 0);
                                    } else {
                                      const num = parseFloat(value);
                                      updateIngredient(selectedSetting.recipeId, index, 'qty', isNaN(num) ? 0 : num);
                                    }
                                  }}
                                  className="px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-amber-500 focus:outline-none"
                                />

                                <div className="relative">
                                  <input
                                    type="text"
                                    placeholder="יחידה"
                                    value={ingredient.unit}
                                    onChange={(e) => {
                                      updateIngredient(selectedSetting.recipeId, index, 'unit', e.target.value);
                                      setAutocompleteSearch(e.target.value);
                                    }}
                                    onFocus={() => {
                                      if (autocompleteTimeoutRef.current) {
                                        clearTimeout(autocompleteTimeoutRef.current);
                                      }
                                      setFocusedInput({ recipeId: selectedSetting.recipeId, index, field: 'unit' });
                                      setAutocompleteSearch(ingredient.unit);
                                    }}
                                    onBlur={closeAutocomplete}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Tab' && filteredSuggestions.length > 0) {
                                        e.preventDefault();
                                        selectSuggestion(selectedSetting.recipeId, index, 'unit', filteredSuggestions[0]);
                                      }
                                      if (e.key === 'Enter' && filteredSuggestions.length > 0) {
                                        e.preventDefault();
                                        selectSuggestion(selectedSetting.recipeId, index, 'unit', filteredSuggestions[0]);
                                      }
                                      if (e.key === 'Escape') {
                                        setFocusedInput(null);
                                      }
                                    }}
                                    className="w-full px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-amber-500 focus:outline-none"
                                  />
                                  
                                  {isUnitFocused && filteredSuggestions.length > 0 && (
                                    <div 
                                      ref={isUnitFocused ? dropdownRef : null}
                                      className="absolute z-[9999] w-full mt-1 bg-white border-2 border-amber-400 rounded-lg shadow-xl max-h-48 overflow-y-auto"
                                    >
                                      {filteredSuggestions.map((suggestion, idx) => (
                                        <div
                                          key={idx}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            selectSuggestion(selectedSetting.recipeId, index, 'unit', suggestion);
                                          }}
                                          className="px-3 py-2 hover:bg-amber-50 cursor-pointer transition-colors text-right"
                                        >
                                          {suggestion}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <button
                                onClick={() => removeIngredient(selectedSetting.recipeId, index)}
                                className="mt-1 w-8 h-8 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center font-bold"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-8 py-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg transition-all"
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-8 py-4 rounded-xl font-bold text-lg transition-all ${
              isSaving 
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'
            } text-white shadow-lg`}
          >
            {isSaving ? '⏳ שומר...' : '💾 שמור הגדרות'}
          </button>
        </div>
      </div>
    </div>
  );
}