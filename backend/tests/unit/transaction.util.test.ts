/**
 * tests/unit/transaction.util.test.ts
 *
 * Unit tests for the transaction wrapper.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { withTransaction } from '../../src/common/utils/transaction.util.js';

// Mock mongoose
vi.mock('mongoose', () => ({
    default: {
        startSession: vi.fn(),
    },
}));

describe('Transaction Util', () => {
    let originalDisableTransactions: string | undefined;

    beforeEach(() => {
        originalDisableTransactions = process.env.DISABLE_TRANSACTIONS;
    });

    afterEach(() => {
        vi.clearAllMocks();
        if (originalDisableTransactions !== undefined) {
            process.env.DISABLE_TRANSACTIONS = originalDisableTransactions;
        } else {
            delete process.env.DISABLE_TRANSACTIONS;
        }
    });

    it('يجب أن يتخطى الـ Transaction إذا كان DISABLE_TRANSACTIONS="true"', async () => {
        process.env.DISABLE_TRANSACTIONS = 'true';

        const mockFn = vi.fn().mockResolvedValue('success');
        const result = await withTransaction(mockFn);

        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledWith(undefined);
        expect(mongoose.startSession).not.toHaveBeenCalled();
    });

    it('يجب أن يبدأ وينهي الـ Transaction بنجاح', async () => {
        process.env.DISABLE_TRANSACTIONS = 'false';

        const mockSession = {
            startTransaction: vi.fn(),
            commitTransaction: vi.fn(),
            abortTransaction: vi.fn(),
            endSession: vi.fn(),
        };

        (mongoose.startSession as any).mockResolvedValue(mockSession);

        const mockFn = vi.fn().mockResolvedValue('success');
        const result = await withTransaction(mockFn);

        expect(result).toBe('success');
        expect(mongoose.startSession).toHaveBeenCalled();
        expect(mockSession.startTransaction).toHaveBeenCalled();
        expect(mockFn).toHaveBeenCalledWith(mockSession);
        expect(mockSession.commitTransaction).toHaveBeenCalled();
        expect(mockSession.endSession).toHaveBeenCalled();
        expect(mockSession.abortTransaction).not.toHaveBeenCalled();
    });

    it('يجب أن يلغي الـ Transaction (abort) في حالة وجود خطأ', async () => {
        process.env.DISABLE_TRANSACTIONS = 'false';

        const mockSession = {
            startTransaction: vi.fn(),
            commitTransaction: vi.fn(),
            abortTransaction: vi.fn(),
            endSession: vi.fn(),
        };

        (mongoose.startSession as any).mockResolvedValue(mockSession);

        const testError = new Error('Test Error');
        const mockFn = vi.fn().mockRejectedValue(testError);

        await expect(withTransaction(mockFn)).rejects.toThrow('Test Error');

        expect(mongoose.startSession).toHaveBeenCalled();
        expect(mockSession.startTransaction).toHaveBeenCalled();
        expect(mockFn).toHaveBeenCalledWith(mockSession);
        expect(mockSession.commitTransaction).not.toHaveBeenCalled();
        expect(mockSession.abortTransaction).toHaveBeenCalled();
        expect(mockSession.endSession).toHaveBeenCalled();
    });
});
