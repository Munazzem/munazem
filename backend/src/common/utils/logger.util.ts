export type LogLevel = 'info' | 'warn' | 'error';

interface LogMeta {
    [key: string]: unknown;
}

function log(level: LogLevel, message: string, meta?: LogMeta) {
    const payload: Record<string, unknown> = {
        level,
        message,
        time: new Date().toISOString(),
    };

    if (meta && typeof meta === 'object') {
        for (const [key, value] of Object.entries(meta)) {
            // Avoid logging huge / circular objects like req, res
            if (value === undefined) continue;
            if (typeof value === 'object') {
                // Best-effort: JSON.stringify safely
                try {
                    payload[key] = JSON.parse(JSON.stringify(value));
                } catch {
                    payload[key] = '[unserializable]';
                }
            } else {
                payload[key] = value;
            }
        }
    }

    // Single line JSON log — easy to search/parse on Render
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
}

export const logger = {
    info: (message: string, meta?: LogMeta) => log('info', message, meta),
    warn: (message: string, meta?: LogMeta) => log('warn', message, meta),
    error: (message: string, meta?: LogMeta) => log('error', message, meta),
};

