import bwipjs from 'bwip-js';

export class BarcodeUtil {
    /**
     * Generates a Code128 barcode image as a Base64 string.
     * Code128 is a very robust, standard barcode format supported by all scanners.
     * @param text The text to encode (e.g. a student code like '1A')
     * @returns A base64 string formatted for use in an HTML image src (data:image/png;base64,...)
     */
    static async generateBase64Barcode(text: string): Promise<string> {
        return new Promise((resolve, reject) => {
            bwipjs.toBuffer({
                bcid: 'code128',       // Barcode type
                text: text,            // Text to encode
                scale: 3,              // 3x scaling factor
                height: 10,            // Bar height, in millimeters
                includetext: true,     // Show human-readable text
                textxalign: 'center',  // Always good to center text
            }, (err, pngBuffer) => {
                if (err) {
                    reject(err);
                } else {
                    const base64str = pngBuffer.toString('base64');
                    // Return ready-to-use data URI
                    resolve(`data:image/png;base64,${base64str}`);
                }
            });
        });
    }
}
