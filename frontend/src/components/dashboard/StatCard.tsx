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
            'bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden',
        )}>
            {accent && <div className={cn('absolute top-0 left-0 w-full h-1', accent)} />}
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">{label}</span>
                <div className={cn('h-10 w-10 flex items-center justify-center rounded-xl', iconBg)}>
                    <Icon className={cn('h-5 w-5', iconColor)} />
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
