'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateUser } from '@/lib/api/users';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Switch } from '@/components/ui/switch';
import type { IUser } from '@/types/user.types';
import { TeacherStage } from '@/types/user.types';

const updateTeacherSchema = z.object({
  name: z.string().min(3, 'الاسم يجب أن يكون 3 أحرف على الأقل').optional(),
  phone: z.string().min(10, 'رقم الهاتف غير صحيح').optional(),
  email: z.string().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل').optional().or(z.literal('')),
  stage: z.nativeEnum(TeacherStage).optional(),
  isActive: z.boolean().optional(),
});

interface EditTeacherModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teacher: IUser | null;
}

export function EditTeacherModal({ open, onOpenChange, teacher }: EditTeacherModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof updateTeacherSchema>>({
    resolver: zodResolver(updateTeacherSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      password: '',
      stage: TeacherStage.preparatory,
      isActive: true,
    },
  });

  useEffect(() => {
      if (teacher && open) {
          form.reset({
              name: teacher.name,
              phone: teacher.phone,
              email: teacher.email || '',
              password: '', // Do not populate password
              stage: teacher.stage as TeacherStage || TeacherStage.preparatory,
              isActive: teacher.isActive,
          });
      }
  }, [teacher, open, form]);

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; data: any }) => updateUser(data),
    onSuccess: () => {
      toast.success('تم تحديث بيانات المعلم بنجاح');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'حدث خطأ أثناء التحديث');
    },
  });

  const onSubmit = (values: z.infer<typeof updateTeacherSchema>) => {
    if (!teacher) return;
    
    // Clean up empty password so it won't be updated unnecessarily
    const payload = { ...values };
    if (!payload.password) {
        delete payload.password;
    }

    updateMutation.mutate({
        id: teacher._id,
        data: payload
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white rounded-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900 border-b pb-4">تعديل بيانات المعلم</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-4">
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الاسم الرباعي <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="اسم المعلم" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>البريد الإلكتروني (اختياري)</FormLabel>
                  <FormControl>
                    <Input dir="ltr" className="text-right" placeholder="teacher@monazem.com" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>رقم الهاتف <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                        <Input dir="ltr" className="text-right" placeholder="01X..." autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control}
                name="stage"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>المرحلة الدراسية</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                        <SelectTrigger><SelectValue placeholder="اختر المرحلة" /></SelectTrigger>
                        </FormControl>
                        <SelectContent dir="rtl">
                            <SelectItem value={TeacherStage.preparatory}>إعدادي</SelectItem>
                            <SelectItem value={TeacherStage.secondary}>ثانوي</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تغيير كلمة المرور (اختياري)</FormLabel>
                  <FormControl>
                    <Input type="password" dir="ltr" className="text-right" placeholder="اترك الحقل فارغاً إذا لم ترد التغيير" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-100 p-4 bg-gray-50/50 mt-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-bold text-gray-700">تفعيل الحساب</FormLabel>
                    <p className="text-sm text-gray-500">
                      إلغاء التفعيل سيمنع المعلم من تسجيل الدخول للنظام.
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="data-[state=checked]:bg-green-500"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={updateMutation.isPending}>
                إلغاء
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                تحديث البيانات
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
