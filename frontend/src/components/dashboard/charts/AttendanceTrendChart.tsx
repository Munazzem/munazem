'use client';

import { Activity } from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { CHART_COLORS } from '../constants';

interface AttendanceTrendChartProps {
    data: any[];
}

export function AttendanceTrendChart({ data }: AttendanceTrendChartProps) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 overflow-hidden hover:shadow-md transition-all duration-300">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                    مستويات الحضور
                </div>
                <span className="text-xs font-normal text-gray-400">آخر 8 حصص</span>
            </h3>
            <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                        <Tooltip
                            formatter={(v: any) => [`${v}%`, 'نسبة الحضور']}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12, direction: 'rtl' }}
                        />
                        <Line type="stepAfter" dataKey="rate" stroke={CHART_COLORS[7]} strokeWidth={3} dot={{ r: 4, fill: CHART_COLORS[7] }} activeDot={{ r: 6 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
