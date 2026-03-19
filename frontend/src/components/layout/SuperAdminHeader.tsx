'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { LogOut, LayoutDashboard, Users, CreditCard } from 'lucide-react';
import { Button } from '../ui/button';

export function SuperAdminHeader() {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const pathname = usePathname();
    const router = useRouter();

    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    const navLinks = [
        { name: 'الرئيسية', href: '/dashboard', icon: LayoutDashboard },
        { name: 'المعلمين', href: '/dashboard/users', icon: Users },
        { name: 'الاشتراكات', href: '/dashboard/subscriptions', icon: CreditCard },
    ];

    if (!isMounted) {
        return <header className="h-16 w-full border-b border-gray-100 bg-white" />;
    }

    return (
        <header className="sticky top-0 z-40 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md shadow-sm" dir="rtl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                    
                    {/* Right side: Logo & Navigation */}
                    <div className="flex items-center gap-8">
                        <Link href="/dashboard" className="flex items-center gap-2 group">
                            <img src="/logo.png" alt="مُنظِّم" className="h-9 w-9 rounded-lg border border-gray-100 shadow-sm group-hover:shadow-md transition-all" />
                            <span className="text-xl font-black text-primary hidden sm:block tracking-tight">مُنظِّم <span className="text-gray-400 text-sm font-medium">| الإدارة</span></span>
                        </Link>

                        <nav className="hidden md:flex items-center gap-1">
                            {navLinks.map((link) => {
                                const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
                                const Icon = link.icon;
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                                            isActive 
                                                ? 'bg-primary/10 text-primary' 
                                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {link.name}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Left side: Profile & Logout */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 border-r border-gray-200 pr-4">
                            <div className="flex flex-col items-end">
                                <span className="text-sm font-bold text-gray-900">{user?.name || 'مدير النظام'}</span>
                                <span className="text-xs text-primary font-medium">التحكم الشامل</span>
                            </div>
                            <div className="h-9 w-9 rounded-full bg-linear-to-tr from-primary to-indigo-500 flex items-center justify-center text-white shadow-sm">
                                <span className="font-bold text-sm">{user?.name?.charAt(0) || 'م'}</span>
                            </div>
                        </div>

                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleLogout}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 px-2 sm:px-3"
                            title="تسجيل الخروج"
                        >
                            <LogOut className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">خروج</span>
                        </Button>
                    </div>

                </div>
            </div>

            {/* Mobile Navigation Bar (Bottom of header) */}
            <div className="md:hidden border-t border-gray-100 bg-white">
                <nav className="flex justify-around p-2">
                    {navLinks.map((link) => {
                        const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
                        const Icon = link.icon;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                                    isActive 
                                        ? 'bg-primary/10 text-primary' 
                                        : 'text-gray-500 hover:text-gray-900'
                                }`}
                            >
                                <Icon className="h-5 w-5" />
                                {link.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </header>
    );
}
