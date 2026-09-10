import {
    type EffectRuntime,
    makeLifecycleLoggerLayer,
    makeProcessTelemetryLayer,
} from '@grotto/effect';
import { Layer, ManagedRuntime } from 'effect';

export type ServerRuntime = EffectRuntime<never>;

/** Create the one Effect runtime owned by a Haus Server application. */
export function makeServerRuntime(options?: {
    readonly releaseId?: string;
    readonly serviceRevision?: string;
    readonly serviceVersion?: string;
}): ServerRuntime {
    return ManagedRuntime.make(
        Layer.merge(
            makeLifecycleLoggerLayer(),
            makeProcessTelemetryLayer({
                releaseId: options?.releaseId,
                serviceName: 'grotto-server',
                serviceRevision: options?.serviceRevision,
                serviceVersion: options?.serviceVersion,
            })
        )
    );
}
