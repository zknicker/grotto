import { describe, expect, test } from 'bun:test';
import type { AgentRuntimeBrowserSettings } from '@grotto/api';
import {
    createDraft,
    hasDraftChanges,
    normalizeDraft,
    toSaveInput,
} from './browser-settings-model.ts';

const savedSettings = {
    affectedAgents: [],
    application: { path: '/Applications/Google Chrome.app', version: '128.0.0.0' },
    enabled: true,
    profileName: 'default',
    skillConflict: null,
    status: null,
    updatedAt: '2026-07-06T20:00:00.000Z',
} satisfies AgentRuntimeBrowserSettings;

describe('Browser settings model', () => {
    test('loads the saved profile name into the editable draft', () => {
        expect(createDraft(savedSettings).profileName).toBe('default');
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
