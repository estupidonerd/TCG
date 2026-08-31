import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingCardDetail() {
  return (
    <main className="min-h-svh bg-marca-claro">
      <div className="mx-auto flex max-w-5xl flex-col lg:h-svh lg:flex-row lg:items-stretch">
        <div className="flex flex-col gap-3 p-4 sm:p-6 lg:w-1/2 lg:shrink-0 lg:p-8">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="flex flex-1 items-center justify-center py-2">
            <Skeleton className="aspect-[5/7] w-full max-w-sm" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-4 pb-10 sm:p-6 lg:w-1/2 lg:p-8">
          <Skeleton className="h-10 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </main>
  );
}
