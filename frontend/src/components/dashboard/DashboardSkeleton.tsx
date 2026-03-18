'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm h-32 flex flex-col justify-between">
                        <div className="flex justify-between items-center">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-10 w-10 rounded-xl" />
                        </div>
                        <Skeleton className="h-8 w-16 mt-4" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-[320px]">
                    <Skeleton className="h-6 w-48 mb-6" />
                    <Skeleton className="h-[200px] w-full" />
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-[320px]">
                    <Skeleton className="h-6 w-48 mb-6" />
                    <Skeleton className="h-[200px] w-full" />
                </div>
            </div>
        </div>
    );
}
