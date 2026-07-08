'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import { fetchTeacherSubscriptions } from '@/lib/api/subscriptions';
import { AlertCircle, Clock } from 'lucide-react';
import type { ISubscription } from '@/types/subscription.types';

export function FreeTrialBanner() {
    const user = useAuthStore((state) => state.user);
    const [freeTrialSub, setFreeTrialSub] = useState<ISubscription | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || user.role !== 'teacher') {
            setLoading(false);
            return;
        }

        const loadSub = async () => {
            try {
                // Get teacher ID (handles both when user is teacher or assistant)
                const teacherId = user.role === 'teacher' ? user.id : user.teacherId;
                if (!teacherId) return;

                const subscriptions = await fetchTeacherSubscriptions(teacherId);
                const activeTrial = subscriptions.find(sub => 
                    sub.isFreeTrial && 
                    sub.status === 'ACTIVE' && 
                    new Date(sub.endDate) > new Date()
                );
                
                if (activeTrial) {
                    setFreeTrialSub(activeTrial);
                }
            } catch (error) {
                console.error("Failed to check free trial status", error);
            } finally {
                setLoading(false);
            }
        };

        loadSub();
    }, [user]);

    if (loading || !freeTrialSub) return null;

    const endDate = new Date(freeTrialSub.endDate);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 shadow-md border-b border-orange-600">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm font-medium">
                <div className="flex items-center gap-2">
                    <div className="bg-white/20 p-1.5 rounded-full shrink-0">
                        <AlertCircle className="w-4 h-4 text-white" />
                    </div>
                    <span>
                        أنت الآن تستخدم <span className="font-bold underline decoration-white/50">الفترة التجريبية المجانية</span> للنظام.
                    </span>
                </div>
                
                <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full whitespace-nowrap">
                    <Clock className="w-4 h-4" />
                    <span>متبقي <strong className="text-base">{daysLeft}</strong> يوم {daysLeft === 1 ? 'فقط' : 'أيام'}</span>
                </div>
            </div>
        </div>
    );
}
