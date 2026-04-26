import { randomUUID } from 'crypto';

export type LogLevel = 'info' | 'warn' | 'error' | 'critical';

interface LogMeta {
    [key: string]: unknown;
}

function safeSerialize(value: unknown): unknown {
    if (value === undefined) return undefined;
    if (typeof value !== 'object' || value === null) return value;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return '[unserializable]';
    }
}

function log(level: LogLevel, message: string, meta?: LogMeta) {
    const payload: Record<string, unknown> = {
        level,
        message,
        time: new Date().toISOString(),
    };

    if (meta && typeof meta === 'object') {
        for (const [key, value] of Object.entries(meta)) {
            if (value === undefined) continue;
            payload[key] = safeSerialize(value);
        }
    }

    // Single-line JSON — easy to search/parse on AlwaysData/Render
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
}

export const logger = {
    info:     (message: string, meta?: LogMeta) => log('info',     message, meta),
    warn:     (message: string, meta?: LogMeta) => log('warn',     message, meta),
    error:    (message: string, meta?: LogMeta) => log('error',    message, meta),
    critical: (message: string, meta?: LogMeta) => log('critical', message, meta),
};

/** Generate a unique request ID — attach to every incoming request */
export const generateRequestId = (): string => randomUUID();
