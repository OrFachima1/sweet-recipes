// categoryMapping.ts
let _config: any = null;

export function setCategoryConfig(config: any) {
  _config = config;
}

export function getItemCategory(itemTitle: string): string {
  return _config?.itemMapping?.[itemTitle] || "אחר";
}

export function getCategoryColor(category: string): string {
  return _config?.items?.[category]?.color || "#E5E7EB";
}

export function groupItemsByCategory(items: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};
  items.forEach(item => {
    const category = getItemCategory(item.title);
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(item);
  });
  return grouped;
}

export const CATEGORY_ORDER: string[] = [];

export function getCategoryOrder(): string[] {
  if (!_config) return ["אחר"];
  return Object.entries(_config.items)
    .sort((a: any, b: any) => a[1].order - b[1].order)
    .map(([name]) => name)
    .concat(["אחר"]);
}