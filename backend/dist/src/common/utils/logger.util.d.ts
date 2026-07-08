export type LogLevel = 'info' | 'warn' | 'error' | 'critical';
interface LogMeta {
    [key: string]: unknown;
}
export declare const logger: {
    info: (message: string, meta?: LogMeta) => void;
    warn: (message: string, meta?: LogMeta) => void;
    error: (message: string, meta?: LogMeta) => void;
    critical: (message: string, meta?: LogMeta) => void;
};
/** Generate a unique request ID — attach to every incoming request */
export declare const generateRequestId: () => string;
export {};
//# sourceMappingURL=logger.util.d.ts.map