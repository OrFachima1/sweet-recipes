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
  onManualStart?: () => void; // ✅ זה חייב להיות כאן!
}

interface PreviewOrder {
  clientName: string;
  eventDate?: string | null;
  items?: any[];
  orderNotes?: string | string[] | null;
  _fileId?: string;
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
  onManualStart // ✅ קבלת הפרופ
}: UploadModalProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewOrders, setPreviewOrders] = useState<PreviewOrder[]>([]);
  const [dateOverrides, setDateOverrides] = useState<Record<number, string>>({});
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [step, setStep] = useState<'choose' | 'pdf'>('choose');
  const [parsedFilesMap, setParsedFilesMap] = useState<Map<string, PreviewOrder[]>>(new Map());
  const [parsingFiles, setParsingFiles] = useState<Set<string>>(new Set());

  const getFileId = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

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

  useEffect(() => {
    if (files.length === 0) {
      setPreviewOrders([]);
      setDateOverrides({});
      setParseError(null);
      setParsedFilesMap(new Map());
      setParsingFiles(new Set());
      return;
    }

    const currentFileIds = new Set(files.map(getFileId));
    const parsedFileIds = new Set(parsedFilesMap.keys());
    
    const newFiles = files.filter(f => !parsedFileIds.has(getFileId(f)));
    const deletedFileIds = Array.from(parsedFileIds).filter(id => !currentFileIds.has(id));

    if (deletedFileIds.length > 0) {
      setParsedFilesMap(prev => {
        const newMap = new Map(prev);
        deletedFileIds.forEach(id => newMap.delete(id));
        return newMap;
      });
    }

    if (newFiles.length > 0) {
      newFiles.forEach(async (file) => {
        const fileId = getFileId(file);
        setParsingFiles(prev => new Set(prev).add(fileId));
        setParsing(true);
        
        try {
          const result = await ingestStrict(apiBase, [file], {});
          const orders = (result.orders || []).map(order => ({
            ...order,
            _fileId: fileId
          }));
          
          setParsedFilesMap(prev => new Map(prev).set(fileId, orders));
        } catch (e: any) {
          const errorMsg = typeof e?.message === 'string' 
            ? e.message 
            : JSON.stringify(e, null, 2);
          setParseError(errorMsg);
        } finally {
          setParsingFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(fileId);
            return newSet;
          });
        }
      });
    }
  }, [files, apiBase]);

  useEffect(() => {
    const allOrders: PreviewOrder[] = [];
    files.forEach(file => {
      const fileId = getFileId(file);
      const orders = parsedFilesMap.get(fileId);
      if (orders) {
        allOrders.push(...orders);
      }
    });
    setPreviewOrders(allOrders);
    setParsing(parsingFiles.size > 0);
  }, [parsedFilesMap, parsingFiles, files]);

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
    const removedFile = files[index];
    const fileId = getFileId(removedFile);
    
    const ordersToRemove = previewOrders
      .map((order, idx) => order._fileId === fileId ? idx : -1)
      .filter(idx => idx !== -1);
    
    setDateOverrides(prev => {
      const newOverrides: Record<number, string> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const idx = parseInt(key);
        if (!ordersToRemove.includes(idx)) {
          const removedBefore = ordersToRemove.filter(i => i < idx).length;
          newOverrides[idx - removedBefore] = value;
        }
      });
      return newOverrides;
    });
    
    setFiles(files.filter((_, i) => i !== index));
  };

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

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`bg-white w-full rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col transition-all ${
          step === 'choose' ? 'max-w-4xl' : 'max-w-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-5 flex items-center justify-between flex-shrink-0 transition-all ${
          step === 'choose' 
            ? 'bg-gradient-to-l from-rose-400 via-pink-400 to-purple-400' 
            : 'bg-gradient-to-l from-purple-500 to-pink-500'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{step === 'choose' ? '🎯' : '📄'}</span>
            <div>
              <div className="font-bold text-white text-xl">
                {step === 'choose' ? 'הוספת הזמנה' : 'העלאת קבצי PDF'}
              </div>
              <div className="text-white/80 text-sm">
                {step === 'choose' ? 'בחר את הדרך המועדפת עליך' : 'גרור קבצים או לחץ לבחירה'}
              </div>
            </div>
          </div>

          <button
            onClick={() => { 
              setStep('choose'); 
              onClose(); 
            }}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 transition-all flex items-center justify-center text-white text-xl"
          >
            ✕
          </button>
        </div>
        
        {/* בחירה בין PDF לידני - עיצוב מחודש */}
        {step === 'choose' && (
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="text-4xl mb-3">🎯</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">איך תרצה להוסיף הזמנה?</h3>
              <p className="text-gray-500">בחר את הדרך הנוחה לך</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* PDF Option */}
              <button
                onClick={() => {
                  console.log("📄 PDF button clicked");
                  setStep('pdf');
                }}
                className="group relative p-8 rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 hover:border-purple-400 hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
              >
                <div className="text-center space-y-4">
                  {/* Icon */}
                  <div className="text-6xl group-hover:scale-110 transition-transform duration-300">
                    📄
                  </div>
                  
                  {/* Title */}
                  <div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">העלאת PDF</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      העלה קובץ הזמנה מוכן
                      <br />
                      <span className="text-purple-600 font-medium">מהיר ואוטומטי</span>
                    </p>
                  </div>

                  {/* Features */}
                  <div className="space-y-2 pt-4 border-t border-purple-200">
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                      <span className="text-green-500">✓</span>
                      <span>זיהוי אוטומטי של פריטים</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                      <span className="text-green-500">✓</span>
                      <span>חיסכון בזמן</span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-purple-500 font-bold">לחץ להמשך →</span>
                  </div>
                </div>

                {/* Glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-400 opacity-0 group-hover:opacity-10 transition-opacity duration-300 -z-10"></div>
              </button>

              {/* Manual Option */}
              <button
                onClick={() => {
                  console.log("✨ Manual button clicked!");
                  if (onManualStart) {
                    console.log("🚀 Calling onManualStart...");
                    onManualStart();
                  } else {
                    console.error("❌ onManualStart is not defined!");
                    alert("שגיאה: onManualStart לא הוגדר!");
                  }
                  onClose();
                }}
                className="group relative p-8 rounded-2xl border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50 hover:from-rose-100 hover:to-pink-100 hover:border-rose-400 hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
              >
                <div className="text-center space-y-4">
                  {/* Icon */}
                  <div className="text-6xl group-hover:scale-110 transition-transform duration-300">
                    ✨
                  </div>
                  
                  {/* Title */}
                  <div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">הוספה ידנית</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      הקלד הזמנה חדשה
                      <br />
                      <span className="text-rose-600 font-medium">שליטה מלאה</span>
                    </p>
                  </div>

                  {/* Features */}
                  <div className="space-y-2 pt-4 border-t border-rose-200">
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                      <span className="text-green-500">✓</span>
                      <span>אוטומט השלמה ללקוחות</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                      <span className="text-green-500">✓</span>
                      <span>טעינת הזמנות קודמות</span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-rose-500 font-bold">לחץ להמשך →</span>
                  </div>
                </div>

                {/* Glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-400 opacity-0 group-hover:opacity-10 transition-opacity duration-300 -z-10"></div>
              </button>
            </div>

            {/* Helper text */}
            <div className="mt-8 text-center">
              <p className="text-xs text-gray-400">
                💡 טיפ: אם יש לך PDF מוכן - השתמש בהעלאה אוטומטית. אחרת - הוספה ידנית תהיה מהירה ונוחה!
              </p>
            </div>
          </div>
        )}

        {/* תוכן PDF */}
        {step === 'pdf' && (
          <>
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
                    {files.map((file, idx) => {
                      const fileId = getFileId(file);
                      const isParsing = parsingFiles.has(fileId);
                      const isParsed = parsedFilesMap.has(fileId);
                      
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-l from-purple-50 to-pink-50 border border-purple-200"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-2xl flex-shrink-0">
                              {isParsing ? "⏳" : isParsed ? "✅" : "📄"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-800 truncate">{file.name}</div>
                              <div className="text-xs text-gray-500">
                                {formatFileSize(file.size)}
                                {isParsing && <span className="text-purple-600 font-medium mr-2">• מנתח...</span>}
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
                      );
                    })}
                  </div>
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
              {previewOrders.length > 0 && (
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
          </>
        )}
      </div>
    </div>
  );
}