'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { SuperAdminHeader } from '@/components/layout/SuperAdminHeader';
import { Loader2 } from 'lucide-react';

export function DashboardWrapper({ children }: { children: ReactNode }) {
    const user = useAuthStore((state) => state.user);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // SSR fallback to prevent hydration mismatch
    if (!isMounted) {
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

                <div className="p-4 sm:p-8 flex-1 overflow-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
