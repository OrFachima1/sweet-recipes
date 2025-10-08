"use client";
import React, { useRef, useState } from "react";

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
  const [isDragging, setIsDragging] = useState(false);

  const onPickPdfs = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files ? Array.from(e.target.files) : []);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf"
    );
    setFiles(droppedFiles);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-l from-purple-500 to-pink-500 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📄</span>
            <div>
              <div className="font-bold text-white text-xl">העלאת קבצי PDF</div>
              <div className="text-white/80 text-sm">גרור קבצים או לחץ לבחירה</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 transition-all flex items-center justify-center text-white text-xl"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Hidden input */}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="application/pdf"
            className="hidden"
            onChange={onPickPdfs}
          />

          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer
              ${isDragging 
                ? "border-purple-500 bg-purple-50 scale-[1.02]" 
                : "border-gray-300 hover:border-purple-400 hover:bg-gray-50"
              }
            `}
          >
            <div className="text-center space-y-3">
              <div className="text-6xl">
                {isDragging ? "📂" : "📁"}
              </div>
              <div>
                <div className="font-bold text-gray-700 text-lg">
                  גרור קבצים לכאן
                </div>
                <div className="text-gray-500 text-sm mt-1">
                  או לחץ לבחירת קבצים ידנית
                </div>
              </div>
              <div className="text-xs text-gray-400">
                נתמך: קבצי PDF בלבד
              </div>
            </div>
          </div>

          {/* Selected Files List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="font-semibold text-gray-700 flex items-center gap-2">
                <span className="text-lg">📋</span>
                <span>קבצים נבחרים ({files.length})</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-l from-purple-50 to-pink-50 border border-purple-200 animate-in slide-in-from-top duration-200"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-2xl flex-shrink-0">📄</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 truncate">
                          {file.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(idx)}
                      className="w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all flex-shrink-0"
                      title="הסר קובץ"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 animate-in slide-in-from-top duration-200">
              <div className="flex items-start gap-2">
                <span className="text-xl">⚠️</span>
                <div className="flex-1">
                  <div className="font-semibold text-red-800 mb-1">שגיאה</div>
                  <pre className="text-red-600 text-sm whitespace-pre-wrap font-mono">
                    {error}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all"
              onClick={onClose}
            >
              ביטול
            </button>
            <button
              disabled={!files.length || loading}
              onClick={onRunPreview}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-purple-500 to-pink-500 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>מעבד...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>העלה והמשך</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}