// Type declarations for qrcode-terminal (no @types package available)
declare module 'qrcode-terminal' {
    function generate(input: string, opts?: { small?: boolean }): void;
    function generate(input: string, opts: { small?: boolean } | undefined, cb: (qr: string) => void): void;
    export default { generate };
}
