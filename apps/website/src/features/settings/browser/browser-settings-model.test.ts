import { describe, expect, test } from 'bun:test';
import type { AgentRuntimeBrowserSettings } from '@grotto/api';
import {
    createDraft,
    hasDraftChanges,
    normalizeDraft,
    toSaveInput,
} from './browser-settings-model.ts';

const savedSettings = {
    application: { path: '/Applications/Google Chrome.app', version: '128.0.0.0' },
    configured: true,
    enabled: true,
    profileName: 'default',
    status: null,
    updatedAt: '2026-07-06T20:00:00.000Z',
} satisfies AgentRuntimeBrowserSettings;

const freshSettings = {
    ...savedSettings,
    configured: false,
    enabled: false,
    updatedAt: null,
} satisfies AgentRuntimeBrowserSettings;

describe('Browser settings model', () => {
    test('loads the saved profile name into the editable draft', () => {
        expect(createDraft(savedSettings).profileName).toBe('default');
    });

    test('defaults first-time setup to enabled so setup behaves like Connect', () => {
        expect(createDraft(freshSettings).enabled).toBe(true);
    });

    test('does not dirty an unchanged profile name', () => {
        const draft = normalizeDraft(createDraft(savedSettings));

        expect(hasDraftChanges(savedSettings, draft)).toBe(false);
        expect(toSaveInput(savedSettings, draft)).toMatchObject({
            enabled: true,
            profileName: 'default',
        });
    });

    test('trims whitespace around a changed profile name', () => {
        const draft = normalizeDraft({ ...createDraft(savedSettings), profileName: '  work  ' });

        expect(hasDraftChanges(savedSettings, draft)).toBe(true);
        expect(toSaveInput(savedSettings, draft)).toMatchObject({
            profileName: 'work',
        });
    });
});
