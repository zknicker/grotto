import { describe, expect, test } from 'bun:test';
import {
    covePrototypeRuntimes,
    covePrototypeStateOptions,
    getConnectStatusLines,
    getCoveConfigErrors,
    getStepperIndex,
    isValidCoveConfig,
} from './cove-prototype-model.ts';

describe('Cove onboarding prototype model', () => {
    test('exposes every reviewable setup state in flow order', () => {
        expect(covePrototypeStateOptions.map((option) => option.id)).toEqual([
            'choose-server',
            'create-server',
            'connect-computer',
            'command-run',
            'connect-failed',
            'runtimes-detected',
            'meet-cove',
            'validation-error',
            'creating-cove',
            'creation-failed',
            'handoff',
            'onboarding-chat',
        ]);
    });

    test('reports nothing until the setup command has been run', () => {
        expect(getConnectStatusLines('connect-computer')).toEqual([]);
        expect(getConnectStatusLines('command-run')).toEqual([
            { label: 'Request approved.', tone: 'done' },
            { label: 'Computer connected.', tone: 'done' },
            { label: 'Detecting runtimes…', tone: 'waiting' },
        ]);
        expect(getConnectStatusLines('connect-failed').at(-1)).toEqual({
            label: 'Setup stopped before the Computer reported its runtimes.',
            tone: 'failed',
        });
        expect(getConnectStatusLines('runtimes-detected').at(-1)).toEqual({
            label: 'Runtimes detected: Codex, Claude Code.',
            tone: 'done',
        });
    });

    test('maps failures to their owning setup phase', () => {
        expect(getStepperIndex('connect-failed')).toBe(0);
        expect(getStepperIndex('creation-failed')).toBe(1);
        expect(getStepperIndex('handoff')).toBe(2);
        expect(getStepperIndex('onboarding-chat')).toBe(2);
    });

    test('accepts only a runtime and model reported by the same Computer', () => {
        expect(isValidCoveConfig({ modelId: 'gpt-5.5', runtimeId: 'codex' })).toBe(true);
        expect(getCoveConfigErrors({ modelId: 'claude-opus-4-8', runtimeId: 'codex' })).toEqual({
            model: 'Choose a model from the selected runtime.',
        });
        expect(getCoveConfigErrors({ modelId: '', runtimeId: 'pi' })).toEqual({
            model: 'Choose a model from the selected runtime.',
            runtime: 'Choose a runtime the Computer reported.',
        });
    });

    test('keeps an undetected runtime visible without making it selectable', () => {
        expect(covePrototypeRuntimes.find((runtime) => runtime.id === 'pi')).toMatchObject({
            label: 'Pi',
            models: [],
            status: 'undetected',
        });
    });
});
