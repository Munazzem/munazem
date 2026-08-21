'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createStudent } from '@/lib/api/students';
import { fetchGroups } from '@/lib/api/groups';
import { useAuthStore } from '@/lib/store/auth.store';
import { getAllowedGrades } from '@/lib/utils/grades';
import { toast } from 'sonner';
import { Plus, Loader2, AlertTriangle, Users } from 'lucide-react';
import { QK } from '@/lib/query-keys';
import { checkDuplicateStudent, type DuplicateCheckResult } from '@/lib/api/students';

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const newCard = searchParams?.get('newCard');

  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const allowedGrades = getAllowedGrades(user?.stages);

  // Define the form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      studentPhone: '',
      parentPhone: '',
      gradeLevel: '',
      groupId: '',
      barcode: newCard || '',
    },
  });

  // Automatically open modal and set barcode if newCard is present in URL
  useEffect(() => {
    if (newCard) {
      setOpen(true);
      form.setValue('barcode', newCard);
    }
  }, [newCard, form]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      form.reset();
      if (newCard) {
        // Clear the search param when closing the modal so it doesn't reopen on refresh
        router.replace('/students', { scroll: false });
      }
    }
  };

  // Fetch Teacher's Groups dynamically
  const { data: groupsData, isLoading: isLoadingGroups } = useQuery({
      queryKey: QK.groups.forAddStudent,
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
  
  // Watch fields for duplicate detection and group filtering
  const watchedFullName = useWatch({ control: form.control, name: 'fullName' });
  const watchedStudentPhone = useWatch({ control: form.control, name: 'studentPhone' });
  const watchedParentPhone = useWatch({ control: form.control, name: 'parentPhone' });
  const selectedGradeLevel = useWatch({ control: form.control, name: 'gradeLevel' });

  const filteredGroups = selectedGradeLevel 
        ? groups.filter(g => g.gradeLevel === selectedGradeLevel)
        : groups;

  // Real-time duplicate student check
  const { data: duplicateResult } = useQuery<DuplicateCheckResult>({
    queryKey: ['check-duplicate-student', watchedFullName, watchedStudentPhone, watchedParentPhone, selectedGradeLevel],
    queryFn: () => checkDuplicateStudent({
      fullName: watchedFullName,
      studentPhone: watchedStudentPhone || undefined,
      parentPhone: watchedParentPhone || undefined,
      gradeLevel: selectedGradeLevel || undefined,
    }),
    enabled: !!(watchedFullName && watchedFullName.trim().length >= 3 && (watchedStudentPhone?.length === 11 || watchedParentPhone?.length === 11)),
    staleTime: 1000 * 30,
  });

  // Mutation for creating a student
  const mutation = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      toast.success('تمت إضافة الطالب بنجاح');
      queryClient.invalidateQueries({ queryKey: QK.students.all });
      form.reset();
      handleOpenChange(false); // Close Modal on success
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'حدث خطأ أثناء إضافة الطالب';
      toast.error(message);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (duplicateResult?.isDuplicate) {
      toast.error(duplicateResult.message || 'هذا الطالب مسجل بالفعل مسبقاً');
      return;
    }
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="font-bold flex items-center gap-2">
            <Plus size={18} />
            إضافة طالب جديد
        </Button>
      </DialogTrigger>
      <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl">طالب جديد</DialogTitle>
          <DialogDescription>
            أدخل بيانات الطالب هنا. تأكد من صحة أرقام الهواتف واختيار المرحلة.
          </DialogDescription>
          {newCard && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg text-sm mt-2 flex items-center gap-2">
                  <span className="font-bold">✨ سيتم ربط الكارت:</span>
                  <span className="font-mono">{newCard}</span>
              </div>
          )}
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

            {/* Duplicate Student Alert */}
            {duplicateResult?.isDuplicate && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-start gap-2.5 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-red-900">تنبيه: الطالب مسجل بالفعل في المنظومة!</p>
                  <p className="leading-relaxed text-red-800">{duplicateResult.message}</p>
                </div>
              </div>
            )}

            {/* Siblings (Different name, same parent phone) -> Allowed info banner */}
            {duplicateResult?.isSibling && !duplicateResult.isDuplicate && (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-xl text-xs flex items-start gap-2.5 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                <Users className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-blue-950">ملاحظة: رقم ولي الأمر مسجل مسبقاً (إخوة)</p>
                  <p className="leading-relaxed text-blue-800">{duplicateResult.message}</p>
                </div>
              </div>
            )}

            <Button 
                type="submit" 
                className="w-full font-bold mt-4" 
                disabled={mutation.isPending || duplicateResult?.isDuplicate}
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
