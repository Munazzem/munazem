import { Skeleton } from "@/components/ui/skeleton";

export function StatsSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
                    <div className="space-y-2 flex-1">
                        <Skeleton className="h-8 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                    </div>
                </div>
            ))}
        </div>
    );
}
