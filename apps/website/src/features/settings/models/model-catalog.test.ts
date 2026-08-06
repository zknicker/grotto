import { expect, test } from 'bun:test';
import { buildModelCatalog, buildRuntimeAccess } from './model-catalog.ts';

const computers = [
    {
        architecture: 'arm64',
        id: 'cmp_one',
        name: "Zach's MacBook Pro",
        operatingSystem: 'darwin',
        reportedInventory: {
            runtimes: [
                {
                    id: 'codex',
                    label: 'Codex',
                    models: [{ id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' }],
                },
            ],
        },
    },
    {
        architecture: 'x64',
        id: 'cmp_two',
        name: 'Build Server',
        operatingSystem: 'linux',
        reportedInventory: {
            runtimes: [
                {
                    id: 'pi',
                    label: 'Pi',
                    models: [
                        { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
                        { id: 'kimi-k2', label: 'Kimi K2' },
                    ],
                },
            ],
        },
    },
];

test('deduplicates models and preserves runtime and Computer availability', () => {
    expect(buildModelCatalog(computers)).toEqual([
        {
            computerCount: 2,
            id: 'gpt-5.6-sol',
            label: 'GPT-5.6 Sol',
            runtimes: ['Codex', 'Pi'],
        },
        {
            computerCount: 1,
            id: 'kimi-k2',
            label: 'Kimi K2',
            runtimes: ['Pi'],
        },
    ]);
});

test('presents runtime access with friendly Computer labels', () => {
    expect(buildRuntimeAccess(computers).map((entry) => entry.computer)).toEqual([
        "Zach's MacBook Pro",
        'Build Server',
    ]);
});
