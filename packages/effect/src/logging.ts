import { HashMap, type Layer, Logger } from 'effect';

export interface LifecycleConsole {
    debug(...values: readonly unknown[]): void;
    error(...values: readonly unknown[]): void;
    info(...values: readonly unknown[]): void;
    log(...values: readonly unknown[]): void;
    trace(...values: readonly unknown[]): void;
    warn(...values: readonly unknown[]): void;
}

/** Render Effect logs through the process console without Effect's timestamp prefix. */
export function makeLifecycleLoggerLayer(output: LifecycleConsole = console): Layer.Layer<never> {
    const logger = Logger.make<unknown, void>(({ annotations, logLevel, message }) => {
        const values = Array.isArray(message) ? message : [message];
        const metadata = Object.fromEntries(annotations);
        const args = HashMap.isEmpty(annotations) ? values : [...values, metadata];
        switch (logLevel._tag) {
            case 'Debug':
                output.debug(...args);
                break;
            case 'Error':
            case 'Fatal':
                output.error(...args);
                break;
            case 'Info':
                output.info(...args);
                break;
            case 'Trace':
                output.trace(...args);
                break;
            case 'Warning':
                output.warn(...args);
                break;
            default:
                output.log(...args);
        }
    });
    return Logger.replace(Logger.defaultLogger, logger);
}
