import { Types } from 'mongoose';
import { CardModel } from '../../database/models/card.model.js';
import { UserModel } from '../../database/models/user.model.js';
import { CenterModel } from '../../database/models/center.model.js';
import { BadRequestException } from '../../common/utils/response/error.responce.js';
import QRCode from 'qrcode';
import { createCanvas, loadImage } from '@napi-rs/canvas';

function buildRangeButtons(total: number, currentFrom: number, currentTo: number): string {
    if (total <= 100) return '';
    const step = 100;
    const buttons: string[] = [];
    for (let start = 1; start <= total; start += step) {
        const end = Math.min(start + step - 1, total);
        const isActive = (currentFrom === start && currentTo === end);
        buttons.push(`
            <button type="button" class="range-btn ${isActive ? 'active' : ''}" onclick="setRange(${start}, ${end})">
                ${start} - ${end}
            </button>
        `);
    }
    return buttons.join('');
}

export class CardBatchPdfService {

    /**
     * Optional backward-compatible helper for generating an all-in-one badge canvas.
     */
    static async createQrBadge(
        qrDataUrl: string,
        cardNumber: string,
        showQrBg: boolean,
        showCardNumber: boolean
    ): Promise<string> {
        try {
            const qrImg = await loadImage(qrDataUrl);
            const qrSize = 300;
            const padding = showQrBg ? 16 : 0;
            const textHeight = showCardNumber ? 38 : 0;
            const textMargin = (showCardNumber && showQrBg) ? 6 : (showCardNumber ? 4 : 0);

            const totalWidth = qrSize + (padding * 2);
            const totalHeight = qrSize + textHeight + textMargin + (padding * 2);

            const canvas = createCanvas(totalWidth, totalHeight);
            const ctx = canvas.getContext('2d');

            if (showQrBg) {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.roundRect(0, 0, totalWidth, totalHeight, 18);
                ctx.fill();
            }

            // Draw QR code image
            ctx.drawImage(qrImg, padding, padding, qrSize, qrSize);

            // Draw Card Number if enabled directly baked into badge image
            if (showCardNumber) {
                if (!showQrBg) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    const pillW = 200;
                    const pillH = 26;
                    const pillX = (totalWidth - pillW) / 2;
                    const pillY = padding + qrSize + textMargin + 4;
                    ctx.beginPath();
                    ctx.roundRect(pillX, pillY, pillW, pillH, 6);
                    ctx.fill();
                }

                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 22px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const textY = padding + qrSize + textMargin + (textHeight / 2);
                ctx.fillText(cardNumber, totalWidth / 2, textY);
            }

            return canvas.toDataURL('image/png');
        } catch {
            return qrDataUrl;
        }
    }

    /**
     * ─── TEACHER BATCH PRINT HTML ──────────────────────────────────────────────
     */
    static async generateBatchHtml(
        batchId: string,
        teacherId: string,
        mode: string = 'dual_sided',
        token: string = '',
        query?: any
    ): Promise<string> {
        const allCards = await CardModel.find({ batchId, teacherId }).lean();
        if (allCards.length === 0) {
            throw BadRequestException({ message: 'لم يتم العثور على كروت في هذا الـ Batch' });
        }

        const totalBatchCards = allCards.length;
        const from = Math.max(1, parseInt(query?.from, 10) || 1);
        const to = Math.min(totalBatchCards, parseInt(query?.to, 10) || totalBatchCards);
        const cards = (from > 1 || to < totalBatchCards) ? allCards.slice(from - 1, to) : allCards;

        let normalizedMode = mode || 'dual_sided';
        if (normalizedMode === 'pvc-duplex') normalizedMode = 'dual_sided';
        if (normalizedMode === 'pvc-backs' || normalizedMode === 'backs') normalizedMode = 'back_only';
        if (normalizedMode === 'pvc-fronts' || normalizedMode === 'fronts') normalizedMode = 'front_only';
        if (normalizedMode === 'a4_paper') normalizedMode = 'a4';

        const teacher = await UserModel.findById(teacherId).select('name centerName logoUrl cardTemplate').lean();
        const centerLabel = (teacher as any)?.centerName || '';
        const centerLogo  = (teacher as any)?.logoUrl
            ? `<img src="${(teacher as any).logoUrl}" alt="شعار السنتر" />`
            : '';

        const cardTemplate = (teacher as any)?.cardTemplate || {};
        const frontDesign = cardTemplate.frontImageUrl || null;
        const backDesign  = cardTemplate.backImageUrl  || null;
        const qrX = cardTemplate.qrX ?? 50;
        const qrY = cardTemplate.qrY ?? 70;
        const qrSize = cardTemplate.qrSize ?? 25;
        const showQrBg = cardTemplate.showQrBg !== false;
        const showCardNumber = cardTemplate.showCardNumber !== false;

        // Auto-detect dimensions from custom artwork if uploaded
        let cardWidthMm = 85.6;
        let cardHeightMm = 54;
        let cardAspectRatio = 85.6 / 54;

        const designImage = frontDesign || backDesign;
        if (designImage) {
            try {
                const sample = await loadImage(designImage);
                if (sample.width > 0 && sample.height > 0) {
                    cardAspectRatio = sample.width / sample.height;
                    cardWidthMm = Number((54 * cardAspectRatio).toFixed(1));
                    if (Math.abs(cardWidthMm - 85.6) < 1.5) {
                        cardWidthMm = 85.6;
                    }
                }
            } catch {}
        }

        // Generate QR codes containing cardNumber directly for instant recognition
        const CHUNK_SIZE = 50;
        const cardsWithQr: any[] = [];
        for (let i = 0; i < cards.length; i += CHUNK_SIZE) {
            const chunk = cards.slice(i, i + CHUNK_SIZE);
            const resolved = await Promise.all(
                chunk.map(async (card, cIdx) => {
                    const globalIdx = (from - 1) + i + cIdx + 1;
                    // QR encodes the exact card number so any 2D barcode scanner or camera reads it
                    const qrContent = card.cardNumber;
                    const rawQrDataUrl = await QRCode.toDataURL(qrContent, {
                        width: 220,
                        margin: 1,
                        color: { dark: '#000000', light: '#ffffff' },
                        errorCorrectionLevel: 'M',
                    });
                    return {
                        ...card,
                        displayIndex: globalIdx,
                        qrDataUrl: rawQrDataUrl,
                    };
                })
            );
            cardsWithQr.push(...resolved);
        }

        const renderFront = (card: typeof cardsWithQr[0]) => {
            if (frontDesign) {
                return `
                    <div class="card-item custom-artwork front">
                        ${showCardNumber ? `<div class="card-num-overlay" dir="ltr">${card.cardNumber}</div>` : ''}
                    </div>
                `;
            }
            return `
                <div class="card-item default-card front">
                    <div class="card-header">
                        <div class="brand">
                            <span class="platform-name">منصة مُنظِّم</span>
                            ${centerLabel ? `<span class="center-sep">|</span><span class="center-name">${centerLabel}</span>` : ''}
                        </div>
                        ${centerLogo}
                    </div>
                    <div class="card-body">
                        <div class="default-badge">بطاقة ذكية معتمدة</div>
                        <div class="card-number" dir="ltr">${card.cardNumber}</div>
                    </div>
                    <div class="card-footer">بطاقة هوية الطالب الذكية</div>
                </div>
            `;
        };

        const renderBack = (card: typeof cardsWithQr[0]) => {
            if (backDesign) {
                // Pre-calculate position to avoid Chrome print bug with transform + overflow:hidden
                const qrWidthMm = qrSize / 100 * cardWidthMm;
                const qrHeightPct = (qrWidthMm / cardHeightMm) * 100;
                const qrLeft = Math.max(0, qrX - qrSize / 2);
                const qrTop = Math.max(0, qrY - qrHeightPct / 2);
                return `
                    <div class="card-item custom-artwork back">
                        <div class="custom-qr-badge" style="left: ${qrLeft.toFixed(2)}%; top: ${qrTop.toFixed(2)}%; width: ${qrSize}%;">
                            <div class="qr-badge-inner ${showQrBg ? 'has-bg' : ''}">
                                <img class="qr-code-img" src="${card.qrDataUrl}" alt="QR" />
                                ${showCardNumber ? `<div class="badge-card-number" dir="ltr">${card.cardNumber}</div>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }
            return `
                <div class="card-item default-card back">
                    <div class="card-header simple">
                        <span class="card-num-tag" dir="ltr">${card.cardNumber}</span>
                        ${centerLabel ? `<span class="center-name-sm">${centerLabel}</span>` : ''}
                    </div>
                    <div class="card-body back-body">
                        <div class="qr-section">
                            <img class="qr-img" src="${card.qrDataUrl}" alt="QR Code" />
                        </div>
                    </div>
                    <div class="card-footer">SCAN TO VERIFY</div>
                </div>
            `;
        };

        // Render ONLY the active mode to prevent massive DOM & string size
        let contentHtml = '';
        if (normalizedMode === 'dual_sided') {
            contentHtml = cardsWithQr.map((card) => `
                <div class="pvc-page">
                    <div class="pvc-screen-badge no-print">
                        <span class="card-id-text">كارت #${card.displayIndex} (${card.cardNumber})</span>
                        <span class="side-text front">الوجه الأمامي</span>
                    </div>
                    ${renderFront(card)}
                </div>
                <div class="pvc-page">
                    <div class="pvc-screen-badge no-print">
                        <span class="card-id-text">كارت #${card.displayIndex} (${card.cardNumber})</span>
                        <span class="side-text back">الوجه الخلفي (QR)</span>
                    </div>
                    ${renderBack(card)}
                </div>
            `).join('');
        } else if (normalizedMode === 'back_only') {
            contentHtml = cardsWithQr.map((card) => `
                <div class="pvc-page">
                    <div class="pvc-screen-badge no-print">
                        <span class="card-id-text">كارت #${card.displayIndex} (${card.cardNumber})</span>
                        <span class="side-text back">الظهر فقط (QR)</span>
                    </div>
                    ${renderBack(card)}
                </div>
            `).join('');
        } else if (normalizedMode === 'front_only') {
            contentHtml = cardsWithQr.map((card) => `
                <div class="pvc-page">
                    <div class="pvc-screen-badge no-print">
                        <span class="card-id-text">كارت #${card.displayIndex} (${card.cardNumber})</span>
                        <span class="side-text front">الوجه فقط</span>
                    </div>
                    ${renderFront(card)}
                </div>
            `).join('');
        } else if (normalizedMode === 'a4') {
            const PAIRS_PER_PAGE = 4;
            const a4Pages: typeof cardsWithQr[] = [];
            for (let i = 0; i < cardsWithQr.length; i += PAIRS_PER_PAGE) {
                a4Pages.push(cardsWithQr.slice(i, i + PAIRS_PER_PAGE));
            }
            contentHtml = a4Pages.map((pageCards, pIdx) => `
                <div class="a4-page">
                    <div class="a4-meta no-print">صفحة A4 رقم ${pIdx + 1} من ${a4Pages.length} — كل كارت مع ظهره (${pageCards.length} كروت)</div>
                    <div class="pairs-container">
                        ${pageCards.map((card) => `
                            <div class="card-pair-row">
                                <div class="card-side-col">
                                    <span class="side-tag no-print">الوجه الأمامي</span>
                                    ${renderFront(card)}
                                </div>
                                <div class="cut-divider">
                                    <span class="cut-line"></span>
                                    <span class="cut-icon no-print">✂️</span>
                                </div>
                                <div class="card-side-col">
                                    <span class="side-tag no-print">الوجه الخلفي (QR)</span>
                                    ${renderBack(card)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        }

        const isA4 = normalizedMode === 'a4';

        return `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>طباعة كروت PVC الذكية — Batch ${batchId}</title>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
                <style id="page-style">
                    @page { ${isA4 ? 'size: A4 portrait; margin: 6mm;' : `size: ${cardWidthMm}mm ${cardHeightMm}mm; margin: 0;`} }
                </style>
                <style>
                    *, *::before, *::after { box-sizing: border-box; }
                    body, html {
                        font-family: 'Cairo', sans-serif;
                        margin: 0; padding: 0;
                        background: #090d16;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* ── Top Toolbar ─────────────────────────────────────────── */
                    .no-print-toolbar {
                        background: #0f172a;
                        color: white;
                        padding: 12px 20px;
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                        position: sticky;
                        top: 0;
                        z-index: 1000;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                        border-bottom: 1px solid #1e293b;
                    }
                    .toolbar-top {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        flex-wrap: wrap;
                        gap: 12px;
                    }
                    .toolbar-title {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .toolbar-title h1 {
                        margin: 0;
                        font-size: 16px;
                        font-weight: 800;
                        color: #f8fafc;
                    }
                    .badge-count {
                        background: #3b82f6;
                        color: white;
                        font-size: 11px;
                        font-weight: 700;
                        padding: 3px 10px;
                        border-radius: 20px;
                    }
                    .badge-pvc-tag {
                        background: #059669;
                        color: white;
                        font-size: 11px;
                        font-weight: 700;
                        padding: 3px 10px;
                        border-radius: 20px;
                    }
                    .toolbar-actions {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        flex-wrap: wrap;
                    }
                    .mode-switch-group, .range-filter-group {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        background: #1e293b;
                        padding: 3px;
                        border-radius: 8px;
                        border: 1px solid #334155;
                        flex-wrap: wrap;
                    }
                    .mode-btn, .range-btn {
                        padding: 6px 12px;
                        font-size: 12px;
                        font-weight: 700;
                        font-family: 'Cairo', sans-serif;
                        color: #94a3b8;
                        background: transparent;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .mode-btn.active, .range-btn.active {
                        background: #3b82f6;
                        color: white;
                        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
                    }
                    .range-btn.active { background: #059669; }
                    .range-label { font-size: 11px; font-weight: 700; color: #94a3b8; margin: 0 6px; }
                    .custom-range { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #94a3b8; margin: 0 4px; }
                    .custom-range input {
                        width: 52px; padding: 2px 4px; background: #0f172a; border: 1px solid #475569;
                        border-radius: 4px; color: white; font-size: 11px; font-family: monospace; text-align: center;
                    }
                    .range-apply-btn { padding: 3px 8px; font-size: 11px; background: #334155; color: white; border: none; border-radius: 4px; cursor: pointer; }
                    .range-apply-btn:hover { background: #475569; }
                    .btn-print-main {
                        padding: 8px 22px;
                        font-size: 14px;
                        font-weight: 800;
                        font-family: 'Cairo', sans-serif;
                        background: #10b981;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        box-shadow: 0 2px 10px rgba(16,185,129,0.35);
                        transition: all 0.2s;
                    }
                    .btn-print-main:hover { background: #059669; }
                    .toolbar-hint {
                        font-size: 12px;
                        color: #cbd5e1;
                        background: rgba(255,255,255,0.06);
                        padding: 7px 14px;
                        border-radius: 6px;
                        border-right: 3px solid #10b981;
                    }

                    /* ── Screen Studio Canvas ─────────────────────────────────── */
                    .studio-canvas {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 20px;
                        justify-content: center;
                        padding: 24px;
                        min-height: calc(100vh - 120px);
                    }
                    .pvc-page {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 6px;
                        background: #1e293b;
                        padding: 10px 10px 12px;
                        border-radius: 12px;
                        border: 1px solid #334155;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                        transition: transform 0.2s, box-shadow 0.2s;
                    }
                    .pvc-page:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 8px 25px rgba(0,0,0,0.4);
                    }
                    .pvc-screen-badge {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        width: ${cardWidthMm}mm;
                        font-size: 10px;
                        font-weight: 700;
                        color: #94a3b8;
                    }
                    .card-id-text { font-family: 'Cairo', system-ui, sans-serif; font-weight: 700; }
                    .side-text {
                        font-size: 9px;
                        padding: 1.5px 6px;
                        border-radius: 4px;
                        background: rgba(255,255,255,0.08);
                    }
                    .side-text.front { color: #60a5fa; }
                    .side-text.back  { color: #34d399; }

                    /* ── Card Standard Dimensions ──────────────────────────────── */
                    .card-item {
                        width: ${cardWidthMm}mm;
                        height: ${cardHeightMm}mm;
                        border-radius: 3.5mm;
                        position: relative;
                        overflow: hidden;
                        background: white;
                        display: flex;
                        flex-direction: column;
                        box-sizing: border-box;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .card-item.custom-artwork {
                        position: relative;
                        overflow: hidden;
                        background-size: 100% 100% !important;
                        background-repeat: no-repeat !important;
                        background-position: center !important;
                    }
                    ${frontDesign ? `
                    .card-item.custom-artwork.front {
                        background-image: url("${frontDesign.replace(/"/g, '\\"')}") !important;
                    }
                    ` : ''}
                    ${backDesign ? `
                    .card-item.custom-artwork.back {
                        background-image: url("${backDesign.replace(/"/g, '\\"')}") !important;
                    }
                    ` : ''}

                    .custom-qr-badge {
                        position: absolute;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 5;
                        pointer-events: none;
                    }
                    .qr-badge-inner {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        width: 100%;
                    }
                    .qr-badge-inner.has-bg {
                        background: #ffffff;
                        border-radius: 8px;
                        padding: 6%;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .qr-code-img {
                        width: 100%;
                        height: auto;
                        display: block;
                        aspect-ratio: 1 / 1;
                    }
                    .badge-card-number {
                        font-family: 'Cairo', system-ui, -apple-system, sans-serif;
                        font-size: 11px;
                        font-weight: 900;
                        color: #1e293b;
                        text-align: center;
                        margin-top: 3px;
                        line-height: 1.2;
                        letter-spacing: 0.8px;
                        white-space: nowrap;
                    }
                    .qr-badge-inner:not(.has-bg) .badge-card-number {
                        background: rgba(255, 255, 255, 0.95);
                        padding: 2px 8px;
                        border-radius: 4px;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .card-num-overlay {
                        position: absolute;
                        bottom: 3.5mm;
                        left: 50%;
                        transform: translateX(-50%);
                        font-family: 'Cairo', system-ui, -apple-system, sans-serif;
                        font-size: 9pt;
                        font-weight: 800;
                        background: rgba(15, 23, 42, 0.75);
                        color: white;
                        padding: 2px 8px;
                        border-radius: 4px;
                        letter-spacing: 0.8px;
                        white-space: nowrap;
                        z-index: 10;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* ── Default System Card ─────────────────────────────────── */
                    .card-item.default-card {
                        border: 1.5px solid #0f4c81;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .card-header {
                        width: 100%;
                        background: linear-gradient(135deg, #0f4c81, #1a6fba);
                        color: white;
                        padding: 2.5mm 3.5mm;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    }
                    .card-header.simple { background: #f1f5f9; padding: 2mm 3.5mm; }
                    .brand { display: flex; align-items: center; gap: 4px; font-size: 8pt; font-weight: 700; }
                    .center-sep { opacity: 0.5; }
                    .card-header img { height: 6mm; width: 6mm; border-radius: 1mm; background: white; padding: 0.5mm; object-fit: contain; }
                    .card-body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; }
                    .default-badge { font-size: 7.5pt; color: #64748b; font-weight: 700; margin-bottom: 1mm; }
                    .qr-section { padding: 1mm; background: #f8fafc; border-radius: 2mm; display: flex; justify-content: center; }
                    .qr-section .qr-img { width: 22mm; height: 22mm; display: block; }
                    .card-number { font-family: 'Cairo', system-ui, sans-serif; font-size: 9pt; font-weight: 800; color: #0f4c81; letter-spacing: 0.8px; }
                    .card-footer { font-size: 6.5pt; color: #94a3b8; margin-bottom: 2mm; }
                    .card-num-tag { font-family: 'Cairo', system-ui, sans-serif; font-size: 8pt; font-weight: 800; color: #334155; }
                    .center-name-sm { font-size: 7.5pt; color: #64748b; }
                    .back-body { flex: 1; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }

                    /* ── A4 Mode Styles ──────────────────────────────────────── */
                    .a4-canvas { padding: 10px; }
                    .a4-page {
                        width: 210mm;
                        min-height: 297mm;
                        margin: 10mm auto;
                        background: white;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        padding: 8mm 6mm;
                        box-sizing: border-box;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    }
                    .a4-meta { font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 6px; }
                    .pairs-container { display: flex; flex-direction: column; gap: 3.5mm; width: 100%; align-items: center; }
                    .card-pair-row { display: flex; align-items: center; justify-content: center; gap: 3mm; width: 100%; }
                    .card-side-col { display: flex; flex-direction: column; align-items: center; }
                    .side-tag { font-size: 9px; font-weight: 700; color: #94a3b8; margin-bottom: 2px; }
                    .cut-divider { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 54mm; position: relative; padding: 0 2mm; }
                    .cut-line { width: 0; height: 100%; border-right: 1px dashed #cbd5e1; }
                    .cut-icon { position: absolute; font-size: 10px; color: #94a3b8; background: white; padding: 2px; }

                    /* ── Print Styles ────────────────────────────────────────── */
                    @media print {
                        html, body {
                            background: transparent !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                        .no-print, .no-print-toolbar, .pvc-screen-badge, .a4-meta {
                            display: none !important;
                        }
                        .studio-canvas {
                            display: block !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            background: transparent !important;
                        }
                        .pvc-page {
                            width: ${cardWidthMm}mm !important;
                            height: ${cardHeightMm}mm !important;
                            min-width: ${cardWidthMm}mm !important;
                            min-height: ${cardHeightMm}mm !important;
                            max-width: ${cardWidthMm}mm !important;
                            max-height: ${cardHeightMm}mm !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: transparent !important;
                            border: none !important;
                            border-radius: 0 !important;
                            box-shadow: none !important;
                            page-break-after: always !important;
                            break-after: page !important;
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                            overflow: hidden !important;
                            display: block !important;
                        }
                        .pvc-page:last-child {
                            page-break-after: auto !important;
                            break-after: auto !important;
                        }
                        .card-item {
                            width: ${cardWidthMm}mm !important;
                            height: ${cardHeightMm}mm !important;
                            border-radius: 0 !important;
                            border: none !important;
                            box-shadow: none !important;
                            margin: 0 !important;
                            overflow: hidden !important;
                            clip-path: inset(0) !important;
                        }
                        .a4-page {
                            width: 210mm !important;
                            min-height: 297mm !important;
                            margin: 0 !important;
                            padding: 6mm !important;
                            page-break-after: always !important;
                            break-after: page !important;
                            box-shadow: none !important;
                            background: white !important;
                        }
                        .a4-page:last-child {
                            page-break-after: auto !important;
                            break-after: auto !important;
                        }
                        .cut-line { border-right: 1px dashed #94a3b8; }
                        .cut-icon { display: none !important; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print no-print-toolbar">
                    <div class="toolbar-top">
                        <div class="toolbar-title">
                            <h1>💳 طباعة كروت PVC الذكية</h1>
                            <span class="badge-count">${cards.length} من ${totalBatchCards} كارت</span>
                            <span class="badge-pvc-tag">مقاس (${cardWidthMm} × ${cardHeightMm} مم)</span>
                        </div>
                        <div class="toolbar-actions">
                            <div class="mode-switch-group">
                                <button type="button" class="mode-btn ${normalizedMode === 'dual_sided' ? 'active' : ''}" onclick="switchMode('dual_sided')">
                                    💳 وجه وظهر متتاليين (${cards.length * 2} صفحة)
                                </button>
                                <button type="button" class="mode-btn ${normalizedMode === 'back_only' ? 'active' : ''}" onclick="switchMode('back_only')">
                                    🔲 الظهر فقط (QR) (${cards.length} صفحة)
                                </button>
                                <button type="button" class="mode-btn ${normalizedMode === 'front_only' ? 'active' : ''}" onclick="switchMode('front_only')">
                                    🎨 الوجه فقط (${cards.length} صفحة)
                                </button>
                                <button type="button" class="mode-btn ${normalizedMode === 'a4' ? 'active' : ''}" onclick="switchMode('a4')">
                                    📄 ورق A4 عادي
                                </button>
                            </div>
                            <button type="button" class="btn-print-main" onclick="window.print()">
                                🖨️ طباعة الآن (Print)
                            </button>
                        </div>
                    </div>
                    ${totalBatchCards > 100 ? `
                    <div class="range-filter-group">
                        <span class="range-label">نطاق الكروت للطباعة:</span>
                        <button type="button" class="range-btn ${(!query?.from && !query?.to) ? 'active' : ''}" onclick="setRange(1, ${totalBatchCards})">
                            الكل (${totalBatchCards})
                        </button>
                        ${buildRangeButtons(totalBatchCards, from, to)}
                        <div class="custom-range">
                            <span>من:</span>
                            <input type="number" id="fromInput" min="1" max="${totalBatchCards}" value="${from}" />
                            <span>إلى:</span>
                            <input type="number" id="toInput" min="1" max="${totalBatchCards}" value="${to}" />
                            <button type="button" onclick="applyCustomRange()" class="range-apply-btn">تطبيق</button>
                        </div>
                    </div>
                    ` : ''}
                    <div class="toolbar-hint">
                        💡 <strong>إعدادات هامة للطباعة (Chrome Print):</strong>
                        اختر الهوامش <strong>(Margins: None)</strong> &nbsp;|&nbsp; فعّل خيار <strong>(Background graphics)</strong>
                    </div>
                </div>

                <div class="${isA4 ? 'a4-canvas' : 'studio-canvas'}">
                    ${contentHtml}
                </div>

                <script>
                    function switchMode(newMode) {
                        const url = new URL(window.location.href);
                        url.searchParams.set('mode', newMode);
                        window.location.href = url.toString();
                    }
                    function setRange(from, to) {
                        const url = new URL(window.location.href);
                        url.searchParams.set('from', from);
                        url.searchParams.set('to', to);
                        window.location.href = url.toString();
                    }
                    function applyCustomRange() {
                        const fromVal = document.getElementById('fromInput').value;
                        const toVal = document.getElementById('toInput').value;
                        setRange(fromVal, toVal);
                    }
                </script>
            </body>
            </html>
        `;
    }

    /**
     * ─── CENTER BATCH PRINT HTML ───────────────────────────────────────────────
     */
    static async generateCenterBatchHtml(
        batchId: string,
        centerId: string,
        mode: string = 'dual_sided',
        token: string = '',
        query?: any
    ): Promise<string> {
        const centerObjId = new Types.ObjectId(centerId);
        const allCards = await CardModel.find({ batchId, centerId: centerObjId })
            .populate('centerStudentId', 'studentName studentCode gradeLevel')
            .lean();

        if (allCards.length === 0) {
            throw BadRequestException({ message: 'لم يتم العثور على كروت في هذه الدفعة للسنتر' });
        }

        const totalBatchCards = allCards.length;
        const from = Math.max(1, parseInt(query?.from, 10) || 1);
        const to = Math.min(totalBatchCards, parseInt(query?.to, 10) || totalBatchCards);
        const cards = (from > 1 || to < totalBatchCards) ? allCards.slice(from - 1, to) : allCards;

        let normalizedMode = mode || 'dual_sided';
        if (normalizedMode === 'pvc-duplex') normalizedMode = 'dual_sided';
        if (normalizedMode === 'pvc-backs' || normalizedMode === 'backs') normalizedMode = 'back_only';
        if (normalizedMode === 'pvc-fronts' || normalizedMode === 'fronts') normalizedMode = 'front_only';
        if (normalizedMode === 'a4_paper') normalizedMode = 'a4';

        const center = await CenterModel.findById(centerId).lean();
        const centerName = center?.name || 'السنتر التعليمي';
        const centerLogo = center?.logoUrl
            ? `<img src="${center.logoUrl}" alt="${centerName}" class="center-brand-logo" />`
            : '';

        const template = (center as any)?.cardTemplate || {};
        const frontDesign = template.frontImageUrl || template.frontDesignUrl || null;
        const backDesign = template.backImageUrl || template.backDesignUrl || null;
        const qrX = template.qrX ?? 50;
        const qrY = template.qrY ?? 70;
        const qrSize = template.qrSize ?? 25;
        const showQrBg = template.showQrBg !== false;
        const showCardNumber = template.showCardNumber !== false;

        const themePreset = template.themePreset || 'emerald';
        const showCenterLogo = template.showCenterLogo !== false;
        const showBarcode = template.showBarcode !== false;
        const showStudentName = template.showStudentName !== false;
        const showInstructions = Boolean(template.showInstructions);

        // Auto-detect dimensions from custom artwork if uploaded
        let cardWidthMm = 85.6;
        let cardHeightMm = 54;
        let cardAspectRatio = 85.6 / 54;

        const designImage = frontDesign || backDesign;
        if (designImage) {
            try {
                const sample = await loadImage(designImage);
                if (sample.width > 0 && sample.height > 0) {
                    cardAspectRatio = sample.width / sample.height;
                    cardWidthMm = Number((54 * cardAspectRatio).toFixed(1));
                    if (Math.abs(cardWidthMm - 85.6) < 1.5) {
                        cardWidthMm = 85.6;
                    }
                }
            } catch {}
        }

        let headerBg = 'linear-gradient(135deg, #059669, #0d9488)';
        let cardBorder = '1.5px solid #059669';
        if (themePreset === 'dark') {
            headerBg = 'linear-gradient(135deg, #0f172a, #1e293b)';
            cardBorder = '1.5px solid #334155';
        } else if (themePreset === 'indigo') {
            headerBg = 'linear-gradient(135deg, #3730a3, #4f46e5)';
            cardBorder = '1.5px solid #4f46e5';
        } else if (themePreset === 'gold') {
            headerBg = 'linear-gradient(135deg, #78350f, #d97706)';
            cardBorder = '1.5px solid #d97706';
        }

        // Generate QR codes containing cardNumber directly for instant recognition
        const CHUNK_SIZE = 50;
        const cardsWithQr: any[] = [];
        for (let i = 0; i < cards.length; i += CHUNK_SIZE) {
            const chunk = cards.slice(i, i + CHUNK_SIZE);
            const resolved = await Promise.all(
                chunk.map(async (card, cIdx) => {
                    const globalIdx = (from - 1) + i + cIdx + 1;
                    // QR encodes the exact card number so any 2D barcode scanner or camera reads it
                    const qrContent = card.cardNumber;
                    const rawQrDataUrl = await QRCode.toDataURL(qrContent, {
                        width: 220,
                        margin: 1,
                        color: { dark: '#000000', light: '#ffffff' },
                        errorCorrectionLevel: 'M',
                    });
                    return {
                        ...card,
                        displayIndex: globalIdx,
                        qrDataUrl: rawQrDataUrl,
                    };
                })
            );
            cardsWithQr.push(...resolved);
        }

        const renderCenterFront = (card: typeof cardsWithQr[0]) => {
            const student = card.centerStudentId as any;
            if (frontDesign) {
                return `
                    <div class="card-item custom-artwork front">
                        ${showStudentName && student?.studentName ? `
                            <div class="custom-overlay-student">
                                <div class="custom-name">${student.studentName}</div>
                                ${student.gradeLevel ? `<div class="custom-grade">${student.gradeLevel}</div>` : ''}
                            </div>
                        ` : ''}
                        ${showCardNumber ? `<div class="card-num-overlay" dir="ltr">${card.cardNumber}</div>` : ''}
                    </div>
                `;
            }

            return `
                <div class="card-item default-card front">
                    <div class="card-header">
                        <div class="brand">
                            <span class="platform-name">منظومة مُنظِّم</span>
                            <span class="center-sep">|</span>
                            <span class="center-name">${centerName}</span>
                        </div>
                        ${showCenterLogo && centerLogo ? centerLogo : ''}
                    </div>
                    <div class="card-body">
                        <div class="student-name">${student?.studentName || 'بطاقة هوية معتمدة'}</div>
                        ${student?.gradeLevel ? `<div class="student-grade">${student.gradeLevel}</div>` : ''}
                        <div class="card-number-tag" dir="ltr">${card.cardNumber}</div>
                    </div>
                    <div class="card-footer">بطاقة هوية رسمية لدخول السنتر</div>
                </div>
            `;
        };

        const renderCenterBack = (card: typeof cardsWithQr[0]) => {
            if (backDesign) {
                // Pre-calculate position to avoid Chrome print bug with transform + overflow:hidden
                const qrWidthMm = qrSize / 100 * cardWidthMm;
                const qrHeightPct = (qrWidthMm / cardHeightMm) * 100;
                const qrLeft = Math.max(0, qrX - qrSize / 2);
                const qrTop = Math.max(0, qrY - qrHeightPct / 2);
                return `
                    <div class="card-item custom-artwork back">
                        <div class="custom-qr-badge" style="left: ${qrLeft.toFixed(2)}%; top: ${qrTop.toFixed(2)}%; width: ${qrSize}%;">
                            <div class="qr-badge-inner ${showQrBg ? 'has-bg' : ''}">
                                <img class="qr-code-img" src="${card.qrDataUrl}" alt="QR" />
                                ${showCardNumber ? `<div class="badge-card-number" dir="ltr">${card.cardNumber}</div>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="card-item default-card back">
                    <div class="card-header simple">
                        <span class="card-num-tag" dir="ltr">${card.cardNumber}</span>
                        <span class="center-name-sm">${centerName}</span>
                    </div>
                    <div class="card-body back-body">
                        <div class="qr-section">
                            <img class="qr-img" src="${card.qrDataUrl}" alt="QR" />
                        </div>
                        ${showBarcode ? `<div class="barcode-stripe">||| | |||| | ||| || |||</div>` : ''}
                        ${showInstructions ? `
                            <div class="instructions-list">
                                <span>• يُبرز الكارت عند بوابة السنتر.</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="card-footer">SCAN TO VERIFY</div>
                </div>
            `;
        };

        // Render ONLY the active mode to prevent massive DOM & string size
        let contentHtml = '';
        if (normalizedMode === 'dual_sided') {
            contentHtml = cardsWithQr.map((card) => {
                const student = card.centerStudentId as any;
                const studentLabel = student?.studentName ? ` — ${student.studentName}` : '';
                return `
                    <div class="pvc-page">
                        <div class="pvc-screen-badge no-print">
                            <span class="card-id-text">كارت #${card.displayIndex} (${card.cardNumber})${studentLabel}</span>
                            <span class="side-text front">الوجه الأمامي</span>
                        </div>
                        ${renderCenterFront(card)}
                    </div>
                    <div class="pvc-page">
                        <div class="pvc-screen-badge no-print">
                            <span class="card-id-text">كارت #${card.displayIndex} (${card.cardNumber})</span>
                            <span class="side-text back">الوجه الخلفي (QR)</span>
                        </div>
                        ${renderCenterBack(card)}
                    </div>
                `;
            }).join('');
        } else if (normalizedMode === 'back_only') {
            contentHtml = cardsWithQr.map((card) => `
                <div class="pvc-page">
                    <div class="pvc-screen-badge no-print">
                        <span class="card-id-text">كارت #${card.displayIndex} (${card.cardNumber})</span>
                        <span class="side-text back">الظهر فقط (QR)</span>
                    </div>
                    ${renderCenterBack(card)}
                </div>
            `).join('');
        } else if (normalizedMode === 'front_only') {
            contentHtml = cardsWithQr.map((card) => {
                const student = card.centerStudentId as any;
                const studentLabel = student?.studentName ? ` — ${student.studentName}` : '';
                return `
                    <div class="pvc-page">
                        <div class="pvc-screen-badge no-print">
                            <span class="card-id-text">كارت #${card.displayIndex} (${card.cardNumber})${studentLabel}</span>
                            <span class="side-text front">الوجه فقط</span>
                        </div>
                        ${renderCenterFront(card)}
                    </div>
                `;
            }).join('');
        } else if (normalizedMode === 'a4') {
            const PAIRS_PER_PAGE = 4;
            const a4Pages: typeof cardsWithQr[] = [];
            for (let i = 0; i < cardsWithQr.length; i += PAIRS_PER_PAGE) {
                a4Pages.push(cardsWithQr.slice(i, i + PAIRS_PER_PAGE));
            }
            contentHtml = a4Pages.map((pageCards, pIdx) => `
                <div class="a4-page">
                    <div class="a4-meta no-print">صفحة A4 رقم ${pIdx + 1} من ${a4Pages.length} — كل كارت مع ظهره (${pageCards.length} كروت)</div>
                    <div class="pairs-container">
                        ${pageCards.map((card) => `
                            <div class="card-pair-row">
                                <div class="card-side-col">
                                    <span class="side-tag no-print">الوجه الأمامي</span>
                                    ${renderCenterFront(card)}
                                </div>
                                <div class="cut-divider">
                                    <span class="cut-line"></span>
                                    <span class="cut-icon no-print">✂️</span>
                                </div>
                                <div class="card-side-col">
                                    <span class="side-tag no-print">الوجه الخلفي (QR)</span>
                                    ${renderCenterBack(card)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        }

        const isA4 = normalizedMode === 'a4';

        return `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>طباعة كروت السنتر PVC — Batch ${batchId}</title>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
                <style id="page-style">
                    @page { ${isA4 ? 'size: A4 portrait; margin: 6mm;' : `size: ${cardWidthMm}mm ${cardHeightMm}mm; margin: 0;`} }
                </style>
                <style>
                    *, *::before, *::after { box-sizing: border-box; }
                    body, html {
                        font-family: 'Cairo', sans-serif;
                        margin: 0; padding: 0;
                        background: #090d16;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* ── Top Bar ─────────────────────────────────────────────── */
                    .no-print-bar {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 12px 20px;
                        background: #0f172a;
                        color: white;
                        position: sticky;
                        top: 0;
                        z-index: 1000;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                        border-bottom: 1px solid #1e293b;
                        flex-wrap: wrap;
                        gap: 12px;
                    }
                    .no-print-bar .title-info {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .no-print-bar h2 {
                        margin: 0;
                        font-size: 15px;
                        font-weight: 800;
                        color: #f8fafc;
                    }
                    .badge-pvc-tag {
                        background: #059669;
                        color: white;
                        font-size: 11px;
                        font-weight: 700;
                        padding: 3px 10px;
                        border-radius: 20px;
                    }
                    .no-print-bar .badge {
                        background: #3b82f6;
                        padding: 3px 10px;
                        border-radius: 20px;
                        font-size: 11px;
                        font-weight: 700;
                    }
                    .no-print-bar .actions {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        flex-wrap: wrap;
                    }
                    .mode-switch-group, .range-filter-group {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        background: #1e293b;
                        padding: 3px;
                        border-radius: 8px;
                        border: 1px solid #334155;
                        flex-wrap: wrap;
                    }
                    .mode-btn, .range-btn {
                        padding: 6px 13px;
                        font-size: 12px;
                        font-weight: 700;
                        font-family: 'Cairo', sans-serif;
                        color: #94a3b8;
                        background: transparent;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .mode-btn.active, .range-btn.active {
                        background: #059669;
                        color: white;
                        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
                    }
                    .range-label { font-size: 11px; font-weight: 700; color: #94a3b8; margin: 0 6px; }
                    .custom-range { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #94a3b8; margin: 0 4px; }
                    .custom-range input {
                        width: 52px; padding: 2px 4px; background: #0f172a; border: 1px solid #475569;
                        border-radius: 4px; color: white; font-size: 11px; font-family: monospace; text-align: center;
                    }
                    .range-apply-btn { padding: 3px 8px; font-size: 11px; background: #334155; color: white; border: none; border-radius: 4px; cursor: pointer; }
                    .range-apply-btn:hover { background: #475569; }
                    .print-btn {
                        padding: 8px 22px;
                        font-size: 14px;
                        font-weight: 800;
                        font-family: 'Cairo', sans-serif;
                        background: #059669;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        box-shadow: 0 2px 10px rgba(5,150,105,0.4);
                        transition: all 0.2s;
                    }
                    .print-btn:hover { background: #047857; }
                    .toolbar-hint {
                        font-size: 12px;
                        color: #cbd5e1;
                        background: rgba(255,255,255,0.06);
                        padding: 7px 14px;
                        border-radius: 6px;
                        border-right: 3px solid #059669;
                        width: 100%;
                    }

                    /* ── Screen Studio Canvas ─────────────────────────────────── */
                    .studio-canvas {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 20px;
                        justify-content: center;
                        padding: 24px;
                        min-height: calc(100vh - 120px);
                    }
                    .pvc-page {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 6px;
                        background: #1e293b;
                        padding: 10px 10px 12px;
                        border-radius: 12px;
                        border: 1px solid #334155;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                        transition: transform 0.2s, box-shadow 0.2s;
                    }
                    .pvc-page:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 8px 25px rgba(0,0,0,0.4);
                    }
                    .pvc-screen-badge {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        width: ${cardWidthMm}mm;
                        font-size: 10px;
                        font-weight: 700;
                        color: #94a3b8;
                    }
                    .card-id-text { font-family: 'Cairo', system-ui, sans-serif; font-weight: 700; }
                    .side-text {
                        font-size: 9px;
                        padding: 1.5px 6px;
                        border-radius: 4px;
                        background: rgba(255,255,255,0.08);
                    }
                    .side-text.front { color: #34d399; }
                    .side-text.back  { color: #60a5fa; }

                    /* ── Card Dimensions (Matches uploaded design aspect ratio) ── */
                    .card-item {
                        width: ${cardWidthMm}mm;
                        height: ${cardHeightMm}mm;
                        border-radius: 3.5mm;
                        position: relative;
                        overflow: hidden;
                        background: white;
                        display: flex;
                        flex-direction: column;
                        box-sizing: border-box;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .card-item.custom-artwork {
                        position: relative;
                        overflow: hidden;
                        background-size: 100% 100% !important;
                        background-repeat: no-repeat !important;
                        background-position: center !important;
                    }

                    ${frontDesign ? `
                    .card-item.custom-artwork.front {
                        background-image: url("${frontDesign.replace(/"/g, '\\"')}") !important;
                    }
                    ` : ''}

                    ${backDesign ? `
                    .card-item.custom-artwork.back {
                        background-image: url("${backDesign.replace(/"/g, '\\"')}") !important;
                    }
                    ` : ''}

                    .custom-qr-badge {
                        position: absolute;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 5;
                        pointer-events: none;
                    }
                    .qr-badge-inner {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        width: 100%;
                    }
                    .qr-badge-inner.has-bg {
                        background: #ffffff;
                        border-radius: 8px;
                        padding: 6%;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .qr-code-img {
                        width: 100%;
                        height: auto;
                        display: block;
                        aspect-ratio: 1 / 1;
                    }
                    .badge-card-number {
                        font-family: 'Cairo', system-ui, -apple-system, sans-serif;
                        font-size: 11px;
                        font-weight: 900;
                        color: #1e293b;
                        text-align: center;
                        margin-top: 3px;
                        line-height: 1.2;
                        letter-spacing: 0.8px;
                        white-space: nowrap;
                    }
                    .qr-badge-inner:not(.has-bg) .badge-card-number {
                        background: rgba(255, 255, 255, 0.95);
                        padding: 2px 8px;
                        border-radius: 4px;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .card-num-overlay {
                        position: absolute;
                        bottom: 3.5mm;
                        left: 50%;
                        transform: translateX(-50%);
                        font-family: 'Cairo', system-ui, -apple-system, sans-serif;
                        font-size: 9pt;
                        font-weight: 800;
                        background: rgba(15, 23, 42, 0.75);
                        color: white;
                        padding: 2px 8px;
                        border-radius: 4px;
                        letter-spacing: 0.8px;
                        white-space: nowrap;
                        z-index: 10;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .custom-overlay-student {
                        position: absolute;
                        bottom: 24px;
                        right: 14px;
                        z-index: 4;
                        text-shadow: 0 1px 3px rgba(255,255,255,0.8);
                    }
                    .custom-name {
                        font-size: 13px;
                        font-weight: 800;
                        color: #0f172a;
                    }
                    .custom-grade {
                        font-size: 10px;
                        font-weight: 600;
                        color: #475569;
                    }

                    /* ── Default System Card ─────────────────────────────────── */
                    .card-item.default-card {
                        border: ${cardBorder};
                        justify-content: space-between;
                        align-items: center;
                    }
                    .card-header {
                        width: 100%;
                        background: ${headerBg};
                        color: white;
                        padding: 2.5mm 3.5mm;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    }
                    .card-header.simple { background: #f8fafc; padding: 2mm 3.5mm; border-bottom: 1px solid #e2e8f0; }
                    .brand { display: flex; align-items: center; gap: 4px; font-size: 8pt; font-weight: 700; }
                    .center-sep { opacity: 0.5; }
                    .center-brand-logo { height: 6mm; width: 6mm; border-radius: 1mm; background: white; padding: 0.5mm; object-fit: contain; }
                    .card-body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; padding: 2mm; }
                    .student-name { font-size: 10pt; font-weight: 800; color: #0f172a; margin-bottom: 1mm; text-align: center; }
                    .student-grade { font-size: 7.5pt; color: #64748b; font-weight: 600; margin-bottom: 1.5mm; }
                    .card-number-tag { font-family: 'Cairo', system-ui, sans-serif; font-size: 9pt; font-weight: 800; color: #059669; letter-spacing: 0.8px; }
                    .card-footer { font-size: 6.5pt; color: #94a3b8; margin-bottom: 2mm; text-align: center; }
                    .card-num-tag { font-family: 'Cairo', system-ui, sans-serif; font-size: 8pt; font-weight: 800; color: #334155; }
                    .center-name-sm { font-size: 7.5pt; color: #64748b; font-weight: 600; }
                    .back-body { flex: 1; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5mm; }
                    .qr-section { padding: 1mm; background: #ffffff; border-radius: 2mm; display: flex; justify-content: center; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
                    .qr-section .qr-img { width: 22mm; height: 22mm; display: block; }
                    .barcode-stripe { font-family: monospace; font-size: 8pt; letter-spacing: 2px; color: #64748b; }
                    .instructions-list { font-size: 6pt; color: #94a3b8; text-align: center; }

                    /* ── A4 Mode Styles ──────────────────────────────────────── */
                    .a4-canvas { padding: 10px; }
                    .a4-page {
                        width: 210mm;
                        min-height: 297mm;
                        margin: 10mm auto;
                        background: white;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        padding: 8mm 6mm;
                        box-sizing: border-box;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    }
                    .a4-meta { font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 6px; }
                    .pairs-container { display: flex; flex-direction: column; gap: 3.5mm; width: 100%; align-items: center; }
                    .card-pair-row { display: flex; align-items: center; justify-content: center; gap: 3mm; width: 100%; }
                    .card-side-col { display: flex; flex-direction: column; align-items: center; }
                    .side-tag { font-size: 9px; font-weight: 700; color: #94a3b8; margin-bottom: 2px; }
                    .cut-divider { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 54mm; position: relative; padding: 0 2mm; }
                    .cut-line { width: 0; height: 100%; border-right: 1px dashed #cbd5e1; }
                    .cut-icon { position: absolute; font-size: 10px; color: #94a3b8; background: white; padding: 2px; }

                    /* ── Print Styles ────────────────────────────────────────── */
                    @media print {
                        html, body {
                            background: transparent !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                        .no-print, .no-print-bar, .pvc-screen-badge, .a4-meta {
                            display: none !important;
                        }
                        .studio-canvas {
                            display: block !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            background: transparent !important;
                        }
                        .pvc-page {
                            width: ${cardWidthMm}mm !important;
                            height: ${cardHeightMm}mm !important;
                            min-width: ${cardWidthMm}mm !important;
                            min-height: ${cardHeightMm}mm !important;
                            max-width: ${cardWidthMm}mm !important;
                            max-height: ${cardHeightMm}mm !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: transparent !important;
                            border: none !important;
                            border-radius: 0 !important;
                            box-shadow: none !important;
                            page-break-after: always !important;
                            break-after: page !important;
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                            overflow: hidden !important;
                            display: block !important;
                        }
                        .pvc-page:last-child {
                            page-break-after: auto !important;
                            break-after: auto !important;
                        }
                        .card-item {
                            width: ${cardWidthMm}mm !important;
                            height: ${cardHeightMm}mm !important;
                            border-radius: 0 !important;
                            border: none !important;
                            box-shadow: none !important;
                            margin: 0 !important;
                            overflow: hidden !important;
                            clip-path: inset(0) !important;
                        }
                        .a4-page {
                            width: 210mm !important;
                            min-height: 297mm !important;
                            margin: 0 !important;
                            padding: 6mm !important;
                            page-break-after: always !important;
                            break-after: page !important;
                            box-shadow: none !important;
                            background: white !important;
                        }
                        .a4-page:last-child {
                            page-break-after: auto !important;
                            break-after: auto !important;
                        }
                        .cut-line { border-right: 1px dashed #94a3b8; }
                        .cut-icon { display: none !important; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print-bar">
                    <div class="title-info">
                        <h2>💳 طباعة كروت PVC الذكية — ${centerName}</h2>
                        <span class="badge">${cards.length} من ${totalBatchCards} كارت</span>
                        <span class="badge-pvc-tag">مقاس (${cardWidthMm} × ${cardHeightMm} مم)</span>
                    </div>
                    <div class="actions">
                        <div class="mode-switch-group">
                            <button type="button" class="mode-btn ${normalizedMode === 'dual_sided' ? 'active' : ''}" onclick="switchMode('dual_sided')">
                                💳 وجه وظهر متتاليين (${cards.length * 2} صفحة)
                            </button>
                            <button type="button" class="mode-btn ${normalizedMode === 'back_only' ? 'active' : ''}" onclick="switchMode('back_only')">
                                🔲 الظهر فقط (QR) (${cards.length} صفحة)
                            </button>
                            <button type="button" class="mode-btn ${normalizedMode === 'front_only' ? 'active' : ''}" onclick="switchMode('front_only')">
                                🎨 الوجه فقط (${cards.length} صفحة)
                            </button>
                            <button type="button" class="mode-btn ${normalizedMode === 'a4' ? 'active' : ''}" onclick="switchMode('a4')">
                                📄 ورق A4 عادي
                            </button>
                        </div>
                        <button onclick="window.print()" class="print-btn">🖨️ طباعة الآن (Print)</button>
                    </div>
                    ${totalBatchCards > 100 ? `
                    <div class="range-filter-group">
                        <span class="range-label">نطاق الكروت للطباعة:</span>
                        <button type="button" class="range-btn ${(!query?.from && !query?.to) ? 'active' : ''}" onclick="setRange(1, ${totalBatchCards})">
                            الكل (${totalBatchCards})
                        </button>
                        ${buildRangeButtons(totalBatchCards, from, to)}
                        <div class="custom-range">
                            <span>من:</span>
                            <input type="number" id="fromInput" min="1" max="${totalBatchCards}" value="${from}" />
                            <span>إلى:</span>
                            <input type="number" id="toInput" min="1" max="${totalBatchCards}" value="${to}" />
                            <button type="button" onclick="applyCustomRange()" class="range-apply-btn">تطبيق</button>
                        </div>
                    </div>
                    ` : ''}
                    <div class="toolbar-hint">
                        💡 <strong>إعدادات هامة للطباعة (Chrome Print):</strong>
                        اختر الهوامش <strong>(Margins: None)</strong> &nbsp;|&nbsp; فعّل خيار <strong>(Background graphics)</strong>
                    </div>
                </div>

                <div class="${isA4 ? 'a4-canvas' : 'studio-canvas'}">
                    ${contentHtml}
                </div>

                <script>
                    function switchMode(newMode) {
                        const url = new URL(window.location.href);
                        url.searchParams.set('mode', newMode);
                        window.location.href = url.toString();
                    }
                    function setRange(from, to) {
                        const url = new URL(window.location.href);
                        url.searchParams.set('from', from);
                        url.searchParams.set('to', to);
                        window.location.href = url.toString();
                    }
                    function applyCustomRange() {
                        const fromVal = document.getElementById('fromInput').value;
                        const toVal = document.getElementById('toInput').value;
                        setRange(fromVal, toVal);
                    }
                </script>
            </body>
            </html>
        `;
    }
}
