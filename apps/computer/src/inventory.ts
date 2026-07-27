interface ComputerModel {
    id: string;
    label: string;
}

interface ComputerRuntime {
    id: string;
    label: string;
    models: ComputerModel[];
}

interface ComputerInventory {
    runtimes: ComputerRuntime[];
}

/**
 * Runtimes Grotto Computer knows how to drive, keyed by the CLI that must be
 * on PATH. Only installed runtimes are reported, and the report carries no
 * provider credentials — model availability, never secrets.
 */
const knownRuntimes: { command: string; runtime: ComputerRuntime }[] = [
    {
        command: 'codex',
        runtime: {
            id: 'codex',
            label: 'Codex',
            models: [
                { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
                { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
                { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
            ],
        },
    },
    {
        command: 'claude',
        runtime: {
            id: 'claude-code',
            label: 'Claude Code',
            models: [
                { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
                { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
                { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
            ],
        },
    },
    {
        command: 'pi',
        runtime: { id: 'pi', label: 'Pi', models: [{ id: 'pi', label: 'Pi' }] },
    },
];

/**
 * Reports the sanitized runtime/model inventory. `GROTTO_COMPUTER_INVENTORY`
 * overrides detection with an explicit JSON catalogue for development and tests;
 * otherwise only runtimes whose CLI is installed are reported.
 */
export function detectInventory(): ComputerInventory {
    const override = process.env.GROTTO_COMPUTER_INVENTORY;
    if (override) {
        return JSON.parse(override) as ComputerInventory;
    }
    const runtimes = knownRuntimes
        .filter((entry) => Bun.which(entry.command) !== null)
        .map((entry) => entry.runtime);
    return { runtimes };
}
