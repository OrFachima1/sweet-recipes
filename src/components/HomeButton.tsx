"use client";
import Link from "next/link";

export default function HomeButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="מסך הבית"
      className={`fixed left-3 top-3 md:left-4 md:top-4 z-50
                  h-11 w-11 md:h-12 md:w-12 rounded-2xl border shadow
                  bg-white/90 hover:bg-white active:scale-95
                  grid place-items-center backdrop-blur ${className}`}
      // תמיכה ב-notch באייפד/אייפון
      style={{
        paddingLeft: "env(safe-area-inset-left)",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* אייקון בית בקו נקי */}
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-pink-600" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 3l9 7h-2v9a1 1 0 0 1-1 1h-4v-6H10v6H6a1 1 0 0 1-1-1v-9H3l9-7z"
        />
      </svg>
    </Link>
  );
}
