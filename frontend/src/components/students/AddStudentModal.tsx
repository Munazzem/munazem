'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createStudent } from '@/lib/api/students';
import { fetchGroups } from '@/lib/api/groups';
import { useAuthStore } from '@/lib/store/auth.store';
import { getAllowedGrades } from '@/lib/utils/grades';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
});

// Types for fetched groups
interface Group {
    _id: string;
    name: string;
    gradeLevel: string;
}

export function AddStudentModal() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const allowedGrades = getAllowedGrades(user?.stage);

  // Define the form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      studentPhone: '',
      parentPhone: '',
      gradeLevel: '',
      groupId: '',
    },
  });

  // Fetch Teacher's Groups dynamically
  const { data: groupsData, isLoading: isLoadingGroups } = useQuery({
      queryKey: ['teacherGroups_addStudent'],
      queryFn: () => fetchGroups({ limit: 100 }),
  });

  const rawGroupsData = groupsData as any;
  const groups: Group[] = Array.isArray(rawGroupsData?.data?.data) 
    ? rawGroupsData.data.data 
    : Array.isArray(rawGroupsData?.data) 
        ? rawGroupsData.data 
        : [];
  
  // Extract unique grade levels from groups, filtered by teacher's allowed stage
  const availableGradeLevels = Array.from(
    new Set(groups.map(g => g.gradeLevel).filter(g => allowedGrades.includes(g)))
  );
  
  // Watch the selected gradeLevel to filter the groups dropdown
  const selectedGradeLevel = useWatch({ control: form.control, name: 'gradeLevel' });
  const filteredGroups = selectedGradeLevel 
        ? groups.filter(g => g.gradeLevel === selectedGradeLevel)
        : groups;

  // Mutation for creating a student
  const mutation = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      toast.success('تمت إضافة الطالب بنجاح');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      form.reset();
      setOpen(false); // Close Modal on success
    },
    onError: (error: { response?: { data?: { message?: string } } } | Error) => {
        const err = error as { response?: { data?: { message?: string } } };
      
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-bold flex items-center gap-2">
            <Plus size={18} />
            إضافة طالب جديد
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl">طالب جديد</DialogTitle>
          <DialogDescription>
            أدخل بيانات الطالب هنا. تأكد من صحة أرقام الهواتف واختيار المرحلة.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Full Name */}
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الاسم الثلاثي أو الرباعي <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="أحمد محمد إبراهيم" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Student Phone */}
              <FormField
                control={form.control}
                name="studentPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>هاتف الطالب <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                        <Input dir="ltr" className="text-right" placeholder="01xxxxxxxxx" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Parent Phone */}
              <FormField
                control={form.control}
                name="parentPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>هاتف ولي الأمر <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input dir="ltr" className="text-right" placeholder="01xxxxxxxxx" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

                {/* Grade Level */}
                <FormField
                control={form.control}
                name="gradeLevel"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>المرحلة الدراسية <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="اختر..." />
                        </SelectTrigger>
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

                {/* Group ID */}
                <FormField
                control={form.control}
                name="groupId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>المجموعة <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedGradeLevel || isLoadingGroups}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder={!selectedGradeLevel ? 'اختر المرحلة أولاً' : 'اختر...'} />
                        </SelectTrigger>
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

            <Button 
                type="submit" 
                className="w-full font-bold mt-4" 
                disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                  <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الإضافة...
                  </>
              ) : 'حفظ بيانات الطالب'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
