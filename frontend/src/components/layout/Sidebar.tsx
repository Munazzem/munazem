'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
    LayoutDashboard, 
    Users, 
    CalendarCheck, 
    BookOpen, 
    Wallet, 
    Settings,
    LogOut,
    GraduationCap // Added GraduationCap icon
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { useUIStore } from '@/lib/store/ui.store';

const getNavItems = (role?: string) => {
    if (role === 'superAdmin') {
        return [
            { name: 'الرئيسية', href: '/dashboard', icon: LayoutDashboard },
            { name: 'الاشتراكات والخطط', href: '/dashboard/subscriptions', icon: BookOpen },
            { name: 'إدارة المعلمين', href: '/dashboard/users', icon: Users },
            { name: 'الإعدادات', href: '/dashboard/settings', icon: Settings },
        ];
    }
    
    // Default for teachers and assistants
   const teacherLinks = [
    { name: 'لوحة التحكم', href: '/dashboard', icon: LayoutDashboard },
    { name: 'المجموعات الدراسية', href: '/groups', icon: GraduationCap },
    { name: 'إدارة الطلاب', href: '/students', icon: Users },
        { name: 'المجموعات', href: '/groups', icon: GraduationCap },
        { name: 'الحصص والغياب', href: '/sessions', icon: CalendarCheck },
        { name: 'الماليات', href: '/dashboard/payments', icon: Wallet },
        { name: 'المتجر والمذكرات', href: '/dashboard/notebooks', icon: BookOpen },
        { name: 'الإعدادات', href: '/dashboard/settings', icon: Settings },
    ];
    return teacherLinks;
};

export function Sidebar() {
    const pathname = usePathname();
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const { isSidebarOpen, setSidebarOpen } = useUIStore();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line
        setIsMounted(true);
    }, []);

    const navItems = getNavItems(user?.role);

    const handleLogout = () => {
        logout();
        window.location.href = '/login'; // Force full reload to clear all states
    };

    if (!isMounted) {
        return (
            <aside className="hidden sm:flex fixed right-0 top-0 z-40 h-screen w-64 bg-white border-l border-gray-100 shadow-sm flex-col">
                <div className="flex h-16 items-center justify-center border-b border-gray-100 px-6">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse" />
                        <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
                    </div>
                </div>
                <div className="flex-1 py-4 px-3 space-y-2 mt-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-10 w-full bg-gray-50 rounded-lg animate-pulse" />
                    ))}
                </div>
            </aside>
        );
    }

    return (
        <>
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm sm:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            
            <aside 
                className={cn(
                    "fixed right-0 top-0 z-40 h-screen w-64 bg-white border-l border-gray-100 shadow-sm flex flex-col transition-transform duration-300 ease-in-out sm:translate-x-0",
                    isSidebarOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                {/* Logo Area */}
            <div className="flex h-16 items-center justify-center border-b border-gray-100 px-6">
                <Link href="/dashboard" className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-xl">م</span>
                    </div>
                    <span className="text-xl font-extrabold text-primary tracking-tight">مُنظِّم</span>
                </Link>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                isActive 
                                    ? "bg-primary/5 text-primary" 
                                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                            )}
                            onClick={() => setSidebarOpen(false)}
                        >
                            <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-gray-400")} />
                            {item.name}
                        </Link>
                    );
                })}
            </div>

            {/* Bottom Actions */}
            <div className="border-t border-gray-100 p-4">
                <button 
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                    <LogOut className="h-5 w-5" />
                    تسجيل الخروج
                </button>
            </div>
            </aside>
        </>
    );
}
