import type { HostedComputerInventory } from '@tavern/api';
import {
    type HostedComputerRuntimeId,
    hostedComputerRuntimeCatalog,
} from '@tavern/api/hosted-computer-runtime';
import { resolveRuntimeExecutable } from './runtime-discovery.ts';

type ComputerRuntime = HostedComputerInventory['runtimes'][number];

/**
 * Runtimes Grotto Computer knows how to drive, keyed by the CLI that must be
 * on PATH. Only installed runtimes are reported, and the report carries no
 * provider credentials — model availability, never secrets.
 */
const knownRuntimes: { command: string; runtime: ComputerRuntime }[] = [
    {
        command: 'codex',
        runtime: supportedRuntime('codex', [
            { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
            { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
            { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
        ]),
    },
    {
        command: 'claude',
        runtime: supportedRuntime('claude-code', [
            { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
            { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
            { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
        ]),
    },
    {
        command: 'pi',
        runtime: supportedRuntime('pi', [{ id: 'pi', label: 'Pi' }]),
    },
];

/**
 * Reports the sanitized runtime/model inventory. `GROTTO_COMPUTER_INVENTORY`
 * overrides detection with an explicit JSON catalogue for development and tests;
 * otherwise only runtimes whose CLI is installed are reported.
 */
export function detectInventory(options: { searchPath?: string } = {}): HostedComputerInventory {
    const override = process.env.GROTTO_COMPUTER_INVENTORY;
    if (override) {
        return JSON.parse(override) as HostedComputerInventory;
    }
    const runtimes = knownRuntimes
        .filter(
            (entry) =>
                resolveRuntimeExecutable(entry.command, {
                    searchPath: options.searchPath,
                }) !== null
        )
        .map((entry) => entry.runtime);
    return { runtimes };
}

function supportedRuntime(
    id: HostedComputerRuntimeId,
    models: ComputerRuntime['models']
): ComputerRuntime {
    const runtime = hostedComputerRuntimeCatalog.find((candidate) => candidate.id === id);
    if (!runtime) {
        throw new Error(`Missing supported Computer runtime ${id}.`);
    }
    return { ...runtime, models };
}
