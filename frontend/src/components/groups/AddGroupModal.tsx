'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createGroup } from '@/lib/api/groups';
import { useAuthStore } from '@/lib/store/auth.store';
import { getAllowedGrades } from '@/lib/utils/grades';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';

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

const DAYS_OF_WEEK_LIST = [
    "السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"
];


const groupSchema = z.object({
  name: z.string().min(2, 'اسم المجموعة يجب أن يكون حرفين على الأقل'),
  gradeLevel: z.string().min(1, 'المرحلة الدراسية مطلوبة'),
  capacity: z.number().min(1, 'السعة يجب أن تكون رقم صحيح موجب'),
  schedule: z.array(z.object({
      day: z.string().min(1, 'اليوم مطلوب'),
      time: z.string().min(1, 'الوقت مطلوب')
  })).min(1, 'يجب إضافة موعد واحد على الأقل للمجموعة')
});

export function AddGroupModal() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const allowedGrades = getAllowedGrades(user?.stage);

  const form = useForm<z.infer<typeof groupSchema>>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: '',
      gradeLevel: '',
      capacity: 50,
      schedule: [{ day: '', time: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
      control: form.control,
      name: 'schedule'
  });

  const createMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      toast.success('تم إنشاء المجموعة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      form.reset();
      setOpen(false);
    },
    onError: (error: { response?: { data?: { message?: string } } } | Error) => {
        const err = error as { response?: { data?: { message?: string } } };
      
    },
  });

  const onSubmit = (values: z.infer<typeof groupSchema>) => {
    createMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
        setOpen(val);
        if(!val) form.reset();
    }}>
      <DialogTrigger asChild>
        <Button className="bg-[#0f4c81] hover:bg-[#0a3357] text-white flex items-center gap-2">
          <Plus size={18} />
          <span>إضافة مجموعة</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px] bg-white rounded-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900 border-b pb-4">إضافة مجموعة جديدة</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem className="col-span-2 sm:col-span-1">
                    <FormLabel>اسم المجموعة <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                        <Input placeholder="مثال: مجموعة الأحد والأربعاء" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control}
                name="gradeLevel"
                render={({ field }) => (
                    <FormItem className="col-span-2 sm:col-span-1">
                    <FormLabel>المرحلة الدراسية <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger><SelectValue placeholder="اختر المرحلة" /></SelectTrigger>
                        </FormControl>
                        <SelectContent dir="rtl">
                            {allowedGrades.map((grade) => (
                                <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                    <FormItem className="col-span-2 sm:col-span-1">
                    <FormLabel>السعة القصوى (عدد الطلاب)</FormLabel>
                    <FormControl>
                        <Input 
                            type="number" 
                            dir="ltr" 
                            className="text-right" 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)} 
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
                    <h4 className="font-bold text-gray-700">مواعيد الحصص</h4>
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => append({ day: '', time: '' })}
                        className="h-8 text-xs bg-white"
                    >
                        <Plus size={14} className="mr-1 ml-1" /> إضافة موعد
                    </Button>
                </div>
                
                <div className="space-y-3">
                    {fields.map((field, index) => (
                        <div key={field.id} className="flex items-start gap-2 bg-white p-3 rounded-lg border border-gray-100">
                            <FormField
                                control={form.control}
                                name={`schedule.${index}.day`}
                                render={({ field: dField }) => (
                                    <FormItem className="flex-1">
                                        <Select onValueChange={dField.onChange} defaultValue={dField.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="يوم" /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent dir="rtl">
                                                {DAYS_OF_WEEK_LIST.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage className="text-xs" />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name={`schedule.${index}.time`}
                                render={({ field: tField }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <Input type="time" dir="ltr" className="h-9 text-center" {...tField} />
                                        </FormControl>
                                        <FormMessage className="text-xs" />
                                    </FormItem>
                                )}
                            />

                            {fields.length > 1 && (
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                                    onClick={() => remove(index)}
                                >
                                    <Trash2 size={16} />
                                </Button>
                            )}
                        </div>
                    ))}
                    {form.formState.errors.schedule && !Array.isArray(form.formState.errors.schedule) && (
                        <p className="text-sm font-medium text-red-500 mt-2">{form.formState.errors.schedule.message}</p>
                    )}
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createMutation.isPending}>
                إلغاء
              </Button>
              <Button type="submit" className="bg-[#0f4c81] hover:bg-[#0a3357]" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                حفظ المجموعة
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
