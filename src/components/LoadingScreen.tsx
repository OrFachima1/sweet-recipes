// src/components/LoadingScreen.tsx
"use client";
import { useEffect, useState } from 'react';

export default function LoadingScreen() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center z-50">
      <div className="flex flex-col items-center animate-fade-in">
        {/* וידאו טעינה */}
        <div className="relative w-72 h-72 mb-6">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-contain"
          >
            <source src="/loading.mov" type="video/mp4" />
          </video>
        </div>

        {/* כותרת */}
        <h1 className="text-4xl font-bold text-white mb-4 tracking-wider">
          Workout Tracker
        </h1>

        {/* אנימציית נקודות */}
        <div className="text-xl text-purple-400 font-semibold min-w-[100px] text-center">
          טוען{dots}
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}