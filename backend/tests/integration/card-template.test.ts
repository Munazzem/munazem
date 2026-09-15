import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import 'multer';
import { CardTemplateService } from '../../src/modules/cards/card-template.service.js';
import { CardPvcPdfService } from '../../src/modules/cards/card-pvc-pdf.service.js';
import { CardModel } from '../../src/database/models/card.model.js';
import { CardTemplateModel } from '../../src/database/models/card-template.model.js';
import { writePsd } from 'ag-psd';
import { createCanvas } from '@napi-rs/canvas';

describe('Card Template & PVC Print Service', () => {
    const teacherId = new mongoose.Types.ObjectId().toString();

    beforeEach(async () => {
        await CardTemplateModel.deleteMany({});
        await CardModel.deleteMany({});
    });

    it('يجب معالجة ملف PSD والتعرف على طبقات QR_CODE ورقم الكارت وحفظ القالب', async () => {
        // Create synthetic PSD with canvas and layers
        const canvas = createCanvas(1000, 600);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(0, 0, 1000, 600);

        const layerCanvas = createCanvas(300, 300);
        const lctx = layerCanvas.getContext('2d');
        lctx.fillStyle = '#000000';
        lctx.fillRect(0, 0, 300, 300);

        const textCanvas = createCanvas(600, 60);
        const tctx = textCanvas.getContext('2d');
        tctx.fillStyle = '#000000';
        tctx.fillRect(0, 0, 600, 60);

        const psdBuf = writePsd({
            width: 1000,
            height: 600,
            canvas: canvas as any,
            children: [
                {
                    name: 'QR_CODE',
                    left: 350,
                    top: 150,
                    canvas: layerCanvas as any
                },
                {
                    name: 'CARD_NUMBER',
                    left: 200,
                    top: 500,
                    canvas: textCanvas as any
                }
            ]
        });

        const mockFile = {
            originalname: 'student_card_back.psd',
            mimetype: 'application/x-photoshop',
            buffer: Buffer.from(psdBuf)
        } as Express.Multer.File;

        const result = await CardTemplateService.uploadAndProcessDesign(teacherId, mockFile, 'back');

        expect(result).toBeDefined();
        expect(result.format).toBe('psd');
        expect(result.detectedLayers?.qrCode).toBe(true);
        expect(result.detectedLayers?.cardNumber).toBe(true);
        expect(result.template.qrCode.xPercent).toBeCloseTo(50, 0);
        expect(result.template.qrCode.yPercent).toBeCloseTo(50, 0);
        expect(result.template.qrCode.sizePercent).toBeCloseTo(30, 0);
        expect(result.template.backImageUrl).toContain('data:image/jpeg;base64,');
    });

    it('يجب إمكانية تعديل إحداثيات القالب وحجم الخط ولون الرقم', async () => {
        // Create placeholder template first
        await CardTemplateModel.create({
            teacherId: new mongoose.Types.ObjectId(teacherId),
            backImageUrl: 'data:image/jpeg;base64,/9j/fake',
            qrCode: { xPercent: 50, yPercent: 50, sizePercent: 30 },
            cardNumber: { xPercent: 50, yPercent: 85, fontSizePt: 11, color: '#000000', show: true }
        });

        const updated = await CardTemplateService.updateTemplate(teacherId, {
            qrCode: { xPercent: 65, yPercent: 40, sizePercent: 28 },
            cardNumber: { xPercent: 65, yPercent: 80, fontSizePt: 14, color: '#ffffff', show: true }
        });

        expect(updated.qrCode.xPercent).toBe(65);
        expect(updated.qrCode.yPercent).toBe(40);
        expect(updated.cardNumber.color).toBe('#ffffff');
        expect(updated.cardNumber.fontSizePt).toBe(14);
    });

    it('يجب توليد صفحة طباعة PVC بمقاسات CR80 القياسية (85.6mm × 53.98mm)', async () => {
        const batchId = 'test-batch-uuid';

        // Seed a blank card
        await CardModel.create({
            cardNumber: 'MNZ-TEST-00001',
            cardToken: 'sample-uuid-token-1234',
            teacherId: new mongoose.Types.ObjectId(teacherId),
            batchId,
            status: 'NEW'
        });

        await CardTemplateModel.create({
            teacherId: new mongoose.Types.ObjectId(teacherId),
            backImageUrl: 'data:image/jpeg;base64,/9j/fake-back',
            qrCode: { xPercent: 50, yPercent: 50, sizePercent: 35 },
            cardNumber: { xPercent: 50, yPercent: 85, fontSizePt: 12, color: '#000000', show: true }
        });

        const html = await CardPvcPdfService.generatePvcHtml(batchId, teacherId, 'back_only');

        expect(html).toContain('85.6mm 53.98mm');
        expect(html).toContain('MNZ-TEST-00001');
        expect(html).toContain('pvc-page');
        expect(html).toContain('qr-container');
        expect(html).toContain('card-number-text');
    });
});
