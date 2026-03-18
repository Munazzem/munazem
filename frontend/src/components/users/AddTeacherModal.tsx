'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addUser } from '@/lib/api/users';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { TeacherStage } from '@/types/user.types';

const teacherSchema = z.object({
  name: z.string().min(3, 'الاسم يجب أن يكون 3 أحرف على الأقل'),
  phone: z.string().min(10, 'رقم الهاتف غير صحيح'),
  email: z.string().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  stage: z.nativeEnum(TeacherStage),
});

export function AddTeacherModal() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof teacherSchema>>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      password: '',
      stage: TeacherStage.preparatory,
    },
  });

  const createMutation = useMutation({
    mutationFn: addUser,
    onSuccess: () => {
      toast.success('تم إضافة المعلم بنجاح');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      form.reset();
      setOpen(false);
    },
    onError: (error: any) => {
      
    },
  });

  const onSubmit = (values: z.infer<typeof teacherSchema>) => {
    createMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
        setOpen(val);
        if(!val) form.reset();
    }}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-white flex items-center gap-2">
          <Plus size={18} />
          <span>إضافة معلم جديد</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[500px] bg-white rounded-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900 border-b pb-4">إضافة معلم جديد</DialogTitle>
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
                    <FormLabel>المرحلة الدراسية <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <FormLabel>كلمة المرور الابتدائية <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input type="password" dir="ltr" className="text-right" placeholder="******" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createMutation.isPending}>
                إلغاء
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                حفظ المعلم
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
