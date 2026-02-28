'use client';

import { Menu, Bell, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { useUIStore } from '@/lib/store/ui.store';

export function Header() {
    const user = useAuthStore((state) => state.user);
    const toggleSidebar = useUIStore((state) => state.toggleSidebar);

    return (
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-md px-4 sm:px-6">
            <div className="flex items-center gap-4">
                {/* Mobile Menu Toggle */}
                <button 
                    onClick={toggleSidebar}
                    className="sm:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
                >
                    <Menu className="h-6 w-6" />
                </button>
                
                <h2 className="text-lg font-bold text-gray-800 hidden sm:flex items-center gap-2">
                    مرحباً بعودتك، {user?.name?.split(' ')[0] || 'أستاذ'}
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                </h2>
            </div>

            <div className="flex items-center gap-4">
                {/* Notifications Button */}
                <button className="relative p-2 text-gray-500 hover:bg-gray-50 rounded-full transition-colors">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                </button>

                {/* User Profile Snippet */}
                <div className="flex items-center gap-3 border-r border-gray-200 pr-4">
                    <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-gray-900">{user?.name || 'مستخدم'}</span>
                        <span className="text-xs text-primary font-medium">
                            {user?.role === 'SUPER_ADMIN' ? 'مدير النظام' : user?.role === 'TEACHER' ? 'معلم' : user?.role === 'ASSISTANT' ? 'مساعد' : 'مستخدم'}
                        </span>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                        <span className="text-primary font-bold">{user?.name?.charAt(0) || 'م'}</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
