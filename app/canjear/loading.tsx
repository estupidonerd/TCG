import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingCanjear() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-6 py-12">
      <Skeleton className="h-9 w-48" />
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-40 rounded-xl" />
      </div>
    </main>
  );
}
