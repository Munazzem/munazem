'use client';

import { CreditCard, ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { CHART_COLORS, CAT_LABELS } from '../constants';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface ExpensesBreakdownChartProps {
    data: any[];
    totalExpenses: number;
}

export function ExpensesBreakdownChart({ data, totalExpenses }: ExpensesBreakdownChartProps) {
    const series = data?.length > 0 ? data.map(item => item.value) : [];
    const labels = data?.length > 0 ? data.map(item => CAT_LABELS[item.name] || item.name) : [];
    
    // Applying a shifted color palette to match previous implementation
    const colors = data?.length > 0 ? data.map((_, index) => CHART_COLORS[(index + 3) % CHART_COLORS.length]) : [];

    const options: ApexOptions = {
        chart: {
            type: 'donut',
            fontFamily: 'inherit',
        },
        labels: labels,
        colors: colors,
        dataLabels: {
            enabled: false
        },
        plotOptions: {
            pie: {
                donut: {
                    size: '75%',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '10px',
                            color: '#9ca3af',
                            offsetY: -10
                        },
                        value: {
                            show: true,
                            fontSize: '24px',
                            fontWeight: 900,
                            color: '#ef4444', // Red text for expenses
                            formatter: (val) => val.toString()
                        },
                        total: {
                            show: true,
                            showAlways: true,
                            label: 'إجمالي المصروفات',
                            color: '#9ca3af',
                            fontSize: '12px',
                            formatter: () => totalExpenses.toLocaleString('en-US')
                        }
                    }
                }
            }
        },
        stroke: {
            show: true,
            colors: ['#ffffff'],
            width: 3
        },
        legend: {
            show: false // We use our custom HTML legend beneath the chart
        },
        tooltip: {
            theme: 'light',
            y: {
                formatter: (val) => `${Number(val || 0).toLocaleString('en-US')} ج.م`
            },
            style: { fontFamily: 'inherit' }
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 hover:shadow-md transition-all duration-300 flex flex-col">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                تحليل المصروفات (هذا الشهر)
            </h3>
            
            <div className="flex-1 flex flex-col justify-center items-center relative min-h-[220px]" dir="ltr">
                {data?.length > 0 ? (
                    <div className="w-full h-full flex justify-center translate-y-2">
                        <ReactApexChart options={options} series={series} type="donut" height={260} />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full w-full bg-gray-50 rounded-full w-40 h-40 text-gray-400 text-sm">
                        <div className="bg-white p-3 rounded-full mb-2 shadow-sm">
                            <ArrowLeft className="h-6 w-6 opacity-30" />
                        </div>
                        <span className="text-xs">لا توجد مصاريف</span>
                    </div>
                )}
            </div>

            {data?.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 max-h-[100px] overflow-y-auto pt-4 border-t border-gray-50 shrink-0">
                    {data.map((entry, index) => (
                        <div key={index} className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-full">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[(index + 3) % CHART_COLORS.length] }} />
                            <span className="text-xs text-gray-600 font-medium">{CAT_LABELS[entry.name] || entry.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
