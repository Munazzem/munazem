'use client';

import { Users } from 'lucide-react';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { CHART_COLORS } from '../constants';

interface StudentsDistributionChartProps {
    data: any[];
    totalStudents: number;
}

export function StudentsDistributionChart({ data, totalStudents }: StudentsDistributionChartProps) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 hover:shadow-md transition-all duration-300">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500" />
                توزيع الطلاب على المجموعات
            </h3>
            <div className="h-[280px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            innerRadius="70%"
                            outerRadius="95%"
                            paddingAngle={5}
                            cornerRadius={6}
                            dataKey="studentCount"
                            nameKey="groupName"
                            cx="50%"
                            cy="50%"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="white" strokeWidth={2} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', fontSize: 12, direction: 'rtl' }} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-3xl font-black text-gray-900 tracking-tight leading-none">{totalStudents.toLocaleString('en-US')}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">طالب</p>
                </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 max-h-[100px] overflow-y-auto pt-2 border-t border-gray-50">
                {data.map((entry, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                        <span className="text-[10px] text-gray-600 truncate max-w-[100px]">{entry.groupName}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
