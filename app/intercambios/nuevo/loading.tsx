import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingNuevoIntercambio() {
  return (
    <main className="min-h-svh px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-6 w-full max-w-sm" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[5/7] w-full" />
          ))}
        </div>
      </div>
    </main>
  );
}
