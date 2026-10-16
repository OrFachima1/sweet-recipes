export default function CategoryCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow overflow-hidden">
      <div className="h-32 sm:h-36 md:h-40 w-full skeleton-shimmer" />
      <div className="px-3 py-2.5">
        <div className="h-3.5 w-3/4 rounded-full skeleton-shimmer" />
      </div>
    </div>
  );
}
