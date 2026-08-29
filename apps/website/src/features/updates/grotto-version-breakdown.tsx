import type { GrottoComponentFact } from './grotto-update-model.ts';

export function GrottoVersionBreakdown({ facts }: { facts: readonly GrottoComponentFact[] }) {
    return (
        <dl className="grid gap-2.5 text-sm">
            {facts.map((fact) => {
                const display = factDisplay(fact);
                return (
                    <div className="flex items-baseline justify-between gap-8" key={fact.label}>
                        <dt className="shrink-0 text-muted">{fact.label}</dt>
                        <dd
                            className={`${display.tone} whitespace-nowrap text-right font-mono tabular-nums`}
                        >
                            {display.value}
                        </dd>
                    </div>
                );
            })}
        </dl>
    );
}

function factDisplay(fact: GrottoComponentFact) {
    if (!fact.targetVersion) {
        return { tone: 'text-muted', value: 'Unavailable' };
    }
    if (fact.status === 'external') {
        return { tone: 'text-muted', value: `${fact.targetVersion} · external` };
    }
    if (fact.status === 'current') {
        return { tone: 'text-success', value: `${fact.targetVersion} · up to date` };
    }
    return {
        tone: 'text-danger',
        value: `${fact.currentVersion ?? 'Unknown'} → ${fact.targetVersion} · update`,
    };
}
