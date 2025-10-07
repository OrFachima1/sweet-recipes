"use client";
import React, { useRef } from "react";

interface UploadModalProps {
  show: boolean;
  onClose: () => void;
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  error: string | null;
  loading: boolean;
  onRunPreview: () => Promise<void>;
}

export default function UploadModal({
  show,
  onClose,
  files,
  setFiles,
  error,
  loading,
  onRunPreview,
}: UploadModalProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onPickPdfs = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files ? Array.from(e.target.files) : []);
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-2xl overflow-hidden border border-sky-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-sky-200 flex items-center justify-between">
          <div className="font-semibold text-sky-800">העלאת PDF והוספה ללוח</div>
          <button onClick={onClose} className="text-sky-600 hover:text-sky-800">✕</button>
        </div>

        <div className="p-4 space-y-3">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="application/pdf"
            className="hidden"
            onChange={onPickPdfs}
          />

          <button
            onClick={() => fileRef.current?.click()}
            className="w-full px-3 py-2 rounded-xl bg-sky-600 text-white hover:bg-sky-700"
          >
            בחר קובץ/קבצים
          </button>

          {files.length > 0 && (
            <div className="text-xs text-sky-700">נבחרו {files.length} קבצים</div>
          )}

          {error && (
            <pre className="text-sky-600 text-xs whitespace-pre-wrap">{error}</pre>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              className="px-3 py-2 rounded-xl bg-white border border-sky-200 hover:bg-sky-50"
              onClick={onClose}
            >
              ביטול
            </button>
            <button
              disabled={!files.length || loading}
              onClick={onRunPreview}
              className="px-3 py-2 rounded-xl bg-sky-600 text-white disabled:opacity-40 hover:bg-sky-700"
            >
              {loading ? "מעבד…" : "העלה והמשך"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
