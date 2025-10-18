"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

type CategoryCardProps = {
  category: {
    key: string;
    label: string;
    count: number;
    imageDataUrl?: string | null;
  };
  isManager: boolean;
  isEditing: boolean;
  onUploadImage: (catKey: string, catLabel: string, file: File) => Promise<void>;
  onDelete?: () => void;
  longPressHandlers: any;
};

export default function CategoryCard({
  category,
  isManager,
  isEditing,
  onUploadImage,
  onDelete,
  longPressHandlers,
}: CategoryCardProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await onUploadImage(category.key, category.label, file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function triggerUpload(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    fileInputRef.current?.click();
  }

  function handleClick() {
    if (!isEditing) {
      router.push(`/category/${encodeURIComponent(category.key)}`);
    }
  }

  return (
    <div 
      className={`relative group ${isEditing ? 'jiggle' : ''}`}
      {...longPressHandlers}
    >
      {/* כרטיס קטגוריה */}
      <div
        className={`
          relative overflow-hidden rounded-3xl bg-white border text-right
          shadow transition duration-200 ease-out
          ${isEditing 
            ? 'border-pink-300 shadow-lg scale-[0.98]' 
            : 'hover:shadow-xl hover:-translate-y-0.5 hover:border-pink-300'
          }
        `}
        onClick={handleClick}
        style={{ cursor: isEditing ? 'default' : 'pointer' }}
      >
        <div className="pointer-events-none absolute inset-0 bg-pink-400/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        {/* תמונה */}
        <div className="h-32 sm:h-36 md:h-40 w-full bg-white flex items-center justify-center p-3 relative">
          {category.imageDataUrl ? (
            <img
              src={category.imageDataUrl}
              alt=""
              className="max-h-full max-w-full object-contain transition-transform duration-200 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="text-4xl font-bold text-gray-300">
              {category.label.charAt(0)}
            </div>
          )}
          
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
          
          {/* כיתוב על התמונה */}
          <div className="absolute inset-x-0 bottom-0 px-3 py-2.5 flex items-center justify-between pointer-events-none">
            <div className="font-bold truncate text-gray-800 text-sm flex-1">{category.label}</div>
            <div className="text-xs text-gray-500 mr-2">{category.count}</div>
          </div>
        </div>

        {/* כפתור העלאת תמונה */}
        {isManager && !isEditing && (
          <>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={triggerUpload}
              className="absolute top-2 right-2 z-10 inline-flex items-center justify-center h-8 w-8 rounded-full bg-white/90 border shadow hover:bg-white opacity-0 group-hover:opacity-100 transition-all"
              aria-label="העלה תמונה"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-pink-600" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M9 3l1.5 2H14l1.5-2H18a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h3zm3 14a4 4 0 100-8 4 4 0 000 8z"
                />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* כפתור מחיקה במצב עריכה */}
      {isEditing && isManager && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-2 -left-2 z-20 w-7 h-7 rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 hover:scale-110 flex items-center justify-center transition-all"
          aria-label="מחק קטגוריה"
        >
          <span className="text-sm font-bold">✕</span>
        </button>
      )}

      <style jsx>{`
        @keyframes jiggle {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(-1deg) scale(0.98); }
          50% { transform: rotate(0deg) scale(0.98); }
          75% { transform: rotate(1deg) scale(0.98); }
          100% { transform: rotate(0deg); }
        }

        .jiggle {
          animation: jiggle 0.25s ease-in-out infinite;
          transform-origin: center center;
        }
      `}</style>
    </div>
  );
}