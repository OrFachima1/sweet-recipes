// src/components/LoadingScreen.tsx
"use client";

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div className="w-full h-full flex items-center justify-center p-4">
        {/* וידאו טעינה - מקסימום גודל */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="max-w-full max-h-full object-contain"
        >
          <source src="/loading.mov" type="video/mp4" />
        </video>
      </div>
    </div>
  );
}