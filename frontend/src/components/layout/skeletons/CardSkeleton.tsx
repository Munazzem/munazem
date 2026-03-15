import { Skeleton } from "@/components/ui/skeleton";

interface CardSkeletonProps {
    count?: number;
    className?: string;
}

export function CardSkeleton({ count = 8, className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" }: CardSkeletonProps) {
    return (
        <div className={className}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4 h-32">
                    <div className="flex justify-between items-center">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-10 rounded-xl" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                </div>
            ))}
        </div>
    );
}
