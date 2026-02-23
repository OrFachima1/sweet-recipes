/**
 * Benchmark Script for Shopping List Performance
 *
 * הרצה: npx ts-node scripts/benchmark-shopping-list.ts
 *
 * מודד את ביצועי החישוב של רשימת הקניות
 */

// Mock data generators
function generateOrders(count: number) {
  const menuItemNames = [
    'עוגת שוקולד', 'עוגת גבינה', 'טירמיסו', 'עוגת תפוחים',
    'קרם ברולה', 'פנקוטה', 'עוגת אוראו', 'בראוניז',
    'עוגת לוטוס', 'קינוח מוס', 'עוגת פירות', 'עוגת שכבות'
  ];

  const orders = [];
  for (let i = 0; i < count; i++) {
    const itemCount = Math.floor(Math.random() * 5) + 1;
    const items = [];
    for (let j = 0; j < itemCount; j++) {
      items.push({
        title: menuItemNames[Math.floor(Math.random() * menuItemNames.length)],
        qty: Math.floor(Math.random() * 3) + 1
      });
    }
    orders.push({
      __id: `order-${i}`,
      clientName: `לקוח ${i}`,
      eventDate: '2024-01-15',
      items
    });
  }
  return orders;
}

function generateMenuItems(count: number) {
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push({
      name: `מנה ${i}`,
      recipeId: `recipe-${i}`,
      enabled: true
    });
  }
  // Add actual menu items used in orders
  const actualItems = [
    'עוגת שוקולד', 'עוגת גבינה', 'טירמיסו', 'עוגת תפוחים',
    'קרם ברולה', 'פנקוטה', 'עוגת אוראו', 'בראוניז',
    'עוגת לוטוס', 'קינוח מוס', 'עוגת פירות', 'עוגת שכבות'
  ];
  actualItems.forEach((name, i) => {
    items.push({
      name,
      recipeId: `recipe-actual-${i}`,
      enabled: true
    });
  });
  return items;
}

function generateRecipes(menuItems: any[]) {
  const ingredientNames = [
    'קמח', 'סוכר', 'ביצים', 'חמאה', 'שמן', 'חלב', 'שוקולד',
    'וניל', 'אבקת אפייה', 'מלח', 'קרם', 'גבינה', 'שמנת'
  ];

  return menuItems.map(item => ({
    id: item.recipeId,
    title: item.name,
    ingredients: [{
      groupName: 'מרכיבים',
      items: ingredientNames.slice(0, Math.floor(Math.random() * 8) + 3).map((name, i) => ({
        id: `ing-${i}`,
        name,
        qty: String(Math.floor(Math.random() * 500) + 50),
        unit: 'גרם'
      }))
    }]
  }));
}

function normalizeIngredientName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// =============================================
// OLD ALGORITHM (Before Optimization)
// =============================================
function computeShoppingListOLD(
  menuItems: any[],
  recipes: any[],
  orders: any[],
  ingredientMappings: Record<string, string>,
  itemCategories: Record<string, string>,
  deletedItems: string[],
  manualItems: any[]
) {
  const aggregated: Record<string, any> = {};

  for (const menuItem of menuItems) {
    if (!menuItem.enabled) continue;
    if (!menuItem.recipeId) continue;

    const recipe = recipes.find(r => r.id === menuItem.recipeId);
    if (!recipe) continue;

    // OLD: O(M*N*K) - scanning all orders for each menu item
    let totalQty = 0;
    orders.forEach(order => {
      order.items.forEach((item: any) => {
        if (item.title === menuItem.name) {
          totalQty += item.qty || 1;
        }
      });
    });

    if (totalQty === 0) continue;

    for (const group of recipe.ingredients || []) {
      for (const ingredient of group.items || []) {
        const normalizedName = normalizeIngredientName(ingredient.name);
        const mappedName = ingredientMappings[normalizedName] || ingredient.name;
        const key = ingredientMappings[normalizedName]
          ? normalizeIngredientName(ingredientMappings[normalizedName])
          : normalizedName;

        if (!aggregated[key]) {
          aggregated[key] = {
            name: mappedName,
            qty: 0,
            unit: ingredient.unit,
            sources: [],
            category: itemCategories[normalizedName] || 'other'
          };
        }

        const qty = (parseFloat(ingredient.qty) || 0) * totalQty;
        aggregated[key].qty += qty;

        // OLD: O(n) lookup with includes
        if (!aggregated[key].sources.includes(menuItem.name)) {
          aggregated[key].sources.push(menuItem.name);
        }
      }
    }
  }

  const allItems = [...Object.values(aggregated), ...manualItems];
  return allItems
    // OLD: O(n) lookup with includes for each item
    .filter(item => !deletedItems.includes(normalizeIngredientName(item.name)))
    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'he'));
}

