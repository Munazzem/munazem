import { Skeleton } from "@/components/ui/skeleton";

export function ReportCardSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden space-y-4 p-5 animate-pulse">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <Skeleton className="h-14 w-14 rounded-2xl shrink-0" />
                    <div className="space-y-2 flex-1 sm:w-40">
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                </div>
                <Skeleton className="h-10 w-28 rounded-lg shrink-0" />
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
            </div>
            
            <div className="space-y-3 mt-6">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
            </div>
        </div>
    );
}
