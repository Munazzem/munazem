'use client';

import { TrendingUp } from 'lucide-react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

// Dynamically import ApexCharts to avoid "window is not defined" error in Next.js SSR
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface IncomeTrendChartProps {
    data: { month: string; income: number }[];
}

export function IncomeTrendChart({ data }: IncomeTrendChartProps) {
    const series = [{
        name: 'الإيرادات',
        data: data.map(item => item.income || 0)
    }];

    const options: ApexOptions = {
        chart: {
            type: 'area',
            fontFamily: 'inherit',
            toolbar: { show: false },
            zoom: { enabled: false },
            sparkline: { enabled: false }
        },
        colors: ['#3b82f6'], // Primary blue
        dataLabels: { enabled: false },
        stroke: { 
            curve: 'smooth', 
            width: 3 
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [20, 100]
            }
        },
        xaxis: {
            categories: data.map(item => item.month),
            labels: {
                style: { colors: '#9ca3af', fontFamily: 'inherit', fontWeight: 500 }
            },
            axisBorder: { show: false },
            axisTicks: { show: false },
            tooltip: { enabled: false }
        },
        yaxis: {
            labels: {
                style: { colors: '#9ca3af', fontFamily: 'inherit', fontWeight: 500 },
                formatter: (value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()
            }
        },
        grid: {
            borderColor: '#f3f4f6',
            strokeDashArray: 4,
            yaxis: { lines: { show: true } },
            xaxis: { lines: { show: false } },
            padding: { top: 0, right: 0, bottom: 0, left: 10 }
        },
        tooltip: {
            theme: 'light',
            y: {
                formatter: (val) => `${val.toLocaleString('en-US')} ج.م`
            },
            style: { fontFamily: 'inherit' }
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 overflow-hidden hover:shadow-md transition-all duration-300">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                    اتجاه الإيرادات
                </div>
                <span className="text-xs font-normal text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">آخر 6 أشهر</span>
            </h3>
            <div className="h-[280px] w-full" dir="ltr">
                <ReactApexChart options={options} series={series} type="area" height="100%" />
            </div>
        </div>
    );
}
