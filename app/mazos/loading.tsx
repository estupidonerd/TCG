import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingMazos() {
  return (
    <main className="min-h-svh px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-11 w-36 rounded-xl" />
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </main>
  );
}
