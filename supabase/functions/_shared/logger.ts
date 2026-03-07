type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function getLogLevel(): LogLevel {
    const env = Deno.env.get('LOG_LEVEL')?.toLowerCase();
    return (env && env in LEVELS) ? env as LogLevel : 'info';
}

function formatMessage(level: string, context: string, message: string): string {
    return `[${new Date().toISOString()}] [${level.toUpperCase()}] [${context}] ${message}`;
}

function formatData(data: unknown): string {
    if (data === undefined || data === null) return '';
    try {
        return typeof data === 'object' ? JSON.stringify(data) : String(data);
    } catch {
        return '[Unserializable data]';
    }
}

export interface Logger {
    debug: (message: string, data?: unknown) => void;
    info: (message: string, data?: unknown) => void;
    warn: (message: string, data?: unknown) => void;
    error: (message: string, data?: unknown) => void;
}

export function createLogger(context: string): Logger {
    const minLevel = LEVELS[getLogLevel()];

    const log = (level: LogLevel, message: string, data?: unknown) => {
        if (LEVELS[level] < minLevel) return;

        const formatted = formatMessage(level, context, message);
        const dataStr = data !== undefined ? ` ${formatData(data)}` : '';
        const output = formatted + dataStr;

        switch (level) {
            case 'error': console.error(output); break;
            case 'warn': console.warn(output); break;
            default: console.log(output);
        }
    };

    return {
        debug: (msg, data) => log('debug', msg, data),
        info: (msg, data) => log('info', msg, data),
        warn: (msg, data) => log('warn', msg, data),
        error: (msg, data) => log('error', msg, data),
    };
}
