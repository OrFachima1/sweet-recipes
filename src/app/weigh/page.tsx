import { Suspense } from "react";
import WeighClient from "./weigh-client";

export const dynamic = "force-dynamic";        // שלא ינסו לפרה-רנדר סטטי
export const revalidate = 0;                   // אין קאשינג סטטי

export default function WeighPage() {
  return (
    <Suspense fallback={<div className="p-6">טוען מצב שקילה…</div>}>
      <WeighClient />
    </Suspense>
  );
}
