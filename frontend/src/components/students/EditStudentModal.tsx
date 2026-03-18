'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { updateStudent } from '@/lib/api/students';
import { fetchGroups } from '@/lib/api/groups';
import type { StudentWithGroup } from '@/types/student.types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// --- Form Validation Schema ---
const formSchema = z.object({
  fullName: z.string().min(5, { message: 'الاسم يجب أن يكون 5 أحرف على الأقل' }),
  studentPhone: z.string().regex(/^01[0-2,5]{1}[0-9]{8}$/, { message: 'رقم هاتف الطالب غير صالح' }),
  parentPhone: z.string().regex(/^01[0-2,5]{1}[0-9]{8}$/, { message: 'رقم هاتف ولي الأمر غير صالح' }),
  gradeLevel: z.string().min(1, { message: 'الرجاء اختيار المرحلة الدراسية' }),
  groupId: z.string().min(1, { message: 'الرجاء اختيار المجموعة' }),
  barcode: z.string().optional(),
  isActive: z.boolean().optional(),
});

// Types for fetched groups
interface Group {
    _id: string;
    name: string;
    gradeLevel: string;
}

interface EditStudentModalProps {
    student: StudentWithGroup | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditStudentModal({ student, open, onOpenChange }: EditStudentModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      studentPhone: '',
      parentPhone: '',
      gradeLevel: '',
      groupId: '',
      barcode: '',
      isActive: true,
    },
  });

  // Fetch Teacher's Groups dynamically
  const { data: groupsData, isLoading: isLoadingGroups } = useQuery({
      queryKey: ['teacherGroups_editStudent'],
      queryFn: () => fetchGroups({ limit: 100 }),
  });

  const groups: Group[] = groupsData?.data || [];
  
  // Extract unique grade levels from the groups
  const availableGradeLevels = Array.from(new Set(groups.map(g => g.gradeLevel)));
  
  // Watch the selected gradeLevel to filter the groups dropdown
  const selectedGradeLevel = useWatch({ control: form.control, name: 'gradeLevel' });
  const filteredGroups = selectedGradeLevel 
        ? groups.filter(g => g.gradeLevel === selectedGradeLevel)
        : groups;

  // Populate form when modal opens with a selected student
  useEffect(() => {
      if (student && open) {
          form.reset({
              fullName: student.studentName,
              studentPhone: student.studentPhone,
              parentPhone: student.parentPhone,
              gradeLevel: student.gradeLevel,
              groupId: typeof student.groupId === 'string' ? student.groupId : (student.groupId?._id || ''),
              barcode: student.barcode || '',
              isActive: student.isActive,
          });
      }
  }, [student, open, form]);

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => {
        if (!student) throw new Error('لا يوجد طالب محدد');
        return updateStudent(student._id, data);
    },
    onSuccess: () => {
      toast.success('تم تحديث بيانات الطالب بنجاح');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      onOpenChange(false);
    },
    onError: (error: { response?: { data?: { message?: string } } } | Error) => {
        const err = error as { response?: { data?: { message?: string } } };
      
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  if (!student) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl">تعديل بيانات الطالب</DialogTitle>
          <DialogDescription>
            تحديث معلومات الطالب ({student.studentName}).
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الاسم الكامل <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="studentPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>هاتف الطالب <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                        <Input dir="ltr" className="text-right" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parentPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>هاتف ولي الأمر <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input dir="ltr" className="text-right" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="gradeLevel"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>المرحلة الدراسية <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent dir="rtl">
                            {availableGradeLevels.map((grade) => (
                                <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                            ))}
                            {availableGradeLevels.length === 0 && (
                                <div className="p-2 text-sm text-center text-gray-500">لا توجد مجموعات مسجلة بعد</div>
                            )}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control}
                name="groupId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>المجموعة <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedGradeLevel || isLoadingGroups}>
                        <FormControl>
                        <SelectTrigger><SelectValue placeholder={!selectedGradeLevel ? 'اختر المرحلة أولاً' : 'اختر...'} /></SelectTrigger>
                        </FormControl>
                        <SelectContent dir="rtl">
                            {filteredGroups.map((group) => (
                                <SelectItem key={group._id} value={group._id}>{group.name}</SelectItem>
                            ))}
                            {filteredGroups.length === 0 && selectedGradeLevel && (
                                <div className="p-2 text-sm text-center text-gray-500">لا توجد مجموعات في هذه المرحلة</div>
                            )}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:items-end">
                <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>الباركود (اختياري)</FormLabel>
                    <FormControl>
                        <Input dir="ltr" className="text-right" disabled placeholder="STU-XXX" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm h-10 mt-2 sm:mt-0">
                        <div className="space-y-0.5">
                            <FormLabel className="text-sm font-bold text-gray-700">تفعيل حساب الطالب</FormLabel>
                        </div>
                        <FormControl>
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 text-primary rounded focus:ring-primary border-gray-300 ml-2" 
                                checked={field.value} 
                                onChange={field.onChange} 
                            />
                        </FormControl>
                    </FormItem>
                )}
                />
            </div>

            <Button 
                type="submit" 
                className="w-full font-bold mt-4" 
                disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                  <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الحفظ...</>
              ) : 'حفظ التعديلات'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
