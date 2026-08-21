/**
 * Opens a new tab, writes the provided HTML content, and the HTML document itself
 * will trigger window.print() and then window.close() after printing.
 */
export const printHtmlContent = (htmlContent: string, title?: string) => {
    // Open a new blank window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        console.error('Failed to open print window. It might be blocked by a popup blocker.');
        alert('يرجى السماح للنوافذ المنبثقة (Popups) من هذا الموقع لتتمكن من الطباعة.');
        return;
    }

    // Write the HTML to the new window
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    if (title) {
        printWindow.document.title = title;
    }
    printWindow.document.close();
};
