// src/hooks/useOrdersUpload.ts
import { useState, useRef, useCallback } from 'react';
import { ingestStrict } from '@/lib/ordersApi';
import { 
  genId, 
  normalizeImportantNotes, 
  applyMappingOnOrders, 
  getUnknownTitles, 
  fmtYMD 
} from '@/utils/orders';
import type { IngestJsonOrder, NormalizedOrder, NormalizedOrderItem } from '@/types/orders';

interface UseOrdersUploadProps {
  apiBase: string;
  isManager: boolean;
  mapping: Record<string, string>;
  ignored: string[];
  menuOptions: string[];
  getClientColor: (clientName: string) => string;
  ensureClient: (clientName: string, color: string) => Promise<void>;
}

interface ReviewData {
  orders: any[];
  files: File[];
}

export function useOrdersUpload({
  apiBase,
  isManager,
  mapping,
  ignored,
  menuOptions,
  getClientColor,
  ensureClient,
}: UseOrdersUploadProps) {
  // ===== Upload State =====
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ingestBufferRef = useRef<IngestJsonOrder[] | null>(null);

  // ===== Review Modals State =====
  const [showConfirmReview, setShowConfirmReview] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);

  // ===== Unknowns & Mapping =====
  const [mapOpen, setMapOpen] = useState(false);
  const [unknowns, setUnknowns] = useState<string[]>([]);

  // ===== Date Fix Modal =====
  const [dateFixOpen, setDateFixOpen] = useState(false);
  const [dateFixList, setDateFixList] = useState<{ id: string; name: string; date: string }[]>([]);

  // ===== Helper Functions =====
  const hasPendingFiles = useCallback(() => files && files.length > 0, [files]);

  /**
   * Main ingest function - processes files and creates orders
   */
  const doIngest = useCallback(async (
    mappingObj: Record<string, string>,
    skipUnknownCheck: boolean = false,
    dateOverrides?: Record<number, string>
  ) => {
    if (!isManager) {
      alert("אין לך הרשאה לבצע פעולה זו");
      return;
    }

    const data = await ingestStrict(apiBase, files, mappingObj);

    // 1) Normalize
    let normalized: NormalizedOrder[] = (data.orders || []).map((o: any): NormalizedOrder => ({
      __id: o.__id ?? genId(),
      orderId: o.orderId ?? null,
      clientName: o.clientName,
      eventDate: o.eventDate ?? null,
      status: o.status ?? "new",
      items: (o.items || []).map((it: any): NormalizedOrderItem => ({
        title: String(it.title ?? "").trim(),
        qty: Number(it.qty ?? 1),
        notes: typeof it.notes === "string" && it.notes.trim() ? it.notes.trim() : undefined,
        unit: it.unit ?? null,
      })),
      orderNotes: o.orderNotes ?? o.notes ?? null,
      totalSum: o.totalSum ?? null,
      currency: o.currency ?? null,
      source: o.source ?? null,
      meta: o.meta ?? null,
    }));

    // 2) Apply date overrides
    if (dateOverrides) {
      Object.entries(dateOverrides).forEach(([idxStr, newDateStr]) => {
        const idx = parseInt(idxStr, 10);
        if (idx >= 0 && idx < normalized.length && newDateStr) {
          normalized[idx].eventDate = newDateStr;
        }
      });
    }

    // 3) Apply mapping
    normalized = applyMappingOnOrders(normalized, mappingObj);

    // 4) Check for unknowns (unless skipping)
    if (!skipUnknownCheck) {
      const unk = getUnknownTitles(normalized, menuOptions, ignored);
      if (unk.length > 0) {
        setUnknowns(unk);
        ingestBufferRef.current = normalized as any;
        setMapOpen(true);
        return;
      }
    }

    // 5) Filter by menu
    const menuSet = new Set(menuOptions);
    const filtered = normalized
      .map(order => ({
        ...order,
        items: order.items.filter((item) => menuSet.has(item.title))
      }))
      .filter(order => order.items.length > 0);

    // 6) Normalize important notes (map over each order)
    const withNotes = filtered.map(o => normalizeImportantNotes(o));

    // 7) Store in buffer for review
    ingestBufferRef.current = withNotes as any;

    // 8) Prepare review data
    setReviewData({
      orders: withNotes,
      files: files,
    });
    setShowReview(true);
  }, [apiBase, files, isManager, menuOptions, ignored]);

  /**
   * Run preview and then ingest
   * Now accepts previewOrders directly from UploadModal to preserve user edits
   */
  const runPreviewThenIngest = useCallback(async (
    dateOverrides?: Record<number, string>,
    previewOrders?: any[]
  ) => {
    if (!isManager) {
      alert("אין לך הרשאה להעלות קבצים");
      return;
    }
    if (!files.length) return;

    setLoading(true);
    setError(null);

    try {
      // If previewOrders provided, use them directly instead of calling API again
      if (previewOrders && previewOrders.length > 0) {
        // Apply date overrides to previewOrders
        let ordersWithDates = previewOrders.map((o: any, idx: number) => ({
          __id: o.__id ?? genId(),
          orderId: o.orderId ?? null,
          clientName: o.clientName,
          eventDate: dateOverrides?.[idx] || o.eventDate || null,
          status: o.status ?? "new",
          items: (o.items || []).map((it: any): NormalizedOrderItem => ({
            title: String(it.title ?? "").trim(),
            qty: Number(it.qty ?? 1),
            notes: typeof it.notes === "string" && it.notes.trim() ? it.notes.trim() : undefined,
            unit: it.unit ?? null,
          })),
          orderNotes: o.orderNotes ?? o.notes ?? null,
          totalSum: o.totalSum ?? null,
          currency: o.currency ?? null,
          source: o.source ?? null,
          meta: o.meta ?? null,
          // שדות משלוח - שומרים אם קיימים
          deliveryMethod: o.deliveryMethod ?? null,
          estimatedTime: o.estimatedTime ?? null,
          phone1: o.phone1 ?? null,
          phone1Name: o.phone1Name ?? null,
          phone2: o.phone2 ?? null,
          phone2Name: o.phone2Name ?? null,
          address: o.address ?? null,
        }));

        // Apply mapping
        ordersWithDates = applyMappingOnOrders(ordersWithDates, mapping);

        // Check for unknowns
        const unk = getUnknownTitles(ordersWithDates, menuOptions, ignored);
        if (unk.length > 0) {
          setUnknowns(unk);
          ingestBufferRef.current = ordersWithDates as any;
          setMapOpen(true);
          setLoading(false);
          return;
        }

        // Filter by menu
        const menuSet = new Set(menuOptions);
        const filtered = ordersWithDates
          .map(order => ({
            ...order,
            items: order.items.filter((item: any) => menuSet.has(item.title))
          }))
          .filter(order => order.items.length > 0);

        // Normalize notes
        const withNotes = filtered.map(o => normalizeImportantNotes(o));

        // Store and show review
        ingestBufferRef.current = withNotes as any;
        setReviewData({
          orders: withNotes,
          files: files,
        });
        setShowReview(true);
      } else {
        // Fallback to original behavior
        await doIngest({}, false, dateOverrides);
      }
    } catch (e: any) {
      setError(e?.message || "Preview/ingest failed");
    } finally {
      setLoading(false);
    }
  }, [files, isManager, doIngest, mapping, menuOptions, ignored]);

  /**
   * Final step: save orders after review
   */
  const finalizeOrders = useCallback(async (
    finalOrders: any[],
    onPersist: (orders: IngestJsonOrder[]) => Promise<void>,
    currentOrders: IngestJsonOrder[]
  ) => {
    // Ensure all clients exist
    for (const order of finalOrders) {
      const color = order.clientColor || getClientColor(order.clientName);
      await ensureClient(order.clientName, color);
      order.clientColor = color;
    }

    const merged = [...currentOrders, ...finalOrders];
    await onPersist(merged);

    // Check for missing dates
    const missing = finalOrders
      .filter(o => !o.eventDate)
      .map(o => ({ id: o.__id!, name: o.clientName, date: fmtYMD(new Date()) }));

    if (missing.length) {
      setDateFixList(missing);
      setDateFixOpen(true);
    }

    // Cleanup
    setFiles([]);
    setShowConfirmReview(false);
    setShowReview(false);
    setReviewData(null);
    ingestBufferRef.current = null;
  }, [getClientColor, ensureClient]);

  /**
   * Reset upload state
   */
  const resetUpload = useCallback(() => {
    setFiles([]);
    setLoading(false);
    setError(null);
    setShowConfirmReview(false);
    setShowReview(false);
    setReviewData(null);
    ingestBufferRef.current = null;
  }, []);

  return {
    // State
    files,
    loading,
    error,
    showConfirmReview,
    showReview,
    reviewData,
    mapOpen,
    unknowns,
    dateFixOpen,
    dateFixList,
    ingestBufferRef,

    // Setters
    setFiles,
    setShowConfirmReview,
    setShowReview,
    setReviewData,
    setMapOpen,
    setUnknowns,
    setDateFixOpen,
    setDateFixList,

    // Functions
    hasPendingFiles,
    runPreviewThenIngest,
    doIngest,
    finalizeOrders,
    resetUpload,
  };
}