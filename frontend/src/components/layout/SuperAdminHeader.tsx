'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import {
    LogOut,
    LayoutDashboard,
    Activity,
    Users,
    Settings,
    Bot,
    FileText,
    Menu,
    X,
} from 'lucide-react';
import { Button } from '../ui/button';

export function SuperAdminHeader() {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const pathname = usePathname();
    const router = useRouter();

    const [isMounted, setIsMounted] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Close mobile menu on page navigation
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    const navLinks = [
        { name: 'لوحة التحكم',     href: '/admin',                   icon: LayoutDashboard },
        { name: 'العملاء',         href: '/admin/tenants',           icon: Users           },
        { name: 'السجلات',         href: '/admin/logs',              icon: Activity        },
        { name: 'مراقبة الرسائل',  href: '/admin/monitoring',        icon: Bot             },
        { name: 'قوالب الواتساب',  href: '/admin/settings/templates',icon: FileText        },
        { name: 'الإعدادات',       href: '/admin/settings',          icon: Settings        },
    ];

    if (!isMounted) {
        return <header className="h-16 w-full border-b border-slate-100 bg-white" />;
    }

    return (
        <header className="sticky top-0 z-40 w-full border-b border-slate-100/90 bg-white/85 backdrop-blur-md shadow-2xs" dir="rtl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                    
                    {/* Right side: Logo & Navigation */}
                    <div className="flex items-center gap-6 lg:gap-8">
                        <Link href="/admin" className="flex items-center gap-2 group">
                            <img src="/logo.png" alt="مُنظِّم" className="h-9 w-9 rounded-xl border border-slate-100 shadow-2xs group-hover:scale-105 transition-all" />
                            <span className="text-xl font-black text-primary tracking-tight">
                                مُنظِّم <span className="text-slate-400 text-xs font-bold mr-1">| الإدارة</span>
                            </span>
                        </Link>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-1">
                            {navLinks.map((link) => {
                                const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href));
                                const Icon = link.icon;
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                                            isActive 
                                                ? 'bg-primary/10 text-primary shadow-2xs' 
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                        }`}
                                    >
                                        <Icon className="h-3.5 w-3.5" />
                                        {link.name}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Left side: Profile & Mobile Toggle */}
                    <div className="flex items-center gap-3">
                        {/* Profile Info (Desktop) */}
                        <div className="hidden sm:flex items-center gap-2.5 border-r border-slate-200/80 pr-3">
                            <div className="flex flex-col items-end">
                                <span className="text-xs font-extrabold text-slate-900">{user?.name || 'مدير المنصة'}</span>
                                <span className="text-[10px] text-emerald-600 font-bold">سوبر أدمن</span>
                            </div>
                            <div className="h-8 w-8 rounded-xl bg-linear-to-tr from-primary to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-2xs">
                                {user?.name?.charAt(0) || 'م'}
                            </div>
                        </div>

                        {/* Logout Button (Desktop) */}
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleLogout}
                            className="hidden sm:inline-flex text-rose-500 hover:text-rose-600 hover:bg-rose-50 px-2.5 text-xs font-bold rounded-xl"
                            title="تسجيل الخروج"
                        >
                            <LogOut className="h-3.5 w-3.5 ml-1" />
                            خروج
                        </Button>

                        {/* Mobile Menu Toggle Button */}
                        <button
                            type="button"
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className="md:hidden p-2 text-slate-600 hover:text-primary hover:bg-slate-50 rounded-xl transition-colors"
                            aria-label="القائمة"
                        >
                            {mobileOpen ? <X className="w-5 h-5 text-rose-500" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>

                </div>
            </div>

            {/* Mobile Drawer / Slide Down Menu */}
            {mobileOpen && (
                <div className="md:hidden border-t border-slate-100 bg-white/95 backdrop-blur-lg px-4 py-3 space-y-2 animate-in slide-in-from-top-2 duration-200 shadow-md">
                    <nav className="grid grid-cols-2 gap-2">
                        {navLinks.map((link) => {
                            const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href));
                            const Icon = link.icon;
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setMobileOpen(false)}
                                    className={`flex items-center gap-2.5 p-2.5 rounded-2xl text-xs font-bold transition-all border ${
                                        isActive 
                                            ? 'bg-primary/10 text-primary border-primary/20 shadow-2xs' 
                                            : 'bg-slate-50/70 text-slate-700 border-slate-100 hover:bg-slate-100'
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span>{link.name}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Mobile Profile & Logout Footer */}
                    <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                {user?.name?.charAt(0) || 'م'}
                            </div>
                            <div>
                                <p className="text-xs font-extrabold text-slate-900">{user?.name || 'مدير النظام'}</p>
                                <p className="text-[10px] text-slate-400">سوبر أدمن</p>
                            </div>
                        </div>

                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleLogout}
                            className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs font-bold rounded-xl h-8 px-3"
                        >
                            <LogOut className="h-3.5 w-3.5 ml-1" />
                            خروج
                        </Button>
                    </div>
                </div>
            )}
        </header>
    );
}
