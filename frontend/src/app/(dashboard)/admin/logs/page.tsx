'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Activity, AlertTriangle, Users, Layers, Radio } from 'lucide-react';
import ErrorLogsPage from './ErrorLogs';
import ActivityFeedPage from './ActivityLogs';
import { PartitionedTeacherLogs } from '@/components/admin/PartitionedTeacherLogs';
import { LiveActiveUsersWidget } from '@/components/admin/LiveActiveUsersWidget';

export default function LogsPage() {
    return (
        <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto" dir="rtl">
            <div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">السجلات ومراقبة النشاط</h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    تقسيم مستقل لسجلات كل معلم، مراقبة الجلسات النشطة، وسجل الأخطاء التقنية.
                </p>
            </div>

            <Tabs defaultValue="partitioned" className="space-y-6">
                <TabsList className="bg-white border border-gray-100 p-1.5 shadow-xs rounded-2xl flex flex-wrap sm:inline-flex w-full sm:w-auto gap-1">
                    <TabsTrigger
                        value="partitioned"
                        className="flex-1 sm:flex-none gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-bold text-xs rounded-xl"
                    >
                        <Layers className="h-4 w-4" />
                        سجلات مقسمة لكل معلم
                    </TabsTrigger>
                    <TabsTrigger
                        value="live"
                        className="flex-1 sm:flex-none gap-2 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-700 font-bold text-xs rounded-xl"
                    >
                        <Radio className="h-4 w-4 text-emerald-600 animate-pulse" />
                        المتواجدون حالياً
                    </TabsTrigger>
                    <TabsTrigger
                        value="global"
                        className="flex-1 sm:flex-none gap-2 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600 font-bold text-xs rounded-xl"
                    >
                        <Activity className="h-4 w-4" />
                        البث المباشر الموحد
                    </TabsTrigger>
                    <TabsTrigger
                        value="errors"
                        className="flex-1 sm:flex-none gap-2 data-[state=active]:bg-red-500/10 data-[state=active]:text-red-600 font-bold text-xs rounded-xl"
                    >
                        <AlertTriangle className="h-4 w-4" />
                        سجل الأخطاء
                    </TabsTrigger>
                </TabsList>

                {/* Tab 1: Partitioned Teacher Logs */}
                <TabsContent value="partitioned" className="mt-0 outline-none">
                    <PartitionedTeacherLogs />
                </TabsContent>

                {/* Tab 2: Live Active Users */}
                <TabsContent value="live" className="mt-0 outline-none">
                    <LiveActiveUsersWidget />
                </TabsContent>

                {/* Tab 3: Global Feed */}
                <TabsContent value="global" className="mt-0 outline-none">
                    <div className="-mx-4 sm:-mx-6">
                        <ActivityFeedPage />
                    </div>
                </TabsContent>

                {/* Tab 4: Technical Errors */}
                <TabsContent value="errors" className="mt-0 outline-none">
                    <div className="-mx-4 sm:-mx-6">
                        <ErrorLogsPage />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
