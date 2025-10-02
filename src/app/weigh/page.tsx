import { Suspense } from "react";
import WeighClient from "./weigh-client";

// שלא ינסה לפרה-רנדר סטטי
export const dynamic = "force-dynamic";

export default function WeighPage() {
  return (
    <Suspense fallback={<div className="p-6">טוען מצב שקילה…</div>}>
      <WeighClient />
    </Suspense>
  );
}
