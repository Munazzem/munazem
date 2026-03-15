'use client';

import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { fetchMe, updateMe, changePassword, updateSettings } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth.store';
import { toast } from 'sonner';
import { Loader2, User, Lock, Phone, Mail, Save, UploadCloud, Image as ImageIcon, Trash2 } from 'lucide-react';

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
    const queryClient = useQueryClient();
    const { user: storeUser, token, login: loginStore } = useAuthStore();
    const isTeacher = storeUser?.role === 'teacher';
    const isAssistant = storeUser?.role === 'assistant';

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
            // Also sync branding states with current data
            setCenterName(meData.centerName || '');
            setLogoBase64(meData.logoUrl || null);
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

    // ── Branding Settings (Logo & Center Name) ────────────────────────────────
    const [logoBase64, setLogoBase64] = useState<string | null>(storeUser?.logoUrl || null);
    const [centerName, setCenterName] = useState(storeUser?.centerName || '');
    const fileInputRef = useRef<any>(null);

    const brandingMutation = useMutation({
        mutationFn: updateSettings,
        onSuccess: (updatedUser) => {
            toast.success('تم حفظ إعدادات السنتر بنجاح');
            if (storeUser && token) {
                loginStore({ ...storeUser, ...updatedUser }, token);
            }
            queryClient.invalidateQueries({ queryKey: ['me'] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.message || 'حدث خطأ أثناء حفظ الإعدادات'),
    });

    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 400;
                    const MAX_HEIGHT = 400;
                    let width = img.width;
                    let height = img.height;
                    if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
                    else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { toast.error('أرجو اختيار ملف صورة صالح'); return; }
        try {
            const compressed = await compressImage(file);
            setLogoBase64(compressed);
        } catch (error) { toast.error('فشل معالجة الصورة'); }
    };

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

            {/* Branding Card (For Teachers & Assistants) */}
            {(isTeacher || isAssistant) && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <div className="h-9 w-9 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                            <ImageIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 text-sm">إعدادات طباعة الفواتير والتقارير</p>
                            <p className="text-xs text-gray-500">تخصيص اسم السنتر واللوجو الخاص بك</p>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">اسم السنتر / المؤسسة</label>
                            <Input 
                                placeholder="مثال: سنتر التفوق التعليمي" 
                                value={centerName} 
                                onChange={(e) => setCenterName(e.target.value)}
                                className="max-w-md"
                            />
                            <p className="text-[11px] text-gray-400">هذا الاسم سيظهر في أعلى كل تقرير مطبوع وكارت للطلاب</p>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-gray-700 block">شعار السنتر (Logo)</label>
                            <div className="flex flex-col sm:flex-row items-center gap-6">
                                <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0 relative group">
                                    {logoBase64 ? (
                                        <>
                                            <img src={logoBase64} alt="Center Logo" className="w-full h-full object-contain p-2" />
                                            <button
                                                type="button"
                                                onClick={() => setLogoBase64(null)}
                                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </>
                                    ) : (
                                        <ImageIcon className="w-8 h-8 text-gray-300" />
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept="image/*" />
                                    <Button variant="outline" onClick={() => fileInputRef.current.click()} className="gap-2 text-xs">
                                        <UploadCloud className="h-4 w-4" /> اختيار شعار جديد
                                    </Button>
                                    <p className="text-[11px] text-gray-400 leading-relaxed max-w-sm">
                                        يُفضل استخدام صورة مربعة ذات خلفية شفافة. سيتم تصغير الصورة أوتوماتيكياً للحفاظ على الأداء.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-50">
                            <Button 
                                onClick={() => brandingMutation.mutate({ centerName, logoUrl: logoBase64 || '' })} 
                                className="bg-orange-600 hover:bg-orange-700 gap-2"
                                disabled={brandingMutation.isPending}
                            >
                                {brandingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                حفظ إعدادات السنتر
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
