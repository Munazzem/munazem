'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchMe, updateMe, changePassword } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth.store';
import { toast } from 'sonner';
import { Loader2, User, Lock, Phone, Mail, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';

// ─── Schemas ────────────────────────────────────────────────────────────────

const profileSchema = z.object({
    name: z.string().min(3, 'الاسم يجب أن يكون 3 أحرف على الأقل'),
    phone: z.string().min(10, 'رقم الهاتف غير صحيح'),
    email: z.string().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')),
});

const passwordSchema = z.object({
    currentPassword: z.string().min(1, 'كلمة المرور الحالية مطلوبة'),
    newPassword: z.string().min(6, 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل'),
    confirmPassword: z.string().min(1, 'تأكيد كلمة المرور مطلوب'),
}).refine((d) => d.newPassword === d.confirmPassword, {
    message: 'كلمة المرور الجديدة وتأكيدها غير متطابقتين',
    path: ['confirmPassword'],
});

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
    const storeUser = useAuthStore((s) => s.user);

    const { data: meData, isLoading: meLoading } = useQuery({
        queryKey: ['me'],
        queryFn: fetchMe,
    });

    // ── Profile form ──────────────────────────────────────────────────────────
    const profileForm = useForm<z.infer<typeof profileSchema>>({
        resolver: zodResolver(profileSchema),
        defaultValues: { name: '', phone: '', email: '' },
    });

    useEffect(() => {
        if (meData) {
            profileForm.reset({
                name: meData.name || '',
                phone: meData.phone || '',
                email: meData.email || '',
            });
        }
    }, [meData, profileForm]);

    const profileMutation = useMutation({
        mutationFn: updateMe,
        onSuccess: () => toast.success('تم تحديث البيانات بنجاح'),
        onError: (e: any) => toast.error(e?.response?.data?.message || 'حدث خطأ'),
    });

    // ── Password form ─────────────────────────────────────────────────────────
    const passwordForm = useForm<z.infer<typeof passwordSchema>>({
        resolver: zodResolver(passwordSchema),
        defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    });

    const passwordMutation = useMutation({
        mutationFn: changePassword,
        onSuccess: () => {
            toast.success('تم تغيير كلمة المرور بنجاح');
            passwordForm.reset();
        },
        onError: (e: any) => toast.error(e?.response?.data?.message || 'حدث خطأ'),
    });

    return (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500 max-w-2xl" dir="rtl">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">الإعدادات</h1>
                <p className="text-sm text-gray-500 mt-0.5">إدارة بيانات حسابك وكلمة المرور.</p>
            </div>

            {/* Profile Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <User className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="font-bold text-gray-900 text-sm">البيانات الشخصية</p>
                        <p className="text-xs text-gray-500">الاسم ورقم الهاتف والبريد الإلكتروني</p>
                    </div>
                </div>

                <div className="p-6">
                    {meLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <Form {...profileForm}>
                            <form onSubmit={profileForm.handleSubmit((v) => profileMutation.mutate(v))} className="space-y-4">
                                <FormField
                                    control={profileForm.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>الاسم الكامل</FormLabel>
                                            <FormControl>
                                                <Input placeholder="الاسم الرباعي" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField
                                        control={profileForm.control}
                                        name="phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="flex items-center gap-1">
                                                    <Phone className="h-3.5 w-3.5" /> رقم الهاتف
                                                </FormLabel>
                                                <FormControl>
                                                    <Input dir="ltr" className="text-right" placeholder="01X..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={profileForm.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="flex items-center gap-1">
                                                    <Mail className="h-3.5 w-3.5" /> البريد الإلكتروني
                                                </FormLabel>
                                                <FormControl>
                                                    <Input dir="ltr" className="text-right" placeholder="admin@monazem.com" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="flex justify-end pt-2">
                                    <Button type="submit" className="bg-primary hover:bg-primary/90 gap-2" disabled={profileMutation.isPending}>
                                        {profileMutation.isPending
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : <Save className="h-4 w-4" />
                                        }
                                        حفظ التغييرات
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    )}
                </div>
            </div>

            {/* Password Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="h-9 w-9 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                        <Lock className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="font-bold text-gray-900 text-sm">تغيير كلمة المرور</p>
                        <p className="text-xs text-gray-500">يُنصح بتغييرها بشكل دوري للحفاظ على أمان الحساب</p>
                    </div>
                </div>

                <div className="p-6">
                    <Form {...passwordForm}>
                        <form onSubmit={passwordForm.handleSubmit((v) => passwordMutation.mutate({ currentPassword: v.currentPassword, newPassword: v.newPassword }))} className="space-y-4">
                            <FormField
                                control={passwordForm.control}
                                name="currentPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>كلمة المرور الحالية</FormLabel>
                                        <FormControl>
                                            <Input type="password" dir="ltr" className="text-right" placeholder="••••••••" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField
                                    control={passwordForm.control}
                                    name="newPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>كلمة المرور الجديدة</FormLabel>
                                            <FormControl>
                                                <Input type="password" dir="ltr" className="text-right" placeholder="••••••••" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={passwordForm.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>تأكيد كلمة المرور</FormLabel>
                                            <FormControl>
                                                <Input type="password" dir="ltr" className="text-right" placeholder="••••••••" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button
                                    type="submit"
                                    className="bg-red-600 hover:bg-red-700 gap-2"
                                    disabled={passwordMutation.isPending}
                                >
                                    {passwordMutation.isPending
                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                        : <Lock className="h-4 w-4" />
                                    }
                                    تغيير كلمة المرور
                                </Button>
                            </div>
                        </form>
                    </Form>
                </div>
            </div>

            {/* Account info */}
            {meData && (
                <div className="bg-gray-50 rounded-2xl border border-gray-100 px-6 py-4">
                    <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">معلومات الحساب</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <span className="text-gray-400">الدور: </span>
                            <span className="font-semibold text-gray-700">
                                {meData.role === 'superAdmin' ? 'مدير النظام' : meData.role === 'teacher' ? 'معلم' : 'مساعد'}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-400">الحالة: </span>
                            <span className={`font-semibold ${meData.isActive ? 'text-green-600' : 'text-red-500'}`}>
                                {meData.isActive ? 'نشط' : 'غير نشط'}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-400">تاريخ الإنشاء: </span>
                            <span className="font-semibold text-gray-700">
                                {new Date(meData.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
