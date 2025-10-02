"use client";
import React, { useState, useCallback } from "react";

export default function AutoFitImage({
  src,
  height,
  className = "",
}: {
  src: string;
  height: number;         // גובה המסגרת בפיקסלים
  className?: string;
}) {
  const [ratio, setRatio] = useState<number | null>(null);

  const onLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setRatio(img.naturalWidth / img.naturalHeight);
    }
  }, []);

  // אם עדיין לא ידוע היחס, מציגים רק גובה. אחרי onLoad נוסיף aspect-ratio והרוחב יתאים לתמונה.
  const style: React.CSSProperties = ratio
    ? { height, aspectRatio: String(ratio) }
    : { height };

  return (
    <div
      className={`inline-block max-w-full bg-neutral-100 overflow-hidden rounded-2xl shadow ${className}`}
      style={style}
    >
      <img
        src={src}
        alt=""
        onLoad={onLoad}
        className="w-full h-full object-contain object-center"
      />
    </div>
  );
}
