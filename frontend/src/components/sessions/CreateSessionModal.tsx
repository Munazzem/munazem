'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSession } from '@/lib/api/sessions';
import { fetchGroups } from '@/lib/api/groups';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';

const schema = z.object({
    groupId: z.string().min(1, 'اختر مجموعة'),
    date: z.string().min(1, 'اختر تاريخ'),
    startTime: z.string().min(1, 'اختر وقت البدء'),
});

type FormValues = z.infer<typeof schema>;

interface CreateSessionModalProps {
    onSuccess?: () => void;
}

export function CreateSessionModal({ onSuccess }: CreateSessionModalProps) {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data: groupsData } = useQuery({
        queryKey: ['groups'],
        queryFn: () => fetchGroups({ limit: 100 }),
        enabled: open,
    });

    const groups = groupsData?.data ?? [];

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            groupId: '',
            date: new Date().toISOString().split('T')[0],
            startTime: '',
        },
    });

    const mutation = useMutation({
        mutationFn: createSession,
        onSuccess: () => {
            toast.success('تم إنشاء الحصة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
            setOpen(false);
            form.reset();
            onSuccess?.();
        },
        onError: (err: any) => {
            
        },
    });

    const onSubmit = (values: FormValues) => {
        mutation.mutate(values);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    إنشاء حصة
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle>إنشاء حصة جديدة</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                        <FormField
                            control={form.control}
                            name="groupId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>المجموعة</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="اختر مجموعة..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {groups.map((g) => (
                                                <SelectItem key={g._id} value={g._id}>
                                                    {g.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>التاريخ</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="startTime"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>وقت البدء</FormLabel>
                                    <FormControl>
                                        <Input type="time" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                disabled={mutation.isPending}
                            >
                                إلغاء
                            </Button>
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                                إنشاء الحصة
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
