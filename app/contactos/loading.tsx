import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingContactos() {
  return (
    <main className="min-h-svh px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-11 w-40 rounded-xl" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </main>
  );
}
