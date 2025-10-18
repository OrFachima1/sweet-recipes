import { PALETTE } from "../constants";

/**
 * Normalize string for comparison (lowercase, trimmed)
 */
export function norm(s: string): string {
  return (s || "").trim().toLowerCase();
}

/**
 * Convert hex color to rgba with alpha channel
 */
export function hexToRgba(hex: string, alpha = 1): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `rgba(0, 0, 0, ${alpha})`;
  
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Get consistent color index for a given key
 * Uses simple hash function to ensure same key always gets same color
 */
export function colorIdxFor(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h) + key.charCodeAt(i);
  }
  return Math.abs(h) % PALETTE.length;
}