// =============================================
// NEW ALGORITHM (After Optimization)
// =============================================
function computeShoppingListNEW(
  menuItems: any[],
  recipes: any[],
  orders: any[],
  ingredientMappings: Record<string, string>,
  itemCategories: Record<string, string>,
  deletedItems: string[],
  manualItems: any[]
) {
  // 🚀 Pre-compute quantity map - O(N*K) instead of O(M*N*K)
  const menuItemQtyMap = new Map<string, number>();
  for (const order of orders) {
    for (const item of order.items) {
      menuItemQtyMap.set(item.title, (menuItemQtyMap.get(item.title) || 0) + (item.qty || 1));
    }
  }

  // 🚀 Convert deletedItems to Set - O(1) instead of O(n)
  const deletedSet = new Set(deletedItems.map(normalizeIngredientName));

  // 🚀 Use Set for source tracking - O(1) instead of O(n)
  const aggregated: Record<string, any & { _sourceSet: Set<string> }> = {};

  for (const menuItem of menuItems) {
    if (!menuItem.enabled) continue;

    // 🚀 Use pre-computed map
    const totalQty = menuItemQtyMap.get(menuItem.name) || 0;
    if (totalQty === 0) continue;

    if (!menuItem.recipeId) continue;

    const recipe = recipes.find(r => r.id === menuItem.recipeId);
    if (!recipe) continue;

    for (const group of recipe.ingredients || []) {
      for (const ingredient of group.items || []) {
        const normalizedName = normalizeIngredientName(ingredient.name);
        const mappedName = ingredientMappings[normalizedName] || ingredient.name;
        const key = ingredientMappings[normalizedName]
          ? normalizeIngredientName(ingredientMappings[normalizedName])
          : normalizedName;

        if (!aggregated[key]) {
          aggregated[key] = {
            name: mappedName,
            qty: 0,
            unit: ingredient.unit,
            sources: [],
            category: itemCategories[normalizedName] || 'other',
            _sourceSet: new Set()
          };
        }

        const qty = (parseFloat(ingredient.qty) || 0) * totalQty;
        aggregated[key].qty += qty;

        // 🚀 O(1) lookup with Set
        if (!aggregated[key]._sourceSet.has(menuItem.name)) {
          aggregated[key].sources.push(menuItem.name);
          aggregated[key]._sourceSet.add(menuItem.name);
        }
      }
    }
  }

  // Remove internal _sourceSet
  const cleanedAggregated = Object.values(aggregated).map(({ _sourceSet, ...item }) => item);

  const allItems = [...cleanedAggregated, ...manualItems];
  return allItems
    // 🚀 O(1) lookup with Set
    .filter(item => !deletedSet.has(normalizeIngredientName(item.name)))
    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'he'));
}

// =============================================
// BENCHMARK RUNNER
// =============================================
function runBenchmark(name: string, fn: () => any, iterations: number = 100) {
  // Warmup
  for (let i = 0; i < 5; i++) fn();

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const sorted = [...times].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(times.length * 0.5)];
  const p95 = sorted[Math.floor(times.length * 0.95)];

  return { name, avg, min, max, p50, p95 };
}

function formatMs(ms: number): string {
  return ms.toFixed(3) + 'ms';
}

// =============================================
// MAIN
// =============================================
console.log('🚀 Shopping List Performance Benchmark\n');
console.log('='.repeat(60));

// Test configurations
const configs = [
  { orders: 50, menuItems: 20, label: 'קטן (50 הזמנות, 20 מנות)' },
  { orders: 200, menuItems: 50, label: 'בינוני (200 הזמנות, 50 מנות)' },
  { orders: 500, menuItems: 100, label: 'גדול (500 הזמנות, 100 מנות)' },
  { orders: 1000, menuItems: 200, label: 'ענק (1000 הזמנות, 200 מנות)' },
];

for (const config of configs) {
  console.log(`\n📊 ${config.label}`);
  console.log('-'.repeat(60));

  const orders = generateOrders(config.orders);
  const menuItems = generateMenuItems(config.menuItems);
  const recipes = generateRecipes(menuItems);
  const ingredientMappings: Record<string, string> = {};
  const itemCategories: Record<string, string> = {};
  const deletedItems = ['קמח', 'סוכר', 'מלח']; // Some deleted items
  const manualItems: any[] = [];

  const oldResult = runBenchmark('OLD Algorithm', () => {
    return computeShoppingListOLD(
      menuItems, recipes, orders, ingredientMappings,
      itemCategories, deletedItems, manualItems
    );
  });

  const newResult = runBenchmark('NEW Algorithm', () => {
    return computeShoppingListNEW(
      menuItems, recipes, orders, ingredientMappings,
      itemCategories, deletedItems, manualItems
    );
  });

  const improvement = ((oldResult.avg - newResult.avg) / oldResult.avg * 100).toFixed(1);
  const speedup = (oldResult.avg / newResult.avg).toFixed(2);

  console.log(`\n  OLD (לפני):  avg=${formatMs(oldResult.avg)}  p50=${formatMs(oldResult.p50)}  p95=${formatMs(oldResult.p95)}`);
  console.log(`  NEW (אחרי):  avg=${formatMs(newResult.avg)}  p50=${formatMs(newResult.p50)}  p95=${formatMs(newResult.p95)}`);
  console.log(`\n  ⚡ שיפור: ${improvement}% | מהיר פי ${speedup}`);
}

console.log('\n' + '='.repeat(60));
console.log('✅ Benchmark completed!\n');
