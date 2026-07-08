import { randomUUID } from 'crypto';
function safeSerialize(value) {
    if (value === undefined)
        return undefined;
    if (typeof value !== 'object' || value === null)
        return value;
    try {
        return JSON.parse(JSON.stringify(value));
    }
    catch {
        return '[unserializable]';
    }
}
function log(level, message, meta) {
    const payload = {
        level,
        message,
        time: new Date().toISOString(),
    };
    if (meta && typeof meta === 'object') {
        for (const [key, value] of Object.entries(meta)) {
            if (value === undefined)
                continue;
            payload[key] = safeSerialize(value);
        }
    }
    // Single-line JSON — easy to search/parse on AlwaysData/Render
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
}
export const logger = {
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta),
    critical: (message, meta) => log('critical', message, meta),
};
/** Generate a unique request ID — attach to every incoming request */
export const generateRequestId = () => randomUUID();
//# sourceMappingURL=logger.util.js.map