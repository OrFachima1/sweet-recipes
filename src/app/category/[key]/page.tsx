"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "../../../lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import HomeButton from "../../../components/HomeButton";
import { ChefHat, Grid3x3, ChevronDown } from "lucide-react";

type Recipe = {
  id: string;
  title: string;
  category: string;
  imageDataUrl?: string | null;
};

export default function CategoryPage() {
  const { key } = useParams<{ key: string }>();
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [showCategoriesMenu, setShowCategoriesMenu] = useState(false);

  useEffect(() => {
    let unsub: any;
    
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        console.log("No user signed in");
        return;
      }
      
      const qCol = query(collection(db, "recipes"), orderBy("createdAt", "desc"));
      unsub = onSnapshot(qCol, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Recipe[];
        setRecipes(list);
        
        const categories = [...new Set(list.map(r => r.category).filter(Boolean))];
        setAllCategories(categories);
      });
    });

    return () => {
      unsub && unsub();
      unsubAuth();
    };
  }, []);

  const list = useMemo(() => {
    const k = decodeURIComponent(key).toLowerCase();
    return recipes.filter((r) => (r.category || "").trim().toLowerCase() === k);
  }, [recipes, key]);

  const title = useMemo(() => decodeURIComponent(key), [key]);

  const otherCategories = useMemo(() => {
    return allCategories.filter(cat => cat.toLowerCase() !== title.toLowerCase());
  }, [allCategories, title]);

  const handleRecipeClick = (recipe: Recipe) => {
    const viewedIds = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
    const filtered = viewedIds.filter((id: string) => id !== recipe.id);
    const updated = [recipe.id, ...filtered].slice(0, 10);
    localStorage.setItem('recentlyViewed', JSON.stringify(updated));
    
    router.push(`/recipes/${recipe.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50/50 via-rose-50/30 to-purple-50/20" dir="rtl" lang="he">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 border-b border-gray-200/80 shadow-sm">
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.back()} 
              className="px-4 py-2 rounded-full bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-colors text-sm font-medium touch-manipulation"
            >
              → חזרה
            </button>
            
            {/* Categories Dropdown */}
            {otherCategories.length > 0 && (
              <div className="relative">
                <button 
                  onClick={() => setShowCategoriesMenu(!showCategoriesMenu)}
                  className="px-4 py-2 rounded-full bg-pink-50 border border-pink-200 text-pink-700 hover:bg-pink-100 transition-colors text-sm font-medium flex items-center gap-2 touch-manipulation"
                >
                  <Grid3x3 className="w-4 h-4" />
                  קטגוריות
                  <ChevronDown className={`w-4 h-4 transition-transform ${showCategoriesMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {/* Dropdown Menu */}
                {showCategoriesMenu && (
                  <>
                    {/* Backdrop */}
                    <div 
                      className="fixed inset-0 z-40"
                      onClick={() => setShowCategoriesMenu(false)}
                    />
                    
                    {/* Menu */}
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-200 py-2 z-50 max-h-96 overflow-y-auto">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-xs font-semibold text-gray-500">עבור לקטגוריה</p>
                      </div>
                      {otherCategories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => {
                            router.push(`/category/${encodeURIComponent(cat)}`);
                            setShowCategoriesMenu(false);
                          }}
                          className="w-full px-4 py-3 text-right text-sm text-gray-700 hover:bg-pink-50 hover:text-pink-600 transition-colors flex items-center gap-2 touch-manipulation"
                        >
                          <span className="text-lg">🍽️</span>
                          {cat}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          
          <div className="flex-1" />
          <HomeButton />
        </div>
      </div>

      {/* Hero Section - Category Title */}
      <div className="relative py-8 md:py-16 px-4 overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-10 right-1/4 w-64 h-64 bg-pink-300 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-1/4 w-64 h-64 bg-purple-300 rounded-full blur-3xl" />
        </div>
        
        <div className="relative max-w-4xl mx-auto text-center space-y-4">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 bg-clip-text text-transparent leading-tight">
            {title}
          </h1>
          
          <p className="text-gray-600 text-lg">
            {list.length} {list.length === 1 ? 'מתכון' : 'מתכונים'}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-12">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center shadow-lg">
              <span className="text-5xl">🍽️</span>
            </div>
            <div className="text-xl text-gray-600 font-medium">אין מתכונים בקטגוריה הזאת (עדיין)</div>
            <div className="text-sm text-gray-500">בקרוב יתווספו מתכונים מדהימים!</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {list.map((recipe) => (
              <article
                key={recipe.id}
                className="group cursor-pointer"
                onClick={() => handleRecipeClick(recipe)}
                onMouseEnter={() => setHoveredId(recipe.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-200 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-pink-100/50 hover:border-pink-200 active:scale-[0.98]">
                  {/* Image */}
                  <div className="relative h-40 md:h-56 overflow-hidden bg-gradient-to-br from-pink-50 to-purple-50">
                    {recipe.imageDataUrl ? (
                      <>
                        <img
                          src={recipe.imageDataUrl}
                          alt={recipe.title}
                          className="w-full h-full object-cover transition-transform duration-500"
                          style={{
                            transform: hoveredId === recipe.id ? 'scale(1.1)' : 'scale(1)'
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl md:text-7xl">
                        🍽️
                      </div>
                    )}
                    
                    {/* Hover Icon Overlay */}
                    <div 
                      className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
                      style={{ opacity: hoveredId === recipe.id ? 1 : 0 }}
                    >
                      <div className="w-16 h-16 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-2xl transform transition-transform duration-300"
                           style={{ transform: hoveredId === recipe.id ? 'scale(1)' : 'scale(0.8)' }}>
                        <ChefHat className="w-8 h-8 text-pink-500" />
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 md:p-5">
                    {/* Title with decorative line */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-5 md:h-6 bg-gradient-to-b from-pink-400 to-rose-400 rounded-full" />
                        <h3 className="font-bold text-sm md:text-lg text-gray-800 line-clamp-2 flex-1 group-hover:text-pink-600 transition-colors">
                          {recipe.title}
                        </h3>
                      </div>
                      
                      {/* Decorative bottom line */}
                      <div className="w-10 md:w-12 h-0.5 bg-gradient-to-r from-pink-400 to-transparent rounded-full" />
                    </div>
                  </div>

                  {/* Bottom gradient accent */}
                  <div className="h-1 bg-gradient-to-r from-pink-400 via-rose-400 to-purple-400" />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}