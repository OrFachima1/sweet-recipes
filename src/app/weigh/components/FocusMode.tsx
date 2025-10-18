"use client";

import { useEffect, useState } from "react";
import { formatQty } from "../utils/qtyParser";
import { colorIdxFor, hexToRgba } from "../utils/colorUtils";
import { PALETTE } from "../constants";
import type { AggregatedIngredient } from "../utils/types";

interface FocusModeProps {
  ingredient: AggregatedIngredient;
  index: number;
  total: number;
  weighed: Set<string>;
  onToggleWeighed: (name: string) => void;
  onNavigate: (direction: number) => void;
  onClose: () => void;
  allIngredients: AggregatedIngredient[];
  onJumpToIndex: (index: number) => void;
}

export function FocusMode({
  ingredient,
  index,
  total,
  weighed,
  onToggleWeighed,
  onNavigate,
  onClose,
  allIngredients,
  onJumpToIndex,
}: FocusModeProps) {
  const isWeighed = weighed.has(ingredient.name);
  const progress = total > 0 ? (weighed.size / total) * 100 : 0;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [streak, setStreak] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isLastItem = index === total - 1;
  const willCompleteAll = !isWeighed && weighed.size + 1 === total;

  // Calculate streak
  useEffect(() => {
    let currentStreak = 0;
    for (let i = 0; i <= index; i++) {
      if (weighed.has(allIngredients[i].name)) {
        currentStreak++;
      } else {
        currentStreak = 0;
      }
    }
    setStreak(currentStreak);
  }, [index, weighed, allIngredients]);

  // Auto-open sidebar on desktop
  useEffect(() => {
    if (window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        onNavigate(-1);
      }
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        onNavigate(1);
      }
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleToggle();
      }
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [ingredient.name, onNavigate, onClose]);

  const handleToggle = () => {
    const willComplete = !isWeighed && weighed.size + 1 === total;
    
    if (!isWeighed) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 1000);
      
      // Optional: Play success sound
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBCt9y/LaiyMGHW/A7+OZURE');
        audio.volume = 0.3;
        audio.play().catch(() => {});
      } catch {}
    }
    
    // Disable button during transition
    setIsTransitioning(true);
    
    onToggleWeighed(ingredient.name);
    
    // If this completes everything, show finale and return
    if (willComplete) {
      setTimeout(() => {
        // Show finale celebration
        setShowCelebration(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      }, 300);
    } else if (!isWeighed && index < total - 1) {
      // Auto-advance to next after 600ms
      setTimeout(() => {
        onNavigate(1);
        // Re-enable button after navigation
        setTimeout(() => setIsTransitioning(false), 100);
      }, 600);
    } else {
      // Re-enable immediately if not navigating
      setTimeout(() => setIsTransitioning(false), 100);
    }
  };

  
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex z-[80] overflow-hidden" dir="rtl">
      {/* Floating particles background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 text-4xl opacity-20 animate-float">✨</div>
        <div className="absolute top-32 right-20 text-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }}>🌟</div>
        <div className="absolute bottom-20 left-32 text-5xl opacity-20 animate-float" style={{ animationDelay: '1s' }}>⭐</div>
        <div className="absolute bottom-40 right-40 text-3xl opacity-20 animate-float" style={{ animationDelay: '1.5s' }}>💫</div>
        <div className="absolute top-1/2 left-20 text-4xl opacity-20 animate-float" style={{ animationDelay: '2s' }}>✨</div>
      </div>
      {/* Sidebar Toggle Button - Mobile/Tablet - Adjusted position */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-16 left-4 z-[90] w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all lg:hidden"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Sidebar - Ingredient List */}
      <div className={`
        fixed lg:relative inset-y-0 right-0 w-64 sm:w-72 lg:w-80 bg-white shadow-2xl z-[85]
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        overflow-y-auto flex flex-col
      `}>
        <div className="sticky top-0 bg-gradient-to-br from-purple-500 to-pink-500 text-white p-4 z-10 shadow-lg">
          <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
            <span>📋</span>
            <span>רשימת מרכיבים</span>
          </h3>
          <div className="text-sm opacity-90 mb-1">
            {weighed.size} / {total} שקולים ({Math.round(progress)}%)
          </div>
          
          {/* Score display */}
          <div className="flex items-center gap-2 text-xs mb-2">
            <span className="bg-white/20 px-2 py-1 rounded-full">
              ⚡ ניקוד: {weighed.size * 10}{streak >= 3 ? ` (+${streak * 5} בונוס!)` : ''}
            </span>
          </div>
          
          <div className="mt-2 h-2 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        <div className="flex-1 p-2 space-y-1">
          {allIngredients.map((ing, idx) => {
            const isCurrentlyWeighed = weighed.has(ing.name);
            const isCurrent = idx === index;
            
            return (
              <button
                key={idx}
                onClick={() => {
                  onJumpToIndex(idx);
                  setSidebarOpen(false);
                }}
                className={`
                  w-full text-right p-3 rounded-xl transition-all duration-200
                  ${isCurrent 
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg scale-105' 
                    : isCurrentlyWeighed
                      ? 'bg-green-50 hover:bg-green-100 text-gray-600'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <div className={`
                    w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${isCurrent 
                      ? 'bg-white text-purple-600' 
                      : isCurrentlyWeighed
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }
                  `}>
                    {isCurrentlyWeighed ? '✓' : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`
                      text-sm font-bold truncate
                      ${isCurrent ? 'text-white' : isCurrentlyWeighed ? 'line-through text-gray-500' : 'text-gray-800'}
                    `}>
                      {ing.name}
                    </div>
                    <div className={`
                      text-xs truncate
                      ${isCurrent ? 'text-white/80' : 'text-gray-500'}
                    `}>
                      {formatQty(ing.totalQty)} {ing.unit}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-[84] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Animated Progress Bar */}
        <div className="relative h-3 sm:h-4 bg-white/50 backdrop-blur-sm">
          <div 
            className="absolute inset-y-0 right-0 bg-gradient-to-l from-pink-500 via-purple-500 to-indigo-500 transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-gray-700 drop-shadow-sm">
              {weighed.size} / {total}
            </span>
          </div>
        </div>

        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm shadow-sm p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white shadow hover:shadow-lg transition-all text-xs sm:text-sm font-medium"
            >
              ← חזרה
            </button>
            
            <div className="flex items-center gap-3">
              {/* Streak indicator */}
              {streak >= 3 && (
                <div className="bg-gradient-to-r from-orange-400 to-red-500 text-white px-3 py-1.5 rounded-full shadow-lg text-xs sm:text-sm font-bold animate-pulse flex items-center gap-1">
                  <span>🔥</span>
                  <span>{streak} ברצף!</span>
                </div>
              )}
              
              <div className="text-xs sm:text-sm font-bold text-purple-600 bg-white px-3 py-1.5 rounded-full shadow">
                מרכיב {index + 1} מתוך {total}
              </div>
            </div>
          </div>

          {/* Dynamic encouragement - MOVED HERE */}
          <div className="text-center mt-2">
            {progress < 25 && (
              <div className="text-lg sm:text-xl font-black text-white bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 rounded-full inline-block animate-pulse shadow-lg">
                🚀 בואו נתחיל!
              </div>
            )}
            {progress >= 25 && progress < 50 && (
              <div className="text-lg sm:text-xl font-black text-white bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 rounded-full inline-block animate-pulse shadow-lg">
                💪 יופי! ממשיכים חזק!
              </div>
            )}
            {progress >= 50 && progress < 75 && (
              <div className="text-lg sm:text-xl font-black text-white bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 rounded-full inline-block animate-pulse shadow-lg">
                🔥 באמצע הדרך! אתה מדהים!
              </div>
            )}
            {progress >= 75 && progress < 100 && (
              <div className="text-lg sm:text-xl font-black text-white bg-gradient-to-r from-pink-500 to-purple-500 px-4 py-2 rounded-full inline-block animate-pulse shadow-lg">
                ⭐ כמעט סיימת! עוד קצת!
              </div>
            )}
          </div>
        </div>

        {/* Main Card Area */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-2xl">
            {/* Celebration Animation */}
            {showCelebration && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
                {willCompleteAll ? (
                  // Epic finale animation
                  <div className="relative">
                    <div className="absolute inset-0 animate-ping text-9xl">🎉</div>
                    <div className="absolute inset-0 animate-bounce text-9xl">🎊</div>
                    <div className="text-9xl animate-spin-slow">⭐</div>
                    <div className="absolute top-0 left-0 text-6xl animate-bounce" style={{ animationDelay: '0.1s' }}>🎈</div>
                    <div className="absolute top-0 right-0 text-6xl animate-bounce" style={{ animationDelay: '0.2s' }}>🎈</div>
                    <div className="absolute bottom-0 left-0 text-6xl animate-bounce" style={{ animationDelay: '0.3s' }}>✨</div>
                    <div className="absolute bottom-0 right-0 text-6xl animate-bounce" style={{ animationDelay: '0.4s' }}>✨</div>
                  </div>
                ) : (
                  // Regular celebration
                  <div className="relative">
                    <div className="text-9xl animate-ping absolute inset-0">🎉</div>
                    <div className="text-9xl animate-bounce">🎉</div>
                  </div>
                )}
              </div>
            )}

            {/* Main Ingredient Card */}
            <div className={`
              relative bg-white rounded-3xl shadow-2xl p-6 sm:p-10 text-center
              transform transition-all duration-500
              ${isWeighed ? 'ring-8 ring-green-400 scale-95' : 'hover:scale-105'}
              ${willCompleteAll ? 'ring-8 ring-yellow-400 animate-pulse' : ''}
            `}>
              {/* Special badge for last item */}
              {willCompleteAll && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg animate-bounce">
                  🏆 מרכיב אחרון!
                </div>
              )}
              
              {/* Confetti decoration */}
              {isWeighed && (
                <div className="absolute -top-4 -right-4 text-6xl animate-bounce">
                  ✓
                </div>
              )}

              {/* Emoji/Icon */}
              <div className="mb-4 sm:mb-6">
                <div className={`
                  text-6xl sm:text-8xl transition-all duration-500
                  ${isWeighed ? 'grayscale-0 animate-bounce' : 'grayscale hover:grayscale-0'}
                `}>
                  ⚖️
                </div>
              </div>

              {/* Ingredient Name */}
              <h2 className={`
                text-3xl sm:text-5xl lg:text-6xl font-black mb-4 sm:mb-6 
                bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent
                break-words leading-tight
                ${isWeighed ? 'line-through opacity-50' : ''}
              `}>
                {ingredient.name}
              </h2>

              {/* Quantity Display */}
              <div className="mb-6 sm:mb-10 relative">
                <div className={`
                  text-6xl sm:text-8xl font-black mb-3 transition-all duration-300
                  ${isWeighed ? 'text-gray-300' : 'bg-gradient-to-br from-pink-500 to-purple-600 bg-clip-text text-transparent'}
                `}>
                  {formatQty(ingredient.totalQty)}
                </div>
                <div className={`
                  text-2xl sm:text-4xl font-bold
                  ${isWeighed ? 'text-gray-400' : 'text-purple-500'}
                `}>
                  {ingredient.unit}
                </div>
                
                {/* Decorative line */}
                <div className="mt-4 flex items-center justify-center gap-2">
                  <div className="h-1 w-12 rounded-full bg-gradient-to-r from-transparent via-purple-300 to-transparent" />
                  <div className="text-purple-300">✦</div>
                  <div className="h-1 w-12 rounded-full bg-gradient-to-r from-transparent via-purple-300 to-transparent" />
                </div>
              </div>

              {/* Recipe Breakdown - Always show if has items */}
              {ingredient.items && ingredient.items.length > 0 && (
                <div className="mb-8 space-y-2">
                  <div className="text-xs sm:text-sm font-semibold text-gray-400 mb-3 flex items-center justify-center gap-2">
                    <span>📋</span>
                    <span>פירוט {ingredient.items.length > 1 ? 'לפי מתכונים' : 'מתכון'}</span>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {ingredient.items.map((item: any, idx: number) => {
                      const colorIdx = colorIdxFor(item.recipeTitle);
                      const bgColor = hexToRgba(PALETTE[colorIdx], 0.15);
                      const borderColor = PALETTE[colorIdx];
                      return (
                        <div
                          key={idx}
                          className="px-4 py-2 rounded-xl text-sm sm:text-base font-medium transition-all hover:scale-105 text-right"
                          style={{ 
                            backgroundColor: bgColor,
                            borderRight: `4px solid ${borderColor}`
                          }}
                        >
                          <div>
                            <span className="font-bold">{item.recipeTitle}</span>
                            {item.groupName && (
                              <span className="text-xs text-gray-500"> ({item.groupName})</span>
                            )}
                          </div>
                          <div className="text-sm">
                            {formatQty(item.qty)} {item.unit}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Main Action Button */}
              <button
                onClick={handleToggle}
                disabled={isTransitioning}
                className={`
                  w-full py-5 sm:py-7 rounded-2xl text-xl sm:text-3xl font-black
                  transition-all duration-300 transform hover:scale-105 active:scale-95
                  shadow-xl hover:shadow-2xl relative overflow-hidden
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                  ${isWeighed
                    ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white'
                    : willCompleteAll
                      ? 'bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white animate-pulse'
                      : 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white'
                  }
                `}
              >
                {/* Shine effect */}
                {!isWeighed && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                )}
                
                {isWeighed ? (
                  <span className="flex items-center justify-center gap-3">
                    <span className="text-4xl">✓</span>
                    <span>שקלתי!</span>
                  </span>
                ) : willCompleteAll ? (
                  <span className="flex items-center justify-center gap-3">
                    <span className="text-4xl animate-bounce">🏆</span>
                    <span>סיים שקילה!</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-3">
                    <span className="text-4xl">⚖️</span>
                    <span>סמן כשקול</span>
                  </span>
                )}
              </button>
            </div>

            {/* Navigation Buttons - Always visible and prominent */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-6">
              <button
                onClick={() => onNavigate(-1)}
                disabled={index === 0}
                className="py-4 sm:py-6 rounded-2xl bg-white shadow-xl disabled:opacity-20 disabled:cursor-not-allowed hover:shadow-2xl hover:scale-105 active:scale-95 transition-all font-bold text-base sm:text-xl text-purple-600 flex items-center justify-center gap-2"
              >
                <span className="text-2xl">→</span>
                <span>הקודם</span>
              </button>
              <button
                onClick={() => onNavigate(1)}
                disabled={index === total - 1}
                className="py-4 sm:py-6 rounded-2xl bg-white shadow-xl disabled:opacity-20 disabled:cursor-not-allowed hover:shadow-2xl hover:scale-105 active:scale-95 transition-all font-bold text-base sm:text-xl text-purple-600 flex items-center justify-center gap-2"
              >
                <span>הבא</span>
                <span className="text-2xl">←</span>
              </button>
            </div>

            {/* Keyboard Hints */}
            <div className="text-center mt-4">
              <div className="text-sm sm:text-base text-purple-500 font-medium bg-white/50 px-4 py-2 rounded-lg inline-block">
                💡 חצים/רווח לניווט • ESC לחזרה
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}