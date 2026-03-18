'use client';

import { CreditCard, ArrowLeft } from 'lucide-react';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { CHART_COLORS, CAT_LABELS } from '../constants';

interface ExpensesBreakdownChartProps {
    data: any[];
    totalExpenses: number;
}

export function ExpensesBreakdownChart({ data, totalExpenses }: ExpensesBreakdownChartProps) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 hover:shadow-md transition-all duration-300">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                تحليل المصروفات (هذا الشهر)
            </h3>
            <div className="h-[280px] w-full relative">
                {data?.length > 0 ? (
                    <>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.map(e => ({ ...e, name: CAT_LABELS[e.name] || e.name }))}
                                    innerRadius="70%"
                                    outerRadius="95%"
                                    paddingAngle={8}
                                    cornerRadius={6}
                                    dataKey="value"
                                    cx="50%"
                                    cy="50%"
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[(index + 3) % CHART_COLORS.length]} stroke="white" strokeWidth={2} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(v: any) => [`${Number(v || 0).toLocaleString('en-US')} ج.م`, 'المبلغ']}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', fontSize: 12, direction: 'rtl' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col items-center justify-center pointer-events-none">
                            <p className="text-2xl font-black text-red-600 tracking-tight leading-none">{totalExpenses.toLocaleString('en-US')}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">جنيه مصروفات</p>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
                        <div className="bg-gray-50 p-4 rounded-full mb-2">
                            <ArrowLeft className="h-6 w-6 opacity-20" />
                        </div>
                        لا توجد مصاريف مسجلة هذا الشهر
                    </div>
                )}
            </div>
            {data?.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 pt-2 border-t border-gray-50">
                    {data.map((entry, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[(index + 3) % CHART_COLORS.length] }} />
                            <span className="text-[10px] text-gray-600">{CAT_LABELS[entry.name] || entry.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
