import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
    rows?: number;
    columns?: number;
}

export function TableSkeleton({ rows = 6, columns = 5 }: TableSkeletonProps) {
    return (
        <div className="w-full space-y-4">
            {/* Header */}
            <div className="flex items-center space-x-4 space-x-reverse py-2 border-b border-gray-100">
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={i} className="h-6 flex-1" />
                ))}
            </div>
            {/* Rows */}
            <div className="space-y-3">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 space-x-reverse py-4 border-b border-gray-50/50 last:border-0">
                        {Array.from({ length: columns }).map((_, j) => (
                            <Skeleton key={j} className="h-4 flex-1" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
