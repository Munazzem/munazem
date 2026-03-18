'use client';

import { Receipt, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CAT_LABELS } from './constants';

interface RecentActivityProps {
    activities: any[];
}

export function RecentActivity({ activities }: RecentActivityProps) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                    <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    نشاط اليوم
                </h3>
                <span className="text-xs text-gray-400">{activities.length} معاملة</span>
            </div>
            <div className="divide-y divide-gray-50">
                {activities.slice(0, 6).map((tx, i) => (
                    <div key={i} className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 gap-2 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className={cn(
                                'h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                                tx.type === 'INCOME' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                            )}>
                                {tx.type === 'INCOME' ? '+' : '-'}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">
                                    {tx.studentName || tx.description || CAT_LABELS[tx.category] || tx.category}
                                </p>
                                <p className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                    <Clock className="h-3 w-3 shrink-0" />
                                    {new Date(tx.time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                    {' · '}{CAT_LABELS[tx.category] || tx.category}
                                </p>
                            </div>
                        </div>
                        <span className={cn(
                            'text-sm font-bold shrink-0',
                            tx.type === 'INCOME' ? 'text-emerald-700' : 'text-red-600'
                        )}>
                            {tx.type === 'INCOME' ? '+' : '-'}{tx.paidAmount.toLocaleString('en-US')} ج
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
