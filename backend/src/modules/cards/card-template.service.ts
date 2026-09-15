import mongoose from 'mongoose';
import 'multer';
import { CardTemplateModel } from '../../database/models/card-template.model.js';
import type { ICardTemplate, UpdateCardTemplateDTO } from '../../types/card-template.types.js';
import { BadRequestException, NotFoundException } from '../../common/utils/response/error.responce.js';
import { initializeCanvas, readPsd } from 'ag-psd';
import { createCanvas, ImageData, loadImage } from '@napi-rs/canvas';

// Initialize ag-psd once with @napi-rs/canvas
try {
    initializeCanvas(
        createCanvas as any,
        ((w: number, h: number) => new ImageData(w, h)) as any
    );
} catch (err) {
    console.warn('Canvas initialization warning in card-template.service:', err);
}

// CR80 Card Resolution at 300 DPI (standard PVC ID card size)
const CR80_WIDTH_PX = 1011;  // 85.6mm at 300 DPI
const CR80_HEIGHT_PX = 638;  // 53.98mm at 300 DPI

function getAllLayers(children: any[] = []): any[] {
    const list: any[] = [];
    for (const child of children) {
        list.push(child);
        if (child.children && child.children.length > 0) {
            list.push(...getAllLayers(child.children));
        }
    }
    return list;
}

function clamp(val: number, min: number, max: number): number {
    return Math.min(Math.max(val, min), max);
}

function round1(val: number): number {
    return Math.round(val * 10) / 10;
}

export interface UploadDesignResult {
    template: any;
    detectedLayers?: {
        qrCode: boolean;
        qrLayerName?: string | undefined;
        cardNumber: boolean;
        cardNumLayerName?: string | undefined;
    };
    format: 'psd' | 'image';
    message: string;
}

export class CardTemplateService {

    /**
     * Get or create default template for teacher
     */
    static async getTemplate(teacherId: string) {
        return CardTemplateModel.findOne({ teacherId: new mongoose.Types.ObjectId(teacherId) }).lean();
    }

    /**
     * Update template coordinates / styling
     */
    static async updateTemplate(teacherId: string, dto: UpdateCardTemplateDTO) {
        const template = await CardTemplateModel.findOneAndUpdate(
            { teacherId: new mongoose.Types.ObjectId(teacherId) },
            { $set: dto },
            { new: true, upsert: false }
        ).lean();

        if (!template) {
            throw NotFoundException({ message: 'لم يتم العثور على قالب كروت مخصص لهذا المعلم. يرجى رفع التصميم أولاً.' });
        }

        return template;
    }

    /**
     * Delete custom template
     */
    static async deleteTemplate(teacherId: string) {
        const result = await CardTemplateModel.findOneAndDelete({ teacherId: new mongoose.Types.ObjectId(teacherId) });
        return { deleted: !!result };
    }

