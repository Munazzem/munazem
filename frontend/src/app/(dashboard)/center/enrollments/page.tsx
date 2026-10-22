'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * BUG-04: Subscriptions page removed from center role.
 * Any direct URL navigation to /center/enrollments redirects immediately to /center.
 */
export default function CenterEnrollmentsPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/center');
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500 gap-3" dir="rtl">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">جاري إعادة التوجيه إلى لوحة تحكم السنتر...</p>
        </div>
    );
}
