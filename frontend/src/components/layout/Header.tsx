'use client';

import { useState, useEffect } from 'react';
import { Menu, Bell, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { useUIStore } from '@/lib/store/ui.store';
import { apiClient } from '@/lib/api/axios';

export function Header() {
    const user  = useAuthStore((state) => state.user);
    const login = useAuthStore((state) => state.login);
    const token = useAuthStore((state) => state.token);
    const toggleSidebar = useUIStore((state) => state.toggleSidebar);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);

        // Refresh user profile on every dashboard load so stage/role changes are reflected
        if (token && user) {
            apiClient.get('/auth/me').then((res: any) => {
                const fresh = res?.data ?? res;
                if (fresh?._id || fresh?.id) {
                    // Map DB user to the User type used in the store
                    const mapped = {
                        id:         fresh._id ?? fresh.id,
                        name:       fresh.name,
                        role:       fresh.role,
                        stage:      fresh.stage ?? null,
                        teacherId:  fresh.teacherId ?? null,
                        centerName: fresh.centerName,
                        logoUrl:    fresh.logoUrl,
                    };
                    login(mapped, token);
                }
            }).catch(() => { /* silent fail */ });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!isMounted) {
        return (
            <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between glass-panel border-b border-white/40 px-4 sm:px-6">
                <div className="flex items-center gap-4">
                    <div className="h-8 w-8 bg-gray-200 rounded-lg animate-pulse sm:hidden" />
                    <div className="hidden sm:block h-6 w-48 bg-gray-200 rounded-md animate-pulse" />
                </div>
                <div className="flex items-center gap-4">
                    <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
                    <div className="flex items-center gap-3 border-r border-gray-200 pr-4">
                        <div className="flex flex-col items-end gap-1.5">
                            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                            <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                        </div>
                        <div className="h-9 w-9 rounded-full bg-gray-200 animate-pulse" />
                    </div>
                </div>
            </header>
        );
    }

    return (
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between glass-panel border-b border-white/40 px-4 sm:px-6">
            <div className="flex items-center gap-2 sm:gap-4">
                {/* Mobile Menu Toggle */}
                <button 
                    onClick={toggleSidebar}
                    className="sm:hidden p-2 -mr-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
                >
                    <Menu className="h-6 w-6" />
                </button>

                {/* Logo next to toggle on mobile */}
                <img src="/logo.png" alt="Monazem" className="h-7 w-7 rounded-lg border border-white/50 sm:hidden ml-1" />
                
                <h2 className="text-lg font-bold text-gray-800 hidden sm:flex items-center gap-2">
                    مرحباً بعودتك، {user?.name?.split(' ')[0] || 'أستاذ'}
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                </h2>
            </div>

            <div className="flex items-center gap-4">


                {/* User Profile Snippet */}
                <div className="flex items-center gap-3 border-r border-gray-200/50 pr-4">
                    <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-gray-900">{user?.name || 'مستخدم'}</span>
                        <span className="text-xs text-primary font-medium opacity-80">
                            {user?.role === 'superAdmin' ? 'مدير النظام' : user?.role === 'teacher' ? 'معلم' : user?.role === 'assistant' ? 'مساعد' : 'مستخدم'}
                        </span>
                    </div>
                    <div className="relative">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-blue-400 rounded-full blur opacity-30"></div>
                        <div className="relative h-9 w-9 rounded-full bg-white flex items-center justify-center border border-primary/20 shadow-sm">
                            <span className="text-primary font-bold">{user?.name?.charAt(0) || 'م'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
