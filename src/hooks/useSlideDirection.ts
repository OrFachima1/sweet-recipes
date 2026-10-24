import { useState } from 'react';

// כיוון המעבר האחרון של ערך מספרי (חודש, שבוע): 'next' כשגדל, 'prev' כשקטן.
// משמש לאנימציית החלקה בכיוון הנכון.
export function useSlideDirection(value: number): 'next' | 'prev' | null {
  const [prev, setPrev] = useState(value);
  const [dir, setDir] = useState<'next' | 'prev' | null>(null);
  if (value !== prev) {
    setPrev(value);
    setDir(value > prev ? 'next' : 'prev');
  }
  return dir;
}
