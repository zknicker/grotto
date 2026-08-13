import { expect, test } from 'bun:test';
import {
    agentExecutionLabels,
    computerHealthColor,
    computerLabel,
    computerRuntimePresentations,
    computerSystemLabel,
} from './presentation.ts';

const inventory = {
    runtimes: [
        {
            id: 'codex',
            label: 'Codex',
            models: [{ id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' }],
        },
    ],
};

test('presents Computer and execution ids as customer-facing labels', () => {
    const computer = {
        architecture: 'arm64',
        id: 'cmp_12345678',
        name: "Zach's MacBook Pro",
        operatingSystem: 'darwin',
    };

    expect(computerLabel(computer)).toBe("Zach's MacBook Pro");
    expect(computerSystemLabel(computer)).toBe('Mac · Apple Silicon');
    expect(
        agentExecutionLabels(
            { desiredModelId: 'gpt-5.6-sol', desiredRuntimeId: 'codex' },
            inventory
        )
    ).toEqual({
        model: 'GPT-5.6 Sol',
        modelAvailable: true,
        runtime: 'Codex',
        runtimeAvailable: true,
    });
});

test('Computer health maps onto HeroUI status colors', () => {
    expect(computerHealthColor('healthy')).toBe('success');
    expect(computerHealthColor('offline')).toBe('default');
    expect(computerHealthColor('degraded')).toBe('warning');
    expect(computerHealthColor('update-required')).toBe('warning');
});

test('uses a neutral platform label before a Computer reports its name', () => {
    expect(
        computerLabel({
            architecture: null,
            id: 'cmp_12345678',
            name: null,
            operatingSystem: 'darwin',
        })
    ).toBe('Mac Computer');
});

test('does not silently substitute another runtime or model', () => {
    expect(
        agentExecutionLabels(
            { desiredModelId: 'missing-model', desiredRuntimeId: 'missing-runtime' },
            inventory
        )
    ).toEqual({
        model: 'missing-model',
        modelAvailable: false,
        runtime: 'missing-runtime',
        runtimeAvailable: false,
    });
});

test('tolerates an inventory payload without runtimes', () => {
    const malformed = {} as Parameters<typeof computerRuntimePresentations>[0];
    const runtimes = computerRuntimePresentations(malformed);
    expect(runtimes.length).toBeGreaterThan(0);
    expect(runtimes.every((runtime) => runtime.detected === false)).toBe(true);
    expect(
        agentExecutionLabels(
            { desiredModelId: 'model-x', desiredRuntimeId: 'runtime-y' },
            malformed
        )
    ).toEqual({
        model: 'model-x',
        modelAvailable: false,
        runtime: 'runtime-y',
        runtimeAvailable: false,
    });
});

test('presents every supported runtime and preserves newly reported runtimes', () => {
    expect(
        computerRuntimePresentations({
            runtimes: [
                inventory.runtimes[0],
                {
                    id: 'future-runtime',
                    label: 'Future Runtime',
                    models: [],
                },
            ],
        }).map(({ detected, id, label }) => ({ detected, id, label }))
    ).toEqual([
        { detected: true, id: 'codex', label: 'Codex' },
        { detected: false, id: 'claude-code', label: 'Claude Code' },
        { detected: false, id: 'grok-build', label: 'Grok Build' },
        { detected: false, id: 'pi', label: 'Pi' },
        { detected: true, id: 'future-runtime', label: 'Future Runtime' },
    ]);
});
