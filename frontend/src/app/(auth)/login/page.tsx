'use client';

import { useForm } from 'react-hook-form';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/axios';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Form, 
    FormControl, 
    FormField, 
    FormItem, 
    FormLabel, 
    FormMessage 
} from '@/components/ui/form';

export default function LoginPage() {
    const form = useForm({
        defaultValues: {
            phone: '',
            password: '',
        }
    });
    
    const login = useAuthStore((state) => state.login);
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const onSubmit = async (data: { phone: string; password: string }) => {
        setIsLoading(true);
        try {
            const res = await apiClient.post('/auth/login', data);
            
            // Expected backend response: { success: true, data: { token, user } }
            if (res.data?.token) {
                login(res.data.user, res.data.token);
                toast.success('تم تسجيل الدخول بنجاح', {
                    description: `مرحباً بك، ${res.data.user.name || 'في منصة مُنظِّم'}`,
                });
                router.push('/dashboard');
            }
        } catch (error: { response?: { data?: { message?: string } } } | unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error('فشل تسجيل الدخول', {
                description: err.response?.data?.message || 'تأكد من رقم الهاتف وكلمة المرور',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f9f9fb] px-4">
            <div className="w-full max-w-md p-8 bg-white border border-gray-100 rounded-2xl shadow-sm">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-extrabold text-[#0f4c81] tracking-tight">مُنظِّم</h1>
                    <p className="text-gray-500 mt-2 text-sm">نظام الإدارة التعليمي الذكي</p>
                </div>
                
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        
                        <FormField
                            control={form.control}
                            name="phone"
                            rules={{ required: 'رقم الهاتف مطلوب' }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>رقم الهاتف</FormLabel>
                                    <FormControl>
                                        <Input 
                                            placeholder="أدخل رقم الهاتف" 
                                            {...field} 
                                            disabled={isLoading}
                                            className="h-12 bg-gray-50/50"
                                            dir="ltr"
                                            type="tel"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="password"
                            rules={{ required: 'كلمة المرور مطلوبة' }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>كلمة المرور</FormLabel>
                                    <FormControl>
                                        <Input 
                                            type="password" 
                                            placeholder="••••••••" 
                                            {...field} 
                                            disabled={isLoading}
                                            className="h-12 bg-gray-50/50 text-left"
                                            dir="ltr"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Button 
                            type="submit" 
                            className="w-full h-12 text-md font-bold bg-[#0f4c81] hover:bg-[#0a3357] transition-all"
                            disabled={isLoading}
                        >
                            {isLoading ? 'جاري التحقق...' : 'تسجيل الدخول'}
                        </Button>
                    </form>
                </Form>
                
                <div className="mt-6 text-center">
                    <Link
                        href="/parent"
                        className="inline-flex items-center gap-1.5 text-sm text-[#0f4c81] hover:underline font-medium"
                    >
                        <span>👨‍👧</span>
                        بوابة ولي الأمر — تابع أداء ابنك
                    </Link>
                </div>

                <div className="mt-4 text-center text-xs text-gray-400">
                    &copy; {new Date().getFullYear()} Monazem Platform. All rights reserved.
                </div>
            </div>
        </div>
    );
}
