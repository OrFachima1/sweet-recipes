import { VULGAR } from "../constants";

/**
 * Parse quantity string to number
 * Supports vulgar fractions, regular fractions (1/2), and decimals
 */
export function parseQtyToNumber(raw?: string | null): number | null {
  if (!raw) return null;
  
  let s = String(raw).trim();
  if (!s) return null;
  
  let total = 0;
  let used = false;
  
  // Handle vulgar fractions
  for (const ch of Object.keys(VULGAR)) {
    if (s.includes(ch)) {
      total += VULGAR[ch];
      s = s.replaceAll(ch, " ");
      used = true;
    }
  }
  
  // Handle regular fractions and numbers
  for (const tok of s.split(/\s+/).filter(Boolean)) {
    // Check for fraction format (e.g., "1/2")
    if (/^\d+\/\d+$/.test(tok)) {
      const [a, b] = tok.split("/").map(Number);
      if (b) {
        total += a / b;
        used = true;
        continue;
      }
    }
    
    // Handle decimal numbers (with comma or dot)
    const num = Number(tok.replace(",", "."));
    if (!Number.isNaN(num)) {
      total += num;
      used = true;
      continue;
    }
    
    // If we encounter something we can't parse, return null
    return null;
  }
  
  return used ? total : null;
}

/**
 * Format number as quantity string
 * Rounds to 2 decimal places, or shows integer if whole number
 */
export function formatQty(n: number): string {
  if (Math.abs(n - Math.round(n)) < 1e-9) {
    return String(Math.round(n));
  }
  return String(Math.round(n * 100) / 100);
}