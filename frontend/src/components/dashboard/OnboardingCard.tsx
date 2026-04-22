'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Rocket, Users, GraduationCap, Calendar, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ONBOARDING_DISMISSED_KEY = 'monazem_onboarding_dismissed';

export function OnboardingCard({
    totalGroups,
    totalStudents,
}: {
    totalGroups: number;
    totalStudents: number;
}) {
    const [dismissed, setDismissed] = useState(() => {
        if (typeof window === 'undefined') return false;
        return sessionStorage.getItem(ONBOARDING_DISMISSED_KEY) === '1';
    });

    const needsOnboarding = totalGroups === 0 || totalStudents === 0;
    if (!needsOnboarding || dismissed) return null;

    const dismiss = () => {
        sessionStorage.setItem(ONBOARDING_DISMISSED_KEY, '1');
        setDismissed(true);
    };

    const steps = [
        {
            label: 'أضف مجموعة عمل',
            href: '/groups',
            icon: GraduationCap,
            done: totalGroups > 0,
        },
        {
            label: 'أضف الطلاب',
            href: '/students',
            icon: Users,
            done: totalStudents > 0,
        },
        {
            label: 'سجّل أول حصة',
            href: '/sessions',
            icon: Calendar,
            done: false,
        },
    ];

    return (
        <div className="relative bg-gradient-to-br from-[#1e3a6e] to-[#152a52] rounded-2xl p-5 sm:p-6 text-white shadow-lg border border-[#1e3a6e]/20">
            <button
                type="button"
                onClick={dismiss}
                className="absolute top-3 left-3 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="تخطي"
            >
                <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3 pr-8">
                <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Rocket className="h-6 w-6" />
                </div>
                <div>
                    <h2 className="text-lg font-bold">ابدأ بإعداد منظمتك</h2>
                    <p className="text-sm text-white/80 mt-0.5">
                        خطوات بسيطة لتشغيل الحصص وتتبع الطلاب والماليات
                    </p>
                </div>
            </div>

            <ul className="mt-5 space-y-2">
                {steps.map((step) => {
                    const Icon = step.icon;
                    return (
                        <li key={step.href}>
                            <Link
                                href={step.href}
                                className="flex items-center gap-3 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                            >
                                <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                                    <Icon className="h-4 w-4" />
                                </div>
                                <span className="font-medium flex-1">{step.label}</span>
                                {step.done ? (
                                    <span className="text-xs bg-green-400/30 text-white px-2 py-0.5 rounded-full">
                                        تم
                                    </span>
                                ) : (
                                    <span className="text-white/60 text-sm">ابدأ ←</span>
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>

            <div className="mt-4 flex justify-end">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={dismiss}
                    className="text-white/70 hover:text-white hover:bg-white/10"
                >
                    تخطي الآن
                </Button>
            </div>
        </div>
    );
}
