import { CardModel } from '../../database/models/card.model.js';
import { CardTemplateModel } from '../../database/models/card-template.model.js';
import { UserModel } from '../../database/models/user.model.js';
import { BadRequestException } from '../../common/utils/response/error.responce.js';
import QRCode from 'qrcode';
import { envVars } from '../../../config/env.service.js';

export class CardPvcPdfService {

    static async generatePvcHtml(
        batchId: string,
        teacherId: string,
        mode: 'back_only' | 'dual_sided' = 'back_only'
    ): Promise<string> {
        const cards = await CardModel.find({ batchId, teacherId }).lean();
        if (cards.length === 0) {
            throw BadRequestException({ message: 'لم يتم العثور على كروت في هذا الـ Batch' });
        }

        const template = await CardTemplateModel.findOne({ teacherId }).lean();
        const teacher = await UserModel.findById(teacherId).select('name centerName logoUrl').lean();

        const appUrl = (envVars as any).frontendUrl?.split(',')[0]?.trim() || 'https://monazem.app';

        // Pre-generate QR codes
        const cardsWithQr = await Promise.all(
            cards.map(async (card) => {
                const qrContent = `${appUrl}/card/${card.cardToken}`;
                const qrDataUrl = await QRCode.toDataURL(qrContent, {
                    width: 300,
                    margin: 0,
                    color: { dark: '#000000', light: '#ffffff' },
                    errorCorrectionLevel: 'H'
                });
                return { ...card, qrDataUrl };
            })
        );

        // Template settings or defaults
        const qrSettings = template?.qrCode || { xPercent: 50, yPercent: 48, sizePercent: 32 };
        const numSettings = template?.cardNumber || { xPercent: 50, yPercent: 82, fontSizePt: 11, color: '#000000', show: true };
        const backBg = template?.backImageUrl || '';
        const frontBg = template?.frontImageUrl || '';

        const hasFront = mode === 'dual_sided';

        const pagesHtml = cardsWithQr.map((card, idx) => {
            let html = '';

            // If dual-sided, render Front face first (with image if available, else blank)
            if (hasFront) {
                html += `
                <div class="pvc-page front-face" data-card="${card.cardNumber}">
                    ${frontBg
                        ? `<img class="bg-img" src="${frontBg}" alt="Front Face" />`
                        : `<div class="default-bg front-placeholder">
                            <div class="front-placeholder-text">الوجه الأمامي</div>
                           </div>`
                    }
                </div>
                `;
            }

            // Back face (where QR and Card Number reside)
            html += `
            <div class="pvc-page back-face" data-card="${card.cardNumber}">
                ${backBg ? `<img class="bg-img" src="${backBg}" alt="Back Face" />` : `
                    <div class="default-bg">
                        <div class="center-title">${(teacher as any)?.centerName || 'منصة مُنظِّم'}</div>
                    </div>
                `}
                
                <div class="qr-container" style="left: ${qrSettings.xPercent}%; top: ${qrSettings.yPercent}%; width: ${qrSettings.sizePercent}%;">
                    <img class="qr-code-img" src="${card.qrDataUrl}" alt="QR" />
                </div>

                ${numSettings.show ? `
                    <div class="card-number-text" style="left: ${numSettings.xPercent}%; top: ${numSettings.yPercent}%; font-size: ${numSettings.fontSizePt}pt; color: ${numSettings.color};">
                        ${card.cardNumber}
                    </div>
                ` : ''}
            </div>
            `;

            return html;
        }).join('');

        const totalPages = cards.length * (hasFront ? 2 : 1);

        return `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>طباعة كروت PVC الذكية (CR80) — Batch ${batchId.slice(0, 8)}</title>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;700;800&family=JetBrains+Mono:wght@600&display=swap" rel="stylesheet">
            <style>
                /* Standard CR80 PVC Card Dimensions: 85.6mm x 53.98mm */
                @page {
                    size: 85.6mm 53.98mm;
                    margin: 0;
                }

                *, *::before, *::after {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }

                body {
                    font-family: 'Cairo', sans-serif;
                    background: #0f172a;
                    color: #f8fafc;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                .no-print {
                    position: sticky;
                    top: 0;
                    z-index: 9999;
                    background: #1e293b;
                    border-bottom: 1px solid #334155;
                    padding: 14px 24px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 16px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                }

                .toolbar-info {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .badge {
                    background: #3b82f6;
                    color: white;
                    font-size: 13px;
                    font-weight: 700;
                    padding: 4px 10px;
                    border-radius: 9999px;
                }

                .printer-tip {
                    font-size: 13px;
                    color: #94a3b8;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .toolbar-actions {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .btn {
                    padding: 8px 18px;
                    font-size: 14px;
                    font-weight: 700;
                    font-family: 'Cairo', sans-serif;
                    border-radius: 8px;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s ease;
                    text-decoration: none;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                }

                .btn-primary {
                    background: #2563eb;
                    color: #ffffff;
                }
                .btn-primary:hover {
                    background: #1d4ed8;
                }

                .btn-secondary {
                    background: #334155;
                    color: #e2e8f0;
                }
                .btn-secondary:hover {
                    background: #475569;
                }

                .cards-container {
                    padding: 30px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 20px;
                }

                /* Exact CR80 Card Box */
                .pvc-page {
                    width: 85.6mm;
                    height: 53.98mm;
                    position: relative;
                    overflow: hidden;
                    background: #ffffff;
                    /* In browser preview: render card border-radius & shadow */
                    border-radius: 3.18mm;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.45);
                    page-break-after: always;
                    break-after: page;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }

                .bg-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    position: absolute;
                    top: 0;
                    left: 0;
                    user-select: none;
                    pointer-events: none;
                }

                .default-bg {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%);
                    color: white;
                }

                .center-title {
                    font-size: 16px;
                    font-weight: 800;
                    opacity: 0.8;
                }

                .front-placeholder {
                    background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%) !important;
                    border: 2px dashed #94a3b8;
                }

                .front-placeholder-text {
                    font-size: 14px;
                    font-weight: 700;
                    color: #64748b;
                    opacity: 0.7;
                }

                .qr-container {
                    position: absolute;
                    transform: translate(-50%, -50%);
                    aspect-ratio: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10;
                }

                .qr-code-img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    display: block;
                    background: white;
                    padding: 2px;
                    border-radius: 4px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                }

                .card-number-text {
                    position: absolute;
                    transform: translate(-50%, -50%);
                    font-family: 'JetBrains Mono', 'Courier New', monospace;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    white-space: nowrap;
                    z-index: 10;
                    user-select: none;
                }

                /* Print specific overrides */
                @media print {
                    body {
                        background: transparent !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    .no-print {
                        display: none !important;
                    }

                    .cards-container {
                        padding: 0 !important;
                        gap: 0 !important;
                        display: block !important;
                    }

                    .pvc-page {
                        border-radius: 0 !important;
                        box-shadow: none !important;
                        margin: 0 !important;
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                }
            </style>
            <script>
                function switchMode(newMode) {
                    const params = new URLSearchParams(window.location.search);
                    params.set('mode', newMode);
                    window.location.search = params.toString();
                }
                function downloadPdf() {
                    // Inject a temporary print-only style that hides .no-print
                    const styleId = '__pdf_download_style__';
                    if (!document.getElementById(styleId)) {
                        const style = document.createElement('style');
                        style.id = styleId;
                        style.textContent = '@media print { .no-print { display: none !important; } }';
                        document.head.appendChild(style);
                    }
                    // Small delay to let the style apply then trigger print-to-PDF
                    setTimeout(function() {
                        window.print();
                        // Remove injected style after dialog closes
                        setTimeout(function() {
                            const s = document.getElementById('__pdf_download_style__');
                            if (s) s.parentNode.removeChild(s);
                        }, 3000);
                    }, 100);
                }
            </script>
        </head>
        <body>
            <div class="no-print">
                <div class="toolbar-info">
                    <span class="badge">PVC CR80 (85.6mm × 53.98mm)</span>
                    <span>عدد الكروت: <strong>${cards.length}</strong> (${totalPages} صفحة طباعة)</span>
                    <span class="printer-tip">💡 نصيحة لطابعات PVC: في نافذة الطباعة اضبط الهوامش على <strong>None</strong> والمقياس على <strong>100%</strong>.</span>
                </div>
                <div class="toolbar-actions">
                    <select onchange="switchMode(this.value)" style="background: #334155; color: white; border: 1px solid #475569; padding: 7px 12px; border-radius: 6px; font-family: Cairo;">
                        <option value="back_only" ${mode === 'back_only' ? 'selected' : ''}>طباعة الوجه الخلفي فقط (QR Code)</option>
                        <option value="dual_sided" ${mode === 'dual_sided' ? 'selected' : ''}>طباعة وجهين (Dual Sided)</option>
                    </select>
                    <button class="btn btn-secondary" onclick="downloadPdf()">
                        ⬇️ تحميل PDF
                    </button>
                    <button class="btn btn-primary" onclick="window.print()">
                        🖨️ طباعة الكروت الآن (Ctrl + P)
                    </button>
                </div>
            </div>

            <div class="cards-container">
                ${pagesHtml}
            </div>
        </body>
        </html>
        `;
    }
}
