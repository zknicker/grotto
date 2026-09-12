import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync(new URL('../../.env.schema', import.meta.url), 'utf8');

for (const signal of ['TRACES', 'METRICS']) {
    test(`release ${signal.toLowerCase()} configuration does not resolve runtime credentials`, () => {
        for (const suffix of ['ENDPOINT', 'HEADERS']) {
            const name = `OTEL_EXPORTER_OTLP_${signal}_${suffix}`;
            const declaration = schema.split('\n').find((line) => line.startsWith(`${name}=`));
            assert.ok(
                declaration?.startsWith(
                    `${name}=ifs(eq($HAUS_RESOLVE_RELEASE_TOKENS, true), undefined,`
                ),
                `${name} must suppress runtime telemetry before resolving lifecycle values`
            );
            assert.ok(declaration.includes('eq($VARLOCK_ENV, test), undefined,'));
        }
    });
}
