/**
 * tests/unit/barcode.util.test.ts
 *
 * Unit tests for the Barcode generator.
 */

import { describe, it, expect, vi } from 'vitest';
import bwipjs from 'bwip-js';
import { BarcodeUtil } from '../../src/common/utils/barcode.util.js';

// Mock bwip-js
vi.mock('bwip-js', () => ({
    default: {
        toBuffer: vi.fn(),
    }
}));

describe('Barcode Util', () => {
    it('يجب أن يولد باركود Base64 صحيح للنص المعطى', async () => {
        // Setup mock to simulate successful generation
        const mockBuffer = Buffer.from('fake-png-data');
        (bwipjs.toBuffer as any).mockImplementation((_options: any, callback: any) => {
            callback(null, mockBuffer);
        });

        const result = await BarcodeUtil.generateBase64Barcode('1A');

        expect(bwipjs.toBuffer).toHaveBeenCalledWith(
            expect.objectContaining({ text: '1A' }),
            expect.any(Function)
        );
        expect(result).toBe('data:image/png;base64,ZmFrZS1wbmctZGF0YQ=='); // Base64 of 'fake-png-data'
    });

    it('يجب أن يرفض النص الفارغ', async () => {
        await expect(BarcodeUtil.generateBase64Barcode('')).rejects.toThrow('Barcode text cannot be empty or just whitespace');
        await expect(BarcodeUtil.generateBase64Barcode('   ')).rejects.toThrow('Barcode text cannot be empty or just whitespace');
    });

    it('يجب أن يرمي خطأ إذا فشل توليد الباركود', async () => {
        // Setup mock to simulate error
        (bwipjs.toBuffer as any).mockImplementation((_options: any, callback: any) => {
            callback(new Error('Generator error'), null);
        });

        await expect(BarcodeUtil.generateBase64Barcode('1A')).rejects.toThrow('Failed to generate barcode image');
    });
});
