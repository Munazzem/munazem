'use client';

import { Layers } from 'lucide-react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const PLAN_COLORS: Record<string, string> = {
    'أساسية': '#3b82f6',    // blue
    'احترافية': '#8b5cf6',  // violet
    'متميزة': '#f59e0b',    // amber
    'أخرى': '#9ca3af'       // gray
};

interface PlanDistributionChartProps {
    data: { name: string; value: number }[];
    total: number;
}

export function PlanDistributionChart({ data, total }: PlanDistributionChartProps) {
    const series = data.map(item => item.value);
    const labels = data.map(item => item.name);
    const colors = data.map(item => PLAN_COLORS[item.name] || PLAN_COLORS['أخرى']);

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
                            fontSize: '28px',
                            fontWeight: 900,
                            color: '#111827',
                            formatter: (val) => val.toString()
                        },
                        total: {
                            show: true,
                            showAlways: true,
                            label: 'إجمالي الباقات',
                            color: '#9ca3af',
                            fontSize: '12px',
                            formatter: () => total.toString()
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
            show: false // We use our custom HTML legend below
        },
        tooltip: {
            theme: 'light',
            y: {
                formatter: (val) => `${val} معلم`
            },
            style: { fontFamily: 'inherit' }
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 hover:shadow-md transition-all duration-300 flex flex-col">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Layers className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500" />
                توزيع باقات المعلمين
            </h3>
            
            <div className="flex-1 flex flex-col justify-center items-center relative min-h-[220px]" dir="ltr">
                {data.length > 0 ? (
                    <div className="w-full h-full flex justify-center translate-y-2">
                        <ReactApexChart options={options} series={series} type="donut" height={260} />
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full w-full bg-gray-50 rounded-full w-40 h-40">
                        <p className="text-gray-400 text-sm">لا توجد بيانات</p>
                    </div>
                )}
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 max-h-[100px] overflow-y-auto pt-4 border-t border-gray-50 shrink-0">
                {data.map((entry, index) => (
                    <div key={index} className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-full">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PLAN_COLORS[entry.name] || PLAN_COLORS['أخرى'] }} />
                        <span className="text-xs text-gray-600 font-medium">{entry.name} <span className="text-gray-400 ml-1">({entry.value})</span></span>
                    </div>
                ))}
            </div>
        </div>
    );
}
