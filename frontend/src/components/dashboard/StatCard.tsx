'use client';

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: number | string;
    suffix?: string;
    icon: LucideIcon;
    iconBg: string;
    iconColor: string;
    accent?: string;
}

export function StatCard({
    label,
    value,
    suffix,
    icon: Icon,
    iconBg,
    iconColor,
    accent,
}: StatCardProps) {
    return (
        <div className={cn(
            'bg-white/80 backdrop-blur-md p-6 rounded-[24px] border border-gray-100 soft-shadow hover-lift relative overflow-hidden group',
        )}>
            {accent && <div className={cn('absolute top-0 left-0 w-full h-1', accent)} />}
            <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-500 group-hover:text-gray-700 transition-colors">{label}</span>
                <div className={cn('h-12 w-12 flex items-center justify-center rounded-2xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg', iconBg)}>
                    <Icon className={cn('h-6 w-6 drop-shadow-sm', iconColor)} />
                </div>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">
                    {typeof value === 'number' ? value.toLocaleString('en-US') : value}
                </span>
                {suffix && <span className="text-sm text-gray-400">{suffix}</span>}
            </div>
        </div>
    );
}
