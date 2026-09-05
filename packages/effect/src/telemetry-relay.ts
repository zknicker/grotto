import {
    exporterConfig,
    type ProcessTelemetryEnvironment,
    readProcessTelemetryEnvironment,
    telemetryEnabled,
} from './telemetry-configuration.ts';

export type OtlpSignal = 'metrics' | 'traces';

export interface OtlpTelemetryRelay {
    forward(signal: OtlpSignal, payload: Uint8Array): Promise<void>;
}

type OtlpFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export function makeProcessTelemetryRelay(options?: {
    readonly environment?: ProcessTelemetryEnvironment;
    readonly fetch?: OtlpFetch;
    readonly timeoutMs?: number;
}): OtlpTelemetryRelay | null {
    const environment = options?.environment ?? readProcessTelemetryEnvironment();
    if (!telemetryEnabled(environment)) {
        return null;
    }
    const fetchImplementation = options?.fetch ?? fetch;
    const timeoutMs = options?.timeoutMs ?? 10_000;
    return {
        async forward(signal, payload) {
            const config = exporterConfig(environment, signal);
            if (!config.url) {
                throw new Error(`The ${signal} OTLP relay is not configured.`);
            }
            const response = await fetchImplementation(config.url, {
                body: new Blob([Uint8Array.from(payload)]),
                headers: { ...config.headers, 'content-type': 'application/x-protobuf' },
                method: 'POST',
                signal: AbortSignal.timeout(timeoutMs),
            });
            if (!response.ok) {
                throw new Error(`The ${signal} OTLP upstream returned ${response.status}.`);
            }
        },
    };
}
