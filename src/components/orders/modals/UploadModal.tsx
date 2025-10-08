"use client";
import React, { useRef, useState, useEffect } from "react";
import { ingestStrict } from "@/lib/ordersApi";

interface UploadModalProps {
  show: boolean;
  onClose: () => void;
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  error: string | null;
  loading: boolean;
  onRunPreview: (dateOverrides?: Record<number, string>) => Promise<void>;
  apiBase?: string;
}

interface PreviewOrder {
  clientName: string;
  eventDate?: string | null;
  items?: any[];
  orderNotes?: string | string[] | null;
}

export default function UploadModal({
  show,
  onClose,
  files,
  setFiles,
  error,
  loading,
  onRunPreview,
  apiBase = "http://127.0.0.1:8000",
}: UploadModalProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewOrders, setPreviewOrders] = useState<PreviewOrder[]>([]);
  const [dateOverrides, setDateOverrides] = useState<Record<number, string>>({});
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // =====================
  // Helper Functions
  // =====================
  
  const normalizeDate = (dateStr: string | null | undefined): string | null => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0];
    } catch {
      return null;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDateDisplay = (dateStr: string | null | undefined) => {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

  // =====================
  // Parse אוטומטי כשיש קבצים
  // =====================
  
  useEffect(() => {
    if (files.length === 0) {
      setPreviewOrders([]);
      setDateOverrides({});
      setParseError(null);
      return;
    }

    let cancelled = false;

    (async () => {
      setParsing(true);
      setParseError(null);
      try {
        const result = await ingestStrict(apiBase, files, {});
        if (!cancelled) {
          setPreviewOrders(result.orders || []);
        }
      } catch (e: any) {
        if (!cancelled) {
          const errorMsg = typeof e?.message === 'string' 
            ? e.message 
            : JSON.stringify(e, null, 2);
          setParseError(errorMsg);
        }
      } finally {
        if (!cancelled) {
          setParsing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [files, apiBase]);

  // =====================
  // File Handlers
  // =====================
  
  const onPickPdfs = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = e.target.files ? Array.from(e.target.files) : [];
    setFiles(prev => [...prev, ...newFiles]);
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
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  // =====================
  // Order Date Handlers
  // =====================
  
  const updateOrderDate = (orderIndex: number, date: string) => {
    setDateOverrides(prev => ({ ...prev, [orderIndex]: date }));
  };

  const handleSubmit = async () => {
    await onRunPreview(dateOverrides);
  };

  const hasMissingDates = previewOrders.some((order, idx) => {
    const normalizedOriginalDate = normalizeDate(order.eventDate);
    return !normalizedOriginalDate && !dateOverrides[idx];
  });

  // =====================
  // Render
  // =====================
  
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-l from-purple-500 to-pink-500 px-6 py-5 flex items-center justify-between flex-shrink-0">
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

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="application/pdf"
            className="hidden"
            onChange={onPickPdfs}
          />

          {/* Drag & Drop Zone */}
          {files.length === 0 && (
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
                <div className="text-6xl">{isDragging ? "📂" : "📁"}</div>
                <div>
                  <div className="font-bold text-gray-700 text-lg">גרור קבצים לכאן</div>
                  <div className="text-gray-500 text-sm mt-1">או לחץ לבחירת קבצים ידנית</div>
                </div>
                <div className="text-xs text-gray-400">נתמך: קבצי PDF בלבד</div>
              </div>
            </div>
          )}

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="font-semibold text-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  <span>קבצים נבחרים ({files.length})</span>
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-sm px-3 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium transition-all"
                >
                  + הוסף עוד
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-l from-purple-50 to-pink-50 border border-purple-200"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-2xl flex-shrink-0">📄</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 truncate">{file.name}</div>
                        <div className="text-xs text-gray-500">{formatFileSize(file.size)}</div>
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

          {/* Parsing Loader */}
          {parsing && (
            <div className="flex items-center justify-center gap-3 p-8 rounded-2xl bg-purple-50 border-2 border-purple-200">
              <span className="text-3xl animate-spin">⏳</span>
              <span className="font-semibold text-purple-700">מנתח קבצים...</span>
            </div>
          )}

          {/* Parse Error */}
          {parseError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200">
              <div className="flex items-start gap-2">
                <span className="text-xl">⚠️</span>
                <div className="flex-1">
                  <div className="font-semibold text-red-800 mb-1">שגיאה בניתוח</div>
                  <pre className="text-red-600 text-sm whitespace-pre-wrap font-mono">{parseError}</pre>
                </div>
              </div>
            </div>
          )}

          {/* Preview Orders */}
          {!parsing && previewOrders.length > 0 && (
            <div className="space-y-3">
              <div className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                <span className="text-2xl">✨</span>
                <span>נמצאו {previewOrders.length} הזמנות:</span>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {previewOrders.map((order, idx) => {
                  const normalizedOriginalDate = normalizeDate(order.eventDate);
                  const hasOriginalDate = !!normalizedOriginalDate;
                  const needsDate = !hasOriginalDate && !dateOverrides[idx];

                  return (
                    <div
                      key={idx}
                      className={`
                        p-4 rounded-2xl border-2 transition-all
                        ${needsDate 
                          ? "bg-amber-50 border-amber-300 shadow-md" 
                          : "bg-gradient-to-l from-green-50 to-emerald-50 border-emerald-200"
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0">{idx + 1}.</span>
                        <div className="flex-1 space-y-2">
                          <div className="font-bold text-gray-800 text-lg">{order.clientName}</div>
                          
                          {hasOriginalDate ? (
                            <div className="flex items-center gap-2 text-emerald-700">
                              <span className="text-lg">📅</span>
                              <span className="font-medium">{formatDateDisplay(order.eventDate)}</span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-amber-600 font-medium text-sm">⚠️ בחר תאריך:</span>
                                <input
                                  type="date"
                                  className="px-3 py-2 rounded-lg border-2 border-amber-300 focus:border-amber-500 focus:outline-none font-medium bg-white"
                                  onChange={(e) => updateOrderDate(idx, e.target.value)}
                                  value={dateOverrides[idx] || ""}
                                />
                              </div>
                              
                              {dateOverrides[idx] && (
                                <div className="text-sm text-emerald-700 font-medium mr-6">
                                  ✓ {formatDateDisplay(dateOverrides[idx])}
                                </div>
                              )}
                            </div>
                          )}

                          {order.items && order.items.length > 0 && (
                            <div className="text-xs text-gray-500">{order.items.length} פריטים</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasMissingDates && (
                <div className="p-3 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 text-sm flex items-center gap-2">
                  <span>⚠️</span>
                  <span className="font-medium">יש להשלים את כל התאריכים לפני המשך</span>
                </div>
              )}
            </div>
          )}

          {/* Upload Error */}
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200">
              <div className="flex items-start gap-2">
                <span className="text-xl">⚠️</span>
                <div className="flex-1">
                  <div className="font-semibold text-red-800 mb-1">שגיאה בהעלאה</div>
                  <pre className="text-red-600 text-sm whitespace-pre-wrap font-mono">{error}</pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 flex-shrink-0">
          <button
            className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all"
            onClick={onClose}
          >
            ביטול
          </button>
          <button
            disabled={!files.length || loading || parsing || hasMissingDates}
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-purple-500 to-pink-500 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>מעלה...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>אישור והעלה ({previewOrders.length})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}