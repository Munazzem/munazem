"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
            <div className="flex flex-col items-center text-center space-y-6 max-w-md">
                <div className="rounded-full bg-red-100 p-6 dark:bg-red-900/20">
                    <WifiOff className="h-12 w-12 text-red-600 dark:text-red-500" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl">
                        أنت غير متصل بالإنترنت
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        يبدو أن هناك مشكلة في اتصالك بالإنترنت. يرجى التحقق من الشبكة والمحاولة مرة أخرى.
                    </p>
                </div>
                <button 
                    onClick={() => window.location.reload()} 
                    className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                    إعادة المحاولة
                </button>
            </div>
        </div>
    );
}
