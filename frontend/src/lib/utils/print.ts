/**
 * Injects HTML content into a hidden iframe and triggers native print.
 * Completely eliminates popup blocker issues on mobile (iOS/Android) and desktop browsers.
 */
export const printHtmlContent = (htmlContent: string, title?: string) => {
    // Strip any embedded window.print() scripts from the HTML to prevent duplicate print dialog triggers
    const sanitizedHtml = htmlContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*window\.print\(\)[^<]*<\/script>/gi, '');

    try {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.zIndex = '-9999';
        iframe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc && iframe.contentWindow) {
            iframeDoc.open();
            iframeDoc.write(sanitizedHtml);
            if (title) {
                iframeDoc.title = title;
            }
            iframeDoc.close();

            // Allow font loading and layout rendering before triggering print
            setTimeout(() => {
                try {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                } catch (e) {
                    console.warn('Iframe print failed, falling back to window.open', e);
                    fallbackPrint(htmlContent, title);
                } finally {
                    setTimeout(() => {
                        if (document.body.contains(iframe)) {
                            document.body.removeChild(iframe);
                        }
                    }, 3000);
                }
            }, 400);
            return;
        }
    } catch (err) {
        console.warn('Iframe creation error, falling back', err);
    }

    fallbackPrint(htmlContent, title);
};

function fallbackPrint(htmlContent: string, title?: string) {
    try {
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (!printWindow) {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.click();
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(htmlContent);
            if (title) printWindow.document.title = title;
            printWindow.document.close();
        }
    }
}
