"use client";

import { useState, useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fileToDataUrl, compressForCategory } from "@/utils/imageHelpers";
import { uploadToStorage } from "@/utils/storageUpload";
import { useLongPress } from "@/hooks/useLongPress";
import CategoryCard from "./CategoryCard";

// dnd-kit imports
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Category = {
  key: string;
  label: string;
  count: number;
  imageUrl?: string | null;
  imageDataUrl?: string | null;
  order?: number | null;
  active?: boolean | null;
};

type CategoriesProps = {
  categories: Category[];
  isManager: boolean;
};

// Sortable Item Wrapper
function SortableCategoryItem({
  category,
  isManager,
  isEditing,
  onUploadImage,
  onDelete,
  longPressHandlers,
}: {
  category: Category;
  isManager: boolean;
  isEditing: boolean;
  onUploadImage: (catKey: string, catLabel: string, file: File) => Promise<void>;
  onDelete: () => void;
  longPressHandlers: any;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.key, disabled: !isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isEditing ? 'grab' : 'pointer',
    touchAction: isEditing ? 'none' : 'auto',
    userSelect: isEditing ? 'none' : 'auto',
    WebkitUserSelect: isEditing ? 'none' : 'auto',
    WebkitTouchCallout: isEditing ? 'none' : 'auto',
  } as React.CSSProperties;

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      onContextMenu={(e) => {
        if (isEditing) {
          e.preventDefault();
        }
      }}
    >
      <CategoryCard
        category={category}
        isManager={isManager}
        isEditing={isEditing}
        onUploadImage={onUploadImage}
        onDelete={onDelete}
        longPressHandlers={longPressHandlers}
      />
    </div>
  );
}

export default function Categories({ categories, isManager }: CategoriesProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localOrder, setLocalOrder] = useState<Category[]>(categories);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sensors for touch and mouse
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    })
  );

  // Update local order when categories change from server (but not during editing)
  useEffect(() => {
    if (!isEditing) {
      setLocalOrder(categories);
    }
  }, [categories, isEditing]);

  // Long press to enter edit mode
  const longPressHandlers = useLongPress({
    onLongPress: () => {
      if (isManager) {
        setIsEditing(true);
      }
    },
    delay: 600,
  });

  // Exit edit mode
  async function exitEditMode() {
    setIsEditing(false);
    setActiveId(null);
    // Save order to server
    await updateCategoryOrder(localOrder);
  }

  // העלאת תמונה לקטגוריה — מעלה ל-Firebase Storage ושומר URL
  async function handleUploadImage(catKey: string, catLabel: string, file: File) {
    const dataUrl = await fileToDataUrl(file);
    const compressed = await compressForCategory(dataUrl);
    const imageUrl = await uploadToStorage(compressed, `categories/${catKey}.jpg`);
    await setDoc(
      doc(db, "categories", catKey),
      { key: catKey, name: catLabel, imageUrl, active: true },
      { merge: true }
    );
  }

  // עדכון סדר הקטגוריות
  async function updateCategoryOrder(newOrder: Category[]) {
    const promises = newOrder.map((cat, index) =>
      setDoc(
        doc(db, "categories", cat.key),
        { order: index },
        { merge: true }
      )
    );
    await Promise.all(promises);
  }

  // מחיקת קטגוריה
  async function deleteCategory(catKey: string) {
    if (!confirm("למחוק את הקטגוריה? המתכונים לא יימחקו.")) return;
    await setDoc(
      doc(db, "categories", catKey),
      { active: false },
      { merge: true }
    );
  }

  // Drag handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLocalOrder((items) => {
        const oldIndex = items.findIndex((item) => item.key === active.id);
        const newIndex = items.findIndex((item) => item.key === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }

    setActiveId(null);
  }

  const displayCategories = localOrder.length > 0 ? localOrder : categories;
  const activeCategory = displayCategories.find((cat) => cat.key === activeId);

  return (
    <section className="px-4 py-12">
      <div className="max-w-7xl mx-auto">
        {/* כותרת */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-800">קטגוריות</h2>
        </div>

        {/* תוכן */}
        {displayCategories.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4 opacity-20">📂</div>
            <p className="text-gray-500 text-lg font-medium">עוד אין קטגוריות</p>
            <p className="text-sm text-gray-400 mt-2">הוסף מתכון ראשון כדי להתחיל</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext
              items={displayCategories.map((cat) => cat.key)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {displayCategories.map((cat) => (
                  <SortableCategoryItem
                    key={cat.key}
                    category={cat}
                    isManager={isManager}
                    isEditing={isEditing}
                    onUploadImage={handleUploadImage}
                    onDelete={() => deleteCategory(cat.key)}
                    longPressHandlers={longPressHandlers}
                  />
                ))}
              </div>
            </SortableContext>

            {/* Drag Overlay - shows the dragged item */}
            <DragOverlay>
              {activeCategory ? (
                <div style={{ cursor: 'grabbing' }}>
                  <CategoryCard
                    category={activeCategory}
                    isManager={isManager}
                    isEditing={isEditing}
                    onUploadImage={handleUploadImage}
                    onDelete={() => {}}
                    longPressHandlers={{}}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* הסבר במצב עריכה */}
        {isEditing && isManager && displayCategories.length > 0 && (
          <div className="mt-6 p-4 bg-pink-50 border border-pink-200 rounded-2xl text-center animate-fadeIn">
            <p className="text-sm text-pink-800">
              <strong>מצב עריכה:</strong> גרור קטגוריות כדי לשנות סדר, או לחץ על ✕ כדי למחוק
            </p>
          </div>
        )}
      </div>

      {/* כפתור סיום צף — מחוץ לגריד כדי שלא ייחסם על ידי האנימציה */}
      {isEditing && isManager && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={exitEditMode}
            className="px-8 py-3 rounded-full bg-pink-500 text-white font-bold shadow-xl hover:bg-pink-600 active:scale-95 transition-all"
            style={{ touchAction: 'manipulation' }}
          >
            ✓ סיום
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </section>
  );
}