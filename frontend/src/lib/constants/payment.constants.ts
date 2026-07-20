import type { TransactionCategory } from '@/types/payment.types';

/**
 * Human-readable Arabic labels for each transaction category.
 * Used in dropdowns, tables, and reports.
 */
export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
    SUBSCRIPTION:         'اشتراك طالب',
    NOTEBOOK_SALE:        'بيع مذكرة',
    NOTEBOOK_RESERVATION: 'عربون حجز مذكرة',
    NOTEBOOK_DELIVERY:    'استكمال ثمن مذكرة',
    OTHER_INCOME:         'دخل آخر',
    DEBT_PAYMENT:         'سداد باقي مصاريف',
    SALARY:               'رواتب',
    RENT:                 'إيجار',
    SUPPLIES:             'مستلزمات',
    OTHER_EXPENSE:        'مصروف آخر',
};

/**
 * Categories that represent outgoing money (expenses).
 * Used to filter/render expense-only dropdowns.
 */
export const EXPENSE_CATEGORIES: TransactionCategory[] = [
    'SALARY', 'RENT', 'SUPPLIES', 'OTHER_EXPENSE',
];

/**
 * Categories that represent incoming money (income).
 */
export const INCOME_CATEGORIES: TransactionCategory[] = [
    'SUBSCRIPTION', 'NOTEBOOK_SALE', 'NOTEBOOK_RESERVATION', 'NOTEBOOK_DELIVERY', 'OTHER_INCOME', 'DEBT_PAYMENT',
];
