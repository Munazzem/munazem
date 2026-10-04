'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { onboardCenter } from '@/lib/api/centers';
import { toast } from 'sonner';
import { Loader2, Building2, User, Phone, Lock, MapPin, Mail, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const centerSchema = z.object({
  centerName: z.string().min(2, 'اسم السنتر يجب أن يكون حرفين على الأقل'),
  ownerName: z.string().min(2, 'اسم المالك أو المدير مطلوب'),
  phone: z.string().min(10, 'رقم هاتف الدخول غير صحيح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  email: z.string().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')),
  address: z.string().optional(),
  centerPhone: z.string().optional(),
});

type FormValues = z.infer<typeof centerSchema>;

export function AddCenterModal() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(centerSchema),
    defaultValues: {
      centerName: '',
      ownerName: '',
      phone: '',
      password: '',
      email: '',
      address: '',
      centerPhone: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: onboardCenter,
    onSuccess: () => {
      toast.success('تم إنشاء السنتر وحساب الإدارة بنجاح 🎉');
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
      form.reset();
      setOpen(false);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'تعذر إنشاء السنتر، يرجى مراجعة البيانات';
      toast.error(msg);
    },
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val);
      if (!val) form.reset();
    }}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 shadow-xs transition-colors">
          <Building2 size={18} />
          <span>إضافة سنتر جديد</span>
        </Button>
      </DialogTrigger>

      <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-[550px] bg-white rounded-3xl p-6 max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900">إضافة سنتر جديد</DialogTitle>
              <p className="text-xs text-gray-500 mt-0.5">إنشاء مركز تعليمي جديد وحساب المالك المسؤول</p>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-3">
            
            {/* ── قسم بيانات السنتر ── */}
            <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-100 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 mb-1">
                <Building2 className="w-4 h-4" />
                <span>بيانات السنتر التعليمي</span>
              </div>

              <FormField
                control={form.control}
                name="centerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-gray-700">
                      اسم السنتر <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="مثال: سنتر الأوائل التعليمي" className="bg-white" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        العنوان (اختياري)
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="المدينة / المنطقة" className="bg-white" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="centerPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        هاتف السنتر (اختياري)
                      </FormLabel>
                      <FormControl>
                        <Input dir="ltr" placeholder="01xxxxxxxxx" className="bg-white text-right" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* ── قسم حساب المالك / المدير ── */}
            <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/70 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 mb-1">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>حساب مدير / مالك السنتر (تسجيل الدخول)</span>
              </div>

              <FormField
                control={form.control}
                name="ownerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      اسم المالك / المسؤول <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="الاسم الثلاثي أو الرباعي" className="bg-white" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        رقم هاتف الدخول <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input dir="ltr" placeholder="01xxxxxxxxx" className="bg-white text-right" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-gray-400" />
                        كلمة المرور <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="password" dir="ltr" placeholder="••••••••" className="bg-white text-right" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      البريد الإلكتروني (اختياري)
                    </FormLabel>
                    <FormControl>
                      <Input dir="ltr" type="email" placeholder="owner@center.com" className="bg-white text-right" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={createMutation.isPending}
                className="rounded-xl"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-2 min-w-[130px]"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جاري الإنشاء...</span>
                  </>
                ) : (
                  <>
                    <Building2 className="h-4 w-4" />
                    <span>إنشاء السنتر</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
