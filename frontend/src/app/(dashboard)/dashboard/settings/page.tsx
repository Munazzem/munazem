'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { fetchMe, updateMe, changePassword, updateSettings } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient, API_BASE_URL } from '@/lib/api/axios';
import { toast } from 'sonner';
import { Loader2, User, Lock, Phone, Mail, Save, UploadCloud, Image as ImageIcon, Trash2, Wifi, WifiOff, MessageSquare } from 'lucide-react';
import QRCode from 'qrcode';
import { io, type Socket } from 'socket.io-client';
import Cookies from 'js-cookie';

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

// ─── Schemas ────────────────────────────────────────────────────────────────

const profileSchema = z.object({
    name: z.string().min(3, 'الاسم يجب أن يكون 3 أحرف على الأقل'),
    phone: z.string().min(10, 'رقم الهاتف غير صحيح'),
    email: z.string().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')),
    subject: z.string().optional(),
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
    const [showCustomSubject, setShowCustomSubject] = useState(false);

    const { data: meData, isLoading: meLoading } = useQuery({
        queryKey: ['me', storeUser?.id],
        queryFn: fetchMe,
        enabled: !!storeUser?.id,
    });

    // ── Profile form ──────────────────────────────────────────────────────────
    const profileForm = useForm<z.infer<typeof profileSchema>>({
        resolver: zodResolver(profileSchema),
        defaultValues: { name: '', phone: '', email: '', subject: '' },
    });

    useEffect(() => {
        if (meData) {
            const presets = ['الرياضيات', 'الفيزياء', 'الكيمياء', 'الأحياء', 'اللغة العربية', 'اللغة الإنجليزية', 'اللغة الفرنسية', 'التاريخ', 'الجغرافيا', 'الفلسفة', 'العلوم'];
            const hasSubject = !!meData.subject;
            const isPreset = hasSubject && presets.includes(meData.subject);
            setShowCustomSubject(hasSubject && !isPreset);

            profileForm.reset({
                name: meData.name || '',
                phone: meData.phone || '',
                email: meData.email || '',
                subject: meData.subject || '',
            });
            // Also sync branding states with current data
            setCenterName(meData.centerName || '');
            setLogoBase64(meData.logoUrl || null);
        }
    }, [meData, profileForm]);

    const profileMutation = useMutation({
        mutationFn: updateMe,
        onSuccess: () => {
            toast.success('تم تحديث البيانات بنجاح');
            queryClient.invalidateQueries({ queryKey: ['me', storeUser?.id] });
        },
    });

    const handleSubjectChange = (val: string) => {
        if (val === 'OTHER') {
            setShowCustomSubject(true);
            profileForm.setValue('subject', '');
        } else {
            setShowCustomSubject(false);
            profileForm.setValue('subject', val);
        }
    };

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
        
    });

    // ── Branding Settings (Logo & Center Name) ────────────────────────────────
    const [logoBase64, setLogoBase64] = useState<string | null>(storeUser?.logoUrl || null);
    const [centerName, setCenterName] = useState(storeUser?.centerName || '');
    const fileInputRef = useRef<any>(null);

    // ── WhatsApp Integration ──────────────────────────────────────────────────
    type WaStatus = 'disconnected' | 'pending' | 'connected';
    const [waStatus, setWaStatus] = useState<WaStatus>('disconnected');
    const [waQrCode, setWaQrCode] = useState<string | null>(null);
    const [waQrDataUrl, setWaQrDataUrl] = useState<string | null>(null);
    const [waConnecting, setWaConnecting] = useState(false);
    // Stable ref to the Socket.io connection — never triggers re-renders
    const waSocketRef = useRef<Socket | null>(null);

    // ── Convert raw QR string → renderable Data URL ───────────────────────────
    useEffect(() => {
        if (!waQrCode) { setWaQrDataUrl(null); return; }
        QRCode.toDataURL(waQrCode, { width: 260, margin: 2 })
            .then(setWaQrDataUrl)
            .catch(() => setWaQrDataUrl(null));
    }, [waQrCode]);

    // ── Socket.io real-time listener + initial HTTP hydration ─────────────────
    useEffect(() => {
        if (!isTeacher) return;

        // 1️⃣  Hydrate UI immediately from DB (handles page-refresh while connected)
        apiClient.get('/whatsapp/status')
            .then((res: any) => {
                setWaStatus(res.data?.status ?? 'disconnected');
                setWaQrCode(res.data?.qrCode   ?? null);
            })
            .catch(() => {});

        // 2️⃣  Get the JWT from the cookie (same source as apiClient)
        const token = Cookies.get('token');
        if (!token) return;   // unauthenticated — skip socket setup

        // 3️⃣  Open the Socket.io connection to the dedicated /whatsapp namespace
        const socket = io(`${API_BASE_URL}/whatsapp`, {
            auth:       { token },           // validated by the gateway JWT middleware
            transports: ['polling', 'websocket'],
            reconnection:        true,
            // No limit — socket must survive backend restarts without dying
            reconnectionDelayMax: 10_000,
            reconnectionDelay:    2000,
        });

        waSocketRef.current = socket;

        // ── Event: socket connected / reconnected ─────────────────────────────
        // Re-poll DB status after every (re)connect to catch events that were
        // emitted while the socket was offline (e.g. after a backend restart).
        socket.on('connect', () => {
            console.info('[WA] socket connected:', socket.id);
            apiClient.get('/whatsapp/status')
                .then((res: any) => {
                    setWaStatus(res.data?.status ?? 'disconnected');
                    setWaQrCode(res.data?.qrCode   ?? null);
                    setWaConnecting(false);
                })
                .catch(() => {});
        });

        // ── Event: new QR code generated ──────────────────────────────────────
        socket.on('wa:qr', ({ qr }: { qr: string }) => {
            setWaStatus('pending');
            setWaQrCode(qr);
            setWaConnecting(false);   // Puppeteer is up — stop the spinner
        });

        // ── Event: QR scanned, client authenticated & ready ───────────────────
        // NOTE: This event may fire twice — once from 'authenticated' (immediately
        // after scan) and once from 'ready' (after full session init). The status
        // check makes this handler idempotent: only the first emit triggers the
        // toast and state change.
        socket.on('wa:connected', () => {
            setWaStatus((prev) => {
                if (prev === 'connected') return prev; // already transitioned — ignore duplicate
                toast.success('تم ربط الواتساب بنجاح! ✅');
                return 'connected';
            });
            setWaQrCode(null);
            setWaConnecting(false);
        });

        // ── Event: client disconnected / auth failure ─────────────────────────
        socket.on('wa:disconnected', () => {
            setWaStatus('disconnected');
            setWaQrCode(null);
            setWaConnecting(false);
        });

        // ── Socket error (connection refused / auth rejected) ─────────────────
        socket.on('connect_error', (err) => {
            console.warn('[WA Gateway] connection error:', err.message);
        });

        // ── Clean Teardown on unmount ─────────────────────────────────────────
        return () => {
            socket.off('connect');
            socket.off('wa:qr');
            socket.off('wa:connected');
            socket.off('wa:disconnected');
            socket.off('connect_error');
            socket.disconnect();
            waSocketRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTeacher]);  // run once when teacher status is confirmed

    const handleWaConnect = useCallback(async () => {
        setWaConnecting(true);

        // 45-second safety net: if Puppeteer never emits wa:qr, reset the UI
        // and tell the user to retry instead of leaving them on the spinner forever.
        const qrTimeoutId = setTimeout(() => {
            setWaConnecting(false);
            setWaStatus('disconnected');
            toast.error('انتهت مهلة توليد رمز QR. تحقق من اتصال الخادم وحاول مجدداً.');
        }, 45_000);

        // Cancel the timeout as soon as any terminal event arrives
        const socket = waSocketRef.current;
        if (socket) {
            const clearQrTimeout = () => clearTimeout(qrTimeoutId);
            socket.once('wa:qr',           clearQrTimeout);
            socket.once('wa:connected',     clearQrTimeout);
            socket.once('wa:disconnected',  clearQrTimeout);
        }

        try {
            // Triggers Puppeteer on the backend — the QR will arrive via Socket.io wa:qr event
            await apiClient.post('/whatsapp/connect');
            // Keep status as 'pending' visually while Puppeteer starts
            setWaStatus('pending');
        } catch {
            clearTimeout(qrTimeoutId);
            setWaConnecting(false);
            // Handled globally by axios interceptor
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleWaDisconnect = useCallback(async () => {
        const ok = window.confirm('هل أنت متأكد من إلغاء ربط حساب الواتساب؟ سيتوقف إرسال الرسائل التلقائية.');
        if (!ok) return;
        try {
            await apiClient.post('/whatsapp/disconnect');
            // The backend will emit wa:disconnected via Socket.io,
            // but we also update local state immediately for instant UX.
            setWaStatus('disconnected');
            setWaQrCode(null);
            setWaQrDataUrl(null);
            toast.success('تم فصل الواتساب بنجاح');
        } catch {
            // Handled globally
        }
    }, []);

    const brandingMutation = useMutation({
        mutationFn: updateSettings,
        onSuccess: (updatedUser) => {
            toast.success('تم حفظ إعدادات السنتر بنجاح');
            if (storeUser && token) {
                loginStore({ ...storeUser, ...updatedUser }, token);
            }
            queryClient.invalidateQueries({ queryKey: ['me', storeUser?.id] });
        },
        
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
        } catch (error) { 
            // Handled globally
        }
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

                                {isTeacher && (
                                    <FormField
                                        control={profileForm.control}
                                        name="subject"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>المادة الدراسية</FormLabel>
                                                {!showCustomSubject ? (
                                                    <Select onValueChange={handleSubjectChange} value={field.value || ''}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent dir="rtl">
                                                            <SelectItem value="الرياضيات">الرياضيات</SelectItem>
                                                            <SelectItem value="الفيزياء">الفيزياء</SelectItem>
                                                            <SelectItem value="الكيمياء">الكيمياء</SelectItem>
                                                            <SelectItem value="الأحياء">الأحياء</SelectItem>
                                                            <SelectItem value="اللغة العربية">اللغة العربية</SelectItem>
                                                            <SelectItem value="اللغة الإنجليزية">اللغة الإنجليزية</SelectItem>
                                                            <SelectItem value="اللغة الفرنسية">اللغة الفرنسية</SelectItem>
                                                            <SelectItem value="التاريخ">التاريخ</SelectItem>
                                                            <SelectItem value="الجغرافيا">الجغرافيا</SelectItem>
                                                            <SelectItem value="الفلسفة">الفلسفة</SelectItem>
                                                            <SelectItem value="العلوم">العلوم</SelectItem>
                                                            <SelectItem value="OTHER">مادة أخرى...</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <FormControl>
                                                            <Input placeholder="اكتب اسم المادة..." {...field} autoFocus />
                                                        </FormControl>
                                                        <Button 
                                                            type="button" 
                                                            variant="outline" 
                                                            onClick={() => {
                                                                setShowCustomSubject(false);
                                                                profileForm.setValue('subject', '');
                                                            }}
                                                        >
                                                            إلغاء
                                                        </Button>
                                                    </div>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}

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

            {/* WhatsApp Integration Card (Teachers Only) */}
            {isTeacher && storeUser?.planTier === 'PREMIUM' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                            waStatus === 'connected'
                                ? 'bg-emerald-100 text-emerald-600'
                                : 'bg-green-100 text-green-600'
                        }`}>
                            <MessageSquare className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-gray-900 text-sm">ربط نظام الواتساب الذكي</p>
                            <p className="text-xs text-gray-500">إرسال إشعارات الغياب ونتائج الامتحانات تلقائياً لأولياء الأمور</p>
                        </div>
                        {/* Status badge */}
                        {waStatus === 'connected' && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                </span>
                                متصل
                            </span>
                        )}
                        {waStatus === 'disconnected' && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200 rounded-full px-2.5 py-1">
                                <WifiOff className="h-3 w-3" />
                                غير متصل
                            </span>
                        )}
                        {waStatus === 'pending' && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2.5 py-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                في انتظار المسح
                            </span>
                        )}
                    </div>

                    <div className="p-6">
                        {/* ── State: DISCONNECTED ──────────────────────────── */}
                        {waStatus === 'disconnected' && (
                            <div className="text-center py-4 space-y-4">
                                <div className="mx-auto w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
                                    <WifiOff className="h-8 w-8 text-red-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">خدمة الواتساب الذكي غير مفعّلة</p>
                                    <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto leading-relaxed">
                                        فعّل الخدمة لإرسال إشعارات الغياب ونتائج الامتحانات تلقائياً لأولياء الأمور عبر واتساب.
                                    </p>
                                </div>
                                <Button
                                    onClick={handleWaConnect}
                                    className="bg-green-600 hover:bg-green-700 gap-2"
                                    disabled={waConnecting}
                                >
                                    {waConnecting
                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                        : <Wifi className="h-4 w-4" />
                                    }
                                    توليد كود الربط (QR Code)
                                </Button>
                            </div>
                        )}

                        {/* ── State: PENDING (waiting for QR scan) ─────────── */}
                        {waStatus === 'pending' && (
                            <div className="text-center py-4 space-y-4">
                                {waQrDataUrl ? (
                                    <>
                                        <p className="text-sm font-semibold text-gray-800">امسح الكود بتطبيق واتساب على هاتفك</p>
                                        <p className="text-xs text-gray-500">Settings → Linked Devices → Link a Device</p>
                                        <div className="inline-block p-4 bg-white rounded-2xl border-2 border-gray-100 shadow-md">
                                            <img
                                                src={waQrDataUrl}
                                                alt="WhatsApp QR Code"
                                                className="w-[200px] h-[200px]"
                                            />
                                        </div>
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="flex items-center gap-2 text-xs text-amber-600">
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                <span>جاري مراقبة عملية المسح...</span>
                                            </div>
                                            <Button
                                                onClick={handleWaDisconnect}
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs"
                                            >
                                                <WifiOff className="h-3.5 w-3.5 ml-1 inline-block" />
                                                إلغاء ومسح الجلسة المعلقة
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center gap-3 py-6">
                                        <Loader2 className="h-10 w-10 animate-spin text-green-600" />
                                        <p className="text-sm text-gray-600">جاري تجهيز كود الربط...</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── State: CONNECTED ─────────────────────────────── */}
                        {waStatus === 'connected' && (
                            <div className="text-center py-4 space-y-4">
                                <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
                                    <Wifi className="h-8 w-8 text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-emerald-700">السيستم متصل بنجاح ونشط برقم السنتر ✅</p>
                                    <p className="text-xs text-gray-500 mt-1">سيتم إرسال إشعارات الغياب والنتائج تلقائياً لأولياء الأمور</p>
                                </div>
                                <Button
                                    onClick={handleWaDisconnect}
                                    variant="outline"
                                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 gap-2"
                                >
                                    <WifiOff className="h-4 w-4" />
                                    إلغاء ربط الحساب (Disconnect)
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
