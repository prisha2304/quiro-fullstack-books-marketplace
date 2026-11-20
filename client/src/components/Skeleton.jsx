const BookCardSkeleton = () => {
  return (
    <div className="bg-white border border-[#DCE2E8] rounded-xl overflow-hidden flex flex-col h-full animate-pulse text-left">
      <div className="aspect-[2/3] bg-stone-100/80 w-full" />
      <div className="p-3 sm:p-3.5 flex flex-col flex-grow justify-between gap-3">
        <div className="space-y-1.5">
          <div className="h-2.5 bg-stone-200 rounded w-1/3" />
          <div className="h-3.5 bg-stone-200 rounded w-3/4" />
          <div className="h-2.5 bg-stone-100 rounded w-1/2" />
        </div>
        <div className="h-6 bg-stone-100 rounded-md" />
        <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
          <div className="h-4 bg-stone-200 rounded w-16" />
          <div className="h-7 w-7 bg-stone-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export { BookCardSkeleton };
