'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { SuperAdminHeader } from '@/components/layout/SuperAdminHeader';
import { AnnouncementsBanner } from '@/components/layout/AnnouncementsBanner';
import { FreeTrialBanner } from '@/components/layout/FreeTrialBanner';
import { Loader2 } from 'lucide-react';

import { useQuery } from '@tanstack/react-query';
import { fetchMe } from '@/lib/api/auth';

export function DashboardWrapper({ children }: { children: ReactNode }) {
    const { user, token, login: loginStore } = useAuthStore();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const { data: meData } = useQuery({
        queryKey: ['me', user?.id],
        queryFn: fetchMe,
        enabled: isMounted && !!token && !!user?.id,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (meData && user && token) {
            // Safety check: ensure we don't sync data from a stale cache of another user
            const meId = meData.id || meData._id;
            const userId = user.id || (user as any)._id;
            
            if (meId && userId && meId === userId) {
                // Background sync to ensure planTier and other fields are up to date
                if (meData.planTier !== user.planTier || meData.name !== user.name) {
                    loginStore({ ...user, ...meData }, token);
                }
            }
        }
    }, [meData, user, token, loginStore]);

    // SSR fallback to prevent hydration mismatch or during logout redirect
    if (!isMounted || !user) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[#f9f9fb]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (user?.role === 'superAdmin') {
        // Super Admin Layout: Top Navigation + Centered Main Content
        return (
            <div className="min-h-screen bg-[#f9f9fb] flex flex-col">
                <SuperAdminHeader />
                <AnnouncementsBanner />
                <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        );
    }

    // Default Teacher/Assistant Layout: Sidebar + Header
    return (
        <div className="flex min-h-screen bg-[#f9f9fb]">
            <Sidebar />
            
            {/* Main Content Area (offset by sidebar width on large screens) */}
            <main className="flex-1 flex flex-col transition-all duration-300 sm:pr-64">
                <Header />
                <FreeTrialBanner />
                <AnnouncementsBanner />

                <div className="p-4 sm:p-8 flex-1 overflow-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
