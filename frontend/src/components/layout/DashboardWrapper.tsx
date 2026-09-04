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
    const { user, token, login: loginStore, logout } = useAuthStore();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Redirect to login if mounted and no token exists
    useEffect(() => {
        if (isMounted && !token) {
            logout();
            window.location.href = '/login';
        }
    }, [isMounted, token, logout]);

    // Self-healing user query: fetches user profile whenever token is present
    const { data: meData, error: meError, isLoading: isMeLoading } = useQuery({
        queryKey: ['me', token],
        queryFn: fetchMe,
        enabled: isMounted && !!token,
        staleTime: 5 * 60 * 1000,
        retry: 1,
    });

    // Sync user data to Zustand store upon receiving fresh backend profile
    useEffect(() => {
        if (meData && token) {
            const mappedUser = {
                id: meData.id || meData._id,
                _id: meData._id || meData.id,
                name: meData.name,
                role: meData.role,
                stages: meData.stages ?? [],
                teacherId: meData.teacherId ?? null,
                teacherName: meData.teacherName ?? null,
                centerName: meData.centerName,
                logoUrl: meData.logoUrl,
                assistantsAccessEnabled: meData.assistantsAccessEnabled,
                planTier: meData.planTier ?? null,
                features: meData.features ?? { homeworkTracking: false },
            };

            const userId = user?.id || (user as any)?._id;
            const mappedId = mappedUser.id;

            // Update store if user is missing or profile fields changed
            if (
                !user ||
                userId !== mappedId ||
                user.planTier !== mappedUser.planTier ||
                user.name !== mappedUser.name ||
                user.role !== mappedUser.role ||
                user.centerName !== mappedUser.centerName ||
                user.logoUrl !== mappedUser.logoUrl
            ) {
                loginStore(mappedUser as any, token);
            }
        }
    }, [meData, token, user, loginStore]);

    // Handle token error: cleanly logout and redirect to login
    useEffect(() => {
        if (meError) {
            logout();
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }
    }, [meError, logout]);

    // Safety timeout: if token exists but user cannot be loaded, redirect to login
    useEffect(() => {
        if (isMounted && token && !user && !isMeLoading && !meData) {
            const timer = setTimeout(() => {
                logout();
                window.location.href = '/login';
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isMounted, token, user, isMeLoading, meData, logout]);

    // SSR fallback and spinner while session is being loaded or recovered
    if (!isMounted || !user || !token) {
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
        <div className="flex min-h-screen bg-[#f9f9fb] w-full max-w-full overflow-x-hidden">
            <Sidebar />
            
            {/* Main Content Area (offset by sidebar width on large screens) */}
            <main className="flex-1 flex flex-col transition-all duration-300 sm:pr-64 w-full max-w-full min-w-0 overflow-x-hidden">
                <Header />
                <FreeTrialBanner />
                <AnnouncementsBanner />

                <div className="p-4 sm:p-8 flex-1 overflow-x-hidden overflow-y-auto w-full max-w-full min-w-0">
                    {children}
                </div>
            </main>
        </div>
    );
}