    /**
     * Process uploaded design file (.psd or .png/.jpg)
     */
    static async uploadAndProcessDesign(
        teacherId: string,
        file: Express.Multer.File,
        target: 'back' | 'front' = 'back'
    ): Promise<UploadDesignResult> {
        if (!file || !file.buffer) {
            throw BadRequestException({ message: 'لم يتم استلام أي ملف تصميم' });
        }

        const fileName = (file.originalname || '').toLowerCase();
        const isPsd = fileName.endsWith('.psd') || file.mimetype === 'image/vnd.adobe.photoshop' || file.mimetype === 'application/x-photoshop';
        const isImage = /\.(png|jpe?g|webp)$/i.test(fileName) || file.mimetype.startsWith('image/');

        if (!isPsd && !isImage) {
            throw BadRequestException({ message: 'نوع الملف غير مدعوم. يرجى رفع ملف بصيغة PSD أو PNG أو JPG' });
        }

        let renderedDataUrl = '';
        let detectedQr: { xPercent: number; yPercent: number; sizePercent: number; layerName?: string } | null = null;
        let detectedCardNum: { xPercent: number; yPercent: number; fontSizePt: number; color: string; show: boolean; layerName?: string } | null = null;

        if (isPsd) {
            let psd: any;
            try {
                psd = readPsd(file.buffer);
            } catch (err: any) {
                throw BadRequestException({
                    message: `تعذر قراءة ملف PSD: ${err.message || 'الملف تالف أو غير مدعوم'}. يرجى التأكد من حفظ الملف في Photoshop.`
                });
            }

            if (!psd || !psd.canvas) {
                throw BadRequestException({
                    message: 'ملف PSD لا يحتوي على طبقة مجمعة جاهزة للعرض. يرجى التأكد من تفعيل خيار "Maximize Compatibility" عند حفظ ملف الفوتوشوب، أو رفع التصميم كصورة PNG / JPG عالية الدقة.'
                });
            }

            // Scale PSD composite canvas to CR80 300DPI canvas
            const targetCanvas = createCanvas(CR80_WIDTH_PX, CR80_HEIGHT_PX);
            const ctx = targetCanvas.getContext('2d');
            ctx.drawImage(psd.canvas, 0, 0, CR80_WIDTH_PX, CR80_HEIGHT_PX);
            renderedDataUrl = targetCanvas.toDataURL('image/jpeg', 0.92);

            // Layer detection only relevant for Back Face
            if (target === 'back') {
                const psdWidth = psd.width || CR80_WIDTH_PX;
                const psdHeight = psd.height || CR80_HEIGHT_PX;
                const allLayers = getAllLayers(psd.children || []);

                // 1. Search for QR Code layer
                const qrRegex = /(qr(_code)?|qrcode|باركود|كود)/i;
                const qrLayer = allLayers.find(l => l.name && qrRegex.test(l.name));
                if (qrLayer) {
                    const lLeft = qrLayer.left ?? 0;
                    const layerW = qrLayer.canvas?.width || Math.max(0, (qrLayer.right ?? lLeft) - lLeft);
                    const layerH = qrLayer.canvas?.height || Math.max(0, (qrLayer.bottom ?? (qrLayer.top ?? 0)) - (qrLayer.top ?? 0));
                    const lRight = qrLayer.right && qrLayer.right > lLeft ? qrLayer.right : (lLeft + layerW);
                    const lTop = qrLayer.top ?? 0;
                    const lBottom = qrLayer.bottom && qrLayer.bottom > lTop ? qrLayer.bottom : (lTop + layerH);

                    const cx = layerW > 0 ? ((lLeft + lRight) / 2 / psdWidth) * 100 : (lLeft / psdWidth) * 100;
                    const cy = layerH > 0 ? ((lTop + lBottom) / 2 / psdHeight) * 100 : (lTop / psdHeight) * 100;
                    const sizeP = layerW > 0 ? (layerW / psdWidth) * 100 : 32;

                    detectedQr = {
                        xPercent: round1(clamp(cx, 10, 90)),
                        yPercent: round1(clamp(cy, 10, 90)),
                        sizePercent: round1(clamp(sizeP, 15, 60)),
                        layerName: qrLayer.name
                    };
                }

                // 2. Search for Card Number layer
                const cardNumRegex = /(card(_)?(number|no|num)|number|رقم(_)?الكارت|رقم)/i;
                const numLayer = allLayers.find(l => l.name && cardNumRegex.test(l.name));
                if (numLayer) {
                    const lLeft = numLayer.left ?? 0;
                    const layerW = numLayer.canvas?.width || Math.max(0, (numLayer.right ?? lLeft) - lLeft);
                    const layerH = numLayer.canvas?.height || Math.max(0, (numLayer.bottom ?? (numLayer.top ?? 0)) - (numLayer.top ?? 0));
                    const lRight = numLayer.right && numLayer.right > lLeft ? numLayer.right : (lLeft + layerW);
                    const lTop = numLayer.top ?? 0;
                    const lBottom = numLayer.bottom && numLayer.bottom > lTop ? numLayer.bottom : (lTop + layerH);

                    const cx = layerW > 0 ? ((lLeft + lRight) / 2 / psdWidth) * 100 : (lLeft / psdWidth) * 100;
                    const cy = layerH > 0 ? ((lTop + lBottom) / 2 / psdHeight) * 100 : (lTop / psdHeight) * 100;

                    // Extract color if available
                    let textColor = '#000000';
                    let fontPt = 11;
                    if (numLayer.text && numLayer.text.style) {
                        if (numLayer.text.style.fontSize) {
                            fontPt = Math.round(numLayer.text.style.fontSize * (72 / (psd.resolution || 300)));
                            fontPt = clamp(fontPt, 8, 24);
                        }
                    }

                    detectedCardNum = {
                        xPercent: round1(clamp(cx, 10, 90)),
                        yPercent: round1(clamp(cy, 10, 90)),
                        fontSizePt: fontPt,
                        color: textColor,
                        show: true,
                        layerName: numLayer.name
                    };
                }
            }
        } else {
            // Regular Image (PNG / JPEG / WebP)
            try {
                const img = await loadImage(file.buffer);
                const targetCanvas = createCanvas(CR80_WIDTH_PX, CR80_HEIGHT_PX);
                const ctx = targetCanvas.getContext('2d');
                ctx.drawImage(img, 0, 0, CR80_WIDTH_PX, CR80_HEIGHT_PX);
                renderedDataUrl = targetCanvas.toDataURL('image/jpeg', 0.92);
            } catch (err: any) {
                throw BadRequestException({ message: `تعذر معالجة الصورة: ${err.message || 'صورة غير صالحة'}` });
            }
        }

        // Fetch existing template or initialize new
        let template = await CardTemplateModel.findOne({ teacherId: new mongoose.Types.ObjectId(teacherId) });

        if (!template) {
            if (target === 'front') {
                // If front uploaded first, create placeholder back
                template = new CardTemplateModel({
                    teacherId: new mongoose.Types.ObjectId(teacherId),
                    frontImageUrl: renderedDataUrl,
                    backImageUrl: renderedDataUrl, // fallback until back is uploaded
                });
            } else {
                template = new CardTemplateModel({
                    teacherId: new mongoose.Types.ObjectId(teacherId),
                    backImageUrl: renderedDataUrl,
                    qrCode: detectedQr ? {
                        xPercent: detectedQr.xPercent,
                        yPercent: detectedQr.yPercent,
                        sizePercent: detectedQr.sizePercent
                    } : { xPercent: 50, yPercent: 48, sizePercent: 32 },
                    cardNumber: detectedCardNum ? {
                        xPercent: detectedCardNum.xPercent,
                        yPercent: detectedCardNum.yPercent,
                        fontSizePt: detectedCardNum.fontSizePt,
                        color: detectedCardNum.color,
                        show: true
                    } : { xPercent: 50, yPercent: 82, fontSizePt: 11, color: '#000000', show: true }
                });
            }
        } else {
            if (target === 'front') {
                template.frontImageUrl = renderedDataUrl;
            } else {
                template.backImageUrl = renderedDataUrl;
                if (detectedQr) {
                    template.qrCode = {
                        xPercent: detectedQr.xPercent,
                        yPercent: detectedQr.yPercent,
                        sizePercent: detectedQr.sizePercent
                    };
                }
                if (detectedCardNum) {
                    template.cardNumber = {
                        xPercent: detectedCardNum.xPercent,
                        yPercent: detectedCardNum.yPercent,
                        fontSizePt: detectedCardNum.fontSizePt,
                        color: detectedCardNum.color,
                        show: true
                    };
                }
            }
        }

        await template.save();

        let message = target === 'front' 
            ? 'تم حفظ تصميم الوجه الأمامي بنجاح' 
            : 'تم معالجة وحفظ تصميم الكارت بنجاح';

        if (detectedQr && detectedCardNum) {
            message += ` (تم التعرف تلقائياً على موضع QR Code وموضع رقم الكارت من ملف الفوتوشوب)`;
        } else if (detectedQr) {
            message += ` (تم التعرف تلقائياً على موضع QR Code من ملف الفوتوشوب)`;
        } else if (detectedCardNum) {
            message += ` (تم التعرف تلقائياً على موضع رقم الكارت من ملف الفوتوشوب)`;
        }

        return {
            template: template.toObject(),
            detectedLayers: {
                qrCode: !!detectedQr,
                qrLayerName: detectedQr?.layerName,
                cardNumber: !!detectedCardNum,
                cardNumLayerName: detectedCardNum?.layerName
            },
            format: isPsd ? 'psd' : 'image',
            message
        };
    }
}
