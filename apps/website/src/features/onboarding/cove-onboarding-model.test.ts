import { describe, expect, test } from 'bun:test';
import { getCoveOnboardingView, getCoveRepairMessage } from './cove-onboarding-model.ts';

describe('Cove onboarding phase-to-view mapping', () => {
    test('shows the Computer connection action before a Computer connects', () => {
        expect(
            getCoveOnboardingView({
                agentId: null,
                applicationId: null,
                channelId: 'cht_onboarding',
                computerId: null,
                failure: null,
                modelId: null,
                phase: 'awaiting-computer',
                runtimeId: null,
            })
        ).toBe('connect-computer');
    });

    test('shows live detection progress after a Computer connects', () => {
        expect(
            getCoveOnboardingView({
                agentId: null,
                applicationId: null,
                channelId: 'cht_onboarding',
                computerId: 'cmp_first',
                failure: null,
                modelId: null,
                phase: 'awaiting-computer',
                runtimeId: null,
            })
        ).toBe('detecting-runtimes');
    });

    test('keeps Computer failures on the repairable connection view', () => {
        expect(
            getCoveOnboardingView({
                agentId: null,
                applicationId: null,
                channelId: 'cht_onboarding',
                computerId: 'cmp_first',
                failure: {
                    code: 'inventory-empty',
                    detail: 'No usable runtime and model were reported.',
                },
                modelId: null,
                phase: 'awaiting-computer',
                runtimeId: null,
            })
        ).toBe('connect-failed');
    });

    test('advances only durable awaiting-Cove state to Meet Cove', () => {
        expect(
            getCoveOnboardingView({
                agentId: null,
                applicationId: null,
                channelId: 'cht_onboarding',
                computerId: 'cmp_first',
                failure: null,
                modelId: null,
                phase: 'awaiting-cove',
                runtimeId: null,
            })
        ).toBe('meet-cove');
    });

    test('keeps application progress gated until the Computer acknowledgement', () => {
        expect(
            getCoveOnboardingView({
                agentId: 'agt_cove',
                applicationId: 'cap_apply',
                channelId: 'cht_onboarding',
                computerId: 'cmp_first',
                failure: null,
                modelId: 'gpt-5.6-sol',
                phase: 'applying',
                runtimeId: 'codex',
            })
        ).toBe('applying-cove');
    });

    test('maps application and disconnect failures to Cove repair without unlocking', () => {
        expect(
            getCoveOnboardingView({
                agentId: 'agt_cove',
                applicationId: 'cap_apply',
                channelId: 'cht_onboarding',
                computerId: 'cmp_first',
                failure: { code: 'application-failed', detail: 'Workspace seed failed.' },
                modelId: 'gpt-5.6-sol',
                phase: 'applying',
                runtimeId: 'codex',
            })
        ).toBe('apply-failed');
    });

    test('unlocks the general App only for durable completion', () => {
        expect(
            getCoveOnboardingView({
                agentId: 'agt_cove',
                applicationId: 'cap_apply',
                channelId: 'cht_onboarding',
                computerId: 'cmp_first',
                failure: null,
                modelId: 'gpt-5.6-sol',
                phase: 'complete',
                runtimeId: 'codex',
            })
        ).toBe('app');
    });
});

describe('Cove onboarding presentation boundary', () => {
    test('never exposes internal application diagnostics to the human', () => {
        const visible = getCoveRepairMessage({
            code: 'application-failed',
            detail: 'Factory acknowledgement failed after workspace seeding.',
        });

        expect(visible).toBe(
            'Cove isn’t ready yet. Make sure this Computer is connected, then try again.'
        );
        expect(visible).not.toMatch(/factory|acknowledg|workspace|seed|configuration/iu);
    });

    test('turns Computer failures into one actionable repair sentence', () => {
        expect(
            getCoveRepairMessage({
                code: 'computer-disconnected',
                detail: 'Internal socket report detail.',
            })
        ).toBe('Reconnect this Computer, then try again.');
    });
});
