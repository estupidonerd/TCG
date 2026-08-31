import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingImprimir() {
  return (
    <main className="min-h-svh px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Skeleton className="h-9 w-32" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[5/7] w-full" />
          ))}
        </div>
      </div>
    </main>
  );
}
