import { CardModel }  from '../../database/models/card.model.js';
import { UserModel }  from '../../database/models/user.model.js';
import { BadRequestException } from '../../common/utils/response/error.responce.js';
import QRCode from 'qrcode';
import { envVars } from '../../../config/env.service.js';

const CARDS_PER_ROW = 2;
const CARDS_PER_PAGE = 6;

export class CardBatchPdfService {

    static async generateBatchHtml(batchId: string, teacherId: string): Promise<string> {
        const cards = await CardModel.find({ batchId, teacherId }).lean();
        if (cards.length === 0) {
            throw BadRequestException({ message: 'لم يتم العثور على كروت في هذا الـ Batch' });
        }

        const teacher = await UserModel.findById(teacherId).select('name centerName logoUrl').lean();
        const centerLabel = (teacher as any)?.centerName || 'اسم السنتر';
        const centerLogo  = (teacher as any)?.logoUrl
            ? `<img src="${(teacher as any).logoUrl}" alt="شعار السنتر" />`
            : '';

        const appUrl = (envVars as any).frontendUrl?.split(',')[0]?.trim() || 'https://monazem.app';

        // Generate QR codes for all cards in parallel
        const cardsWithQr = await Promise.all(
            cards.map(async (card) => {
                const qrContent  = `${appUrl}/card/${card.cardToken}`;
                const qrDataUrl  = await QRCode.toDataURL(qrContent, {
                    width:                200,
                    margin:               1,
                    color:                { dark: '#000000', light: '#ffffff' },
                    errorCorrectionLevel: 'H',
                });
                return { ...card, qrDataUrl };
            })
        );

        // Split into pages of CARDS_PER_PAGE each
        const pages: typeof cardsWithQr[] = [];
        for (let i = 0; i < cardsWithQr.length; i += CARDS_PER_PAGE) {
            pages.push(cardsWithQr.slice(i, i + CARDS_PER_PAGE));
        }

        const pagesHtml = pages.map((pageCards) => {
            const cardItems = pageCards.map((card) => `
                <div class="card-item">
                    <div class="card-header">
                        <div class="brand">
                            <span class="platform-name">منصة مُنظِّم</span>
                            ${centerLabel !== 'اسم السنتر' ? `<span class="center-sep">|</span><span class="center-name">${centerLabel}</span>` : ''}
                        </div>
                        ${centerLogo}
                    </div>
                    <div class="qr-section">
                        <img class="qr-img" src="${card.qrDataUrl}" alt="QR Code" />
                    </div>
                    <div class="card-number" dir="ltr">${card.cardNumber}</div>
                    <div class="card-footer">بطاقة الطالب الذكية</div>
                </div>
            `).join('');

            return `
                <div class="page">
                    <div class="cards-grid">
                        ${cardItems}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>طباعة الكروت الذكية — Batch ${batchId}</title>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
                <style>
                    @page { size: A4 portrait; margin: 10mm; }
                    *, *::before, *::after { box-sizing: border-box; }
                    body, html {
                        font-family: 'Cairo', sans-serif;
                        margin: 0; padding: 0;
                        background: #e2e8f0;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print {
                        text-align: center;
                        padding: 16px;
                        background: #1e293b;
                    }
                    .no-print button {
                        padding: 10px 28px;
                        font-size: 16px;
                        font-family: 'Cairo', sans-serif;
                        background: #3b82f6;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                    }
                    .page {
                        width: 210mm;
                        min-height: 290mm;
                        margin: 10mm auto;
                        background: white;
                        page-break-after: always;
                        break-after: page;
                        display: flex;
                        align-items: flex-start;
                        justify-content: center;
                        padding: 8mm;
                    }
                    .page:last-child { page-break-after: auto; break-after: auto; }
                    @media print {
                        body { background: white; }
                        .no-print { display: none; }
                        .page { margin: 0; box-shadow: none; }
                    }

                    /* Grid: 2 cards per row, 3 rows = 6 cards per page */
                    .cards-grid {
                        display: grid;
                        grid-template-columns: repeat(${CARDS_PER_ROW}, 1fr);
                        gap: 6mm;
                        width: 100%;
                    }

                    /* Individual card — credit card proportions */
                    .card-item {
                        border: 2px solid #0f4c81;
                        border-radius: 12px;
                        overflow: hidden;
                        background: white;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        padding-bottom: 8px;
                        box-shadow: 0 2px 8px rgba(15,76,129,0.12);
                    }
                    .card-header {
                        width: 100%;
                        background: linear-gradient(135deg, #0f4c81, #1a6fba);
                        color: white;
                        padding: 8px 12px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    }
                    .brand { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; }
                    .center-sep { opacity: 0.5; }
                    .card-header img {
                        height: 28px; width: 28px;
                        border-radius: 4px;
                        background: white; padding: 2px;
                        object-fit: contain;
                    }
                    .qr-section {
                        padding: 8px;
                        background: #f8fafc;
                        width: 100%;
                        display: flex;
                        justify-content: center;
                    }
                    .qr-img { width: 100px; height: 100px; display: block; }
                    .card-number {
                        font-family: monospace;
                        font-size: 12px;
                        font-weight: 700;
                        color: #334155;
                        margin-top: 4px;
                        letter-spacing: 1px;
                    }
                    .card-footer {
                        font-size: 9px;
                        color: #94a3b8;
                        margin-top: 4px;
                    }
                </style>
            </head>
            <body>
                <div class="no-print">
                    <button onclick="window.print()">🖨️ طباعة الكروت (${cards.length} كارت)</button>
                </div>
                ${pagesHtml}
            </body>
            </html>
        `;
    }
}
