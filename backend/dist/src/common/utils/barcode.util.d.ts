export declare class BarcodeUtil {
    /**
     * Generates a Code128 barcode image as a Base64 string.
     * Code128 is a very robust, standard barcode format supported by all scanners.
     * @param text The text to encode (e.g. a student code like '1A')
     * @returns A base64 string formatted for use in an HTML image src (data:image/png;base64,...)
     */
    static generateBase64Barcode(text: string): Promise<string>;
}
//# sourceMappingURL=barcode.util.d.ts.map