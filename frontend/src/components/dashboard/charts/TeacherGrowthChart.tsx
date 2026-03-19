'use client';

import { Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface TeacherGrowthChartProps {
    data: { month: string; newTeachers: number }[];
}

export function TeacherGrowthChart({ data }: TeacherGrowthChartProps) {
    const series = [{
        name: 'انضمام جديد',
        data: data.map(item => item.newTeachers)
    }];

    const options: ApexOptions = {
        chart: {
            type: 'line',
            fontFamily: 'inherit',
            toolbar: { show: false },
            zoom: { enabled: false },
            dropShadow: {
                enabled: true,
                top: 8,
                left: 0,
                blur: 4,
                opacity: 0.1,
                color: '#8b5cf6'
            }
        },
        colors: ['#8b5cf6'], // Violet color for contrast
        dataLabels: { enabled: false },
        stroke: { 
            curve: 'smooth', // 'smooth' creates the curved line chart
            width: 4 
        },
        markers: {
            size: 5,
            colors: ['#fff'],
            strokeColors: '#8b5cf6',
            strokeWidth: 2,
            hover: { size: 7 }
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
                formatter: (value) => Math.round(value).toString()
            },
            min: 0
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
                formatter: (val) => `${val} معلم`
            },
            style: { fontFamily: 'inherit' }
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 overflow-hidden hover:shadow-md transition-all duration-300">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-violet-500" />
                    نمو انضمام المعلمين
                </div>
                <span className="text-xs font-normal text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">آخر 6 أشهر</span>
            </h3>
            <div className="h-[280px] w-full" dir="ltr">
                <ReactApexChart options={options} series={series} type="line" height="100%" />
            </div>
        </div>
    );
}
