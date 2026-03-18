'use client';

import { TrendingUp } from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { CHART_COLORS } from '../constants';

interface IncomeTrendChartProps {
    data: any[];
}

export function IncomeTrendChart({ data }: IncomeTrendChartProps) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 overflow-hidden hover:shadow-md transition-all duration-300">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    اتجاه الإيرادات
                </div>
                <span className="text-xs font-normal text-gray-400">آخر 6 أشهر</span>
            </h3>
            <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.1}/>
                                <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toString()} />
                        <Tooltip
                            formatter={(v: any) => [`${Number(v || 0).toLocaleString('en-US')} ج.م`, 'الإيرادات']}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12, direction: 'rtl' }}
                        />
                        <Area type="monotone" dataKey="income" stroke={CHART_COLORS[0]} strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
