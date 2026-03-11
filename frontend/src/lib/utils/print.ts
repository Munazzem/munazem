/**
 * Opens a new tab, writes the provided HTML content, and the HTML document itself
 * will trigger window.print() and then window.close() after printing.
 */
export const printHtmlContent = (htmlContent: string) => {
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
    printWindow.document.close();

    // The backend HTML wrapper already includes a script that automatically calls window.print()
    // However, if the user cancels or finishes printing, we might want to auto-close the tab optionally.
    // For now, let the user manually close the tab after printing, as window.onafterprint is sometimes unreliable.
};
